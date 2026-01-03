/**
 * CONTROLS (Preact)
 * =================
 * Reusable UI components for synth parameters.
 */

import { JSX } from 'preact';
import { useCallback } from 'preact/hooks';

// ============================================================================
// UTILITIES
// ============================================================================

export function formatValue(value: number, unit: string): string {
  if (unit === 'Hz') {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}kHz`;
    }
    return `${Math.round(value)}Hz`;
  }
  if (unit === 's') {
    if (value < 0.1) {
      return `${Math.round(value * 1000)}ms`;
    }
    return `${value.toFixed(2)}s`;
  }
  return value.toFixed(2);
}

export function linearToLog(value: number, min: number, max: number): number {
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  return Math.exp(minLog + value * (maxLog - minLog));
}

export function logToLinear(value: number, min: number, max: number): number {
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  return (Math.log(value) - minLog) / (maxLog - minLog);
}

// ============================================================================
// PANEL
// ============================================================================

interface PanelProps {
  title: string;
  children: JSX.Element | JSX.Element[];
}

export function Panel({ title, children }: PanelProps) {
  return (
    <div class="control-panel">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// ============================================================================
// SLIDER
// ============================================================================

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  logarithmic?: boolean;
  onChange: (value: number) => void;
}

export function Slider({
  label,
  value,
  min,
  max,
  unit = '',
  logarithmic = false,
  onChange,
}: SliderProps) {
  // Convert actual value to slider position
  const sliderValue = logarithmic ? logToLinear(value, min, max) : value;
  const sliderMin = logarithmic ? 0 : min;
  const sliderMax = logarithmic ? 1 : max;
  const sliderStep = logarithmic ? 0.001 : (max - min) / 1000;

  const handleInput = useCallback(
    (e: JSX.TargetedEvent<HTMLInputElement>) => {
      let newValue = parseFloat(e.currentTarget.value);
      if (logarithmic) {
        newValue = linearToLog(newValue, min, max);
      }
      onChange(newValue);
    },
    [logarithmic, min, max, onChange]
  );

  const handleBlur = useCallback((e: JSX.TargetedEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  }, []);

  return (
    <div class="slider-group">
      <label>
        <span>{label}</span>
        <span>{formatValue(value, unit)}</span>
      </label>
      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={sliderStep}
        value={sliderValue}
        onInput={handleInput}
        onMouseUp={handleBlur}
        onTouchEnd={handleBlur}
      />
    </div>
  );
}

// ============================================================================
// SELECT
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export function Select({ label, value, options, onChange }: SelectProps) {
  const handleChange = useCallback(
    (e: JSX.TargetedEvent<HTMLSelectElement>) => {
      onChange(e.currentTarget.value);
      e.currentTarget.blur();
    },
    [onChange]
  );

  return (
    <div class="slider-group">
      <label>
        <span>{label}</span>
      </label>
      <select value={value} onChange={handleChange}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
