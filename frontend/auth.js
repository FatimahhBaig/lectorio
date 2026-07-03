const token = localStorage.getItem("lectorioToken");

if (!token) {
  window.location.href = "login.html";
}