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

  // Reverb nodes
  private reverbDry: GainNode | null = null;
  private reverbWet: GainNode | null = null;
  private reverbDelays: DelayNode[] = [];
  private reverbFeedbacks: GainNode[] = [];
  private reverbDampingFilters: BiquadFilterNode[] = [];

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

    // Reverb: simple algorithmic reverb using delay lines
    this.reverbDry = this.audioContext.createGain();
    this.reverbWet = this.audioContext.createGain();
    this.reverbDry.gain.value = 1 - this.config.reverbMix;
    this.reverbWet.gain.value = this.config.reverbMix;

    // Create multiple delay lines with different times for diffusion
    const delayTimes = [0.029, 0.037, 0.043, 0.053]; // Prime-ish numbers for less resonance
    const feedbackGain = 0.3 + this.config.reverbDecay * 0.65; // Map 0-1 to 0.3-0.95
    const dampingFreq = 20000 - this.config.reverbDamping * 18000; // Map 0-1 to 20kHz-2kHz

    const reverbMix = this.audioContext.createGain();
    reverbMix.gain.value = 0.25; // Scale down the combined delays

    for (const time of delayTimes) {
      const delay = this.audioContext.createDelay(1);
      delay.delayTime.value = time;

      const feedback = this.audioContext.createGain();
      feedback.gain.value = feedbackGain;

      // Damping filter in feedback loop (lowpass to darken tail)
      const damping = this.audioContext.createBiquadFilter();
      damping.type = 'lowpass';
      damping.frequency.value = dampingFreq;
      damping.Q.value = 0.5;

      // Feedback loop: delay → damping → feedback → delay
      delay.connect(damping);
      damping.connect(feedback);
      feedback.connect(delay);

      // Also send to output
      delay.connect(reverbMix);

      this.reverbDelays.push(delay);
      this.reverbFeedbacks.push(feedback);
      this.reverbDampingFilters.push(damping);
    }

    // Connect: filter → masterGain → [dry path + wet path] → analyser → speakers
    this.filter.connect(this.masterGain);

    // Dry path
    this.masterGain.connect(this.reverbDry);
    this.reverbDry.connect(this.analyser);

    // Wet path (through reverb)
    for (const delay of this.reverbDelays) {
      this.masterGain.connect(delay);
    }
    reverbMix.connect(this.reverbWet);
    this.reverbWet.connect(this.analyser);

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

    if (this.reverbDry && this.reverbWet && config.reverbMix !== undefined) {
      this.reverbDry.gain.value = 1 - this.config.reverbMix;
      this.reverbWet.gain.value = this.config.reverbMix;
    }

    if (config.reverbDecay !== undefined) {
      const feedbackGain = 0.3 + this.config.reverbDecay * 0.65;
      for (const fb of this.reverbFeedbacks) {
        fb.gain.value = feedbackGain;
      }
    }

    if (config.reverbDamping !== undefined) {
      const dampingFreq = 20000 - this.config.reverbDamping * 18000;
      for (const df of this.reverbDampingFilters) {
        df.frequency.value = dampingFreq;
      }
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
