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

// Create the synth engine
const synth = new SynthEngine();
(window as any).synth = synth; // Expose for debugging

// Connect to MCP server
const wsClient = new WebSocketClient(synth);
wsClient.connect();

// DOM elements
const controlsContainer = document.getElementById('synth-controls')!;
const visualizerCanvas = document.getElementById('visualizer') as HTMLCanvasElement;

// Visualizer instance
const waveformViz = new WaveformVisualizer(visualizerCanvas);

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

  // Start button
  const startBtn = document.createElement('button');
  startBtn.textContent = 'Start Audio';
  startBtn.id = 'start-btn';
  startBtn.onclick = async () => {
    await synth.initialize();
    startBtn.textContent = 'Audio Ready!';
    startBtn.disabled = true;

    // Start visualization
    const analyser = synth.getAnalyser();
    if (analyser) {
      waveformViz.start(analyser);
    }
  };
  masterPanel.appendChild(startBtn);

  // Panic button
  const panicBtn = document.createElement('button');
  panicBtn.textContent = 'Panic (Stop All)';
  panicBtn.style.background = '#ff6b6b';
  panicBtn.style.marginLeft = '10px';
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

console.log('Web Synth loaded! Click "Start Audio" to begin.');
console.log('Tip: Access the synth in console via `window.synth`');
