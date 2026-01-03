/**
 * KNOB BANK (Preact)
 * ==================
 * A row of knobs with editable value displays and labels.
 */

import { useState, useCallback } from 'preact/hooks';
import { JSX } from 'preact';
import { Knob } from './Knob';
import { formatValue } from './Controls';

export interface KnobBankItem {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  unit?: string;
}

interface Props {
  items: KnobBankItem[];
  onChange?: (id: string, value: number) => void;
}

export function KnobBank({ items, onChange }: Props) {
  // Track which value is being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleValueClick = useCallback((item: KnobBankItem) => {
    setEditingId(item.id);
    setEditValue(String(item.value));
  }, []);

  const commitEdit = useCallback(
    (item: KnobBankItem) => {
      let newValue = parseFloat(editValue);
      if (isNaN(newValue)) {
        newValue = item.value;
      }
      newValue = Math.max(item.min, Math.min(item.max, newValue));
      newValue = Math.round(newValue * 1000) / 1000;
      onChange?.(item.id, newValue);
      setEditingId(null);
    },
    [editValue, onChange]
  );

  const handleKeyDown = useCallback(
    (e: JSX.TargetedKeyboardEvent<HTMLInputElement>, item: KnobBankItem) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit(item);
      } else if (e.key === 'Escape') {
        setEditingId(null);
      }
    },
    [commitEdit]
  );

  return (
    <div class="knob-bank">
      {/* Values row */}
      <div class="knob-bank-values">
        {items.map((item) => (
          <span key={item.id} class="knob-bank-value-wrapper">
            {editingId === item.id ? (
              <input
                type="number"
                class="knob-bank-input"
                value={editValue}
                min={item.min}
                max={item.max}
                step="any"
                autoFocus
                onInput={(e) => setEditValue(e.currentTarget.value)}
                onBlur={() => commitEdit(item)}
                onKeyDown={(e) => handleKeyDown(e, item)}
              />
            ) : (
              <span
                class="knob-bank-value"
                onClick={() => handleValueClick(item)}
              >
                {formatValue(item.value, item.unit ?? '')}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Knobs row */}
      <div class="knob-bank-knobs">
        {items.map((item) => (
          <Knob
            key={item.id}
            label={item.label}
            value={item.value}
            min={item.min}
            max={item.max}
            unit={item.unit}
            showLabel={false}
            onChange={(v) => onChange?.(item.id, v)}
          />
        ))}
      </div>

      {/* Labels row */}
      <div class="knob-bank-labels">
        {items.map((item) => (
          <span key={item.id}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}
