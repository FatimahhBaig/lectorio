const planRoutes = require("./routes/planRoutes");
console.log("THIS IS THE UPDATED SERVER FILE");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Resend } = require("resend");
const User = require("./models/User");

dotenv.config();

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

const VERIFICATION_CODE_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFICATION_ATTEMPTS = 5;
const VERIFICATION_LOCK_MINUTES = 15;
// TODO: Re-enable email verification when sender domain is verified.
const EMAIL_VERIFICATION_ENABLED = process.env.EMAIL_VERIFICATION_ENABLED === "true";

app.use(cors());
app.use(express.json());
app.use("/plans", planRoutes);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidVerificationCode(code) {
  return /^\d{6}$/.test(String(code || "").trim());
}

function generateVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function setVerificationCode(user) {
  const code = generateVerificationCode();

  user.verificationCode = await bcrypt.hash(code, 10);
  user.verificationCodeExpires = new Date(
    Date.now() + VERIFICATION_CODE_MINUTES * 60 * 1000
  );
  user.verificationLastSentAt = new Date();
  user.verificationAttempts = 0;
  user.verificationLockedUntil = undefined;

  return code;
}

function buildVerificationEmail(name, code) {
  const safeName = String(name || "there")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Verify your Lectorio account</title>
      </head>
      <body style="margin:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;">
                <tr>
                  <td style="padding:32px 32px 20px;">
                    <p style="margin:0;color:#4f46e5;font-size:22px;font-weight:800;">Lectorio</p>
                    <h1 style="margin:28px 0 10px;font-size:28px;line-height:1.15;color:#0f172a;">Welcome to Lectorio!</h1>
                    <p style="margin:0;color:#475569;font-size:16px;line-height:1.6;">Hi ${safeName}, use this code to verify your account and start building focused study plans.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 32px 28px;">
                    <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:18px;padding:24px;text-align:center;">
                      <p style="margin:0 0 12px;color:#4338ca;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Your verification code</p>
                      <p style="margin:0;color:#111827;font-size:40px;font-weight:800;letter-spacing:.28em;">${code}</p>
                    </div>
                    <p style="margin:22px 0 0;color:#475569;font-size:15px;line-height:1.6;">This code expires in 10 minutes.</p>
                    <p style="margin:14px 0 0;color:#64748b;font-size:14px;line-height:1.6;">Ignore this email if you didn't create an account.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

async function sendVerificationEmail(user, code) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error("Email service is not configured.");
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: user.email,
    subject: "Verify your Lectorio account",
    html: buildVerificationEmail(user.name, code)
  });
}

// Home route
app.get("/", (req, res) => {
  res.send("Lectorio Backend Running 🚀");
});

// Signup API
app.post("/signup", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!name || !isValidEmail(email) || password.length < 6) {
      return res.status(400).json({
        message: "Please enter a valid name, email, and password.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    let verificationCode = null;

    if (EMAIL_VERIFICATION_ENABLED) {
      verificationCode = await setVerificationCode(user);
    } else {
      // TODO: Re-enable email verification when sender domain is verified.
      user.isVerified = true;
    }

    await user.save();

    if (EMAIL_VERIFICATION_ENABLED) {
      try {
        await sendVerificationEmail(user, verificationCode);
      } catch (emailError) {
        await User.deleteOne({ _id: user._id });
        throw emailError;
      }
    }

    res.status(201).json({
      message: EMAIL_VERIFICATION_ENABLED
        ? "Signup successful. Please verify your email."
        : "Signup successful",
      email: user.email,
      requiresVerification: EMAIL_VERIFICATION_ENABLED,
      verificationCodeExpires: user.verificationCodeExpires,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Login API
app.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({
        message: "Please enter a valid email and password.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid password",
      });
    }

    // TODO: Re-enable email verification when sender domain is verified.
    if (EMAIL_VERIFICATION_ENABLED && !user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email first.",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Verify Email API
app.post("/verify-email", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || "").trim();

    if (!isValidEmail(email) || !isValidVerificationCode(code)) {
      return res.status(400).json({
        message: "Please enter the 6-digit verification code.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    if (user.isVerified) {
      return res.json({
        message: "Email already verified. You can log in now.",
      });
    }

    if (
      user.verificationLockedUntil &&
      user.verificationLockedUntil > new Date()
    ) {
      return res.status(429).json({
        message: "Too many attempts. Please try again later.",
      });
    }

    if (!user.verificationCode || !user.verificationCodeExpires) {
      return res.status(400).json({
        message: "No active verification code. Please resend a new code.",
      });
    }

    if (user.verificationCodeExpires < new Date()) {
      return res.status(400).json({
        message: "Verification code expired. Please resend a new code.",
      });
    }

    const isCodeValid = await bcrypt.compare(code, user.verificationCode);

    if (!isCodeValid) {
      user.verificationAttempts = Number(user.verificationAttempts || 0) + 1;

      if (user.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
        user.verificationLockedUntil = new Date(
          Date.now() + VERIFICATION_LOCK_MINUTES * 60 * 1000
        );
      }

      await user.save();

      return res.status(400).json({
        message:
          user.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS
            ? "Too many invalid attempts. Please try again later."
            : "Invalid verification code.",
      });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    user.verificationLastSentAt = undefined;
    user.verificationAttempts = 0;
    user.verificationLockedUntil = undefined;

    await user.save();

    res.json({
      message: "Email verified successfully. You can log in now.",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Resend Verification API
app.post("/resend-verification", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Please enter a valid email address.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        message: "This email is already verified.",
      });
    }

    if (user.verificationLastSentAt) {
      const elapsedSeconds = Math.floor(
        (Date.now() - user.verificationLastSentAt.getTime()) / 1000
      );

      if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
        return res.status(429).json({
          message: "Please wait before requesting another code.",
          retryAfterSeconds: RESEND_COOLDOWN_SECONDS - elapsedSeconds,
        });
      }
    }

    const previousVerificationState = {
      verificationCode: user.verificationCode,
      verificationCodeExpires: user.verificationCodeExpires,
      verificationLastSentAt: user.verificationLastSentAt,
      verificationAttempts: user.verificationAttempts,
      verificationLockedUntil: user.verificationLockedUntil,
    };

    const verificationCode = await setVerificationCode(user);
    await user.save();

    try {
      await sendVerificationEmail(user, verificationCode);
    } catch (emailError) {
      user.verificationCode = previousVerificationState.verificationCode;
      user.verificationCodeExpires =
        previousVerificationState.verificationCodeExpires;
      user.verificationLastSentAt =
        previousVerificationState.verificationLastSentAt;
      user.verificationAttempts = previousVerificationState.verificationAttempts;
      user.verificationLockedUntil =
        previousVerificationState.verificationLockedUntil;
      await user.save();
      throw emailError;
    }

    res.json({
      message: "A new verification code has been sent.",
      email: user.email,
      verificationCodeExpires: user.verificationCodeExpires,
      retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
}

startServer();
