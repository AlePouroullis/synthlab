import { ADSREnvelope } from '../synth';
import { getThemeColors, ThemeVars } from '../theme';

const CONTROL_POINT_IDS = ['attack', 'decay', 'sustain', 'release'] as const;
type ControlPointId = (typeof CONTROL_POINT_IDS)[number];

export class ADSRVisualizer {
  static WIDTH = 250;
  static HEIGHT = 100;
  static MAX_TIME = 7; // seconds (A + D + R slider maxes = 7s)
  static SUSTAIN_WIDTH = 50; // pixels
  static PADDING = 5;
  static CONTROL_POINT_RADIUS = 5;

  // Value limits (matching slider ranges)
  static MIN_TIME = 0.001;
  static MAX_ATTACK = 2;
  static MAX_DECAY = 2;
  static MAX_RELEASE = 3;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;

  // State
  private config: ADSREnvelope | null = null;
  private controlPoints: Record<ControlPointId, [number, number]> | null = null;
  private hoveredPoint: ControlPointId | null = null;
  private draggingPoint: ControlPointId | null = null;

  // Animation state (per control point)
  private animatedFill: Record<ControlPointId, number> = {
    attack: 0,
    decay: 0,
    sustain: 0,
    release: 0,
  };
  private animatedRadius: Record<ControlPointId, number> = {
    attack: ADSRVisualizer.CONTROL_POINT_RADIUS,
    decay: ADSRVisualizer.CONTROL_POINT_RADIUS,
    sustain: ADSRVisualizer.CONTROL_POINT_RADIUS,
    release: ADSRVisualizer.CONTROL_POINT_RADIUS,
  };
  private animationId: number | null = null;

  // Callback when config changes from dragging
  private onChange: ((config: ADSREnvelope) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.dpr = window.devicePixelRatio || 1;

    // Scale canvas buffer for high-DPI displays
    this.canvas.width = ADSRVisualizer.WIDTH * this.dpr;
    this.canvas.height = ADSRVisualizer.HEIGHT * this.dpr;

    // Keep CSS size the same
    this.canvas.style.width = `${ADSRVisualizer.WIDTH}px`;
    this.canvas.style.height = `${ADSRVisualizer.HEIGHT}px`;

    this.ctx = canvas.getContext('2d')!;

    // Scale context so drawing code uses logical pixels
    this.ctx.scale(this.dpr, this.dpr);

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);

    // Catch mouseup outside canvas (e.g., user drags outside and releases)
    window.addEventListener('mouseup', this.handleWindowMouseUp);

    // Re-render when theme changes
    const observer = new MutationObserver(() => this.render());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  private handleWindowMouseUp = () => {
    if (this.draggingPoint) {
      this.draggingPoint = null;
      this.startAnimation();
    }
  };

  // Event Handlers

  private handleMouseMove = (e: MouseEvent) => {
    const { x, y } = this.getMousePos(e);
    const hovered = this.getHoveredPoint(x, y);

    if (hovered !== this.hoveredPoint) {
      this.hoveredPoint = hovered;
      this.canvas.style.cursor = hovered ? 'pointer' : 'default';
      this.startAnimation();
    }

    if (this.draggingPoint && this.config) {
      const changes = this.getConfigFromDrag(x, y);
      if (changes) {
        this.config = { ...this.config, ...changes };
        this.updateControlPoints();
        this.render();
        this.onChange?.(this.config);
      }
    }
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.hoveredPoint) {
      this.draggingPoint = this.hoveredPoint;
      this.startAnimation();
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (this.draggingPoint) {
      this.draggingPoint = null;
      this.startAnimation();
    }
  };

  private handleMouseLeave = () => {
    const needsAnimation = this.hoveredPoint !== null || this.draggingPoint !== null;
    this.hoveredPoint = null;
    this.draggingPoint = null;
    this.canvas.style.cursor = 'default';
    if (needsAnimation) {
      this.startAnimation();
    }
  };

  // Public API
  setConfig(config: ADSREnvelope, onChange?: (config: ADSREnvelope) => void) {
    this.config = config;
    if (onChange) {
      this.onChange = onChange;
    }
    this.updateControlPoints();
    this.render();
  }

  private getConfigFromDrag(mouseX: number, mouseY: number): Partial<ADSREnvelope> | null {
    if (!this.draggingPoint || !this.config) return null;

    const pad = ADSRVisualizer.PADDING;
    const width = ADSRVisualizer.WIDTH - ADSRVisualizer.SUSTAIN_WIDTH - pad * 2;
    const height = ADSRVisualizer.HEIGHT - pad * 2;

    // Convert mouse to logical coords (without padding)
    const x = mouseX - pad;
    const y = mouseY - pad;

    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

    switch (this.draggingPoint) {
      case 'attack': {
        const attack = clamp(
          (x / width) * ADSRVisualizer.MAX_TIME,
          ADSRVisualizer.MIN_TIME,
          ADSRVisualizer.MAX_ATTACK
        );
        return { attack };
      }

      case 'decay': {
        // X controls end of decay phase (attack + decay)
        const totalTime = (x / width) * ADSRVisualizer.MAX_TIME;
        const decay = clamp(
          totalTime - this.config.attack,
          ADSRVisualizer.MIN_TIME,
          ADSRVisualizer.MAX_DECAY
        );

        // Y controls sustain level (inverted: top = 1, bottom = 0)
        const sustain = clamp(1 - y / height, 0, 1);

        return { decay, sustain };
      }

      case 'sustain': {
        // Only Y matters (X is fixed offset from decay)
        const sustain = clamp(1 - y / height, 0, 1);
        return { sustain };
      }

      case 'release': {
        // X relative to sustain point
        const { attack, decay } = this.config;
        const decayX = ((attack + decay) / ADSRVisualizer.MAX_TIME) * width;
        const sustainX = decayX + ADSRVisualizer.SUSTAIN_WIDTH;
        const release = clamp(
          ((x - sustainX) / width) * ADSRVisualizer.MAX_TIME,
          ADSRVisualizer.MIN_TIME,
          ADSRVisualizer.MAX_RELEASE
        );
        return { release };
      }
    }
  }

