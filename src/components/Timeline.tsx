/**
 * TIMELINE
 * ========
 * Multi-track sequencer with shared transport.
 */

import { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'preact/hooks';
import { forwardRef } from 'preact/compat';
import { Track } from '../timeline/types';
import { Transport } from '../timeline/transport';
import { TrackGrid } from './TrackGrid';

export interface TimelineRef {
  getTransport: () => Transport;
}

interface Props {
  tracks: Track[];
  onTrackChange?: (trackId: string) => void;
  onVolumeChange?: (trackId: string, volume: number) => void;
}

export const Timeline = forwardRef<TimelineRef, Props>(({ tracks, onTrackChange, onVolumeChange }, ref) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [, forceUpdate] = useState(0);

  const transportRef = useRef<Transport | null>(null);

  // Initialize transport
  useEffect(() => {
    transportRef.current = new Transport({
      onStep: setCurrentStep,
      onStateChange: setIsPlaying,
    });

    return () => {
      transportRef.current?.stop();
    };
  }, []);

  // Update transport when tracks change
  useEffect(() => {
    transportRef.current?.setTracks(tracks);
  }, [tracks]);

  // Expose transport via ref
  useImperativeHandle(ref, () => ({
    getTransport: () => transportRef.current!,
  }));

  // Handlers
  const handlePlayToggle = useCallback(() => {
    transportRef.current?.toggle();
  }, []);

  const handleBpmChange = useCallback((e: Event) => {
    const value = parseInt((e.target as HTMLInputElement).value, 10) || 120;
    setBpm(value);
    if (transportRef.current) {
      transportRef.current.bpm = value;
    }
  }, []);

  const handleVolumeChange = useCallback(
    (track: Track, e: Event) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      onVolumeChange?.(track.id, value);
    },
    [onVolumeChange]
  );

  const handleMuteToggle = useCallback((track: Track) => {
    track.muted = !track.muted;
    forceUpdate((n) => n + 1);
  }, []);

  const handlePatternChange = useCallback(
    (trackId: string) => {
      forceUpdate((n) => n + 1);
      onTrackChange?.(trackId);
    },
    [onTrackChange]
  );

  return (
    <div class="timeline">
      {/* Transport controls */}
      <div class="timeline-transport">
        <button class="transport-btn play-btn" onClick={handlePlayToggle}>
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        <div class="transport-bpm">
          <span>BPM</span>
          <input type="number" min="20" max="300" value={bpm} onChange={handleBpmChange} />
        </div>
      </div>

      {/* Tracks */}
      <div class="timeline-tracks">
        {tracks.map((track) => (
          <div key={track.id} class={`timeline-track ${track.muted ? 'muted' : ''}`}>
            {/* Track header */}
            <div class="track-header">
              <span class="track-name">{track.name}</span>
              <button
                class={`track-mute-btn ${track.muted ? 'active' : ''}`}
                onClick={() => handleMuteToggle(track)}
                title={track.muted ? 'Unmute' : 'Mute'}
              >
                M
              </button>
              <input
                type="range"
                class="track-volume"
                min="0"
                max="1"
                step="0.01"
                value={track.volume}
                onInput={(e) => handleVolumeChange(track, e)}
                title={`Volume: ${Math.round(track.volume * 100)}%`}
              />
            </div>

            {/* Track grid */}
            <TrackGrid
              rows={track.rows}
              pattern={track.pattern}
              currentStep={currentStep}
              isPlaying={isPlaying}
              onPatternChange={() => handlePatternChange(track.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
});
