/**
 * Sidebar module.
 * Handles quick topic buttons, chat history list, and sidebar toggle.
 */
import { QUICK_TOPICS } from './prompt.js';
import { getAllChats, deleteChat, getCurrentChatId } from './history.js';

let onTopicClickCb = null;
let onHistoryClickCb = null;
let onHistoryDeleteCb = null;

/**
 * Initialize the sidebar with quick topic buttons.
 * @param {function} onTopicClick - Callback when a topic button is clicked (receives prompt string)
 * @param {function} onHistoryClick - Callback when a history item is clicked (receives chat id)
 * @param {function} onHistoryDelete - Callback when a history item is deleted (receives chat id)
 */
export function initSidebar(onTopicClick, onHistoryClick, onHistoryDelete) {
  onTopicClickCb = onTopicClick;
  onHistoryClickCb = onHistoryClick;
  onHistoryDeleteCb = onHistoryDelete;

  const topicsContainer = document.getElementById('quick-topics');
  if (!topicsContainer) return;

  // Render quick topic buttons
  QUICK_TOPICS.forEach(topic => {
    const btn = document.createElement('button');
    btn.className = 'quick-topic-btn';
    btn.innerHTML = `
      <span class="quick-topic-emoji">${topic.emoji}</span>
      <span>${topic.label}</span>
    `;
    btn.addEventListener('click', () => {
      onTopicClick(topic.prompt);
      closeSidebar();
    });
    topicsContainer.appendChild(btn);
  });

  // Sidebar toggle for mobile
  const toggleBtn = document.getElementById('btn-sidebar-toggle');
  const sidebar = document.getElementById('sidebar');

  if (toggleBtn && sidebar) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.getElementById('app').appendChild(overlay);

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
      closeSidebar();
    });
  }

  // Initial render of history
  renderHistoryList();
}

/**
 * Re-render the history list in the sidebar.
 * Call this after creating/deleting/switching chats.
 */
export function renderHistoryList() {
  const container = document.getElementById('chat-history-list');
  if (!container) return;

  const chats = getAllChats();
  const currentId = getCurrentChatId();

  container.innerHTML = '';

  if (chats.length === 0) {
    container.innerHTML = '<p class="history-empty">Belum ada riwayat chat</p>';
    return;
  }

  chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = `history-item${chat.id === currentId ? ' active' : ''}`;
    item.dataset.chatId = chat.id;

    const msgCount = chat.messages.length;
    const timeAgo = getTimeAgo(chat.updatedAt);

    item.innerHTML = `
      <button class="history-item-btn" title="${escapeAttr(chat.title)}">
        <span class="history-item-icon">💬</span>
        <div class="history-item-info">
          <span class="history-item-title">${escapeHtml(chat.title)}</span>
          <span class="history-item-meta">${msgCount} pesan · ${timeAgo}</span>
        </div>
      </button>
      <button class="history-item-delete" title="Hapus chat">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
      </button>
    `;

    // Click to open chat
    item.querySelector('.history-item-btn').addEventListener('click', () => {
      if (onHistoryClickCb) onHistoryClickCb(chat.id);
      closeSidebar();
    });

    // Click to delete
    item.querySelector('.history-item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if (onHistoryDeleteCb) onHistoryDeleteCb(chat.id);
    });

    container.appendChild(item);
  });
}

/**
 * Close the sidebar (mobile).
 */
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

/**
 * Get a human-readable "time ago" string.
 */
function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  const weeks = Math.floor(days / 7);
  return `${weeks} minggu lalu`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
