// ─── tracker.js ──────────────────────────────────────────────────────────────
// Runs on tracked pages. Detects active/visible state and pings background.

(function () {
  "use strict";

  const PING_INTERVAL   = 4000;  // ms
  const IDLE_THRESHOLD  = 90000; // ms – 90 seconds without interaction = idle

  let lastActivity = Date.now();
  let pingTimer    = null;

  // ── Activity listeners ──────────────────────────────────────────────────
  const markActivity = () => { lastActivity = Date.now(); };
  ["scroll", "click", "keydown", "mousemove", "touchstart"].forEach(evt => {
    document.addEventListener(evt, markActivity, { passive: true });
  });

  // ── Visibility / focus ──────────────────────────────────────────────────
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") startPing();
    else stopPing();
  });

  window.addEventListener("blur",  stopPing);
  window.addEventListener("focus", startPing);

  // ── SPA route-change detection (YouTube, Facebook, Instagram) ──────────
  const origPushState    = history.pushState.bind(history);
  const origReplaceState = history.replaceState.bind(history);

  history.pushState = (...args) => {
    origPushState(...args);
    onRouteChange();
  };
  history.replaceState = (...args) => {
    origReplaceState(...args);
    onRouteChange();
  };
  window.addEventListener("popstate", onRouteChange);

  function onRouteChange() {
    markActivity();
  }

  // ── Ping loop ────────────────────────────────────────────────────────────
  function isActive() {
    const visible = document.visibilityState === "visible";
    const recent  = Date.now() - lastActivity < IDLE_THRESHOLD;
    return visible && recent;
  }

  function startPing() {
    if (pingTimer) return;
    pingTimer = setInterval(sendPing, PING_INTERVAL);
    sendPing(); // immediate first ping
  }

  function stopPing() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  }

  function sendPing() {
    if (!isActive()) return;
    chrome.runtime.sendMessage({ action: "ping" }).catch(() => {});
  }

  // ── Start if page is visible ─────────────────────────────────────────────
  if (document.visibilityState === "visible") startPing();

  // ── Expose helpers for overlay.js ───────────────────────────────────────
  window.__mindful_tracker = { markActivity };
})();
