/**
 * Chat UI module.
 * Handles message rendering, streaming display, and scroll management.
 * Supports markdown (via marked) and LaTeX math (via KaTeX).
 */
import { marked } from 'marked';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

const chatMessages = () => document.getElementById('chat-messages');
const chatContainer = () => document.getElementById('chat-container');
const welcomeScreen = () => document.getElementById('welcome-screen');

/**
 * Render LaTeX math expressions in HTML string using KaTeX.
 * Handles both block ($$...$$) and inline ($...$) math.
 */
function renderMath(html) {
  if (typeof window.katex === 'undefined') return html;

  // Replace block math: $$...$$
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
    try {
      return window.katex.renderToString(tex.trim(), {
        displayMode: true,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return match;
    }
  });

  // Replace inline math: $...$
  // Avoid matching things like $5 or currency amounts
  html = html.replace(/(?<!\w)\$([^\$\n]+?)\$(?!\w)/g, (match, tex) => {
    try {
      return window.katex.renderToString(tex.trim(), {
        displayMode: false,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return match;
    }
  });

  return html;
}

/**
 * Process AI text: markdown + math rendering.
 */
function renderContent(text) {
  let html = marked.parse(text);
  html = renderMath(html);
  return html;
}

/**
 * Hide the welcome screen.
 */
function hideWelcome() {
  const ws = welcomeScreen();
  if (ws) ws.classList.add('hidden');
}

/**
 * Show the welcome screen.
 */
export function showWelcome() {
  const ws = welcomeScreen();
  if (ws) ws.classList.remove('hidden');
}

/**
 * Clear all chat messages and show welcome screen.
 */
export function clearChat() {
  const container = chatMessages();
  if (container) container.innerHTML = '';
  showWelcome();
}

/**
 * Restore messages from saved history (no animation).
 * @param {Array} messages - Array of { role: 'user'|'ai', text: string }
 */
export function restoreMessages(messages) {
  const container = chatMessages();
  if (!container) return;
  container.innerHTML = '';
  hideWelcome();

  for (const msg of messages) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${msg.role === 'user' ? 'user' : 'ai'}`;

    if (msg.role === 'user') {
      messageEl.innerHTML = `
        <div class="message-header">
          <div class="message-avatar user">👤</div>
          <span class="message-sender">Kamu</span>
        </div>
        <div class="message-body">${escapeHtml(msg.text)}</div>
      `;
    } else {
      messageEl.innerHTML = `
        <div class="message-header">
          <div class="message-avatar ai">⚡</div>
          <span class="message-sender">Visualizer AI</span>
        </div>
        <div class="message-body">${renderContent(msg.text)}</div>
      `;
    }

    container.appendChild(messageEl);
  }

  scrollToBottom();
}

/**
 * Scroll to the bottom of the chat container.
 */
function scrollToBottom() {
  const container = chatContainer();
  if (container) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }
}

/**
 * Add a user message to the chat.
 * @param {string} text - The user's message
 */
export function addUserMessage(text) {
  hideWelcome();

  const container = chatMessages();
  const messageEl = document.createElement('div');
  messageEl.className = 'message user';
  messageEl.innerHTML = `
    <div class="message-header">
      <div class="message-avatar user">👤</div>
      <span class="message-sender">Kamu</span>
    </div>
    <div class="message-body">${escapeHtml(text)}</div>
  `;

  container.appendChild(messageEl);
  scrollToBottom();
}

/**
 * Create an AI message placeholder with typing indicator.
 * Returns an object with methods to update the message.
 */
export function createAIMessage() {
  hideWelcome();

  const container = chatMessages();
  const messageEl = document.createElement('div');
  messageEl.className = 'message ai';

  const bodyEl = document.createElement('div');
  bodyEl.className = 'message-body';

  messageEl.innerHTML = `
    <div class="message-header">
      <div class="message-avatar ai">⚡</div>
      <span class="message-sender">Visualizer AI</span>
    </div>
  `;

  // Show typing indicator first
  bodyEl.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;

  messageEl.appendChild(bodyEl);
  container.appendChild(messageEl);
  scrollToBottom();

  let accumulatedText = '';
  let isFirstChunk = true;
  let renderTimeout = null;

  return {
    /**
     * Append a chunk of text (streaming).
     */
    appendChunk(text) {
      if (isFirstChunk) {
        bodyEl.innerHTML = '';
        isFirstChunk = false;
      }

      accumulatedText += text;

      // Debounce rendering for performance
      if (renderTimeout) clearTimeout(renderTimeout);
      renderTimeout = setTimeout(() => {
        bodyEl.innerHTML = renderContent(accumulatedText) + '<span class="cursor-blink"></span>';
        scrollToBottom();
      }, 50);
    },

    /**
     * Finalize the message (remove cursor, final render).
     */
    finalize() {
      if (renderTimeout) clearTimeout(renderTimeout);
      bodyEl.innerHTML = renderContent(accumulatedText);
      scrollToBottom();
    },

    /**
     * Show an error in the message area.
     */
    showError(errorMessage) {
      bodyEl.innerHTML = `<div class="error-inline">⚠️ ${escapeHtml(errorMessage)}</div>`;
      scrollToBottom();
    }
  };
}

/**
 * Escape HTML to prevent XSS in user messages.
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
