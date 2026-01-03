/**
 * SEQUENCER
 * =========
 * Plays a pattern through a synth engine.
 * Uses setInterval for timing (upgrade to Web Audio scheduling if drift is noticeable).
 */

import { SynthEngine } from '../synth';
import { Pattern, getNotesAtStep } from './types';
import { noteToFrequency } from '../synth/types';

export type SequencerState = 'stopped' | 'playing';

export interface SequencerCallbacks {
  onStep?: (step: number) => void;
  onStateChange?: (state: SequencerState) => void;
}

export class Sequencer {
  private pattern: Pattern;
  private synth: SynthEngine;
  private callbacks: SequencerCallbacks;

  private state: SequencerState = 'stopped';
  private currentStep = 0;
  private intervalId: number | null = null;

  // Timing
  private _bpm = 120;

  constructor(pattern: Pattern, synth: SynthEngine, callbacks: SequencerCallbacks = {}) {
    this.pattern = pattern;
    this.synth = synth;
    this.callbacks = callbacks;
  }

  /**
   * Get/set BPM.
   */
  get bpm(): number {
    return this._bpm;
  }

  set bpm(value: number) {
    this._bpm = Math.max(20, Math.min(300, value));

    // If playing, restart with new tempo
    if (this.state === 'playing') {
      this.stop();
      this.play();
    }
  }

  /**
   * Get current playback state.
   */
  getState(): SequencerState {
    return this.state;
  }

  /**
   * Get current step index.
   */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Start playback.
   */
  play(): void {
    if (this.state === 'playing') return;

    this.state = 'playing';
    this.callbacks.onStateChange?.('playing');

    // Calculate step duration: 1 beat = 4 steps (16th notes)
    const stepMs = (60 / this._bpm / 4) * 1000;

    // Play first step immediately
    this.playCurrentStep();

    this.intervalId = window.setInterval(() => {
      this.currentStep = (this.currentStep + 1) % this.pattern.length;
      this.playCurrentStep();
    }, stepMs);
  }

  /**
   * Stop playback.
   */
  stop(): void {
    if (this.state === 'stopped') return;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.synth.panic(); // Stop any ringing notes
    this.state = 'stopped';
    this.currentStep = 0;
    this.callbacks.onStateChange?.('stopped');
    this.callbacks.onStep?.(0); // Reset visual
  }

  /**
   * Toggle between play and stop.
   */
  toggle(): void {
    if (this.state === 'playing') {
      this.stop();
    } else {
      this.play();
    }
  }

  /**
   * Set the pattern (can swap patterns while playing).
   */
  setPattern(pattern: Pattern): void {
    this.pattern = pattern;
    // Wrap current step if new pattern is shorter
    if (this.currentStep >= pattern.length) {
      this.currentStep = 0;
    }
  }

  /**
   * Get the current pattern.
   */
  getPattern(): Pattern {
    return this.pattern;
  }

  /**
   * Play notes at the current step.
   */
  private playCurrentStep(): void {
    const notes = getNotesAtStep(this.pattern, this.currentStep);

    for (const note of notes) {
      const freq = noteToFrequency(note);
      if (freq !== null) {
        // Use a unique ID for each note instance to allow polyphony
        const noteId = freq + this.currentStep * 0.001;
        this.synth.noteOn(freq, noteId);

        // Auto note-off after a 16th note duration (or slightly less for staccato feel)
        const stepMs = (60 / this._bpm / 4) * 1000;
        setTimeout(() => {
          this.synth.noteOff(noteId);
        }, stepMs * 0.8);
      }
    }

    this.callbacks.onStep?.(this.currentStep);
  }
}
