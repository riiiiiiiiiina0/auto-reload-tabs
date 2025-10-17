// Auto backup module for Raindrop integration

import { backupPatternsToRaindrop } from './raindropBackup.js';
import {
  showBackupInProgressBadge,
  showBackupSuccessBadge,
  showBackupFailureBadge,
} from './badge.js';

const BACKUP_DEBOUNCE_MS = 5000; // 5 seconds

let backupTimeoutId = null;
let isBackupRunning = false;
let backupAbortController = null;

/**
 * Check if auto backup is enabled
 */
async function isAutoBackupEnabled() {
  const data = await chrome.storage.sync.get(['autoBackupEnabled']);
  return data.autoBackupEnabled === true;
}

/**
 * Schedule an auto backup (with debouncing)
 */
export async function scheduleAutoBackup(reason = 'unknown') {
  // Check if auto backup is enabled
  const enabled = await isAutoBackupEnabled();
  if (!enabled) {
    return;
  }

  console.log(`[Auto Backup] Backup scheduled (reason: ${reason})`);

  // Cancel any pending backup
  if (backupTimeoutId !== null) {
    clearTimeout(backupTimeoutId);
    backupTimeoutId = null;
  }

  // Cancel any ongoing backup
  if (backupAbortController) {
    backupAbortController.abort();
    backupAbortController = null;
  }

  // Schedule new backup after debounce period
  backupTimeoutId = setTimeout(async () => {
    backupTimeoutId = null;
    await executeBackup();
  }, BACKUP_DEBOUNCE_MS);
}

/**
 * Execute the actual backup
 */
async function executeBackup() {
  // Cancel any ongoing backup
  if (isBackupRunning) {
    cancelOngoingBackup();
  }

  try {
    isBackupRunning = true;
    backupAbortController = new AbortController();

    console.log('[Auto Backup] Starting backup...');

    // Show in-progress badge
    showBackupInProgressBadge();

    const result = await backupPatternsToRaindrop();

    // Only update if backup wasn't cancelled
    if (!backupAbortController.signal.aborted) {
      if (result.success) {
        console.log('[Auto Backup] Backup completed successfully');
        showBackupSuccessBadge();
      } else {
        console.warn('[Auto Backup] Backup failed:', result.message);
        showBackupFailureBadge();
      }
    }
  } catch (error) {
    if (!backupAbortController?.signal.aborted) {
      console.error('[Auto Backup] Failed:', error);
      showBackupFailureBadge();
    }
  } finally {
    isBackupRunning = false;
    backupAbortController = null;
  }
}

/**
 * Cancel ongoing backup
 */
function cancelOngoingBackup() {
  if (backupAbortController) {
    backupAbortController.abort();
    backupAbortController = null;
  }
  isBackupRunning = false;
}

/**
 * Force immediate backup (bypasses debouncing)
 */
export async function forceBackup() {
  // Cancel pending scheduled backup
  if (backupTimeoutId !== null) {
    clearTimeout(backupTimeoutId);
    backupTimeoutId = null;
  }

  await executeBackup();
}
