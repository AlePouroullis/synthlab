/**
 * SEQUENCER TYPES
 * ===============
 * Pattern data structure — the primitive for sequencing and arrangement.
 */

/**
 * A pattern is a grid of notes over time.
 * - `length`: number of steps (16 = 1 bar at 16th notes)
 * - `notes`: Map from step index → Set of note names at that step
 */
export interface Pattern {
  length: number;
  notes: Map<number, Set<string>>;
}

/**
 * Create an empty pattern with the given length.
 */
export function createPattern(length: number = 16): Pattern {
  return {
    length,
    notes: new Map(),
  };
}

/**
 * Toggle a note at a specific step.
 * Returns true if note was added, false if removed.
 */
export function toggleNote(pattern: Pattern, step: number, note: string): boolean {
  if (!pattern.notes.has(step)) {
    pattern.notes.set(step, new Set());
  }

  const stepNotes = pattern.notes.get(step)!;

  if (stepNotes.has(note)) {
    stepNotes.delete(note);
    if (stepNotes.size === 0) {
      pattern.notes.delete(step);
    }
    return false;
  } else {
    stepNotes.add(note);
    return true;
  }
}

/**
 * Check if a note is active at a specific step.
 */
export function hasNote(pattern: Pattern, step: number, note: string): boolean {
  return pattern.notes.get(step)?.has(note) ?? false;
}

/**
 * Get all notes at a specific step.
 */
export function getNotesAtStep(pattern: Pattern, step: number): string[] {
  const stepNotes = pattern.notes.get(step);
  return stepNotes ? Array.from(stepNotes) : [];
}

/**
 * Clear all notes from a pattern.
 */
export function clearPattern(pattern: Pattern): void {
  pattern.notes.clear();
}
