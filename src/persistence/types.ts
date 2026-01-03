/**
 * PERSISTENCE TYPES
 * =================
 * Project state schema with versioning.
 */

import { SynthConfig } from '../synth';

/**
 * Current schema version.
 * Increment when making breaking changes to the project format.
 */
export const CURRENT_VERSION = 1;

/**
 * Serialized pattern format (Map/Set converted to plain objects).
 */
export interface SerializedPattern {
  length: number;
  notes: Record<number, string[]>; // step → array of note names
}

/**
 * Complete project state for saving/loading.
 */
export interface ProjectState {
  version: number;
  savedAt: string; // ISO timestamp
  pattern: SerializedPattern;
  synthConfig: SynthConfig;
  sequencer: {
    bpm: number;
    octave: number;
  };
}

/**
 * Migrate old project formats to current version.
 * Add migration logic here as the schema evolves.
 */
export function migrateProject(state: ProjectState): ProjectState {
  // Currently at v1, no migrations needed yet
  // Future example:
  // if (state.version === 1) {
  //   state = migrateV1toV2(state);
  // }
  return state;
}
