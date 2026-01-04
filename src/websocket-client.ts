/**
 * WEBSOCKET CLIENT
 * =================
 *
 * Connects the browser synth to the MCP server.
 * Receives commands and sends responses.
 */

import { SynthEngine, midiToFrequency, DrumEngine, DrumType } from './synth';
import { Pattern, getNotesAtStep } from './sequencer/types';
import { Sequencer } from './sequencer/sequencer';

/**
 * Interface for sequencer operations that can be set by the App component.
 */
export interface SequencerOps {
  getPattern: () => Pattern;
  getSequencer: () => Sequencer;
  setNote: (step: number, note: string, active?: boolean) => void;
  clearPattern: () => void;
  setPattern: (notes: string[][]) => void;
  refresh: () => void; // Force UI update
}

// Global sequencer operations (set by App component)
let sequencerOps: SequencerOps | null = null;

export function setSequencerOps(ops: SequencerOps): void {
  sequencerOps = ops;
}

// Global drum engine (created lazily when first drum command is received)
let drumEngine: DrumEngine | null = null;

// Factory to create drum engine (needs synth reference)
let drumEngineFactory: (() => DrumEngine | null) | null = null;

export function setDrumEngineFactory(factory: () => DrumEngine | null): void {
  drumEngineFactory = factory;
}

