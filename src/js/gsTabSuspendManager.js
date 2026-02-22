import  { gsChrome }              from './gsChrome.js';
import  { gsMessages }            from './gsMessages.js';
import  { gsStorage }             from './gsStorage.js';
import  { gsTabCheckManager }     from './gsTabCheckManager.js';
import  { gsTabDiscardManager }   from './gsTabDiscardManager.js';
import  { gsTabQueue }            from './gsTabQueue.js';
import  { gsUtils }               from './gsUtils.js';
import  { tgs }                   from './tgs.js';

export const gsTabSuspendManager = (function() {
  'use strict';

  const DEFAULT_CONCURRENT_SUSPENSIONS = 3;
  const DEFAULT_SUSPENSION_TIMEOUT = 60 * 1000;

  const QUEUE_ID = 'suspensionQueue';

  let _suspensionQueue;

  function initAsPromised() {
    return new Promise(function(resolve) {
      // Screen capture removed — use fixed concurrency / timeout values.
      const queueProps = {
        concurrentExecutors: DEFAULT_CONCURRENT_SUSPENSIONS,
        jobTimeout: DEFAULT_SUSPENSION_TIMEOUT,
        executorFn: performSuspension,
        exceptionFn: handleSuspensionException,
      };
      _suspensionQueue = gsTabQueue.init(QUEUE_ID, queueProps);
      gsUtils.log(QUEUE_ID, 'init successful');
      resolve();
    });
  }

  function queueTabForSuspension(tab, forceLevel) {
    queueTabForSuspensionAsPromise(tab, forceLevel).catch(e => {
      gsUtils.log(tab.id, QUEUE_ID, e);
    });
  }

  async function queueTabForSuspensionAsPromise(tab, forceLevel) {
    if (typeof tab === 'undefined') return Promise.resolve();

    if (!await checkTabEligibilityForSuspension(tab, forceLevel)) {
      gsUtils.log(tab.id, QUEUE_ID, 'Tab not eligible for suspension.');
      return Promise.resolve();
    }

    gsUtils.log(tab.id, QUEUE_ID, 'queueTabForSuspensionAsPromise');
    return _suspensionQueue.queueTabAsPromise(tab, { forceLevel });
  }

  function unqueueTabForSuspension(tab) {
    const removed = _suspensionQueue.unqueueTab(tab);
    if (removed) {
      gsUtils.log(tab.id, QUEUE_ID, 'Removed tab from suspension queue.');
    }
  }

  async function performSuspension( tab, executionProps, resolve, reject, requeue, ) {
    if (executionProps.refetchTab || gsUtils.isSuspendedTab(tab)) {
      gsUtils.log( tab.id, QUEUE_ID, 'Tab refetch required. Getting updated tab..' );
      const _tab = await gsChrome.tabsGet(tab.id);
      if (!_tab) {
        gsUtils.log( tab.id, QUEUE_ID, 'Could not find tab with id. Will ignore suspension request' );
        resolve(false);
        return;
      }
      tab = _tab;
    }

    if (gsUtils.isSuspendedTab(tab)) {
      if (!executionProps.refetchTab) {
        gsUtils.log( tab.id, QUEUE_ID, 'Tab is already suspended. Will check again in 3 seconds' );
        requeue(3000, { refetchTab: true });
      } else {
        gsUtils.log( tab.id, QUEUE_ID, 'Tab still suspended after 3 seconds. Will ignore tab suspension request' );
        resolve(false);
      }
      return;
    }

    // Query the content script for current tab state (form input, temp whitelist, scroll pos)
    let tabInfo = await getContentScriptTabInfo(tab);

    // FAIL-SAFE: if content script is unreachable in auto/soft mode, do NOT suspend.
    // It is always safer to leave a tab running than risk destroying unsaved form data.
    if (!tabInfo && executionProps.forceLevel >= 2) {
      gsUtils.log( tab.id, QUEUE_ID, 'Content script unresponsive. Skipping suspension (fail-safe).' );
      resolve(false);
      return;
    }

    // For force-level-1 (manual), use safe defaults when content script is unreachable
    tabInfo = tabInfo || { status: 'unknown', scrollPos: '0' };

    const isEligible = checkContentScriptEligibilityForSuspension( tabInfo.status, executionProps.forceLevel, );
    if (!isEligible) {
      gsUtils.log( tab.id, QUEUE_ID, `Content script status of ${ tabInfo.status } not eligible for suspension. Removing tab from suspensionQueue.`, );
      resolve(false);
      return;
    }

    // Append YouTube timestamp to URL if applicable (no DB needed — just a URL param)
    const timestampedUrl = await generateUrlWithYouTubeTimestamp(tab);
    // NOTE: This does not actually change the tab url, just the current tab object
    tab.url = timestampedUrl;

    const suspendedUrl = gsUtils.generateSuspendedUrl( tab.url, tab.title, tabInfo.scrollPos, );
    const success = await executeTabSuspension(tab, suspendedUrl);
    resolve(success);
  }

  function getQueuedTabDetails(tab) {
    return _suspensionQueue.getQueuedTabDetails(tab);
  }

  async function handleSuspensionException( tab, executionProps, exceptionType, resolve, reject, requeue ) {
    if (exceptionType === _suspensionQueue.EXCEPTION_TIMEOUT) {
      gsUtils.log( tab.id, QUEUE_ID, `Tab took more than ${ _suspensionQueue.getQueueProperties().jobTimeout }ms to suspend. Will force suspension.` );
      const success = await executeTabSuspension( tab, executionProps.suspendedUrl, );
      resolve(success);
    } else {
      gsUtils.warning( tab.id, QUEUE_ID, `Failed to suspend tab: ${exceptionType}` );
      resolve(false);
    }
  }

  function executeTabSuspension(tab, suspendedUrl) {
    return new Promise(async (resolve) => {
      // Remove any existing queued tab checks (this can happen if we try to suspend
      // a tab immediately after it gains focus)
      gsTabCheckManager.unqueueTabCheck(tab);

      // If we want tabs to be discarded instead of suspending them
      let discardInPlaceOfSuspend = await gsStorage.getOption(gsStorage.DISCARD_IN_PLACE_OF_SUSPEND);
      if (discardInPlaceOfSuspend) {
        await tgs.clearAutoSuspendTimerForTabId(tab.id);
        gsTabDiscardManager.queueTabForDiscard(tab);
        resolve(true);
        return;
      }

      if (gsUtils.isSuspendedTab(tab, true)) {
        gsUtils.log(tab.id, 'Tab already suspended');
        resolve(false);
        return;
      }

      if (!suspendedUrl) {
        gsUtils.log(tab.id, 'executionProps.suspendedUrl not set!');
        suspendedUrl = gsUtils.generateSuspendedUrl(tab.url, tab.title, 0);
      }

      gsUtils.log(tab.id, 'Suspending tab');
      await tgs.setTabStatePropForTabId( tab.id, tgs.STATE_INITIALISE_SUSPENDED_TAB, true );
      gsChrome.tabsUpdate(tab.id, { url: suspendedUrl }).then(updatedTab => {
        resolve(updatedTab !== null);
      });
    });
  }

  // forceLevel indicates which users preferences to respect when attempting to suspend the tab
  // 1: Suspend if at all possible
  // 2: Respect whitelist, temporary whitelist, form input, pinned tabs, audible preferences, and exclude current active tab
  // 3: Same as above (2), plus also respect internet connectivity, running on battery, and time to suspend=never preferences.
  async function checkTabEligibilityForSuspension(tab, forceLevel) {
    // gsUtils.log(tab.id, 'gsTabSuspendManager', 'checkTabEligibilityForSuspension', forceLevel);
    if (forceLevel >= 1) {
      // if (gsUtils.isSuspendedTab(tab, true) || gsUtils.isSpecialTab(tab)) {
      // actually allow suspended tabs to attempt suspension in case they are
      // in the process of being reloaded and we have changed our mind and
      // want to suspend them again.
      if (gsUtils.isSpecialTab(tab)) {
        return false;
      }
    }
    if (forceLevel >= 2) {
      if (
        (await gsUtils.isProtectedActiveTab(tab)) ||
        (await gsUtils.checkWhiteList(tab.url)) ||
        (await gsUtils.isProtectedPinnedTab(tab)) ||
        (await gsUtils.isProtectedAudibleTab(tab))
      ) {
        return false;
      }
    }
    if (forceLevel >= 3) {
      if (await gsStorage.getOption(gsStorage.IGNORE_WHEN_OFFLINE) && !navigator.onLine) {
        return false;
      }
      // Note: battery check (IGNORE_WHEN_CHARGING) is omitted — navigator.getBattery()
      // is not available in MV3 service workers, making it non-functional.
      if (await gsStorage.getOption(gsStorage.SUSPEND_TIME) === '0') {
        return false;
      }
    }
    return true;
  }

  function checkContentScriptEligibilityForSuspension( contentScriptStatus, forceLevel ) {
    if (
      forceLevel >= 2 &&
      (contentScriptStatus === gsUtils.STATUS_FORMINPUT ||
        contentScriptStatus === gsUtils.STATUS_TEMPWHITELIST)
    ) {
      return false;
    }
    return true;
  }

  function getContentScriptTabInfo(tab) {
    return new Promise(resolve => {
      gsMessages.sendRequestInfoToContentScript(tab.id, (error, tabInfo) => {
        //TODO: Should we wait here for the tab to load? Doesnt seem to matter..
        if (error) {
          gsUtils.warning( tab.id, QUEUE_ID, 'Failed to get content script info', error, );
          // continue here but will lose information about scroll position,
          // temp whitelist, and form input
        }
        resolve(tabInfo);
      });
    });
  }

  function generateUrlWithYouTubeTimestamp(tab) {
    return new Promise(resolve => {
      if (tab.url.indexOf('https://www.youtube.com/watch') < 0) {
        resolve(tab.url);
        return;
      }

      gsMessages.executeCodeOnTab(
        tab.id,
        [], // args for injection
        () => { // code to execute
          const videoEl = document.querySelector( 'video.video-stream.html5-main-video' );
          const timestamp = videoEl ? videoEl.currentTime >> 0 : 0;
          return timestamp;
        },
        (error, response) => {  // callback
          if (error) {
            gsUtils.warning( tab.id, QUEUE_ID, 'Failed to fetch YouTube timestamp', error, );
          }
          if (!response) {
            resolve(tab.url);
            return;
          }

          const timestamp = response;
          const youTubeUrl = new URL(tab.url);
          youTubeUrl.searchParams.set('t', timestamp + 's');
          resolve(youTubeUrl.href);
        },
      );
    });
  }


  return {
    initAsPromised,
    queueTabForSuspension,
    queueTabForSuspensionAsPromise,
    unqueueTabForSuspension,
    checkTabEligibilityForSuspension,
    executeTabSuspension,
    getQueuedTabDetails,
  };
})();
