/**
 * DRUM ENGINE
 * ===========
 * Synthesized percussion using Web Audio.
 *
 * Drum sounds are created using oscillators and noise,
 * shaped with pitch and amplitude envelopes.
 *
 * Sounds:
 * - Kick: Sine wave with fast pitch drop + short amplitude envelope
 * - Snare: Noise burst + low sine, bandpass filtered
 * - Hi-hat closed: Highpass noise, very short envelope
 * - Hi-hat open: Highpass noise, longer envelope
 */

export type DrumType = 'kick' | 'snare' | 'hihat-closed' | 'hihat-open';

export class DrumEngine {
  private audioContext: AudioContext;
  private output: GainNode;

  constructor(audioContext: AudioContext, destination: AudioNode) {
    this.audioContext = audioContext;

    // Master output for all drums
    this.output = audioContext.createGain();
    this.output.gain.value = 0.8;
    this.output.connect(destination);
  }

  /**
   * Trigger a drum sound.
   */
  trigger(drum: DrumType): void {
    switch (drum) {
      case 'kick':
        this.playKick();
        break;
      case 'snare':
        this.playSnare();
        break;
      case 'hihat-closed':
        this.playHiHat(0.05);
        break;
      case 'hihat-open':
        this.playHiHat(0.3);
        break;
    }
  }

  /**
   * Kick drum: sine wave with pitch envelope.
   * Starts at ~150Hz, drops to ~50Hz quickly.
   */
  private playKick(): void {
    const now = this.audioContext.currentTime;

    // Oscillator for the body
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';

    // Pitch envelope: start high, drop fast
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.05);

    // Amplitude envelope
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    // Optional: add a click transient
    const clickOsc = this.audioContext.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.value = 200;

    const clickGain = this.audioContext.createGain();
    clickGain.gain.setValueAtTime(0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.01);

    // Connect
    osc.connect(gain);
    gain.connect(this.output);

    clickOsc.connect(clickGain);
    clickGain.connect(this.output);

    // Play
    osc.start(now);
    osc.stop(now + 0.4);

    clickOsc.start(now);
    clickOsc.stop(now + 0.02);
  }

  /**
   * Snare drum: noise burst + low sine, bandpass filtered.
   */
  private playSnare(): void {
    const now = this.audioContext.currentTime;

    // Noise component (using noise buffer)
    const noiseBuffer = this.createNoiseBuffer(0.2);
    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    // Bandpass filter for the noise
    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 3000;
    noiseFilter.Q.value = 1;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    // Tonal component (low sine for body)
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 180;

    const oscGain = this.audioContext.createGain();
    oscGain.gain.setValueAtTime(0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    // Connect noise path
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.output);

    // Connect oscillator path
    osc.connect(oscGain);
    oscGain.connect(this.output);

    // Play
    noise.start(now);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Hi-hat: highpass filtered noise.
   * Duration controls open vs closed character.
   */
  private playHiHat(duration: number): void {
    const now = this.audioContext.currentTime;

    // Noise source
    const noiseBuffer = this.createNoiseBuffer(duration);
    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    // Highpass filter for metallic character
    const hpFilter = this.audioContext.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = 7000;

    // Bandpass for extra shaping
    const bpFilter = this.audioContext.createBiquadFilter();
    bpFilter.type = 'bandpass';
    bpFilter.frequency.value = 10000;
    bpFilter.Q.value = 1;

    // Amplitude envelope
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    // Connect
    noise.connect(hpFilter);
    hpFilter.connect(bpFilter);
    bpFilter.connect(gain);
    gain.connect(this.output);

    // Play
    noise.start(now);
  }

  /**
   * Create a buffer filled with white noise.
   */
  private createNoiseBuffer(duration: number): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  /**
   * Set the overall drum volume.
   */
  setVolume(value: number): void {
    this.output.gain.value = Math.max(0, Math.min(1, value));
  }
}
