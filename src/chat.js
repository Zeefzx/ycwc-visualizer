/**
 * Chat UI module.
 * Handles message rendering, streaming display, scroll management,
 * and inline interactive HTML visualizations.
 * Supports markdown (via marked), LaTeX math (via KaTeX), and HTML sandboxing.
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

// Counter for unique iframe IDs
let vizCounter = 0;

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
 * Extract HTML code blocks from markdown text and replace them with placeholders.
 * Returns { cleanText, visualizations[] }
 */
function extractVisualizations(text) {
  const visualizations = [];
  // Match ```html ... ``` code blocks (the AI generates these)
  const regex = /```html\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const htmlCode = match[1].trim();
    // Only treat as visualization if it looks like a full HTML document or has canvas/svg
    if (
      htmlCode.includes('<canvas') ||
      htmlCode.includes('<svg') ||
      htmlCode.includes('<!DOCTYPE') ||
      htmlCode.includes('<html') ||
      htmlCode.includes('requestAnimationFrame') ||
      htmlCode.includes('<style')
    ) {
      const id = `viz-${++vizCounter}`;
      visualizations.push({ id, html: htmlCode, fullMatch: match[0] });
    }
  }

  return { visualizations };
}

/**
 * Create a sandboxed iframe for an HTML visualization.
 * @param {string} htmlCode - The full HTML code to render
 * @param {string} id - Unique ID for the iframe
 * @returns {string} HTML string for the visualization container
 */
function createVisualizationHTML(htmlCode, id) {
  // Encode the HTML for the srcdoc attribute
  const encodedHtml = htmlCode
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');

  return `
    <div class="viz-container" id="${id}">
      <div class="viz-header">
        <span class="viz-label">📊 Visualisasi Interaktif</span>
        <div class="viz-actions">
          <button class="viz-btn viz-btn-expand" data-viz-id="${id}" title="Perbesar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </div>
      </div>
      <iframe
        class="viz-iframe"
        sandbox="allow-scripts"
        srcdoc="${encodedHtml}"
        loading="lazy"
      ></iframe>
    </div>
  `;
}

/**
 * Process AI text: markdown + math rendering + visualization embedding.
 */
function renderContent(text) {
  const { visualizations } = extractVisualizations(text);

  // First render markdown normally
  let html = marked.parse(text);
  html = renderMath(html);

  // Now replace the rendered code blocks with interactive iframes
  // marked will have wrapped the HTML code blocks in <pre><code> tags
  for (const viz of visualizations) {
    // Find the <pre><code> block that contains this visualization's code
    // We need to match the rendered version (marked escapes HTML entities in code blocks)
    const vizHtml = createVisualizationHTML(viz.html, viz.id);

    // Strategy: find <pre> blocks that contain key parts of the visualization code
    // marked renders ```html as <pre><code class="language-html">...</code></pre>
    const preRegex = /<pre><code class="language-html">[\s\S]*?<\/code><\/pre>/;
    const preMatch = html.match(preRegex);

    if (preMatch) {
      html = html.replace(preMatch[0], vizHtml);
    }
  }

  return html;
}

/**
 * Attach event listeners to visualization buttons after rendering.
 */
function attachVizListeners(containerEl) {
  // Expand/fullscreen buttons
  containerEl.querySelectorAll('.viz-btn-expand').forEach(btn => {
    btn.addEventListener('click', () => {
      const vizId = btn.dataset.vizId;
      const vizContainer = document.getElementById(vizId);
      if (vizContainer) {
        vizContainer.classList.toggle('viz-expanded');
        // Update button icon
        const isExpanded = vizContainer.classList.contains('viz-expanded');
        btn.title = isExpanded ? 'Kecilkan' : 'Perbesar';
      }
    });
  });
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
      messageEl.innerHTML = `<div class="message-bubble user-bubble">${escapeHtml(msg.text)}</div>`;
    } else {
      messageEl.innerHTML = `<div class="message-bubble ai-bubble">${renderContent(msg.text)}</div>`;
      // Attach viz listeners after DOM insertion
      setTimeout(() => attachVizListeners(messageEl), 0);
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
  messageEl.innerHTML = `<div class="message-bubble user-bubble">${escapeHtml(text)}</div>`;

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

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'message-bubble ai-bubble';

  // Show typing indicator first
  bubbleEl.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;

  messageEl.appendChild(bubbleEl);
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
        bubbleEl.innerHTML = '';
        isFirstChunk = false;
      }

      accumulatedText += text;

      // Debounce rendering for performance
      if (renderTimeout) clearTimeout(renderTimeout);
      renderTimeout = setTimeout(() => {
        bubbleEl.innerHTML = renderContent(accumulatedText) + '<span class="cursor-blink"></span>';
        scrollToBottom();
      }, 50);
    },

    /**
     * Finalize the message (remove cursor, final render).
     */
    finalize() {
      if (renderTimeout) clearTimeout(renderTimeout);
      bubbleEl.innerHTML = renderContent(accumulatedText);
      // Attach visualization listeners after final render
      setTimeout(() => attachVizListeners(messageEl), 100);
      scrollToBottom();
    },

    /**
     * Show an error with a retry button.
     * @param {string} errorMessage - The error text
     * @param {function} [onRetry] - Callback when retry is clicked
     */
    showError(errorMessage, onRetry) {
      bubbleEl.innerHTML = `<div class="error-inline">⚠️ ${escapeHtml(errorMessage)}</div>`;

      if (onRetry) {
        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn-retry';
        retryBtn.title = 'Coba lagi';
        retryBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          <span>Coba lagi</span>
        `;
        retryBtn.addEventListener('click', () => {
          // Remove the error message + retry button
          messageEl.remove();
          onRetry();
        });
        messageEl.appendChild(retryBtn);
      }

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
