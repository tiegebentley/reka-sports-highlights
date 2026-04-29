import { useState } from 'react';
import type { EditableBoundingBox, PlayerProfile } from '../../types/tracking';

interface PlayerAssignmentPanelProps {
  boxes: EditableBoundingBox[];
  players: PlayerProfile[];
  selectedBoxId: string | null;
  currentFrame: number;
  onAssignPlayer: (boxId: string, playerId: string | null) => void;
  onCreatePlayer: (player: Omit<PlayerProfile, 'id'>) => void;
  onMergeBoxes: (boxIds: string[], playerId: string) => void;
}

export const PlayerAssignmentPanel = ({
  boxes,
  players,
  selectedBoxId,
  currentFrame,
  onAssignPlayer,
  onCreatePlayer,
  onMergeBoxes,
}: PlayerAssignmentPanelProps) => {
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [selectedBoxes, setSelectedBoxes] = useState<Set<string>>(new Set());

  // Get current frame boxes
  const currentBoxes = boxes.filter(box => box.frame === currentFrame);

  // Group boxes by player
  const boxesByPlayer = players.reduce((acc, player) => {
    acc[player.id] = currentBoxes.filter(box => box.playerId === player.id);
    return acc;
  }, {} as Record<string, EditableBoundingBox[]>);

  const unassignedBoxes = currentBoxes.filter(box => !box.playerId);

  const handleCreatePlayer = () => {
    if (!newPlayerName.trim()) return;

    // Generate random color
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    onCreatePlayer({
      name: newPlayerName,
      number: newPlayerNumber ? parseInt(newPlayerNumber) : undefined,
      color,
    });

    setNewPlayerName('');
    setNewPlayerNumber('');
    setShowNewPlayerForm(false);
  };

  const toggleBoxSelection = (boxId: string) => {
    const newSelection = new Set(selectedBoxes);
    if (newSelection.has(boxId)) {
      newSelection.delete(boxId);
    } else {
      newSelection.add(boxId);
    }
    setSelectedBoxes(newSelection);
  };

  const handleMerge = (playerId: string) => {
    if (selectedBoxes.size < 2) return;
    onMergeBoxes(Array.from(selectedBoxes), playerId);
    setSelectedBoxes(new Set());
  };

  return (
    <div className="player-assignment-panel" style={{
      width: '300px',
      height: '100%',
      overflowY: 'auto',
      background: '#1a1a1a',
      color: '#fff',
      padding: '16px',
      borderLeft: '1px solid #333'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
        Player Assignment
      </h3>

      {/* Frame Info */}
      <div style={{ marginBottom: '16px', padding: '12px', background: '#252525', borderRadius: '6px' }}>
        <div style={{ fontSize: '14px', opacity: 0.7 }}>Frame {currentFrame}</div>
        <div style={{ fontSize: '14px', opacity: 0.7 }}>{currentBoxes.length} detections</div>
      </div>

      {/* Unassigned Boxes */}
      {unassignedBoxes.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#888' }}>
            Unassigned ({unassignedBoxes.length})
          </h4>
          {unassignedBoxes.map(box => (
            <div
              key={box.id}
              style={{
                padding: '8px',
                marginBottom: '6px',
                background: box.id === selectedBoxId ? '#333' : '#252525',
                borderRadius: '4px',
                cursor: 'pointer',
                border: selectedBoxes.has(box.id) ? '2px solid #4ECDC4' : '2px solid transparent',
              }}
              onClick={() => toggleBoxSelection(box.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>Box #{box.id.slice(0, 6)}</span>
                <span>{Math.round(box.confidence * 100)}%</span>
              </div>
              <select
                value={box.playerId || ''}
                onChange={(e) => onAssignPlayer(box.id, e.target.value || null)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '4px',
                  background: '#1a1a1a',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                }}
              >
                <option value="">Assign to player...</option>
                {players.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name} {player.number ? `#${player.number}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Players with Boxes */}
      {players.map(player => {
        const playerBoxes = boxesByPlayer[player.id] || [];
        if (playerBoxes.length === 0) return null;

        return (
          <div key={player.id} style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '8px',
              gap: '8px'
            }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  background: player.color,
                  borderRadius: '50%',
                }}
              />
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
                {player.name} {player.number ? `#${player.number}` : ''} ({playerBoxes.length})
              </h4>
            </div>
            {playerBoxes.map(box => (
              <div
                key={box.id}
                style={{
                  padding: '8px',
                  marginBottom: '6px',
                  background: box.id === selectedBoxId ? '#333' : '#252525',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: selectedBoxes.has(box.id) ? `2px solid ${player.color}` : '2px solid transparent',
                }}
                onClick={() => toggleBoxSelection(box.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span>Box #{box.id.slice(0, 6)}</span>
                  <span>{Math.round(box.confidence * 100)}%</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssignPlayer(box.id, null);
                  }}
                  style={{
                    marginTop: '6px',
                    width: '100%',
                    padding: '4px',
                    background: '#FF6B6B',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Unassign
                </button>
              </div>
            ))}
          </div>
        );
      })}

      {/* Merge Selected Boxes */}
      {selectedBoxes.size >= 2 && (
        <div style={{ marginBottom: '24px', padding: '12px', background: '#252525', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
            Merge {selectedBoxes.size} Boxes
          </h4>
          <select
            onChange={(e) => e.target.value && handleMerge(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '4px',
            }}
          >
            <option value="">Select player...</option>
            {players.map(player => (
              <option key={player.id} value={player.id}>
                {player.name} {player.number ? `#${player.number}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Create New Player */}
      {!showNewPlayerForm ? (
        <button
          onClick={() => setShowNewPlayerForm(true)}
          style={{
            width: '100%',
            padding: '12px',
            background: '#4ECDC4',
            color: '#1a1a1a',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          + Create New Player
        </button>
      ) : (
        <div style={{ padding: '12px', background: '#252525', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>
            New Player
          </h4>
          <input
            type="text"
            placeholder="Player name"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '8px',
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '4px',
            }}
          />
          <input
            type="number"
            placeholder="Jersey number (optional)"
            value={newPlayerNumber}
            onChange={(e) => setNewPlayerNumber(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '12px',
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '4px',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCreatePlayer}
              style={{
                flex: 1,
                padding: '8px',
                background: '#4ECDC4',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowNewPlayerForm(false);
                setNewPlayerName('');
                setNewPlayerNumber('');
              }}
              style={{
                flex: 1,
                padding: '8px',
                background: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* All Players List */}
      <div style={{ marginTop: '24px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#888' }}>
          All Players ({players.length})
        </h4>
        {players.map(player => (
          <div
            key={player.id}
            style={{
              padding: '8px',
              marginBottom: '6px',
              background: '#252525',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                background: player.color,
                borderRadius: '50%',
              }}
            />
            <span style={{ fontSize: '12px' }}>
              {player.name} {player.number ? `#${player.number}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
