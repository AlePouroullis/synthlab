/**
 * SEQUENCER (Preact)
 * ==================
 * Wrapper for the SequencerGrid class component.
 */

import { useRef, useEffect, useImperativeHandle } from 'preact/hooks';
import { forwardRef } from 'preact/compat';
import { SynthEngine } from '../synth';
import { SequencerGrid } from '../ui/sequencer-grid';
import { Pattern } from '../sequencer/types';

export interface SequencerRef {
  getSequencer: () => ReturnType<SequencerGrid['getSequencer']>;
  getOctave: () => number;
  restoreState: (pattern: Pattern, octave: number, bpm: number) => void;
  getElement: () => HTMLElement;
}

interface Props {
  pattern: Pattern;
  synth: SynthEngine;
}

export const Sequencer = forwardRef<SequencerRef, Props>(({ pattern, synth }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<SequencerGrid | null>(null);

  // Initialize SequencerGrid once
  useEffect(() => {
    if (containerRef.current && !gridRef.current) {
      gridRef.current = new SequencerGrid({ pattern, synth });
      containerRef.current.appendChild(gridRef.current.getElement());
    }
  }, [pattern, synth]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getSequencer: () => gridRef.current!.getSequencer(),
    getOctave: () => gridRef.current!.getOctave(),
    restoreState: (p: Pattern, octave: number, bpm: number) => {
      gridRef.current?.restoreState(p, octave, bpm);
    },
    getElement: () => gridRef.current!.getElement(),
  }));

  return <div ref={containerRef} class="sequencer-wrapper" />;
});
