/**
 * MCP SERVER FOR WEB SYNTH
 * =========================
 *
 * This server exposes synth controls via the Model Context Protocol.
 * It communicates with the browser synth via WebSocket.
 *
 * Tools exposed:
 * - get_config: Get current synth configuration
 * - set_config: Update synth parameters
 * - play_note: Play a note by name (e.g., "C4") or MIDI number
 * - stop_note: Stop a specific note
 * - panic: Stop all notes
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer, WebSocket } from 'ws';

// WebSocket connection to the browser synth
let browserConnection: WebSocket | null = null;
const pendingRequests = new Map<string, (response: any) => void>();
let requestId = 0;

// Start WebSocket server for browser connection
const wss = new WebSocketServer({ port: 8765 });

wss.on('connection', (ws) => {
  console.error('[MCP] Browser synth connected');
  browserConnection = ws;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.id && pendingRequests.has(message.id)) {
        const resolve = pendingRequests.get(message.id)!;
        pendingRequests.delete(message.id);
        resolve(message);
      }
    } catch (e) {
      console.error('[MCP] Error parsing message:', e);
    }
  });

  ws.on('close', () => {
    console.error('[MCP] Browser synth disconnected');
    browserConnection = null;
  });
});

console.error('[MCP] WebSocket server listening on ws://localhost:8765');

// Send a command to the browser synth and wait for response
async function sendCommand(type: string, payload: any = {}): Promise<any> {
  if (!browserConnection) {
    throw new Error('Browser synth not connected. Open http://localhost:3000 in your browser.');
  }

  const id = String(++requestId);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Request timed out'));
    }, 5000);

    pendingRequests.set(id, (response) => {
      clearTimeout(timeout);
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response.result);
      }
    });

    browserConnection!.send(JSON.stringify({ id, type, payload }));
  });
}

// Note name to MIDI number conversion
function noteNameToMidi(noteName: string): number {
  const noteMap: Record<string, number> = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11,
  };

  // Parse note name like "C4", "F#3", etc.
  const match = noteName.match(/^([A-G][#b]?)(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid note name: ${noteName}. Use format like C4, F#3, Bb2`);
  }

  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  const semitone = noteMap[note.toUpperCase()];

  if (semitone === undefined) {
    throw new Error(`Unknown note: ${note}`);
  }

  return (octave + 1) * 12 + semitone;
}

// Create MCP server
const server = new Server(
  {
    name: 'web-synth',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_config',
        description:
          'Get the current synth configuration including waveform, filter, envelope, and volume settings',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'set_config',
        description:
          'Update synth parameters. You can set any combination of: waveform (sine/square/sawtooth/triangle), gain (0-1), filterType (lowpass/highpass/bandpass), filterCutoff (20-20000 Hz), filterResonance (0.1-30), and envelope (attack/decay/sustain/release in seconds).',
        inputSchema: {
          type: 'object',
          properties: {
            waveform: {
              type: 'string',
              enum: ['sine', 'square', 'sawtooth', 'triangle'],
              description: 'Oscillator waveform type',
            },
            gain: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Master volume (0-1)',
            },
            filterType: {
              type: 'string',
              enum: ['lowpass', 'highpass', 'bandpass'],
              description: 'Filter type',
            },
            filterCutoff: {
              type: 'number',
              minimum: 20,
              maximum: 20000,
              description: 'Filter cutoff frequency in Hz',
            },
            filterResonance: {
              type: 'number',
              minimum: 0.1,
              maximum: 30,
              description: 'Filter resonance (Q factor)',
            },
            attack: {
              type: 'number',
              minimum: 0.001,
              maximum: 5,
              description: 'Envelope attack time in seconds',
            },
            decay: {
              type: 'number',
              minimum: 0.001,
              maximum: 5,
              description: 'Envelope decay time in seconds',
            },
            sustain: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Envelope sustain level (0-1)',
            },
            release: {
              type: 'number',
              minimum: 0.001,
              maximum: 10,
              description: 'Envelope release time in seconds',
            },
          },
        },
      },
      {
        name: 'play_note',
        description:
          "Play a musical note. Specify either a note name (e.g., 'C4', 'F#3', 'Bb2') or a MIDI note number (0-127). Optionally specify duration in seconds.",
        inputSchema: {
          type: 'object',
          properties: {
            note: {
              type: 'string',
              description: "Note name (e.g., 'C4', 'F#3') or MIDI number (e.g., '60')",
            },
            duration: {
              type: 'number',
              minimum: 0.01,
              maximum: 10,
              description:
                'Duration in seconds. If not specified, note plays until stop_note is called.',
            },
          },
          required: ['note'],
        },
      },
      {
        name: 'play_sequence',
        description:
          'Play a sequence of notes. Each note can have a name, duration, and gap before the next note.',
        inputSchema: {
          type: 'object',
          properties: {
            notes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  note: { type: 'string', description: 'Note name or MIDI number' },
                  duration: { type: 'number', description: 'Duration in seconds' },
                  gap: { type: 'number', description: 'Gap after this note in seconds' },
                },
                required: ['note'],
              },
              description: 'Array of notes to play',
            },
          },
          required: ['notes'],
        },
      },
      {
        name: 'play_chord_sequence',
        description:
          'Play a sequence of chords. Each chord contains multiple notes played simultaneously, with a duration and optional gap before the next chord. Great for progressions like I-IV-V-I.',
        inputSchema: {
          type: 'object',
          properties: {
            chords: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  notes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: "Array of note names (e.g., ['C4', 'E4', 'G4'] for C major)",
                  },
                  duration: {
                    type: 'number',
                    description: 'How long to hold the chord in seconds',
                  },
                  gap: {
                    type: 'number',
                    description: 'Gap after this chord before the next one (in seconds)',
                  },
                },
                required: ['notes'],
              },
              description: 'Array of chords to play in sequence',
            },
          },
          required: ['chords'],
        },
      },
      {
        name: 'stop_note',
        description: 'Stop a specific note that is currently playing',
        inputSchema: {
          type: 'object',
          properties: {
            note: {
              type: 'string',
              description: 'Note name or MIDI number to stop',
            },
          },
          required: ['note'],
        },
      },
      {
        name: 'panic',
        description: 'Stop all currently playing notes immediately',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      // Sequencer tools
      {
        name: 'get_pattern',
        description:
          'Get the current sequencer pattern as an array of steps, each containing active notes',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'set_note',
        description: 'Set or toggle a note in the sequencer pattern at a specific step',
        inputSchema: {
          type: 'object',
          properties: {
            step: {
              type: 'number',
              minimum: 0,
              maximum: 15,
              description: 'Step index (0-15)',
            },
            note: {
              type: 'string',
              description: "Note name with octave (e.g., 'C4', 'F#4')",
            },
            active: {
              type: 'boolean',
              description:
                'Whether the note should be active. If omitted, toggles the current state.',
            },
          },
          required: ['step', 'note'],
        },
      },
      {
        name: 'clear_pattern',
        description: 'Clear all notes from the sequencer pattern',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'set_pattern',
        description: 'Set the entire sequencer pattern. Each step is an array of note names.',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'array',
              items: {
                type: 'array',
                items: { type: 'string' },
                description: "Array of note names for this step (e.g., ['C4', 'E4'])",
              },
              description: 'Array of 16 steps, each containing an array of active notes',
            },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'sequencer_play',
        description: 'Start the sequencer playback',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'sequencer_stop',
        description: 'Stop the sequencer playback',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'set_bpm',
        description: 'Set the sequencer tempo in beats per minute',
        inputSchema: {
          type: 'object',
          properties: {
            bpm: {
              type: 'number',
              minimum: 20,
              maximum: 300,
              description: 'Tempo in BPM',
            },
          },
          required: ['bpm'],
        },
      },
      {
        name: 'get_sequencer_state',
        description:
          'Get the current sequencer state including BPM, playing status, and current step',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_config': {
        const config = await sendCommand('get_config');
        return {
          content: [{ type: 'text', text: JSON.stringify(config, null, 2) }],
        };
      }

      case 'set_config': {
        // Build config object, handling envelope separately
        const config: any = {};
        const envelope: any = {};

        for (const [key, value] of Object.entries(args || {})) {
          if (['attack', 'decay', 'sustain', 'release'].includes(key)) {
            envelope[key] = value;
          } else {
            config[key] = value;
          }
        }

        if (Object.keys(envelope).length > 0) {
          config.envelope = envelope;
        }

        await sendCommand('set_config', config);
        const newConfig = await sendCommand('get_config');
        return {
          content: [
            { type: 'text', text: `Configuration updated:\n${JSON.stringify(newConfig, null, 2)}` },
          ],
        };
      }

      case 'play_note': {
        const noteArg = (args as any).note;
        const duration = (args as any).duration;

        // Parse note - either MIDI number or note name
        let midiNote: number;
        if (/^\d+$/.test(noteArg)) {
          midiNote = parseInt(noteArg, 10);
        } else {
          midiNote = noteNameToMidi(noteArg);
        }

        await sendCommand('play_note', { midiNote, duration });

        const message = duration
          ? `Playing ${noteArg} (MIDI ${midiNote}) for ${duration}s`
          : `Playing ${noteArg} (MIDI ${midiNote})`;

        return { content: [{ type: 'text', text: message }] };
      }

      case 'play_sequence': {
        const notes = (args as any).notes || [];
        const parsedNotes = notes.map((n: any) => ({
          midiNote: /^\d+$/.test(n.note) ? parseInt(n.note, 10) : noteNameToMidi(n.note),
          duration: n.duration || 0.5,
          gap: n.gap || 0,
        }));

        await sendCommand('play_sequence', { notes: parsedNotes });

        return {
          content: [{ type: 'text', text: `Playing sequence of ${notes.length} notes` }],
        };
      }

      case 'play_chord_sequence': {
        const chords = (args as any).chords || [];
        const parsedChords = chords.map((chord: any) => ({
          midiNotes: chord.notes.map((n: string) =>
            /^\d+$/.test(n) ? parseInt(n, 10) : noteNameToMidi(n)
          ),
          duration: chord.duration || 0.5,
          gap: chord.gap || 0,
        }));

        await sendCommand('play_chord_sequence', { chords: parsedChords });

        const chordNames = chords.map((c: any) => c.notes.join('-')).join(' → ');
        return {
          content: [{ type: 'text', text: `Playing chord sequence: ${chordNames}` }],
        };
      }

      case 'stop_note': {
        const noteArg = (args as any).note;
        let midiNote: number;
        if (/^\d+$/.test(noteArg)) {
          midiNote = parseInt(noteArg, 10);
        } else {
          midiNote = noteNameToMidi(noteArg);
        }

        await sendCommand('stop_note', { midiNote });
        return { content: [{ type: 'text', text: `Stopped note ${noteArg}` }] };
      }

      case 'panic': {
        await sendCommand('panic');
        return { content: [{ type: 'text', text: 'All notes stopped' }] };
      }

      // Sequencer tools
      case 'get_pattern': {
        const pattern = await sendCommand('get_pattern');
        return {
          content: [{ type: 'text', text: JSON.stringify(pattern, null, 2) }],
        };
      }

      case 'set_note': {
        const { step, note, active } = args as { step: number; note: string; active?: boolean };
        await sendCommand('set_note', { step, note, active });
        return {
          content: [
            {
              type: 'text',
              text: `${active === false ? 'Removed' : active === true ? 'Added' : 'Toggled'} ${note} at step ${step}`,
            },
          ],
        };
      }

      case 'clear_pattern': {
        await sendCommand('clear_pattern');
        return { content: [{ type: 'text', text: 'Pattern cleared' }] };
      }

      case 'set_pattern': {
        const { pattern } = args as { pattern: string[][] };
        await sendCommand('set_pattern', { pattern });
        return {
          content: [{ type: 'text', text: `Pattern set with ${pattern.length} steps` }],
        };
      }

      case 'sequencer_play': {
        await sendCommand('sequencer_play');
        return { content: [{ type: 'text', text: 'Sequencer started' }] };
      }

      case 'sequencer_stop': {
        await sendCommand('sequencer_stop');
        return { content: [{ type: 'text', text: 'Sequencer stopped' }] };
      }

      case 'set_bpm': {
        const { bpm } = args as { bpm: number };
        await sendCommand('set_bpm', { bpm });
        return { content: [{ type: 'text', text: `BPM set to ${bpm}` }] };
      }

      case 'get_sequencer_state': {
        const state = await sendCommand('get_sequencer_state');
        return {
          content: [{ type: 'text', text: JSON.stringify(state, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Server started');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
