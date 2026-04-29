// Types for manual tracking correction UI

export interface EditableBoundingBox {
  id: string;
  frame: number;
  timestamp: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  playerId: string | null;
  isEditing?: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
}

export interface TrackingEditorState {
  currentFrame: number;
  selectedBoxId: string | null;
  selectedPlayerId: string | null;
  zoomLevel: number;
  isPaused: boolean;
  editMode: 'select' | 'draw' | 'delete';
  unsavedChanges: boolean;
}

export interface PlayerProfile {
  id: string;
  name: string;
  number?: number;
  photoUrl?: string;
  teamId?: string;
  color: string;
}

export interface TrackValidationIssue {
  type: 'low_confidence' | 'frame_gap' | 'id_switch' | 'duplicate' | 'missing';
  severity: 'warning' | 'error';
  frame: number;
  boxId?: string;
  playerId?: string;
  message: string;
}

export interface TrackSegment {
  startFrame: number;
  endFrame: number;
  playerId: string | null;
  boxes: EditableBoundingBox[];
  confidence: number;
}
