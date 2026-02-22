/**
 * exclusionUtils.js
 *
 * Pure utility functions for URL exclusion / whitelist matching.
 * NO browser or Chrome API dependencies — safe to import in unit tests.
 *
 * Match types supported:
 *   regex         — entry wrapped in /slashes/   e.g.  /github\.com\/.*\/issues/
 *   domain-wildcard — starts with *.            e.g.  *.google.com
 *   exact-page    — starts with http:// or https://   e.g.  https://mail.google.com/
 *   contains      — plain substring             e.g.  docs.google
 */

'use strict';

export const exclusionUtils = {

  /**
   * Tests a single whitelist entry against a URL.
   * @param {string} entry  The whitelist rule (raw string).
   * @param {string} url    The URL to test.
   * @returns {boolean}
   */
  testForMatch(entry, url) {
    if (!entry || entry.length < 1) return false;

    // --- Regex pattern: /pattern/ ---
    if (entry.length > 2 && entry.startsWith('/') && entry.endsWith('/')) {
      const pattern = entry.slice(1, -1);
      try {
        return new RegExp(pattern).test(url);
      } catch {
        return false; // invalid regex → safe no-match
      }
    }

    // --- Domain wildcard: *.example.com ---
    if (entry.startsWith('*.')) {
      const domain = entry.slice(2); // e.g. "example.com"
      try {
        const parsed = new URL(url);
        const host = parsed.hostname;
        return host === domain || host.endsWith('.' + domain);
      } catch {
        return false;
      }
    }

    // --- Default: case-insensitive substring match ---
    return url.toLowerCase().includes(entry.toLowerCase());
  },

  /**
   * Returns true if at least one entry in the whitelist string matches the URL.
   * @param {string} url
   * @param {string} whitelistString  Newline/whitespace-separated entries.
   * @returns {boolean}
   */
  matchesWhitelist(url, whitelistString) {
    if (!url || !whitelistString) return false;
    const entries = whitelistString.split(/[\s\n]+/).filter(Boolean);
    return entries.some(entry => exclusionUtils.testForMatch(entry, url));
  },

  /**
   * Parses a raw whitelist string into an array of structured rule objects.
   * @param {string} whitelistString
   * @returns {Array<{raw: string, type: string, displayLabel: string}>}
   */
  parseWhitelistEntries(whitelistString) {
    if (!whitelistString) return [];
    return whitelistString
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(entry => ({
        raw: entry,
        type: exclusionUtils.detectMatchType(entry),
        displayLabel: exclusionUtils.getDisplayLabel(entry),
      }));
  },

  /**
   * Detects match type for a single entry.
   * @param {string} entry
   * @returns {'regex' | 'domain-wildcard' | 'exact-page' | 'contains'}
   */
  detectMatchType(entry) {
    if (entry.startsWith('/') && entry.endsWith('/')) return 'regex';
    if (entry.startsWith('*.'))                        return 'domain-wildcard';
    if (entry.startsWith('http://') || entry.startsWith('https://')) return 'exact-page';
    return 'contains';
  },

  /**
   * Returns a human-readable label for a whitelist entry.
   */
  getDisplayLabel(entry) {
    const type = exclusionUtils.detectMatchType(entry);
    switch (type) {
      case 'regex':          return `Regex: ${entry}`;
      case 'domain-wildcard': return `Domain: ${entry.slice(2)}`;
      case 'exact-page':     return `Exact page: ${entry}`;
      default:               return `Contains: ${entry}`;
    }
  },

  /**
   * Builds a whitelist entry string from a URL + desired match type.
   * @param {string} url
   * @param {'domain' | 'exact' | 'contains'} matchType
   * @returns {string}
   */
  buildEntryFromUrl(url, matchType) {
    try {
      const parsed = new URL(url);
      if (matchType === 'domain')   return `*.${parsed.hostname}`;
      if (matchType === 'exact')    return url.split('#')[0]; // strip fragment
      return parsed.hostname;                                  // 'contains' default
    } catch {
      return url;
    }
  },

  /**
   * Adds a new entry to a whitelist string, deduplicating and sorting.
   * @param {string} currentWhitelist
   * @param {string} newEntry
   * @returns {string}
   */
  addEntry(currentWhitelist, newEntry) {
    const entries = new Set(
      (currentWhitelist || '').split('\n').map(s => s.trim()).filter(Boolean)
    );
    entries.add(newEntry.trim());
    return [...entries].sort().join('\n');
  },

  /**
   * Removes entries that match the given entry exactly, returning the new list string.
   * @param {string} currentWhitelist
   * @param {string} entryToRemove
   * @returns {string}
   */
  removeEntry(currentWhitelist, entryToRemove) {
    const entries = (currentWhitelist || '').split('\n')
      .map(s => s.trim())
      .filter(s => s && s !== entryToRemove.trim());
    return entries.join('\n');
  },
};
