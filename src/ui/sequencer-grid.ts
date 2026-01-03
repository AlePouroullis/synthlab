/**
 * SEQUENCER GRID UI
 * =================
 * 16-step × 8-note grid for pattern editing.
 */

import { Pattern, toggleNote, hasNote, clearPattern } from '../sequencer/types';
import { Sequencer, SequencerState } from '../sequencer/sequencer';
import { SynthEngine } from '../synth';

// All 12 chromatic notes (bottom to top visually = low to high pitch)
const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Check if a note is a "black key" (sharp)
function isBlackKey(noteName: string): boolean {
  return noteName.includes('#');
}

// Map display name to actual note with octave
function getNoteWithOctave(noteName: string, octave: number): string {
  return `${noteName}${octave}`;
}

export interface SequencerGridOptions {
  pattern: Pattern;
  synth: SynthEngine;
  initialOctave?: number;
}

export class SequencerGrid {
  private container: HTMLDivElement;
  private grid: HTMLDivElement;
  private cells: Map<string, HTMLDivElement> = new Map(); // "step-note" → cell element

  private pattern: Pattern;
  private sequencer: Sequencer;
  private octave: number;
  private currentStep = 0;

  constructor(options: SequencerGridOptions) {
    this.pattern = options.pattern;
    this.octave = options.initialOctave ?? 4;

    // Create sequencer with callbacks for UI updates
    this.sequencer = new Sequencer(this.pattern, options.synth, {
      onStep: (step) => this.highlightStep(step),
      onStateChange: (state) => this.updateTransportUI(state),
    });

    this.container = document.createElement('div');
    this.container.className = 'sequencer-container';

    // Transport controls
    const transport = this.createTransport();
    this.container.appendChild(transport);

    // Grid
    this.grid = document.createElement('div');
    this.grid.className = 'sequencer-grid';
    this.container.appendChild(this.grid);

    this.buildGrid();
  }

  /**
   * Get the container element.
   */
  getElement(): HTMLDivElement {
    return this.container;
  }

  /**
   * Get the sequencer instance.
   */
  getSequencer(): Sequencer {
    return this.sequencer;
  }

  /**
   * Get the current octave.
   */
  getOctave(): number {
    return this.octave;
  }

  /**
   * Restore state from a loaded project.
   */
  restoreState(pattern: Pattern, octave: number, bpm: number): void {
    // Update pattern reference
    this.pattern = pattern;
    this.sequencer.setPattern(pattern);

    // Update BPM
    this.sequencer.bpm = bpm;
    const bpmInput = this.container.querySelector('.transport-bpm input') as HTMLInputElement;
    if (bpmInput) bpmInput.value = String(bpm);

    // Update octave and rebuild grid
    this.setOctave(octave);
  }

  /**
   * Create transport controls (play/stop, BPM, clear).
   */
  private createTransport(): HTMLDivElement {
    const transport = document.createElement('div');
    transport.className = 'sequencer-transport';

    // Play/Stop button
    const playBtn = document.createElement('button');
    playBtn.className = 'transport-btn play-btn';
    playBtn.innerHTML = `
      <svg class="play-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5,3 19,12 5,21"/>
      </svg>
      <svg class="stop-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:none">
        <rect x="4" y="4" width="16" height="16"/>
      </svg>
    `;
    playBtn.onclick = () => this.sequencer.toggle();
    transport.appendChild(playBtn);

    // BPM control
    const bpmGroup = document.createElement('div');
    bpmGroup.className = 'transport-bpm';

    const bpmLabel = document.createElement('span');
    bpmLabel.textContent = 'BPM';
    bpmGroup.appendChild(bpmLabel);

    const bpmInput = document.createElement('input');
    bpmInput.type = 'number';
    bpmInput.min = '20';
    bpmInput.max = '300';
    bpmInput.value = String(this.sequencer.bpm);
    bpmInput.onchange = () => {
      this.sequencer.bpm = parseInt(bpmInput.value, 10) || 120;
    };
    bpmGroup.appendChild(bpmInput);

    transport.appendChild(bpmGroup);

    // Octave selector
    const octaveGroup = document.createElement('div');
    octaveGroup.className = 'transport-octave';

    const octaveLabel = document.createElement('span');
    octaveLabel.textContent = 'Oct';
    octaveGroup.appendChild(octaveLabel);

    const octaveDown = document.createElement('button');
    octaveDown.textContent = '−';
    octaveDown.onclick = () => this.setOctave(this.octave - 1);

    const octaveDisplay = document.createElement('span');
    octaveDisplay.className = 'octave-display';
    octaveDisplay.textContent = String(this.octave);

    const octaveUp = document.createElement('button');
    octaveUp.textContent = '+';
    octaveUp.onclick = () => this.setOctave(this.octave + 1);

    octaveGroup.appendChild(octaveDown);
    octaveGroup.appendChild(octaveDisplay);
    octaveGroup.appendChild(octaveUp);
    transport.appendChild(octaveGroup);

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'transport-btn clear-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.onclick = () => {
      clearPattern(this.pattern);
      this.updateAllCells();
    };
    transport.appendChild(clearBtn);

