/**
 * SERIALIZATION
 * =============
 * Convert between runtime state and serializable formats.
 */

import { Pattern, createPattern } from '../sequencer/types';
import { SerializedPattern } from './types';

/**
 * Serialize a Pattern (with Map/Set) to a plain object.
 */
export function serializePattern(pattern: Pattern): SerializedPattern {
  const notes: Record<number, string[]> = {};

  for (const [step, noteSet] of pattern.notes) {
    notes[step] = Array.from(noteSet);
  }

  return {
    length: pattern.length,
    notes,
  };
}

/**
 * Deserialize a plain object back to a Pattern.
 */
export function deserializePattern(data: SerializedPattern): Pattern {
  const pattern = createPattern(data.length);

  for (const [stepStr, noteArray] of Object.entries(data.notes)) {
    const step = parseInt(stepStr, 10);
    pattern.notes.set(step, new Set(noteArray));
  }

  return pattern;
}
