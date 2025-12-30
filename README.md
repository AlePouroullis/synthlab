# SynthLab

A browser-based synthesizer that LLMs can play.

## What

Web Audio synth controllable via [MCP](https://modelcontextprotocol.io/), so Claude can play music programmatically.

```
Claude: "Play a I-IV-V-I progression"
     │
     ▼ MCP
┌─────────────┐      ┌─────────────┐
│ MCP Server  │──ws──│  Browser    │──► 🔊
└─────────────┘      └─────────────┘
```

## Quick Start

```bash
npm install
npm run dev          # Start synth at http://localhost:3000
```

Open browser, click "Start Audio", then use Claude Code to play:

```
> Play a C major chord
> Play Für Elise
> Make it sound like a bass and play something funky
```

## MCP Tools

| Tool                  | Description                            |
| --------------------- | -------------------------------------- |
| `play_note`           | Play a single note (e.g., "C4", "F#3") |
| `play_chord_sequence` | Play chord progressions                |
| `play_sequence`       | Play melodies                          |
| `set_config`          | Change waveform, filter, envelope      |
| `get_config`          | Read current settings                  |
| `panic`               | Stop all notes                         |

## Stack

- **Synth**: Web Audio API (oscillator → filter → gain → output)
- **Bridge**: MCP server (stdio) + WebSocket to browser
- **UI**: Vanilla TypeScript, Canvas visualization

## License

MIT

---

_Made by Alé... but mostly Claude_ 🤖🎹
<sub>(Don't tell him I wrote this too)</sub>
