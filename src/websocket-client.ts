/**
 * WEBSOCKET CLIENT
 * =================
 *
 * Connects the browser synth to the MCP server.
 * Receives commands and sends responses.
 */

import { SynthEngine, midiToFrequency } from './synth';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private synth: SynthEngine;
  private reconnectInterval = 2000;
  private statusEl: HTMLElement | null = null;

  constructor(synth: SynthEngine) {
    this.synth = synth;
  }

  connect(): void {
    this.createStatusIndicator();
    this.attemptConnection();
  }

  private createStatusIndicator(): void {
    // Create a status indicator in the UI
    this.statusEl = document.createElement('div');
    this.statusEl.id = 'ws-status';
    this.statusEl.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      z-index: 1000;
    `;
    document.body.appendChild(this.statusEl);
    this.updateStatus('disconnected');
  }

  private updateStatus(status: 'connected' | 'disconnected' | 'connecting'): void {
    if (!this.statusEl) return;

    const statusConfig = {
      connected: { bg: '#22c55e', text: 'MCP Connected' },
      disconnected: { bg: '#ef4444', text: 'MCP Disconnected' },
      connecting: { bg: '#f59e0b', text: 'Connecting...' },
    };

    const config = statusConfig[status];
    this.statusEl.style.background = config.bg;
    this.statusEl.textContent = config.text;
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
