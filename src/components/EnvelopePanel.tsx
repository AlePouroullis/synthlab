/**
 * ENVELOPE PANEL (Preact)
 * =======================
 * ADSR envelope controls with knobs and visualizer.
 */

import { useRef, useEffect } from 'preact/hooks';
import { ADSREnvelope } from '../synth';
import { ADSRVisualizer } from '../visualizers/adsr';
import { Panel } from './Controls';
import { KnobBank, KnobBankItem } from './KnobBank';

interface Props {
  envelope: ADSREnvelope;
  onChange: (envelope: ADSREnvelope) => void;
}

export function EnvelopePanel({ envelope, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vizRef = useRef<ADSRVisualizer | null>(null);

  // Initialize visualizer
  useEffect(() => {
    if (canvasRef.current && !vizRef.current) {
      vizRef.current = new ADSRVisualizer(canvasRef.current);
    }
  }, []);

  // Sync visualizer with envelope
  useEffect(() => {
    if (vizRef.current) {
      vizRef.current.setConfig(envelope, onChange);
    }
  }, [envelope, onChange]);

  const items: KnobBankItem[] = [
    { id: 'attack', label: 'Attack', min: 0.001, max: 2, value: envelope.attack, unit: 's' },
    { id: 'decay', label: 'Decay', min: 0.001, max: 2, value: envelope.decay, unit: 's' },
    { id: 'sustain', label: 'Sustain', min: 0, max: 1, value: envelope.sustain, unit: '' },
    { id: 'release', label: 'Release', min: 0.001, max: 3, value: envelope.release, unit: 's' },
  ];

  const handleKnobChange = (id: string, value: number) => {
    onChange({ ...envelope, [id]: value });
  };

  return (
    <Panel title="Envelope (ADSR)">
      <KnobBank items={items} onChange={handleKnobChange} />
      <canvas ref={canvasRef} id="adsr-visualizer" />
    </Panel>
  );
}
