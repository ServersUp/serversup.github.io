// Same-origin on the CloudFront host; absolute URL elsewhere (github.io / local)
// so /status/latest.json is not required on GitHub Pages.
const CANONICAL_HOST = "serversup.armasn.dev";
const CANONICAL_STATUS_URL = `https://${CANONICAL_HOST}/status/latest.json`;
const STATUS_URL =
  typeof location !== "undefined" && location.hostname === CANONICAL_HOST
    ? "/status/latest.json"
    : CANONICAL_STATUS_URL;
const STATUS_POLL_MS = 15000;

const GAME_META = {
  wow: {
    label: "World of Warcraft",
    short: "WoW",
    regionOrder: ["us", "eu", "kr", "tw"],
    regionLabels: { us: "US", eu: "EU", kr: "KR", tw: "TW" },
  },
  ffxiv: {
    label: "Final Fantasy XIV",
    short: "FFXIV",
    regionOrder: ["na", "eu", "jp", "oce"],
    regionLabels: { na: "NA", eu: "EU", jp: "JP", oce: "OCE" },
  },
};

const PLACEHOLDER_TEXT = "Select a game and region to view servers.";

function setYear() {
  const el = document.getElementById("year");
  if (el) el.textContent = String(new Date().getFullYear());
}

function normalizeStatus(raw) {
  const s = String(raw || "UNKNOWN").toUpperCase();
  if (s === "UP" || s === "DOWN") return s;
  return "UNKNOWN";
}

function statusRank(st) {
  if (st === "DOWN") return 0;
  if (st === "UNKNOWN") return 1;
  return 2;
}

