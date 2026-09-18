/**
 * Gemini AI integration module.
 * Handles initialization, streaming responses, and chat history.
 */
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT } from './prompt.js';

let aiClient = null;
let chatHistory = [];
let currentModel = 'gemini-3.8-flash';

/**
 * Initialize the Gemini AI client with an API key.
 */
export function initAI(apiKey) {
  aiClient = new GoogleGenAI({ apiKey });
}

/**
 * Set the model to use.
 */
export function setModel(model) {
  currentModel = model;
}

/**
 * Get the current model name.
 */
export function getModel() {
  return currentModel;
}

/**
 * Check if the AI client is initialized.
 */
export function isInitialized() {
  return aiClient !== null;
}

/**
 * Clear chat history (for new chat).
 */
export function clearHistory() {
  chatHistory = [];
}

/**
 * Get the current chat history (for persistence).
 */
export function getHistory() {
  return [...chatHistory];
}

/**
 * Set the chat history (for restoring a saved chat).
 */
export function setHistory(history) {
  chatHistory = history || [];
}

/**
 * Test the API key by making a small request with a timeout.
 * Throws with 'API_KEY_INVALID' in message if key is bad.
 * Throws with 'TIMEOUT' if it takes too long.
 */
export async function testApiKey(apiKey) {
  const testClient = new GoogleGenAI({ apiKey });
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), 10000)
  );
  const requestPromise = testClient.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: 'Hi',
  });

  try {
    const response = await Promise.race([requestPromise, timeoutPromise]);
    if (!response || !response.text) {
      throw new Error('EMPTY_RESPONSE');
    }
    return true;
  } catch (err) {
    throw err;
  }
}

/**
 * Send a message and stream the response.
 * @param {string} userMessage - The user's message
 * @param {function} onChunk - Callback for each streamed text chunk
 * @param {function} onDone - Callback when streaming is complete
 * @param {function} onError - Callback on error
 * @returns {void}
 */
export async function sendMessageStreaming(userMessage, onChunk, onDone, onError) {
  if (!aiClient) {
    onError(new Error('API key belum diatur. Buka Pengaturan untuk memasukkan Gemini API key.'));
    return;
  }

  // Build the contents array with history
  const contents = [];

  // Add history
  for (const msg of chatHistory) {
    contents.push(msg);
  }

  // Add current user message
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  try {
    const stream = await aiClient.models.generateContentStream({
      model: currentModel,
      contents: contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        onChunk(text);
      }
    }

    // Save to history
    chatHistory.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });
    chatHistory.push({
      role: 'model',
      parts: [{ text: fullResponse }]
    });

    // Keep history manageable (last 20 turns = 10 exchanges)
    if (chatHistory.length > 20) {
      chatHistory = chatHistory.slice(-20);
    }

    onDone(fullResponse);
  } catch (error) {
    console.error('AI Error:', error);
    onError(new Error('Terjadi kesalahan, mohon coba lagi.'));
  }
}
