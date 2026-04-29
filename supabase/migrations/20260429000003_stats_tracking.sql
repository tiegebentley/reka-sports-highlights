-- Stats Tracking System
-- Tracks player performance, team analytics, and match statistics

-- Player Stats Table
-- Aggregated statistics for each player per match/clip
CREATE TABLE IF NOT EXISTS player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE,
  clip_id uuid REFERENCES clips(id) ON DELETE SET NULL,

  -- Time-based stats
  time_played_seconds integer DEFAULT 0,
  touches integer DEFAULT 0,

  -- Movement stats
  distance_covered_meters numeric(10, 2) DEFAULT 0,
  average_speed_kmh numeric(5, 2) DEFAULT 0,
  max_speed_kmh numeric(5, 2) DEFAULT 0,
  sprints integer DEFAULT 0,

  -- Offensive stats
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  shots integer DEFAULT 0,
  shots_on_target integer DEFAULT 0,
  passes_attempted integer DEFAULT 0,
  passes_completed integer DEFAULT 0,
  key_passes integer DEFAULT 0,
  dribbles_attempted integer DEFAULT 0,
  dribbles_successful integer DEFAULT 0,

  -- Defensive stats
  tackles integer DEFAULT 0,
  interceptions integer DEFAULT 0,
  clearances integer DEFAULT 0,
  blocks integer DEFAULT 0,

  -- Possession stats
  possession_seconds integer DEFAULT 0,
  dispossessed integer DEFAULT 0,
  fouls_committed integer DEFAULT 0,
  fouls_won integer DEFAULT 0,

  -- Calculated metrics
  pass_accuracy numeric(5, 2) DEFAULT 0, -- percentage
  shot_accuracy numeric(5, 2) DEFAULT 0, -- percentage
  dribble_success_rate numeric(5, 2) DEFAULT 0, -- percentage

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Team Stats Table
-- Aggregated statistics for each team per match
CREATE TABLE IF NOT EXISTS team_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE,

  -- Match result
  goals_scored integer DEFAULT 0,
  goals_conceded integer DEFAULT 0,
  result text CHECK (result IN ('win', 'loss', 'draw')),

  -- Possession
  possession_percentage numeric(5, 2) DEFAULT 0,

  -- Passing
  total_passes integer DEFAULT 0,
  completed_passes integer DEFAULT 0,
  pass_accuracy numeric(5, 2) DEFAULT 0,

  -- Shooting
  total_shots integer DEFAULT 0,
  shots_on_target integer DEFAULT 0,
  shot_accuracy numeric(5, 2) DEFAULT 0,

  -- Defensive
  tackles integer DEFAULT 0,
  interceptions integer DEFAULT 0,
  clearances integer DEFAULT 0,

  -- Discipline
  yellow_cards integer DEFAULT 0,
  red_cards integer DEFAULT 0,
  fouls integer DEFAULT 0,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Match Stats Table
-- Overall match statistics and metadata
CREATE TABLE IF NOT EXISTS match_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE,

  -- Match info
  match_date timestamptz,
  home_team_id uuid REFERENCES teams(id),
  away_team_id uuid REFERENCES teams(id),
  venue text,

  -- Score
  home_score integer DEFAULT 0,
  away_score integer DEFAULT 0,

  -- Duration
  duration_minutes integer DEFAULT 90,

  -- Environment
  weather text,
  temperature_celsius integer,

  -- Highlights
  total_highlights integer DEFAULT 0,
  total_clips integer DEFAULT 0,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Player Performance Timeline
-- Time-series data for tracking performance over time
CREATE TABLE IF NOT EXISTS player_performance_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,

  -- Performance metrics
  rating numeric(3, 1), -- 0.0 - 10.0
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  distance_covered_meters numeric(10, 2) DEFAULT 0,

  -- Context
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE,
  match_date date,

  created_at timestamptz DEFAULT now()
);

-- Heatmap Data
-- Spatial data for player movement heatmaps
CREATE TABLE IF NOT EXISTS player_heatmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE,

  -- Grid-based heatmap data (100x100 grid)
  -- Each cell represents presence/activity intensity
  heatmap_data jsonb NOT NULL, -- { "x_y": intensity }

  -- Metadata
  grid_width integer DEFAULT 100,
  grid_height integer DEFAULT 100,
  max_intensity integer DEFAULT 0,

  created_at timestamptz DEFAULT now()
);

-- Stats Indexes
CREATE INDEX idx_player_stats_player_id ON player_stats(player_id);
CREATE INDEX idx_player_stats_video_id ON player_stats(video_id);
CREATE INDEX idx_player_stats_clip_id ON player_stats(clip_id);

CREATE INDEX idx_team_stats_team_id ON team_stats(team_id);
CREATE INDEX idx_team_stats_video_id ON team_stats(video_id);

CREATE INDEX idx_match_stats_video_id ON match_stats(video_id);
CREATE INDEX idx_match_stats_home_team ON match_stats(home_team_id);
CREATE INDEX idx_match_stats_away_team ON match_stats(away_team_id);
CREATE INDEX idx_match_stats_date ON match_stats(match_date);

CREATE INDEX idx_performance_timeline_player ON player_performance_timeline(player_id);
CREATE INDEX idx_performance_timeline_timestamp ON player_performance_timeline(timestamp DESC);

