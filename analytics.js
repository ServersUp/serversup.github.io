(function () {
  "use strict";

  var GA_ID = "G-ZQGB78C9LT";
  var CONSENT_KEY = "serversup-analytics-consent";
  var consent = readConsent();

  var LOCATION_SELECTORS = [
    [".site-header", "header"],
    [".site-footer", "footer"],
    [".status-cta", "home_bottom"],
    [".status-seo-fallback", "seo_fallback"],
    [".article-cta", "article_end"],
    [".install-cta-after-faq", "after_faq"],
  ];

  function readConsent() {
    try {
      var stored = window.localStorage.getItem(CONSENT_KEY);
      return stored === "accepted" || stored === "rejected" ? stored : "unknown";
    } catch (e) {
      return "unknown";
    }
  }

  function writeConsent(next) {
    try {
      window.localStorage.setItem(CONSENT_KEY, next);
    } catch (e) {
      /* A blocked storage area should not block the site or analytics choice. */
    }
    consent = next;
  }

  function track(name, params) {
    if (consent !== "accepted" || typeof window.gtag !== "function") return;
    window.gtag("event", name, params);
  }

  function labelFrom(el) {
    var text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length > 80) text = text.slice(0, 80);
    return text;
  }

  function resolveLocation(el, isOauth) {
    var marked = el.closest("[data-track-location]");
    if (marked) {
      var explicit = marked.getAttribute("data-track-location");
      if (explicit) return explicit;
    }

    for (var i = 0; i < LOCATION_SELECTORS.length; i++) {
      if (el.closest(LOCATION_SELECTORS[i][0])) {
        return LOCATION_SELECTORS[i][1];
      }
    }

    if (isOauth && el.closest("#about")) return "hero";
    return "body";
  }

  function isInstallPath(pathname) {
    return pathname === "/install" || pathname === "/install/";
  }

  function hrefInfo(anchor) {
    var raw = anchor.getAttribute("href");
    if (!raw || raw.charAt(0) === "#") return null;

    var url;
    try {
      url = new URL(raw, window.location.href);
    } catch (e) {
      return null;
    }

    var isOauth = url.href.indexOf("discord.com/oauth2/authorize") !== -1;
    var isInstall =
      url.origin === window.location.origin && isInstallPath(url.pathname);

    if (!isOauth && !isInstall) return null;
    return { isOauth: isOauth, isInstall: isInstall };
  }

  function isFaqDetails(el) {
    if (!(el instanceof HTMLDetailsElement)) return false;
    if (el.classList.contains("faq-item")) return true;
    return !!(el.closest(".article-faq") || el.closest("#faq"));
  }

  function loadGoogleAnalytics() {
    if (consent !== "accepted") return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);

    try {
      if (new URLSearchParams(window.location.search).get("debug_mode") === "true") {
        window.gtag("config", GA_ID, { debug_mode: true });
      }
    } catch (e) {
      /* Ignore malformed URL state. */
    }

    if (document.querySelector("script[data-serversup-analytics]")) return;
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    script.dataset.serversupAnalytics = "true";
    document.head.appendChild(script);
  }

  function disableGoogleAnalytics() {
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", { analytics_storage: "denied" });
    }
    window.dataLayer = [];
    window.gtag = function () {};
  }

  function setBannerVisible(visible, focus) {
    var banner = document.getElementById("analytics-consent-banner");
    var settings = document.getElementById("analytics-consent-settings");
    if (!banner || !settings) return;

    banner.hidden = !visible;
    settings.hidden = visible || consent === "unknown";
    settings.setAttribute("aria-expanded", visible ? "true" : "false");
    document.body.classList.toggle("consent-banner-visible", visible);
    if (visible && focus) {
      var reject = banner.querySelector("[data-consent-reject]");
      if (reject) reject.focus();
    }
  }

  function choose(next) {
    writeConsent(next);
    if (next === "accepted") {
      loadGoogleAnalytics();
    } else {
      disableGoogleAnalytics();
    }
    setBannerVisible(false, false);
  }

  function createConsentUI() {
    if (!document.body || document.getElementById("analytics-consent-banner")) return;

    var banner = document.createElement("aside");
    banner.id = "analytics-consent-banner";
    banner.className = "analytics-consent";
    banner.setAttribute("aria-labelledby", "analytics-consent-title");
    banner.setAttribute("aria-describedby", "analytics-consent-copy");
    banner.innerHTML =
      '<div class="analytics-consent__copy">' +
      '<p class="analytics-consent__eyebrow">Privacy choices</p>' +
      '<h2 id="analytics-consent-title">Help us improve ServersUp</h2>' +
      '<p id="analytics-consent-copy">Optional Google Analytics helps us understand which pages and setup links are useful. Live status and Discord installation work either way.</p>' +
      '<a href="/privacy/">Read the privacy policy</a>' +
      "</div>" +
      '<div class="analytics-consent__actions">' +
      '<button type="button" class="btn-cta analytics-consent__accept" data-consent-accept>Allow analytics</button>' +
      '<button type="button" class="analytics-consent__reject" data-consent-reject>Keep essentials only</button>' +
      "</div>";

    var settings = document.createElement("button");
    settings.id = "analytics-consent-settings";
    settings.type = "button";
    settings.className = "analytics-consent__settings";
    settings.textContent = "Privacy choices";
    settings.setAttribute("aria-controls", banner.id);
    settings.setAttribute("aria-expanded", "false");

    document.body.appendChild(banner);
    document.body.appendChild(settings);

    banner.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-consent-accept]")) choose("accepted");
      if (target.closest("[data-consent-reject]")) choose("rejected");
    });
    settings.addEventListener("click", function () {
      setBannerVisible(true, true);
    });

    setBannerVisible(consent === "unknown", false);
  }

  window.ServersUpAnalytics = {
    getConsent: function () {
      return consent;
    },
    track: track,
    showSettings: function () {
      setBannerVisible(true, true);
    },
  };

  if (consent === "accepted") loadGoogleAnalytics();

  document.addEventListener("DOMContentLoaded", createConsentUI, false);
  if (document.readyState !== "loading") createConsentUI();

  document.addEventListener(
    "click",
    function (event) {
      var anchor = event.target && event.target.closest
        ? event.target.closest("a[href]")
        : null;
      if (!anchor) return;

      var info = hrefInfo(anchor);
      if (!info) return;

      var label = labelFrom(anchor);
      var location = resolveLocation(anchor, info.isOauth);

      if (info.isOauth) {
        track("discord_oauth_clicked", {
          location: location,
          label: label,
          page_path: window.location.pathname,
        });
        return;
      }

      track("cta_clicked", {
        location: location,
        label: label,
      });
    },
    false
  );

  document.addEventListener(
    "toggle",
    function (event) {
      var details = event.target;
      if (!isFaqDetails(details) || !details.open) return;

      var summary = details.querySelector("summary");
      var question = labelFrom(summary || details);

      track("faq_opened", {
        question: question,
        page_path: window.location.pathname,
      });
    },
    true
  );
})();
