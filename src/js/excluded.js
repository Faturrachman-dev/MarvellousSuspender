// @ts-check
/**
 * excluded.js — Controller for the "Excluded URLs" management page.
 *
 * Reads and writes the whitelist from gsStorage.WHITELIST using
 * exclusionUtils for all matching / parsing logic.
 */
import { gsStorage }      from './gsStorage.js';
import { gsUtils }        from './gsUtils.js';
import { exclusionUtils } from './exclusionUtils.js';

(() => {
  'use strict';

  // -------------------------------------------------------------------------
  // DOM refs — populated after DOMContentLoaded
  // -------------------------------------------------------------------------
  let elNewEntry, elMatchType, elAddBtn, elAddFromCurrentBtn, elAddFeedback;
  let elTestUrl, elTestBtn, elTestResult;
  let elRuleList, elRuleCount, elEmptyState, elClearAllBtn;
  let elConfirmOverlay, elConfirmMsg, elConfirmOk, elConfirmCancel;

  let pendingConfirmCallback = null;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Reads the raw whitelist string from storage. */
  async function getWhitelist() {
    return (await gsStorage.getOption(gsStorage.WHITELIST)) || '';
  }

  /** Persists the updated whitelist string and optionally notifies tgs. */
  async function saveWhitelist(newList) {
    const oldList = await getWhitelist();
    await gsStorage.setOptionAndSync(gsStorage.WHITELIST, newList);
    gsUtils.performPostSaveUpdates(
      [gsStorage.WHITELIST],
      { [gsStorage.WHITELIST]: oldList },
      { [gsStorage.WHITELIST]: newList },
    );
  }

  /** Shows a temporary feedback message. */
  function showFeedback(el, message, isError = false) {
    el.textContent = message;
    el.className = 'ex-feedback ' + (isError ? 'ex-feedback--error' : 'ex-feedback--success');
    clearTimeout(el._feedbackTimer);
    el._feedbackTimer = setTimeout(() => { el.textContent = ''; el.className = 'ex-feedback'; }, 3000);
  }

  /** Builds a clean entry string from the input + match-type selector. */
  function buildEntryStringFromInputs(rawInput, matchType) {
    const trimmed = rawInput.trim();
    if (!trimmed) return null;

    // If the user already typed a URL (starts with http/https), auto-convert to the chosen type.
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (matchType === 'regex') return null; // user must type regex manually
      return exclusionUtils.buildEntryFromUrl(trimmed, matchType);
    }

    // For regex mode, ensure the user has wrapped in / /
    if (matchType === 'regex') {
      const entry = trimmed.startsWith('/') && trimmed.endsWith('/') ? trimmed : `/${trimmed}/`;
      // Validate
      try { new RegExp(entry.slice(1, -1)); } catch { return null; }
      return entry;
    }

    return trimmed;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  async function render() {
    const whitelist = await getWhitelist();
    const entries   = exclusionUtils.parseWhitelistEntries(whitelist);

    elRuleList.innerHTML = '';

    if (entries.length === 0) {
      elEmptyState.style.display = '';
      elClearAllBtn.style.display = 'none';
      elRuleCount.textContent = '';
    } else {
      elEmptyState.style.display = 'none';
      elClearAllBtn.style.display = '';
      elRuleCount.textContent = `(${entries.length})`;

      entries.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'ex-rule-item';
        li.dataset.raw = entry.raw;

        const badge = document.createElement('span');
        badge.className = `ex-badge ex-badge--${entry.type}`;
        badge.textContent = {
          'regex':          'regex',
          'domain-wildcard': 'domain',
          'exact-page':     'exact',
          'contains':       'contains',
        }[entry.type] || entry.type;

        const label = document.createElement('span');
        label.className = 'ex-rule-label';
        label.textContent = (() => {
          if (entry.type === 'domain-wildcard') return entry.raw.slice(2); // strip *.
          if (entry.type === 'regex')           return entry.raw;
          return entry.raw;
        })();
        label.title = entry.raw;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'ex-remove-btn';
        removeBtn.title = 'Remove this rule';
        removeBtn.innerHTML = '<i class="icon icon-cancel"></i>';
        removeBtn.addEventListener('click', () => confirmRemove(entry.raw));

        li.append(badge, label, removeBtn);
        elRuleList.appendChild(li);
      });
    }
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  async function addRule() {
    const rawInput  = elNewEntry.value;
    const matchType = elMatchType.value;
    const entry     = buildEntryStringFromInputs(rawInput, matchType);

    if (!entry) {
      showFeedback(elAddFeedback, matchType === 'regex'
        ? 'Invalid regex pattern. Ensure it is wrapped in /slashes/ and is valid.'
        : 'Please enter a URL or pattern.',
      true);
      return;
    }

    const currentList = await getWhitelist();

    // Duplicate check
    const existing = exclusionUtils.parseWhitelistEntries(currentList).map(e => e.raw);
    if (existing.includes(entry)) {
      showFeedback(elAddFeedback, 'This rule already exists.', true);
      return;
    }

    const newList = exclusionUtils.addEntry(currentList, entry);
    await saveWhitelist(newList);
    elNewEntry.value = '';
    showFeedback(elAddFeedback, `Rule added: "${entry}"`);
    await render();
  }

  async function removeRule(rawEntry) {
    const currentList = await getWhitelist();
    const newList     = exclusionUtils.removeEntry(currentList, rawEntry);
    await saveWhitelist(newList);
    await render();
  }

  async function clearAll() {
    await saveWhitelist('');
    await render();
  }

  function confirmRemove(rawEntry) {
    elConfirmMsg.textContent = `Remove rule "${rawEntry}"?`;
    pendingConfirmCallback = () => removeRule(rawEntry);
    elConfirmOverlay.style.display = '';
  }

  function confirmClearAll() {
    elConfirmMsg.textContent = 'Remove ALL exclusion rules? This cannot be undone.';
    pendingConfirmCallback = clearAll;
    elConfirmOverlay.style.display = '';
  }

  // -------------------------------------------------------------------------
  // Test
  // -------------------------------------------------------------------------

  async function runTest() {
    const url       = elTestUrl.value.trim();
    const whitelist = await getWhitelist();

    if (!url) {
      elTestResult.textContent = 'Enter a URL to test.';
      elTestResult.className = 'ex-test-result';
      return;
    }

    const matched = exclusionUtils.matchesWhitelist(url, whitelist);
    if (matched) {
      // Find which rule(s) matched
      const matchingRules = exclusionUtils.parseWhitelistEntries(whitelist)
        .filter(e => exclusionUtils.testForMatch(e.raw, url))
        .map(e => `"${e.raw}"`);
      elTestResult.textContent = `✓ EXCLUDED — matched by: ${matchingRules.join(', ')}`;
      elTestResult.className = 'ex-test-result ex-test-result--match';
    } else {
      elTestResult.textContent = '✗ NOT excluded — this tab would be eligible for suspension.';
      elTestResult.className = 'ex-test-result ex-test-result--no-match';
    }
  }

  // -------------------------------------------------------------------------
  // Fill from current tab
  // -------------------------------------------------------------------------

  async function fillFromCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome') || tab.url.startsWith('about')) {
      showFeedback(elAddFeedback, 'Cannot get URL for this tab.', true);
      return;
    }
    elNewEntry.value = tab.url;
    // Auto-detect best match type
    elMatchType.value = 'domain';
    elNewEntry.focus();
    elNewEntry.select();
  }

  // -------------------------------------------------------------------------
  // Pre-fill from URL query params (e.g., from popup: ?url=https://…&type=domain)
  // -------------------------------------------------------------------------

  function applyQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const url    = params.get('url');
    const type   = params.get('type');
    if (url) {
      elNewEntry.value  = url;
      elMatchType.value = type || 'domain';
      elNewEntry.focus();
    }
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------

  async function init() {
    elNewEntry          = document.getElementById('exNewEntry');
    elMatchType         = document.getElementById('exMatchType');
    elAddBtn            = document.getElementById('exAddBtn');
    elAddFromCurrentBtn = document.getElementById('exAddFromCurrentBtn');
    elAddFeedback       = document.getElementById('exAddFeedback');
    elTestUrl           = document.getElementById('exTestUrl');
    elTestBtn           = document.getElementById('exTestBtn');
    elTestResult        = document.getElementById('exTestResult');
    elRuleList          = document.getElementById('exRuleList');
    elRuleCount         = document.getElementById('exRuleCount');
    elEmptyState        = document.getElementById('exEmptyState');
    elClearAllBtn       = document.getElementById('exClearAllBtn');
    elConfirmOverlay    = document.getElementById('exConfirmOverlay');
    elConfirmMsg        = document.getElementById('exConfirmMsg');
    elConfirmOk         = document.getElementById('exConfirmOk');
    elConfirmCancel     = document.getElementById('exConfirmCancel');

    elAddBtn.addEventListener('click', addRule);
    elAddFromCurrentBtn.addEventListener('click', fillFromCurrentTab);
    elClearAllBtn.addEventListener('click', confirmClearAll);
    elTestBtn.addEventListener('click', runTest);
    elTestUrl.addEventListener('keydown', e => { if (e.key === 'Enter') runTest(); });
    elNewEntry.addEventListener('keydown', e => { if (e.key === 'Enter') addRule(); });

    elConfirmOk.addEventListener('click', async () => {
      elConfirmOverlay.style.display = 'none';
      if (pendingConfirmCallback) {
        await pendingConfirmCallback();
        pendingConfirmCallback = null;
      }
    });
    elConfirmCancel.addEventListener('click', () => {
      elConfirmOverlay.style.display = 'none';
      pendingConfirmCallback = null;
    });

    // Apply theme
    const theme = await gsStorage.getOption(gsStorage.THEME);
    if (theme === 'dark') document.body.classList.add('dark');

    applyQueryParams();
    await render();

    // Make page visible after init (the body starts hidden via style.css)
    document.body.style.visibility = 'visible';
  }

  gsUtils.documentReadyAsPromised(document).then(init);
})();