function formatRelativeTime(unixSeconds) {
  if (!unixSeconds || typeof unixSeconds !== "number" || unixSeconds <= 0) return null;
  const diffMs = Date.now() - unixSeconds * 1000;
  if (!Number.isFinite(diffMs)) return null;
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function countStatuses(servers) {
  let up = 0;
  let down = 0;
  let unknown = 0;
  for (const s of servers) {
    const st = normalizeStatus(s.status);
    if (st === "UP") up += 1;
    else if (st === "DOWN") down += 1;
    else unknown += 1;
  }
  return { up, down, unknown, total: servers.length };
}

function makeStat(cls, label, n) {
  const span = document.createElement("span");
  span.className = `stat ${cls}`;
  span.textContent = `${n} ${label}`;
  return span;
}

function sortServers(list) {
  return [...list].sort((a, b) => {
    const ra = statusRank(normalizeStatus(a.status));
    const rb = statusRank(normalizeStatus(b.status));
    if (ra !== rb) return ra - rb;
    return String(a.slug || "").localeCompare(String(b.slug || ""));
  });
}

/** Max lastUpdatedAt among servers - that field is last status *change*, not last poll. */
function latestChangeAt(servers) {
  let max = 0;
  for (const s of servers) {
    const t = Number(s.lastUpdatedAt) || 0;
    if (t > max) max = t;
  }
  return max || null;
}

function setupStatusPage() {
  const subEl = document.querySelector("[data-status-sub]");
  const regionsEl = document.querySelector("[data-status-regions]");
  const gridEl = document.querySelector("[data-status-grid]");
  const totalsEl = document.querySelector("[data-status-totals]");
  const metaUpdatedEl = document.querySelector("[data-meta-updated]");
  const metaChangedEl = document.querySelector("[data-meta-changed]");
  const searchInput = document.querySelector("[data-status-search]");
  const loadingEl = document.querySelector("[data-status-loading]");
  const errorEl = document.querySelector("[data-status-error]");
  const gameBtns = document.querySelectorAll("[data-pick-game]");

  if (
    !(regionsEl instanceof HTMLElement) ||
    !(gridEl instanceof HTMLElement) ||
    !(totalsEl instanceof HTMLElement) ||
    !(metaUpdatedEl instanceof HTMLElement) ||
    !(metaChangedEl instanceof HTMLElement) ||
    !(searchInput instanceof HTMLInputElement) ||
    !(loadingEl instanceof HTMLElement) ||
    !(errorEl instanceof HTMLElement)
  ) {
    return;
  }

  let snapshot = null;
  let gameId = null;
  let region = null;
  let query = "";
  let fetchInFlight = null;

  function setSub(text) {
    if (subEl instanceof HTMLElement) subEl.textContent = text;
  }

  function setGameButtons() {
    for (const btn of gameBtns) {
      if (!(btn instanceof HTMLButtonElement)) continue;
      const id = btn.getAttribute("data-pick-game");
      const active = id === gameId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    }
  }

  function showPlaceholder(message) {
    gridEl.replaceChildren();
    const el = document.createElement("div");
    el.className = "server-placeholder";
    el.setAttribute("data-status-placeholder", "");
    el.textContent = message;
    gridEl.appendChild(el);
  }

  function renderSkeletonRows(count) {
    gridEl.replaceChildren();
    for (let i = 0; i < count; i += 1) {
      const row = document.createElement("div");
      row.className = "server-row server-row--skeleton";
      row.setAttribute("aria-hidden", "true");
      row.innerHTML =
        '<span class="server-dot server-dot--skeleton"></span>' +
        '<span class="server-name server-name--skeleton"></span>' +
        '<span class="server-flag server-flag--skeleton"></span>';
      gridEl.appendChild(row);
    }
  }

  function resetFoot() {
    totalsEl.replaceChildren();
    totalsEl.appendChild(makeStat("stat--up", "UP", "-"));
    totalsEl.appendChild(makeStat("stat--down", "DOWN", "-"));
    metaUpdatedEl.textContent = "-";
    metaChangedEl.textContent = "-";
  }

  function renderMeta(servers) {
    const feedRel = formatRelativeTime(snapshot?.generatedAt);
    metaUpdatedEl.textContent = feedRel || "-";

    const changeRel = formatRelativeTime(latestChangeAt(servers));
    metaChangedEl.textContent = changeRel || "-";
  }

  function currentServers() {
    if (!snapshot || !gameId || !region) return [];
    const list = snapshot.games?.[gameId]?.regions?.[region]?.servers;
    return Array.isArray(list) ? list : [];
  }

  function renderServerRow(server) {
    const st = normalizeStatus(server.status);
    const row = document.createElement("div");
    row.className = `server-row server-row--${st.toLowerCase()}`;

    const changed = formatRelativeTime(Number(server.lastUpdatedAt) || 0);
    const bits = [server.label || server.slug || ""];
    if (changed) bits.push(`Last Changed At ${changed}`);
    row.title = bits.filter(Boolean).join(" · ");

    const dot = document.createElement("span");
    dot.className = `server-dot server-dot--${st.toLowerCase()}`;
    dot.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "server-name";
    name.textContent = server.slug || server.label || "unknown";

    const flag = document.createElement("span");
    flag.className = "server-flag";
    flag.textContent = st;

    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(flag);
    return row;
  }

  function renderIdle() {
    searchInput.disabled = true;
    searchInput.value = "";
    query = "";
    resetFoot();
    showPlaceholder(PLACEHOLDER_TEXT);
  }

  function renderResults() {
    const servers = currentServers();
    const filtered = sortServers(
      servers.filter((s) => {
        if (!query) return true;
        const slug = String(s.slug || "").toLowerCase();
        const label = String(s.label || "").toLowerCase();
        return slug.includes(query) || label.includes(query);
      }),
    );

    searchInput.disabled = false;

    totalsEl.replaceChildren();
    const c = countStatuses(filtered);
    totalsEl.appendChild(makeStat("stat--up", "UP", c.up));
    totalsEl.appendChild(makeStat("stat--down", "DOWN", c.down));
    if (c.unknown > 0) totalsEl.appendChild(makeStat("stat--unknown", "UNK", c.unknown));

    renderMeta(servers);

    gridEl.replaceChildren();
    if (filtered.length === 0) {
      showPlaceholder(query ? "No servers match your search." : "No servers in this region.");
      return;
    }

    for (const server of filtered) gridEl.appendChild(renderServerRow(server));
  }

  function renderRegions() {
    regionsEl.replaceChildren();
    if (!gameId || !snapshot) {
      regionsEl.hidden = true;
      return;
    }

    const meta = GAME_META[gameId];
    const regions = snapshot.games?.[gameId]?.regions || {};
    const keys = (meta?.regionOrder || Object.keys(regions)).filter((k) => regions[k]);

    for (const key of keys) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "status-pick__region";
      btn.setAttribute("role", "tab");
      btn.setAttribute("data-pick-region", key);
      btn.textContent = meta?.regionLabels?.[key] || key.toUpperCase();
      const active = key === region;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.addEventListener("click", () => selectRegion(key, true));
      regionsEl.appendChild(btn);
    }

    regionsEl.hidden = keys.length === 0;
  }

  function selectRegion(key, fromUser) {
    if (!gameId) return;
    region = key;
    query = "";
    searchInput.value = "";
    if (fromUser) {
      window.ServersUpAnalytics?.track("status_region_selected", { game: gameId, region: key });
    }
    renderRegions();
    const label = GAME_META[gameId]?.regionLabels?.[key] || key.toUpperCase();
    setSub(`${GAME_META[gameId]?.short || gameId} · ${label}`);
    renderResults();
  }

  async function selectGame(id, fromUser) {
    if (!GAME_META[id]) return;

    if (fromUser) {
      window.ServersUpAnalytics?.track("status_game_selected", { game: id });
    }

    gameId = id;
    region = null;
    setGameButtons();
    setSub(`Choose a ${GAME_META[id].short} region.`);
    errorEl.hidden = true;
    renderIdle();
    showPlaceholder(`Select a ${GAME_META[id].short} region to view servers.`);

    if (!snapshot) {
      loadingEl.hidden = false;
      renderSkeletonRows(12);
      regionsEl.hidden = true;
      await fetchSnapshot(false);
      loadingEl.hidden = true;
      if (!snapshot) {
        gameId = null;
        setGameButtons();
        setSub("Choose a game, then a region.");
        renderIdle();
        return;
      }
    }

    if (!snapshot.games?.[id]) {
      errorEl.textContent = `No status data for ${GAME_META[id].label}.`;
      errorEl.hidden = false;
      regionsEl.hidden = true;
      showPlaceholder(PLACEHOLDER_TEXT);
      return;
    }

    renderRegions();
    showPlaceholder(`Select a ${GAME_META[id].short} region to view servers.`);
  }

  async function fetchSnapshot() {
    if (fetchInFlight) return fetchInFlight;

    fetchInFlight = (async () => {
      try {
        const res = await fetch(STATUS_URL, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data?.games) throw new Error("Unexpected payload");
        snapshot = data;
        errorEl.hidden = true;
        if (gameId && region) {
          renderRegions();
          renderResults();
        } else if (gameId) {
          renderRegions();
        }
      } catch (err) {
        const msg =
          err instanceof TypeError
            ? "Could not reach the status feed (network/CORS). Retry shortly."
            : "Could not load live statuses.";
        errorEl.textContent = msg;
        errorEl.hidden = false;
      } finally {
        fetchInFlight = null;
      }
    })();

    return fetchInFlight;
  }

  for (const btn of gameBtns) {
    btn.addEventListener("click", () => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const id = btn.getAttribute("data-pick-game");
      if (!id) return;
      selectGame(id, true);
    });
  }

  searchInput.addEventListener("input", () => {
    query = searchInput.value.trim().toLowerCase();
    if (gameId && region) renderResults();
  });
  searchInput.addEventListener("search", () => {
    query = searchInput.value.trim().toLowerCase();
    if (gameId && region) renderResults();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && gameId) fetchSnapshot();
  });

  window.setInterval(() => {
    if (document.visibilityState === "hidden") return;
    if (!gameId) return;
    fetchSnapshot();
  }, STATUS_POLL_MS);

  setSub("Choose a game, then a region.");
  regionsEl.hidden = true;
  loadingEl.hidden = true;
  errorEl.hidden = true;
  renderIdle();
}

setYear();
setupStatusPage();
