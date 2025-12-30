/**
 * KEYBOARD
 * =========
 * Piano keyboard UI and computer keyboard input.
 */

import { SynthEngine } from '../synth/engine';
import { midiToFrequency, getNoteInfo } from '../synth/types';
import { createTooltip } from './tooltip';

// Keyboard input state
let keyboardInputEnabled = true;
let octaveOffset = 0; // In semitones (12 = 1 octave)
const KEYBOARD_ENABLED_KEY = 'synthlab-keyboard-enabled';
const OCTAVE_OFFSET_KEY = 'synthlab-octave-offset';

export function isKeyboardInputEnabled(): boolean {
  return keyboardInputEnabled;
}

export function setKeyboardInputEnabled(enabled: boolean): void {
  keyboardInputEnabled = enabled;
  localStorage.setItem(KEYBOARD_ENABLED_KEY, String(enabled));
}

export function getOctaveOffset(): number {
  return octaveOffset;
}

export function setOctaveOffset(offset: number): void {
  // Clamp to reasonable range (-3 to +3 octaves)
  octaveOffset = Math.max(-36, Math.min(36, offset));
  localStorage.setItem(OCTAVE_OFFSET_KEY, String(octaveOffset));
  updateOctaveDisplay();
}

function updateOctaveDisplay(): void {
  const display = document.getElementById('octave-display');
  if (display) {
    const octave = 4 + Math.floor(octaveOffset / 12);
    display.textContent = `C${octave}`;
  }
}

/**
 * Create a piano keyboard UI.
 */
export function createKeyboard(synth: SynthEngine): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'control-panel';
  container.style.width = '100%';

  // Header with title and toggle
  const header = document.createElement('div');
  header.className = 'keyboard-header';

  const heading = document.createElement('h3');
  heading.textContent = 'Keyboard';
  header.appendChild(heading);

  // Octave display with tooltip
  const octaveWrapper = document.createElement('span');
  octaveWrapper.className = 'octave-wrapper';

  const octaveDisplay = document.createElement('span');
  octaveDisplay.id = 'octave-display';
  octaveDisplay.className = 'octave-display';
  // Load saved octave offset
  const savedOctave = localStorage.getItem(OCTAVE_OFFSET_KEY);
  if (savedOctave !== null) {
    octaveOffset = parseInt(savedOctave, 10) || 0;
  }
  const currentOctave = 4 + Math.floor(octaveOffset / 12);
  octaveDisplay.textContent = `C${currentOctave}`;

  const octaveTooltip = createTooltip('[Z]/[X] to shift octave');

  octaveWrapper.appendChild(octaveDisplay);
  octaveWrapper.appendChild(octaveTooltip);
  header.appendChild(octaveWrapper);

  // Keyboard input toggle
  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'keyboard-toggle';

  const toggleCheckbox = document.createElement('input');
  toggleCheckbox.type = 'checkbox';

  // Load saved preference
  const savedEnabled = localStorage.getItem(KEYBOARD_ENABLED_KEY);
  keyboardInputEnabled = savedEnabled === null ? true : savedEnabled === 'true';
  toggleCheckbox.checked = keyboardInputEnabled;

  toggleCheckbox.addEventListener('change', () => {
    setKeyboardInputEnabled(toggleCheckbox.checked);
  });

  const toggleText = document.createElement('span');
  toggleText.textContent = 'Computer keyboard';

  const tooltip = createTooltip('Toggle with [M]');

  toggleLabel.appendChild(toggleCheckbox);
  toggleLabel.appendChild(toggleText);
  toggleLabel.appendChild(tooltip);
  header.appendChild(toggleLabel);

  container.appendChild(header);

  const keyboard = document.createElement('div');
  keyboard.className = 'keyboard';

  // Create ~1.5 octaves starting from C4 (MIDI 60)
  const startNote = 60;
  const endNote = 76; // Through E5 (visual completeness)

  // Map MIDI notes to keyboard keys for labels
  const midiToKeyLabel: Record<number, string> = {
    60: 'A',
    61: 'W',
    62: 'S',
    63: 'E',
    64: 'D',
    65: 'F',
    66: 'T',
    67: 'G',
    68: 'Y',
    69: 'H',
    70: 'U',
    71: 'J',
    72: 'K',
    73: 'O',
    74: 'L',
    75: 'P',
  };

  // Key dimensions (must match CSS)
  const whiteKeyWidth = 40;
  const keyGap = 2;
  const blackKeyWidth = 26;

  // Track white key count for positioning black keys
  let whiteKeyCount = 0;

  for (let i = 0; i <= endNote - startNote; i++) {
    const midiNote = startNote + i;
    const noteInfo = getNoteInfo(midiNote);

    const key = document.createElement('div');
    key.className = noteInfo.isBlack ? 'key black' : 'key';
    key.dataset.note = String(midiNote);

    // Add keyboard label if mapped
    const keyLabel = midiToKeyLabel[midiNote];
    if (keyLabel) {
      const label = document.createElement('span');
      label.className = 'key-label';
      label.textContent = keyLabel;
      key.appendChild(label);
    }

    // Position black keys absolutely
    if (noteInfo.isBlack) {
      // Black key sits between two white keys
      // Position at the right edge of the previous white key
      const leftPos = whiteKeyCount * (whiteKeyWidth + keyGap) - blackKeyWidth / 2 - keyGap / 2;
      key.style.left = `${leftPos}px`;
    } else {
      whiteKeyCount++;
    }

    // Mouse events
    key.onmousedown = async () => {
      // Lazy audio initialization
      if ((window as any).ensureAudio) {
        await (window as any).ensureAudio();
      }
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

    keyboard.appendChild(key);
  }

  container.appendChild(keyboard);

  // Set up computer keyboard input
  setupKeyboardInput(synth);

  return container;
}