CREATE INDEX idx_heatmaps_player_id ON player_heatmaps(player_id);
CREATE INDEX idx_heatmaps_video_id ON player_heatmaps(video_id);

-- RLS Policies
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_performance_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_heatmaps ENABLE ROW LEVEL SECURITY;

-- Player Stats Policies
CREATE POLICY "Users can view player stats for their videos"
  ON player_stats FOR SELECT
  USING (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create player stats for their videos"
  ON player_stats FOR INSERT
  WITH CHECK (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update player stats for their videos"
  ON player_stats FOR UPDATE
  USING (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

-- Team Stats Policies
CREATE POLICY "Users can view team stats for their videos"
  ON team_stats FOR SELECT
  USING (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create team stats for their videos"
  ON team_stats FOR INSERT
  WITH CHECK (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update team stats for their videos"
  ON team_stats FOR UPDATE
  USING (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

-- Match Stats Policies
CREATE POLICY "Users can view match stats for their videos"
  ON match_stats FOR SELECT
  USING (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create match stats for their videos"
  ON match_stats FOR INSERT
  WITH CHECK (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update match stats for their videos"
  ON match_stats FOR UPDATE
  USING (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

-- Performance Timeline Policies
CREATE POLICY "Users can view performance timeline for their videos"
  ON player_performance_timeline FOR SELECT
  USING (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create performance timeline for their videos"
  ON player_performance_timeline FOR INSERT
  WITH CHECK (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

-- Heatmap Policies
CREATE POLICY "Users can view heatmaps for their videos"
  ON player_heatmaps FOR SELECT
  USING (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create heatmaps for their videos"
  ON player_heatmaps FOR INSERT
  WITH CHECK (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

-- Functions for calculated stats
CREATE OR REPLACE FUNCTION calculate_pass_accuracy(player_stat_id uuid)
RETURNS numeric AS $$
DECLARE
  attempted integer;
  completed integer;
BEGIN
  SELECT passes_attempted, passes_completed
  INTO attempted, completed
  FROM player_stats
  WHERE id = player_stat_id;

  IF attempted = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((completed::numeric / attempted::numeric) * 100, 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_shot_accuracy(player_stat_id uuid)
RETURNS numeric AS $$
DECLARE
  total integer;
  on_target integer;
BEGIN
  SELECT shots, shots_on_target
  INTO total, on_target
  FROM player_stats
  WHERE id = player_stat_id;

  IF total = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((on_target::numeric / total::numeric) * 100, 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_dribble_success_rate(player_stat_id uuid)
RETURNS numeric AS $$
DECLARE
  attempted integer;
  successful integer;
BEGIN
  SELECT dribbles_attempted, dribbles_successful
  INTO attempted, successful
  FROM player_stats
  WHERE id = player_stat_id;

  IF attempted = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((successful::numeric / attempted::numeric) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update calculated metrics
CREATE OR REPLACE FUNCTION update_calculated_stats()
RETURNS TRIGGER AS $$
BEGIN
  NEW.pass_accuracy := calculate_pass_accuracy(NEW.id);
  NEW.shot_accuracy := calculate_shot_accuracy(NEW.id);
  NEW.dribble_success_rate := calculate_dribble_success_rate(NEW.id);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_player_stats_calculated
  BEFORE INSERT OR UPDATE ON player_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_calculated_stats();

-- Trigger to auto-update team stats
CREATE OR REPLACE FUNCTION update_team_stats_calculated()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_passes > 0 THEN
    NEW.pass_accuracy := ROUND((NEW.completed_passes::numeric / NEW.total_passes::numeric) * 100, 2);
  END IF;

  IF NEW.total_shots > 0 THEN
    NEW.shot_accuracy := ROUND((NEW.shots_on_target::numeric / NEW.total_shots::numeric) * 100, 2);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_team_stats_calculated_trigger
  BEFORE INSERT OR UPDATE ON team_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_team_stats_calculated();

-- Comments
COMMENT ON TABLE player_stats IS 'Player performance statistics per match/clip';
COMMENT ON TABLE team_stats IS 'Team performance statistics per match';
COMMENT ON TABLE match_stats IS 'Overall match statistics and metadata';
COMMENT ON TABLE player_performance_timeline IS 'Time-series player performance data';
COMMENT ON TABLE player_heatmaps IS 'Spatial heatmap data for player movement';

COMMENT ON COLUMN player_stats.distance_covered_meters IS 'Total distance covered during match/clip';
COMMENT ON COLUMN player_stats.average_speed_kmh IS 'Average movement speed in km/h';
COMMENT ON COLUMN player_stats.max_speed_kmh IS 'Maximum recorded speed in km/h';
COMMENT ON COLUMN player_stats.pass_accuracy IS 'Pass completion percentage (auto-calculated)';
COMMENT ON COLUMN player_stats.shot_accuracy IS 'Shot on target percentage (auto-calculated)';
COMMENT ON COLUMN player_stats.dribble_success_rate IS 'Successful dribble percentage (auto-calculated)';

COMMENT ON COLUMN player_heatmaps.heatmap_data IS 'JSON object with grid coordinates as keys and intensity as values';
