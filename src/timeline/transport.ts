/**
 * TRANSPORT
 * =========
 * Shared playback controller for all tracks.
 * Manages BPM, play/stop, and step advancement.
 */

import { Track, TransportState } from './types';
import { getNotesAtStep } from '../sequencer/types';

export interface TransportCallbacks {
  onStep?: (step: number) => void;
  onStateChange?: (playing: boolean) => void;
}

export class Transport {
  private tracks: Track[] = [];
  private callbacks: TransportCallbacks;

  private _bpm = 120;
  private _playing = false;
  private _currentStep = 0;
  private intervalId: number | null = null;
  private patternLength = 16;

  constructor(callbacks: TransportCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Set the tracks this transport controls.
   */
  setTracks(tracks: Track[]): void {
    this.tracks = tracks;
    // Use the first track's pattern length, or default to 16
    if (tracks.length > 0) {
      this.patternLength = tracks[0].pattern.length;
    }
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
    if (this._playing) {
      this.stop();
      this.play();
    }
  }

  /**
   * Get current state.
   */
  getState(): TransportState {
    return {
      bpm: this._bpm,
      playing: this._playing,
      currentStep: this._currentStep,
    };
  }

  /**
   * Start playback.
   */
  play(): void {
    if (this._playing) return;

    this._playing = true;
    this.callbacks.onStateChange?.(true);

    // Calculate step duration: 1 beat = 4 steps (16th notes)
    const stepMs = (60 / this._bpm / 4) * 1000;

    // Play first step immediately
    this.playCurrentStep();

    this.intervalId = window.setInterval(() => {
      this._currentStep = (this._currentStep + 1) % this.patternLength;
      this.playCurrentStep();
    }, stepMs);
  }

  /**
   * Stop playback.
   */
  stop(): void {
    if (!this._playing) return;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Stop all sounds on all tracks
    for (const track of this.tracks) {
      track.engine.panic();
    }

    this._playing = false;
    this._currentStep = 0;
    this.callbacks.onStateChange?.(false);
    this.callbacks.onStep?.(0);
  }

  /**
   * Toggle between play and stop.
   */
  toggle(): void {
    if (this._playing) {
      this.stop();
    } else {
      this.play();
    }
  }

  /**
   * Play all active notes/hits at the current step.
   */
  private playCurrentStep(): void {
    const stepMs = (60 / this._bpm / 4) * 1000;

    for (const track of this.tracks) {
      if (track.muted) continue;

      const activeRows = getNotesAtStep(track.pattern, this._currentStep);
      for (const rowId of activeRows) {
        track.engine.trigger(rowId, stepMs);
      }
    }

    this.callbacks.onStep?.(this._currentStep);
  }
}
