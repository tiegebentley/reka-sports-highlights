import { useEffect, useState } from 'react';
import { useVideoPlayer } from '../../hooks/video/useVideoPlayer';
import { useCanvasOverlay } from '../../hooks/video/useCanvasOverlay';
import 'video.js/dist/video-js.css';
import './AdvancedPlayer.css';

// Temporary workaround for browser cache issue
interface BoundingBox {
  frame: number;
  timestamp: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface PlayerTrack {
  id: string;
  playerId: string;
  playerName: string;
  playerNumber?: number;
  color: string;
  boxes: BoundingBox[];
  detectionMethod: 'ai' | 'manual';
}

interface CanvasOverlayOptions {
  showBoxes: boolean;
  showLabels: boolean;
  showIDs: boolean;
  showNames: boolean;
  showConfidence: boolean;
}

interface SpotlightOptions {
  enabled: boolean;
  trackId: string | null;
  radius: number;
  opacity: number;
}

interface ZoomOptions {
  enabled: boolean;
  trackId: string | null;
  scale: number;
  smoothing: number;
}

export interface AdvancedPlayerProps {
  src: string;
  tracks?: PlayerTrack[];
  autoplay?: boolean;
  onTimeUpdate?: (currentTime: number) => void;
}

export const AdvancedPlayer = ({
  src,
  tracks = [],
  autoplay = false,
  onTimeUpdate,
}: AdvancedPlayerProps) => {
  const [overlayOptions, setOverlayOptions] = useState<CanvasOverlayOptions>({
    showBoxes: true,
    showLabels: true,
    showIDs: true,
    showNames: true,
    showConfidence: false,
  });

  const [spotlightOptions, setSpotlightOptions] = useState<SpotlightOptions>({
    enabled: false,
    trackId: null,
    radius: 150,
    opacity: 0.3,
  });

  const [zoomOptions, setZoomOptions] = useState<ZoomOptions>({
    enabled: false,
    trackId: null,
    scale: 2,
    smoothing: 0.1,
  });

  const { videoRef, playerRef, playerState, controls } = useVideoPlayer({
    autoplay,
    sources: [{ src, type: 'video/mp4' }],
    onTimeUpdate,
  });

  const { canvasRef } = useCanvasOverlay({
    videoElement: videoRef.current,
    tracks,
    overlayOptions,
    spotlightOptions,
    zoomOptions,
  });

  return (
    <div className="advanced-player-container">
      <div className="video-wrapper" style={{ position: 'relative' }}>
        <div data-vjs-player>
          <video
            ref={videoRef}
            className="video-js vjs-big-play-centered"
            playsInline
          />
        </div>

        <canvas
          ref={canvasRef}
          className="canvas-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      </div>

      {/* Control Panel */}
      <div className="player-controls-panel">
        <div className="controls-section">
          <h3>Filters</h3>
          <label>
            <input
              type="checkbox"
              checked={overlayOptions.showBoxes}
              onChange={(e) => setOverlayOptions({ ...overlayOptions, showBoxes: e.target.checked })}
            />
            Boxes
          </label>
          <label>
            <input
              type="checkbox"
              checked={overlayOptions.showLabels}
              onChange={(e) => setOverlayOptions({ ...overlayOptions, showLabels: e.target.checked })}
            />
            Labels
          </label>
          <label>
            <input
              type="checkbox"
              checked={overlayOptions.showIDs}
              onChange={(e) => setOverlayOptions({ ...overlayOptions, showIDs: e.target.checked })}
            />
            IDs
          </label>
          <label>
            <input
              type="checkbox"
              checked={overlayOptions.showNames}
              onChange={(e) => setOverlayOptions({ ...overlayOptions, showNames: e.target.checked })}
            />
            Names
          </label>
          <label>
            <input
              type="checkbox"
              checked={overlayOptions.showConfidence}
              onChange={(e) => setOverlayOptions({ ...overlayOptions, showConfidence: e.target.checked })}
            />
            %
          </label>
        </div>

        <div className="controls-section">
          <h3>Players ({tracks.length})</h3>
          <div className="player-tracks-list">
            {tracks.map((track) => (
              <div key={track.id} className="player-track-item">
                <span
                  className="track-color-dot"
                  style={{ backgroundColor: track.color }}
                />
                <span>#{track.playerNumber || '?'} {track.playerName}</span>
                <button
                  onClick={() => setSpotlightOptions({
                    ...spotlightOptions,
                    enabled: !spotlightOptions.enabled || spotlightOptions.trackId !== track.id,
                    trackId: track.id,
                  })}
                  className={spotlightOptions.enabled && spotlightOptions.trackId === track.id ? 'active' : ''}
                >
                  Spotlight
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="controls-section">
          <h3>Playback</h3>
          <label>
            Speed: {playerState.playbackRate}x
            <input
              type="range"
              min="0.25"
              max="2"
              step="0.25"
              value={playerState.playbackRate}
              onChange={(e) => controls.setPlaybackRate(parseFloat(e.target.value))}
            />
          </label>
          <div className="playback-buttons">
            <button onClick={() => controls.seekFrame('backward')}>⏮️ Frame</button>
            <button onClick={playerState.isPlaying ? controls.pause : controls.play}>
              {playerState.isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            <button onClick={() => controls.seekFrame('forward')}>Frame ⏭️</button>
          </div>
        </div>

        <div className="controls-section">
          <h3>Zoom</h3>
          <label>
            <input
              type="checkbox"
              checked={zoomOptions.enabled}
              onChange={(e) => setZoomOptions({ ...zoomOptions, enabled: e.target.checked })}
            />
            Enable Zoom
          </label>
          {zoomOptions.enabled && (
            <>
              <label>
                Scale: {zoomOptions.scale}x
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.5"
                  value={zoomOptions.scale}
                  onChange={(e) => setZoomOptions({ ...zoomOptions, scale: parseFloat(e.target.value) })}
                />
              </label>
              <select
                value={zoomOptions.trackId || ''}
                onChange={(e) => setZoomOptions({ ...zoomOptions, trackId: e.target.value || null })}
              >
                <option value="">Select Player</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    #{track.playerNumber} {track.playerName}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Timeline Info */}
      <div className="timeline-info">
        <span>
          {new Date(playerState.currentTime * 1000).toISOString().substr(14, 5)} /
          {new Date(playerState.duration * 1000).toISOString().substr(14, 5)}
        </span>
        <span>
          Frame: {Math.floor(playerState.currentTime * 30)}
        </span>
      </div>
    </div>
  );
};
