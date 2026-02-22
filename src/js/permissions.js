import  { gsChrome }              from './gsChrome.js';
import  { gsSession }             from './gsSession.js';
import  { gsUtils }               from './gsUtils.js';

(() => {
  'use strict';

  gsUtils.documentReadyAndLocalisedAsPromised(window).then(function() {
    document.getElementById('exportBackupBtn').onclick = async function(e) {
      const currentSession = await gsSession.buildCurrentSession();
      const fileName = `tms-session-backup-${Date.now()}.json`;
      const blob = new Blob([JSON.stringify(currentSession, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      anchor.remove();

      document.getElementById('exportBackupBtn').style.display = 'none';
    };
    document.getElementById('setFilePermissiosnBtn').onclick = async function(
      e
    ) {
      await gsChrome.tabsCreate({
        url: 'chrome://extensions?id=' + chrome.runtime.id,
      });
    };
  });
})();
