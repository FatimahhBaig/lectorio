console.log("sidebar.js loaded");

fetch("components/sidebar.html")
  .then((response) => response.text())
  .then((data) => {
    const sidebarContainer = document.getElementById("sidebarContainer");

    if (!sidebarContainer) return;

    sidebarContainer.innerHTML = data;
    document.body.classList.add("has-mobile-shell");

    if (!document.getElementById("mobileAppHeader")) {
      document.body.insertAdjacentHTML(
        "afterbegin",
        `
          <header id="mobileAppHeader" class="mobile-app-header lg:hidden">
            <a href="dashboard.html" class="text-lg font-bold text-indigo-600" aria-label="Lectorio dashboard">
              Lectorio
            </a>
            <button id="sidebarOpenBtn" type="button" class="mobile-menu-button" aria-controls="appSidebar" aria-expanded="false" aria-label="Open navigation">
              &#9776;
            </button>
          </header>
          <div id="sidebarOverlay" class="sidebar-overlay" aria-hidden="true"></div>
        `
      );
    }

    const openBtn = document.getElementById("sidebarOpenBtn");
    const closeBtn = document.getElementById("sidebarCloseBtn");
    const overlay = document.getElementById("sidebarOverlay");

    function openSidebar() {
      document.body.classList.add("sidebar-open");
      if (openBtn) openBtn.setAttribute("aria-expanded", "true");
    }

    function closeSidebar() {
      document.body.classList.remove("sidebar-open");
      if (openBtn) openBtn.setAttribute("aria-expanded", "false");
    }

    if (openBtn) openBtn.addEventListener("click", openSidebar);
    if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
    if (overlay) overlay.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeSidebar();
    });

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

      link.addEventListener("click", closeSidebar);
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
