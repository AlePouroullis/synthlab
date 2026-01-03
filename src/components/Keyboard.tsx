/**
 * KEYBOARD (Preact)
 * =================
 * Piano keyboard UI and computer keyboard input.
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { SynthEngine } from '../synth/engine';
import { midiToFrequency, getNoteInfo } from '../synth/types';
import { Tooltip } from './Tooltip';

// Storage keys
const KEYBOARD_ENABLED_KEY = 'synthlab-keyboard-enabled';
const OCTAVE_OFFSET_KEY = 'synthlab-octave-offset';

// Key dimensions (must match CSS)
const WHITE_KEY_WIDTH = 40;
const KEY_GAP = 2;
const BLACK_KEY_WIDTH = 26;

// Computer keyboard to MIDI note mapping (Ableton-style)
const KEY_MAP: Record<string, number> = {
  // White keys (middle row)
  a: 60, s: 62, d: 64, f: 65, g: 67, h: 69, j: 71, k: 72, l: 74,
  // Black keys (top row)
  w: 61, e: 63, t: 66, y: 68, u: 70, o: 73, p: 75,
};

// MIDI note to keyboard key label
const MIDI_TO_KEY_LABEL: Record<number, string> = {
  60: 'A', 61: 'W', 62: 'S', 63: 'E', 64: 'D', 65: 'F',
  66: 'T', 67: 'G', 68: 'Y', 69: 'H', 70: 'U', 71: 'J',
  72: 'K', 73: 'O', 74: 'L', 75: 'P',
};

interface Props {
  synth: SynthEngine;
}

// Export state accessors for external use (e.g., hotkey handler in main.tsx)
let _keyboardInputEnabled = true;
let _setKeyboardInputEnabled: ((v: boolean) => void) | null = null;

export function isKeyboardInputEnabled(): boolean {
  return _keyboardInputEnabled;
}

export function setKeyboardInputEnabled(enabled: boolean): void {
  _setKeyboardInputEnabled?.(enabled);
}

export function Keyboard({ synth }: Props) {
  // Load initial state from localStorage
  const [keyboardEnabled, setKeyboardEnabled] = useState(() => {
    const saved = localStorage.getItem(KEYBOARD_ENABLED_KEY);
    return saved === null ? true : saved === 'true';
  });

  const [octaveOffset, setOctaveOffset] = useState(() => {
    const saved = localStorage.getItem(OCTAVE_OFFSET_KEY);
    return saved !== null ? parseInt(saved, 10) || 0 : 0;
  });

  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());

  // Track which actual MIDI note is playing for each computer key
  const pressedKeyMapRef = useRef<Map<string, number>>(new Map());

  // Sync with external state accessors
  useEffect(() => {
    _keyboardInputEnabled = keyboardEnabled;
    _setKeyboardInputEnabled = setKeyboardEnabled;
  }, [keyboardEnabled]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(KEYBOARD_ENABLED_KEY, String(keyboardEnabled));
  }, [keyboardEnabled]);

  useEffect(() => {
    localStorage.setItem(OCTAVE_OFFSET_KEY, String(octaveOffset));
  }, [octaveOffset]);

  // Handle octave change
  const changeOctave = useCallback((delta: number) => {
    setOctaveOffset((prev) => Math.max(-36, Math.min(36, prev + delta)));
  }, []);

  // Computer keyboard input
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!keyboardEnabled) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();

      // Octave shifting with Z/X
      if (key === 'z') {
        e.preventDefault();
        changeOctave(-12);
        return;
      }
      if (key === 'x') {
        e.preventDefault();
        changeOctave(12);
        return;
      }

      const baseMidiNote = KEY_MAP[key];
      if (baseMidiNote !== undefined && !pressedKeyMapRef.current.has(key)) {
        e.preventDefault();

        // Lazy audio initialization
        if ((window as any).ensureAudio) {
          await (window as any).ensureAudio();
        }

        const midiNote = baseMidiNote + octaveOffset;
        pressedKeyMapRef.current.set(key, midiNote);
        synth.noteOn(midiToFrequency(midiNote), midiNote);

        // Update pressed state for visual feedback
        setPressedKeys((prev) => new Set(prev).add(baseMidiNote));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const baseMidiNote = KEY_MAP[key];

      if (baseMidiNote !== undefined && pressedKeyMapRef.current.has(key)) {
        const midiNote = pressedKeyMapRef.current.get(key)!;
        pressedKeyMapRef.current.delete(key);
        synth.noteOff(midiNote);

        setPressedKeys((prev) => {
          const next = new Set(prev);
          next.delete(baseMidiNote);
          return next;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [synth, keyboardEnabled, octaveOffset, changeOctave]);

  // Mouse handlers for piano keys
  const handleMouseDown = useCallback(
    async (midiNote: number) => {
      if ((window as any).ensureAudio) {
        await (window as any).ensureAudio();
      }
      synth.noteOn(midiToFrequency(midiNote), midiNote);
      setPressedKeys((prev) => new Set(prev).add(midiNote));
    },
    [synth]
  );

  const handleMouseUp = useCallback(
    (midiNote: number) => {
      synth.noteOff(midiNote);
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.delete(midiNote);
        return next;
      });
    },
    [synth]
  );

  // Generate piano keys
  const startNote = 60;
  const endNote = 76;
  const keys = [];
  let whiteKeyCount = 0;

  for (let i = 0; i <= endNote - startNote; i++) {
    const midiNote = startNote + i;
    const noteInfo = getNoteInfo(midiNote);
    const isBlack = noteInfo.isBlack;
    const isPressed = pressedKeys.has(midiNote);
    const keyLabel = MIDI_TO_KEY_LABEL[midiNote];

    const style: Record<string, string> = {};
    if (isBlack) {
      const leftPos = whiteKeyCount * (WHITE_KEY_WIDTH + KEY_GAP) - BLACK_KEY_WIDTH / 2 - KEY_GAP / 2;
      style.left = `${leftPos}px`;
    } else {
      whiteKeyCount++;
    }

    keys.push(
      <div
        key={midiNote}
        class={`key ${isBlack ? 'black' : ''} ${isPressed ? 'pressed' : ''}`}
        data-note={midiNote}
        style={style}
        onMouseDown={() => handleMouseDown(midiNote)}
        onMouseUp={() => handleMouseUp(midiNote)}
        onMouseLeave={() => handleMouseUp(midiNote)}
      >
        {keyLabel && <span class="key-label">{keyLabel}</span>}
      </div>
    );
  }

  const currentOctave = 4 + Math.floor(octaveOffset / 12);

  return (
    <div class="control-panel" style={{ width: '100%' }}>
      <div class="keyboard-header">
        <h3>Keyboard</h3>

        <span class="octave-wrapper">
          <span id="octave-display" class="octave-display">
            C{currentOctave}
          </span>
          <Tooltip text="[Z]/[X] to shift octave" />
        </span>

        <label class="keyboard-toggle">
          <input
            type="checkbox"
            checked={keyboardEnabled}
            onChange={(e) => setKeyboardEnabled(e.currentTarget.checked)}
          />
          <span>Computer keyboard</span>
          <Tooltip text="Toggle with [M]" />
        </label>
      </div>

      <div class="keyboard">{keys}</div>
    </div>
  );
}
