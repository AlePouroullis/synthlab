/**
 * CHAT TOOLS
 * ===========
 * Tool definitions for the Anthropic API.
 * These mirror what the MCP server exposes.
 */

import Anthropic from '@anthropic-ai/sdk';
import { SynthEngine, midiToFrequency, WaveformType, FilterType } from '../synth';

// Tool definitions for Claude
export const SYNTH_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_config',
    description: 'Get the current synth configuration',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'set_config',
    description:
      'Update synth parameters: waveform (sine/square/sawtooth/triangle), gain (0-1), filterType (lowpass/highpass/bandpass), filterCutoff (20-20000 Hz), filterResonance (0.1-30), attack/decay/sustain/release (seconds)',
    input_schema: {
      type: 'object' as const,
      properties: {
        waveform: { type: 'string', enum: ['sine', 'square', 'sawtooth', 'triangle'] },
        gain: { type: 'number' },
        filterType: { type: 'string', enum: ['lowpass', 'highpass', 'bandpass'] },
        filterCutoff: { type: 'number' },
        filterResonance: { type: 'number' },
        attack: { type: 'number' },
        decay: { type: 'number' },
        sustain: { type: 'number' },
        release: { type: 'number' },
      },
    },
  },
  {
    name: 'play_note',
    description:
      "Play a note. Use note names like 'C4', 'F#3', 'A#5'. Optionally specify duration in seconds.",
    input_schema: {
      type: 'object' as const,
      properties: {
        note: { type: 'string', description: "Note name (e.g., 'C4', 'F#3')" },
        duration: { type: 'number', description: 'Duration in seconds' },
      },
      required: ['note'],
    },
  },
  {
    name: 'play_chord_sequence',
    description:
      'Play a sequence of chords. Each chord has notes (array), duration, and optional gap.',
    input_schema: {
      type: 'object' as const,
      properties: {
        chords: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              notes: { type: 'array', items: { type: 'string' } },
              duration: { type: 'number' },
              gap: { type: 'number' },
            },
            required: ['notes'],
          },
        },
      },
      required: ['chords'],
    },
  },
  {
    name: 'play_sequence',
    description: 'Play a melody. Each note has a name, duration, and optional gap.',
    input_schema: {
      type: 'object' as const,
      properties: {
        notes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              note: { type: 'string' },
              duration: { type: 'number' },
              gap: { type: 'number' },
            },
            required: ['note'],
          },
        },
      },
      required: ['notes'],
    },
  },
  {
    name: 'panic',
    description: 'Stop all playing notes immediately',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

// Note name to MIDI conversion
function noteNameToMidi(noteName: string): number {
  const noteMap: Record<string, number> = {
    C: 0,
    'C#': 1,
    D: 2,
    'D#': 3,
    E: 4,
    F: 5,
    'F#': 6,
    G: 7,
    'G#': 8,
    A: 9,
    'A#': 10,
    B: 11,
  };

  const match = noteName.match(/^([A-G]#?)(\d+)$/i);
  if (!match) throw new Error(`Invalid note: ${noteName}`);

  const [, note, octaveStr] = match;
  return (parseInt(octaveStr) + 1) * 12 + noteMap[note.toUpperCase()];
}

/**
 * Execute a tool call against the synth.
 */
export function executeTool(
  synth: SynthEngine,
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case 'get_config':
      return JSON.stringify(synth.getConfig(), null, 2);

    case 'set_config': {
      const config: Record<string, unknown> = {};
      const envelope: Record<string, number> = {};

      for (const [key, value] of Object.entries(input)) {
        if (['attack', 'decay', 'sustain', 'release'].includes(key)) {
          envelope[key] = value as number;
        } else if (key === 'waveform') {
          config.waveform = value as WaveformType;
        } else if (key === 'filterType') {
          config.filterType = value as FilterType;
        } else {
          config[key] = value;
        }
      }

      if (Object.keys(envelope).length > 0) {
        config.envelope = envelope;
      }

      synth.setConfig(config);
      return `Config updated: ${JSON.stringify(synth.getConfig(), null, 2)}`;
    }

    case 'play_note': {
      const { note, duration } = input as { note: string; duration?: number };
      const midiNote = noteNameToMidi(note);
      synth.noteOn(midiToFrequency(midiNote), midiNote);

      if (duration) {
        setTimeout(() => synth.noteOff(midiNote), duration * 1000);
      }

      return `Playing ${note}${duration ? ` for ${duration}s` : ''}`;
    }

    case 'play_chord_sequence': {
      const { chords } = input as {
        chords: { notes: string[]; duration?: number; gap?: number }[];
      };

      let delay = 0;
      for (const chord of chords) {
        const midiNotes = chord.notes.map(noteNameToMidi);
        const duration = chord.duration || 0.5;
        const gap = chord.gap || 0;

        setTimeout(() => {
          for (const midi of midiNotes) {
            synth.noteOn(midiToFrequency(midi), midi);
          }
          setTimeout(() => {
            for (const midi of midiNotes) {
              synth.noteOff(midi);
            }
          }, duration * 1000);
        }, delay);

        delay += (duration + gap) * 1000;
      }

      return `Playing ${chords.length} chords`;
    }

    case 'play_sequence': {
      const { notes } = input as {
        notes: { note: string; duration?: number; gap?: number }[];
      };

      let delay = 0;
      for (const n of notes) {
        const midiNote = noteNameToMidi(n.note);
        const duration = n.duration || 0.5;
        const gap = n.gap || 0;

        setTimeout(() => {
          synth.noteOn(midiToFrequency(midiNote), midiNote);
          setTimeout(() => synth.noteOff(midiNote), duration * 1000);
        }, delay);

        delay += (duration + gap) * 1000;
      }

      return `Playing ${notes.length} notes`;
    }

    case 'panic':
      synth.panic();
      return 'All notes stopped';

    default:
      return `Unknown tool: ${name}`;
  }
}
