/**
 * Settings module.
 * Handles API key management, theme switching, Google Sign-In, and settings modal.
 */
import { initAI, testApiKey, setModel, getModel } from './ai.js';

const STORAGE_KEY_API = 'visualizer_ai_api_key';
const STORAGE_KEY_MODEL = 'visualizer_ai_model';
const STORAGE_KEY_THEME = 'visualizer_ai_theme';
const STORAGE_KEY_GOOGLE_USER = 'visualizer_ai_google_user';

// Google OAuth Client ID — users need to replace with their own
// For demo, we use Google Identity Services (GIS) popup flow
const GOOGLE_CLIENT_ID = ''; // Will be set if user provides one

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

/**
 * Render the Google account area based on sign-in state.
 */
function renderGoogleAccount() {
  const area = document.getElementById('google-signin-area');
  if (!area) return;

  const savedUser = localStorage.getItem(STORAGE_KEY_GOOGLE_USER);

  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      area.innerHTML = `
        <div class="google-user-card">
          <img class="google-user-avatar" src="${user.picture || ''}" alt="${user.name}" referrerpolicy="no-referrer" />
          <div class="google-user-info">
            <div class="google-user-name">${escapeHtml(user.name)}</div>
            <div class="google-user-email">${escapeHtml(user.email)}</div>
          </div>
          <button id="btn-google-signout" class="btn-google-signout">Logout</button>
        </div>
      `;

      const signoutBtn = document.getElementById('btn-google-signout');
      if (signoutBtn) {
        signoutBtn.addEventListener('click', handleGoogleSignOut);
      }
    } catch {
      area.innerHTML = getSignInButtonHTML();
      bindGoogleSignInButton();
    }
  } else {
    area.innerHTML = getSignInButtonHTML();
    bindGoogleSignInButton();
  }
}

/**
 * Get the Google Sign-In button HTML.
 */
function getSignInButtonHTML() {
  return `
    <button id="btn-google-signin" class="btn-google-signin">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Login dengan Google
    </button>
  `;
}

/**
 * Bind click handler to the Google Sign-In button.
 */
function bindGoogleSignInButton() {
  const btn = document.getElementById('btn-google-signin');
  if (btn) {
    btn.addEventListener('click', handleGoogleSignIn);
  }
}

/**
 * Handle Google Sign-In using popup OAuth flow.
 * Uses Google Identity Services (GIS) if available, otherwise OAuth redirect.
 */
async function handleGoogleSignIn() {
  // Try using Google Identity Services
  if (window.google?.accounts?.id) {
    window.google.accounts.id.prompt();
    return;
  }

  // Fallback: Open Google OAuth popup manually
  // This uses the implicit grant flow for client-side apps
  const clientId = GOOGLE_CLIENT_ID || prompt(
    'Masukkan Google OAuth Client ID kamu:\n\n' +
    'Buat di https://console.cloud.google.com/apis/credentials\n' +
    'Pilih "OAuth 2.0 Client IDs" → Web application'
  );

  if (!clientId) return;

  const redirectUri = window.location.origin;
  const scope = 'openid email profile';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(scope)}` +
    `&prompt=select_account`;

  const popup = window.open(authUrl, 'google-signin', 'width=500,height=600,scrollbars=yes');

  // Listen for the redirect back
  const checkPopup = setInterval(async () => {
    try {
      if (!popup || popup.closed) {
        clearInterval(checkPopup);
        return;
      }

      const popupUrl = popup.location.href;
      if (popupUrl.startsWith(redirectUri)) {
        clearInterval(checkPopup);
        popup.close();

        // Extract access token from hash
        const hash = popupUrl.split('#')[1];
        if (!hash) return;

        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');

        if (accessToken) {
          await fetchGoogleUserInfo(accessToken);
        }
      }
    } catch {
      // Cross-origin error — popup hasn't redirected yet, keep waiting
    }
  }, 500);
}

/**
 * Fetch Google user info from the access token and save it.
 */
async function fetchGoogleUserInfo(accessToken) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) throw new Error('Failed to fetch user info');

    const userInfo = await response.json();
    const user = {
      name: userInfo.name || 'User',
      email: userInfo.email || '',
      picture: userInfo.picture || '',
      sub: userInfo.sub || '',
    };

    localStorage.setItem(STORAGE_KEY_GOOGLE_USER, JSON.stringify(user));
    renderGoogleAccount();
  } catch (err) {
    console.error('Google Sign-In error:', err);
    alert('Gagal login dengan Google. Coba lagi nanti.');
  }
}

/**
 * Handle Google Sign-Out.
 */
function handleGoogleSignOut() {
  localStorage.removeItem(STORAGE_KEY_GOOGLE_USER);
  renderGoogleAccount();
}

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

  // Theme toggle buttons
  const themeDarkBtn = document.getElementById('theme-dark');
  const themeLightBtn = document.getElementById('theme-light');

  if (themeDarkBtn) {
    themeDarkBtn.addEventListener('click', () => applyTheme('dark'));
  }
  if (themeLightBtn) {
    themeLightBtn.addEventListener('click', () => applyTheme('light'));
  }

  // --- Google Account ---
  renderGoogleAccount();

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
    // Show modal on first load if no key
    setTimeout(() => openModal(), 500);
  }

  // Open modal
  if (btnSettings) {
    btnSettings.addEventListener('click', openModal);
  }

  // Close modal
  if (btnClose) {
    btnClose.addEventListener('click', closeModal);
  }

  // Click outside to close
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

  // Save settings
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
    // Refresh Google account state when opening
    renderGoogleAccount();
    // Refresh theme buttons
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

/**
 * Show a status message.
 */
function showStatus(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = `api-key-status ${type}`;
}

/**
 * Escape HTML for display.
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
