const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

togglePassword.addEventListener("click", () => {
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    togglePassword.textContent = "🙈";
  } else {
    passwordInput.type = "password";
    togglePassword.textContent = "👁";
  }
});
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  message.textContent = "Logging in...";
  message.className = "text-center text-sm font-medium text-slate-500";

  try {
    const response = await fetch("http://localhost:5001/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      message.textContent = data.message || "Login failed";
      message.className = "text-center text-sm font-medium text-red-500";
      return;
    }

    localStorage.setItem("lectorioToken", data.token);
    localStorage.setItem("lectorioUser", JSON.stringify(data.user));

    message.textContent = "Login successful!";
    message.className = "text-center text-sm font-medium text-green-600";

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1000);

  } catch (error) {
    message.textContent = "Backend is not running.";
    message.className = "text-center text-sm font-medium text-red-500";
    console.log(error);
  }
});