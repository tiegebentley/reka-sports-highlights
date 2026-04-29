import { PlayerStats, formatStatValue, calculatePlayerRating } from '../../types/stats';

interface PlayerStatsCardProps {
  playerStats: PlayerStats;
  playerName?: string;
  playerNumber?: number;
  showDetailed?: boolean;
}

export const PlayerStatsCard = ({
  playerStats,
  playerName = 'Player',
  playerNumber,
  showDetailed = false,
}: PlayerStatsCardProps) => {
  const rating = calculatePlayerRating(playerStats);

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return '#4ECDC4'; // Excellent
    if (rating >= 7) return '#45B7D1'; // Good
    if (rating >= 6) return '#FFA07A'; // Average
    if (rating >= 5) return '#ff9a61'; // Below Average
    return '#ff6b6b'; // Poor
  };

  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '20px',
      color: '#fff',
    }}>
      {/* Player Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid #333',
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 'bold' }}>
            {playerName}
            {playerNumber && (
              <span style={{
                marginLeft: '12px',
                padding: '4px 12px',
                background: '#2a2a2a',
                borderRadius: '4px',
                fontSize: '14px',
                color: '#4ECDC4',
              }}>
                #{playerNumber}
              </span>
            )}
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
            {Math.floor(playerStats.timePlayedSeconds / 60)} min played
          </p>
        </div>

        {/* Overall Rating */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${getRatingColor(rating)} 0%, ${getRatingColor(rating)}dd 100%)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '3px solid #2a2a2a',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
            {rating.toFixed(1)}
          </div>
          <div style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase' }}>
            Rating
          </div>
        </div>
      </div>

      {/* Key Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <StatItem label="Goals" value={playerStats.goals} icon="⚽" />
        <StatItem label="Assists" value={playerStats.assists} icon="🎯" />
        <StatItem
          label="Distance"
          value={formatStatValue(playerStats.distanceCoveredMeters, 'm')}
          icon="🏃"
        />
        <StatItem
          label="Max Speed"
          value={formatStatValue(playerStats.maxSpeedKmh, 'km/h')}
          icon="⚡"
        />
      </div>

      {/* Detailed Stats (Collapsible) */}
      {showDetailed && (
        <>
          {/* Offensive Stats */}
          <StatsSection title="Offensive">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
            }}>
              <StatRow
                label="Shots"
                value={playerStats.shots}
                subValue={`${playerStats.shotsOnTarget} on target`}
              />
              <StatRow
                label="Shot Accuracy"
                value={formatStatValue(playerStats.shotAccuracy, '%')}
              />
              <StatRow
                label="Passes"
                value={`${playerStats.passesCompleted}/${playerStats.passesAttempted}`}
              />
              <StatRow
                label="Pass Accuracy"
                value={formatStatValue(playerStats.passAccuracy, '%')}
              />
              <StatRow
                label="Key Passes"
                value={playerStats.keyPasses}
              />
              <StatRow
                label="Dribbles"
                value={`${playerStats.dribblesSuccessful}/${playerStats.dribblesAttempted}`}
                subValue={formatStatValue(playerStats.dribbleSuccessRate, '%')}
              />
            </div>
          </StatsSection>

          {/* Defensive Stats */}
          <StatsSection title="Defensive">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
            }}>
              <StatRow label="Tackles" value={playerStats.tackles} />
              <StatRow label="Interceptions" value={playerStats.interceptions} />
              <StatRow label="Clearances" value={playerStats.clearances} />
              <StatRow label="Blocks" value={playerStats.blocks} />
            </div>
          </StatsSection>

          {/* Physical Stats */}
          <StatsSection title="Physical">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
            }}>
              <StatRow
                label="Distance"
                value={formatStatValue(playerStats.distanceCoveredMeters, 'm')}
              />
              <StatRow
                label="Avg Speed"
                value={formatStatValue(playerStats.averageSpeedKmh, 'km/h')}
              />
              <StatRow
                label="Max Speed"
                value={formatStatValue(playerStats.maxSpeedKmh, 'km/h')}
              />
              <StatRow label="Sprints" value={playerStats.sprints} />
            </div>
          </StatsSection>

          {/* Discipline */}
          <StatsSection title="Discipline">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
            }}>
              <StatRow label="Fouls Committed" value={playerStats.foulsCommitted} />
              <StatRow label="Fouls Won" value={playerStats.foulsWon} />
              <StatRow label="Dispossessed" value={playerStats.dispossessed} />
            </div>
          </StatsSection>
        </>
      )}
    </div>
  );
};

// Helper Components

const StatItem = ({ label, value, icon }: { label: string; value: string | number; icon: string }) => (
  <div style={{
    background: '#2a2a2a',
    padding: '12px',
    borderRadius: '6px',
    textAlign: 'center',
  }}>
    <div style={{ fontSize: '24px', marginBottom: '4px' }}>{icon}</div>
    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '2px' }}>{value}</div>
    <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase' }}>{label}</div>
  </div>
);

const StatsSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginTop: '16px' }}>
    <h4 style={{
      margin: '0 0 12px 0',
      fontSize: '14px',
      textTransform: 'uppercase',
      color: '#4ECDC4',
      fontWeight: 'bold',
    }}>
      {title}
    </h4>
    {children}
  </div>
);

const StatRow = ({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string | number;
  subValue?: string;
}) => (
  <div style={{
    padding: '8px',
    background: '#2a2a2a',
    borderRadius: '4px',
  }}>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span style={{ fontSize: '12px', color: '#aaa' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{value}</span>
    </div>
    {subValue && (
      <div style={{
        fontSize: '10px',
        color: '#666',
        marginTop: '4px',
        textAlign: 'right',
      }}>
        {subValue}
      </div>
    )}
  </div>
);
