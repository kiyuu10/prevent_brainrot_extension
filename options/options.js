// ─── options.js ───────────────────────────────────────────────────────────────
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

let currentSettings = null;

// ── Load / Save settings ──────────────────────────────────────────────────────
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

// ── Section navigation ────────────────────────────────────────────────────────
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const sectionId = link.dataset.section;

    document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
    link.classList.add("active");

    document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
    document.getElementById(`section-${sectionId}`).classList.add("active");
  });
});

// ── Timer inputs + sliders ────────────────────────────────────────────────────
function syncSliderToInput(sliderId, inputId) {
  const slider = document.getElementById(sliderId);
  const input  = document.getElementById(inputId);

  slider.addEventListener("input", () => {
    input.value = slider.value;
    updateTimeline();
  });

  input.addEventListener("input", () => {
    const v = Math.max(parseInt(input.min), Math.min(parseInt(input.max), parseInt(input.value) || 1));
    slider.value = Math.min(parseInt(slider.max), v);
    input.value  = v;
    updateTimeline();
  });
}

function updateTimeline() {
  const t1 = parseInt(document.getElementById("threshold1").value) || 5;
  const t2 = parseInt(document.getElementById("threshold2").value) || 10;
  const total = Math.max(t2 * 1.5, 12);

  const pct1 = (t1 / total) * 100;
  const pct2 = (t2 / total) * 100;

  document.getElementById("tl-warn1").style.left = pct1 + "%";
  document.getElementById("tl-warn2").style.left = pct2 + "%";
  document.getElementById("tl-fill1").style.width = pct1 + "%";
  document.getElementById("tl-fill2").style.left  = pct1 + "%";
  document.getElementById("tl-fill2").style.width = (pct2 - pct1) + "%";

  document.getElementById("tl-warn1-label").textContent = t1 + "m";
  document.getElementById("tl-warn2-label").textContent = t2 + "m";
}

syncSliderToInput("threshold1-slider", "threshold1");
syncSliderToInput("threshold2-slider", "threshold2");

// ── Intensity selector ────────────────────────────────────────────────────────
document.querySelectorAll(".intensity-card").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".intensity-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    const radio = card.querySelector("input[type=radio]");
    if (radio) radio.checked = true;
  });
});

function setIntensity(value) {
  document.querySelectorAll(".intensity-card").forEach((card) => {
    const match = card.dataset.value === value;
    card.classList.toggle("selected", match);
    const radio = card.querySelector("input[type=radio]");
    if (radio) radio.checked = match;
  });
}

function getIntensity() {
  const checked = document.querySelector("input[name=intensity]:checked");
  return checked ? checked.value : "medium";
}

