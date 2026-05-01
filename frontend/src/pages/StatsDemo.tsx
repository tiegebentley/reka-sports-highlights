import { useState } from 'react';
import { PlayerStatsCard } from '../components/stats/PlayerStatsCard';
import { HeatmapVisualizer } from '../components/stats/HeatmapVisualizer';
import type { PlayerStats, PlayerHeatmap } from '../types/stats';

export const StatsDemo = () => {
  const [selectedView, setSelectedView] = useState<'stats' | 'heatmap' | 'both'>('both');

  // Demo data
  const demoPlayerStats: PlayerStats = {
    id: 'demo-stats-1',
    playerId: 'player-1',
    videoId: 'video-1',
    timePlayedSeconds: 5400, // 90 minutes
    touches: 87,
    distanceCoveredMeters: 10523,
    averageSpeedKmh: 6.8,
    maxSpeedKmh: 28.5,
    sprints: 23,
    goals: 2,
    assists: 1,
    shots: 7,
    shotsOnTarget: 5,
    passesAttempted: 52,
    passesCompleted: 43,
    keyPasses: 3,
    dribblesAttempted: 8,
    dribblesSuccessful: 6,
    tackles: 4,
    interceptions: 2,
    clearances: 1,
    blocks: 0,
    possessionSeconds: 1200,
    dispossessed: 3,
    foulsCommitted: 2,
    foulsWon: 4,
    passAccuracy: 82.7,
    shotAccuracy: 71.4,
    dribbleSuccessRate: 75.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const demoHeatmap: PlayerHeatmap = {
    id: 'heatmap-1',
    playerId: 'player-1',
    videoId: 'video-1',
    heatmapData: generateDemoHeatmapData(),
    gridWidth: 100,
    gridHeight: 100,
    maxIntensity: 45,
    createdAt: new Date().toISOString(),
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
        }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #4ECDC4 0%, #45B7D1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Stats Tracking & Analytics
          </h1>
          <p style={{
            fontSize: '18px',
            color: '#aaa',
            maxWidth: '800px',
            margin: '0 auto 24px auto',
          }}>
            Comprehensive player performance tracking with advanced metrics,
            heatmaps, and AI-powered analytics.
          </p>

          {/* View Toggle */}
          <div style={{
            display: 'inline-flex',
            gap: '8px',
            background: '#1a1a1a',
            padding: '4px',
            borderRadius: '6px',
            border: '1px solid #333',
          }}>
            {(['stats', 'heatmap', 'both'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                style={{
                  padding: '8px 20px',
                  background: selectedView === view ? '#4ECDC4' : 'transparent',
                  color: selectedView === view ? '#0a0a0a' : '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {view === 'both' ? 'Combined View' : view}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedView === 'both' ? '1fr 1fr' : '1fr',
          gap: '24px',
          marginBottom: '48px',
        }}>
          {/* Player Stats */}
          {(selectedView === 'stats' || selectedView === 'both') && (
            <PlayerStatsCard
              playerStats={demoPlayerStats}
              playerName="Marcus Silva"
              playerNumber={10}
              showDetailed={true}
            />
          )}

          {/* Heatmap */}
          {(selectedView === 'heatmap' || selectedView === 'both') && (
            <HeatmapVisualizer
              heatmap={demoHeatmap}
              width={340}
              height={525}
              colorScheme="heat"
              showGrid={false}
            />
          )}
        </div>

        {/* Feature Highlights */}
        <div style={{
          marginBottom: '48px',
        }}>
          <h2 style={{
            color: '#fff',
            fontSize: '28px',
            fontWeight: 'bold',
            marginBottom: '24px',
            textAlign: 'center',
          }}>
            Analytics Features
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}>
            {[
              {
                icon: '📊',
                title: 'Comprehensive Stats',
                description: 'Track offensive, defensive, physical, and discipline metrics',
              },
              {
                icon: '🗺️',
                title: 'Movement Heatmaps',
                description: 'Visualize player positioning and areas of activity',
              },
              {
                icon: '📈',
                title: 'Performance Trends',
                description: 'Monitor player improvement over time with historical data',
              },
              {
                icon: '⚡',
                title: 'Real-time Calculation',
                description: 'Automatic stats calculation from tracking data',
              },
              {
                icon: '🎯',
                title: 'Accuracy Metrics',
                description: 'Pass accuracy, shot accuracy, and dribble success rates',
              },
              {
                icon: '🏃',
                title: 'Physical Metrics',
                description: 'Distance covered, speed, sprints, and work rate analysis',
              },
            ].map((feature, index) => (
              <div
                key={index}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  padding: '24px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                  {feature.icon}
                </div>
                <h3 style={{
                  color: '#fff',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  color: '#aaa',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  margin: 0,
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Categories */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px',
        }}>
          <h3 style={{
            color: '#fff',
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '16px',
          }}>
            Tracked Metrics
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}>
            <MetricCategory
              title="Offensive"
              metrics={[
                'Goals',
                'Assists',
                'Shots & Shot Accuracy',
                'Passes & Pass Accuracy',
                'Key Passes',
                'Dribbles & Success Rate',
              ]}
            />
            <MetricCategory
              title="Defensive"
              metrics={[
                'Tackles',
                'Interceptions',
                'Clearances',
                'Blocks',
              ]}
            />
            <MetricCategory
              title="Physical"
              metrics={[
                'Distance Covered',
                'Average Speed',
                'Maximum Speed',
                'Sprint Count',
                'Time Played',
              ]}
            />
            <MetricCategory
              title="Possession"
              metrics={[
                'Touches',
                'Possession Time',
                'Dispossessed',
                'Fouls Won/Committed',
              ]}
            />
          </div>
        </div>

        {/* Technical Details */}
        <div style={{
          background: '#2a2a1a',
          border: '1px solid #4a4a2a',
          borderRadius: '6px',
          padding: '24px',
          color: '#e6db74',
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>
            ℹ️ How It Works
          </h4>
          <ol style={{ margin: '0', paddingLeft: '24px', lineHeight: '2' }}>
            <li>Player tracking data is captured during video processing</li>
            <li>Edge Function calculates movement, speed, and positioning stats</li>
            <li>Stats are stored in database with automatic accuracy calculations</li>
            <li>Heatmaps are generated from grid-based position data</li>
            <li>Performance ratings calculated from weighted metrics</li>
            <li>Real-time updates via Supabase Realtime subscriptions</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

// Helper Components

const MetricCategory = ({ title, metrics }: { title: string; metrics: string[] }) => (
  <div>
    <h4 style={{
      color: '#4ECDC4',
      fontSize: '14px',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      marginBottom: '12px',
    }}>
      {title}
    </h4>
    <ul style={{
      margin: 0,
      padding: 0,
      listStyle: 'none',
    }}>
      {metrics.map((metric, i) => (
        <li
          key={i}
          style={{
            padding: '6px 0',
            fontSize: '13px',
            color: '#aaa',
            borderBottom: i < metrics.length - 1 ? '1px solid #333' : 'none',
          }}
        >
          • {metric}
        </li>
      ))}
    </ul>
  </div>
);

/**
 * Generate demo heatmap data for visualization
 */
function generateDemoHeatmapData(): Record<string, number> {
  const heatmap: Record<string, number> = {};

  // Central attacking midfielder position
  // High activity in central midfield and final third

  // Central midfield area (50-70% of pitch)
  for (let x = 40; x < 60; x += 2) {
    for (let y = 50; y < 70; y += 2) {
      heatmap[`${x}_${y}`] = Math.floor(Math.random() * 30) + 15;
    }
  }

  // Attacking third (70-90% of pitch)
  for (let x = 35; x < 65; x += 3) {
    for (let y = 70; y < 90; y += 3) {
      heatmap[`${x}_${y}`] = Math.floor(Math.random() * 20) + 10;
    }
  }

  // Hot spots (goal scoring positions)
  const hotSpots = [
    { x: 45, y: 85 }, // Left of box
    { x: 50, y: 88 }, // Center of box
    { x: 55, y: 85 }, // Right of box
  ];

  hotSpots.forEach(({ x, y }) => {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        const intensity = Math.max(0, 45 - distance * 10);
        heatmap[`${x + dx}_${y + dy}`] = Math.floor(intensity);
      }
    }
  });

  return heatmap;
}
