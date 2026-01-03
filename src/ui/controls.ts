/**
 * UI CONTROLS
 * ============
 * Reusable UI components for synth parameters.
 */

import { WaveformType, FilterType } from '../synth/types';
import { SynthEngine } from '../synth/engine';

/**
 * Utility: Format a value for display.
 */
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

/**
 * Logarithmic scaling for frequency sliders.
 */
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

/**
 * Create a control panel container.
 */
export function createPanel(title: string): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'control-panel';

  const heading = document.createElement('h3');
  heading.textContent = title;
  panel.appendChild(heading);

  return panel;
}

/**
 * Create a slider control.
 */
export function createSlider(
  synth: SynthEngine,
  label: string,
  param: string,
  min: number,
  max: number,
  value: number,
  unit: string,
  logarithmic = false,
  onChange?: () => void
): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'slider-group';

  const labelEl = document.createElement('label');
  const nameSpan = document.createElement('span');
  nameSpan.textContent = label;
  const valueSpan = document.createElement('span');
  valueSpan.id = `${param}-value`;
  valueSpan.textContent = formatValue(value, unit);
  labelEl.appendChild(nameSpan);
  labelEl.appendChild(valueSpan);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = `${param}-slider`;
  slider.min = logarithmic ? '0' : String(min);
  slider.max = logarithmic ? '1' : String(max);
  slider.step = logarithmic ? '0.001' : String((max - min) / 1000);
  slider.value = logarithmic ? String(logToLinear(value, min, max)) : String(value);

  slider.oninput = () => {
    let newValue = parseFloat(slider.value);
    if (logarithmic) {
      newValue = linearToLog(newValue, min, max);
    }
    valueSpan.textContent = formatValue(newValue, unit);

    // Update synth config
    if (['attack', 'decay', 'sustain', 'release'].includes(param)) {
      synth.setConfig({ envelope: { ...synth.getConfig().envelope, [param]: newValue } });
    } else {
      synth.setConfig({ [param]: newValue });
    }
    onChange?.();
  };

  // Return focus to document after interaction so keyboard input works
  slider.onmouseup = () => slider.blur();
  slider.ontouchend = () => slider.blur();

  group.appendChild(labelEl);
  group.appendChild(slider);
  return group;
}

/**
 * Create a select dropdown.
 */
export function createSelect(
  synth: SynthEngine,
  label: string,
  param: string,
  options: { value: string; label: string }[],
  currentValue: string
): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'slider-group';

  const labelEl = document.createElement('label');
  labelEl.innerHTML = `<span>${label}</span>`;

  const select = document.createElement('select');
  select.id = `${param}-select`;

  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === currentValue) option.selected = true;
    select.appendChild(option);
  }

  select.onchange = () => {
    if (param === 'waveform') {
      synth.setConfig({ waveform: select.value as WaveformType });
    } else if (param === 'filterType') {
      synth.setConfig({ filterType: select.value as FilterType });
    }
    // Return focus to document after selection
    select.blur();
  };

  group.appendChild(labelEl);
  group.appendChild(select);
  return group;
}
