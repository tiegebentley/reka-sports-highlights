import type { TrackValidationIssue, EditableBoundingBox, PlayerProfile } from '../../types/tracking';

interface TrackValidationProps {
  boxes: EditableBoundingBox[];
  players: PlayerProfile[];
  onJumpToFrame: (frame: number) => void;
  onSelectBox: (boxId: string) => void;
}

export const TrackValidation = ({
  boxes,
  players,
  onJumpToFrame,
  onSelectBox,
}: TrackValidationProps) => {
  // Validate tracking data and find issues
  const validateTracks = (): TrackValidationIssue[] => {
    const issues: TrackValidationIssue[] = [];

    // Group boxes by player
    const boxesByPlayer = players.reduce((acc, player) => {
      acc[player.id] = boxes.filter(box => box.playerId === player.id).sort((a, b) => a.frame - b.frame);
      return acc;
    }, {} as Record<string, EditableBoundingBox[]>);

    // Check for low confidence detections
    boxes.forEach(box => {
      if (box.confidence < 0.7) {
        issues.push({
          type: 'low_confidence',
          severity: box.confidence < 0.5 ? 'error' : 'warning',
          frame: box.frame,
          boxId: box.id,
          playerId: box.playerId || undefined,
          message: `Low confidence detection (${Math.round(box.confidence * 100)}%)`,
        });
      }
    });

    // Check for unassigned boxes
    const unassignedBoxes = boxes.filter(box => !box.playerId);
    unassignedBoxes.forEach(box => {
      issues.push({
        type: 'missing',
        severity: 'warning',
        frame: box.frame,
        boxId: box.id,
        message: 'Unassigned detection',
      });
    });

    // Check for frame gaps in player tracks
    Object.entries(boxesByPlayer).forEach(([playerId, playerBoxes]) => {
      if (playerBoxes.length < 2) return;

      for (let i = 1; i < playerBoxes.length; i++) {
        const gap = playerBoxes[i].frame - playerBoxes[i - 1].frame;
        if (gap > 30) { // More than 1 second gap at 30fps
          issues.push({
            type: 'frame_gap',
            severity: gap > 90 ? 'error' : 'warning',
            frame: playerBoxes[i - 1].frame,
            playerId,
            message: `${gap}-frame gap in tracking`,
          });
        }
      }
    });

    // Check for potential ID switches (sudden position jumps)
    Object.entries(boxesByPlayer).forEach(([playerId, playerBoxes]) => {
      for (let i = 1; i < playerBoxes.length; i++) {
        const prev = playerBoxes[i - 1];
        const curr = playerBoxes[i];

        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If player moved more than 500px in one frame, likely an ID switch
        if (distance > 500 && curr.frame - prev.frame === 1) {
          issues.push({
            type: 'id_switch',
            severity: 'error',
            frame: curr.frame,
            boxId: curr.id,
            playerId,
            message: 'Potential ID switch (sudden position jump)',
          });
        }
      }
    });

    // Check for duplicate boxes (same player, same frame)
    const framePlayerMap = new Map<string, string[]>();
    boxes.forEach(box => {
      if (!box.playerId) return;
      const key = `${box.frame}-${box.playerId}`;
      if (!framePlayerMap.has(key)) {
        framePlayerMap.set(key, []);
      }
      framePlayerMap.get(key)!.push(box.id);
    });

    framePlayerMap.forEach((boxIds, key) => {
      if (boxIds.length > 1) {
        const [frame, playerId] = key.split('-');
        issues.push({
          type: 'duplicate',
          severity: 'error',
          frame: parseInt(frame),
          playerId,
          message: `${boxIds.length} boxes for same player`,
        });
      }
    });

    return issues.sort((a, b) => a.frame - b.frame);
  };

  const issues = validateTracks();

  // Group issues by severity
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  const getSeverityColor = (severity: 'warning' | 'error') => {
    return severity === 'error' ? '#FF6B6B' : '#FFA07A';
  };

  const getTypeIcon = (type: TrackValidationIssue['type']) => {
    switch (type) {
      case 'low_confidence': return '⚠️';
      case 'frame_gap': return '📊';
      case 'id_switch': return '🔄';
      case 'duplicate': return '👥';
      case 'missing': return '❓';
      default: return '•';
    }
  };

  return (
    <div className="track-validation" style={{
      width: '300px',
      height: '100%',
      overflowY: 'auto',
      background: '#1a1a1a',
      color: '#fff',
      padding: '16px',
      borderRight: '1px solid #333'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
        Track Validation
      </h3>

      {/* Summary */}
      <div style={{ marginBottom: '24px', padding: '12px', background: '#252525', borderRadius: '6px' }}>
        <div style={{ marginBottom: '8px', fontSize: '14px' }}>
          <span style={{ color: getSeverityColor('error') }}>
            {errors.length} Errors
          </span>
          {' • '}
          <span style={{ color: getSeverityColor('warning') }}>
            {warnings.length} Warnings
          </span>
        </div>
        {issues.length === 0 && (
          <div style={{ fontSize: '14px', opacity: 0.7 }}>
            ✅ No issues detected
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: 'bold',
            color: getSeverityColor('error')
          }}>
            Errors ({errors.length})
          </h4>
          {errors.map((issue, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px',
                marginBottom: '8px',
                background: '#252525',
                borderRadius: '4px',
                borderLeft: `4px solid ${getSeverityColor(issue.severity)}`,
                cursor: 'pointer',
              }}
              onClick={() => {
                onJumpToFrame(issue.frame);
                if (issue.boxId) onSelectBox(issue.boxId);
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px',
                fontSize: '12px',
                opacity: 0.7
              }}>
                <span>{getTypeIcon(issue.type)}</span>
                <span>Frame {issue.frame}</span>
              </div>
              <div style={{ fontSize: '14px' }}>{issue.message}</div>
              {issue.playerId && (
                <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
                  Player: {players.find(p => p.id === issue.playerId)?.name || 'Unknown'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: 'bold',
            color: getSeverityColor('warning')
          }}>
            Warnings ({warnings.length})
          </h4>
          {warnings.map((issue, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px',
                marginBottom: '8px',
                background: '#252525',
                borderRadius: '4px',
                borderLeft: `4px solid ${getSeverityColor(issue.severity)}`,
                cursor: 'pointer',
              }}
              onClick={() => {
                onJumpToFrame(issue.frame);
                if (issue.boxId) onSelectBox(issue.boxId);
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px',
                fontSize: '12px',
                opacity: 0.7
              }}>
                <span>{getTypeIcon(issue.type)}</span>
                <span>Frame {issue.frame}</span>
              </div>
              <div style={{ fontSize: '14px' }}>{issue.message}</div>
              {issue.playerId && (
                <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
                  Player: {players.find(p => p.id === issue.playerId)?.name || 'Unknown'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Issue Type Legend */}
      <div style={{
        marginTop: '24px',
        padding: '12px',
        background: '#252525',
        borderRadius: '6px'
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 'bold', opacity: 0.7 }}>
          Issue Types
        </h4>
        <div style={{ fontSize: '11px', opacity: 0.7, lineHeight: '1.6' }}>
          <div>⚠️ Low Confidence - Detection below 70%</div>
          <div>📊 Frame Gap - Missing frames in track</div>
          <div>🔄 ID Switch - Sudden position jump</div>
          <div>👥 Duplicate - Multiple boxes for same player</div>
          <div>❓ Missing - Unassigned detection</div>
        </div>
      </div>
    </div>
  );
};
