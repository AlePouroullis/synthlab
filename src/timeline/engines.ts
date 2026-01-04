/**
 * TRACK ENGINES
 * =============
 * Adapters that wrap SynthEngine and DrumEngine for use with the timeline.
 */

import { SynthEngine } from '../synth/engine';
import { DrumEngine, DrumType } from '../synth/drums';
import { noteToFrequency } from '../synth/types';
import { TrackEngine } from './types';

/**
 * Create a track engine for the synth.
 * Converts note names to frequencies and handles note-on/off.
 */
export function createSynthTrackEngine(synth: SynthEngine): TrackEngine {
  const activeNotes = new Map<string, number>(); // rowId -> timeoutId

  return {
    trigger(rowId: string, stepDuration: number) {
      const freq = noteToFrequency(rowId);
      if (freq === null) return;

      // Clear any existing timeout for this note
      const existingTimeout = activeNotes.get(rowId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Use a unique ID for polyphony (frequency + small random offset)
      const noteId = freq + Math.random() * 0.001;
      synth.noteOn(freq, noteId);

      // Auto note-off after step duration (slightly shorter for staccato feel)
      const timeoutId = window.setTimeout(() => {
        synth.noteOff(noteId);
        activeNotes.delete(rowId);
      }, stepDuration * 0.8);

      activeNotes.set(rowId, timeoutId);
    },

    panic() {
      // Clear all pending timeouts
      for (const timeoutId of activeNotes.values()) {
        clearTimeout(timeoutId);
      }
      activeNotes.clear();
      synth.panic();
    },

    setVolume(value: number) {
      synth.setConfig({ gain: value });
    },
  };
}

/**
 * Create a track engine for drums.
 * Triggers drum sounds by type.
 */
export function createDrumTrackEngine(drums: DrumEngine): TrackEngine {
  return {
    trigger(rowId: string, _stepDuration: number) {
      // rowId is the drum type: 'kick', 'snare', etc.
      drums.trigger(rowId as DrumType);
    },

    panic() {
      // Drums are one-shot, no sustained sounds to stop
    },

    setVolume(value: number) {
      drums.setVolume(value);
    },
  };
}
