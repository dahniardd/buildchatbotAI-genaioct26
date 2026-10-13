const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const submitBtn = form.querySelector('button[type="submit"]');
const clearBtn = document.getElementById('clear-chat-btn');
const quickChips = document.querySelectorAll('.chip-btn');

// Backend endpoint for chat
const API_URL = 'http://localhost:3000/api/chat';

// Local storage key for persistence
const STORAGE_KEY = 'emerald_assistant_history_v1';

// Initial welcoming greeting
const DEFAULT_WELCOME_MSG = {
  sender: 'bot',
  text: 'Halo! Saya Emerald Assistant, asisten virtual Rumah Sehat Fit Club Emerald di Sawojajar, Malang. Ada yang bisa saya bantu terkait konsultasi nutrisi, analisa komposisi tubuh Tanita, atau jadwal operasional hari ini?',
  time: getCurrentTime()
};

// State arrays
let messages = [];
let conversation = [];

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Clean markdown symbols for display
function cleanMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^(\s*)\*\s+/gm, '$1• ')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/\*/g, '')
    .replace(/~~/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^[-=_]{3,}\s*$/gm, '')
    .trim();
}

// Save conversation and message list to localStorage
function saveStateToStorage() {
  try {
    const payload = {
      messages,
      conversation
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Gagal menyimpan riwayat chat ke localStorage:', err);
  }
}

// Load conversation and message list from localStorage
function loadStateFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Gagal membaca riwayat chat dari localStorage:', err);
    return null;
  }
}

// Append a message bubble to the chat box
function appendMessage(sender, text, time = getCurrentTime(), shouldSave = true) {
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${sender}`;

  const bubble = document.createElement('div');
  bubble.className = `message ${sender}`;
  bubble.textContent = text;
  wrapper.appendChild(bubble);

  const timeEl = document.createElement('span');
  timeEl.className = 'message-time';
  timeEl.textContent = time;
  wrapper.appendChild(timeEl);

  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;

  if (shouldSave) {
    messages.push({ sender, text, time });
    saveStateToStorage();
  }

  return wrapper;
}

// Show typing indicator
function showTypingIndicator() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper bot typing-indicator-wrapper';

  const bubble = document.createElement('div');
  bubble.className = 'message typing';
  bubble.innerHTML = `
    <span>Emerald Assistant sedang mengetik</span>
    <span class="typing-dots">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </span>
  `;
  wrapper.appendChild(bubble);

  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
  return wrapper;
}

// Initialize chat history from localStorage or default
function initChat() {
  chatBox.innerHTML = '';
  const savedState = loadStateFromStorage();

  if (savedState && Array.isArray(savedState.messages) && savedState.messages.length > 0) {
    messages = savedState.messages;
    conversation = Array.isArray(savedState.conversation) ? savedState.conversation : [];

    messages.forEach((msg) => {
      const wrapper = document.createElement('div');
      wrapper.className = `message-wrapper ${msg.sender}`;

      const bubble = document.createElement('div');
      bubble.className = `message ${msg.sender}`;
      bubble.textContent = msg.text;
      wrapper.appendChild(bubble);

      const timeEl = document.createElement('span');
      timeEl.className = 'message-time';
      timeEl.textContent = msg.time || getCurrentTime();
      wrapper.appendChild(timeEl);

      chatBox.appendChild(wrapper);
    });
  } else {
    // Reset to default greeting
    messages = [];
    conversation = [];
    appendMessage(DEFAULT_WELCOME_MSG.sender, DEFAULT_WELCOME_MSG.text, DEFAULT_WELCOME_MSG.time, true);
  }

  chatBox.scrollTop = chatBox.scrollHeight;
}

// Clear history
function handleClearChat() {
  if (confirm('Apakah Anda yakin ingin menghapus semua riwayat percakapan?')) {
    localStorage.removeItem(STORAGE_KEY);
    messages = [];
    conversation = [];
    chatBox.innerHTML = '';
    appendMessage(DEFAULT_WELCOME_MSG.sender, DEFAULT_WELCOME_MSG.text, getCurrentTime(), true);
  }
}

// Quick Chip click handler
function setupQuickChips() {
  quickChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const query = chip.getAttribute('data-query');
      if (query && !input.disabled) {
        input.value = query;
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });
  });
}

// Send message process
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  // 1. Display user message and persist
  appendMessage('user', userMessage, getCurrentTime(), true);

  // 2. Add message to conversation context
  conversation.push({ role: 'user', text: userMessage });
  saveStateToStorage();

  // 3. Clear and disable form controls
  input.value = '';
  input.disabled = true;
  if (submitBtn) submitBtn.disabled = true;

  // 4. Show typing animation
  const typingIndicator = showTypingIndicator();

  try {
    // 5. Send POST request to backend /api/chat
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ conversation })
    });

    const data = await response.json();

    // Remove typing indicator
    typingIndicator.remove();

    if (response.ok && data.result) {
      // 6. Clean text & display
      const cleanedResult = cleanMarkdown(data.result);
      appendMessage('bot', cleanedResult, getCurrentTime(), true);

      // Save assistant response to conversation history (role: 'model')
      conversation.push({ role: 'model', text: cleanedResult });
      saveStateToStorage();
    } else {
      const rawError = data.error || data.message || 'Terjadi kendala saat memproses jawaban.';
      const cleanError = cleanMarkdown(rawError);
      appendMessage('bot error', `⚠️ ${cleanError}`, getCurrentTime(), true);

      // Rollback last user turn from conversation
      conversation.pop();
      saveStateToStorage();
    }
  } catch (error) {
    typingIndicator.remove();
    console.error('API Error:', error);
    appendMessage(
      'bot error',
      '⚠️ Gagal terhubung ke server backend (http://localhost:3000). Pastikan backend server berjalan atau hubungi Coach Niar langsung di 0813-3650-3618.',
      getCurrentTime(),
      true
    );

    // Rollback last user turn from conversation
    conversation.pop();
    saveStateToStorage();
  } finally {
    // Re-enable form controls
    input.disabled = false;
    if (submitBtn) submitBtn.disabled = false;
    input.focus();
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

if (clearBtn) {
  clearBtn.addEventListener('click', handleClearChat);
}

window.addEventListener('DOMContentLoaded', () => {
  initChat();
  setupQuickChips();
});
