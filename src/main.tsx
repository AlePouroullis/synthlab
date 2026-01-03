/**
 * MAIN
 * ====
 * Application entry point. Wires everything together.
 */

import { render } from 'preact';
import { SynthEngine, DEFAULT_CONFIG, ADSREnvelope } from './synth';
import { createPanel, createSlider, createSelect } from './ui/controls';
import { createKnob, KnobBank } from './ui/knob';
import { createKeyboard, isKeyboardInputEnabled, setKeyboardInputEnabled } from './ui/keyboard';
import { createTooltip } from './ui/tooltip';
import { SequencerGrid } from './ui/sequencer-grid';
import { MenuBar, MenuDefinition } from './components/MenuBar';
import { WaveformVisualizer } from './visualizers/waveform';
import { WebSocketClient } from './websocket-client';
import { ChatClient, createChatPanel } from './chat';
import { ADSRVisualizer } from './visualizers/adsr';
import { Store } from './store';
import { createPattern, clearPattern } from './sequencer/types';
import {
  ProjectState,
  CURRENT_VERSION,
  serializePattern,
  deserializePattern,
  exportToFile,
  importFromFile,
  saveProject,
  loadProject,
  getProjectNames,
  getCurrentProjectName,
  generateUniqueName,
  projectExists,
} from './persistence';

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

// ADSR envelope store (central state for two-way binding)
const envelopeStore = new Store<ADSREnvelope>(DEFAULT_CONFIG.envelope);

// Subscribe: when store changes, update synth
envelopeStore.subscribe((envelope) => {
  synth.setConfig({ envelope });
});

// ADSR visualizer instance
const adsrVisualizerCanvas = document.createElement('canvas');
adsrVisualizerCanvas.setAttribute('id', 'adsr-visualizer');
const adsrViz = new ADSRVisualizer(adsrVisualizerCanvas);

// Sequencer pattern (may be replaced by loaded state)
let pattern = createPattern(16);

// Sequencer grid (set in buildUI, needed for save/load)
let sequencerGrid: SequencerGrid | null = null;

// Visualizer publishes to store on drag
adsrViz.setConfig(envelopeStore.get(), (envelope) => {
  envelopeStore.set(envelope);
});

// Also subscribe visualizer to store (for when knobs change)
envelopeStore.subscribe((envelope) => {
  adsrViz.setConfig(envelope);
});

// ADSR knob bank (created here so store can update it)
const adsrKnobBank = new KnobBank([
  {
    id: 'attack',
    label: 'Attack',
    min: 0.001,
    max: 2,
    value: DEFAULT_CONFIG.envelope.attack,
    unit: 's',
    onChange: (value) => {
      synth.setConfig({ envelope: { ...synth.getConfig().envelope, attack: value } });
      envelopeStore.set(synth.getConfig().envelope);
    },
  },
  {
    id: 'decay',
    label: 'Decay',
    min: 0.001,
    max: 2,
    value: DEFAULT_CONFIG.envelope.decay,
    unit: 's',
    onChange: (value) => {
      synth.setConfig({ envelope: { ...synth.getConfig().envelope, decay: value } });
      envelopeStore.set(synth.getConfig().envelope);
    },
  },
  {
    id: 'sustain',
    label: 'Sustain',
    min: 0,
    max: 1,
    value: DEFAULT_CONFIG.envelope.sustain,
    unit: '',
    onChange: (value) => {
      synth.setConfig({ envelope: { ...synth.getConfig().envelope, sustain: value } });
      envelopeStore.set(synth.getConfig().envelope);
    },
  },
  {
    id: 'release',
    label: 'Release',
    min: 0.001,
    max: 3,
    value: DEFAULT_CONFIG.envelope.release,
    unit: 's',
    onChange: (value) => {
      synth.setConfig({ envelope: { ...synth.getConfig().envelope, release: value } });
      envelopeStore.set(synth.getConfig().envelope);
    },
  },
]);

// Subscribe knob bank to store (for when visualizer changes values)
envelopeStore.subscribe((envelope) => {
  const units: Record<string, string> = { attack: 's', decay: 's', sustain: '', release: 's' };
  for (const param of ['attack', 'decay', 'sustain', 'release'] as const) {
    adsrKnobBank.setValue(param, envelope[param], units[param]);
  }
});

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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Cmd+/ or Ctrl+/ - toggle chat panel
  if ((e.metaKey || e.ctrlKey) && e.key === '/') {
    e.preventDefault();
    toggleChat();
  }

  // M - toggle computer keyboard input (like Ableton)
  if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    // Skip if typing in an input field
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    e.preventDefault();
    const newState = !isKeyboardInputEnabled();
    setKeyboardInputEnabled(newState);
    // Update the checkbox UI
    const checkbox = document.querySelector(
      '.keyboard-toggle input[type="checkbox"]'
    ) as HTMLInputElement;
    if (checkbox) checkbox.checked = newState;
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