// ── Sites list ────────────────────────────────────────────────────────────────
function renderSitesList() {
  const list = document.getElementById("sites-list");
  if (!currentSettings) return;

  list.innerHTML = currentSettings.trackedSites.map((site, i) => {
    const icon    = SITE_ICONS[site.domain] || "🌐";
    const checked = site.enabled ? "checked" : "";
    const isBuiltin = ["facebook.com","youtube.com","instagram.com","tiktok.com",
                        "twitter.com","x.com","threads.net","reddit.com"].includes(site.domain);
    return `
      <div class="site-row" data-index="${i}">
        <span class="site-icon">${icon}</span>
        <div class="site-info">
          <div class="site-name">${site.label}</div>
          <div class="site-domain">${site.domain}</div>
        </div>
        <div class="site-actions">
          ${!isBuiltin ? `<button class="btn-remove" data-index="${i}" title="Remove">✕</button>` : ""}
          <label class="toggle">
            <input type="checkbox" class="site-toggle" data-index="${i}" ${checked} />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;
  }).join("");

  // Wire remove buttons
  list.querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      currentSettings.trackedSites.splice(idx, 1);
      renderSitesList();
    });
  });

  // Wire toggle checkboxes
  list.querySelectorAll(".site-toggle").forEach((cb) => {
    cb.addEventListener("change", () => {
      const idx = parseInt(cb.dataset.index);
      currentSettings.trackedSites[idx].enabled = cb.checked;
    });
  });
}

// ── Add custom domain ─────────────────────────────────────────────────────────
document.getElementById("add-domain-btn").addEventListener("click", () => {
  const domainInput = document.getElementById("new-domain");
  const labelInput  = document.getElementById("new-label");
  const errEl       = document.getElementById("add-error");

  const domain = domainInput.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const label  = labelInput.value.trim() || capitalize(domain.split(".")[0]);

  // Basic validation
  if (!domain || !domain.includes(".")) {
    errEl.classList.remove("hidden");
    return;
  }

  errEl.classList.add("hidden");

  const already = currentSettings.trackedSites.some((s) => s.domain === domain);
  if (!already) {
    currentSettings.trackedSites.push({ domain, label, enabled: true });
    renderSitesList();
  }

  domainInput.value = "";
  labelInput.value  = "";
});

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Data section ──────────────────────────────────────────────────────────────
async function loadHistory() {
  const wrap = document.getElementById("history-table-wrap");
  const data = await new Promise((r) => chrome.storage.local.get("dailyStats", r));
  const all  = data.dailyStats || {};
  const keys = Object.keys(all).sort().reverse();

  if (keys.length === 0) {
    wrap.innerHTML = `<div class="empty-history">No history recorded yet.</div>`;
    return;
  }

  const rows = [];
  for (const date of keys) {
    const dayStats = all[date];
    for (const [domain, secs] of Object.entries(dayStats)) {
      if (secs > 0) rows.push({ date, domain, secs });
    }
  }

  if (rows.length === 0) {
    wrap.innerHTML = `<div class="empty-history">No history recorded yet.</div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Site</th>
          <th>Time spent</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td>${r.date}</td>
            <td>${SITE_ICONS[r.domain] || "🌐"} ${r.domain}</td>
            <td>${formatTime(r.secs)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

// Reset today
document.getElementById("reset-today-btn").addEventListener("click", async () => {
  if (!confirm("Reset today's tracking stats?")) return;
  const todayKey = new Date().toISOString().slice(0, 10);
  const data = await new Promise((r) => chrome.storage.local.get("dailyStats", r));
  const all  = data.dailyStats || {};
  delete all[todayKey];
  await chrome.storage.local.set({ dailyStats: all });
  showBanner("Today's stats cleared.");
  loadHistory();
});

// Clear all
document.getElementById("clear-all-btn").addEventListener("click", async () => {
  if (!confirm("Permanently delete ALL usage history? This cannot be undone.")) return;
  await chrome.storage.local.remove("dailyStats");
  showBanner("All history cleared.");
  loadHistory();
});

// Reset to defaults
document.getElementById("reset-defaults-btn").addEventListener("click", async () => {
  if (!confirm("Reset all settings to default values?")) return;
  await chrome.storage.local.remove("settings");
  currentSettings = await loadSettings();
  populateForm();
  showBanner("Settings reset to defaults.");
});

// ── Save button ───────────────────────────────────────────────────────────────
document.getElementById("save-btn").addEventListener("click", async () => {
  const t1 = parseInt(document.getElementById("threshold1").value) || 5;
  const t2 = parseInt(document.getElementById("threshold2").value) || 10;
  const ri = parseInt(document.getElementById("remind-interval").value) || 5;

  currentSettings.warningThreshold1 = t1 * 60;
  currentSettings.warningThreshold2 = Math.max(t1 + 1, t2) * 60;
  currentSettings.remindInterval    = ri * 60;
  currentSettings.warningIntensity  = getIntensity();

  await saveSettings(currentSettings);
  showBanner("✅ Settings saved!");
});

function showBanner(msg) {
  const banner = document.getElementById("save-banner");
  banner.querySelector("span").textContent = msg;
  banner.classList.remove("hidden");
  clearTimeout(banner._timer);
  banner._timer = setTimeout(() => banner.classList.add("hidden"), 2500);
}

// ── Populate form from settings ───────────────────────────────────────────────
function populateForm() {
  if (!currentSettings) return;

  const t1 = Math.round(currentSettings.warningThreshold1 / 60);
  const t2 = Math.round(currentSettings.warningThreshold2 / 60);
  const ri = Math.round(currentSettings.remindInterval / 60);

  document.getElementById("threshold1").value        = t1;
  document.getElementById("threshold1-slider").value = t1;
  document.getElementById("threshold2").value        = t2;
  document.getElementById("threshold2-slider").value = t2;
  document.getElementById("remind-interval").value   = ri;

  setIntensity(currentSettings.warningIntensity || "medium");
  updateTimeline();
  renderSitesList();
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  currentSettings = await loadSettings();
  populateForm();
  loadHistory();
}

init();
