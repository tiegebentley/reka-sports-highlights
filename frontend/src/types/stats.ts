// Stats Type Definitions

export interface PlayerStats {
  id: string;
  playerId: string;
  videoId: string;
  clipId?: string;

  // Time-based stats
  timePlayedSeconds: number;
  touches: number;

  // Movement stats
  distanceCoveredMeters: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  sprints: number;

  // Offensive stats
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passesAttempted: number;
  passesCompleted: number;
  keyPasses: number;
  dribblesAttempted: number;
  dribblesSuccessful: number;

  // Defensive stats
  tackles: number;
  interceptions: number;
  clearances: number;
  blocks: number;

  // Possession stats
  possessionSeconds: number;
  dispossessed: number;
  foulsCommitted: number;
  foulsWon: number;

  // Calculated metrics
  passAccuracy: number;
  shotAccuracy: number;
  dribbleSuccessRate: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface TeamStats {
  id: string;
  teamId: string;
  videoId: string;

  // Match result
  goalsScored: number;
  goalsConceded: number;
  result: 'win' | 'loss' | 'draw';

  // Possession
  possessionPercentage: number;

  // Passing
  totalPasses: number;
  completedPasses: number;
  passAccuracy: number;

  // Shooting
  totalShots: number;
  shotsOnTarget: number;
  shotAccuracy: number;

  // Defensive
  tackles: number;
  interceptions: number;
  clearances: number;

  // Discipline
  yellowCards: number;
  redCards: number;
  fouls: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface MatchStats {
  id: string;
  videoId: string;

  // Match info
  matchDate: string;
  homeTeamId: string;
  awayTeamId: string;
  venue?: string;

  // Score
  homeScore: number;
  awayScore: number;

  // Duration
  durationMinutes: number;

  // Environment
  weather?: string;
  temperatureCelsius?: number;

  // Highlights
  totalHighlights: number;
  totalClips: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface PlayerPerformancePoint {
  id: string;
  playerId: string;
  timestamp: string;

  // Performance metrics
  rating: number; // 0.0 - 10.0
  goals: number;
  assists: number;
  distanceCoveredMeters: number;

  // Context
  videoId: string;
  matchDate: string;

  createdAt: string;
}

export interface PlayerHeatmap {
  id: string;
  playerId: string;
  videoId: string;

  // Grid-based heatmap data
  heatmapData: Record<string, number>; // { "x_y": intensity }

  // Metadata
  gridWidth: number;
  gridHeight: number;
  maxIntensity: number;

  createdAt: string;
}

// UI Component Props

export interface StatsCardProps {
  label: string;
  value: number | string;
  unit?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
}

export interface PlayerStatsCardProps {
  playerStats: PlayerStats;
  showDetailed?: boolean;
}

export interface TeamStatsCardProps {
  teamStats: TeamStats;
  showDetailed?: boolean;
}

export interface HeatmapVisualizerProps {
  heatmapData: Record<string, number>;
  gridWidth?: number;
  gridHeight?: number;
  colorScheme?: 'blue' | 'red' | 'green' | 'heat';
}

export interface PerformanceChartProps {
  data: PlayerPerformancePoint[];
  metric: 'rating' | 'goals' | 'assists' | 'distance';
  timeRange?: '7d' | '30d' | '90d' | 'all';
}

export interface StatsComparisonProps {
  playerA: PlayerStats;
  playerB: PlayerStats;
  metrics: Array<keyof PlayerStats>;
}

// Helper functions

export function formatStatValue(value: number, unit?: string): string {
  if (unit === 'percentage' || unit === '%') {
    return `${value.toFixed(1)}%`;
  } else if (unit === 'meters' || unit === 'm') {
    return `${value.toFixed(0)}m`;
  } else if (unit === 'kmh' || unit === 'km/h') {
    return `${value.toFixed(1)} km/h`;
  } else if (unit === 'seconds' || unit === 's') {
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return value.toString();
}

export function calculatePlayerRating(stats: PlayerStats): number {
  // Simplified rating calculation (0-10 scale)
  let rating = 5.0; // Base rating

  // Offensive contribution
  rating += stats.goals * 0.5;
  rating += stats.assists * 0.3;
  rating += (stats.passAccuracy / 100) * 2;
  rating += (stats.shotAccuracy / 100);

  // Defensive contribution
  rating += stats.tackles * 0.1;
  rating += stats.interceptions * 0.15;

  // Work rate
  rating += Math.min(stats.distanceCoveredMeters / 10000, 1);

  // Penalties
  rating -= stats.foulsCommitted * 0.1;
  rating -= stats.dispossessed * 0.05;

  // Clamp to 0-10
  return Math.max(0, Math.min(10, rating));
}

export function getStatTrend(
  current: number,
  previous: number
): { trend: 'up' | 'down' | 'neutral'; value: number } {
  if (previous === 0) {
    return { trend: 'neutral', value: 0 };
  }

  const percentChange = ((current - previous) / previous) * 100;

  if (Math.abs(percentChange) < 5) {
    return { trend: 'neutral', value: 0 };
  }

  return {
    trend: percentChange > 0 ? 'up' : 'down',
    value: Math.abs(percentChange),
  };
}

export function getStatCategory(
  metric: keyof PlayerStats
): 'offensive' | 'defensive' | 'physical' | 'discipline' {
  const offensiveStats = [
    'goals', 'assists', 'shots', 'shotsOnTarget',
    'passesCompleted', 'keyPasses', 'dribblesSuccessful'
  ];
  const defensiveStats = [
    'tackles', 'interceptions', 'clearances', 'blocks'
  ];
  const physicalStats = [
    'distanceCoveredMeters', 'averageSpeedKmh', 'maxSpeedKmh', 'sprints'
  ];
  const disciplineStats = [
    'foulsCommitted', 'foulsWon'
  ];

  if (offensiveStats.includes(metric as string)) return 'offensive';
  if (defensiveStats.includes(metric as string)) return 'defensive';
  if (physicalStats.includes(metric as string)) return 'physical';
  if (disciplineStats.includes(metric as string)) return 'discipline';

  return 'offensive';
}
