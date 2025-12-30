/**
 * KEYBOARD
 * =========
 * Piano keyboard UI and computer keyboard input.
 */

import { SynthEngine } from '../synth/engine';
import { midiToFrequency, getNoteInfo } from '../synth/types';

/**
 * Create a piano keyboard UI.
 */
export function createKeyboard(synth: SynthEngine): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'control-panel';
  container.style.width = '100%';

  const heading = document.createElement('h3');
  heading.textContent = 'Keyboard (click or use keys Z-M, S-J)';
  container.appendChild(heading);

  const keyboard = document.createElement('div');
  keyboard.className = 'keyboard';

  // Create one octave starting from C4 (MIDI 60)
  const startNote = 60;
  const whiteKeys: HTMLDivElement[] = [];
  const blackKeys: HTMLDivElement[] = [];

  for (let i = 0; i < 13; i++) {
    const midiNote = startNote + i;
    const noteInfo = getNoteInfo(midiNote);

    const key = document.createElement('div');
    key.className = noteInfo.isBlack ? 'key black' : 'key';
    key.dataset.note = String(midiNote);

    // Mouse events
    key.onmousedown = () => {
      if (!synth.isInitialized()) return;
      synth.noteOn(midiToFrequency(midiNote), midiNote);
      key.classList.add('pressed');
    };

    key.onmouseup = () => {
      synth.noteOff(midiNote);
      key.classList.remove('pressed');
    };

    key.onmouseleave = () => {
      synth.noteOff(midiNote);
      key.classList.remove('pressed');
    };

    if (noteInfo.isBlack) {
      blackKeys.push(key);
    } else {
      whiteKeys.push(key);
    }
  }

  // Add white keys first (z-index layering)
  whiteKeys.forEach((k) => keyboard.appendChild(k));

  container.appendChild(keyboard);

  // Set up computer keyboard input
  setupKeyboardInput(synth);

  return container;
}

/**
 * Map computer keyboard to piano notes.
 */
function setupKeyboardInput(synth: SynthEngine): void {
  const keyMap: Record<string, number> = {
    z: 60,
    s: 61,
    x: 62,
    d: 63,
    c: 64,
    v: 65,
    g: 66,
    b: 67,
    h: 68,
    n: 69,
    j: 70,
    m: 71,
    ',': 72,
  };

  const pressedKeys = new Set<string>();

  document.addEventListener('keydown', (e) => {
    if (!synth.isInitialized()) return;
    const key = e.key.toLowerCase();
    if (keyMap[key] && !pressedKeys.has(key)) {
      pressedKeys.add(key);
      const midiNote = keyMap[key];
      synth.noteOn(midiToFrequency(midiNote), midiNote);

      const keyEl = document.querySelector(`[data-note="${midiNote}"]`);
      keyEl?.classList.add('pressed');
    }
  });

  document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keyMap[key]) {
      pressedKeys.delete(key);
      const midiNote = keyMap[key];
      synth.noteOff(midiNote);

      const keyEl = document.querySelector(`[data-note="${midiNote}"]`);
      keyEl?.classList.remove('pressed');
    }
  });
}
