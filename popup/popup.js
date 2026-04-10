// ─── popup.js ─────────────────────────────────────────────────────────────────
"use strict";

const SITE_ICONS = {
  "facebook.com":  "📘",
  "youtube.com":   "📺",
  "instagram.com": "📸",
  "tiktok.com":    "🎵",
  "twitter.com":   "🐦",
  "x.com":         "✖️",
  "threads.net":   "🧵",
  "reddit.com":    "🤖",
};

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function formatTimerDisplay(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Fetch data from background ────────────────────────────────────────────────
async function loadData() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getStats" }, (res) => {
      resolve(res || { stats: {}, session: null });
    });
  });
}

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getSettings" }, (res) => {
      resolve(res?.settings || null);
    });
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "saveSettings", settings }, resolve);
  });
}

// ── Render current session ────────────────────────────────────────────────────
function renderSession(session, settings) {
  const idle   = document.getElementById("session-idle");
  const active = document.getElementById("session-active");
  const site   = document.getElementById("session-site");
  const timer  = document.getElementById("session-timer");
  const prog   = document.getElementById("session-progress");
  const status = document.getElementById("session-status");

  if (!session || !session.domain) {
    idle.classList.remove("hidden");
    active.classList.add("hidden");
    return;
  }

  idle.classList.add("hidden");
  active.classList.remove("hidden");

  const domain   = session.domain;
  const icon     = SITE_ICONS[domain] || "🌐";
  const secs     = session.activeSeconds || 0;
  const thresh2  = settings?.warningThreshold2 || 600;

  site.textContent  = `${icon} ${domain}`;
  timer.textContent = formatTimerDisplay(secs);

  // Progress bar: 0 → thresh2 (10 min default)
  const pct = Math.min(100, (secs / thresh2) * 100);
  prog.style.setProperty("--pct", pct + "%");

  if (secs >= (settings?.warningThreshold2 || 600)) {
    status.textContent = "⚠️ Time limit reached";
    status.style.color = "#fc8181";
  } else if (secs >= (settings?.warningThreshold1 || 300)) {
    status.textContent = "🟡 Approaching limit";
    status.style.color = "#f6ad55";
  } else {
    status.textContent = "Tracking active";
    status.style.color = "#48bb78";
  }
}

// ── Render today's stats ──────────────────────────────────────────────────────
function renderStats(stats, settings) {
  const list = document.getElementById("stats-list");
  const entries = Object.entries(stats).filter(([, v]) => v > 0);

  if (entries.length === 0) {
    list.innerHTML = `<div class="empty-state">No activity recorded today 🎉</div>`;
    return;
  }

  // Sort descending by time
  entries.sort((a, b) => b[1] - a[1]);
  const maxVal = entries[0][1];

  list.innerHTML = entries.map(([domain, seconds]) => {
    const icon    = SITE_ICONS[domain] || "🌐";
    const pct     = Math.round((seconds / maxVal) * 100);
    const timeStr = formatTime(seconds);
    const thresh2 = settings?.warningThreshold2 || 600;
    const barColor = seconds >= thresh2
      ? "linear-gradient(90deg, #fc8181, #f56565)"
      : seconds >= (settings?.warningThreshold1 || 300)
        ? "linear-gradient(90deg, #f6ad55, #ed8936)"
        : "linear-gradient(90deg, #4299e1, #63b3ed)";

    return `
      <div class="stat-row">
        <span class="stat-icon">${icon}</span>
        <div class="stat-info">
          <div class="stat-name">${domain}</div>
          <div class="stat-bar-wrap">
            <div class="stat-bar" style="width:${pct}%; background:${barColor}"></div>
          </div>
        </div>
        <span class="stat-time">${timeStr}</span>
      </div>
    `;
  }).join("");
}

// ── Render site toggles ───────────────────────────────────────────────────────
function renderToggles(settings) {
  const list = document.getElementById("toggle-list");
  if (!settings) { list.innerHTML = ""; return; }

  list.innerHTML = settings.trackedSites.map((site, i) => {
    const icon    = SITE_ICONS[site.domain] || "🌐";
    const checked = site.enabled ? "checked" : "";
    return `
      <div class="toggle-row">
        <label class="toggle-label" for="toggle-${i}">
          <span class="toggle-label-icon">${icon}</span>
          <span>${site.label}</span>
        </label>
        <label class="toggle">
          <input type="checkbox" id="toggle-${i}" data-index="${i}" ${checked} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }).join("");

  list.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", async () => {
      const idx = parseInt(cb.dataset.index);
      settings.trackedSites[idx].enabled = cb.checked;
      await saveSettings(settings);
    });
  });
}

// ── Reset today's stats ───────────────────────────────────────────────────────
async function resetToday() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const data = await new Promise((r) => chrome.storage.local.get("dailyStats", r));
  const all  = data.dailyStats || {};
  delete all[todayKey];
  await chrome.storage.local.set({ dailyStats: all });
  // Reload UI
  init();
}

// ── Navigation ────────────────────────────────────────────────────────────────
document.getElementById("settings-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById("options-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById("reset-link").addEventListener("click", (e) => {
  e.preventDefault();
  if (confirm("Reset today's tracking stats?")) resetToday();
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const [{ stats, session }, settings] = await Promise.all([loadData(), loadSettings()]);
  renderSession(session, settings);
  renderStats(stats, settings);
  renderToggles(settings);
}

init();

// Auto-refresh every 5 seconds so the timer stays live
setInterval(init, 5000);
