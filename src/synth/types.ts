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
  attack: number; // Time to reach peak volume
  decay: number; // Time to fall to sustain level
  sustain: number; // Volume level while key is held (0-1)
  release: number; // Time to fade out after key release
}

// Complete synth configuration
export interface SynthConfig {
  waveform: WaveformType;
  gain: number; // Master volume (0-1)
  filterType: FilterType;
  filterCutoff: number; // Frequency in Hz (20-20000)
  filterResonance: number; // Q factor (0.1-30)
  envelope: ADSREnvelope;
  reverbMix: number; // Wet/dry mix (0-1)
  reverbDecay: number; // Reverb tail length (0-1, maps to feedback)
  reverbDamping: number; // High-frequency damping (0-1, 0=bright, 1=dark)
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
    release: 0.3,
  },
  reverbMix: 0.2,
  reverbDecay: 0.5,
  reverbDamping: 0.3,
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

/**
 * Convert a note name (e.g., "C4", "F#3") to MIDI note number.
 * Returns null if the note name is invalid.
 */
export function noteNameToMidi(noteName: string): number | null {
  // Parse note name: letter + optional # + octave number
  const match = noteName.match(/^([A-G])([#]?)(-?\d+)$/i);
  if (!match) return null;

  const [, letter, sharp, octaveStr] = match;
  const noteBase = letter.toUpperCase();
  const octave = parseInt(octaveStr, 10);

  // Find index in NOTE_NAMES
  const fullNote = sharp ? `${noteBase}#` : noteBase;
  const noteIndex = NOTE_NAMES.indexOf(fullNote);
  if (noteIndex === -1) return null;

  // MIDI note = (octave + 1) * 12 + noteIndex
  return (octave + 1) * 12 + noteIndex;
}

/**
 * Convert a note name (e.g., "C4", "F#3") to frequency in Hz.
 * Returns null if the note name is invalid.
 */
export function noteToFrequency(noteName: string): number | null {
  const midi = noteNameToMidi(noteName);
  if (midi === null) return null;
  return midiToFrequency(midi);
}
