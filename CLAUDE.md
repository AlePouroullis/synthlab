# SynthLab

A browser-based synthesizer controllable via MCP (Model Context Protocol), allowing Claude to play music programmatically.

## What This Is

A pedagogical project exploring:

1. Web Audio API fundamentals (oscillators, filters, envelopes)
2. MCP for LLM-to-application communication
3. Real-time audio visualization with Canvas

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Claude Code (MCP Host)                                     │
│  "Play a C major chord"                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │ MCP (stdio)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  MCP Server (mcp-server/)                                   │
│  Exposes tools: play_note, play_chord_sequence, etc.        │
└─────────────────────────┬───────────────────────────────────┘
                          │ WebSocket (ws://localhost:8765)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Browser Synth (src/)                                       │
│  Web Audio API: Oscillator → Filter → Gain → Output         │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── synth/
│   ├── types.ts          # Type definitions, constants, utilities
│   ├── engine.ts         # Core Web Audio synthesis
│   └── index.ts          # Re-exports
├── visualizers/
│   ├── waveform.ts       # Time-domain waveform display
│   └── index.ts
├── ui/
│   ├── controls.ts       # Sliders, selects, panels
│   ├── keyboard.ts       # Piano keyboard component
│   └── index.ts
├── websocket-client.ts   # Browser ↔ MCP server bridge
└── main.ts               # Application entry point

mcp-server/
├── server.ts             # MCP tool definitions and WebSocket server
└── tsconfig.json
```

## Running

```bash
# Terminal 1: Start the web synth
npm run dev

# Browser: Open http://localhost:3000, click "Start Audio"

# Claude Code automatically connects via .mcp.json
```

## MCP Tools Available

- `get_config` — Get current synth settings
- `set_config` — Update waveform, filter, envelope, gain
- `play_note` — Play a single note (e.g., "C4", "F#3")
- `play_sequence` — Play a melody
- `play_chord_sequence` — Play chord progressions
- `stop_note` — Stop a specific note
- `panic` — Stop all notes

## Key Concepts

### Web Audio Graph

```
[Oscillator] → [Gain (ADSR envelope)] → [Filter] → [Master Gain] → [Analyser] → [Speakers]
```

### ADSR Envelope

- **Attack**: Time to reach peak volume
- **Decay**: Time to fall to sustain level
- **Sustain**: Volume while note is held
- **Release**: Time to fade after note release

### Note Naming

- Use sharps, not flats: `C#4` not `Db4`
- Octave 4 is middle C: `C4` = MIDI 60 = 261.63 Hz

## Current State

✅ Basic subtractive synthesis (osc → filter → envelope)
✅ MCP control from Claude Code
✅ Waveform visualization
✅ Chord and melody playback

## Next Steps (Milestones)

1. **Visualizers** — ADSR curve, filter response, spectrum analyzer
2. **Musical abstractions** — Chord symbols ("Cmaj7"), scale helpers, BPM
3. **Effects** — Reverb, delay, chorus
4. **Recording/Export** — MIDI, WAV output

## Conventions

- TypeScript strict mode
- Modular structure (one concern per file)
- Web Audio nodes created on-demand (oscillators are short-lived)
- MCP server uses stdio transport (spawned by Claude Code)

## Style Guide

### Design Philosophy

- **Minimal and refined** — Clean, understated, professional aesthetic
- **Not "spacy" or neon** — Avoid sci-fi vibes, gaming aesthetics, bright accent colors
- **Warm neutrals** — Off-white tones, not pure white; warm grays, not blue-tinted

### Theming

The app supports dark and light modes via CSS variables on `[data-theme]`.

**Always use CSS variables for colors:**

```css
/* Backgrounds */
--bg-base       /* Deepest background */
--bg-surface    /* Cards, panels */
--bg-elevated   /* Hover states, inputs */

/* Text */
--text-primary   /* Main content */
--text-secondary /* Labels, secondary info */
--text-muted     /* Placeholders, disabled */

/* Borders */
--border         /* Visible borders */
--border-subtle  /* Subtle dividers */

/* Accent */
--accent         /* Primary interactive elements */
--accent-hover   /* Hover state */
--accent-muted   /* Pressed/active state */

/* Semantic */
--success, --error, --warning
```

**For canvas/visualizers:** Read CSS variables at runtime via `getComputedStyle()` to support theme switching.

### Typography

- Font: Space Grotesk (via `--font-main`)
- Section headers: `0.7rem`, uppercase, `letter-spacing: 0.1em`
- Body: `0.85rem`
- Use `font-weight: 500` for medium emphasis, `400` for regular

### Components

- Border radius: `6px` for buttons/inputs, `8px` for panels
- Transitions: `0.15s ease` for interactions
- Avoid drop shadows — use subtle borders instead
- Buttons: filled with `--text-primary` (inverts on theme)
