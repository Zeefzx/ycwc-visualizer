/**
 * Settings module.
 * Handles API key management, theme switching, and settings modal.
 */
import { initAI, testApiKey, setModel, getModel } from './ai.js';

const STORAGE_KEY_API = 'visualizer_ai_api_key';
const STORAGE_KEY_MODEL = 'visualizer_ai_model';
const STORAGE_KEY_THEME = 'visualizer_ai_theme';

/* =========================================
   THEME
   ========================================= */

/**
 * Apply theme to the document.
 * @param {'dark'|'light'} theme
 */
function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem(STORAGE_KEY_THEME, theme);
  updateThemeButtons(theme);
}

/**
 * Update theme toggle button active states.
 */
function updateThemeButtons(theme) {
  const darkBtn = document.getElementById('theme-dark');
  const lightBtn = document.getElementById('theme-light');
  if (darkBtn && lightBtn) {
    darkBtn.classList.toggle('active', theme === 'dark');
    lightBtn.classList.toggle('active', theme === 'light');
  }
}



/* =========================================
   SETTINGS INIT
   ========================================= */

/**
 * Initialize settings: load saved key, bind modal events.
 * @param {function} onKeyReady - Callback when API key is loaded/saved successfully
 */
export function initSettings(onKeyReady) {
  const modal = document.getElementById('settings-modal');
  const btnSettings = document.getElementById('btn-settings');
  const btnClose = document.getElementById('btn-close-modal');
  const btnSave = document.getElementById('btn-save-settings');
  const apiKeyInput = document.getElementById('api-key-input');
  const modelSelect = document.getElementById('model-select');
  const toggleKeyBtn = document.getElementById('btn-toggle-key');
  const statusEl = document.getElementById('api-key-status');

  // --- Theme ---
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'dark';
  applyTheme(savedTheme);

  const themeDarkBtn = document.getElementById('theme-dark');
  const themeLightBtn = document.getElementById('theme-light');

  if (themeDarkBtn) {
    themeDarkBtn.addEventListener('click', () => applyTheme('dark'));
  }
  if (themeLightBtn) {
    themeLightBtn.addEventListener('click', () => applyTheme('light'));
  }

  // --- API Key & Model ---
  const savedKey = localStorage.getItem(STORAGE_KEY_API);
  const savedModel = localStorage.getItem(STORAGE_KEY_MODEL);

  if (savedModel) {
    setModel(savedModel);
    if (modelSelect) modelSelect.value = savedModel;
  }

  if (savedKey) {
    initAI(savedKey);
    if (apiKeyInput) apiKeyInput.value = savedKey;
    onKeyReady();
  } else {
    setTimeout(() => openModal(), 500);
  }

  // --- Modal Controls ---
  if (btnSettings) {
    btnSettings.addEventListener('click', openModal);
  }

  if (btnClose) {
    btnClose.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Toggle key visibility
  if (toggleKeyBtn && apiKeyInput) {
    toggleKeyBtn.addEventListener('click', () => {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    });
  }

  // --- Save Settings ---
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const key = apiKeyInput?.value?.trim();
      const model = modelSelect?.value;

      if (!key) {
        showStatus(statusEl, 'Masukkan API key terlebih dahulu.', 'error');
        return;
      }

      // Save model
      if (model) {
        setModel(model);
        localStorage.setItem(STORAGE_KEY_MODEL, model);
      }

      // Test API key
      showStatus(statusEl, 'Menguji API key...', 'loading');
      btnSave.disabled = true;

      try {
        initAI(key);
        await testApiKey(key);
        localStorage.setItem(STORAGE_KEY_API, key);
        showStatus(statusEl, '✅ API key valid! Tersimpan.', 'success');
        onKeyReady();

        setTimeout(() => closeModal(), 1000);
      } catch (err) {
        console.error('API key test failed:', err);
        const msg = err.message || 'Unknown error';
        if (msg.includes('API_KEY_INVALID') || msg.includes('401')) {
          showStatus(statusEl, '❌ API key tidak valid. Cek ulang key kamu.', 'error');
        } else {
          showStatus(statusEl, `❌ Gagal test key: ${msg}`, 'error');
        }
      } finally {
        btnSave.disabled = false;
      }
    });
  }

  function openModal() {
    if (modal) modal.classList.remove('hidden');
    updateThemeButtons(localStorage.getItem(STORAGE_KEY_THEME) || 'dark');
  }

  function closeModal() {
    if (modal) modal.classList.add('hidden');
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.className = 'api-key-status';
    }
  }
}

/* =========================================
   UTILITIES
   ========================================= */

function showStatus(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = `api-key-status ${type}`;
}


/**
 * Check if API key is configured.
 */
export function hasApiKey() {
  return !!localStorage.getItem(STORAGE_KEY_API);
}

/**
 * Open the settings modal from outside.
 */
export function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.remove('hidden');
}
