/**
 * SYNTH CONTROLS (Preact)
 * =======================
 * Main control panels for the synthesizer.
 */

import { useState, useEffect } from 'preact/hooks';
import { SynthEngine, SynthConfig } from '../synth';
import { Panel, Slider, Select } from './Controls';

interface Props {
  synth: SynthEngine;
}

export function SynthControls({ synth }: Props) {
  // Track synth config as state for reactivity
  const [config, setConfig] = useState<SynthConfig>(synth.getConfig());

  // Subscribe to synth config changes (e.g., from MCP)
  useEffect(() => {
    return synth.subscribe(setConfig);
  }, [synth]);

  // Helper to update synth (subscription handles local state)
  const updateConfig = (partial: Partial<SynthConfig>) => {
    synth.setConfig(partial);
  };

  return (
    <>
      {/* Oscillator Panel */}
      <Panel title="Oscillator">
        <Select
          label="Waveform"
          value={config.waveform}
          options={[
            { value: 'sine', label: 'Sine (pure tone)' },
            { value: 'triangle', label: 'Triangle (mellow)' },
            { value: 'sawtooth', label: 'Sawtooth (bright)' },
            { value: 'square', label: 'Square (hollow)' },
          ]}
          onChange={(v) => updateConfig({ waveform: v as SynthConfig['waveform'] })}
        />
      </Panel>

      {/* Filter Panel */}
      <Panel title="Filter">
        <Select
          label="Type"
          value={config.filterType}
          options={[
            { value: 'lowpass', label: 'Lowpass' },
            { value: 'highpass', label: 'Highpass' },
            { value: 'bandpass', label: 'Bandpass' },
          ]}
          onChange={(v) => updateConfig({ filterType: v as SynthConfig['filterType'] })}
        />
        <Slider
          label="Cutoff"
          value={config.filterCutoff}
          min={20}
          max={20000}
          unit="Hz"
          logarithmic
          onChange={(v) => updateConfig({ filterCutoff: v })}
        />
        <Slider
          label="Resonance"
          value={config.filterResonance}
          min={0.1}
          max={30}
          unit="Q"
          onChange={(v) => updateConfig({ filterResonance: v })}
        />
      </Panel>

      {/* Reverb Panel */}
      <Panel title="Reverb">
        <Slider
          label="Mix"
          value={config.reverbMix}
          min={0}
          max={1}
          onChange={(v) => updateConfig({ reverbMix: v })}
        />
        <Slider
          label="Decay"
          value={config.reverbDecay}
          min={0}
          max={1}
          onChange={(v) => updateConfig({ reverbDecay: v })}
        />
        <Slider
          label="Damping"
          value={config.reverbDamping}
          min={0}
          max={1}
          onChange={(v) => updateConfig({ reverbDamping: v })}
        />
      </Panel>
    </>
  );
}
