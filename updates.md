# Changelog

## 0.1.0
- **Note**: Reset versioning for The Marvellous Suspender Lite as a fresh release identity.
- **Cleanup**: Flattened production output to `dist/extension/` for straightforward unpacked loading.
- **New**: Added a Settings-integrated Health Check page to scan suspended tab responsiveness and recover broken tabs.
- **Security**: Added guarded startup orphan sweep and heartbeat checks to recover only unresponsive suspended tabs.

## 8.1.5
- **Performance**: Increased concurrent tab suspensions and reduced queue processing delay to fix a 10-second delay during bulk tab suspension.
- **Cleanup**: Removed legacy session-management entry points and repointed old page links to the Recovery page.
- **UX**: Enhanced the Excluded URLs page with recheck/cleanup controls.
- **Cleanup**: Reduced service worker console log bloat by filtering diagnostics to high-signal events only.
