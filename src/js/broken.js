import  { gsUtils }               from './gsUtils.js';

(() => {
  'use strict';

  function init() {
    document
      .getElementById('restartExtension')
      .addEventListener('click', function() {
        chrome.runtime.reload();
      });
    document
      .getElementById('recoveryPageLink')
      .addEventListener('click', function() {
        chrome.tabs.create({ url: chrome.runtime.getURL('recovery.html') });
      });
  }
  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      init();
    });
  }

  gsUtils.documentReadyAndLocalisedAsPromised(window);

})();
