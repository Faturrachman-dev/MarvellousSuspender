# The Marvellous Suspender

[![Crowdin](https://badges.crowdin.net/tms/localized.svg)](https://crowdin.com/project/tms)

**The Marvellous Suspender** is a free and open-source Google Chrome extension that frees system resources by automatically suspending inactive tabs. It is a privacy-respecting fork of [The Great Suspender](https://github.com/greatsuspender/thegreatsuspender) with no ads or tracking.

This repository is a further-simplified fork of [gioxx/MarvellousSuspender](https://github.com/gioxx/MarvellousSuspender), hardening the core suspension and exclusion mechanics while removing features that were broken in Manifest V3 or added unnecessary complexity.

---

## What's Different in This Fork

| Feature | Upstream | This Fork |
|---|---|---|
| Screen capture (html2canvas) | ✔️ | ❌ Removed (broken in MV3 service workers) |
| IndexedDB / session history | ✔️ | ❌ Removed |
| Session management page | ✔️ | ❌ Removed |
| Battery check | ✔️ | ❌ Removed (`navigator.getBattery()` unavailable in MV3) |
| Excluded URLs management UI | ❌ | ✔️ New `excluded.html` page |
| Exclusion engine | partial | ✔️ Rewritten as `exclusionUtils.js` (regex/domain/contains/exact) |
| Form input fail-safe | fails open | ✔️ Fails safe — blocks auto-suspend if content script unreachable |
| Form detection coverage | keyCode 48–90 only | ✔️ `input`/`change` events, all element types incl. `<select>` |
| Unit tests | ❌ | ✔️ 54 tests (Vitest) |
| Auto-build on save | ❌ | ✔️ `grunt-contrib-watch` |

---

## Features

- **Automatic tab suspension** — suspend tabs after a configurable inactivity period (20 seconds to 2 weeks, or never)
- **Manual controls** — suspend/unsuspend individual tabs, selected tabs, or all tabs via the popup
- **Smart protection** — never suspend pinned, audible, active, or form-input tabs
- **Excluded URLs** — full management UI with four match types: exact URL, domain (`*.example.com`), contains (substring), and regex
- **Keyboard shortcuts** — configurable shortcuts for all actions
- **Right-click context menu** — all actions available via context menu
- **Theme support** — light, dark, or system theme on suspended pages
- **Settings sync** — sync settings across Chrome profiles
- **18 languages** — full i18n via Crowdin

---

## Installation

### Load Unpacked (Recommended for this fork)

1. Clone this repository
2. Navigate to `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `src/` directory

### Build from Source

**Prerequisites:** Node.js, npm, OpenSSL

```bash
npm install
npm run generate-key   # one-time: generates key.pem for CRX signing
npm run build          # production build → build/zip/ and build/crx/
```

The unsigned ZIP at `build/zip/tms-{version}.zip` can also be loaded via **Load unpacked** after extraction.

---

## Development

```bash
npm run dev            # build once, then watch src/ for changes (auto-rebuild)
npm run test           # run unit tests (Vitest)
npm run test:watch     # run tests in watch mode
npm run lint           # ESLint
```

VS Code tasks are available via **Terminal → Run Task**: Build, Test, Watch, Test Watch.

---

## Excluded URLs

Open **Manage excluded pages** from the popup, or navigate to the **Excluded URLs** link in Settings.

| Match type | Format | Example |
|---|---|---|
| Exact URL | Full URL | `https://mail.google.com/` |
| Domain | `*.example.com` | `*.google.com` |
| Contains | Any substring | `github` |
| Regex | `/pattern/` | `/\/app\/.*/` |

Rules can be added, removed, imported (newline-separated text), and exported from the management page.

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module responsibilities, tab lifecycle, messaging system, settings reference, and build system details.

---

## Contributing

Contributions are welcome. Please raise an issue before submitting a pull request for larger changes.

### Localization

Translations are managed on [Crowdin](https://crowdin.com/project/tms). If your language is missing, open an issue or submit a request there.

---

## License

GNU General Public License v2. See [LICENSE](LICENSE).

---

## Acknowledgements

- Original extension by [Dean Oemcke](https://github.com/deanoemcke/thegreatsuspender)
- Upstream fork maintained by [Gioxx](https://github.com/gioxx/MarvellousSuspender)
- [BrowserStack](https://www.browserstack.com) for free Chrome testing tools
