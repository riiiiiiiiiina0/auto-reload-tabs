const urlPatternInput = document.getElementById('url-pattern');
const reloadIntervalInput = document.getElementById('reload-interval');
const addPatternForm = document.getElementById('add-pattern-form');
const patternsList = document.getElementById('patterns-list');

function savePatterns(patterns) {
  chrome.storage.sync.set({ patterns });
}

function renderPatterns(patterns) {
  patternsList.innerHTML = '';
  patterns.forEach((pattern, index) => {
    const listItem = document.createElement('li');
    listItem.innerHTML = `
      <span>${pattern.urlPattern} (${pattern.reloadInterval} minutes)</span>
      <span class="delete-btn" data-index="${index}">&times;</span>
    `;
    patternsList.appendChild(listItem);
  });
}

function addPattern(event) {
  event.preventDefault();
  const urlPattern = urlPatternInput.value.trim();
  const reloadInterval = parseInt(reloadIntervalInput.value, 10);

  if (urlPattern && reloadInterval > 0) {
    chrome.storage.sync.get('patterns', ({ patterns = [] }) => {
      patterns.push({ urlPattern, reloadInterval });
      savePatterns(patterns);
      renderPatterns(patterns);
      urlPatternInput.value = '';
      reloadIntervalInput.value = '';
    });
  }
}

function deletePattern(event) {
  if (event.target.classList.contains('delete-btn')) {
    const index = parseInt(event.target.dataset.index, 10);
    chrome.storage.sync.get('patterns', ({ patterns = [] }) => {
      patterns.splice(index, 1);
      savePatterns(patterns);
      renderPatterns(patterns);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('patterns', ({ patterns = [] }) => {
    renderPatterns(patterns);
  });
});

addPatternForm.addEventListener('submit', addPattern);
patternsList.addEventListener('click', deletePattern);