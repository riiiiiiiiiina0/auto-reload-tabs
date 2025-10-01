// Storage key for patterns
const STORAGE_KEY = 'reloadPatterns';

// Track reload timers for each tab
const tabTimers = new Map(); // tabId -> { pattern, intervalMs, nextReloadTime }

// Track the badge update interval
let badgeUpdateInterval = null;

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Reloader Bear installed');
  initializeAllTabs();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Reloader Bear started');
  initializeAllTabs();
});

// Listen for tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateTabTimer(tabId, tab.url);
  }
});

// Listen for tab activation (switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  updateBadgeForActiveTab();
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  tabTimers.delete(tabId);
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener(() => {
  updateBadgeForActiveTab();
});

// Listen for messages from options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'patternsUpdated') {
    initializeAllTabs();
  }
});

// Initialize timers for all existing tabs
async function initializeAllTabs() {
  const tabs = await chrome.tabs.query({});
  tabs.forEach((tab) => {
    if (tab.url) {
      updateTabTimer(tab.id, tab.url);
    }
  });

  // Start badge update interval if not already running
  startBadgeUpdateInterval();
}

// Update timer for a specific tab
async function updateTabTimer(tabId, url) {
  const result = await chrome.storage.sync.get([STORAGE_KEY]);
  const patterns = result[STORAGE_KEY] || [];

  // Find matching pattern (use the last match)
  let matchedPattern = null;
  for (const pattern of patterns) {
    if (url.includes(pattern.urlPattern)) {
      matchedPattern = pattern;
    }
  }

  // Clear existing timer if any
  const existingTimer = tabTimers.get(tabId);
  if (existingTimer && existingTimer.alarmName) {
    chrome.alarms.clear(existingTimer.alarmName);
  }

  if (matchedPattern) {
    const intervalMs = matchedPattern.intervalMinutes * 60 * 1000;
    const nextReloadTime = Date.now() + intervalMs;
    const alarmName = `reload_tab_${tabId}`;

    // Create alarm for this tab
    chrome.alarms.create(alarmName, {
      when: nextReloadTime,
    });

    tabTimers.set(tabId, {
      pattern: matchedPattern,
      intervalMs,
      nextReloadTime,
      alarmName,
    });

    console.log(
      `Timer set for tab ${tabId}: ${matchedPattern.urlPattern} (${matchedPattern.intervalMinutes}m)`,
    );
  } else {
    tabTimers.delete(tabId);
  }

  // Update badge if this is the active tab
  updateBadgeForActiveTab();
}

// Handle alarms (reload tabs)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('reload_tab_')) {
    const tabId = parseInt(alarm.name.replace('reload_tab_', ''), 10);

    try {
      // Reload the tab
      await chrome.tabs.reload(tabId);
      console.log(`Reloaded tab ${tabId}`);

      // Get tab info to reset timer
      const tab = await chrome.tabs.get(tabId);
      updateTabTimer(tabId, tab.url);
    } catch (error) {
      console.log(`Tab ${tabId} no longer exists, cleaning up timer`);
      tabTimers.delete(tabId);
    }
  }
});

// Start the badge update interval
function startBadgeUpdateInterval() {
  if (badgeUpdateInterval) {
    clearInterval(badgeUpdateInterval);
  }

  // Update badge every second
  badgeUpdateInterval = setInterval(() => {
    updateBadgeForActiveTab();
  }, 1000);
}

// Update badge for the currently active tab
async function updateBadgeForActiveTab() {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    const timer = tabTimers.get(activeTab.id);

    if (timer) {
      const remainingMs = timer.nextReloadTime - Date.now();

      if (remainingMs <= 0) {
        chrome.action.setBadgeText({ text: '0s' });
      } else {
        const remainingMinutes = Math.floor(remainingMs / 60000);
        const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);

        let badgeText;
        if (remainingMinutes >= 1) {
          badgeText = `${remainingMinutes}m`;
        } else {
          badgeText = `${remainingSeconds}s`;
        }

        chrome.action.setBadgeText({ text: badgeText });
        chrome.action.setBadgeBackgroundColor({ color: '#10b981' }); // green
      }
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.log('Error updating badge:', error);
  }
}
