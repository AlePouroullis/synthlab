/**
 * SEQUENCER GRID (Preact)
 * =======================
 * 16-step × 12-note chromatic grid for pattern editing.
 */

import { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'preact/hooks';
import { forwardRef } from 'preact/compat';
import { Pattern, toggleNote, hasNote, clearPattern } from '../sequencer/types';
import { Sequencer } from '../sequencer/sequencer';
import { SynthEngine } from '../synth';

// All 12 chromatic notes
const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function isBlackKey(noteName: string): boolean {
  return noteName.includes('#');
}

function getNoteWithOctave(noteName: string, octave: number): string {
  return `${noteName}${octave}`;
}

export interface SequencerGridRef {
  getSequencer: () => Sequencer;
  getOctave: () => number;
  restoreState: (pattern: Pattern, octave: number, bpm: number) => void;
}

interface Props {
  pattern: Pattern;
  synth: SynthEngine;
  initialOctave?: number;
  onPatternChange?: () => void;
}

export const SequencerGrid = forwardRef<SequencerGridRef, Props>(
  ({ pattern, synth, initialOctave = 4, onPatternChange }, ref) => {
    const [octave, setOctave] = useState(initialOctave);
    const [currentStep, setCurrentStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [, forceUpdate] = useState(0); // For re-rendering after pattern changes

    const sequencerRef = useRef<Sequencer | null>(null);
    const patternRef = useRef(pattern);

    // Keep pattern ref in sync
    useEffect(() => {
      patternRef.current = pattern;
      if (sequencerRef.current) {
        sequencerRef.current.setPattern(pattern);
      }
    }, [pattern]);

    // Initialize sequencer
    useEffect(() => {
      sequencerRef.current = new Sequencer(patternRef.current, synth, {
        onStep: (step) => setCurrentStep(step),
        onStateChange: (state) => setIsPlaying(state === 'playing'),
      });

      return () => {
        sequencerRef.current?.stop();
      };
    }, [synth]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getSequencer: () => sequencerRef.current!,
      getOctave: () => octave,
      restoreState: (newPattern: Pattern, newOctave: number, newBpm: number) => {
        patternRef.current = newPattern;
        sequencerRef.current?.setPattern(newPattern);
        sequencerRef.current!.bpm = newBpm;
        setBpm(newBpm);
        setOctave(newOctave);
        forceUpdate((n) => n + 1);
      },
    }));

    // Handlers
    const handlePlayToggle = useCallback(() => {
      sequencerRef.current?.toggle();
    }, []);

    const handleBpmChange = useCallback((e: Event) => {
      const value = parseInt((e.target as HTMLInputElement).value, 10) || 120;
      setBpm(value);
      if (sequencerRef.current) {
        sequencerRef.current.bpm = value;
      }
    }, []);

    const handleOctaveChange = useCallback((delta: number) => {
      setOctave((prev) => Math.max(1, Math.min(7, prev + delta)));
    }, []);

    const handleCellClick = useCallback(
      (step: number, note: string) => {
        toggleNote(patternRef.current, step, note);
        forceUpdate((n) => n + 1);
        onPatternChange?.();
      },
      [onPatternChange]
    );

    const handleClear = useCallback(() => {
      clearPattern(patternRef.current);
      forceUpdate((n) => n + 1);
      onPatternChange?.();
    }, [onPatternChange]);

    // Render note labels (reversed for high-to-low)
    const noteLabels = [...CHROMATIC_NOTES].reverse().map((noteName) => (
      <div
        key={noteName}
        class={`sequencer-note-label ${isBlackKey(noteName) ? 'black-key' : ''}`}
      >
        {noteName}
      </div>
    ));

    // Render grid columns
    const columns = [];
    for (let step = 0; step < patternRef.current.length; step++) {
      const cells = [...CHROMATIC_NOTES].reverse().map((noteName) => {
        const fullNote = getNoteWithOctave(noteName, octave);
        const isActive = hasNote(patternRef.current, step, fullNote);

        return (
          <div
            key={fullNote}
            class={`sequencer-cell ${isBlackKey(noteName) ? 'black-key' : ''} ${isActive ? 'active' : ''}`}
            onClick={() => handleCellClick(step, fullNote)}
          />
        );
      });

      columns.push(
        <div
          key={step}
          class={`sequencer-column ${step % 4 === 0 ? 'beat-start' : ''} ${currentStep === step && isPlaying ? 'playing' : ''}`}
          data-step={step}
        >
          {cells}
        </div>
      );
    }

    return (
      <div class="sequencer-container">
        {/* Transport controls */}
        <div class="sequencer-transport">
          <button class="transport-btn play-btn" onClick={handlePlayToggle}>
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          <div class="transport-bpm">
            <span>BPM</span>
            <input
              type="number"
              min="20"
              max="300"
              value={bpm}
              onChange={handleBpmChange}
            />
          </div>

          <div class="transport-octave">
            <span>Oct</span>
            <button onClick={() => handleOctaveChange(-1)}>−</button>
            <span class="octave-display">{octave}</span>
            <button onClick={() => handleOctaveChange(1)}>+</button>
          </div>

          <button class="transport-btn clear-btn" onClick={handleClear}>
            Clear
          </button>
        </div>

        {/* Grid */}
        <div class="sequencer-grid">
          <div class="sequencer-labels">{noteLabels}</div>
          {columns}
        </div>
      </div>
    );
  }
);
