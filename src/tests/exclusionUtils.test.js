/**
 * Unit tests for exclusionUtils.js
 *
 * Tests cover:
 *  - testForMatch: all four match types
 *  - matchesWhitelist: single + multi-entry lists
 *  - parseWhitelistEntries: type detection
 *  - buildEntryFromUrl: domain / exact / contains
 *  - addEntry / removeEntry: mutation helpers
 *  - Edge cases: empty inputs, invalid regex, case sensitivity
 */

import { describe, it, expect } from 'vitest';
import { exclusionUtils } from '../js/exclusionUtils.js';

// ---------------------------------------------------------------------------
// testForMatch
// ---------------------------------------------------------------------------

describe('exclusionUtils.testForMatch', () => {

  describe('regex match (/pattern/)', () => {
    it('matches a URL with a valid regex', () => {
      expect(exclusionUtils.testForMatch('/github\\.com/', 'https://github.com')).toBe(true);
    });

    it('does not match a URL that fails the regex', () => {
      expect(exclusionUtils.testForMatch('/github\\.com/', 'https://gitlab.com')).toBe(false);
    });

    it('returns false for invalid regex instead of throwing', () => {
      expect(exclusionUtils.testForMatch('/[invalid(/', 'https://example.com')).toBe(false);
    });

    it('matches path patterns', () => {
      expect(exclusionUtils.testForMatch('/\\/issues$/', 'https://github.com/user/repo/issues')).toBe(true);
      expect(exclusionUtils.testForMatch('/\\/issues$/', 'https://github.com/user/repo/pulls')).toBe(false);
    });
  });

  describe('domain wildcard (*.domain)', () => {
    it('matches exact domain', () => {
      expect(exclusionUtils.testForMatch('*.google.com', 'https://google.com')).toBe(true);
    });

    it('matches subdomain', () => {
      expect(exclusionUtils.testForMatch('*.google.com', 'https://mail.google.com')).toBe(true);
    });

    it('matches deep subdomain', () => {
      expect(exclusionUtils.testForMatch('*.google.com', 'https://drive.docs.google.com')).toBe(true);
    });

    it('does NOT match a different domain that happens to contain the string', () => {
      expect(exclusionUtils.testForMatch('*.google.com', 'https://notgoogle.com')).toBe(false);
    });

    it('does NOT match a partial hostname suffix', () => {
      expect(exclusionUtils.testForMatch('*.oogle.com', 'https://google.com')).toBe(false);
    });

    it('returns false for malformed URL', () => {
      expect(exclusionUtils.testForMatch('*.google.com', 'not-a-url')).toBe(false);
    });
  });

  describe('substring / contains match', () => {
    it('matches if URL contains the string (case-insensitive)', () => {
      expect(exclusionUtils.testForMatch('docs.google', 'https://docs.google.com/document/d/123')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(exclusionUtils.testForMatch('DOCS.GOOGLE', 'https://docs.google.com')).toBe(true);
    });

    it('does not match if the substring is absent', () => {
      expect(exclusionUtils.testForMatch('github', 'https://gitlab.com')).toBe(false);
    });

    it('returns false for empty entry', () => {
      expect(exclusionUtils.testForMatch('', 'https://example.com')).toBe(false);
    });

    it('returns false for null entry', () => {
      expect(exclusionUtils.testForMatch(null, 'https://example.com')).toBe(false);
    });
  });

  describe('exact-page match (starts with http/https)', () => {
    it('matches when entry is a substring of URL (inherits contains logic)', () => {
      // exact-page entries still use substring matching; the "exact" concept is conveyed
      // via the UI – the raw value stored is the full URL, so it will match all variants.
      expect(exclusionUtils.testForMatch('https://mail.google.com/', 'https://mail.google.com/')).toBe(true);
    });

    it('does not match a different origin', () => {
      expect(exclusionUtils.testForMatch('https://mail.google.com/', 'https://drive.google.com/')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// matchesWhitelist
// ---------------------------------------------------------------------------

describe('exclusionUtils.matchesWhitelist', () => {

  it('returns false for empty whitelist', () => {
    expect(exclusionUtils.matchesWhitelist('https://example.com', '')).toBe(false);
  });

  it('returns false for null whitelist', () => {
    expect(exclusionUtils.matchesWhitelist('https://example.com', null)).toBe(false);
  });

  it('returns false for null url', () => {
    expect(exclusionUtils.matchesWhitelist(null, 'example.com')).toBe(false);
  });

  it('matches single-entry whitelist', () => {
    expect(exclusionUtils.matchesWhitelist('https://github.com', 'github.com')).toBe(true);
  });

  it('matches when one of multiple entries matches', () => {
    const whitelist = 'gmail.com\ngithub.com\ndocs.google';
    expect(exclusionUtils.matchesWhitelist('https://github.com/dashboard', whitelist)).toBe(true);
  });

  it('returns false when no entry matches', () => {
    const whitelist = 'gmail.com\ngithub.com';
    expect(exclusionUtils.matchesWhitelist('https://gitlab.com', whitelist)).toBe(false);
  });

  it('ignores blank lines in whitelist', () => {
    const whitelist = '\n\ngithub.com\n\n';
    expect(exclusionUtils.matchesWhitelist('https://github.com', whitelist)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectMatchType
// ---------------------------------------------------------------------------

describe('exclusionUtils.detectMatchType', () => {
  it('detects regex', () => {
    expect(exclusionUtils.detectMatchType('/pattern/')).toBe('regex');
  });

  it('detects domain-wildcard', () => {
    expect(exclusionUtils.detectMatchType('*.example.com')).toBe('domain-wildcard');
  });

  it('detects exact-page with https', () => {
    expect(exclusionUtils.detectMatchType('https://mail.google.com/')).toBe('exact-page');
  });

  it('detects exact-page with http', () => {
    expect(exclusionUtils.detectMatchType('http://localhost:3000')).toBe('exact-page');
  });

  it('defaults to contains', () => {
    expect(exclusionUtils.detectMatchType('google.com')).toBe('contains');
  });
});

// ---------------------------------------------------------------------------
// buildEntryFromUrl
// ---------------------------------------------------------------------------

describe('exclusionUtils.buildEntryFromUrl', () => {
  it('builds a domain wildcard entry', () => {
    expect(exclusionUtils.buildEntryFromUrl('https://mail.google.com/u/0/', 'domain'))
      .toBe('*.mail.google.com');
  });

  it('builds an exact-page entry stripping fragment', () => {
    expect(exclusionUtils.buildEntryFromUrl('https://example.com/path?q=1#section', 'exact'))
      .toBe('https://example.com/path?q=1');
  });

  it('builds a contains entry using hostname', () => {
    expect(exclusionUtils.buildEntryFromUrl('https://docs.google.com/doc/d/123', 'contains'))
      .toBe('docs.google.com');
  });

  it('falls back to raw url for invalid input', () => {
    expect(exclusionUtils.buildEntryFromUrl('not-a-url', 'domain')).toBe('not-a-url');
  });
});

// ---------------------------------------------------------------------------
// addEntry / removeEntry
// ---------------------------------------------------------------------------

describe('exclusionUtils.addEntry', () => {
  it('adds an entry to an empty whitelist', () => {
    expect(exclusionUtils.addEntry('', 'github.com')).toBe('github.com');
  });

  it('adds an entry without duplicating', () => {
    const result = exclusionUtils.addEntry('github.com', 'github.com');
    expect(result.split('\n').filter(Boolean)).toHaveLength(1);
  });

  it('sorts entries alphabetically', () => {
    const result = exclusionUtils.addEntry('github.com', 'apple.com');
    expect(result).toBe('apple.com\ngithub.com');
  });
});

describe('exclusionUtils.removeEntry', () => {
  it('removes an existing entry', () => {
    const result = exclusionUtils.removeEntry('github.com\ngitlab.com', 'github.com');
    expect(result).toBe('gitlab.com');
  });

  it('is a no-op if entry does not exist', () => {
    const result = exclusionUtils.removeEntry('github.com', 'bitbucket.org');
    expect(result).toBe('github.com');
  });

  it('handles empty whitelist gracefully', () => {
    expect(exclusionUtils.removeEntry('', 'github.com')).toBe('');
  });
});
