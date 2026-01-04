/**
 * MAIN
 * ====
 * Application entry point.
 */

import { render } from 'preact';
import { SynthEngine } from './synth';
import { App } from './components/App';
import { WebSocketClient } from './websocket-client';
import { ChatClient } from './chat';
import './styles/global.css';
import keyboardStyles from './components/Keyboard.module.css';

// Create the synth engine
const synth = new SynthEngine();
(window as any).synth = synth; // Expose for debugging

// Connect to MCP server (optional, for Claude Code integration)
const wsClient = new WebSocketClient(synth);
wsClient.connect();

// Chat client for embedded chat
const chatClient = new ChatClient(synth);

// Render the app
render(
  <App synth={synth} chatClient={chatClient} />,
  document.getElementById('app')!
);

// Keyboard shortcut for M key (toggle computer keyboard)
import { isKeyboardInputEnabled, setKeyboardInputEnabled } from './components/Keyboard';

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    e.preventDefault();
    const newState = !isKeyboardInputEnabled();
    setKeyboardInputEnabled(newState);
    const checkbox = document.querySelector(
      `.${keyboardStyles.keyboardToggle} input[type="checkbox"]`
    ) as HTMLInputElement;
    if (checkbox) checkbox.checked = newState;
  }
});

console.log('SynthLab loaded! Press a key or click the keyboard to start.');
console.log('Tip: Access the synth in console via `window.synth`');
