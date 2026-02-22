import  { gsIndexedDb }           from './gsIndexedDb.js';
import  { gsSession }             from './gsSession.js';
import  { gsUtils }               from './gsUtils.js';

(() => {
  'use strict';

  function setRestartExtensionClickHandler(warnFirst) {
    document.getElementById('restartExtensionBtn').onclick = async function(e) {
      // var result = true;
      // if (warnFirst) {
      //   result = window.confirm(chrome.i18n.getMessage('js_update_confirm'));
      // }
      // if (result) {

      document.getElementById('restartExtensionBtn').className += ' btnDisabled';
      document.getElementById('restartExtensionBtn').onclick = null;

      const currentSession = await gsSession.buildCurrentSession();
      if (currentSession) {
        var currentVersion = chrome.runtime.getManifest().version;
        await gsIndexedDb.createOrUpdateSessionRestorePoint(
          currentSession,
          currentVersion
        );
      }

      //ensure we don't leave any windows with no unsuspended tabs
      await gsSession.unsuspendActiveTabInEachWindow();

      //update current session to ensure the new tab ids are saved before
      //we restart the extension
      await gsSession.updateCurrentSession();

      chrome.runtime.reload();
      // }
    };
  }

  function setExportBackupClickHandler() {
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
      setRestartExtensionClickHandler(false);
    };
  }

  function setRecoveryPageClickHandler() {
    document.getElementById('recoveryPageLink').onclick = function(e) {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('recovery.html') });
      setRestartExtensionClickHandler(false);
    };
  }

  gsUtils.documentReadyAndLocalisedAsPromised(window).then(function() {
    setRecoveryPageClickHandler();
    setRestartExtensionClickHandler(true);
    setExportBackupClickHandler();

    var currentVersion = chrome.runtime.getManifest().version;
    gsIndexedDb
      .fetchSessionRestorePoint(currentVersion)
      .then(function(sessionRestorePoint) {
        if (!sessionRestorePoint) {
          gsUtils.warning( 'update', 'Couldnt find session restore point. Something has gone horribly wrong!!' );
          document.getElementById('noBackupInfo').style.display = 'block';
          document.getElementById('backupInfo').style.display = 'none';
          document.getElementById('exportBackupBtn').style.display = 'none';
        }
      });
  });
})();
