/**
 * SYNTH ENGINE
 * ============
 * Core Web Audio synthesis.
 *
 * Audio Graph:
 *   [Oscillator] → [Gain (envelope)] → [Filter] → [Master Gain] → [Analyser] → [Output]
 */

import { SynthConfig, DEFAULT_CONFIG } from './types';

export class SynthEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Active voices (for polyphony)
  private activeVoices: Map<number, { oscillator: OscillatorNode; gain: GainNode }> = new Map();

  // Current configuration
  private config: SynthConfig = { ...DEFAULT_CONFIG };

  /**
   * Initialize the audio context.
   * Must be called after a user gesture (click/keypress).
   */
  async initialize(): Promise<void> {
    if (this.audioContext) return;

    this.audioContext = new AudioContext();

    // Master gain (overall volume)
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.config.gain;

    // Filter
    this.filter = this.audioContext.createBiquadFilter();
    this.filter.type = this.config.filterType;
    this.filter.frequency.value = this.config.filterCutoff;
    this.filter.Q.value = this.config.filterResonance;

    // Analyser for visualization
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;

    // Connect: filter → masterGain → analyser → speakers
    this.filter.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    console.log('Synth engine initialized!');
  }

  /**
   * Play a note at a given frequency.
   */
  noteOn(frequency: number, noteId: number = frequency): void {
    if (!this.audioContext || !this.filter) {
      console.warn('Synth not initialized. Call initialize() first.');
      return;
    }

    this.noteOff(noteId);

    const now = this.audioContext.currentTime;
    const { attack, decay, sustain } = this.config.envelope;

    // Create oscillator
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = this.config.waveform;
    oscillator.frequency.value = frequency;

    // Create envelope gain
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0;

    // Connect: oscillator → envelope → filter
    oscillator.connect(gainNode);
    gainNode.connect(this.filter);

    // Apply ADSR (Attack-Decay-Sustain)
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + attack);
    gainNode.gain.linearRampToValueAtTime(sustain, now + attack + decay);

    oscillator.start(now);
    this.activeVoices.set(noteId, { oscillator, gain: gainNode });
  }

  /**
   * Release a note (apply Release phase).
   */
  noteOff(noteId: number): void {
    const voice = this.activeVoices.get(noteId);
    if (!voice || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    const { release } = this.config.envelope;

    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + release);

    voice.oscillator.stop(now + release + 0.01);
    this.activeVoices.delete(noteId);
  }

  /**
   * Stop all playing notes immediately.
   */
  panic(): void {
    for (const noteId of this.activeVoices.keys()) {
      this.noteOff(noteId);
    }
  }

  /**
   * Update the synth configuration.
   */
  setConfig(config: Partial<SynthConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.masterGain) {
      this.masterGain.gain.value = this.config.gain;
    }

    if (this.filter) {
      this.filter.type = this.config.filterType;
      this.filter.frequency.value = this.config.filterCutoff;
      this.filter.Q.value = this.config.filterResonance;
    }

    if (config.envelope) {
      this.config.envelope = { ...this.config.envelope, ...config.envelope };
    }
  }

  /**
   * Get the current configuration.
   */
  getConfig(): SynthConfig {
    return { ...this.config };
  }

  /**
   * Get the analyser node for visualization.
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Get the filter node for visualization.
   */
  getFilter(): BiquadFilterNode | null {
    return this.filter;
  }

  /**
   * Get the audio context.
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Check if the synth is initialized.
   */
  isInitialized(): boolean {
    return this.audioContext !== null;
  }
}
