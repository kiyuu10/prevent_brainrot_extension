// ─── Default Settings ───────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  trackedSites: [
    { domain: "facebook.com",  label: "Facebook",  enabled: true },
    { domain: "youtube.com",   label: "YouTube",   enabled: true },
    { domain: "instagram.com", label: "Instagram", enabled: true },
    { domain: "tiktok.com",    label: "TikTok",    enabled: true },
    { domain: "twitter.com",   label: "Twitter/X", enabled: false },
    { domain: "x.com",         label: "X",         enabled: false },
    { domain: "threads.net",   label: "Threads",   enabled: false },
    { domain: "reddit.com",    label: "Reddit",    enabled: false },
  ],
  warningThreshold1: 5 * 60,   // seconds
  warningThreshold2: 10 * 60,  // seconds
  remindInterval:    5 * 60,   // seconds
  warningIntensity:  "medium", // light | medium | strong
};

// ─── In-Memory Session State ─────────────────────────────────────────────────
// tabId → { domain, sessionStart, activeSeconds, lastTick, warned1, warned2, snoozeUntil }
const tabSessions = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function getSettings() {
  const data = await chrome.storage.local.get("settings");
  return data.settings || DEFAULT_SETTINGS;
}

async function getDailyStats() {
  const key = getTodayKey();
  const data = await chrome.storage.local.get("dailyStats");
  const all  = data.dailyStats || {};
  return all[key] || {};
}

async function saveDailyStats(stats) {
  const key = getTodayKey();
  const data = await chrome.storage.local.get("dailyStats");
  const all  = data.dailyStats || {};
  all[key] = stats;
  // Keep only last 30 days
  const keys = Object.keys(all).sort();
  if (keys.length > 30) delete all[keys[0]];
  await chrome.storage.local.set({ dailyStats: all });
}

function matchDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith("." + domain);
}

function getTrackedDomain(hostname, trackedSites) {
  for (const site of trackedSites) {
    if (site.enabled && matchDomain(hostname, site.domain)) return site.domain;
  }
  return null;
}

// ─── Initialize defaults on install ─────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get("settings");
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});

// ─── Tab Activation ──────────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await handleTabFocus(tabId, tab.url);
  } catch (_) {}
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    await handleTabFocus(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabSessions[tabId];
});

async function handleTabFocus(tabId, url) {
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) return;
  try {
    const settings = await getSettings();
    const hostname  = new URL(url).hostname;
    const domain    = getTrackedDomain(hostname, settings.trackedSites);

    if (!domain) {
      delete tabSessions[tabId];
      return;
    }

    if (!tabSessions[tabId] || tabSessions[tabId].domain !== domain) {
      tabSessions[tabId] = {
        domain,
        activeSeconds: 0,
        lastTick:      Date.now(),
        warned1:       false,
        warned2:       false,
        snoozeUntil:   0,
      };
    }
  } catch (_) {}
}

// ─── Heartbeat Alarm (every 5 seconds via repeated alarm) ───────────────────
chrome.alarms.create("heartbeat", { periodInMinutes: 1 / 12 }); // ~5 sec

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "heartbeat") return;

  const settings   = await getSettings();
  const dailyStats = await getDailyStats();
  let   dirty      = false;

  for (const [tabIdStr, session] of Object.entries(tabSessions)) {
    const tabId = parseInt(tabIdStr);
    const now   = Date.now();
    const delta = Math.round((now - session.lastTick) / 1000);
    session.lastTick = now;

    // We'll trust the content script's active flag via messages
    // Here we accumulate time for tabs that are tracked
    session.activeSeconds += delta;

    // Update daily stats
    if (!dailyStats[session.domain]) dailyStats[session.domain] = 0;
    dailyStats[session.domain] += delta;
    dirty = true;

    const secs  = session.activeSeconds;
    const now_s = Math.floor(now / 1000);

    // Snooze guard
    if (session.snoozeUntil > now_s) continue;

    // Warning 1
    if (!session.warned1 && secs >= settings.warningThreshold1) {
      session.warned1 = true;
      sendWarningToTab(tabId, "warn1", session.domain, secs, settings);
    }
    // Warning 2
    else if (session.warned1 && !session.warned2 && secs >= settings.warningThreshold2) {
      session.warned2 = true;
      sendWarningToTab(tabId, "warn2", session.domain, secs, settings);
    }
    // Periodic reminders after warn2
    else if (session.warned2) {
      const lastWarned = session.lastRemindAt || 0;
      if (secs - lastWarned >= settings.remindInterval) {
        session.lastRemindAt = secs;
        sendWarningToTab(tabId, "remind", session.domain, secs, settings);
      }
    }
  }

  if (dirty) await saveDailyStats(dailyStats);
});

function sendWarningToTab(tabId, type, domain, seconds, settings) {
  chrome.tabs.sendMessage(tabId, {
    action: "showWarning",
    type,
    domain,
    seconds,
    intensity: settings.warningIntensity,
  }).catch(() => {}); // Tab might not have content script
}

// ─── Message Handling from Content Scripts ───────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (msg.action === "ping") {
    // Content script is alive; update active state
    if (tabId && tabSessions[tabId]) {
      tabSessions[tabId].lastTick = Date.now();
    }
    sendResponse({ ok: true });
    return;
  }

  if (msg.action === "snooze" && tabId && tabSessions[tabId]) {
    const minutes = msg.minutes || 5;
    tabSessions[tabId].snoozeUntil = Math.floor(Date.now() / 1000) + minutes * 60;
    sendResponse({ ok: true });
    return;
  }

  if (msg.action === "resetSession" && tabId && tabSessions[tabId]) {
    tabSessions[tabId].activeSeconds = 0;
    tabSessions[tabId].warned1  = false;
    tabSessions[tabId].warned2  = false;
    tabSessions[tabId].lastRemindAt = 0;
    sendResponse({ ok: true });
    return;
  }

  if (msg.action === "getStats") {
    (async () => {
      const stats = await getDailyStats();
      const session = tabId ? tabSessions[tabId] : null;
      sendResponse({ stats, session });
    })();
    return true; // async
  }

  if (msg.action === "getSettings") {
    getSettings().then(s => sendResponse({ settings: s }));
    return true;
  }

  if (msg.action === "saveSettings") {
    chrome.storage.local.set({ settings: msg.settings }).then(() => sendResponse({ ok: true }));
    return true;
  }
});
