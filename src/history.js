/**
 * Chat History module.
 * Manages chat sessions in localStorage — save, load, list, delete, switch.
 */

const STORAGE_CHATS = 'visualizer_ai_chats';
const STORAGE_CURRENT = 'visualizer_ai_current_chat';

/**
 * Generate a unique ID for a chat session.
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Get all saved chats from localStorage.
 * @returns {Array} Array of chat objects, sorted newest first.
 */
export function getAllChats() {
  try {
    const data = localStorage.getItem(STORAGE_CHATS);
    const chats = data ? JSON.parse(data) : [];
    return chats.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Save all chats to localStorage.
 */
function saveAllChats(chats) {
  localStorage.setItem(STORAGE_CHATS, JSON.stringify(chats));
}

/**
 * Get the current chat ID.
 */
export function getCurrentChatId() {
  return localStorage.getItem(STORAGE_CURRENT);
}

/**
 * Set the current chat ID.
 */
export function setCurrentChatId(id) {
  if (id) {
    localStorage.setItem(STORAGE_CURRENT, id);
  } else {
    localStorage.removeItem(STORAGE_CURRENT);
  }
}

/**
 * Create a new chat session.
 * @returns {object} The new chat object.
 */
export function createNewChat() {
  const chat = {
    id: generateId(),
    title: 'Chat Baru',
    messages: [],       // { role: 'user'|'ai', text: string }
    aiHistory: [],      // { role: 'user'|'model', parts: [{text}] } for Gemini context
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const chats = getAllChats();
  chats.unshift(chat);
  saveAllChats(chats);
  setCurrentChatId(chat.id);

  return chat;
}

/**
 * Get a specific chat by ID.
 */
export function getChatById(id) {
  const chats = getAllChats();
  return chats.find(c => c.id === id) || null;
}

/**
 * Update a chat session (add message, update title, etc.)
 */
export function updateChat(id, updates) {
  const chats = getAllChats();
  const index = chats.findIndex(c => c.id === id);
  if (index === -1) return;

  chats[index] = { ...chats[index], ...updates, updatedAt: Date.now() };
  saveAllChats(chats);
}

/**
 * Add a message to a chat and update its title if needed.
 * @param {string} chatId
 * @param {'user'|'ai'} role
 * @param {string} text
 * @param {Array} aiHistory - The full Gemini conversation history array
 */
export function addMessageToChat(chatId, role, text, aiHistory) {
  const chats = getAllChats();
  const index = chats.findIndex(c => c.id === chatId);
  if (index === -1) return;

  const chat = chats[index];
  chat.messages.push({ role, text });
  chat.aiHistory = aiHistory;
  chat.updatedAt = Date.now();

  // Auto-title from first user message
  if (role === 'user' && chat.title === 'Chat Baru') {
    chat.title = text.length > 40 ? text.slice(0, 40) + '…' : text;
  }

  saveAllChats(chats);
}

/**
 * Delete a chat session.
 */
export function deleteChat(id) {
  let chats = getAllChats();
  chats = chats.filter(c => c.id !== id);
  saveAllChats(chats);

  if (getCurrentChatId() === id) {
    setCurrentChatId(null);
  }
}

/**
 * Limit total stored chats to avoid filling localStorage.
 * Keeps the most recent N chats.
 */
export function pruneChats(maxChats = 30) {
  const chats = getAllChats();
  if (chats.length > maxChats) {
    const pruned = chats.slice(0, maxChats);
    saveAllChats(pruned);
  }
}
