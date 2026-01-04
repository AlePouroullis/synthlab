/**
 * APP (Preact)
 * ============
 * Top-level application component managing all state.
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { SynthEngine, ADSREnvelope, DEFAULT_CONFIG, DrumEngine } from '../synth';
import { Header } from './Header';
import { SynthControls } from './SynthControls';
import { EnvelopePanel } from './EnvelopePanel';
import { MasterPanel } from './MasterPanel';
import { Keyboard } from './Keyboard';
import { Timeline, TimelineRef } from './Timeline';
import { MenuDefinition } from './MenuBar';
import { WaveformVisualizer } from '../visualizers/waveform';
import { ChatClient, createChatPanel } from '../chat';
import { Pattern, createPattern, toggleNote, hasNote, clearPattern as clearPatternFn } from '../sequencer/types';
import { setSequencerOps, setDrumEngineFactory } from '../websocket-client';
import {
  Track,
  TrackEngine,
  createChromaticRows,
  createDrumRows,
  createSynthTrackEngine,
  createDrumTrackEngine,
} from '../timeline';
import { serializePattern, deserializePattern } from '../persistence';
import {
  ProjectState,
  CURRENT_VERSION,
  exportToFile,
  importFromFile,
  saveProject,
  loadProject,
  getProjectNames,
  getCurrentProjectName,
  generateUniqueName,
  projectExists,
} from '../persistence';

// Storage keys
const CHAT_VISIBLE_KEY = 'synthlab-chat-visible';

// Detect platform for keyboard shortcuts
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl+';

interface Props {
  synth: SynthEngine;
  chatClient: ChatClient;
}

export function App({ synth, chatClient }: Props) {
  // Project state
  const [projectName, setProjectName] = useState(getCurrentProjectName);
  const [synthPattern, setSynthPattern] = useState<Pattern>(() => {
    const saved = loadProject(getCurrentProjectName());
    return saved ? deserializePattern(saved.pattern) : createPattern(16);
  });
  const [drumPattern, setDrumPattern] = useState<Pattern>(() => createPattern(16));
  const [octave, setOctave] = useState(4);
  const [synthVolume, setSynthVolume] = useState(0.8);
  const [drumVolume, setDrumVolume] = useState(0.8);

  // UI state
  const [chatVisible, setChatVisible] = useState(() => {
    return localStorage.getItem(CHAT_VISIBLE_KEY) !== 'false';
  });

  // Synth state
  const [envelope, setEnvelope] = useState<ADSREnvelope>(() => synth.getConfig().envelope);
  const [volume, setVolume] = useState(() => synth.getConfig().gain);

  // Drum engine (created when audio is initialized)
  const [drumEngine, setDrumEngine] = useState<DrumEngine | null>(null);

  // Force update trigger for changes from MCP
  const [, forceUpdate] = useState(0);

  // Refs
  const timelineRef = useRef<TimelineRef>(null);
  const synthPatternRef = useRef(synthPattern);
  const drumPatternRef = useRef(drumPattern);
  const waveformVizRef = useRef<WaveformVisualizer | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Keep pattern refs in sync
  useEffect(() => {
    synthPatternRef.current = synthPattern;
  }, [synthPattern]);

  useEffect(() => {
    drumPatternRef.current = drumPattern;
  }, [drumPattern]);

  // Set up drum engine factory for MCP (creates DrumEngine lazily when needed)
  useEffect(() => {
    setDrumEngineFactory(() => {
      const ctx = synth.getAudioContext();
      if (!ctx) return null;
      const engine = new DrumEngine(ctx, ctx.destination);
      setDrumEngine(engine);
      return engine;
    });
  }, [synth]);

  // Expose sequencer operations for MCP (synth pattern for now)
  useEffect(() => {
    setSequencerOps({
      getPattern: () => synthPatternRef.current,
      getSequencer: () => timelineRef.current!.getTransport() as any, // TODO: proper interface
      setNote: (step: number, note: string, active?: boolean) => {
        const pat = synthPatternRef.current;
        if (active === undefined) {
          toggleNote(pat, step, note);
        } else if (active && !hasNote(pat, step, note)) {
          toggleNote(pat, step, note);
        } else if (!active && hasNote(pat, step, note)) {
          toggleNote(pat, step, note);
        }
      },
      clearPattern: () => {
        clearPatternFn(synthPatternRef.current);
      },
      setPattern: (noteArrays: string[][]) => {
        const pat = synthPatternRef.current;
        clearPatternFn(pat);
        noteArrays.forEach((notes, step) => {
          notes.forEach((note) => {
            if (!hasNote(pat, step, note)) {
              toggleNote(pat, step, note);
            }
          });
        });
      },
      refresh: () => forceUpdate((n) => n + 1),
    });
  }, []);

  // Initialize waveform visualizer
  useEffect(() => {
    if (waveformCanvasRef.current && !waveformVizRef.current) {
      waveformVizRef.current = new WaveformVisualizer(waveformCanvasRef.current);
    }
  }, []);

  // Initialize chat panel
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.innerHTML = '';
      chatContainerRef.current.appendChild(createChatPanel(chatClient));
    }
  }, [chatClient]);

  // Load saved state on mount
  useEffect(() => {
    const saved = loadProject(projectName);
    if (saved) {
      synth.setConfig(saved.synthConfig);
      setEnvelope(saved.synthConfig.envelope);
      setVolume(saved.synthConfig.gain);
      if (saved.sequencer?.octave) {
        setOctave(saved.sequencer.octave);
      }
      console.log('Loaded project:', projectName);
    }
  }, []); // Only on mount

  // Subscribe to synth config changes (e.g., from MCP)
  useEffect(() => {
    return synth.subscribe((config) => {
      setEnvelope(config.envelope);
      setVolume(config.gain);
    });
  }, [synth]);

  // Auto-save before unload
  useEffect(() => {
    const handleUnload = () => {
      const state = gatherProjectState();
      saveProject(projectName, state);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [projectName, synthPattern]);

  // Chat visibility persistence
  useEffect(() => {
    localStorage.setItem(CHAT_VISIBLE_KEY, String(chatVisible));
  }, [chatVisible]);

  // Ensure audio is initialized
  const ensureAudio = useCallback(async () => {
    if (synth.isInitialized()) return;
    await synth.initialize();

    // Create drum engine now that we have an audio context
    const ctx = synth.getAudioContext();
    if (ctx && !drumEngine) {
      const drums = new DrumEngine(ctx, ctx.destination);
      setDrumEngine(drums);
    }

    const analyser = synth.getAnalyser();
    if (analyser && waveformVizRef.current) {
      waveformVizRef.current.start(analyser);
    }
  }, [synth, drumEngine]);

  // Expose for keyboard module
  useEffect(() => {
    (window as any).ensureAudio = ensureAudio;
  }, [ensureAudio]);

  // Gather project state for saving
  const gatherProjectState = useCallback((): ProjectState => {
    return {
      version: CURRENT_VERSION,
      savedAt: new Date().toISOString(),
      pattern: serializePattern(synthPattern),
      synthConfig: synth.getConfig(),
      sequencer: {
        bpm: timelineRef.current?.getTransport().bpm ?? 120,
        octave: octave,
      },
    };
  }, [synthPattern, synth, octave]);

  // Project handlers
  const handleNew = useCallback(() => {
    const name = window.prompt('Project name:', generateUniqueName());
    if (!name?.trim()) return;

    const newSynthPattern = createPattern(16);
    const newDrumPattern = createPattern(16);
    setSynthPattern(newSynthPattern);
    setDrumPattern(newDrumPattern);
    synth.setConfig(DEFAULT_CONFIG);
    setEnvelope(DEFAULT_CONFIG.envelope);
    setVolume(DEFAULT_CONFIG.gain);
    setOctave(4);

    setProjectName(name.trim());
    saveProject(name.trim(), {
      version: CURRENT_VERSION,
      savedAt: new Date().toISOString(),
      pattern: serializePattern(newSynthPattern),
      synthConfig: DEFAULT_CONFIG,
      sequencer: { bpm: 120, octave: 4 },
    });

    console.log('New project created:', name.trim());
  }, [synth]);

  const handleSave = useCallback(() => {
    const state = gatherProjectState();
    saveProject(projectName, state);
    console.log('Project saved:', projectName);
  }, [projectName, gatherProjectState]);

  const handleSaveAs = useCallback(() => {
    const name = window.prompt('Project name:', projectName);
    if (!name?.trim()) return;

    if (projectExists(name.trim()) && name.trim() !== projectName) {
      if (!window.confirm(`"${name.trim()}" already exists. Overwrite?`)) {
        return;
      }
    }

    setProjectName(name.trim());
    const state = gatherProjectState();
    saveProject(name.trim(), state);
    console.log('Project saved as:', name.trim());
  }, [projectName, gatherProjectState]);

  const handleOpenProject = useCallback((name: string) => {
    const state = loadProject(name);
    if (state) {
      const loadedPattern = deserializePattern(state.pattern);
      setSynthPattern(loadedPattern);
      setDrumPattern(createPattern(16)); // Reset drum pattern for now
      synth.setConfig(state.synthConfig);
      setEnvelope(state.synthConfig.envelope);
      setVolume(state.synthConfig.gain);
      setProjectName(name);
      if (state.sequencer?.octave) {
        setOctave(state.sequencer.octave);
      }
      console.log('Opened project:', name);
    }
  }, [synth]);

  const handleExport = useCallback(() => {
    const state = gatherProjectState();
    exportToFile(state);
  }, [gatherProjectState]);

  const handleImport = useCallback(async () => {
    try {
      const state = await importFromFile();
      const loadedPattern = deserializePattern(state.pattern);
      setSynthPattern(loadedPattern);
      setDrumPattern(createPattern(16)); // Reset drum pattern for now
      synth.setConfig(state.synthConfig);
      setEnvelope(state.synthConfig.envelope);
      setVolume(state.synthConfig.gain);
      if (state.sequencer?.octave) {
        setOctave(state.sequencer.octave);
      }
    } catch (e) {
      if ((e as Error).message !== 'File selection cancelled') {
        console.error('Import failed:', e);
      }
    }
  }, [synth]);

  // Build menu definitions
  const buildMenus = useCallback((): MenuDefinition[] => {
    const recentProjects = getProjectNames();
    const recentSubmenu: MenuDefinition['items'] = recentProjects.slice(0, 8).map((name) => ({
      label: name,
      action: () => handleOpenProject(name),
    }));

    return [
      {
        label: 'File',
        items: [
          { label: 'New Project...', shortcut: `${modKey}N`, action: handleNew },
          { separator: true },
          {
            label: 'Open Recent',
            submenu: recentSubmenu,
            disabled: recentSubmenu.length === 0,
          },
          { label: 'Open from File...', shortcut: `${modKey}O`, action: handleImport },
          { separator: true },
          { label: 'Save', shortcut: `${modKey}S`, action: handleSave },
          { label: 'Save As...', action: handleSaveAs },
          { label: 'Save to File...', shortcut: `${modKey}⇧S`, action: handleExport },
        ],
      },
    ];
  }, [handleNew, handleSave, handleSaveAs, handleOpenProject, handleImport, handleExport]);

  // Envelope handler
  const handleEnvelopeChange = useCallback((newEnvelope: ADSREnvelope) => {
    synth.setConfig({ envelope: newEnvelope });
    setEnvelope(newEnvelope);
  }, [synth]);

  // Volume handler
  const handleVolumeChange = useCallback((newVolume: number) => {
    synth.setConfig({ gain: newVolume });
    setVolume(newVolume);
  }, [synth]);

  // Chat toggle
  const toggleChat = useCallback(() => {
    setChatVisible((v) => !v);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key === '/') {
        e.preventDefault();
        toggleChat();
      } else if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNew();
      } else if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleImport();
      } else if (mod && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      } else if (mod && e.key.toLowerCase() === 's' && e.shiftKey) {
        e.preventDefault();
        handleExport();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleChat, handleNew, handleImport, handleSave, handleExport]);

  // Expose transport for debugging
  useEffect(() => {
    if (timelineRef.current) {
      (window as any).transport = timelineRef.current.getTransport();
    }
  }, []);

  // Placeholder engine for when audio isn't initialized yet
  const placeholderEngine: TrackEngine = {
    trigger: () => {},
    panic: () => {},
    setVolume: () => {},
  };

  // Handle track volume changes
  const handleTrackVolumeChange = useCallback(
    (trackId: string, value: number) => {
      if (trackId === 'synth') {
        setSynthVolume(value);
        synth.setConfig({ gain: value });
      } else if (trackId === 'drums') {
        setDrumVolume(value);
        drumEngine?.setVolume(value);
      }
    },
    [synth, drumEngine]
  );

  // Build tracks for Timeline (always show both, use placeholder if engine not ready)
  const tracks: Track[] = [
    {
      id: 'synth',
      name: 'Synth',
      rows: createChromaticRows(octave),
      pattern: synthPattern,
      engine: createSynthTrackEngine(synth),
      volume: synthVolume,
      muted: false,
    },
    {
      id: 'drums',
      name: 'Drums',
      rows: createDrumRows(),
      pattern: drumPattern,
      engine: drumEngine ? createDrumTrackEngine(drumEngine) : placeholderEngine,
      volume: drumVolume,
      muted: false,
    },
  ];

  return (
    <>
      <Header
        projectName={projectName}
        menus={buildMenus()}
        chatVisible={chatVisible}
        onChatToggle={toggleChat}
      />

      <div class="main-layout">
        <div class="synth-section">
          <div id="synth-controls">
            <SynthControls synth={synth} />
            <EnvelopePanel envelope={envelope} onChange={handleEnvelopeChange} />
            <MasterPanel synth={synth} volume={volume} onVolumeChange={handleVolumeChange} />
            <Keyboard synth={synth} />
            <Timeline ref={timelineRef} tracks={tracks} onVolumeChange={handleTrackVolumeChange} />
          </div>
          <canvas id="visualizer" width="600" height="150" ref={waveformCanvasRef} />
        </div>

        <div
          id="chat-container"
          ref={chatContainerRef}
          class={chatVisible ? '' : 'hidden'}
        />
      </div>
    </>
  );
}
