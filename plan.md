Plan for a browser extension to warn about spending too long on social media
1. Product goal
Build a browser extension that helps users notice when they are spending too much time on social media, while not blocking access to platforms like Facebook, YouTube, Instagram, TikTok, or short‑video sites.

Instead of blocking, the extension will:

Track how long users stay on target websites.

Display on‑screen warnings when the user stays on those sites longer than thresholds like 5 or 10 minutes.

Still allow users to keep using those sites for entertainment, but gently and clearly remind them.

2. Product principles
Do not block websites.

Do not force the user to close the site.

Use “conscious reminders”, not overly annoying enforcement.

Allow customizing time thresholds for different user types.

Prioritize working well on Chrome/Chromium first, then possibly extend to Edge or Firefox.

3. Core idea
When the user opens a page in the social‑media list, the extension starts timing the current session.

If the user is still on that site and the time exceeds configured thresholds:

Milestone 1: 5 minutes → show a light warning.

Milestone 2: 10 minutes → show a stronger warning.

Milestone 3 (optional): every X minutes after that → periodic reminders.

Examples:

After 5 minutes on YouTube: “You’ve been here for 5 minutes. Are you still doing what you intended?”

After 10 minutes on TikTok: “You’ve been here for 10 minutes. Maybe take a short break or get back to your main task.”

4. Scope of tracked websites
Initial mandatory set
facebook.com

instagram.com

youtube.com

tiktok.com

Possible expansion
x.com / twitter.com

threads.net

reddit.com

Other short‑video or reel sites

Suggested content categories
General social media: Facebook, Instagram, X.

Long‑form video: YouTube.

Short‑form video: TikTok, YouTube Shorts, Facebook Reels, Instagram Reels.

5. User experience
Main behavior
User visits a target website.

The extension detects a matching domain.

A session timer starts.

As long as the tab is still active and the user is present, time keeps accumulating.

When thresholds are reached, the extension shows an overlay/banner warning on the current page.

The user can:

Close the warning.

Choose “remind me in 5 minutes”.

Open the extension popup to see today’s total time.

Recommended warning styles
Light level: small banner at the top edge of the screen.

Medium level: floating box with light dimming in a top corner.

Strong level: semi‑transparent full‑screen overlay but with a clear “continue” button.

Note: because the requirement is not to block, the overlay must not completely lock interactions and must have a clear close button.

6. Time‑tracking logic
Measure “actual usage time” instead of just tab‑open time
Only count time when all these conditions hold:

Tab is active.

Browser window is focused.

Page is visible (document.visibilityState === 'visible').

User shows recent activity such as scroll, click, keypress, or mouse movement (depending on strictness).

Suggested inactivity rules
If no interaction occurs for 60–90 seconds, pause the timer.

When the user returns and interacts, resume counting.

Tracking units
By domain.

By session.

By daily totals.

7. Extension architecture
Main components
1. manifest.json
Use Manifest V3.

Declare required permissions.

Declare content scripts for target domains.

2. background/service worker
Responsible for:

Managing overall timer state.

Synchronizing data across multiple tabs.

Storing time data in chrome.storage.

Creating scheduled events/reminders if needed.

3. content script
Runs on target websites to:

Monitor page state, interactions, and visibility.

Send time updates to the background script.

Inject banners/overlays directly into the page.

4. popup
Displays:

How long the user has spent today on each platform.

Current warning thresholds: 5 minutes, 10 minutes, etc.

Toggle switches to enable/disable tracking per website.

5. options page
Allows the user to configure:

First warning time.

Second warning time.

Reminder interval.

List of tracked websites.

Intensity level of warnings: “light / medium / strong”.

8. APIs and techniques to use
chrome.storage to store settings and time statistics.

Content scripts to inject warning UI into web pages.

chrome.alarms to set timed events or recurring reminders.

chrome.notifications if you want system notifications in addition to on‑page overlays.

9. Technical flow
Basic flow
User opens YouTube.

Content script is injected.

Script checks whether this is a tracked site.

Session timer starts.

Every few seconds, the content script sends status data to the background script.

When total session time reaches 5 minutes, the background/content script triggers a warning event.

Content script renders a banner at the top of the page.

At 10 minutes, it renders a stronger warning/overlay.

Edge cases to handle
User opens multiple tabs of the same social network.

User frequently switches tabs.

User opens YouTube but just leaves the tab idle.

SPA behavior of Facebook, Instagram, YouTube (route changes without full reload).

Reels/Shorts where videos change continuously within the same session.

10. Warning UI design
5‑minute banner
Position: top center or top right.

Short message.

Buttons: “Got it”, “Remind me later”.

10‑minute overlay
Lightly dimmed background.

Centered content box.

Actions:

Continue watching.

Remind me again in 10 minutes.

Open today’s usage stats.

Tone of messages
Avoid judgmental tone. Use neutral, supportive language:

“You’ve been here for 10 minutes.”

“Would you like to take a short break?”

“If this is intentional leisure time, feel free to continue.”

11. Data to store
trackedSites: list of domains to track.

warningThreshold1: default 5 minutes.

warningThreshold2: default 10 minutes.

remindInterval: e.g., 5 minutes.

dailyStats: daily totals by site.

sessionState: current tab, session start time, last warning time.

snoozeUntil: timestamp until which warnings are snoozed.

12. Suggested MVP
Version 1
Chrome desktop only.

Track only 4 sites: Facebook, YouTube, Instagram, TikTok.

Two warning thresholds: 5 and 10 minutes.

Only in‑page banner/overlay warnings.

Popup to show today’s total time.

Version 2
Customizable domain list.

Separate detection for Shorts/Reels.

Smarter snooze.

Usage‑habit charts.

Version 3
Sync settings across devices.

Support Firefox / Edge.

“Deep work” mode with stronger reminders, still without blocking.

13. Risks and considerations
“Tab open” does not mean “actively watching”, so we need active + visible + interaction logic.

SPA sites like YouTube/Facebook require watching for route changes.

Overlays must avoid CSS conflicts with the host page.

Do not request overly broad permissions at the start to avoid scaring users.

Optimize for low overhead so the extension does not slow down tabs.

14. Suggested folder structure
text
social-awareness-extension/
├─ manifest.json
├─ background.js
├─ content/
│  ├─ tracker.js
│  ├─ overlay.js
│  └─ styles.css
├─ popup/
│  ├─ popup.html
│  ├─ popup.js
│  └─ popup.css
├─ options/
│  ├─ options.html
│  ├─ options.js
│  └─ options.css
└─ assets/
   └─ icons/
15. Implementation checklist
Define the list of tracked domains.

Design logic for active/visible time counting.

Build content script to inject warnings.

Build background script to manage state and data.

Build popup to display stats.

Build options page to configure 5/10‑minute thresholds.

Test on Facebook feed, YouTube watch page, YouTube Shorts, Instagram, TikTok web.

Tune UX so warnings are clear but not overly annoying.

16. Success criteria
The extension is successful if:

Users can still use social media normally.

After 5–10 minutes, they get timely and noticeable reminders.

Warnings do not break the experience too much.

Users gradually become more aware of their leisure time.

17. Recommended rollout path
Start with a very small Chrome MVP:

Track only YouTube and Facebook.

Just 5‑minute banner + 10‑minute overlay.

Store stats locally.

Once timing logic is stable, extend to Instagram, TikTok, Shorts/Reels and add advanced configuration.