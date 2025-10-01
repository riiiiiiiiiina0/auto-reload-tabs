(() => {
  // Storage key for patterns
  const STORAGE_KEY = 'reloadPatterns';

  // Track which pattern is being edited (null if adding new)
  let editingIndex = null;

  // Track which pattern is being deleted
  let deletingIndex = null;

  // Auto theme switcher - switches between winter (light) and coffee (dark)
  function applyTheme() {
    const isDarkMode = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    const theme = isDarkMode ? 'coffee' : 'winter';
    document.documentElement.setAttribute('data-theme', theme);
  }

  // Apply theme on load
  applyTheme();

  // Listen for system theme changes
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', applyTheme);

  // Load and display patterns
  async function loadPatterns() {
    const result = await chrome.storage.sync.get([STORAGE_KEY]);
    const patterns = result[STORAGE_KEY] || [];

    const patternsList = /** @type {HTMLDivElement} */ (
      document.getElementById('patternsList')
    );
    const emptyState = /** @type {HTMLDivElement} */ (
      document.getElementById('emptyState')
    );

    if (patterns.length === 0) {
      patternsList.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    patternsList.innerHTML = patterns
      .map(
        (pattern, index) => `
    <div class="flex items-center justify-between p-4 bg-base-200 rounded-lg hover:bg-base-300 transition-colors">
      <div class="flex-1 min-w-0 mr-4">
        <div class="font-mono text-lg font-semibold text-primary truncate">${escapeHtml(
          pattern.urlPattern,
        )}</div>
        <div class="text-sm text-base-content/70 mt-1">Reloads every ${
          pattern.intervalMinutes
        } minute${pattern.intervalMinutes > 1 ? 's' : ''}</div>
      </div>
      <div class="flex gap-2">
        <button 
          class="btn btn-info btn-sm" 
          data-index="${index}"
          data-action="edit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
        <button 
          class="btn btn-error btn-sm" 
          data-index="${index}"
          data-action="delete"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  `,
      )
      .join('');

    // Add event listeners to buttons
    document.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = /** @type {HTMLButtonElement} */ (e.currentTarget);
        const index = parseInt(target.dataset.index || '0', 10);
        editPattern(index);
      });
    });

    document.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = /** @type {HTMLButtonElement} */ (e.currentTarget);
        const index = parseInt(target.dataset.index || '0', 10);
        deletePattern(index);
      });
    });
  }

  // Add or update a pattern
  async function savePattern() {
    const urlPatternInput = /** @type {HTMLInputElement} */ (
      document.getElementById('urlPattern')
    );
    const intervalMinutesInput = /** @type {HTMLInputElement} */ (
      document.getElementById('intervalMinutes')
    );

    const urlPattern = urlPatternInput.value.trim();
    const intervalMinutes = parseInt(intervalMinutesInput.value, 10);

    // Validation
    if (!urlPattern) {
      showNotification('Please enter a URL pattern', 'error');
      return;
    }

    if (!intervalMinutes || intervalMinutes < 1) {
      showNotification(
        'Please enter a valid interval (1 or more minutes)',
        'error',
      );
      return;
    }

    // Get existing patterns
    const result = await chrome.storage.sync.get([STORAGE_KEY]);
    const patterns = result[STORAGE_KEY] || [];

    // Check for duplicate (but allow the current pattern being edited)
    const duplicateIndex = patterns.findIndex(
      (p) => p.urlPattern === urlPattern,
    );
    if (duplicateIndex !== -1 && duplicateIndex !== editingIndex) {
      showNotification('This URL pattern already exists', 'error');
      return;
    }

    if (editingIndex !== null) {
      // Update existing pattern
      patterns[editingIndex] = { urlPattern, intervalMinutes };
      showNotification('Pattern updated successfully', 'success');
    } else {
      // Add new pattern
      patterns.push({ urlPattern, intervalMinutes });
      showNotification('Pattern added successfully', 'success');
    }

    await chrome.storage.sync.set({ [STORAGE_KEY]: patterns });

    // Reset form
    cancelEdit();

    // Reload display
    await loadPatterns();

    // Notify background script to update timers
    chrome.runtime.sendMessage({ action: 'patternsUpdated' });
  }

  // Edit a pattern
  async function editPattern(index) {
    const result = await chrome.storage.sync.get([STORAGE_KEY]);
    const patterns = result[STORAGE_KEY] || [];
    const pattern = patterns[index];

    if (!pattern) return;

    // Set editing mode
    editingIndex = index;

    // Populate form
    const urlPatternInput = /** @type {HTMLInputElement} */ (
      document.getElementById('urlPattern')
    );
    const intervalMinutesInput = /** @type {HTMLInputElement} */ (
      document.getElementById('intervalMinutes')
    );

    urlPatternInput.value = pattern.urlPattern;
    intervalMinutesInput.value = pattern.intervalMinutes.toString();

    // Update UI
    const formTitle = /** @type {HTMLHeadingElement} */ (
      document.getElementById('formTitle')
    );
    const btnText = /** @type {HTMLSpanElement} */ (
      document.getElementById('btnText')
    );
    const cancelBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById('cancelEditBtn')
    );

    formTitle.textContent = 'Edit Pattern';
    btnText.textContent = 'Update Pattern';
    cancelBtn.classList.remove('hidden');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Cancel editing
  function cancelEdit() {
    editingIndex = null;

    // Clear form
    const urlPatternInput = /** @type {HTMLInputElement} */ (
      document.getElementById('urlPattern')
    );
    const intervalMinutesInput = /** @type {HTMLInputElement} */ (
      document.getElementById('intervalMinutes')
    );

    urlPatternInput.value = '';
    intervalMinutesInput.value = '5';

    // Update UI
    const formTitle = /** @type {HTMLHeadingElement} */ (
      document.getElementById('formTitle')
    );
    const btnText = /** @type {HTMLSpanElement} */ (
      document.getElementById('btnText')
    );
    const cancelBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById('cancelEditBtn')
    );

    formTitle.textContent = 'Add New Pattern';
    btnText.textContent = 'Add Pattern';
    cancelBtn.classList.add('hidden');
  }

  // Show delete confirmation modal
  async function deletePattern(index) {
    const result = await chrome.storage.sync.get([STORAGE_KEY]);
    const patterns = result[STORAGE_KEY] || [];
    const pattern = patterns[index];

    if (!pattern) return;

    deletingIndex = index;

    // Update modal content
    const deletePatternInfo = /** @type {HTMLParagraphElement} */ (
      document.getElementById('deletePatternInfo')
    );
    deletePatternInfo.textContent = `Pattern: "${pattern.urlPattern}" (${
      pattern.intervalMinutes
    } minute${pattern.intervalMinutes > 1 ? 's' : ''})`;

    // Show modal
    const modal = /** @type {HTMLDialogElement} */ (
      document.getElementById('deleteModal')
    );
    modal.showModal();
  }

  // Actually delete the pattern after confirmation
  async function confirmDeletePattern() {
    if (deletingIndex === null) return;

    const result = await chrome.storage.sync.get([STORAGE_KEY]);
    const patterns = result[STORAGE_KEY] || [];

    patterns.splice(deletingIndex, 1);
    await chrome.storage.sync.set({ [STORAGE_KEY]: patterns });

    // If we're deleting the pattern being edited, cancel edit mode
    if (editingIndex === deletingIndex) {
      cancelEdit();
    } else if (editingIndex !== null && editingIndex > deletingIndex) {
      // Adjust editing index if needed
      editingIndex--;
    }

    await loadPatterns();
    showNotification('Pattern deleted', 'info');

    // Notify background script to update timers
    chrome.runtime.sendMessage({ action: 'patternsUpdated' });

    // Close modal and reset
    closeDeleteModal();
  }

  // Close delete modal
  function closeDeleteModal() {
    const modal = /** @type {HTMLDialogElement} */ (
      document.getElementById('deleteModal')
    );
    modal.close();
    deletingIndex = null;
  }

  // Show notification toast
  function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} shadow-lg fixed bottom-4 right-4 w-auto max-w-sm z-50`;
    toast.innerHTML = `
    <div>
      <span>${message}</span>
    </div>
  `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Export patterns to JSON file
  async function exportPatterns() {
    const result = await chrome.storage.sync.get([STORAGE_KEY]);
    const patterns = result[STORAGE_KEY] || [];

    if (patterns.length === 0) {
      showNotification('No patterns to export', 'warning');
      return;
    }

    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      patterns: patterns,
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `reloader-bear-patterns-${
      new Date().toISOString().split('T')[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Patterns exported successfully', 'success');
  }

  // Import patterns from JSON file
  async function importPatterns() {
    const fileInput = /** @type {HTMLInputElement} */ (
      document.getElementById('importFileInput')
    );

    fileInput.onchange = async (e) => {
      const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate import data
        if (!data.patterns || !Array.isArray(data.patterns)) {
          showNotification('Invalid import file format', 'error');
          return;
        }

        // Validate each pattern
        const validPatterns = data.patterns.filter((p) => {
          return (
            p.urlPattern &&
            typeof p.urlPattern === 'string' &&
            p.intervalMinutes &&
            typeof p.intervalMinutes === 'number' &&
            p.intervalMinutes > 0
          );
        });

        if (validPatterns.length === 0) {
          showNotification('No valid patterns found in import file', 'error');
          return;
        }

        // Get existing patterns
        const result = await chrome.storage.sync.get([STORAGE_KEY]);
        const existingPatterns = result[STORAGE_KEY] || [];

        // Merge patterns, avoiding duplicates
        const mergedPatterns = [...existingPatterns];
        let importedCount = 0;
        let duplicateCount = 0;

        for (const pattern of validPatterns) {
          const exists = mergedPatterns.some(
            (p) => p.urlPattern === pattern.urlPattern,
          );
          if (!exists) {
            mergedPatterns.push(pattern);
            importedCount++;
          } else {
            duplicateCount++;
          }
        }

        // Save merged patterns
        await chrome.storage.sync.set({ [STORAGE_KEY]: mergedPatterns });

        // Reload display
        await loadPatterns();

        // Notify background script to update timers
        chrome.runtime.sendMessage({ action: 'patternsUpdated' });

        // Show result message
        let message = `Imported ${importedCount} pattern${
          importedCount !== 1 ? 's' : ''
        }`;
        if (duplicateCount > 0) {
          message += ` (${duplicateCount} duplicate${
            duplicateCount !== 1 ? 's' : ''
          } skipped)`;
        }
        showNotification(message, 'success');
      } catch (error) {
        console.error('Import error:', error);
        showNotification(
          'Failed to import patterns. Please check the file format.',
          'error',
        );
      }

      // Reset file input
      fileInput.value = '';
    };

    fileInput.click();
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    loadPatterns();

    /** @type {HTMLButtonElement} */ (
      document.getElementById('addPatternBtn')
    ).addEventListener('click', savePattern);

    /** @type {HTMLButtonElement} */ (
      document.getElementById('cancelEditBtn')
    ).addEventListener('click', cancelEdit);

    // Delete modal buttons
    /** @type {HTMLButtonElement} */ (
      document.getElementById('confirmDeleteBtn')
    ).addEventListener('click', confirmDeletePattern);

    /** @type {HTMLButtonElement} */ (
      document.getElementById('cancelDeleteBtn')
    ).addEventListener('click', closeDeleteModal);

    // Import/Export buttons
    /** @type {HTMLButtonElement} */ (
      document.getElementById('exportBtn')
    ).addEventListener('click', exportPatterns);

    /** @type {HTMLButtonElement} */ (
      document.getElementById('importBtn')
    ).addEventListener('click', importPatterns);

    // Allow Enter key to save pattern
    /** @type {HTMLInputElement} */ (
      document.getElementById('urlPattern')
    ).addEventListener('keypress', (e) => {
      if (e.key === 'Enter') savePattern();
    });

    /** @type {HTMLInputElement} */ (
      document.getElementById('intervalMinutes')
    ).addEventListener('keypress', (e) => {
      if (e.key === 'Enter') savePattern();
    });
  });
})();
