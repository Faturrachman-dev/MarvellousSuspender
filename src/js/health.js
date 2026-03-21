import  { gsChrome }              from './gsChrome.js';
import  { gsUtils }               from './gsUtils.js';

(() => {
  'use strict';

  const HEARTBEAT_TIMEOUT_MS = 1200;

  let healthScanBtn;
  let healthRecoverAllBtn;
  let healthSummary;
  let healthFeedback;
  let healthEmpty;
  let healthTableWrap;
  let healthTableBody;

  /** @type {{tabId:number, title:string, status:string, originalUrl:string, recoverable:boolean}[]} */
  let lastResults = [];

  function setFeedback(message, isError) {
    healthFeedback.textContent = message || '';
    healthFeedback.className = isError ? 'health-feedback error' : 'health-feedback';
  }

  function setBusy(isBusy) {
    healthScanBtn.disabled = isBusy;
    healthScanBtn.textContent = isBusy ? 'Scanning...' : 'Run health check';
  }

  async function sendPing(tabId) {
    return await new Promise(resolve => {
      let resolved = false;

      const complete = value => {
        if (resolved) {
          return;
        }
        resolved = true;
        resolve(value);
      };

      const timeoutId = setTimeout(() => {
        complete(false);
      }, HEARTBEAT_TIMEOUT_MS);

      const responseHandler = response => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          complete(false);
          return;
        }
        complete(Boolean(response && response.alive));
      };

      try {
        chrome.tabs.sendMessage(tabId, { action: 'ping' }, { frameId: 0 }, responseHandler);
      }
      catch {
        clearTimeout(timeoutId);
        complete(false);
      }
    });
  }

  function classifySuspendedTab(tab, isAlive) {
    const title = typeof tab.title === 'string' && tab.title.trim() !== '' ? tab.title : 'Untitled tab';
    const looksSuspicious = tab.status === 'loading' || title === 'Untitled tab' || title === '...';
    const originalUrl = gsUtils.getOriginalUrl(tab.url) || '';

    if (isAlive) {
      return {
        tabId: tab.id,
        title,
        status: 'healthy',
        originalUrl,
        recoverable: false,
      };
    }

    if (looksSuspicious) {
      return {
        tabId: tab.id,
        title,
        status: 'broken',
        originalUrl,
        recoverable: Boolean(originalUrl),
      };
    }

    return {
      tabId: tab.id,
      title,
      status: 'unreachable',
      originalUrl,
      recoverable: false,
    };
  }

  function getStatusLabel(status) {
    if (status === 'healthy') {
      return 'Healthy';
    }
    if (status === 'broken') {
      return 'Broken';
    }
    return 'Unreachable';
  }

  function renderResults(results) {
    healthTableBody.innerHTML = '';

    if (results.length === 0) {
      healthEmpty.style.display = '';
      healthTableWrap.style.display = 'none';
      healthSummary.textContent = 'No suspended tabs to check.';
      healthRecoverAllBtn.disabled = true;
      return;
    }

    healthEmpty.style.display = 'none';
    healthTableWrap.style.display = '';

    let healthyCount = 0;
    let brokenCount = 0;
    let recoverableCount = 0;

    for (const result of results) {
      if (result.status === 'healthy') {
        healthyCount += 1;
      }
      if (result.status === 'broken') {
        brokenCount += 1;
      }
      if (result.recoverable) {
        recoverableCount += 1;
      }

      const row = document.createElement('tr');

      const tabCell = document.createElement('td');
      const titleEl = document.createElement('div');
      titleEl.className = 'health-tab-title';
      titleEl.textContent = result.title;
      const metaEl = document.createElement('div');
      metaEl.className = 'health-meta';
      metaEl.textContent = `Tab ID: ${result.tabId}`;
      tabCell.appendChild(titleEl);
      tabCell.appendChild(metaEl);

      const statusCell = document.createElement('td');
      const statusEl = document.createElement('span');
      statusEl.className = `health-status ${result.status}`;
      statusEl.textContent = getStatusLabel(result.status);
      statusCell.appendChild(statusEl);

      const urlCell = document.createElement('td');
      urlCell.className = 'health-url';
      urlCell.textContent = result.originalUrl || '(No recoverable original URL found)';

      const actionCell = document.createElement('td');
      const recoverBtn = document.createElement('button');
      recoverBtn.className = 'btn btn-secondary health-recover-btn';
      recoverBtn.textContent = 'Recover';
      recoverBtn.disabled = !result.recoverable;
      recoverBtn.addEventListener('click', async () => {
        await recoverOne(result.tabId, result.originalUrl);
      });
      actionCell.appendChild(recoverBtn);

      row.appendChild(tabCell);
      row.appendChild(statusCell);
      row.appendChild(urlCell);
      row.appendChild(actionCell);
      healthTableBody.appendChild(row);
    }

    healthSummary.textContent = `Scanned ${results.length} suspended tab(s): ${healthyCount} healthy, ${brokenCount} broken, ${recoverableCount} recoverable.`;
    healthRecoverAllBtn.disabled = recoverableCount === 0;
  }

  async function runHealthCheck() {
    setBusy(true);
    setFeedback('', false);

    try {
      const extensionTabs = await gsChrome.tabsQuery({
        url: `chrome-extension://${chrome.runtime.id}/*`,
      });
      const suspendedTabs = extensionTabs.filter(tab => gsUtils.isSuspendedTab(tab, true));

      const results = [];
      for (const tab of suspendedTabs) {
        const isAlive = await sendPing(tab.id);
        results.push(classifySuspendedTab(tab, isAlive));
      }

      lastResults = results;
      renderResults(results);
    }
    catch (error) {
      setFeedback('Health check failed. See extension console for details.', true);
      gsUtils.warning('health', error);
    }
    finally {
      setBusy(false);
    }
  }

  async function recoverOne(tabId, originalUrl) {
    if (!originalUrl) {
      setFeedback('Cannot recover this tab because no original URL was found.', true);
      return;
    }

    const updatedTab = await gsChrome.tabsUpdate(tabId, { url: originalUrl });
    if (!updatedTab) {
      setFeedback(`Recovery failed for tab ${tabId}. It may already be closed.`, true);
      return;
    }

    setFeedback(`Recovered tab ${tabId}.`, false);
    await runHealthCheck();
  }

  async function recoverAll() {
    const recoverable = lastResults.filter(result => result.recoverable);
    if (recoverable.length === 0) {
      setFeedback('No recoverable broken tabs found.', true);
      return;
    }

    let recoveredCount = 0;
    for (const result of recoverable) {
      const updatedTab = await gsChrome.tabsUpdate(result.tabId, { url: result.originalUrl });
      if (updatedTab) {
        recoveredCount += 1;
      }
    }

    setFeedback(`Recovered ${recoveredCount} tab(s).`, false);
    await runHealthCheck();
  }

  async function init() {
    healthScanBtn = document.getElementById('healthScanBtn');
    healthRecoverAllBtn = document.getElementById('healthRecoverAllBtn');
    healthSummary = document.getElementById('healthSummary');
    healthFeedback = document.getElementById('healthFeedback');
    healthEmpty = document.getElementById('healthEmpty');
    healthTableWrap = document.getElementById('healthTableWrap');
    healthTableBody = document.getElementById('healthTableBody');

    healthScanBtn.addEventListener('click', runHealthCheck);
    healthRecoverAllBtn.addEventListener('click', recoverAll);

    if (chrome.extension.inIncognitoContext) {
      Array.prototype.forEach.call(
        document.getElementsByClassName('noIncognito'),
        function(el) {
          el.style.display = 'none';
        },
      );
    }

    await runHealthCheck();
  }

  gsUtils.documentReadyAndLocalisedAsPromised(window).then(init);
})();
