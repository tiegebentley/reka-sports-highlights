// Video Player Types
// Force cache refresh

// Database Types
export type VideoStatus = 'uploaded' | 'processing' | 'completed' | 'failed'
export type SourceType = 'upload' | 'youtube' | 'twitch'
export type ProcessingMode = 'sports_analysis' | 'short_form'
export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9'

export interface VideoRecord {
  id: string
  user_id: string
  title: string
  source_type: SourceType
  source_url: string | null
  storage_path: string | null
  duration_seconds: number | null
  resolution: string | null
  status: VideoStatus
  processing_mode: ProcessingMode
  created_at: string
  updated_at: string
}

export interface ClipRecord {
  id: string
  video_id: string
  user_id: string
  reka_clip_id: string | null
  clip_url: string | null
  title: string | null
  caption: string | null
  hashtags: string[] | null
  quality_score: number | null
  start_time: number | null
  end_time: number | null
  aspect_ratio: AspectRatio | null
  resolution: string | null
  processing_mode: ProcessingMode
  segment_start: number | null
  segment_end: number | null
  created_at: string
}

export interface JobRecord {
  id: string
  user_id: string
  video_id: string | null
  job_type: 'clip_generation' | 'tagging' | 'analysis'
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  result: any
  error: string | null
  created_at: string
  updated_at: string
}

// Player Tracking Types
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
