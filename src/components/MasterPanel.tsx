/**
 * MASTER PANEL (Preact)
 * =====================
 * Master volume and panic button.
 */

import { useCallback } from 'preact/hooks';
import { SynthEngine } from '../synth';
import { Panel } from './Controls';
import { Knob } from './Knob';
import { Tooltip } from './Tooltip';

interface Props {
  synth: SynthEngine;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

export function MasterPanel({ synth, volume, onVolumeChange }: Props) {
  const handlePanic = useCallback(() => {
    synth.panic();
  }, [synth]);

  return (
    <Panel title="Master">
      <Knob
        label="Volume"
        value={volume}
        min={0}
        max={1}
        onChange={onVolumeChange}
      />
      <button class="panic-btn" onClick={handlePanic}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
        <Tooltip text="Panic — stop all notes" />
      </button>
    </Panel>
  );
}
