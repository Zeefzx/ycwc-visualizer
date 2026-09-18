/**
 * Visualizer AI — Main Entry Point
 * Wires up all modules: AI, Chat, Sidebar, Settings, History
 */
import './style.css';
import { sendMessageStreaming, clearHistory, isInitialized, getHistory, setHistory } from './ai.js';
import { addUserMessage, createAIMessage, clearChat, showWelcome, restoreMessages } from './chat.js';
import { initSidebar, renderHistoryList } from './sidebar.js';
import { initSettings, openSettingsModal } from './settings.js';
import {
  createNewChat,
  getChatById,
  getCurrentChatId,
  setCurrentChatId,
  addMessageToChat,
  deleteChat,
  pruneChats,
  getAllChats,
} from './history.js';

// DOM elements
const inputMessage = document.getElementById('input-message');
const btnSend = document.getElementById('btn-send');
const btnNewChat = document.getElementById('btn-new-chat');
const welcomeChips = document.querySelectorAll('.welcome-chip');

let isSending = false;
let currentChatId = null;

/**
 * Initialize the app.
 */
function init() {
  // Init settings (loads API key)
  initSettings(() => {
    const banner = document.querySelector('.no-key-banner');
    if (banner) banner.remove();
  });

  // Init sidebar with handlers
  initSidebar(
    // onTopicClick
    (prompt) => {
      if (!isSending) {
        inputMessage.value = prompt;
        handleSend();
      }
    },
    // onHistoryClick
    (chatId) => {
      switchToChat(chatId);
    },
    // onHistoryDelete
    (chatId) => {
      handleDeleteChat(chatId);
    }
  );

  // Welcome chip clicks
  welcomeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      if (prompt && !isSending) {
        inputMessage.value = prompt;
        handleSend();
      }
    });
  });

  // Send button
  btnSend.addEventListener('click', handleSend);

  // Input handling
  inputMessage.addEventListener('input', () => {
    autoResize();
    updateSendButton();
  });

  inputMessage.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // New chat button
  btnNewChat.addEventListener('click', handleNewChat);

  // Restore last active chat or show welcome
  const lastChatId = getCurrentChatId();
  if (lastChatId) {
    const chat = getChatById(lastChatId);
    if (chat && chat.messages.length > 0) {
      switchToChat(lastChatId);
    }
  }

  // Prune old chats
  pruneChats(30);

  // Focus input
  inputMessage.focus();
}

/**
 * Ensure there's an active chat session. Creates one if needed.
 */
function ensureActiveChat() {
  if (!currentChatId) {
    const chat = createNewChat();
    currentChatId = chat.id;
    renderHistoryList();
  }
}

/**
 * Handle sending a message.
 */
async function handleSend(retryMessage) {
  const message = retryMessage || inputMessage.value.trim();
  if (!message || isSending) return;

  if (!isInitialized()) {
    openSettingsModal();
    return;
  }

  isSending = true;
  updateSendButton();

  // Ensure we have a chat session
  ensureActiveChat();

  // Clear input (only if not a retry)
  if (!retryMessage) {
    inputMessage.value = '';
    autoResize();
  }

  // Add user message to UI (only if not a retry — user bubble already exists)
  if (!retryMessage) {
    addUserMessage(message);
    addMessageToChat(currentChatId, 'user', message, getHistory());
    renderHistoryList();
  }

  // Create AI message placeholder
  const aiMessage = createAIMessage();

  // Stream response
  await sendMessageStreaming(
    message,
    // onChunk
    (chunk) => {
      aiMessage.appendChunk(chunk);
    },
    // onDone
    (fullResponse) => {
      aiMessage.finalize();

      // Save AI response to history
      addMessageToChat(currentChatId, 'ai', fullResponse, getHistory());
      renderHistoryList();

      isSending = false;
      updateSendButton();
      inputMessage.focus();
    },
    // onError
    (error) => {
      aiMessage.showError(error.message, () => {
        // Retry: re-send the same message
        handleSend(message);
      });
      isSending = false;
      updateSendButton();
      inputMessage.focus();
    }
  );
}

/**
 * Switch to an existing chat session.
 */
function switchToChat(chatId) {
  const chat = getChatById(chatId);
  if (!chat) return;

  currentChatId = chatId;
  setCurrentChatId(chatId);

  // Restore AI context
  setHistory(chat.aiHistory || []);

  // Restore UI messages
  if (chat.messages.length > 0) {
    restoreMessages(chat.messages);
  } else {
    clearChat();
  }

  renderHistoryList();
  inputMessage.focus();
}

/**
 * Handle starting a new chat.
 */
function handleNewChat() {
  // Save current state is already done per-message, so just create new
  clearHistory();
  clearChat();
  currentChatId = null;
  inputMessage.value = '';
  autoResize();
  renderHistoryList();
  inputMessage.focus();
}

/**
 * Handle deleting a chat from history.
 */
function handleDeleteChat(chatId) {
  deleteChat(chatId);

  // If we deleted the active chat, reset
  if (chatId === currentChatId) {
    currentChatId = null;
    clearHistory();
    clearChat();

    // Switch to most recent chat if available
    const chats = getAllChats();
    if (chats.length > 0) {
      switchToChat(chats[0].id);
    }
  }

  renderHistoryList();
}

/**
 * Auto-resize the textarea.
 */
function autoResize() {
  inputMessage.style.height = 'auto';
  inputMessage.style.height = Math.min(inputMessage.scrollHeight, 150) + 'px';
}

/**
 * Update send button state.
 */
function updateSendButton() {
  const hasText = inputMessage.value.trim().length > 0;
  btnSend.disabled = !hasText || isSending;
}

// Boot
init();
