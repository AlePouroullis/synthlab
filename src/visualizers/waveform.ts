/**
 * WAVEFORM VISUALIZER
 * ====================
 * Displays the time-domain waveform of the audio output.
 */

export class WaveformVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationId: number | null = null;
  private lineWidth = 2;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  /**
   * Get colors from CSS variables for theme support.
   */
  private getColors(): { background: string; line: string } {
    const style = getComputedStyle(document.documentElement);
    return {
      background: style.getPropertyValue('--bg-surface').trim() || '#171717',
      line: style.getPropertyValue('--text-secondary').trim() || '#a0a0a0',
    };
  }

  /**
   * Connect to an analyser node and start visualization.
   */
  start(analyser: AnalyserNode): void {
    this.analyser = analyser;
    this.dataArray = new Uint8Array(analyser.frequencyBinCount);
    this.draw();
  }

  /**
   * Stop the visualization loop.
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Main draw loop.
   */
  private draw = (): void => {
    this.animationId = requestAnimationFrame(this.draw);

    if (!this.analyser || !this.dataArray) return;

    // Get waveform data
    this.analyser.getByteTimeDomainData(this.dataArray as Uint8Array<ArrayBuffer>);

    const { width, height } = this.canvas;
    const colors = this.getColors();

    // Clear canvas
    this.ctx.fillStyle = colors.background;
    this.ctx.fillRect(0, 0, width, height);

    // Draw waveform
    this.ctx.lineWidth = this.lineWidth;
    this.ctx.strokeStyle = colors.line;
    this.ctx.beginPath();

    const bufferLength = this.dataArray.length;
    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = this.dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    this.ctx.lineTo(width, height / 2);
    this.ctx.stroke();
  };
}