// ============================================================================
// PROJECT PERSISTENCE
// ============================================================================

/**
 * Gather current project state for saving.
 */
function gatherProjectState(): ProjectState {
  return {
    version: CURRENT_VERSION,
    savedAt: new Date().toISOString(),
    pattern: serializePattern(pattern),
    synthConfig: synth.getConfig(),
    sequencer: {
      bpm: sequencerGrid?.getSequencer().bpm ?? 120,
      octave: sequencerGrid?.getOctave() ?? 4,
    },
  };
}

/**
 * Restore project state from loaded data.
 */
function restoreProjectState(state: ProjectState): void {
  // Restore pattern
  pattern = deserializePattern(state.pattern);

  // Restore synth config
  synth.setConfig(state.synthConfig);
  envelopeStore.set(state.synthConfig.envelope);

  // Restore sequencer grid state
  sequencerGrid?.restoreState(pattern, state.sequencer.octave, state.sequencer.bpm);

  console.log('Project restored from', state.savedAt);
}

/**
 * Create a new project (reset to defaults).
 */
function handleNew(): void {
  // Prompt for name
  const name = promptProjectName(generateUniqueName());
  if (!name) return;

  // Clear pattern
  pattern = createPattern(16);

  // Reset synth to defaults
  synth.setConfig(DEFAULT_CONFIG);
  envelopeStore.set(DEFAULT_CONFIG.envelope);

  // Reset sequencer grid
  sequencerGrid?.restoreState(pattern, 4, 120);

  // Save with new name
  currentProjectName = name;
  saveProject(currentProjectName, gatherProjectState());
  updateProjectNameDisplay();
  rebuildMenu();

  console.log('New project created:', currentProjectName);
}

/**
 * Save project to current name.
 */
function handleSave(): void {
  const state = gatherProjectState();
  saveProject(currentProjectName, state);
  console.log('Project saved:', currentProjectName);
}

/**
 * Save project with a new name.
 */
function handleSaveAs(): void {
  const name = promptProjectName(currentProjectName);
  if (!name) return;

  if (projectExists(name) && name !== currentProjectName) {
    if (!window.confirm(`"${name}" already exists. Overwrite?`)) {
      return;
    }
  }

  currentProjectName = name;
  const state = gatherProjectState();
  saveProject(currentProjectName, state);
  updateProjectNameDisplay();
  rebuildMenu();

  console.log('Project saved as:', currentProjectName);
}

/**
 * Open a project by name.
 */
function handleOpenProject(name: string): void {
  const state = loadProject(name);
  if (state) {
    currentProjectName = name;
    restoreProjectState(state);
    updateProjectNameDisplay();
    rebuildMenu();
    console.log('Opened project:', name);
  }
}

/**
 * Export project to a JSON file.
 */
function handleExport(): void {
  const state = gatherProjectState();
  exportToFile(state);
}

/**
 * Import project from a JSON file.
 */
async function handleImport(): Promise<void> {
  try {
    const state = await importFromFile();
    restoreProjectState(state);
  } catch (e) {
    // User cancelled or error - just ignore
    if ((e as Error).message !== 'File selection cancelled') {
      console.error('Import failed:', e);
    }
  }
}

// Current project name
let currentProjectName = getCurrentProjectName();

/**
 * Update the project name display in the header.
 */
function updateProjectNameDisplay(): void {
  const titleEl = document.querySelector('header h1');
  if (titleEl) {
    titleEl.textContent = `SynthLab — ${currentProjectName}`;
  }
}

/**
 * Prompt for a project name (simple browser prompt for now).
 */
function promptProjectName(defaultName: string): string | null {
  const name = window.prompt('Project name:', defaultName);
  if (!name || !name.trim()) return null;
  return name.trim();
}

// Auto-save to current project before page unload
window.addEventListener('beforeunload', () => {
  const state = gatherProjectState();
  saveProject(currentProjectName, state);
});

