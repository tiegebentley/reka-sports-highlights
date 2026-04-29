import { useState, useRef, useCallback, useEffect } from 'react';
import { BoundingBoxEditor } from './BoundingBoxEditor';
import { PlayerAssignmentPanel } from './PlayerAssignmentPanel';
import { TrackValidation } from './TrackValidation';
import type { EditableBoundingBox, PlayerProfile, TrackingEditorState } from '../../types/tracking';

interface TrackingEditorProps {
  videoUrl: string;
  initialBoxes?: EditableBoundingBox[];
  initialPlayers?: PlayerProfile[];
  onSave: (boxes: EditableBoundingBox[], players: PlayerProfile[]) => Promise<void>;
  videoId?: string;
}

export const TrackingEditor = ({
  videoUrl,
  initialBoxes = [],
  initialPlayers = [],
  onSave,
}: TrackingEditorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [boxes, setBoxes] = useState<EditableBoundingBox[]>(initialBoxes);
  const [players, setPlayers] = useState<PlayerProfile[]>(initialPlayers);
  const [editorState, setEditorState] = useState<TrackingEditorState>({
    currentFrame: 0,
    selectedBoxId: null,
    selectedPlayerId: null,
    zoomLevel: 1,
    isPaused: true,
    editMode: 'select',
    unsavedChanges: false,
  });
  const [fps] = useState(30);
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(true);
  const [showAssignment, setShowAssignment] = useState(true);

  // Update current frame based on video time
  useEffect(() => {
    if (!videoRef.current) return;

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        const frame = Math.floor(videoRef.current.currentTime * fps);
        setEditorState(prev => ({ ...prev, currentFrame: frame }));
      }
    };

    const handlePlay = () => setEditorState(prev => ({ ...prev, isPaused: false }));
    const handlePause = () => setEditorState(prev => ({ ...prev, isPaused: true }));

    const video = videoRef.current;
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [fps]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (videoRef.current.paused) {
            videoRef.current.play();
          } else {
            videoRef.current.pause();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekFrame('backward');
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekFrame('forward');
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (editorState.selectedBoxId) {
            handleBoxDelete(editorState.selectedBoxId);
          }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSave();
          }
          break;
        case 'Escape':
          setEditorState(prev => ({ ...prev, selectedBoxId: null, editMode: 'select' }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorState.selectedBoxId]);

  const seekFrame = (direction: 'forward' | 'backward') => {
    if (!videoRef.current) return;
    const frameDuration = 1 / fps;
    const newTime = videoRef.current.currentTime + (direction === 'forward' ? frameDuration : -frameDuration);
    videoRef.current.currentTime = Math.max(0, Math.min(newTime, videoRef.current.duration));
  };

  const jumpToFrame = (frame: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = frame / fps;
  };

  const handleBoxUpdate = useCallback((boxId: string, updates: Partial<EditableBoundingBox>) => {
    setBoxes(prev => prev.map(box =>
      box.id === boxId ? { ...box, ...updates } : box
    ));
    setEditorState(prev => ({ ...prev, unsavedChanges: true }));
  }, []);

  const handleBoxDelete = useCallback((boxId: string) => {
    setBoxes(prev => prev.filter(box => box.id !== boxId));
    setEditorState(prev => ({
      ...prev,
      selectedBoxId: null,
      unsavedChanges: true,
    }));
  }, []);

  const handleBoxCreate = useCallback((box: Omit<EditableBoundingBox, 'id'>) => {
    const newBox: EditableBoundingBox = {
      ...box,
      id: `box-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };
    setBoxes(prev => [...prev, newBox]);
    setEditorState(prev => ({
      ...prev,
      selectedBoxId: newBox.id,
      unsavedChanges: true,
    }));
  }, []);

  const handleBoxSelect = useCallback((boxId: string | null) => {
    setEditorState(prev => ({ ...prev, selectedBoxId: boxId }));
  }, []);

  const handleAssignPlayer = useCallback((boxId: string, playerId: string | null) => {
    setBoxes(prev => prev.map(box =>
      box.id === boxId ? { ...box, playerId } : box
    ));
    setEditorState(prev => ({ ...prev, unsavedChanges: true }));
  }, []);

  const handleCreatePlayer = useCallback((player: Omit<PlayerProfile, 'id'>) => {
    const newPlayer: PlayerProfile = {
      ...player,
      id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };
    setPlayers(prev => [...prev, newPlayer]);
    setEditorState(prev => ({ ...prev, unsavedChanges: true }));
  }, []);

  const handleMergeBoxes = useCallback((boxIds: string[], playerId: string) => {
    setBoxes(prev => prev.map(box =>
      boxIds.includes(box.id) ? { ...box, playerId } : box
    ));
    setEditorState(prev => ({ ...prev, unsavedChanges: true }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(boxes, players);
      setEditorState(prev => ({ ...prev, unsavedChanges: false }));
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="tracking-editor" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0a0a0a',
      color: '#fff'
    }}>
      {/* Top toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 16px',
        background: '#1a1a1a',
        borderBottom: '1px solid #333'
      }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
          Tracking Editor
        </h2>

        <div style={{ flex: 1 }} />

        {/* Edit Mode */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['select', 'draw', 'delete'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setEditorState(prev => ({ ...prev, editMode: mode }))}
              style={{
                padding: '8px 16px',
                background: editorState.editMode === mode ? '#4ECDC4' : '#252525',
                color: editorState.editMode === mode ? '#0a0a0a' : '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: editorState.editMode === mode ? 'bold' : 'normal',
              }}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Panels Toggle */}
        <button
          onClick={() => setShowValidation(!showValidation)}
          style={{
            padding: '8px 16px',
            background: showValidation ? '#4ECDC4' : '#252525',
            color: showValidation ? '#0a0a0a' : '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Validation
        </button>
        <button
          onClick={() => setShowAssignment(!showAssignment)}
          style={{
            padding: '8px 16px',
            background: showAssignment ? '#4ECDC4' : '#252525',
            color: showAssignment ? '#0a0a0a' : '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Assignment
        </button>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!editorState.unsavedChanges || isSaving}
          style={{
            padding: '8px 24px',
            background: editorState.unsavedChanges ? '#4ECDC4' : '#333',
            color: editorState.unsavedChanges ? '#0a0a0a' : '#666',
            border: 'none',
            borderRadius: '4px',
            cursor: editorState.unsavedChanges ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          {isSaving ? 'Saving...' : editorState.unsavedChanges ? 'Save Changes' : 'Saved'}
        </button>
      </div>

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Validation Panel */}
        {showValidation && (
          <TrackValidation
            boxes={boxes}
            players={players}
            onJumpToFrame={jumpToFrame}
            onSelectBox={handleBoxSelect}
          />
        )}

        {/* Video area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Video player */}
          <div style={{
            flex: 1,
            position: 'relative',
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <video
              ref={videoRef}
              src={videoUrl}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                transform: `scale(${editorState.zoomLevel})`,
              }}
              controls={false}
            />
            <BoundingBoxEditor
              videoElement={videoRef.current}
              boxes={boxes}
              players={players}
              currentFrame={editorState.currentFrame}
              editMode={editorState.editMode}
              selectedBoxId={editorState.selectedBoxId}
              onBoxUpdate={handleBoxUpdate}
              onBoxDelete={handleBoxDelete}
              onBoxCreate={handleBoxCreate}
              onBoxSelect={handleBoxSelect}
            />
          </div>

          {/* Video controls */}
          <div style={{
            padding: '16px',
            background: '#1a1a1a',
            borderTop: '1px solid #333'
          }}>
            {/* Frame scrubber */}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="range"
                min="0"
                max={videoRef.current?.duration ? Math.floor(videoRef.current.duration * fps) : 1000}
                value={editorState.currentFrame}
                onChange={(e) => jumpToFrame(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                fontSize: '12px',
                opacity: 0.7
              }}>
                <span>Frame {editorState.currentFrame}</span>
                <span>{(editorState.currentFrame / fps).toFixed(2)}s</span>
              </div>
            </div>

            {/* Playback controls */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={() => seekFrame('backward')}
                style={{
                  padding: '8px 16px',
                  background: '#252525',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                ← Frame
              </button>
              <button
                onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
                style={{
                  padding: '8px 24px',
                  background: '#4ECDC4',
                  color: '#0a0a0a',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {editorState.isPaused ? '▶ Play' : '⏸ Pause'}
              </button>
              <button
                onClick={() => seekFrame('forward')}
                style={{
                  padding: '8px 16px',
                  background: '#252525',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Frame →
              </button>

              <div style={{ flex: 1 }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', opacity: 0.7 }}>Zoom:</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={editorState.zoomLevel}
                  onChange={(e) => setEditorState(prev => ({
                    ...prev,
                    zoomLevel: parseFloat(e.target.value)
                  }))}
                  style={{ width: '100px' }}
                />
                <span style={{ fontSize: '14px', width: '40px' }}>
                  {Math.round(editorState.zoomLevel * 100)}%
                </span>
              </div>
            </div>

            {/* Keyboard shortcuts help */}
            <div style={{
              marginTop: '12px',
              padding: '8px',
              background: '#252525',
              borderRadius: '4px',
              fontSize: '11px',
              opacity: 0.5
            }}>
              <strong>Shortcuts:</strong> Space=Play/Pause, ←→=Frame Step, Delete=Remove Box, Ctrl+S=Save, Esc=Deselect
            </div>
          </div>
        </div>

        {/* Assignment Panel */}
        {showAssignment && (
          <PlayerAssignmentPanel
            boxes={boxes}
            players={players}
            selectedBoxId={editorState.selectedBoxId}
            currentFrame={editorState.currentFrame}
            onAssignPlayer={handleAssignPlayer}
            onCreatePlayer={handleCreatePlayer}
            onMergeBoxes={handleMergeBoxes}
          />
        )}
      </div>
    </div>
  );
};
