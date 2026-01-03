/**
 * KNOB
 * ====
 * SVG-based rotary knob control with drag interaction.
 */

import { formatValue } from './controls';

// Knob visual constants
const SIZE = 40; // px
const RADIUS = 16;
const CENTER = SIZE / 2;
const TRACK_RADIUS = RADIUS - 4; // Arc track sits inside the knob

// Rotation range: 7 o'clock (-135°) to 5 o'clock (+135°) = 270° sweep
const MIN_ANGLE = -135;
const MAX_ANGLE = 135;

/**
 * Convert angle (in degrees, 0° = up) to x,y coordinates on a circle.
 */
function angleToPoint(angleDeg: number, radius: number): [number, number] {
  // Convert to radians, offset by -90° so 0° points up
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(angleRad), CENTER + radius * Math.sin(angleRad)];
}

/**
 * Generate an SVG arc path from startAngle to endAngle.
 */
function describeArc(startAngle: number, endAngle: number, radius: number): string {
  const [startX, startY] = angleToPoint(startAngle, radius);
  const [endX, endY] = angleToPoint(endAngle, radius);

  // Large arc flag: 1 if arc spans more than 180°
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  // Sweep flag: 1 for clockwise
  const sweep = 1;

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${endX} ${endY}`;
}

export interface KnobOptions {
  label: string;
  min: number;
  max: number;
  value: number;
  unit?: string;
  onChange?: (value: number) => void;
  /** If true, knob manages its own label (default). If false, external container provides label. */
  showLabel?: boolean;
}

export class Knob {
  private container: HTMLDivElement;
  private svg: SVGSVGElement;
  private fill: SVGPathElement;
  private indicator: SVGLineElement;
  private tooltip: HTMLDivElement;

  private min: number;
  private max: number;
  private value: number;
  private defaultValue: number;
  private unit: string;
  private onChange: ((value: number) => void) | null;

  // Drag state
  private isDragging = false;
  private dragStartY = 0;
  private dragStartValue = 0;

  constructor(options: KnobOptions) {
    this.min = options.min;
    this.max = options.max;
    this.value = options.value;
    this.defaultValue = options.value;
    this.unit = options.unit ?? '';
    this.onChange = options.onChange ?? null;

    const showLabel = options.showLabel ?? true;

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'knob-group';

    // Create label (optional)
    if (showLabel) {
      const label = document.createElement('label');
      label.textContent = options.label;
      this.container.appendChild(label);
    }

    // Create SVG
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
    this.svg.setAttribute('width', String(SIZE));
    this.svg.setAttribute('height', String(SIZE));
    this.svg.classList.add('knob');

    // Background circle (knob body)
    const body = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    body.setAttribute('cx', String(CENTER));
    body.setAttribute('cy', String(CENTER));
    body.setAttribute('r', String(RADIUS));
    body.setAttribute('fill', 'var(--bg-elevated)');
    body.setAttribute('stroke', 'var(--border)');
    body.setAttribute('stroke-width', '1');

    // Arc track (shows full range)
    const track = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    track.setAttribute('d', describeArc(MIN_ANGLE, MAX_ANGLE, TRACK_RADIUS));
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', 'var(--border)');
    track.setAttribute('stroke-width', '3');
    track.setAttribute('stroke-linecap', 'round');

    // Arc fill (shows current value)
    this.fill = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.fill.setAttribute('fill', 'none');
    this.fill.setAttribute('stroke', 'var(--accent)');
    this.fill.setAttribute('stroke-width', '3');
    this.fill.setAttribute('stroke-linecap', 'round');

    // Indicator line (shows current position, with gap from track)
    this.indicator = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.indicator.setAttribute('x1', String(CENTER));
    this.indicator.setAttribute('y1', String(CENTER + 2));
    this.indicator.setAttribute('x2', String(CENTER));
    this.indicator.setAttribute('y2', String(CENTER - RADIUS + 8));
    this.indicator.setAttribute('stroke', 'var(--text-primary)');
    this.indicator.setAttribute('stroke-width', '2');
    this.indicator.setAttribute('stroke-linecap', 'round');

    // Assemble SVG
    this.svg.appendChild(body);
    this.svg.appendChild(track);
    this.svg.appendChild(this.fill);
    this.svg.appendChild(this.indicator);

    // Wrapper for knob + tooltip (so tooltip positions relative to knob)
    const knobWrapper = document.createElement('div');
    knobWrapper.className = 'knob-wrapper';
    knobWrapper.appendChild(this.svg);

    // Tooltip (hidden by default)
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'knob-tooltip';
    knobWrapper.appendChild(this.tooltip);

    this.container.appendChild(knobWrapper);

    // Initial render
    this.updateVisuals();

    // Setup drag interaction
    this.setupDrag();
  }

  /**
   * Get the DOM element to append to the page.
   */
  getElement(): HTMLDivElement {
    return this.container;
  }

  /**
   * Get the current value.
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Set the value programmatically (e.g., from external state).
   */
  setValue(value: number): void {
    this.value = Math.max(this.min, Math.min(this.max, value));
    this.updateVisuals();
  }

  /**
   * Update SVG elements to reflect current value.
   */
  private updateVisuals(): void {
    const norm = (this.value - this.min) / (this.max - this.min);
    const angle = MIN_ANGLE + norm * (MAX_ANGLE - MIN_ANGLE);

    // Update arc fill
    this.fill.setAttribute('d', describeArc(MIN_ANGLE, angle, TRACK_RADIUS));

    // Update indicator rotation
    this.indicator.setAttribute('transform', `rotate(${angle}, ${CENTER}, ${CENTER})`);
  }

  /**
   * Setup mouse/touch drag interaction.
   */
  private setupDrag(): void {
    this.svg.addEventListener('mousedown', this.handleMouseDown);
    this.svg.addEventListener('dblclick', this.handleDoubleClick);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  private handleDoubleClick = (e: MouseEvent): void => {
    e.preventDefault();
    this.value = this.defaultValue;
    this.updateVisuals();
    this.onChange?.(this.value);
  };

  private handleMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    this.isDragging = true;
    this.dragStartY = e.clientY;
    this.dragStartValue = this.value;
    this.svg.style.cursor = 'ns-resize';

    // Show tooltip
    this.tooltip.textContent = formatValue(this.value, this.unit);
    this.tooltip.classList.add('visible');
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;

    // Vertical drag: up increases, down decreases
    const deltaY = this.dragStartY - e.clientY;
    const range = this.max - this.min;
    const sensitivity = 100; // pixels for full range

    const newValue = this.dragStartValue + (deltaY / sensitivity) * range;
    const clamped = Math.max(this.min, Math.min(this.max, newValue));
    this.value = Math.round(clamped * 1000) / 1000;

    this.updateVisuals();
    this.onChange?.(this.value);

    // Update tooltip
    this.tooltip.textContent = formatValue(this.value, this.unit);
  };

  private handleMouseUp = (): void => {
    if (this.isDragging) {
      this.isDragging = false;
      this.svg.style.cursor = '';

      // Hide tooltip
      this.tooltip.classList.remove('visible');
    }
  };
}

/**
 * Helper function to create a knob (convenience wrapper).
 */
export function createKnob(options: KnobOptions): HTMLDivElement {
  const knob = new Knob(options);
  return knob.getElement();
}

/**
 * Configuration for a knob in a bank.
 */
export interface KnobBankItem {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  unit?: string;
  onChange?: (value: number) => void;
}

/**
 * A row of knobs with values above and labels below.
 *
 * Layout:
 *   0.50s   0.30s   0.80    1.20s   <- values
 *    [A]     [D]     [S]     [R]    <- knobs
 *  Attack  Decay  Sustain Release  <- labels
 */
export class KnobBank {
  private container: HTMLDivElement;
  private knobs: Map<string, Knob> = new Map();
  private valueDisplays: Map<string, HTMLSpanElement> = new Map();

  constructor(items: KnobBankItem[]) {
    this.container = document.createElement('div');
    this.container.className = 'knob-bank';

    // Create three rows: values, knobs, labels
    const valuesRow = document.createElement('div');
    valuesRow.className = 'knob-bank-values';

    const knobsRow = document.createElement('div');
    knobsRow.className = 'knob-bank-knobs';

    const labelsRow = document.createElement('div');
    labelsRow.className = 'knob-bank-labels';

    for (const item of items) {
      // Value display (clickable to edit)
      const valueSpan = document.createElement('span');
      valueSpan.textContent = formatValue(item.value, item.unit ?? '');
      valueSpan.className = 'knob-bank-value';
      this.valueDisplays.set(item.id, valueSpan);

      // Knob (without its own label)
      const knob = new Knob({
        label: item.label,
        min: item.min,
        max: item.max,
        value: item.value,
        unit: item.unit,
        showLabel: false,
        onChange: (value) => {
          // Update value display
          valueSpan.textContent = formatValue(value, item.unit ?? '');
          // Call external onChange
          item.onChange?.(value);
        },
      });
      knobsRow.appendChild(knob.getElement());
      this.knobs.set(item.id, knob);

      // Wrap value in container for positioning
      const valueWrapper = document.createElement('span');
      valueWrapper.className = 'knob-bank-value-wrapper';
      valueWrapper.appendChild(valueSpan);
      valuesRow.appendChild(valueWrapper);

      // Click on value to edit inline
      valueSpan.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'knob-bank-input';
        input.value = String(knob.getValue());
        input.min = String(item.min);
        input.max = String(item.max);
        input.step = 'any';

        const commitValue = () => {
          let newValue = parseFloat(input.value);
          if (isNaN(newValue)) {
            newValue = item.value; // fallback to default
          }
          // Clamp to bounds and round to 3 decimal places
          newValue = Math.max(item.min, Math.min(item.max, newValue));
          newValue = Math.round(newValue * 1000) / 1000;
          knob.setValue(newValue);
          valueSpan.textContent = formatValue(newValue, item.unit ?? '');
          item.onChange?.(newValue);
          // Restore visibility
          valueSpan.style.visibility = '';
          input.remove();
        };

        input.addEventListener('blur', commitValue);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
          } else if (e.key === 'Escape') {
            // Cancel edit
            valueSpan.style.visibility = '';
            input.remove();
          }
        });

        // Hide span text but keep layout, overlay input
        valueSpan.style.visibility = 'hidden';
        valueWrapper.appendChild(input);
        input.focus();
        input.select();
      });

      // Label
      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;
      labelsRow.appendChild(labelSpan);
    }

    this.container.appendChild(valuesRow);
    this.container.appendChild(knobsRow);
    this.container.appendChild(labelsRow);
  }

  /**
   * Get the DOM element.
   */
  getElement(): HTMLDivElement {
    return this.container;
  }

  /**
   * Set a knob's value programmatically.
   */
  setValue(id: string, value: number, unit?: string): void {
    const knob = this.knobs.get(id);
    const display = this.valueDisplays.get(id);
    if (knob) {
      knob.setValue(value);
    }
    if (display) {
      display.textContent = formatValue(value, unit ?? '');
    }
  }
}