// Load saved state on startup
const savedState = loadProject(currentProjectName);
if (savedState) {
  pattern = deserializePattern(savedState.pattern);
  synth.setConfig(savedState.synthConfig);
  envelopeStore.set(savedState.synthConfig.envelope);
  console.log('Loaded project:', currentProjectName);
}

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

  // Envelope panel (uses module-scope adsrKnobBank)
  const envPanel = createPanel('Envelope (ADSR)');
  envPanel.appendChild(adsrKnobBank.getElement());
  envPanel.appendChild(adsrVisualizerCanvas);

  // Reverb panel
  const reverbPanel = createPanel('Reverb');
  reverbPanel.appendChild(
    createSlider(synth, 'Mix', 'reverbMix', 0, 1, DEFAULT_CONFIG.reverbMix, '')
  );
  reverbPanel.appendChild(
    createSlider(synth, 'Decay', 'reverbDecay', 0, 1, DEFAULT_CONFIG.reverbDecay, '')
  );
  reverbPanel.appendChild(
    createSlider(synth, 'Damping', 'reverbDamping', 0, 1, DEFAULT_CONFIG.reverbDamping, '')
  );

  // Master panel
  const masterPanel = createPanel('Master');
  masterPanel.appendChild(
    createKnob({
      label: 'Volume',
      min: 0,
      max: 1,
      value: DEFAULT_CONFIG.gain,
      onChange: (value) => synth.setConfig({ gain: value }),
    })
  );

  // Panic button (icon only with tooltip)
  const panicBtn = document.createElement('button');
  panicBtn.className = 'panic-btn';
  panicBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
  `;
  panicBtn.appendChild(createTooltip('Panic — stop all notes'));
  panicBtn.onclick = () => synth.panic();
  masterPanel.appendChild(panicBtn);

  // Append panels
  controlsContainer.appendChild(oscPanel);
  controlsContainer.appendChild(filterPanel);
  controlsContainer.appendChild(envPanel);
  controlsContainer.appendChild(reverbPanel);
  controlsContainer.appendChild(masterPanel);

  // Keyboard
  controlsContainer.appendChild(createKeyboard(synth));

  // Sequencer Grid
  sequencerGrid = new SequencerGrid({
    pattern,
    synth,
  });
  controlsContainer.appendChild(sequencerGrid.getElement());

  // Apply loaded state to sequencer grid (after it's created)
  if (savedState) {
    sequencerGrid.restoreState(pattern, savedState.sequencer.octave, savedState.sequencer.bpm);
  }

  // Expose sequencer for debugging
  (window as any).sequencer = sequencerGrid.getSequencer();
}

// Initialize
buildUI();

// Detect platform for keyboard shortcuts
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl+';

// Menu bar container
const menuBarContainer = document.getElementById('menu-bar-container');

/**
 * Build menu definitions for the menu bar.
 */
function buildMenus(): MenuDefinition[] {
  const recentProjects = getProjectNames();

  // Build "Open Recent" submenu items
  const recentSubmenu: MenuDefinition['items'] = recentProjects.slice(0, 8).map((name) => ({
    label: name,
    action: () => handleOpenProject(name),
  }));

  return [
    {
      label: 'File',
      items: [
        { label: 'New Project...', shortcut: `${modKey}N`, action: handleNew },
        { separator: true },
        {
          label: 'Open Recent',
          submenu: recentSubmenu,
          disabled: recentSubmenu.length === 0,
        },
        { label: 'Open from File...', shortcut: `${modKey}O`, action: handleImport },
        { separator: true },
        { label: 'Save', shortcut: `${modKey}S`, action: handleSave },
        { label: 'Save As...', action: handleSaveAs },
        { label: 'Save to File...', shortcut: `${modKey}⇧S`, action: handleExport },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: `${modKey}Z`, disabled: true },
        { label: 'Redo', shortcut: `${modKey}⇧Z`, disabled: true },
        { separator: true },
        {
          label: 'Clear Pattern',
          action: () => {
            clearPattern(pattern);
            sequencerGrid?.restoreState(
              pattern,
              sequencerGrid.getOctave(),
              sequencerGrid.getSequencer().bpm
            );
          },
        },
      ],
    },
  ];
}

/**
 * Rebuild the menu (e.g., after project list changes).
 */
function rebuildMenu(): void {
  if (menuBarContainer) {
    render(<MenuBar menus={buildMenus()} />, menuBarContainer);
  }
}

// Initial menu build
rebuildMenu();

// Update project name display
updateProjectNameDisplay();

// Keyboard shortcuts for menu actions
document.addEventListener('keydown', (e) => {
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if (mod && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    handleNew();
  } else if (mod && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    handleImport();
  } else if (mod && e.key.toLowerCase() === 's' && !e.shiftKey) {
    e.preventDefault();
    handleSave();
  } else if (mod && e.key.toLowerCase() === 's' && e.shiftKey) {
    e.preventDefault();
    handleExport();
  }
});

console.log('SynthLab loaded! Press a key or click the keyboard to start.');
console.log('Tip: Access the synth in console via `window.synth`');
