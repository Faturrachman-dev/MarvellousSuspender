# The Marvellous Suspender — Architecture & Documentation

> Current version: **8.1.3** · Manifest V3 · Minimum Chrome 110  
> License: GNU GPLv2  
> Fork of: [gioxx/MarvellousSuspender](https://github.com/gioxx/MarvellousSuspender) → [greatsuspender/thegreatsuspender](https://github.com/greatsuspender/thegreatsuspender)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [What Was Removed in This Fork](#what-was-removed-in-this-fork)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
  - [High-Level Diagram](#high-level-diagram)
  - [Service Worker (Background)](#service-worker-background)
  - [Content Script](#content-script)
  - [Extension Pages](#extension-pages)
  - [Exclusion Engine](#exclusion-engine)
- [Tab Lifecycle](#tab-lifecycle)
  - [Suspension Flow](#suspension-flow)
  - [Unsuspension Flow](#unsuspension-flow)
  - [Auto-Suspend Timer](#auto-suspend-timer)
- [Settings Reference](#settings-reference)
- [Chrome APIs Used](#chrome-apis-used)
- [Build System](#build-system)
- [Testing](#testing)
- [Internationalization](#internationalization)

---

## Overview

**The Marvellous Suspender** is a Chromium browser extension that frees system resources (RAM, CPU) by automatically suspending inactive tabs after a configurable timeout. Suspended tabs are replaced with a lightweight HTML page that preserves the original URL, title, favicon, and scroll position. Users can unsuspend tabs with a single click, keyboard shortcut, or automatically on focus.

---

## Features

### Core Functionality
- **Automatic tab suspension** — Tabs suspended after a configurable inactivity period (20 seconds to 2 weeks, or never)
- **Manual suspension** — Suspend/unsuspend individual tabs, selected tabs, all tabs in a window, or all tabs across all windows via the popup
- **Tab state preservation** — Original URL, title, favicon, and scroll position preserved
- **One-click restore** — Click anywhere on a suspended tab page, use keyboard shortcuts, or the popup menu

### Smart Protection
- Never suspend pinned tabs
- Never suspend tabs with unsaved form input (detects `keydown`, `input`, `change` events on all input element types)
- Never suspend tabs playing audio
- Never suspend the active/focused tab
- Never suspend when offline (optional)
- **Fail-safe design** — if the content script is unreachable during auto-suspend, the tab is treated as protected (not suspended)

### Excluded URLs
- Full management UI at `excluded.html` (link available in popup and settings sidebar)
- Four match types: **Exact URL**, **Domain** (`*.example.com`), **Contains** (substring, case-insensitive), **Regex** (`/pattern/`)
- Import/export rules as newline-separated text
- Test URL panel to check which rules match a given URL

### Visual
- **Theme support** — Light, dark, or system-automatic theme for suspended pages
- **Favicon display** — Favicon with dark/light detection for proper contrast

### Other
- Right-click context menu with suspend/unsuspend actions
- Keyboard shortcuts (configurable)
- Settings sync across Chrome profiles
- Incognito mode support (split mode)
- External extension API for suspend/unsuspend
- 18 supported languages via Crowdin

---

## What Was Removed in This Fork

The following features present in the upstream were removed because they were either broken in Manifest V3 or added complexity without benefit:

| Feature | Reason Removed |
|---|---|
| **Screen capture** (html2canvas) | `chrome.scripting.executeScript` in MV3 cannot inject third-party libraries with sufficient timing to produce reliable screenshots; the feature was effectively broken |
| **IndexedDB** (db.js / gsIndexedDb) | Only used to persist screen captures and session state; made redundant by removal of both |
| **Session management** (gsSession / history.html) | Depended entirely on IndexedDB; crash recovery was unreliable in MV3 service workers |
| **Battery check** | `navigator.getBattery()` is not available in MV3 service workers; the option was silently ignored |
| **Discard-in-place-of-suspend** | Niche feature; increased suspension manager complexity |
| **Claim-by-default** (tab migration) | Deprecated; The Great Suspender is no longer maintained |
| **gsTabCheckManager** | Health-poll loop for suspended tabs; removed with IndexedDB |
| **gsTabDiscardManager** | Discard queue; removed with discard feature |

---

## Project Structure

```
MarvellousSuspender/
├── src/                          # Extension source (load directly or build)
│   ├── manifest.json             # MV3 manifest
│   ├── excluded.html             # Excluded URLs management page (NEW)
│   ├── *.html                    # Other extension pages
│   ├── _locales/                 # i18n (18 languages)
│   │   └── {lang}/messages.json
│   ├── css/
│   │   ├── excluded.css          # Styles for excluded.html (NEW)
│   │   └── *.css                 # Other stylesheets
│   ├── font/                     # Icon fonts (fontello)
│   ├── img/                      # Extension icons & assets
│   └── js/
│       ├── background.js         # Service worker entry point
│       ├── tgs.js                # Core orchestrator
│       ├── contentscript.js      # Injected into web pages
│       ├── exclusionUtils.js     # Pure exclusion/whitelist engine (NEW)
│       ├── excluded.js           # Controller for excluded.html (NEW)
│       ├── gsChrome.js           # chrome.* API wrappers
│       ├── gsFavicon.js          # Favicon fetch and caching
│       ├── gsMessages.js         # Content script messaging helpers
│       ├── gsStorage.js          # Settings read/write
│       ├── gsTabQueue.js         # Generic job queue
│       ├── gsTabSuspendManager.js # Suspension queue and logic
│       ├── gsUtils.js            # Utilities (URL parsing, i18n, etc.)
│       └── {page}.js             # Per-page controllers
├── src/tests/                    # Unit tests
│   ├── setup.js                  # Vitest global Chrome API mocks
│   ├── exclusionUtils.test.js    # Tests for exclusionUtils.js
│   └── eligibility.test.js      # Tests for suspension eligibility logic
├── docs/
│   └── ARCHITECTURE.md           # This file
├── Gruntfile.js                  # Build configuration
├── vitest.config.js              # Test configuration
├── package.json                  # Dependencies & scripts
├── eslint.config.mjs             # Linting
└── tsconfig.json                 # TypeScript config (editor support)
```

---

## Architecture

### High-Level Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         CHROME BROWSER                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              SERVICE WORKER (background.js)              │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌─────────────────┐  ┌────────────────┐  │   │
│  │  │  tgs.js   │  │  gsStorage.js   │  │  gsUtils.js    │  │   │
│  │  │ (core     │  │  (settings,     │  │  (utilities,   │  │   │
│  │  │  logic)   │  │   storage)      │  │   URL parsing) │  │   │
│  │  └──────────┘  └─────────────────┘  └────────────────┘  │   │
│  │                                                          │   │
│  │  ┌─────────────────────┐  ┌──────────────────────────┐  │   │
│  │  │ gsTabSuspendManager  │  │ gsTabQueue.js            │  │   │
│  │  │ (suspension queue,  │  │ (generic job queue,      │  │   │
│  │  │  eligibility checks)│  │  concurrency control)    │  │   │
│  │  └─────────────────────┘  └──────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌─────────────┐  ┌───────────────┐  │   │
│  │  │ gsMessages.js │  │ gsChrome.js │  │ gsFavicon.js  │  │   │
│  │  │ (CS messaging)│  │ (API wraps) │  │ (favicon cache│  │   │
│  │  └──────────────┘  └─────────────┘  └───────────────┘  │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │ chrome.tabs.sendMessage            │
│                             │ chrome.scripting.executeScript     │
│                             ▼                                    │
│  ┌──────────────────────────────────┐  ┌───────────────────────┐ │
│  │        CONTENT SCRIPTS           │  │    EXTENSION PAGES    │ │
│  │                                  │  │                       │ │
│  │  contentscript.js                │  │  popup.html/js        │ │
│  │  - form input detection          │  │  options.html/js      │ │
│  │    (keydown + input + change)    │  │  excluded.html/js     │ │
│  │  - scroll position tracking      │  │  suspended.html/js    │ │
│  │  - temp whitelist flag           │  │  about/shortcuts.html │ │
│  │  - responds to requestInfo       │  │                       │ │
│  └──────────────────────────────────┘  └───────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Service Worker (Background)

| File | Role |
|---|---|
| `background.js` | Entry point. Registers all Chrome event listeners (messages, commands, context menus, alarms, tabs, windows, runtime). Routes events to `tgs.*` functions. Bootstraps initialization on startup/install. |
| `tgs.js` | Core orchestrator. ~50 exported functions: tab focus tracking, suspend/unsuspend, whitelist management, auto-suspend timers via `chrome.alarms`, tab status calculation, extension icon updates, context menu, settings propagation. |

Supporting modules:

| Module | Responsibility |
|---|---|
| `gsStorage.js` | Settings management. All option keys with defaults. Reads/writes `chrome.storage.local`, `.session`, and `.sync`. |
| `gsUtils.js` | Utilities. Tab classification, URL encoding/decoding for suspended URLs, whitelist matching, i18n helpers, theming, retry logic, debugging. |
| `gsMessages.js` | Wrappers for `chrome.tabs.sendMessage` and `chrome.scripting.executeScript` with timeout and error handling. |
| `gsChrome.js` | Promise-based wrappers for Chrome APIs (`chrome.tabs.update`, `chrome.tabs.query`, etc.). |
| `gsFavicon.js` | Fetches and caches favicons; builds favicon metadata for suspended pages. |
| `gsTabSuspendManager.js` | Maintains a job queue (`gsTabQueue`) for suspension work. Performs eligibility checks, queries content scripts, generates suspended URLs, and executes suspension via `chrome.tabs.update`. |
| `gsTabQueue.js` | Generic job queue with configurable concurrency and per-job timeouts. Used by `gsTabSuspendManager`. |

### Content Script

`contentscript.js` is injected into every normal web page. It:

1. **Listens for form input** via `keydown`, `input`, and `change` events on `INPUT`, `TEXTAREA`, `SELECT`, and `contenteditable` elements
2. **Tracks scroll position** (`document.documentElement.scrollTop`)
3. **Maintains a temp-whitelist flag** set by the background when the user pauses suspension on a tab
4. **Responds to `requestInfo` messages** from the background with `{ status, scrollPos }`

Status values returned:
- `'normal'` — tab is safe to suspend
- `'formInput'` — active form input detected (when `dontSuspendForms` is enabled)
- `'tempWhitelist'` — user has paused suspension on this tab

**Fail-safe behaviour:** If the content script is unreachable during auto-suspend (force level ≥ 2), the tab is treated as protected and is **not** suspended. For manual force-suspension (level 1), it falls back to `{ status: 'unknown', scrollPos: '0' }`.

### Extension Pages

| Page | Purpose |
|---|---|
| `popup.html` | Quick actions: suspend/unsuspend current tab, selected tabs, all tabs; exclude current page/domain; link to settings and excluded management |
| `options.html` | Settings: auto-suspend time, protection toggles, theme, sync. Links to `excluded.html` for whitelist management |
| `excluded.html` | **New.** Full CRUD management of excluded URL rules with add/remove/import/export/test |
| `suspended.html` | The lightweight page that replaces a suspended tab |
| `about.html` | Extension info and links |
| `shortcuts.html` | Keyboard shortcut configuration guide |
| `permissions.html` | Permission request page |

### Exclusion Engine

`exclusionUtils.js` is a pure, side-effect-free module with no Chrome API dependencies, making it fully unit-testable.

**Match types** (detected automatically from format):

| Type | Detection | Behaviour |
|---|---|---|
| Regex | starts and ends with `/` | `new RegExp(pattern).test(url)` |
| Domain | starts with `*.` | hostname matches `domain` or ends with `.domain` |
| Exact | contains `://` | strict equality |
| Contains | everything else | `url.toLowerCase().includes(entry.toLowerCase())` |

**Exported functions:**
- `testForMatch(entry, url)` — test a single rule against a URL
- `matchesWhitelist(url, whitelistString)` — test a URL against a newline-separated list
- `parseWhitelistEntries(whitelistString)` → `[{ raw, type }]` — parse and classify all rules
- `addEntry(whitelist, entry)` → new whitelist string (deduplicates)
- `removeEntry(whitelist, entry)` → new whitelist string

---

## Tab Lifecycle

### Suspension Flow

```
Tab inactivity timer fires (chrome.alarms.onAlarm)
        │
        ▼
tgs.queueTabForSuspension(tab, forceLevel=3)
        │
        ▼
gsTabSuspendManager.checkTabEligibilityForSuspension(tab, forceLevel)
        │
        ├─ Is special tab (chrome://, extension page)? → skip
        ├─ Is pinned? (if dontSuspendPinned) → skip
        ├─ Is audible? (if dontSuspendAudio) → skip
        ├─ Is active? (if dontSuspendActiveTabs) → skip
        ├─ Is online-only and offline? → skip
        ├─ Is whitelisted? (exclusionUtils.matchesWhitelist) → skip
        └─ All checks pass → proceed
                │
                ▼
        Query content script: chrome.tabs.sendMessage(tabId, { action: 'requestInfo' })
                │
                ├─ CS unreachable + auto-suspend (forceLevel>=2) → SKIP (fail-safe)
                ├─ CS unreachable + manual (forceLevel=1) → use { status:'unknown', scrollPos:'0' }
                ├─ status='formInput' (and dontSuspendForms) → skip
                └─ status='tempWhitelist' → skip
                        │
                        ▼
                Generate suspended URL:
                  tms://[hash]#ttl=Title&uri=OriginalUrl&pos=ScrollPos
                        │
                        ▼
                chrome.tabs.update(tabId, { url: suspendedUrl })
                        │
                        ▼
                Tab is suspended — lightweight suspended.html loads
```

### Unsuspension Flow

```
User clicks suspended page / popup / keyboard shortcut
        │
        ▼
tgs.unsuspendTab(tab)
        │
        ├─ Extract original URL + scroll pos from suspended URL hash
        ├─ Set tab.autoDiscardable = false (prevent Chrome from discarding during restore)
        ├─ chrome.tabs.update(tabId, { url: originalUrl })
        │
        ▼
chrome.tabs.onUpdated (status='complete')
        │
        ├─ Remove suspended-page entry from chrome.history
        ├─ Restore tab.autoDiscardable = true
        ├─ Re-initialize content script with scroll position
        ├─ Restart auto-suspend timer for this tab
        └─ Update extension icon (active state)
```

### Auto-Suspend Timer

```
Tab gains focus → tgs.resetAutoSuspendTimerForTab(tab)
        │
        ├─ Clear existing chrome.alarm for this tab ID
        ├─ Check if tab is protected (active, pinned, whitelisted, etc.)
        └─ chrome.alarms.create(tabId.toString(), { when: now + suspendTimeMs })
                │
                ▼ (alarm fires after configured inactivity period)
        chrome.alarms.onAlarm
                │
                └─ gsTabSuspendManager.queueTabForSuspension(tab, forceLevel=3)
```

---

## Settings Reference

| Key | Default | Type | Description |
|---|---|---|---|
| `gsTimeToSuspend` | `'60'` | string (minutes) | Auto-suspend after inactivity. `'0'` = never |
| `gsUnsuspendOnFocus` | `false` | boolean | Auto-unsuspend when tab gains focus |
| `gsDontSuspendPinned` | `true` | boolean | Never suspend pinned tabs |
| `gsDontSuspendForms` | `true` | boolean | Never suspend tabs with unsaved form input |
| `gsDontSuspendAudio` | `true` | boolean | Never suspend tabs playing audio |
| `gsDontSuspendActiveTabs` | `true` | boolean | Never suspend the active tab |
| `onlineCheck` | `false` | boolean | Never suspend when offline |
| `batteryCheck` | `false` | boolean | ⚠️ Disabled — `navigator.getBattery()` not available in MV3 service workers |
| `gsWhitelist` | `''` | string | Newline-separated exclusion rules (also editable via `excluded.html`) |
| `gsAddContextMenu` | `true` | boolean | Show right-click context menu |
| `gsSyncSettings` | `true` | boolean | Sync settings across Chrome profiles |
| `gsTheme` | `'system'` | string | Suspended page theme: `'system'`, `'light'`, `'dark'` |
| `discardAfterSuspend` | `false` | boolean | Discard tabs from memory after suspending (memory saving) |
| `suspendInPlaceOfDiscard` | `false` | boolean | Suspend when Chrome would normally discard (low memory) |

---

## Chrome APIs Used

| API | Usage |
|---|---|
| `chrome.tabs.*` | Query, update, remove, discard, sendMessage |
| `chrome.windows.*` | getLastFocused, getAll, onFocusChanged |
| `chrome.alarms.*` | Per-tab inactivity timers (alarm name = tab ID) |
| `chrome.storage.local` | Persistent settings and version tracking |
| `chrome.storage.session` | Ephemeral per-tab state (focus, temp whitelist) |
| `chrome.storage.sync` | Cross-device settings sync |
| `chrome.runtime.*` | Messages (internal + external), onInstalled, onStartup, onUpdateAvailable, getManifest |
| `chrome.contextMenus.*` | Right-click context menu |
| `chrome.commands.*` | Configurable keyboard shortcuts |
| `chrome.scripting.executeScript` | Inject content script into tabs |
| `chrome.tabGroups.*` | Query and restore tab group metadata |
| `chrome.history.*` | Remove suspended-page history entries on unsuspend |
| `chrome.action.*` | Per-tab extension icon (green active / grey paused) |
| `chrome.extension.isAllowedFileSchemeAccess` | Check file:// permission |
| `chrome.permissions.request` | Request host permissions |
| `chrome.i18n.*` | Internationalization |
| `navigator.onLine` | Network connectivity detection |

---

## Build System

### Prerequisites
- Node.js + npm
- OpenSSL (for CRX signing key generation)

### Scripts

| Command | Description |
|---|---|
| `npm install` | Install dependencies |
| `npm run generate-key` | Generate `key.pem` signing key (one-time) |
| `npm run build` | Production build (Grunt: copy, disable debug, ZIP + CRX) |
| `npm run dev` | Build + watch `src/**` for changes (auto-rebuild) |
| `npm run test` | Run unit tests once (Vitest) |
| `npm run test:watch` | Run tests in interactive watch mode |
| `npm run test:coverage` | Run tests with V8 coverage report |
| `npm run lint` | ESLint check |

### Build Process (Grunt)

1. **Copy** — `src/` → `build/tms-temp/` (excluding test files and XCF source images)
2. **String replace** — Disable debug flags (`debugInfo = false`, `debugError = false`)
3. **Package ZIP** — Unsigned archive → `build/zip/tms-{version}.zip`
4. **Package CRX** — Signed extension → `build/crx/tms-{version}.crx` (requires `key.pem`)
5. **Clean** — Remove temp build directory

**Dev task** (`npm run dev` / `grunt dev`): runs steps 1–2, then enters watch mode — any change under `src/` triggers an incremental copy + string-replace.

### Loading for Development

```
1. chrome://extensions → enable Developer mode
2. Load unpacked → select src/
3. Reload extension after JS changes (HTML/CSS changes are reflected immediately)
```

---

## Testing

Tests live in `src/tests/` and run with [Vitest](https://vitest.dev/) in `node` environment (no browser required).

| File | What it tests |
|---|---|
| `exclusionUtils.test.js` | All four match types (regex, domain, contains, exact), edge cases (invalid regex, empty, null, case-sensitivity), `addEntry`, `removeEntry`, multi-rule `matchesWhitelist` |
| `eligibility.test.js` | Content script status → eligibility mapping for all force levels |

Global Chrome API stubs are defined in `src/tests/setup.js` using `vi.fn()`.

Run:
```bash
npm run test           # single run
npm run test:watch     # interactive
npm run test:coverage  # with coverage report
```

---

## Internationalization

18 locales supported via Chrome's `chrome.i18n` API and [Crowdin](https://crowdin.com/project/tms):

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

All user-facing strings use `__MSG_key__` in HTML and `chrome.i18n.getMessage('key')` in JS.
