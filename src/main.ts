/**
 * MAIN
 * ====
 * Application entry point. Wires everything together.
 */

import { SynthEngine, DEFAULT_CONFIG } from './synth';
import { createPanel, createSlider, createSelect } from './ui/controls';
import { createKeyboard } from './ui/keyboard';
import { WaveformVisualizer } from './visualizers/waveform';
import { WebSocketClient } from './websocket-client';
import { ChatClient, createChatPanel } from './chat';

// Create the synth engine
const synth = new SynthEngine();
(window as any).synth = synth; // Expose for debugging

// Connect to MCP server (optional, for Claude Code integration)
const wsClient = new WebSocketClient(synth);
wsClient.connect();

// Chat client for embedded chat
const chatClient = new ChatClient(synth);

// DOM elements
const controlsContainer = document.getElementById('synth-controls')!;
const visualizerCanvas = document.getElementById('visualizer') as HTMLCanvasElement;
const chatContainer = document.getElementById('chat-container');

// Visualizer instance
const waveformViz = new WaveformVisualizer(visualizerCanvas);

/**
 * Ensure audio is initialized (lazy initialization on first interaction).
 */
async function ensureAudio(): Promise<void> {
  if (synth.isInitialized()) return;

  await synth.initialize();

  // Start visualization
  const analyser = synth.getAnalyser();
  if (analyser) {
    waveformViz.start(analyser);
  }
}

// Expose for keyboard and other modules
(window as any).ensureAudio = ensureAudio;

// Add chat panel if container exists
if (chatContainer) {
  chatContainer.appendChild(createChatPanel(chatClient));
}

// Chat panel toggle
const chatToggle = document.getElementById('chat-toggle');
const CHAT_VISIBLE_KEY = 'synthlab-chat-visible';

function setChatVisible(visible: boolean): void {
  if (!chatContainer || !chatToggle) return;

  if (visible) {
    chatContainer.classList.remove('hidden');
    chatToggle.classList.add('active');
  } else {
    chatContainer.classList.add('hidden');
    chatToggle.classList.remove('active');
  }

  localStorage.setItem(CHAT_VISIBLE_KEY, String(visible));
}

function toggleChat(): void {
  const isHidden = chatContainer?.classList.contains('hidden');
  setChatVisible(!!isHidden);
}

// Initialize chat visibility from localStorage
const savedVisibility = localStorage.getItem(CHAT_VISIBLE_KEY);
const initiallyVisible = savedVisibility === null ? true : savedVisibility === 'true';
setChatVisible(initiallyVisible);

// Toggle button click
chatToggle?.addEventListener('click', toggleChat);

// Keyboard shortcut: Cmd+/ (Mac) or Ctrl+/ (Windows/Linux)
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === '/') {
    e.preventDefault();
    toggleChat();
  }
});

// Theme toggle
const themeToggle = document.getElementById('theme-toggle');
const THEME_KEY = 'synthlab-theme';

function setTheme(theme: 'dark' | 'light'): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme(): void {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

themeToggle?.addEventListener('click', toggleTheme);

/**
 * Build the UI.
 */
function buildUI(): void {
  controlsContainer.innerHTML = '';

  // Oscillator panel
  const oscPanel = createPanel('Oscillator');
  oscPanel.appendChild(
    createSelect(
      synth,
      'Waveform',
      'waveform',
      [
        { value: 'sine', label: 'Sine (pure tone)' },
        { value: 'triangle', label: 'Triangle (mellow)' },
        { value: 'sawtooth', label: 'Sawtooth (bright)' },
        { value: 'square', label: 'Square (hollow)' },
      ],
      DEFAULT_CONFIG.waveform
    )
  );

  // Filter panel
  const filterPanel = createPanel('Filter');
  filterPanel.appendChild(
    createSelect(
      synth,
      'Type',
      'filterType',
      [
        { value: 'lowpass', label: 'Lowpass' },
        { value: 'highpass', label: 'Highpass' },
        { value: 'bandpass', label: 'Bandpass' },
      ],
      DEFAULT_CONFIG.filterType
    )
  );
  filterPanel.appendChild(
    createSlider(
      synth,
      'Cutoff',
      'filterCutoff',
      20,
      20000,
      DEFAULT_CONFIG.filterCutoff,
      'Hz',
      true
    )
  );
  filterPanel.appendChild(
    createSlider(
      synth,
      'Resonance',
      'filterResonance',
      0.1,
      30,
      DEFAULT_CONFIG.filterResonance,
      'Q'
    )
  );

  // Envelope panel
  const envPanel = createPanel('Envelope (ADSR)');
  envPanel.appendChild(
    createSlider(synth, 'Attack', 'attack', 0.001, 2, DEFAULT_CONFIG.envelope.attack, 's')
  );
  envPanel.appendChild(
    createSlider(synth, 'Decay', 'decay', 0.001, 2, DEFAULT_CONFIG.envelope.decay, 's')
  );
  envPanel.appendChild(
    createSlider(synth, 'Sustain', 'sustain', 0, 1, DEFAULT_CONFIG.envelope.sustain, '')
  );
  envPanel.appendChild(
    createSlider(synth, 'Release', 'release', 0.001, 3, DEFAULT_CONFIG.envelope.release, 's')
  );

  // Master panel
  const masterPanel = createPanel('Master');
  masterPanel.appendChild(createSlider(synth, 'Volume', 'gain', 0, 1, DEFAULT_CONFIG.gain, ''));

  // Panic button (icon only with tooltip)
  const panicBtn = document.createElement('button');
  panicBtn.className = 'panic-btn';
  panicBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
    <span class="tooltip">Panic — stop all notes</span>
  `;
  panicBtn.onclick = () => synth.panic();
  masterPanel.appendChild(panicBtn);

  // Append panels
  controlsContainer.appendChild(oscPanel);
  controlsContainer.appendChild(filterPanel);
  controlsContainer.appendChild(envPanel);
  controlsContainer.appendChild(masterPanel);

  // Keyboard
  controlsContainer.appendChild(createKeyboard(synth));
}

// Initialize
buildUI();

console.log('SynthLab loaded! Press a key or click the keyboard to start.');
console.log('Tip: Access the synth in console via `window.synth`');
