const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

togglePassword.addEventListener("click", function () {
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    togglePassword.textContent = "🙈";
  } else {
    passwordInput.type = "password";
    togglePassword.textContent = "👁";
  }
});
const signupForm = document.getElementById("signupForm");
const message = document.getElementById("message");

signupForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  message.textContent = "Creating account...";
  message.className = "text-sm text-center font-medium text-slate-500";

  try {
    const response = await fetch("http://localhost:5001/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name,
        email: email,
        password: password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      message.textContent = data.message || "Signup failed";
      message.className = "text-sm text-center font-medium text-red-500";
      return;
    }

    message.textContent = "Account created successfully!";
    message.className = "text-sm text-center font-medium text-green-600";

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);

  } catch (error) {
    message.textContent = "Backend is not running or connection failed.";
    message.className = "text-sm text-center font-medium text-red-500";
    console.log(error);
  }
});