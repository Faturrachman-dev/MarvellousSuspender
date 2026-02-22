
(function() {
  'use strict';

  let isFormListenerInitialised = false;
  let isReceivingFormInput = false;
  let isIgnoreForms = false;
  let tempWhitelist = false;

  function formInputListener(event) {
    if (!isReceivingFormInput && !tempWhitelist) {
      const tag = event.target && event.target.tagName && event.target.tagName.toUpperCase();
      const isFormElement =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'FORM' ||
        (event.target && event.target.isContentEditable === true);

      if (isFormElement) {
        isReceivingFormInput = true;
        if (!isBackgroundConnectable()) {
          return false;
        }
        chrome.runtime.sendMessage(buildReportTabStatePayload());
      }
    }
  }

  function initFormInputListener() {
    if (isFormListenerInitialised) {
      return;
    }
    // Listen on multiple event types so detection is not limited to printable keystrokes.
    // 'input' catches paste, cut, autocomplete, and voice input;
    // 'change' catches select/checkbox interactions.
    window.addEventListener('keydown', formInputListener);
    window.addEventListener('input', formInputListener);
    window.addEventListener('change', formInputListener);
    isFormListenerInitialised = true;
  }

  function init() {
    //listen for background events

    chrome.runtime.onMessage.addListener(( request, sender, sendResponse ) => {
      if (request.hasOwnProperty('action')) {
        if (request.action === 'requestInfo') {
          sendResponse(buildReportTabStatePayload());
          return false;
        }
      }

      if (request.hasOwnProperty('scrollPos')) {
        if (request.scrollPos !== '' && request.scrollPos !== '0') {
          document.body.scrollTop = request.scrollPos;
          document.documentElement.scrollTop = request.scrollPos;
        }
      }

      if (request.hasOwnProperty('ignoreForms')) {
        isIgnoreForms = request.ignoreForms;
        if (isIgnoreForms) {
          initFormInputListener();
        }
        isReceivingFormInput = isReceivingFormInput && isIgnoreForms;
      }

      if (request.hasOwnProperty('tempWhitelist')) {
        if (isReceivingFormInput && !request.tempWhitelist) {
          isReceivingFormInput = false;
        }
        tempWhitelist = request.tempWhitelist;
      }

      sendResponse(buildReportTabStatePayload());
      return false;
    });
  }

  function waitForRuntimeReady(retries) {
    retries = retries || 0;
    return new Promise((resolve) => resolve(chrome.runtime)).then((chromeRuntime) => {
      if (chromeRuntime) {
        return Promise.resolve();
      }
      if (retries > 3) {
        return Promise.reject('Failed waiting for chrome.runtime');
      }
      retries += 1;
      return new Promise(resolve => setTimeout(resolve, 500)).then(() =>
        waitForRuntimeReady(retries)
      );
    });
  }

  function isBackgroundConnectable() {
    try {
      var port = chrome.runtime.connect();
      if (port) {
        port.disconnect();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function buildReportTabStatePayload() {
    return {
      action: 'reportTabState',
      status:
        isIgnoreForms && isReceivingFormInput
          ? 'formInput'
          : tempWhitelist
            ? 'tempWhitelist'
            : 'normal',
      scrollPos:
        (document.documentElement || document.body || {}).scrollTop || 0,
    };
  }

  waitForRuntimeReady()
    .then(init)
    .catch(e => {
      // eslint-disable-next-line no-console
      console.error(e);
      setTimeout(() => {
        init();
      }, 200);
    });
})();
