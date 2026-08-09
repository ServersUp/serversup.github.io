const DISCORD_OAUTH_URL =
  "https://discord.com/oauth2/authorize?client_id=1497867221106688181";

const WEBHOOK_SUBSCRIBE_URL =
  "https://hlgru24uwnv2vncb5rh4bwishq0sqbpk.lambda-url.us-east-1.on.aws/";

const GAMES = {
  wow: {
    label: "World of Warcraft",
    short: "WoW",
    dataUrl: "../data/wow-servers.json",
    regions: { us: "US", eu: "EU", kr: "KR", tw: "TW" },
    defaultRegion: "us",
    unit: "realms",
  },
  ffxiv: {
    label: "Final Fantasy XIV",
    short: "FFXIV",
    dataUrl: "../data/ffxiv-servers.json",
    regions: { na: "NA", eu: "EU", jp: "JP", oce: "OCE" },
    defaultRegion: "na",
    unit: "worlds",
  },
};

function setYear() {
  const el = document.getElementById("year");
  if (el) el.textContent = String(new Date().getFullYear());
}

function setupMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.getElementById("nav-links");
  if (!(toggle instanceof HTMLButtonElement) || !(links instanceof HTMLElement)) return;

  function setOpen(next) {
    links.classList.toggle("is-open", next);
    toggle.setAttribute("aria-expanded", next ? "true" : "false");
  }

  toggle.addEventListener("click", () => setOpen(!links.classList.contains("is-open")));

  links.addEventListener("click", (e) => {
    const t = e.target;
    if (t instanceof HTMLAnchorElement) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (!links.classList.contains("is-open")) return;
    if (links.contains(t) || toggle.contains(t)) return;
    setOpen(false);
  });
}

function setupSmoothScroll() {
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const a = t.closest('a[data-scroll="true"]');
    if (!(a instanceof HTMLAnchorElement)) return;

    const href = a.getAttribute("href") || "";
    if (!href.startsWith("#")) return;

    const target = document.querySelector(href);
    if (!(target instanceof HTMLElement)) return;

    e.preventDefault();
    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, targetTop - 12), behavior: "smooth" });
    history.pushState(null, "", href);
  });
}

function hardenExternalLinks() {
  for (const a of document.querySelectorAll('a[target="_blank"]')) {
    if (!(a instanceof HTMLAnchorElement)) continue;
    const rel = (a.getAttribute("rel") || "").toLowerCase();
    if (!rel.includes("noreferrer")) a.setAttribute("rel", "noreferrer");
  }

  for (const a of document.querySelectorAll('a[href="' + DISCORD_OAUTH_URL + '"]')) {
    if (!(a instanceof HTMLAnchorElement)) continue;
    a.setAttribute("href", DISCORD_OAUTH_URL);
  }
}

async function loadGameRegions(id) {
  const bundled = window.SERVERSUP_GAME_DATA?.[id];
  if (bundled) return bundled;

  const res = await fetch(GAMES[id].dataUrl);
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  return data.regions || {};
}

async function setupGameBrowser() {
  const root = document.getElementById("game-browser");
  if (!(root instanceof HTMLElement)) return;

  const gameTabs = root.querySelectorAll("[data-game-tab]");
  const regionRow = root.querySelector("[data-region-row]");
  const searchInput = root.querySelector("[data-realm-search]");
  const listEl = root.querySelector("[data-realm-list]");
  const countEl = root.querySelector("[data-realm-count]");
  const statusEl = document.querySelector("[data-realm-status]");

  if (
    !(regionRow instanceof HTMLElement) ||
    !(searchInput instanceof HTMLInputElement) ||
    !(listEl instanceof HTMLElement) ||
    !(countEl instanceof HTMLElement)
  ) {
    return;
  }

  const cache = {};
  let gameId = "wow";
  let region = GAMES.wow.defaultRegion;
  let servers = [];

  async function getRegions(id) {
    if (cache[id]) return cache[id];
    const regions = await loadGameRegions(id);
    cache[id] = regions;
    return regions;
  }

  function setGameTabActive(id) {
    for (const tab of gameTabs) {
      if (!(tab instanceof HTMLButtonElement)) continue;
      const active = tab.getAttribute("data-game-tab") === id;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    }
  }

  function renderRegionTabs(regions) {
    regionRow.replaceChildren();
    const cfg = GAMES[gameId];
    const keys = Object.keys(cfg.regions);
    if (!keys.includes(region)) region = cfg.defaultRegion;

    for (const key of keys) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "region-tab";
      btn.setAttribute("data-region-tab", key);
      btn.setAttribute("role", "tab");
      btn.textContent = cfg.regions[key];
      if (key === region) {
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");
      } else {
        btn.setAttribute("aria-selected", "false");
      }
      btn.addEventListener("click", () => {
        if (region === key) return;
        region = key;
        renderRegionTabs(regions);
        applyServers(regions[region] || []);
      });
      regionRow.appendChild(btn);
    }
  }

  function renderList(filtered) {
    listEl.replaceChildren();
    if (filtered.length === 0) {
      const empty = document.createElement("li");
      empty.className = "realm-empty";
      empty.textContent = "No matches.";
      listEl.appendChild(empty);
      return;
    }
    for (const name of filtered) {
      const li = document.createElement("li");
      li.className = "realm-item";
      const code = document.createElement("code");
      code.textContent = name;
      li.appendChild(code);
      listEl.appendChild(li);
    }
  }

  function applyFilter() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q.length === 0 ? servers : servers.filter((s) => s.toLowerCase().includes(q));
    renderList(filtered);
    countEl.textContent = `${filtered.length} / ${servers.length}`;
  }

  function applyServers(next) {
    servers = Array.isArray(next) ? [...next].sort((a, b) => a.localeCompare(b)) : [];
    searchInput.value = "";
    applyFilter();
  }

  async function showGame(id) {
    gameId = id;
    region = GAMES[id].defaultRegion;
    setGameTabActive(id);
    if (statusEl instanceof HTMLElement) statusEl.textContent = "Loading…";

    try {
      const regions = await getRegions(id);
      renderRegionTabs(regions);
      applyServers(regions[region] || []);
      if (statusEl instanceof HTMLElement) statusEl.textContent = "";
    } catch {
      regionRow.replaceChildren();
      listEl.replaceChildren();
      countEl.textContent = "-";
      if (statusEl instanceof HTMLElement) statusEl.textContent = "Could not load server list.";
    }
  }

  for (const tab of gameTabs) {
    tab.addEventListener("click", () => {
      if (!(tab instanceof HTMLButtonElement)) return;
      const id = tab.getAttribute("data-game-tab");
      if (!id || id === gameId || !GAMES[id]) return;
      showGame(id);
    });
  }

  searchInput.addEventListener("input", applyFilter);
  searchInput.addEventListener("search", applyFilter);

  showGame(gameId);
}

