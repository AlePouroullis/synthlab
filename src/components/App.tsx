/**
 * APP (Preact)
 * ============
 * Top-level application component managing all state.
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { SynthEngine, ADSREnvelope, DEFAULT_CONFIG } from '../synth';
import { Header } from './Header';
import { SynthControls } from './SynthControls';
import { EnvelopePanel } from './EnvelopePanel';
import { MasterPanel } from './MasterPanel';
import { Keyboard } from './Keyboard';
import { Sequencer, SequencerRef } from './Sequencer';
import { MenuDefinition } from './MenuBar';
import { WaveformVisualizer } from '../visualizers/waveform';
import { ChatClient, createChatPanel } from '../chat';
import { Pattern, createPattern } from '../sequencer/types';
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
  const [pattern, setPattern] = useState<Pattern>(() => {
    const saved = loadProject(getCurrentProjectName());
    return saved ? deserializePattern(saved.pattern) : createPattern(16);
  });

  // UI state
  const [chatVisible, setChatVisible] = useState(() => {
    return localStorage.getItem(CHAT_VISIBLE_KEY) !== 'false';
  });

  // Synth state
  const [envelope, setEnvelope] = useState<ADSREnvelope>(() => synth.getConfig().envelope);
  const [volume, setVolume] = useState(() => synth.getConfig().gain);

  // Refs
  const sequencerRef = useRef<SequencerRef>(null);
  const waveformVizRef = useRef<WaveformVisualizer | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

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
      // Sequencer state is restored via the pattern prop
      setTimeout(() => {
        sequencerRef.current?.restoreState(pattern, saved.sequencer.octave, saved.sequencer.bpm);
      }, 0);
      console.log('Loaded project:', projectName);
    }
  }, []); // Only on mount

  // Sync with external synth changes (e.g., from MCP)
  useEffect(() => {
    const interval = setInterval(() => {
      const config = synth.getConfig();
      if (
        config.envelope.attack !== envelope.attack ||
        config.envelope.decay !== envelope.decay ||
        config.envelope.sustain !== envelope.sustain ||
        config.envelope.release !== envelope.release
      ) {
        setEnvelope(config.envelope);
      }
      if (config.gain !== volume) {
        setVolume(config.gain);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [synth, envelope, volume]);

  // Auto-save before unload
  useEffect(() => {
    const handleUnload = () => {
      const state = gatherProjectState();
      saveProject(projectName, state);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [projectName, pattern]);

  // Chat visibility persistence
  useEffect(() => {
    localStorage.setItem(CHAT_VISIBLE_KEY, String(chatVisible));
  }, [chatVisible]);

  // Ensure audio is initialized
  const ensureAudio = useCallback(async () => {
    if (synth.isInitialized()) return;
    await synth.initialize();
    const analyser = synth.getAnalyser();
    if (analyser && waveformVizRef.current) {
      waveformVizRef.current.start(analyser);
    }
  }, [synth]);

  // Expose for keyboard module
  useEffect(() => {
    (window as any).ensureAudio = ensureAudio;
  }, [ensureAudio]);

  // Gather project state for saving
  const gatherProjectState = useCallback((): ProjectState => {
    return {
      version: CURRENT_VERSION,
      savedAt: new Date().toISOString(),
      pattern: serializePattern(pattern),
      synthConfig: synth.getConfig(),
      sequencer: {
        bpm: sequencerRef.current?.getSequencer().bpm ?? 120,
        octave: sequencerRef.current?.getOctave() ?? 4,
      },
    };
  }, [pattern, synth]);

  // Project handlers
  const handleNew = useCallback(() => {
    const name = window.prompt('Project name:', generateUniqueName());
    if (!name?.trim()) return;

    const newPattern = createPattern(16);
    setPattern(newPattern);
    synth.setConfig(DEFAULT_CONFIG);
    setEnvelope(DEFAULT_CONFIG.envelope);
    setVolume(DEFAULT_CONFIG.gain);
    sequencerRef.current?.restoreState(newPattern, 4, 120);

    setProjectName(name.trim());
    saveProject(name.trim(), {
      version: CURRENT_VERSION,
      savedAt: new Date().toISOString(),
      pattern: serializePattern(newPattern),
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
      setPattern(loadedPattern);
      synth.setConfig(state.synthConfig);
      setEnvelope(state.synthConfig.envelope);
      setVolume(state.synthConfig.gain);
      setProjectName(name);
      sequencerRef.current?.restoreState(loadedPattern, state.sequencer.octave, state.sequencer.bpm);
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
      setPattern(loadedPattern);
      synth.setConfig(state.synthConfig);
      setEnvelope(state.synthConfig.envelope);
      setVolume(state.synthConfig.gain);
      sequencerRef.current?.restoreState(loadedPattern, state.sequencer.octave, state.sequencer.bpm);
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

  // Expose sequencer for debugging
  useEffect(() => {
    if (sequencerRef.current) {
      (window as any).sequencer = sequencerRef.current.getSequencer();
    }
  }, []);

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
            <Sequencer ref={sequencerRef} pattern={pattern} synth={synth} />
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
