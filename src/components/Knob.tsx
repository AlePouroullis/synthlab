/**
 * KNOB (Preact)
 * =============
 * SVG-based rotary knob control with drag interaction.
 */

import { useRef, useEffect, useCallback, useState } from 'preact/hooks';
import { formatValue } from './Controls';

// Visual constants
const SIZE = 40;
const RADIUS = 16;
const CENTER = SIZE / 2;
const TRACK_RADIUS = RADIUS - 4;
const MIN_ANGLE = -135;
const MAX_ANGLE = 135;

function angleToPoint(angleDeg: number, radius: number): [number, number] {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(angleRad), CENTER + radius * Math.sin(angleRad)];
}

function describeArc(startAngle: number, endAngle: number, radius: number): string {
  const [startX, startY] = angleToPoint(startAngle, radius);
  const [endX, endY] = angleToPoint(endAngle, radius);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
}

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  showLabel?: boolean;
  onChange?: (value: number) => void;
}

export function Knob({
  label,
  value,
  min,
  max,
  unit = '',
  showLabel = true,
  onChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const dragStateRef = useRef({ startY: 0, startValue: 0 });
  const defaultValue = useRef(value).current;

  // Calculate visual angle from value
  const norm = (value - min) / (max - min);
  const angle = MIN_ANGLE + norm * (MAX_ANGLE - MIN_ANGLE);
  const arcPath = describeArc(MIN_ANGLE, angle, TRACK_RADIUS);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setShowTooltip(true);
      dragStateRef.current = { startY: e.clientY, startValue: value };
    },
    [value]
  );

  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      onChange?.(defaultValue);
    },
    [onChange, defaultValue]
  );

  // Window-level mouse events for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragStateRef.current.startY - e.clientY;
      const range = max - min;
      const sensitivity = 100;
      const newValue = dragStateRef.current.startValue + (deltaY / sensitivity) * range;
      const clamped = Math.max(min, Math.min(max, newValue));
      const rounded = Math.round(clamped * 1000) / 1000;
      onChange?.(rounded);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setShowTooltip(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, min, max, onChange]);

  return (
    <div class="knob-group">
      {showLabel && <label>{label}</label>}
      <div class="knob-wrapper">
        <svg
          ref={svgRef}
          class="knob"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          style={{ cursor: isDragging ? 'ns-resize' : undefined }}
          onMouseDown={handleMouseDown}
          onDblClick={handleDoubleClick}
        >
          {/* Background circle */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="var(--bg-elevated)"
            stroke="var(--border)"
            stroke-width="1"
          />
          {/* Track arc */}
          <path
            d={describeArc(MIN_ANGLE, MAX_ANGLE, TRACK_RADIUS)}
            fill="none"
            stroke="var(--border)"
            stroke-width="3"
            stroke-linecap="round"
          />
          {/* Fill arc */}
          <path
            d={arcPath}
            fill="none"
            stroke="var(--accent)"
            stroke-width="3"
            stroke-linecap="round"
          />
          {/* Indicator line */}
          <line
            x1={CENTER}
            y1={CENTER + 2}
            x2={CENTER}
            y2={CENTER - RADIUS + 8}
            stroke="var(--text-primary)"
            stroke-width="2"
            stroke-linecap="round"
            transform={`rotate(${angle}, ${CENTER}, ${CENTER})`}
          />
        </svg>
        <div class={`knob-tooltip ${showTooltip ? 'visible' : ''}`}>
          {formatValue(value, unit)}
        </div>
      </div>
    </div>
  );
}
