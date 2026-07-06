const API_BASE_URL = "https://lectorio.onrender.com";
const VERIFY_DURATION_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;

const form = document.getElementById("verifyEmailForm");
const inputs = Array.from(document.querySelectorAll(".code-input"));
const emailText = document.getElementById("verifyEmailText");
const message = document.getElementById("verifyMessage");
const verifyBtn = document.getElementById("verifyBtn");
const resendBtn = document.getElementById("resendCodeBtn");
const countdownTimer = document.getElementById("countdownTimer");
const successBadge = document.getElementById("successBadge");

const params = new URLSearchParams(window.location.search);
const email =
  params.get("email") ||
  localStorage.getItem("lectorioPendingVerificationEmail") ||
  "";

let expiresAt =
  localStorage.getItem("lectorioVerificationExpiresAt") ||
  new Date(Date.now() + VERIFY_DURATION_SECONDS * 1000).toISOString();
let countdownInterval = null;
let resendCooldownUntil = 0;

if (emailText) {
  emailText.textContent = email || "your email";
}

inputs.forEach((input, index) => {
  input.className =
    "code-input h-12 w-full rounded-xl border border-slate-300 bg-white text-center text-xl font-extrabold text-slate-950 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 sm:h-14 sm:text-2xl";

  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 1);

    if (input.value && inputs[index + 1]) {
      inputs[index + 1].focus();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !input.value && inputs[index - 1]) {
      inputs[index - 1].focus();
    }
  });

  input.addEventListener("paste", (event) => {
    event.preventDefault();
    const pastedCode = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    pastedCode.split("").forEach((digit, digitIndex) => {
      if (inputs[digitIndex]) inputs[digitIndex].value = digit;
    });

    const nextInput = inputs[Math.min(pastedCode.length, inputs.length - 1)];
    if (nextInput) nextInput.focus();
  });
});

function getCode() {
  return inputs.map((input) => input.value).join("");
}

function setMessage(text, type) {
  message.textContent = text;
  message.className =
    "mt-5 min-h-6 text-center text-sm font-semibold " +
    (type === "success"
      ? "text-emerald-600"
      : type === "muted"
        ? "text-slate-500"
        : "text-red-500");
}

function setLoading(isLoading, label) {
  verifyBtn.disabled = isLoading;
  resendBtn.disabled = isLoading || Date.now() < resendCooldownUntil;
  verifyBtn.textContent = isLoading ? label : "Verify Email";
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function startCountdown() {
  clearInterval(countdownInterval);

  function updateCountdown() {
    const secondsLeft = Math.max(
      0,
      Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)
    );

    countdownTimer.textContent = formatTime(secondsLeft);

    if (secondsLeft === 0) {
      countdownTimer.textContent = "Expired";
      setMessage("Verification code expired. Please resend a new code.", "muted");
      clearInterval(countdownInterval);
    }
  }

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function startResendCooldown(seconds) {
  resendCooldownUntil = Date.now() + seconds * 1000;
  resendBtn.disabled = true;

  const cooldownInterval = setInterval(() => {
    const secondsLeft = Math.ceil((resendCooldownUntil - Date.now()) / 1000);

    if (secondsLeft <= 0) {
      clearInterval(cooldownInterval);
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend Code";
      return;
    }

    resendBtn.textContent = "Resend in " + secondsLeft + "s";
  }, 1000);
}

async function postJson(path, body) {
  const response = await fetch(API_BASE_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.data = data;
    throw error;
  }

  return data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const code = getCode();

  if (!email) {
    setMessage("Missing email address. Please sign up again.", "error");
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    setMessage("Please enter the complete 6-digit code.", "error");
    return;
  }

  setLoading(true, "Verifying...");
  setMessage("Checking your code...", "muted");

  try {
    const data = await postJson("/verify-email", { email, code });

    localStorage.removeItem("lectorioPendingVerificationEmail");
    localStorage.removeItem("lectorioVerificationExpiresAt");
    successBadge.classList.remove("hidden");
    successBadge.classList.add("flex", "verify-success-pop");
    setMessage(data.message || "Email verified successfully.", "success");

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);
  } catch (error) {
    setMessage(error.message || "Verification failed.", "error");
    setLoading(false);
  }
});

resendBtn.addEventListener("click", async () => {
  if (!email) {
    setMessage("Missing email address. Please sign up again.", "error");
    return;
  }

  resendBtn.disabled = true;
  resendBtn.textContent = "Sending...";
  setMessage("Sending a new code...", "muted");

  try {
    const data = await postJson("/resend-verification", { email });

    expiresAt =
      data.verificationCodeExpires ||
      new Date(Date.now() + VERIFY_DURATION_SECONDS * 1000).toISOString();
    localStorage.setItem("lectorioVerificationExpiresAt", expiresAt);

    inputs.forEach((input) => {
      input.value = "";
    });
    inputs[0].focus();
    startCountdown();
    startResendCooldown(data.retryAfterSeconds || RESEND_COOLDOWN_SECONDS);
    setMessage(data.message || "A new code has been sent.", "success");
  } catch (error) {
    const retryAfterSeconds = error.data && error.data.retryAfterSeconds;
    if (retryAfterSeconds) startResendCooldown(retryAfterSeconds);
    else {
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend Code";
    }

    setMessage(error.message || "Could not resend code.", "error");
  }
});

localStorage.setItem("lectorioPendingVerificationEmail", email);
localStorage.setItem("lectorioVerificationExpiresAt", expiresAt);
startCountdown();
startResendCooldown(RESEND_COOLDOWN_SECONDS);

if (inputs[0]) inputs[0].focus();
