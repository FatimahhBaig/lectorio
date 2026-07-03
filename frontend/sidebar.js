console.log("sidebar.js loaded");

fetch("components/sidebar.html")
  .then((response) => response.text())
  .then((data) => {
    document.getElementById("sidebarContainer").innerHTML = data;

    const user = JSON.parse(localStorage.getItem("lectorioUser"));

    if (user) {
      const name = document.getElementById("sidebarUserName");
      const email = document.getElementById("sidebarUserEmail");

      if (name) name.textContent = user.name;
      if (email) email.textContent = user.email;
    }

    const currentPage = window.location.pathname.split("/").pop();

    const links = document.querySelectorAll(".sidebar-link");

    links.forEach((link) => {
      const linkPage = link.getAttribute("href");

      if (linkPage === currentPage) {
        link.classList.remove("text-slate-700", "hover:bg-slate-100");
        link.classList.add("bg-indigo-500", "text-white");
      }
    });

    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("lectorioToken");
        localStorage.removeItem("lectorioUser");

        window.location.href = "login.html";
      });
    }
  });