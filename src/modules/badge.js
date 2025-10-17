// Badge management module for backup status

/**
 * Show backup in progress badge
 */
export function showBackupInProgressBadge() {
  chrome.action.setBadgeText({ text: '⟳' });
  chrome.action.setBadgeBackgroundColor({ color: '#FFA500' }); // Orange
}

/**
 * Show backup success badge
 */
export function showBackupSuccessBadge() {
  chrome.action.setBadgeText({ text: '✓' });
  chrome.action.setBadgeBackgroundColor({ color: '#00AA00' }); // Green

  // Clear after 3 seconds and return to normal badge
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
    // Badge background will be reset by next countdown update
  }, 3000);
}

/**
 * Show backup failure badge
 */
export function showBackupFailureBadge() {
  chrome.action.setBadgeText({ text: '✗' });
  chrome.action.setBadgeBackgroundColor({ color: '#FF0000' }); // Red

  // Clear after 5 seconds and return to normal badge
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
    // Badge background will be reset by next countdown update
  }, 5000);
}

/**
 * Clear badge (return to normal state)
 */
export function clearBadge() {
  chrome.action.setBadgeText({ text: '' });
}

