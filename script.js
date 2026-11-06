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
  },
  ffxiv: {
    label: "Final Fantasy XIV",
    short: "FFXIV",
    dataUrl: "../data/ffxiv-servers.json",
    regions: { na: "NA", eu: "EU", jp: "JP", oce: "OCE" },
    defaultRegion: "na",
  },
  forever: {
    label: "World of Warcraft: Forever",
    short: "WoW Forever",
    dataUrl: "../data/forever-servers.json",
    regions: { us: "US", eu: "EU", kr: "KR", tw: "TW" },
    defaultRegion: "us",
    serverNoun: "Ruleset", // Forever has no realms; each "server" is a ruleset
  },
};

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

  const SUBMIT_LABEL = "Send test alert and subscribe";
  const cache = {};
  let gameId = "wow";
  let region = GAMES.wow.defaultRegion;
  let servers = [];
  let selectedServer = "";
  let selectionKind = ""; // "region" | "server"

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

  function setSelected(kind, label) {
    selectionKind = kind || "";
    selectedServer = kind === "server" ? label : "";
    const human =
      kind === "region"
        ? "ALL servers - " + GAMES[gameId].regions[region]
        : label || "";
    if (selectionEl) {
      selectionEl.textContent = human ? "Selected: " + human : "No server selected.";
    }
    for (const li of listEl.children) {
      if (!(li instanceof HTMLElement)) continue;
      const code = li.querySelector("code");
      const name = code ? code.textContent : "";
      const k = li.getAttribute("data-kind") || "server";
      const on = k === kind && name === label;
      li.classList.toggle("is-selected", on);
      const optionBtn = li.querySelector('[role="option"]');
      if (optionBtn) optionBtn.setAttribute("aria-selected", on ? "true" : "false");
    }
    syncOptions();
    clearDone();
    updateSubmit();
  }

  function updateSubmit() {
    if (submitBtn instanceof HTMLButtonElement) {
      submitBtn.disabled = form.dataset.submitting === "true" || form.dataset.done === "true";
    }
  }

  function friendlyError(data) {
    const raw = (data && data.error) || "";
    if (/webhook|ownership|proof|url/i.test(raw)) {
      return "We could not post to that webhook. Check the URL and that the webhook still exists, then try again.";
    }
    return raw || "Could not subscribe right now. Check the URL and try again.";
  }

  function clearDone() {
    if (form.dataset.done !== "true") return;
    delete form.dataset.done;
    submitBtn.textContent = SUBMIT_LABEL;
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
      tab.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function syncRegionButtons() {
    for (const btn of regionRow.querySelectorAll("[data-region-tab]")) {
      const active = btn.getAttribute("data-region-tab") === region;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
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
      btn.textContent = cfg.regions[key];
      btn.addEventListener("click", () => {
        if (region === key) return;
        region = key;
        syncRegionButtons();
        applyServers(regions[region] || []);
        setSelected("");
      });
      regionRow.appendChild(btn);
    }
    syncRegionButtons();
  }

  function makeAllOption(kind, label) {
    const li = document.createElement("li");
    li.setAttribute("role", "presentation");
    li.setAttribute("data-kind", kind);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wh-server-item wh-server-item--all";
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", selectionKind === kind ? "true" : "false");
    const code = document.createElement("code");
    code.textContent = label;
    btn.appendChild(code);
    const hint = document.createElement("span");
    hint.className = "wh-server-item__hint";
    hint.textContent =
      "Notified once if every server in this region is down, once when they all recover";
    btn.appendChild(hint);
    btn.addEventListener("click", () => setSelected(kind, label));
    li.appendChild(btn);
    return li;
  }

  function renderList(filtered) {
    listEl.replaceChildren();
    listEl.appendChild(makeAllOption("region", "ALL SERVERS - " + GAMES[gameId].regions[region]));
    if (filtered.length === 0) {
      const empty = document.createElement("li");
      empty.className = "wh-server-list__empty";
      empty.setAttribute("role", "presentation");
      empty.textContent = "No matches.";
      listEl.appendChild(empty);
    }
    for (const name of filtered) {
      const li = document.createElement("li");
      li.setAttribute("role", "presentation");
      li.setAttribute("data-kind", "server");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wh-server-item";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", selectionKind === "server" && name === selectedServer ? "true" : "false");
      const code = document.createElement("code");
      code.textContent = name;
      btn.appendChild(code);
      btn.addEventListener("click", () => setSelected("server", name));
      li.appendChild(btn);
      listEl.appendChild(li);
    }
    syncOptions();
  }

  function options() {
    return Array.from(listEl.querySelectorAll('[role="option"]'));
  }

  // One tab stop for the whole list (roving tabindex); arrow keys move between options.
  function syncOptions() {
    const all = options();
    const current = all.find((o) => o.getAttribute("aria-selected") === "true") || all[0];
    for (const o of all) o.tabIndex = o === current ? 0 : -1;
  }

  listEl.addEventListener("keydown", (e) => {
    const all = options();
    const i = all.indexOf(document.activeElement);
    if (i === -1) return;
    let next = -1;
    if (e.key === "ArrowDown") next = Math.min(i + 1, all.length - 1);
    else if (e.key === "ArrowUp") next = Math.max(i - 1, 0);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = all.length - 1;
    if (next === -1) return;
    e.preventDefault();
    for (const o of all) o.tabIndex = -1;
    all[next].tabIndex = 0;
    all[next].focus();
  });

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
    const serverLabel = panel.querySelector('label[for="wh-server-search"]');
    if (serverLabel) serverLabel.textContent = GAMES[id].serverNoun || "Server";
    setSelected("");
    try {
      const regions = await getRegions(id);
      renderRegionTabs(regions);
      applyServers(regions[region] || []);
    } catch {
      regionRow.replaceChildren();
      listEl.replaceChildren();
      if (countEl) countEl.textContent = "-";
      setStatus("Could not load the server list. Reload the page and try again.", "is-error");
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
  webhookInput.addEventListener("input", () => {
    clearDone();
    updateSubmit();
  });

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
    clearDone();
    for (const body of panel.querySelectorAll("[data-help-body]")) body.hidden = true;
    for (const btn of panel.querySelectorAll("[data-help]")) btn.setAttribute("aria-expanded", "false");
    setSelected("");
    setStatus("");
    updateSubmit();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.dataset.submitting === "true") return;

    const webhookURL = webhookInput.value.trim();
    if (!webhookURL) {
      setStatus("Paste a Discord webhook URL first.", "is-error");
      return;
    }
    if (selectionKind !== "region" && !selectedServer) {
      setStatus("Pick a server, or choose ALL servers in a region.", "is-error");
      return;
    }

    const payload = {
      webhookUrl: webhookURL,
      game: gameId,
      region: region,
    };
    if (selectionKind === "server") payload.server = selectedServer;
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
        let msg = "Done. Check Discord for your test alert - it is live now.";
        if (selectionKind === "region") {
          msg = "Done. Subscribed to ALL " + GAMES[gameId].regions[region] + " servers - you'll be notified once if every server is down, and once when they all recover.";
        }
        setStatus(msg, "is-success");
        form.dataset.done = "true";
        window.ServersUpAnalytics?.track("webhook_subscribed", { game: gameId, region: region, server: selectedServer, scope: selectionKind === "region" ? "region" : "server" });
      } else if (res.status === 409) {
        setStatus("This webhook is already subscribed to that server.", "is-error");
      } else {
        setStatus(friendlyError(data), "is-error");
      }
    } catch {
      setStatus("Could not reach the subscribe service. Check your connection and try again.", "is-error");
    } finally {
      delete form.dataset.submitting;
      updateSubmit();
      submitBtn.textContent = form.dataset.done === "true" ? "Subscribed" : SUBMIT_LABEL;
    }
  });

  showGame(gameId);
}

hardenExternalLinks();
setupWebhookForm();
