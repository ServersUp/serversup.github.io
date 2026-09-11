(function () {
  "use strict";

  var GA_ID = "G-ZQGB78C9LT";
  var CONSENT_KEY = "serversup_analytics_consent_v1";
  var CONSENT_GRANTED = "granted";
  var CONSENT_DENIED = "denied";
  var analyticsLoaded = false;
  var consentBanner = null;
  var previousFocus = null;

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
      return window.localStorage.getItem(CONSENT_KEY);
    } catch (error) {
      return null;
    }
  }

  function writeConsent(value) {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch (error) {
      // The current page still honors the choice when storage is unavailable.
    }
  }

  function loadAnalytics() {
    if (analyticsLoaded) return;
    analyticsLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    try {
      if (new URLSearchParams(window.location.search).get("debug_mode") === "true") {
        window.gtag("config", GA_ID, { debug_mode: true });
      }
    } catch (error) {
      /* ignore bad URL */
    }

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    script.id = "serversup-gtag";
    document.head.appendChild(script);
  }

  function clearAnalyticsCookies() {
    document.cookie.split(";").forEach(function (part) {
      var name = part.trim().split("=")[0];
      if (name.indexOf("_ga") !== 0) return;
      document.cookie = name + "=; Max-Age=0; path=/";
    });
  }

  function disableAnalytics() {
    if (!analyticsLoaded) return;
    if (typeof gtag === "function") {
      gtag("consent", "update", { analytics_storage: "denied" });
    }
    var script = document.getElementById("serversup-gtag");
    if (script) script.remove();
    window.gtag = undefined;
    analyticsLoaded = false;
    clearAnalyticsCookies();
  }

  function track(name, params) {
    if (readConsent() !== CONSENT_GRANTED || typeof gtag !== "function") return;
    gtag("event", name, params);
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
    } catch (error) {
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

  function consentLabel() {
    return readConsent() === CONSENT_GRANTED
      ? "Analytics are currently allowed."
      : "Analytics are currently declined.";
  }

  function updateConsentStatus() {
    if (!consentBanner) return;
    var status = consentBanner.querySelector("[data-consent-status]");
    if (!status) return;
    status.hidden = !readConsent();
    status.textContent = consentLabel();
  }

  function hideConsentBanner() {
    if (!consentBanner) return;
    consentBanner.hidden = true;
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
    previousFocus = null;
  }

  function showConsentBanner(shouldFocus) {
    if (!consentBanner) return;
    updateConsentStatus();
    consentBanner.hidden = false;
    if (shouldFocus) {
      var accept = consentBanner.querySelector('[data-consent="accept"]');
      if (accept) accept.focus();
    }
  }

  function setConsent(value) {
    writeConsent(value);
    if (value === CONSENT_GRANTED) {
      loadAnalytics();
    } else {
      disableAnalytics();
    }
    updateConsentStatus();
    hideConsentBanner();
  }

  function createConsentBanner() {
    var banner = document.createElement("section");
    banner.className = "consent-banner";
    banner.hidden = true;
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-labelledby", "consent-banner-title");
    banner.setAttribute("aria-describedby", "consent-banner-description");
    banner.innerHTML =
      '<div class="consent-banner__content">' +
      '<p class="consent-banner__eyebrow">Privacy choices</p>' +
      '<h2 id="consent-banner-title">Choose whether optional analytics can run</h2>' +
      '<p id="consent-banner-description">ServersUp uses Google Analytics to understand which pages and setup paths are useful. Live status, Discord installation, and webhook setup work either way. You can change this choice later from Privacy settings in the footer.</p>' +
      '<p class="consent-banner__status" data-consent-status hidden></p>' +
      "</div>" +
      '<div class="consent-banner__actions">' +
      '<button type="button" class="consent-banner__button consent-banner__button--accept" data-consent="accept">Allow analytics</button>' +
      '<button type="button" class="consent-banner__button consent-banner__button--decline" data-consent="decline">Decline</button>' +
      "</div>";

    banner.addEventListener("click", function (event) {
      var action = event.target.closest("[data-consent]");
      if (!action) return;
      setConsent(action.getAttribute("data-consent") === "accept" ? CONSENT_GRANTED : CONSENT_DENIED);
    });

    document.body.appendChild(banner);
    consentBanner = banner;
  }

  function addSettingsControl() {
    var footer = document.querySelector(".site-footer");
    if (!footer || footer.querySelector("[data-consent-settings]")) return;

    var settings = document.createElement("button");
    settings.type = "button";
    settings.className = "consent-settings";
    settings.setAttribute("data-consent-settings", "true");
    settings.textContent = "Privacy settings";
    settings.addEventListener("click", function () {
      previousFocus = settings;
      showConsentBanner(true);
    });

    var paragraph = footer.querySelector("p");
    if (paragraph) {
      paragraph.appendChild(document.createTextNode(" · "));
      paragraph.appendChild(settings);
    } else {
      footer.appendChild(settings);
    }
  }

  function setupConsent() {
    createConsentBanner();
    addSettingsControl();

    var consent = readConsent();
    if (consent === CONSENT_GRANTED) {
      loadAnalytics();
    } else if (consent !== CONSENT_DENIED) {
      showConsentBanner(false);
    }
  }

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupConsent, { once: true });
  } else {
    setupConsent();
  }
})();