function setupHelpPops(root) {
  for (const btn of root.querySelectorAll("[data-help]")) {
    if (!(btn instanceof HTMLButtonElement)) continue;
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-help");
      const body = root.querySelector('[data-help-body="' + id + '"]');
      if (!(body instanceof HTMLElement)) return;
      const next = body.hidden;
      body.hidden = !next;
      btn.setAttribute("aria-expanded", next ? "true" : "false");
    });
  }
}

async function setupWebhookForm() {
  const openButtons = document.querySelectorAll("[data-webhook-open]");
  const panel = document.getElementById("webhook-form");
  if (openButtons.length === 0 || !(panel instanceof HTMLDialogElement)) return;

  const form = panel.querySelector("[data-webhook-form]");
  const statusEl = panel.querySelector("[data-webhook-status]");
  const submitBtn = panel.querySelector("[data-webhook-submit]");
  const webhookInput = panel.querySelector("#webhook-url");
  const roleInput = panel.querySelector("#wh-role-id");
  const honeypot = panel.querySelector('input[name="honeypot"]');
  const gameTabs = panel.querySelectorAll("[data-wh-game-tab]");
  const regionRow = panel.querySelector("[data-wh-region-row]");
  const searchInput = panel.querySelector("[data-wh-server-search]");
  const listEl = panel.querySelector("[data-wh-server-list]");
  const countEl = panel.querySelector("[data-wh-server-count]");
  const selectionEl = panel.querySelector("[data-wh-selection]");

  const cache = {};
  let gameId = "wow";
  let region = GAMES.wow.defaultRegion;
  let servers = [];
  let selectedServer = "";

  if (
    !(form instanceof HTMLFormElement) ||
    !(statusEl instanceof HTMLElement) ||
    !(submitBtn instanceof HTMLButtonElement) ||
    !(webhookInput instanceof HTMLInputElement) ||
    !(regionRow instanceof HTMLElement) ||
    !(searchInput instanceof HTMLInputElement) ||
    !(listEl instanceof HTMLElement) ||
    !(countEl instanceof HTMLElement)
  ) {
    return;
  }

  function setStatus(message, kind) {
    statusEl.textContent = message || "";
    statusEl.classList.remove("is-error", "is-success");
    if (kind) statusEl.classList.add(kind);
  }

  function setSelected(server) {
    selectedServer = server;
    if (selectionEl) {
      selectionEl.textContent = server ? "Selected: " + server : "No server selected.";
    }
    for (const li of listEl.children) {
      if (!(li instanceof HTMLElement)) continue;
      const code = li.querySelector("code");
      const name = code ? code.textContent : "";
      li.classList.toggle("is-selected", name === server);
    }
    updateSubmit();
  }

  function updateSubmit() {
    const ready = Boolean(webhookInput && webhookInput.value.trim()) && Boolean(selectedServer);
    if (submitBtn instanceof HTMLButtonElement) {
      submitBtn.disabled = !ready || form.dataset.submitting === "true";
    }
  }

  async function getRegions(id) {
    if (cache[id]) return cache[id];
    const regions = await loadGameRegions(id);
    cache[id] = regions;
    return regions;
  }

  function setGameTabActive(id) {
    for (const tab of gameTabs) {
      if (!(tab instanceof HTMLButtonElement)) continue;
      const active = tab.getAttribute("data-wh-game-tab") === id;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    }
  }

  function renderRegionTabs(regions) {
    regionRow.replaceChildren();
    const cfg = GAMES[gameId];
    const keys = Object.keys(cfg.regions);
    if (!keys.includes(region)) region = cfg.defaultRegion;

    for (const key of keys) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "region-tab";
      btn.setAttribute("data-region-tab", key);
      btn.setAttribute("role", "tab");
      btn.textContent = cfg.regions[key];
      if (key === region) {
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");
      } else {
        btn.setAttribute("aria-selected", "false");
      }
      btn.addEventListener("click", () => {
        if (region === key) return;
        region = key;
        renderRegionTabs(regions);
        applyServers(regions[region] || []);
        setSelected("");
      });
      regionRow.appendChild(btn);
    }
  }

  function renderList(filtered) {
    listEl.replaceChildren();
    if (filtered.length === 0) {
      const empty = document.createElement("li");
      empty.className = "wh-server-list__empty";
      empty.textContent = "No matches.";
      listEl.appendChild(empty);
      return;
    }
    for (const name of filtered) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wh-server-item";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", name === selectedServer ? "true" : "false");
      const code = document.createElement("code");
      code.textContent = name;
      btn.appendChild(code);
      btn.addEventListener("click", () => setSelected(name));
      li.appendChild(btn);
      listEl.appendChild(li);
    }
  }

  function applyFilter() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q.length === 0 ? servers : servers.filter((s) => s.toLowerCase().includes(q));
    renderList(filtered);
    if (countEl) countEl.textContent = `${filtered.length} / ${servers.length}`;
  }

  function applyServers(next) {
    servers = Array.isArray(next) ? [...next].sort((a, b) => a.localeCompare(b)) : [];
    searchInput.value = "";
    applyFilter();
  }

  async function showGame(id) {
    gameId = id;
    region = GAMES[id].defaultRegion;
    setGameTabActive(id);
    setSelected("");
    try {
      const regions = await getRegions(id);
      renderRegionTabs(regions);
      applyServers(regions[region] || []);
    } catch {
      regionRow.replaceChildren();
      listEl.replaceChildren();
      if (countEl) countEl.textContent = "-";
    }
  }

  for (const tab of gameTabs) {
    tab.addEventListener("click", () => {
      if (!(tab instanceof HTMLButtonElement)) return;
      const id = tab.getAttribute("data-wh-game-tab");
      if (!id || id === gameId || !GAMES[id]) return;
      showGame(id);
    });
  }

  searchInput.addEventListener("input", applyFilter);
  webhookInput.addEventListener("input", updateSubmit);

  setupHelpPops(panel);

  function openModal() {
    if (!(panel instanceof HTMLDialogElement)) return;
    if (!panel.open) panel.showModal();
  }

  function closeModal() {
    if (panel instanceof HTMLDialogElement && panel.open) panel.close();
  }

  for (const btn of openButtons) {
    if (!(btn instanceof HTMLButtonElement)) continue;
    btn.addEventListener("click", openModal);
  }

  const closeBtn = panel.querySelector("[data-webhook-close]");
  if (closeBtn instanceof HTMLButtonElement) {
    closeBtn.addEventListener("click", closeModal);
  }

  panel.addEventListener("click", (e) => {
    if (!(e.target instanceof Node)) return;
    if (e.target === panel) closeModal();
  });

  panel.addEventListener("close", () => {
    if (form instanceof HTMLFormElement) form.reset();
    setSelected("");
    setStatus("");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.dataset.submitting === "true") return;

    const webhookURL = webhookInput.value.trim();
    if (!webhookURL) {
      setStatus("Paste a Discord webhook URL first.", "is-error");
      return;
    }
    if (!selectedServer) {
      setStatus("Pick a server from the list.", "is-error");
      return;
    }

    const payload = {
      webhookUrl: webhookURL,
      game: gameId,
      region: region,
      server: selectedServer,
    };
    if (roleInput && roleInput.value.trim()) payload.roleId = roleInput.value.trim();
    if (honeypot && honeypot.value) payload.honeypot = honeypot.value;

    form.dataset.submitting = "true";
    submitBtn.disabled = true;
    setStatus("Sending test alert to your webhook…");
    submitBtn.textContent = "Sending…";

    try {
      const res = await fetch(WEBHOOK_SUBSCRIBE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus("Done. Check Discord for your test alert - it is live now.", "is-success");
        if (typeof gtag === "function") {
          gtag("event", "webhook_subscribed", { game: gameId, region: region, server: selectedServer });
        }
      } else if (res.status === 409) {
        setStatus("This webhook is already subscribed to that server.", "is-error");
      } else {
        setStatus((data && data.error) || "Could not subscribe right now. Check the URL and try again.", "is-error");
      }
    } catch {
      setStatus("Could not reach the subscribe service. Check your connection and try again.", "is-error");
    } finally {
      delete form.dataset.submitting;
      updateSubmit();
      submitBtn.textContent = "Send test alert and subscribe";
    }
  });

  showGame(gameId);
}

setYear();
setupMobileNav();
setupSmoothScroll();
hardenExternalLinks();
setupGameBrowser();
setupWebhookForm();
