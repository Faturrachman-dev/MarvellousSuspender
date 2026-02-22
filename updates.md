# Changelog

## 8.1.5
- **Performance**: Increased concurrent tab suspensions and reduced queue processing delay to fix a 10-second delay during bulk tab suspension.
- **Cleanup**: Removed legacy session-management entry points and repointed old page links to the Recovery page.
- **UX**: Enhanced the Excluded URLs page with recheck/cleanup controls.
- **Cleanup**: Reduced service worker console log bloat by filtering diagnostics to high-signal events only.
