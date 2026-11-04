/* ServersUp shared behavior: theme toggle, mobile nav, FAQ accordion, footer year.
   The theme is set before first paint by a tiny inline snippet in each page head. */
(function () {
  var root = document.documentElement;
  var STORAGE_KEY = "serversup-theme";

  function currentTheme() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function syncToggle() {
    var btn = document.getElementById("theme-toggle");
    if (btn) btn.setAttribute("aria-pressed", currentTheme() === "dark" ? "true" : "false");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", currentTheme() === "dark" ? "#0e1117" : "#ffffff");
  }

  function setTheme(next) {
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* storage can be blocked; the theme still applies for this visit */
    }
    syncToggle();
  }

  function setupThemeToggle() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      setTheme(currentTheme() === "dark" ? "light" : "dark");
    });
    syncToggle();
  }

  function setupMobileNav() {
    var toggle = document.querySelector(".nav-toggle");
    var links = document.getElementById("nav-links");
    if (!toggle || !links) return;

    function setOpen(next) {
      links.classList.toggle("is-open", next);
      toggle.setAttribute("aria-expanded", next ? "true" : "false");
    }

    toggle.addEventListener("click", function () {
      setOpen(!links.classList.contains("is-open"));
    });
    links.addEventListener("click", function (e) {
      if (e.target instanceof HTMLAnchorElement) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (!links.classList.contains("is-open")) return;
      if (links.contains(e.target) || toggle.contains(e.target)) return;
      setOpen(false);
    });
  }

  function setupFaq() {
    var items = document.querySelectorAll(".faq-item");
    if (!items.length) return;
    items.forEach(function (item) {
      var btn = item.querySelector(".faq-q");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var opening = !item.classList.contains("is-open");
        var group = item.closest(".faq");
        if (opening && group) {
          group.querySelectorAll(".faq-item.is-open").forEach(function (other) {
            other.classList.remove("is-open");
            var ob = other.querySelector(".faq-q");
            if (ob) ob.setAttribute("aria-expanded", "false");
          });
        }
        item.classList.toggle("is-open", opening);
        btn.setAttribute("aria-expanded", opening ? "true" : "false");
      });
    });
  }

  function setupStagePause() {
    var wrap = document.querySelector(".hiw-stage-wrap");
    if (!wrap) return;
    var btn = wrap.querySelector(".hiw-pause");
    if (btn) {
      btn.addEventListener("click", function () {
        var paused = !wrap.classList.contains("is-paused");
        wrap.classList.toggle("is-paused", paused);
        btn.setAttribute("aria-pressed", paused ? "true" : "false");
      });
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        wrap.classList.toggle("is-offscreen", !entries[0].isIntersecting);
      }).observe(wrap);
    }
  }

  function setupPostFilter() {
    var chips = document.querySelectorAll("[data-filter]");
    var list = document.querySelector("[data-post-list]");
    if (!chips.length || !list) return;
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var tag = chip.getAttribute("data-filter");
        chips.forEach(function (c) {
          c.setAttribute("aria-pressed", c === chip ? "true" : "false");
        });
        var shown = 0;
        list.querySelectorAll("[data-tag]").forEach(function (li) {
          li.hidden = tag !== "all" && li.getAttribute("data-tag") !== tag;
          if (!li.hidden) shown += 1;
        });
        var status = document.querySelector("[data-filter-status]");
        if (status) status.textContent = "Showing " + shown + (shown === 1 ? " post" : " posts");
      });
    });
  }

  function setYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  setupThemeToggle();
  setupMobileNav();
  setupFaq();
  setupStagePause();
  setupPostFilter();
  setYear();
})();
