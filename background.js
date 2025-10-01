let patterns = [];

function getMatchingPattern(url) {
  let matchingPattern = null;
  for (const pattern of patterns) {
    if (url.includes(pattern.urlPattern)) {
      matchingPattern = pattern;
    }
  }
  return matchingPattern;
}

function scheduleReload(tabId, interval) {
  chrome.alarms.create(`reload-${tabId}`, { delayInMinutes: interval });
}

function updateBadge(tabId) {
  chrome.alarms.get(`reload-${tabId}`, (alarm) => {
    if (alarm) {
      const remainingMinutes = Math.ceil((alarm.scheduledTime - Date.now()) / 60000);
      chrome.action.setBadgeText({ text: `${remainingMinutes}m`, tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  });
}

function handleTabUpdate(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url) {
    const matchingPattern = getMatchingPattern(tab.url);
    if (matchingPattern) {
      scheduleReload(tabId, matchingPattern.reloadInterval);
      updateBadge(tabId);
    } else {
      chrome.alarms.clear(`reload-${tabId}`);
      updateBadge(tabId);
    }
  }
}

chrome.tabs.onUpdated.addListener(handleTabUpdate);

chrome.tabs.onActivated.addListener(activeInfo => {
  updateBadge(activeInfo.tabId);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('reload-')) {
    const tabId = parseInt(alarm.name.split('-')[1], 10);
    chrome.tabs.get(tabId, (tab) => {
      if (tab && !chrome.runtime.lastError) {
        chrome.tabs.reload(tabId);
      }
    });
  } else if (alarm.name === 'badge-updater') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        updateBadge(tabs[0].id);
      }
    });
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.patterns) {
    patterns = changes.patterns.newValue || [];
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        handleTabUpdate(tab.id, { status: 'complete' }, tab);
      }
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: '#666' });
  chrome.storage.sync.get('patterns', ({ patterns: storedPatterns = [] }) => {
    patterns = storedPatterns;
  });
  chrome.alarms.create('badge-updater', { periodInMinutes: 1 });
});