/**
 * Unit tests for the suspension eligibility logic.
 *
 * These functions are extracted here as pure-function imports to
 * avoid pulling in the full Chrome extension context.  They mirror
 * the logic inside gsTabSuspendManager.js so any logic change must
 * be reflected in both places.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Inline the pure eligibility helpers so they are testable without Chrome APIs
// ---------------------------------------------------------------------------

const STATUS_FORMINPUT    = 'formInput';
const STATUS_TEMPWHITELIST = 'tempWhitelist';
const STATUS_NORMAL        = 'normal';
const STATUS_UNKNOWN       = 'unknown';

/**
 * Pure function mirroring gsTabSuspendManager.checkContentScriptEligibilityForSuspension
 *
 * Returns false (not eligible) when:
 *   - forceLevel >= 2  AND  contentScriptStatus is formInput or tempWhitelist
 *   - contentScriptStatus is null (content script unreachable) AND forceLevel >= 2  [FAIL-SAFE]
 */
function checkContentScriptEligibility(contentScriptStatus, forceLevel) {
  // FAIL-SAFE: if content script is unreachable in auto/soft mode, do NOT suspend
  if (contentScriptStatus === null && forceLevel >= 2) {
    return false;
  }
  if (
    forceLevel >= 2 &&
    (contentScriptStatus === STATUS_FORMINPUT ||
      contentScriptStatus === STATUS_TEMPWHITELIST)
  ) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// checkContentScriptEligibility
// ---------------------------------------------------------------------------

describe('checkContentScriptEligibility', () => {

  describe('forceLevel 1 (manual force — bypasses user prefs)', () => {
    it('allows suspension even when formInput is detected', () => {
      expect(checkContentScriptEligibility(STATUS_FORMINPUT, 1)).toBe(true);
    });

    it('allows suspension even when tab is temp-whitelisted', () => {
      expect(checkContentScriptEligibility(STATUS_TEMPWHITELIST, 1)).toBe(true);
    });

    it('allows suspension when content script is unreachable (no fail-safe at level 1)', () => {
      expect(checkContentScriptEligibility(null, 1)).toBe(true);
    });

    it('allows suspension for normal status', () => {
      expect(checkContentScriptEligibility(STATUS_NORMAL, 1)).toBe(true);
    });
  });

  describe('forceLevel 2 (soft/bulk — respects user preferences)', () => {
    it('blocks suspension when formInput is detected', () => {
      expect(checkContentScriptEligibility(STATUS_FORMINPUT, 2)).toBe(false);
    });

    it('blocks suspension when tab is temp-whitelisted', () => {
      expect(checkContentScriptEligibility(STATUS_TEMPWHITELIST, 2)).toBe(false);
    });

    it('FAIL-SAFE: blocks suspension when content script is unreachable (null)', () => {
      expect(checkContentScriptEligibility(null, 2)).toBe(false);
    });

    it('allows suspension for normal status', () => {
      expect(checkContentScriptEligibility(STATUS_NORMAL, 2)).toBe(true);
    });

    it('allows suspension for unknown status (only null triggers fail-safe)', () => {
      // unknown means "content script loaded but returned unknown state" — allow suspend
      expect(checkContentScriptEligibility(STATUS_UNKNOWN, 2)).toBe(true);
    });
  });

  describe('forceLevel 3 (auto-timer — full protection)', () => {
    it('blocks suspension when formInput is detected', () => {
      expect(checkContentScriptEligibility(STATUS_FORMINPUT, 3)).toBe(false);
    });

    it('blocks suspension when temp-whitelisted', () => {
      expect(checkContentScriptEligibility(STATUS_TEMPWHITELIST, 3)).toBe(false);
    });

    it('FAIL-SAFE: blocks suspension when content script is unreachable (null)', () => {
      expect(checkContentScriptEligibility(null, 3)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Force level semantics (documenting expected behaviour)
// what each level protects (integration-style documentation tests)
// ---------------------------------------------------------------------------

describe('Force level contract', () => {
  it('level 1 — overrides all content-script-based protections', () => {
    [STATUS_FORMINPUT, STATUS_TEMPWHITELIST, null, STATUS_NORMAL].forEach(status => {
      // At force level 1, content script state never blocks suspension
      const result = checkContentScriptEligibility(status, 1);
      expect(result).toBe(true);
    });
  });

  it('level 2 — blocks on form input, temp whitelist, and unreachable content script', () => {
    expect(checkContentScriptEligibility(STATUS_FORMINPUT,    2)).toBe(false);
    expect(checkContentScriptEligibility(STATUS_TEMPWHITELIST, 2)).toBe(false);
    expect(checkContentScriptEligibility(null,                2)).toBe(false);
    expect(checkContentScriptEligibility(STATUS_NORMAL,       2)).toBe(true);
  });

  it('level 3 — same protection as level 2 for content-script checks', () => {
    expect(checkContentScriptEligibility(STATUS_FORMINPUT,    3)).toBe(false);
    expect(checkContentScriptEligibility(STATUS_TEMPWHITELIST, 3)).toBe(false);
    expect(checkContentScriptEligibility(null,                3)).toBe(false);
    expect(checkContentScriptEligibility(STATUS_NORMAL,       3)).toBe(true);
  });
});
