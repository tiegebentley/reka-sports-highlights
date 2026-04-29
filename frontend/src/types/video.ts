// Video Player Types
// Force cache refresh

export interface BoundingBox {
  frame: number;
  timestamp: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface PlayerTrack {
  id: string;
  playerId: string;
  playerName: string;
  playerNumber?: number;
  color: string;
  boxes: BoundingBox[];
  detectionMethod: 'ai' | 'manual';
}

export interface VideoPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isFullscreen: boolean;
}

export interface CanvasOverlayOptions {
  showBoxes: boolean;
  showLabels: boolean;
  showIDs: boolean;
  showNames: boolean;
  showConfidence: boolean;
}

export interface FilterOptions {
  classes: string[];
  minConfidence: number;
  selectedTrackIds: string[];
}

export interface SpotlightOptions {
  enabled: boolean;
  trackId: string | null;
  radius: number;
  opacity: number;
}

export interface ZoomOptions {
  enabled: boolean;
  trackId: string | null;
  scale: number;
  smoothing: number;
}

export interface VideoTrackData {
  id: string;
  video_id: string;
  player_id: string;
  detection_method: 'ai' | 'manual';
  frame_data: BoundingBox[];
  created_at: string;
  updated_at: string;
}
