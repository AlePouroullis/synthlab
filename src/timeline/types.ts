/**
 * TIMELINE TYPES
 * ==============
 * Core types for the multi-track timeline.
 */

import { Pattern } from '../sequencer/types';

/**
 * A row in a track grid.
 * For synth: { id: 'C4', label: 'C', accent: false }
 * For drums: { id: 'kick', label: 'Kick', accent: false }
 */
export interface RowDef {
  id: string;
  label: string;
  accent?: boolean; // Visual emphasis (e.g., black keys)
}

/**
 * How a track triggers its sounds.
 */
export interface TrackEngine {
  /** Trigger a sound (note or drum hit) */
  trigger: (rowId: string, stepDuration: number) => void;
  /** Stop all sounds from this engine */
  panic: () => void;
  /** Set the volume for this track (0-1) */
  setVolume?: (value: number) => void;
}

/**
 * A track in the timeline.
 */
export interface Track {
  id: string;
  name: string;
  rows: RowDef[];
  pattern: Pattern;
  engine: TrackEngine;
  volume: number;
  muted: boolean;
}

/**
 * Transport state shared across all tracks.
 */
export interface TransportState {
  bpm: number;
  playing: boolean;
  currentStep: number;
}

/**
 * Chromatic note rows for a synth track.
 */
export function createChromaticRows(octave: number): RowDef[] {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return notes.map((note) => ({
    id: `${note}${octave}`,
    label: note,
    accent: note.includes('#'),
  }));
}

/**
 * Drum rows.
 */
export function createDrumRows(): RowDef[] {
  return [
    { id: 'kick', label: 'Kick' },
    { id: 'snare', label: 'Snare' },
    { id: 'hihat-closed', label: 'HH-C' },
    { id: 'hihat-open', label: 'HH-O' },
  ];
}