function getOrCreateDrumEngine(): DrumEngine | null {
  if (!drumEngine && drumEngineFactory) {
    drumEngine = drumEngineFactory();
  }
  return drumEngine;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private synth: SynthEngine;
  private reconnectInterval = 2000;
  private statusEl: HTMLElement | null = null;

  constructor(synth: SynthEngine) {
    this.synth = synth;
  }

  connect(): void {
    this.statusEl = document.getElementById('mcp-status');
    this.updateStatus('disconnected');
    this.attemptConnection();
  }

  private updateStatus(status: 'connected' | 'disconnected' | 'connecting'): void {
    if (!this.statusEl) return;

    const statusText = {
      connected: 'MCP Connected',
      disconnected: 'MCP Disconnected',
      connecting: 'Connecting...',
    };

    this.statusEl.className = `mcp-status ${status}`;
    this.statusEl.textContent = statusText[status];
  }

  private attemptConnection(): void {
    this.updateStatus('connecting');

    try {
      this.ws = new WebSocket('ws://localhost:8765');

      this.ws.onopen = () => {
        console.log('[WS] Connected to MCP server');
        this.updateStatus('connected');
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected from MCP server');
        this.updateStatus('disconnected');
        // Attempt to reconnect
        setTimeout(() => this.attemptConnection(), this.reconnectInterval);
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Connection error:', error);
      };

      this.ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          const response = await this.handleMessage(message);
          this.ws?.send(JSON.stringify({ id: message.id, ...response }));
        } catch (error) {
          console.error('[WS] Error handling message:', error);
        }
      };
    } catch (error) {
      console.error('[WS] Failed to connect:', error);
      setTimeout(() => this.attemptConnection(), this.reconnectInterval);
    }
  }

  private async handleMessage(message: {
    id: string;
    type: string;
    payload: any;
  }): Promise<{ result?: any; error?: string }> {
    const { type, payload } = message;

    // Ensure synth is initialized
    if (!this.synth.isInitialized() && type !== 'get_config') {
      // Auto-initialize if needed
      await this.synth.initialize();
    }

    try {
      switch (type) {
        case 'get_config':
          return { result: this.synth.getConfig() };

        case 'set_config':
          this.synth.setConfig(payload);
          // Update UI sliders to reflect new values
          this.updateUIFromConfig();
          return { result: this.synth.getConfig() };

        case 'play_note': {
          const { midiNote, duration } = payload;
          const frequency = midiToFrequency(midiNote);
          this.synth.noteOn(frequency, midiNote);

          // Highlight the key if it exists
          this.highlightKey(midiNote, true);

          if (duration) {
            setTimeout(() => {
              this.synth.noteOff(midiNote);
              this.highlightKey(midiNote, false);
            }, duration * 1000);
          }

          return { result: { playing: true, midiNote, frequency } };
        }

        case 'play_sequence': {
          const { notes } = payload;
          let delay = 0;

          for (const note of notes) {
            const { midiNote, duration, gap } = note;

            setTimeout(() => {
              const frequency = midiToFrequency(midiNote);
              this.synth.noteOn(frequency, midiNote);
              this.highlightKey(midiNote, true);

              setTimeout(() => {
                this.synth.noteOff(midiNote);
                this.highlightKey(midiNote, false);
              }, duration * 1000);
            }, delay);

            delay += (duration + gap) * 1000;
          }

          return { result: { playing: true, noteCount: notes.length } };
        }

        case 'play_chord_sequence': {
          const { chords } = payload;
          let delay = 0;

          for (const chord of chords) {
            const { midiNotes, duration, gap } = chord;

            // Schedule this chord
            setTimeout(() => {
              // Play all notes in the chord simultaneously
              for (const midiNote of midiNotes) {
                const frequency = midiToFrequency(midiNote);
                this.synth.noteOn(frequency, midiNote);
                this.highlightKey(midiNote, true);
              }

              // Schedule note-off for all notes in the chord
              setTimeout(() => {
                for (const midiNote of midiNotes) {
                  this.synth.noteOff(midiNote);
                  this.highlightKey(midiNote, false);
                }
              }, duration * 1000);
            }, delay);

            delay += (duration + gap) * 1000;
          }

          return { result: { playing: true, chordCount: chords.length } };
        }

        case 'stop_note': {
          const { midiNote } = payload;
          this.synth.noteOff(midiNote);
          this.highlightKey(midiNote, false);
          return { result: { stopped: true, midiNote } };
        }

        case 'panic':
          this.synth.panic();
          // Remove all key highlights
          document.querySelectorAll('.key.pressed').forEach((el) => {
            el.classList.remove('pressed');
          });
          return { result: { stopped: true } };

        // Sequencer commands
        case 'get_pattern': {
          if (!sequencerOps) return { error: 'Sequencer not available' };
          const pattern = sequencerOps.getPattern();
          // Convert pattern to array of note arrays
          const result: string[][] = [];
          for (let step = 0; step < pattern.length; step++) {
            result.push(getNotesAtStep(pattern, step));
          }
          return { result };
        }

        case 'set_note': {
          if (!sequencerOps) return { error: 'Sequencer not available' };
          const { step, note, active } = payload;
          sequencerOps.setNote(step, note, active);
          sequencerOps.refresh();
          return { result: { step, note, active } };
        }

        case 'clear_pattern': {
          if (!sequencerOps) return { error: 'Sequencer not available' };
          sequencerOps.clearPattern();
          sequencerOps.refresh();
          return { result: { cleared: true } };
        }

        case 'set_pattern': {
          if (!sequencerOps) return { error: 'Sequencer not available' };
          const { pattern: noteArrays } = payload;
          sequencerOps.setPattern(noteArrays);
          sequencerOps.refresh();
          return { result: { steps: noteArrays.length } };
        }

        case 'sequencer_play': {
          if (!sequencerOps) return { error: 'Sequencer not available' };
          sequencerOps.getSequencer().play();
          return { result: { playing: true } };
        }

        case 'sequencer_stop': {
          if (!sequencerOps) return { error: 'Sequencer not available' };
          sequencerOps.getSequencer().stop();
          return { result: { playing: false } };
        }

        case 'set_bpm': {
          if (!sequencerOps) return { error: 'Sequencer not available' };
          const { bpm } = payload;
          sequencerOps.getSequencer().bpm = bpm;
          return { result: { bpm } };
        }

        case 'get_sequencer_state': {
          if (!sequencerOps) return { error: 'Sequencer not available' };
          const seq = sequencerOps.getSequencer();
          return {
            result: {
              bpm: seq.bpm,
              playing: seq.getState() === 'playing',
              currentStep: seq.getCurrentStep(),
            },
          };
        }

        // Drum commands
        case 'trigger_drum': {
          const drums = getOrCreateDrumEngine();
          if (!drums) return { error: 'Drum engine not available (synth not initialized)' };
          const { drum } = payload;
          const validDrums: DrumType[] = ['kick', 'snare', 'hihat-closed', 'hihat-open'];
          if (!validDrums.includes(drum)) {
            return { error: `Invalid drum type: ${drum}. Valid types: ${validDrums.join(', ')}` };
          }
          drums.trigger(drum as DrumType);
          return { result: { triggered: drum } };
        }

        case 'set_drum_volume': {
          const drums = getOrCreateDrumEngine();
          if (!drums) return { error: 'Drum engine not available (synth not initialized)' };
          const { volume } = payload;
          drums.setVolume(volume);
          return { result: { volume } };
        }

        default:
          return { error: `Unknown command: ${type}` };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  private highlightKey(midiNote: number, pressed: boolean): void {
    const keyEl = document.querySelector(`[data-note="${midiNote}"]`);
    if (keyEl) {
      if (pressed) {
        keyEl.classList.add('pressed');
      } else {
        keyEl.classList.remove('pressed');
      }
    }
  }

  private updateUIFromConfig(): void {
    const config = this.synth.getConfig();

    // Update select elements
    const waveformSelect = document.querySelector('select') as HTMLSelectElement;
    if (waveformSelect) waveformSelect.value = config.waveform;

    // Update sliders (this is a simplified version)
    // In a real app, you'd have a more robust way to sync UI state
    const updateSlider = (id: string, value: number, unit: string) => {
      const valueEl = document.getElementById(`${id}-value`);
      if (valueEl) {
        valueEl.textContent = formatValue(value, unit);
      }
    };

    updateSlider('filterCutoff', config.filterCutoff, 'Hz');
    updateSlider('filterResonance', config.filterResonance, 'Q');
    updateSlider('attack', config.envelope.attack, 's');
    updateSlider('decay', config.envelope.decay, 's');
    updateSlider('sustain', config.envelope.sustain, '');
    updateSlider('release', config.envelope.release, 's');
    updateSlider('gain', config.gain, '');
  }
}

function formatValue(value: number, unit: string): string {
  if (unit === 'Hz') {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}kHz`;
    return `${Math.round(value)}Hz`;
  }
  if (unit === 's') {
    if (value < 0.1) return `${Math.round(value * 1000)}ms`;
    return `${value.toFixed(2)}s`;
  }
  return value.toFixed(2);
}