    return transport;
  }

  /**
   * Build the 16×12 chromatic grid.
   */
  private buildGrid(): void {
    this.grid.innerHTML = '';
    this.cells.clear();

    // Note labels column
    const labelsCol = document.createElement('div');
    labelsCol.className = 'sequencer-labels';

    // Reverse order so highest pitch is at top
    for (let i = CHROMATIC_NOTES.length - 1; i >= 0; i--) {
      const noteName = CHROMATIC_NOTES[i];
      const label = document.createElement('div');
      label.className = 'sequencer-note-label';
      if (isBlackKey(noteName)) {
        label.classList.add('black-key');
      }
      label.textContent = noteName;
      labelsCol.appendChild(label);
    }
    this.grid.appendChild(labelsCol);

    // Step columns
    for (let step = 0; step < this.pattern.length; step++) {
      const col = document.createElement('div');
      col.className = 'sequencer-column';
      col.dataset.step = String(step);

      // Highlight every 4 steps (beat markers)
      if (step % 4 === 0) {
        col.classList.add('beat-start');
      }

      // Notes (reversed for high-to-low visual)
      for (let i = CHROMATIC_NOTES.length - 1; i >= 0; i--) {
        const noteName = CHROMATIC_NOTES[i];
        const fullNote = getNoteWithOctave(noteName, this.octave);

        const cell = document.createElement('div');
        cell.className = 'sequencer-cell';
        cell.dataset.step = String(step);
        cell.dataset.note = fullNote;

        // Mark black keys for styling
        if (isBlackKey(noteName)) {
          cell.classList.add('black-key');
        }

        // Check if active
        if (hasNote(this.pattern, step, fullNote)) {
          cell.classList.add('active');
        }

        // Click to toggle
        cell.onclick = () => this.toggleCell(step, fullNote, cell);

        col.appendChild(cell);
        this.cells.set(`${step}-${fullNote}`, cell);
      }

      this.grid.appendChild(col);
    }
  }

  /**
   * Toggle a cell on/off.
   */
  private toggleCell(step: number, note: string, cell: HTMLDivElement): void {
    const isNowActive = toggleNote(this.pattern, step, note);
    cell.classList.toggle('active', isNowActive);
  }

  /**
   * Highlight the current playback step.
   */
  private highlightStep(step: number): void {
    // Remove previous highlight
    const prevCol = this.grid.querySelector(`.sequencer-column[data-step="${this.currentStep}"]`);
    prevCol?.classList.remove('playing');

    // Add new highlight
    this.currentStep = step;
    const col = this.grid.querySelector(`.sequencer-column[data-step="${step}"]`);
    col?.classList.add('playing');
  }

  /**
   * Update transport UI based on state.
   */
  private updateTransportUI(state: SequencerState): void {
    const playIcon = this.container.querySelector('.play-icon') as SVGElement;
    const stopIcon = this.container.querySelector('.stop-icon') as SVGElement;

    if (state === 'playing') {
      playIcon.style.display = 'none';
      stopIcon.style.display = 'block';
    } else {
      playIcon.style.display = 'block';
      stopIcon.style.display = 'none';
    }
  }

  /**
   * Set octave and rebuild grid.
   */
  private setOctave(octave: number): void {
    // Clamp to reasonable range
    octave = Math.max(1, Math.min(7, octave));
    if (octave === this.octave) return;

    this.octave = octave;

    // Update display
    const display = this.container.querySelector('.octave-display');
    if (display) display.textContent = String(octave);

    // Rebuild grid with new octave
    this.buildGrid();
  }

  /**
   * Update all cells to match pattern state (after clear, etc).
   */
  private updateAllCells(): void {
    for (const [key, cell] of this.cells) {
      const [stepStr, note] = key.split('-');
      const step = parseInt(stepStr, 10);
      cell.classList.toggle('active', hasNote(this.pattern, step, note));
    }
  }
}

/**
 * Helper to create a sequencer grid.
 */
export function createSequencerGrid(options: SequencerGridOptions): HTMLDivElement {
  const grid = new SequencerGrid(options);
  return grid.getElement();
}
