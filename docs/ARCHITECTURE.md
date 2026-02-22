# The Marvellous Suspender — Architecture & Documentation

> Current version: **8.1.3** · Manifest V3 · Minimum Chrome 110  
> License: GNU GPLv2

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
  - [High-Level Diagram](#high-level-diagram)
  - [Service Worker (Background)](#service-worker-background)
  - [Content Script](#content-script)
  - [Extension Pages](#extension-pages)
  - [Tab Management Subsystem](#tab-management-subsystem)
  - [Data & Storage Layer](#data--storage-layer)
  - [Messaging System](#messaging-system)
- [Tab Lifecycle](#tab-lifecycle)
  - [Suspension Flow](#suspension-flow)
  - [Unsuspension Flow](#unsuspension-flow)
  - [Auto-Suspend Timer](#auto-suspend-timer)
- [Special Paths](#special-paths)
- [Settings Reference](#settings-reference)
- [Chrome APIs Used](#chrome-apis-used)
- [Build System](#build-system)
- [Internationalization](#internationalization)

---

## Overview

**The Marvellous Suspender** is a Chromium browser extension that frees system resources (RAM, CPU) by automatically suspending inactive tabs after a configurable timeout. Suspended tabs are replaced with a lightweight HTML page that preserves the original URL, title, favicon, and optionally a screenshot preview. Users can unsuspend tabs with a single click, keyboard shortcut, or automatically on focus.

It is a privacy-respecting fork of "The Great Suspender", with no ads or tracking.

---

## Features

### Core Functionality
- **Automatic tab suspension** — Tabs are suspended after a configurable inactivity period (20 seconds to 2 weeks, or never)
- **Manual suspension** — Suspend/unsuspend individual tabs, selected tabs, all tabs in a window, or all tabs across all windows
- **Tab state preservation** — Original URL, title, favicon, scroll position, and optional screenshot are preserved
- **One-click restore** — Click anywhere on a suspended tab page, use keyboard shortcuts, or the popup menu

### Smart Protection
- Never suspend pinned tabs
- Never suspend tabs with unsaved form input
- Never suspend tabs playing audio
- Never suspend the active/focused tab
- Never suspend when offline (optional)
- Never suspend when charging (optional)
- URL/domain whitelist with regex support

### Memory Optimization
- **Discard after suspend** — Combine with Chrome's built-in tab discarding for up to 500% memory savings
- **Discard instead of suspend** — Use Chrome's native discard mechanism instead
- **Suspend on low memory** — Intercept Chrome's tab discard events and suspend instead

### Visual Features
- **Screen capture** — Optional screenshot preview of the page before suspension (viewport-only or full page)
- **Theme support** — Light, dark, or system-automatic theme for suspended pages
- **Favicon display** — Cached favicon with dark/light detection for proper contrast

### Session Management
- **Crash recovery** — Automatic detection and restoration of tabs lost during extension or browser crashes
- **Session history** — Rolling history of recent sessions (max 5)
- **Session save/restore** — Manually save and restore named sessions
- **Import/Export** — JSON and plain-text session import/export
- **Tab migration** — Migrate suspended tabs from other suspender extensions (e.g., The Great Suspender)

### Keyboard Shortcuts
| Default Shortcut | Action |
|---|---|
| `Ctrl+Shift+S` | Suspend/unsuspend active tab |
| *(configurable)* | Pause/unpause suspension on active tab |
| *(configurable)* | Suspend/unsuspend selected tabs |
| *(configurable)* | Suspend all other tabs in window |
| *(configurable)* | Force suspend all other tabs in window |
| *(configurable)* | Unsuspend all tabs in window |
| *(configurable)* | Suspend/force suspend all tabs in all windows |
| *(configurable)* | Unsuspend all tabs in all windows |
| *(configurable)* | Open session manager |

### Other
- Right-click context menu with all actions (16 items)
- "Open link in new suspended tab" context menu on links
- Cross-device settings sync via Chrome profile
- Incognito mode support (split mode)
- External extension API for suspend/unsuspend
- 18 supported languages via Crowdin

---

## Project Structure

```
MarvellousSuspender/
├── src/                          # Extension source (loaded directly or built)
│   ├── manifest.json             # MV3 manifest
│   ├── *.html                    # Extension pages
│   ├── _locales/                 # i18n (18 languages)
│   │   └── {lang}/messages.json
│   ├── css/                      # Stylesheets
│   ├── font/                     # Icon fonts (fontello)
│   ├── img/                      # Extension icons & assets
│   └── js/                       # All JavaScript
│       ├── background.js         # Service worker entry point
│       ├── tgs.js                # Core extension logic / orchestrator
│       ├── gs*.js                # Internal modules (gs = Great Suspender legacy prefix)
│       ├── contentscript.js      # Injected into web pages
│       ├── db.js                 # IndexedDB wrapper (3rd party)
│       ├── html2canvas.min.js    # Screen capture library (3rd party)
│       └── {page}.js             # Per-page controllers
├── Gruntfile.js                  # Build configuration
├── package.json                  # Dependencies & scripts
├── eslint.config.mjs             # Linting
├── tsconfig.json                 # TypeScript config (for type checking / editor support)
└── crowdin.yml                   # Crowdin i18n integration
```

---

## Architecture

### High-Level Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CHROME BROWSER                                     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐          │
│  │                   SERVICE WORKER (background.js)                │          │
│  │                                                                 │          │
│  │  ┌──────────┐  ┌──────────────────┐  ┌────────────────────┐    │          │
│  │  │  tgs.js   │  │ gsStorage.js     │  │ gsSession.js       │    │          │
│  │  │ (core     │  │ (settings,       │  │ (sessions, crash   │    │          │
│  │  │  logic)   │  │  chrome.storage) │  │  recovery)         │    │          │
│  │  └──────────┘  └──────────────────┘  └────────────────────┘    │          │
│  │                                                                 │          │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐  │          │
│  │  │ gsTabSuspend     │  │ gsTabDiscard     │  │ gsTabCheck  │  │          │
│  │  │ Manager.js       │  │ Manager.js       │  │ Manager.js  │  │          │
│  │  │ (suspend queue)  │  │ (discard queue)  │  │ (health)    │  │          │
│  │  └────────┬─────────┘  └────────┬─────────┘  └──────┬──────┘  │          │
│  │           └──────────────┬───────┘                    │         │          │
│  │                    ┌─────┴──────┐                     │         │          │
│  │                    │gsTabQueue.js│◄────────────────────┘         │          │
│  │                    │(job queue)  │                               │          │
│  │                    └────────────┘                               │          │
│  │                                                                 │          │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐          │          │
│  │  │gsMessages.js │  │ gsChrome.js  │  │ gsUtils.js  │          │          │
│  │  │(messaging)   │  │ (API wraps)  │  │ (utilities) │          │          │
│  │  └──────────────┘  └──────────────┘  └─────────────┘          │          │
│  │                                                                 │          │
│  │  ┌──────────────────────────────────────────────┐              │          │
│  │  │            DATA LAYER                         │              │          │
│  │  │  gsIndexedDb.js ←→ db.js (IndexedDB wrapper) │              │          │
│  │  │  ┌────────────┬──────────┬───────────┐        │              │          │
│  │  │  │gsPreviews  │gsTabInfo │gsFavicons │        │              │          │
│  │  │  │gsSessions  │gsSaved   │           │        │              │          │
│  │  │  └────────────┴──────────┴───────────┘        │              │          │
│  │  └──────────────────────────────────────────────┘              │          │
│  └──────────────────────────┬──────────────────────────────────────┘          │
│                             │ chrome.tabs.sendMessage                         │
│                             │ chrome.scripting.executeScript                  │
│                             ▼                                                │
│  ┌─────────────────────────────────────────┐    ┌──────────────────────────┐ │
│  │     CONTENT SCRIPTS                      │    │   EXTENSION PAGES        │ │
│  │                                          │    │                          │ │
│  │  contentscript.js                        │    │  suspended.html/js       │ │
│  │  - tracks form input                     │    │  popup.html/js           │ │
│  │  - tracks scroll position               │    │  options.html/js         │ │
│  │  - receives temp whitelist               │    │  recovery.html/js        │ │
│  │  - responds to status queries            │    │  history.html/js         │ │
│  │                                          │    │  update/updated.html     │ │
│  │  html2canvas.min.js (injected on demand) │    │  about/shortcuts.html    │ │
│  └─────────────────────────────────────────┘    └──────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Service Worker (Background)

The extension runs as a **Manifest V3 service worker** with two main files:

| File | Role |
|---|---|
| `background.js` | **Entry point.** Registers all Chrome event listeners (messages, commands, context menus, alarms, tabs, windows, runtime). Routes events to `tgs.*` functions. Bootstraps initialization on startup/install. |
| `tgs.js` | **Core orchestrator.** Contains ~50 exported functions that implement the business logic: tab focus tracking, suspend/unsuspend, whitelist management, auto-suspend timers via `chrome.alarms`, tab status calculation, extension icon updates, context menu building, and settings change propagation. |

Supporting modules loaded by the service worker:

| Module | Responsibility |
|---|---|
| `gsStorage.js` | Settings management. Defines all option keys with defaults. Reads/writes `chrome.storage.local`, `chrome.storage.session`, and `chrome.storage.sync`. Handles settings merge and sync. |
| `gsUtils.js` | Utility functions. Tab classification (`isSpecialTab`, `isSuspendedTab`, `isNormalTab`), URL parsing (extract original URL/title/scroll from suspended URL hash), whitelist matching (substring + regex), i18n helpers, theming, retry logic, debugging. |
| `gsSession.js` | Session & crash recovery. Takes snapshots of current browser state (windows, tabs, tab groups), stores them in IndexedDB. Detects crashes by comparing startup state to last saved session. Restores lost tabs. Manages extension update transitions. |
| `gsMessages.js` | Messaging abstraction. Wraps `chrome.tabs.sendMessage` and `chrome.scripting.executeScript`. Provides typed methods for each message type sent to content scripts and extension pages. |
| `gsChrome.js` | Promise wrappers for Chrome APIs (`chrome.tabs.*`, `chrome.windows.*`, `chrome.tabGroups.*`). Includes Vivaldi compatibility workarounds. |
| `gsIndexedDb.js` | IndexedDB CRUD operations for 5 object stores (previews, tab info, favicon cache, current sessions, saved sessions). Handles data trimming and migrations. |
| `gsFavicon.js` | Favicon processing. Fetches via Chrome's `_favicon` API, normalizes via canvas, detects dark/light variants, generates fingerprints, caches in IndexedDB. |

### Content Script

**`contentscript.js`** is injected into web pages via `chrome.scripting.executeScript`. It:

1. Tracks whether the user has input data into form elements (to prevent suspending tabs with unsaved forms)
2. Records the current scroll position
3. Manages temporary whitelist state (pause suspension for this tab)
4. Responds to `requestInfo` messages from the background with current status
5. Self-initializes as an IIFE, avoiding duplicate injection

### Extension Pages

| Page | Controller | Purpose |
|---|---|---|
| `suspended.html` | `suspended.js` | Replaces a suspended tab's content. Displays favicon, title, original URL, optional screenshot, keyboard shortcut hint, and update banner. Click to unsuspend. URL encodes state in hash: `#ttl=Title&pos=ScrollPos&uri=OriginalURL` |
| `popup.html` | `popup.js` | Browser action popup. Shows tab status with contextual actions (suspend, unsuspend, whitelist, pause). Multi-selection actions. Links to settings and session manager. |
| `options.html` | `options.js` | Settings page with three sections: Suspension, Suspended Tabs, and Other. Sidebar navigation to session manager, shortcuts, and about. Includes whitelist test tool. |
| `recovery.html` | `recovery.js` | Crash recovery UI. Lists missing tabs from last session. One-click "Restore Session" or manual recovery via session manager. |
| `history.html` | `history.js` + `historyItems.js` + `historyUtils.js` | Session manager. Shows current session, recent sessions, and saved sessions. Supports expand/collapse, reload, resuspend, export, import, save, delete. Tab migration from other extensions. |
| `update.html` | `update.js` | Pre-update notice. Shown when an update is available with suspended tabs. Prompts backup before updating. |
| `updated.html` | `updated.js` | Post-update notice with recovery summary and changelog. |
| `about.html` | `about.js` | Support/about page with links to GitHub, credits, and debug page. |
| `shortcuts.html` | `shortcuts.js` | Keyboard shortcuts reference and configuration link. |
| `permissions.html` | `permissions.js` | Prompts for `file://` URL access permission. |
| `notice.html` | `notice.js` | Donation/notice page. |
| `debug.html` | `debug.js` | Debug information and logging configuration. |
| `broken.html` | `broken.js` | Error page shown when background initialization fails. |
| `restoring-window.html` | `restoring-window.js` | Brief placeholder during session restore. |

### Tab Management Subsystem

Three managers share the same queue infrastructure (`gsTabQueue.js`) to process tabs concurrently with configurable limits and timeouts:

```
┌──────────────────────────────────────────────────────────────┐
│                    gsTabQueue.js                              │
│  Generic concurrent job queue with:                          │
│  - Configurable concurrency (3-5 parallel jobs)              │
│  - Per-job timeout (5-60 seconds)                            │
│  - Sleep/requeue support                                     │
│  - Deferred promise resolution                               │
│  - States: QUEUED → IN_PROGRESS → (SLEEPING →) COMPLETED    │
└───────────┬──────────────────┬──────────────────┬────────────┘
            │                  │                  │
   ┌────────▼───────┐  ┌──────▼────────┐  ┌──────▼────────┐
   │ gsTabSuspend   │  │ gsTabDiscard  │  │ gsTabCheck    │
   │ Manager        │  │ Manager       │  │ Manager       │
   │                │  │               │  │               │
   │ Concurrency: 3 │  │ Concurrency:5 │  │ Concurrency:3 │
   │ Timeout: 60s   │  │ Timeout: 5s   │  │ Timeout: 60s  │
   │                │  │               │  │               │
   │ - Eligibility  │  │ - Tab discard │  │ - Health      │
   │ - Screenshot   │  │ - Suspend-in- │  │   checks      │
   │ - Tab metadata │  │   place-of-   │  │ - Session ID  │
   │ - URL rewrite  │  │   discard     │  │   verify      │
   └────────────────┘  └───────────────┘  └───────────────┘
```

**Force levels** for suspension eligibility:
- **Level 1** (force): Skip only special tabs (chrome://, extension pages)
- **Level 2** (soft): Also skip active, whitelisted, pinned, audible, form-input tabs
- **Level 3** (auto-timer): Also skip when offline, charging, timer=never

### Data & Storage Layer

The extension uses three storage mechanisms:

#### 1. `chrome.storage.local` — Persistent key-value store
| Key | Content |
|---|---|
| `gsSettings` | Serialized user settings object |
| `gsVersion` | Last known extension version (for update detection) |
| `gsNotice` | Last notice version shown |
| `gsExtensionRecovery` | Timestamp of last crash recovery |

#### 2. `chrome.storage.session` — Ephemeral per-session state
| Key Pattern | Content |
|---|---|
| `gsTab{id}` | Per-tab state (scroll position, suspend reason, flags) |
| `gsSessionId` | Current session identifier |
| `gsCurrentStationaryWindowId` | Currently focused window |
| `gsCurrentFocusedTabIdByWindowId` | Focused tab per window |
| `gsIsCharging` | Battery/charging state |
| `gsInitialisationMode` | Startup mode (normal, install, update) |
| `gsSuspensionToggleHotkey` | Cached keyboard shortcut |
| `gsDefaultFaviconFingerprints` | Cached default favicon fingerprints |

#### 3. `chrome.storage.sync` — Cross-device settings sync
Mirrors all user settings when sync is enabled.

#### 4. IndexedDB (`tgs` database, version 3)

| Object Store | Key | Indexed By | Contents | Limit |
|---|---|---|---|---|
| `gsPreviews` | auto-increment | `url` | Screenshot data URLs (webp/png) | 1000 items |
| `gsSuspendedTabInfo` | auto-increment | `url` | Tab metadata at suspension time (title, favicon, pinned state, date) | 1000 items |
| `gsFaviconMeta` | auto-increment | `url` | Cached favicon data (normalized + transparent data URLs, isDark flag) | 1000 items |
| `gsCurrentSessions` | auto-increment | `sessionId` | Rolling session snapshots (windows, tabs, tab groups) | 5 sessions |
| `gsSavedSessions` | auto-increment | `sessionId` | User-saved and pre-upgrade restore-point sessions | No limit |

The `db.js` third-party library provides a fluent query API over IndexedDB with MongoDB-style operators.

### Messaging System

#### Background ↔ Content Script

| Direction | Message | Purpose |
|---|---|---|
| BG → CS | `{ ignoreForms, tempWhitelist, scrollPos }` | Initialize content script on tab load |
| BG → CS | `{ action: 'requestInfo' }` | Poll for current status + scroll position |
| BG → CS | `{ tempWhitelist: true/false }` | Toggle temporary whitelist |
| CS → BG | `{ action: 'reportTabState', status, scrollPos }` | Report form input / whitelist / normal status |
| CS → BG | `{ action: 'savePreviewData', previewUrl, errorMsg }` | Send back screenshot from html2canvas |

#### Background ↔ Suspended Page

| Direction | Message | Purpose |
|---|---|---|
| BG → Susp | `{ action: 'initTab', tab, quickInit, sessionId }` | Initialize suspended tab UI |
| BG → Susp | `{ action: 'getSuspendInfo', tab }` | Check visibility + session match |
| BG → Susp | `{ action: 'updateTheme', tab, theme, isLowContrastFavicon }` | Live theme update |
| BG → Susp | `{ action: 'updatePreviewMode', tab, previewMode }` | Toggle preview visibility |
| BG → Susp | `{ action: 'updateCommand', tabId }` | Refresh hotkey display |
| BG → Susp | `{ action: 'showNoConnectivityMessage' }` | Show offline toast |

#### Popup → Background

Via `chrome.runtime.sendMessage`: `suspendOne`, `unsuspendOne`, `suspendAll`, `unsuspendAll`, `suspendSelected`, `unsuspendSelected`, `whitelistDomain`, `whitelistPage`, `sessionManagerLink`, `settingsLink`

#### External Extension API

Via `chrome.runtime.onMessageExternal`:
```js
{ action: 'suspend', tabId?: number }   // Suspend a tab (or active tab)
{ action: 'unsuspend', tabId?: number } // Unsuspend a tab (or active tab)
```

---

## Tab Lifecycle

### Suspension Flow

```
User action / Timer alarm
        │
        ▼
gsTabSuspendManager.queueTabForSuspension(tab, forceLevel)
        │
        ▼
checkTabEligibilityForSuspension(tab, forceLevel)
   ├─ Level 1: skip only special tabs (chrome://, extensions)
   ├─ Level 2: + skip active, whitelisted, pinned, audible, form input
   └─ Level 3: + skip when offline, charging, timer=never
        │
        ▼
gsTabQueue executes performSuspension()
        │
        ├─ If DISCARD_IN_PLACE_OF_SUSPEND → queue for discard instead
        ├─ Query content script for scroll position + form status
        ├─ Save tab info to IndexedDB (gsSuspendedTabInfo)
        ├─ If YouTube → capture &t= timestamp
        ├─ If SCREEN_CAPTURE enabled:
        │     ├─ Inject html2canvas.min.js into page
        │     ├─ Render canvas → generate data URL
        │     └─ Save preview to IndexedDB (gsPreviews)
        ├─ Generate suspended URL:
        │     chrome-extension://ID/suspended.html#ttl=T&pos=P&uri=U
        └─ chrome.tabs.update(tabId, { url: suspendedUrl })
```

### Unsuspension Flow

```
User clicks suspended page / popup action / shortcut
        │
        ▼
tgs.unsuspendTab(tab)
        │
        ├─ Extract scroll position from URL hash (#pos=...)
        ├─ Extract original URL from hash (#uri=...)
        ├─ Save scroll position to session storage
        ├─ Save STATE_HISTORY_URL_TO_REMOVE (to clean history later)
        ├─ Set autoDiscardable=false temporarily (Chrome bug workaround)
        └─ chrome.tabs.update(tabId, { url: originalUrl })
                │
                ▼
        Tab loads → onUpdated fires → handleUnsuspendedTabStateChanged
                │
                ├─ Delete suspended URL from chrome.history
                ├─ Restore autoDiscardable to true
                ├─ Reset auto-suspend timer
                ├─ Re-inject content script with scroll position
                └─ Update extension icon (green = active)
```

### Auto-Suspend Timer

```
Tab gains focus → resetAutoSuspendTimerForTab(tab)
        │
        ├─ Clear existing chrome.alarm for this tab ID
        ├─ Check if tab is protected (active, pinned, whitelisted, etc.)
        └─ chrome.alarms.create(tabId.toString(), { when: now + suspendTimeMs })
                │
                ▼
        Timeout elapses → chrome.alarms.onAlarm fires
                │
                ▼
        Parse tab ID from alarm name
                │
                └─ gsTabSuspendManager.queueTabForSuspension(tab, forceLevel=3)
                   (Level 3 = respects all user preferences)
```

### Full Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        ACTIVE TAB                               │
│                                                                 │
│  1. Tab created or navigated                                    │
│  2. Content script injected (contentscript.js)                  │
│  3. Auto-suspend alarm set: chrome.alarms.create(tabId, when)   │
│  4. Content script tracks: form input, scroll position          │
│  5. Background tracks: focus state, audio, pinned, online       │
│                                                                 │
│  Protection checks on every alarm fire:                         │
│  ✗ Skip if: whitelisted, pinned, audible, active, form input    │
│  ✗ Skip if: offline (setting), charging (setting), timer=never  │
└───────────────────────┬─────────────────────────────────────────┘
                        │ Timer fires OR user triggers suspension
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUSPENDING                                  │
│                                                                 │
│  1. Queued in gsTabSuspendManager (max 3 concurrent)            │
│  2. Eligibility rechecked at execution time                     │
│  3. Content script queried for scroll position + status         │
│  4. YouTube: timestamp captured via &t= parameter               │
│  5. Tab metadata saved to IndexedDB (gsSuspendedTabInfo)        │
│  6. If screen capture enabled:                                  │
│     a. html2canvas.min.js injected                              │
│     b. Canvas rendered → data URL generated (webp/png)          │
│     c. Preview saved to IndexedDB (gsPreviews)                  │
│  7. Suspended URL generated with hash encoding                  │
│  8. chrome.tabs.update(tabId, { url: suspendedUrl })            │
│  9. Session snapshot updated in IndexedDB                       │
└───────────────────────┬─────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUSPENDED TAB                                │
│                                                                 │
│  suspended.html loads → suspended.js initializes:               │
│  1. Title set from URL hash #ttl=...                            │
│  2. Favicon loaded from cache (IndexedDB) or fetched            │
│  3. Screenshot preview loaded from IndexedDB (if available)     │
│  4. Keyboard shortcut hint displayed                            │
│  5. Theme applied (system / light / dark)                       │
│  6. Click handler registered → unsuspend on interaction         │
│  7. beforeunload handler → detect refresh vs. navigation        │
│                                                                 │
│  While suspended:                                               │
│  • gsTabCheckManager verifies initialization                    │
│  • If DISCARD_AFTER_SUSPEND → chrome.tabs.discard()             │
│  • Extension icon set to grey (paused)                          │
│  • Update banner may appear if update available                 │
│  • Theme/preview mode can update live via messaging             │
│  • If UNSUSPEND_ON_FOCUS → auto-restores when tab focused       │
└───────────────────────┬─────────────────────────────────────────┘
                        │ User clicks / shortcut / popup / auto-unsuspend
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RESTORING                                   │
│                                                                 │
│  1. tgs.unsuspendTab(tab) called                                │
│  2. Scroll position + original URL extracted from hash          │
│  3. autoDiscardable temporarily set to false                    │
│  4. chrome.tabs.update(tabId, { url: originalUrl })             │
│  5. onUpdated fires when page loads:                            │
│     a. Suspended URL removed from chrome.history                │
│     b. autoDiscardable restored                                 │
│     c. Auto-suspend timer restarted                             │
│     d. Content script re-initialized with scroll position       │
│     e. Icon restored to green (active)                          │
│  6. Tab is fully active again → lifecycle restarts              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Special Paths

### Crash Recovery

On startup, `gsSession.runStartupChecks()` compares the current browser state with the last session saved in IndexedDB. If suspended tabs are missing (indicating an extension crash), recovery begins:

1. **First crash** → Tabs restored automatically
2. **Repeated crashes** → `recovery.html` shown with manual restore option
3. Screen capture is flagged as a possible cause if enabled

### Extension Update

When an update is available:

1. `prepareForUpdate()` saves a session restore point to IndexedDB
2. Update banner shown on all suspended tabs
3. At least one unsuspended tab ensured per window (prevents total tab loss)
4. After update, `updated.html` shows recovery summary and changelog

### Discarded Tab Interception

When `SUSPEND_IN_PLACE_OF_DISCARD` is enabled and Chrome discards an unsuspended tab (low memory):

1. `chrome.tabs.onUpdated` detects the discarded state
2. Extension suspends the discarded tab instead
3. Tab state preserved (unlike Chrome's discard which loses page state)

### Tab Migration (Claiming)

With `CLAIM_BY_DEFAULT` enabled, the extension can claim suspended tabs from other suspender extensions (like The Great Suspender) by rewriting their `chrome-extension://OTHER_ID/suspended.html` URLs to use the current extension ID.

---

## Settings Reference

| Key | Default | Type | Description |
|---|---|---|---|
| `gsTimeToSuspend` | `'60'` | string (minutes) | Auto-suspend after inactivity. `'0'` = never. Range: 20s – 2 weeks |
| `screenCapture` | `'0'` | string | Screenshot mode: `0`=off, `1`=viewport, `2`=full page |
| `screenCaptureForce` | `false` | boolean | High-quality screenshots (higher res, longer timeout) |
| `gsUnsuspendOnFocus` | `false` | boolean | Auto-unsuspend when tab gains focus |
| `gsDontSuspendPinned` | `true` | boolean | Never suspend pinned tabs |
| `gsDontSuspendForms` | `true` | boolean | Never suspend tabs with unsaved form input |
| `gsDontSuspendAudio` | `true` | boolean | Never suspend tabs playing audio |
| `gsDontSuspendActiveTabs` | `true` | boolean | Never suspend the currently active tab |
| `onlineCheck` | `false` | boolean | Never suspend when offline |
| `batteryCheck` | `false` | boolean | Never suspend when charging |
| `gsWhitelist` | `''` | string | Newline-separated whitelist (supports regex `/pattern/`) |
| `gsAddContextMenu` | `true` | boolean | Show right-click context menu |
| `gsSyncSettings` | `true` | boolean | Sync settings across Chrome profiles |
| `gsTheme` | `'system'` | string | Theme: `'system'`, `'light'`, `'dark'` |
| `discardAfterSuspend` | `false` | boolean | Discard tabs from memory after suspending |
| `discardInPlaceOfSuspend` | `false` | boolean | Use Chrome native discard instead of suspend |
| `suspendInPlaceOfDiscard` | `false` | boolean | Suspend when Chrome would discard |
| `gsIgnoreCache` | `false` | boolean | Ignore cache |
| `gsNoNag` | `false` | boolean | Disable donation nag |
| `claimByDefault` | `false` | boolean | Claim tabs from other suspender extensions |

---

## Chrome APIs Used

| API | Usage |
|---|---|
| `chrome.tabs.*` | Query, create, update, remove, discard, group, sendMessage |
| `chrome.windows.*` | getLastFocused, getAll, create, update, onFocusChanged |
| `chrome.alarms.*` | Per-tab suspend timers (alarm name = tab ID as string) |
| `chrome.storage.local` | Persistent settings and version tracking |
| `chrome.storage.session` | Ephemeral per-tab state and focus tracking |
| `chrome.storage.sync` | Cross-device settings synchronization |
| `chrome.runtime.*` | Messages (internal + external), onInstalled, onStartup, onSuspend, getManifest, onUpdateAvailable |
| `chrome.contextMenus.*` | 16-item right-click context menu |
| `chrome.commands.*` | 11 configurable keyboard shortcuts |
| `chrome.scripting.executeScript` | Inject content script and html2canvas |
| `chrome.tabGroups.*` | Query and restore tab group assignments (color, title, collapsed) |
| `chrome.history.*` | Clean up history entries from suspend/unsuspend transitions |
| `chrome.action.*` | Set extension icon per tab (green active vs grey paused) |
| `chrome.extension.isAllowedFileSchemeAccess` | Check file:// URL permission |
| `chrome.permissions.request` | Request host permissions |
| `chrome.i18n.*` | Internationalization (18 locales) |
| `IndexedDB` (via db.js) | Persistent storage for sessions, favicons, previews, tab info |
| `navigator.getBattery()` | Battery/charging state detection |
| `navigator.onLine` | Network connectivity detection |

---

## Build System

### Prerequisites
- Node.js + npm
- OpenSSL (for CRX signing key)

### Scripts

| Command | Description |
|---|---|
| `npm install` | Install dependencies |
| `npm run generate-key` | Generate `key.pem` signing key via OpenSSL |
| `npm run build` | Production build (Grunt: copies src, disables debug, creates CRX + ZIP) |
| `npm run lint` | ESLint check |

### Build Process (Grunt)

1. **Copy** — `src/` → `build/tms-temp/` (excluding test files and XCF source images)
2. **String replace** — Disable debug flags (`debugInfo = false`, `debugError = false`)
3. **Package CRX** — Signed extension → `build/crx/tms-{version}.crx`
4. **Package ZIP** — Unsigned archive → `build/zip/tms-{version}.zip`
5. **Clean** — Remove temp directory

A `tgut` task variant enables debug mode and renames to "The Marvellous Tester" for testing builds.

### Loading for Development

1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `src/` directory

---

## Internationalization

18 locales supported via Chrome's `chrome.i18n` API and Crowdin:

| Code | Language |
|---|---|
| `en` | English (default) |
| `ar` | Arabic |
| `cs` | Czech |
| `de` | German |
| `es` | Spanish |
| `fr` | French |
| `fr-FR` | French (France) |
| `id` | Indonesian |
| `it` | Italian |
| `ja` | Japanese |
| `pt_BR` | Portuguese (Brazil) |
| `pt_PT` | Portuguese (Portugal) |
| `ru` | Russian |
| `si-LK` | Sinhala |
| `sk` | Slovak |
| `tr` | Turkish |
| `zh_CN` | Chinese (Simplified) |
| `zh_TW` | Chinese (Traditional) |

All user-facing strings use `__MSG_key__` placeholders in HTML and `chrome.i18n.getMessage('key')` in JavaScript. Translations are managed via [Crowdin](https://crowdin.com/project/tms).
