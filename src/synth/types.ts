/**
 * SYNTH TYPES
 * ===========
 * Type definitions for the synthesizer.
 */

// Oscillator waveform types
export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

// Filter types
export type FilterType = 'lowpass' | 'highpass' | 'bandpass';

// ADSR envelope parameters (in seconds)
export interface ADSREnvelope {
  attack: number;   // Time to reach peak volume
  decay: number;    // Time to fall to sustain level
  sustain: number;  // Volume level while key is held (0-1)
  release: number;  // Time to fade out after key release
}

// Complete synth configuration
export interface SynthConfig {
  waveform: WaveformType;
  gain: number;           // Master volume (0-1)
  filterType: FilterType;
  filterCutoff: number;   // Frequency in Hz (20-20000)
  filterResonance: number; // Q factor (0.1-30)
  envelope: ADSREnvelope;
}

// Default configuration
export const DEFAULT_CONFIG: SynthConfig = {
  waveform: 'sawtooth',
  gain: 0.3,
  filterType: 'lowpass',
  filterCutoff: 2000,
  filterResonance: 1,
  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3
  }
};

// Note names for building a keyboard
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert a MIDI note number to frequency in Hz.
 * MIDI note 69 = A4 = 440 Hz
 */
export function midiToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Get note information from a MIDI note number.
 */
export function getNoteInfo(midiNote: number): { name: string; octave: number; isBlack: boolean } {
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  const name = NOTE_NAMES[noteIndex];
  const isBlack = name.includes('#');
  return { name, octave, isBlack };
}