  // Calculate control point positions from config (logical coords, no padding)
  private updateControlPoints() {
    if (!this.config) return;

    const pad = ADSRVisualizer.PADDING;
    const width = ADSRVisualizer.WIDTH - ADSRVisualizer.SUSTAIN_WIDTH - pad * 2;
    const height = ADSRVisualizer.HEIGHT - pad * 2;

    const { attack, decay, sustain, release } = this.config;

    const attackX = (attack / ADSRVisualizer.MAX_TIME) * width;
    const decayX = ((attack + decay) / ADSRVisualizer.MAX_TIME) * width;
    const sustainY = height - sustain * height;
    const sustainX = decayX + ADSRVisualizer.SUSTAIN_WIDTH;
    const releaseX = sustainX + (release / ADSRVisualizer.MAX_TIME) * width;

    // Store logical coordinates (without padding)
    this.controlPoints = {
      attack: [attackX, 0],
      decay: [decayX, sustainY],
      sustain: [sustainX, sustainY],
      release: [releaseX, height],
    };
  }

  // Render current state
  private render() {
    if (!this.controlPoints) return;

    const ctx = this.ctx;
    const pad = ADSRVisualizer.PADDING;
    const height = ADSRVisualizer.HEIGHT - pad * 2;
    const colors = this.getColors();

    // Clear
    ctx.clearRect(0, 0, ADSRVisualizer.WIDTH, ADSRVisualizer.HEIGHT);

    // Draw envelope line
    ctx.beginPath();
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.moveTo(pad, height + pad); // start at bottom-left

    for (const id of CONTROL_POINT_IDS) {
      const [x, y] = this.controlPoints[id];
      ctx.lineTo(x + pad, y + pad);
    }
    ctx.stroke();

    // Draw control points
    for (const id of CONTROL_POINT_IDS) {
      const [x, y] = this.controlPoints[id];
      const fill = this.animatedFill[id];
      const radius = this.animatedRadius[id];

      ctx.beginPath();
      ctx.arc(x + pad, y + pad, radius, 0, Math.PI * 2);

      // Always draw outline
      ctx.strokeStyle = colors.controlPoint;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw fill with animated opacity
      if (fill > 0) {
        ctx.fillStyle = colors.controlPointHover;
        ctx.globalAlpha = fill;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  private getColors() {
    const theme = getThemeColors([ThemeVars.accent, ThemeVars.accentHover, ThemeVars.textPrimary]);
    return {
      line: theme.accent,
      controlPoint: theme['text-primary'],
      controlPointHover: theme['accent-hover'],
    };
  }

  private getMousePos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private getHoveredPoint(mouseX: number, mouseY: number): ControlPointId | null {
    if (!this.controlPoints) return null;

    const pad = ADSRVisualizer.PADDING;
    const radius = ADSRVisualizer.CONTROL_POINT_RADIUS;

    for (const id of CONTROL_POINT_IDS) {
      const [x, y] = this.controlPoints[id];
      const dx = mouseX - (x + pad);
      const dy = mouseY - (y + pad);

      if (dx * dx + dy * dy <= radius * radius) {
        return id;
      }
    }
    return null;
  }

  private startAnimation() {
    if (this.animationId) return; // already running

    const baseRadius = ADSRVisualizer.CONTROL_POINT_RADIUS;
    const dragRadius = baseRadius * 1.4;
    const lerpFactor = 0.2;

    const animate = () => {
      let needsUpdate = false;

      for (const id of CONTROL_POINT_IDS) {
        // Fill: 0 = outline, 1 = filled (on hover or drag)
        const isActive = id === this.hoveredPoint || id === this.draggingPoint;
        const targetFill = isActive ? 1 : 0;
        const currentFill = this.animatedFill[id];
        const diffFill = targetFill - currentFill;

        if (Math.abs(diffFill) > 0.01) {
          this.animatedFill[id] = currentFill + diffFill * lerpFactor;
          needsUpdate = true;
        } else {
          this.animatedFill[id] = targetFill;
        }

        // Radius: enlarge when dragging
        const targetRadius = id === this.draggingPoint ? dragRadius : baseRadius;
        const currentRadius = this.animatedRadius[id];
        const diffRadius = targetRadius - currentRadius;

        if (Math.abs(diffRadius) > 0.1) {
          this.animatedRadius[id] = currentRadius + diffRadius * lerpFactor;
          needsUpdate = true;
        } else {
          this.animatedRadius[id] = targetRadius;
        }
      }

      this.render();

      if (needsUpdate) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }
}