/**
 * Map computer keyboard to piano notes (Ableton-style layout).
 * Middle row (A-L): white keys
 * Top row (W, E, T, Y, U, O, P): black keys
 */
function setupKeyboardInput(synth: SynthEngine): void {
  const keyMap: Record<string, number> = {
    // White keys (middle row)
    a: 60, // C4
    s: 62, // D4
    d: 64, // E4
    f: 65, // F4
    g: 67, // G4
    h: 69, // A4
    j: 71, // B4
    k: 72, // C5
    l: 74, // D5
    // Black keys (top row)
    w: 61, // C#4
    e: 63, // D#4
    t: 66, // F#4
    y: 68, // G#4
    u: 70, // A#4
    o: 73, // C#5
    p: 75, // D#5
  };

  // Track which actual MIDI note is playing for each key (to handle octave changes mid-press)
  const pressedKeys = new Map<string, number>();

  document.addEventListener('keydown', async (e) => {
    // Skip if keyboard input is disabled or if typing in an input field
    if (!keyboardInputEnabled) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const key = e.key.toLowerCase();

    // Octave shifting with Z/X
    if (key === 'z') {
      e.preventDefault();
      setOctaveOffset(octaveOffset - 12);
      return;
    }
    if (key === 'x') {
      e.preventDefault();
      setOctaveOffset(octaveOffset + 12);
      return;
    }

    if (keyMap[key] && !pressedKeys.has(key)) {
      e.preventDefault(); // Prevent typing in page
      // Lazy audio initialization
      if ((window as any).ensureAudio) {
        await (window as any).ensureAudio();
      }
      const baseMidiNote = keyMap[key];
      const midiNote = baseMidiNote + octaveOffset;
      pressedKeys.set(key, midiNote); // Track actual note played
      synth.noteOn(midiToFrequency(midiNote), midiNote);

      // Highlight the visual key (base note, not transposed)
      const keyEl = document.querySelector(`[data-note="${baseMidiNote}"]`);
      keyEl?.classList.add('pressed');
    }
  });

  document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keyMap[key] && pressedKeys.has(key)) {
      const midiNote = pressedKeys.get(key)!;
      pressedKeys.delete(key);
      synth.noteOff(midiNote);

      // Remove highlight from visual key
      const baseMidiNote = keyMap[key];
      const keyEl = document.querySelector(`[data-note="${baseMidiNote}"]`);
      keyEl?.classList.remove('pressed');
    }
  });
}
