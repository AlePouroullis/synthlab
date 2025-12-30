/**
 * CHAT UI
 * ========
 * Chat panel component.
 */

import { ChatClient } from './client';

const API_KEY_STORAGE_KEY = 'synthlab_api_key';

export function createChatPanel(chatClient: ChatClient): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'chat-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'chat-header';
  header.innerHTML = '<h3>Chat</h3>';
  panel.appendChild(header);

  // Messages container
  const messages = document.createElement('div');
  messages.className = 'chat-messages';
  messages.id = 'chat-messages';
  panel.appendChild(messages);

  // Input area
  const inputArea = document.createElement('div');
  inputArea.className = 'chat-input-area';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'chat-input';
  input.placeholder = 'Ask Claude to play something...';
  input.disabled = true;

  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';
  sendBtn.id = 'chat-send';
  sendBtn.disabled = true;

  inputArea.appendChild(input);
  inputArea.appendChild(sendBtn);
  panel.appendChild(inputArea);

  // API key setup
  const apiKeyArea = document.createElement('div');
  apiKeyArea.className = 'api-key-area';
  apiKeyArea.id = 'api-key-area';

  const apiKeyInput = document.createElement('input');
  apiKeyInput.type = 'password';
  apiKeyInput.id = 'api-key-input';
  apiKeyInput.placeholder = 'Enter Anthropic API key...';

  const apiKeyBtn = document.createElement('button');
  apiKeyBtn.textContent = 'Connect';
  apiKeyBtn.id = 'api-key-btn';

  apiKeyArea.appendChild(apiKeyInput);
  apiKeyArea.appendChild(apiKeyBtn);
  panel.appendChild(apiKeyArea);

  // Check for stored API key
  const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (storedKey) {
    apiKeyInput.value = '••••••••••••••••';
    chatClient.setApiKey(storedKey);
    enableChat();
  }

  // API key button handler
  apiKeyBtn.onclick = () => {
    const key = apiKeyInput.value.trim();
    if (key && !key.startsWith('••')) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
      chatClient.setApiKey(key);
      apiKeyInput.value = '••••••••••••••••';
      enableChat();
      addMessage('system', 'Connected! Try: "Play a C major chord"');
    }
  };

  apiKeyInput.onkeydown = (e) => {
    if (e.key === 'Enter') apiKeyBtn.click();
  };

  function enableChat() {
    input.disabled = false;
    sendBtn.disabled = false;
    input.placeholder = 'Ask Claude to play something...';
    apiKeyArea.classList.add('connected');
  }

  // Send message handler
  async function sendMessage() {
    const text = input.value.trim();
    if (!text || !chatClient.isReady()) return;

    input.value = '';
    addMessage('user', text);

    // Show thinking indicator
    const thinkingId = addMessage('assistant', '...');

    try {
      const response = await chatClient.sendMessage(text, (toolName) => {
        updateMessage(thinkingId, `Using ${toolName}...`);
      });
      updateMessage(thinkingId, response);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      updateMessage(thinkingId, `Error: ${msg}`);
    }
  }

  sendBtn.onclick = sendMessage;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  // Message helpers
  function addMessage(role: 'user' | 'assistant' | 'system', content: string): string {
    const id = `msg-${Date.now()}`;
    const msg = document.createElement('div');
    msg.className = `chat-message ${role}`;
    msg.id = id;
    msg.textContent = content;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return id;
  }

  function updateMessage(id: string, content: string) {
    const msg = document.getElementById(id);
    if (msg) msg.textContent = content;
  }

  return panel;
}
