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
    this.unit = options.unit ?? '';
    this.onChange = options.onChange ?? null;

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'knob-group';

    // Create label
    const label = document.createElement('label');
    label.textContent = options.label;
    this.container.appendChild(label);

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
    track.setAttribute('stroke', 'var(--border-subtle)');
    track.setAttribute('stroke-width', '3');
    track.setAttribute('stroke-linecap', 'round');

    // Arc fill (shows current value)
    this.fill = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.fill.setAttribute('fill', 'none');
    this.fill.setAttribute('stroke', 'var(--accent)');
    this.fill.setAttribute('stroke-width', '3');
    this.fill.setAttribute('stroke-linecap', 'round');

    // Indicator line (shows current position)
    this.indicator = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.indicator.setAttribute('x1', String(CENTER));
    this.indicator.setAttribute('y1', String(CENTER));
    this.indicator.setAttribute('x2', String(CENTER));
    this.indicator.setAttribute('y2', String(CENTER - RADIUS + 4));
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
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

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
    this.value = Math.max(this.min, Math.min(this.max, newValue));

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
