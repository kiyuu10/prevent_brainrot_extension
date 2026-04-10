// ─── overlay.js ──────────────────────────────────────────────────────────────
// Handles rendering of warning banners and overlays in the host page.

(function () {
  "use strict";

  const SITE_NAMES = {
    "facebook.com":  "Facebook",
    "youtube.com":   "YouTube",
    "instagram.com": "Instagram",
    "tiktok.com":    "TikTok",
    "twitter.com":   "Twitter",
    "x.com":         "X",
    "threads.net":   "Threads",
    "reddit.com":    "Reddit",
  };

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m} min${m !== 1 ? "s" : ""}` : `${s}s`;
  }

  function getSiteName(domain) {
    return SITE_NAMES[domain] || domain;
  }

  // ── Remove any existing warning UI ───────────────────────────────────────
  function clearExisting() {
    document.getElementById("__mindful-banner")?.remove();
    document.getElementById("__mindful-overlay")?.remove();
  }

  // ── Light Banner (warn1) ──────────────────────────────────────────────────
  function showBanner(domain, seconds, onSnooze, onDismiss) {
    clearExisting();
    const siteName = getSiteName(domain);
    const timeStr  = formatTime(seconds);

    const el = document.createElement("div");
    el.id = "__mindful-banner";
    el.innerHTML = `
      <div class="__mindful-icon">🧠</div>
      <div class="__mindful-text">
        <span class="__mindful-title">Heads up!</span>
        <span class="__mindful-body">You've been on <strong>${siteName}</strong> for <strong>${timeStr}</strong>. Is this intentional?</span>
      </div>
      <div class="__mindful-actions">
        <button class="__mindful-btn __mindful-btn-snooze" id="__mindful-snooze-btn">Remind me later</button>
        <button class="__mindful-btn __mindful-btn-dismiss" id="__mindful-dismiss-btn">Got it</button>
      </div>
      <button class="__mindful-close" id="__mindful-close-btn" aria-label="Close">✕</button>
    `;

    document.body.appendChild(el);

    // Animate in
    requestAnimationFrame(() => el.classList.add("__mindful-visible"));

    document.getElementById("__mindful-snooze-btn").addEventListener("click", () => {
      onSnooze(5);
      closeBanner(el);
    });
    document.getElementById("__mindful-dismiss-btn").addEventListener("click", () => {
      onDismiss();
      closeBanner(el);
    });
    document.getElementById("__mindful-close-btn").addEventListener("click", () => {
      closeBanner(el);
    });

    // Auto-dismiss after 15 seconds
    setTimeout(() => closeBanner(el), 15000);
  }

  function closeBanner(el) {
    el.classList.remove("__mindful-visible");
    setTimeout(() => el.remove(), 400);
  }

  // ── Medium / Strong Overlay (warn2 / remind) ──────────────────────────────
  function showOverlay(domain, seconds, intensity, onSnooze, onContinue, onOpenStats) {
    clearExisting();
    const siteName = getSiteName(domain);
    const timeStr  = formatTime(seconds);
    const isStrong = intensity === "strong";

    const backdrop = document.createElement("div");
    backdrop.id = "__mindful-overlay";
    backdrop.className = isStrong ? "__mindful-overlay-strong" : "__mindful-overlay-medium";

    backdrop.innerHTML = `
      <div class="__mindful-modal" role="dialog" aria-modal="true" aria-labelledby="__mindful-modal-title">
        <div class="__mindful-modal-icon">⏱️</div>
        <h2 class="__mindful-modal-title" id="__mindful-modal-title">Time Check</h2>
        <p class="__mindful-modal-message">
          You've been on <strong>${siteName}</strong> for <strong>${timeStr}</strong>.
        </p>
        <p class="__mindful-modal-sub">
          ${isStrong
            ? "If this is intentional leisure time, feel free to continue. But if not, maybe now is a good moment to switch gears."
            : "Would you like to take a short break or keep going?"}
        </p>
        <div class="__mindful-modal-actions">
          <button class="__mindful-modal-btn __mindful-modal-btn-primary" id="__mindful-continue-btn">
            Continue watching
          </button>
          <button class="__mindful-modal-btn __mindful-modal-btn-secondary" id="__mindful-modal-snooze-btn">
            Remind me in 10 min
          </button>
          <button class="__mindful-modal-btn __mindful-modal-btn-ghost" id="__mindful-stats-btn">
            View today's stats
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    requestAnimationFrame(() => backdrop.classList.add("__mindful-visible"));

    document.getElementById("__mindful-continue-btn").addEventListener("click", () => {
      onContinue();
      closeOverlay(backdrop);
    });
    document.getElementById("__mindful-modal-snooze-btn").addEventListener("click", () => {
      onSnooze(10);
      closeOverlay(backdrop);
    });
    document.getElementById("__mindful-stats-btn").addEventListener("click", () => {
      onOpenStats();
      closeOverlay(backdrop);
    });

    // Click backdrop to continue (only for medium)
    if (!isStrong) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) { onContinue(); closeOverlay(backdrop); }
      });
    }
  }

  function closeOverlay(el) {
    el.classList.remove("__mindful-visible");
    setTimeout(() => el.remove(), 400);
  }

  // ── Message listener from background ─────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action !== "showWarning") return;

    const { type, domain, seconds, intensity } = msg;

    const onSnooze = (mins) => {
      chrome.runtime.sendMessage({ action: "snooze", minutes: mins }).catch(() => {});
    };
    const onDismiss  = () => {};
    const onContinue = () => {};
    const onOpenStats = () => {
      chrome.runtime.sendMessage({ action: "openPopup" }).catch(() => {});
    };

    if (type === "warn1") {
      showBanner(domain, seconds, onSnooze, onDismiss);
    } else {
      showOverlay(domain, seconds, intensity || "medium", onSnooze, onContinue, onOpenStats);
    }
  });
})();
