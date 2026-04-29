-- Infrastructure Extension Migration
-- Adds: Teams, Players, Tracking, Commentary, Stats, Social Media
-- Builds on existing: videos, clips, tags, jobs

-- ==============================================
-- TEAMS & COLLABORATION
-- ==============================================

-- Teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team members with roles
CREATE TABLE team_members (
  team_id UUID REFERENCES teams ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

-- Add team_id to existing videos and clips for shared ownership
ALTER TABLE videos ADD COLUMN team_id UUID REFERENCES teams ON DELETE SET NULL;
ALTER TABLE clips ADD COLUMN team_id UUID REFERENCES teams ON DELETE SET NULL;

-- ==============================================
-- PLAYERS & ROSTERS
-- ==============================================

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  team_id UUID REFERENCES teams ON DELETE SET NULL,
  name TEXT NOT NULL,
  number INT,
  position TEXT,
  bio TEXT,
  stats JSONB DEFAULT '{}',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- VIDEO TRACKING DATA
-- ==============================================

-- Player tracking data (bounding boxes per frame)
CREATE TABLE video_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players ON DELETE CASCADE,
  detection_method TEXT NOT NULL DEFAULT 'ai' CHECK (detection_method IN ('ai', 'manual')),
  frame_data JSONB NOT NULL, -- [{frame: 0, timestamp: 0.0, x: 100, y: 100, w: 50, h: 80, confidence: 0.95}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- AI COMMENTARY
-- ==============================================

-- Commentary tracks for videos/clips
CREATE TABLE commentary_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos ON DELETE CASCADE,
  clip_id UUID REFERENCES clips ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users NOT NULL,
  commentary_type TEXT NOT NULL CHECK (commentary_type IN ('pre_game', 'live_action', 'post_game', 'player_intro')),
  voice_style TEXT NOT NULL DEFAULT 'broadcaster', -- 'broadcaster', 'spanish', 'energetic', 'professional'
  language TEXT NOT NULL DEFAULT 'en', -- 'en', 'es', etc.
  transcript JSONB, -- [{timestamp: 0.0, text: "Welcome to the game"}]
  audio_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- PLAYER STATISTICS
-- ==============================================

-- Player stats extracted from video analysis
CREATE TABLE player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES videos ON DELETE CASCADE NOT NULL,
  stat_type TEXT NOT NULL, -- 'goals', 'saves', 'touches', 'distance_covered', 'speed_max', 'speed_avg'
  value NUMERIC NOT NULL,
  timestamp NUMERIC, -- Optional: when the stat occurred in the video
  metadata JSONB DEFAULT '{}', -- Additional context
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- SOCIAL MEDIA EXPORTS
-- ==============================================

-- Social media posts/exports
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID REFERENCES clips ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'youtube', 'facebook')),
  caption TEXT,
  hashtags TEXT[],
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  export_url TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- ROW LEVEL SECURITY POLICIES
-- ==============================================

-- Teams RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view teams they're in" ON teams FOR SELECT USING (
  auth.uid() = created_by
  OR EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = teams.id AND team_members.user_id = auth.uid())
);

CREATE POLICY "Users can insert own teams" ON teams FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Team admins can update teams" ON teams FOR UPDATE USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = teams.id AND team_members.user_id = auth.uid() AND team_members.role = 'admin')
  OR auth.uid() = created_by
);

CREATE POLICY "Team admins can delete teams" ON teams FOR DELETE USING (
  auth.uid() = created_by
);

-- Team Members RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team members" ON team_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND (
    teams.created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = teams.id AND tm.user_id = auth.uid())
  ))
);

CREATE POLICY "Team admins can manage members" ON team_members FOR ALL USING (
  EXISTS (SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND (
    teams.created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = teams.id AND tm.user_id = auth.uid() AND tm.role = 'admin')
  ))
);

-- Players RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own players" ON players FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = players.team_id AND team_members.user_id = auth.uid())
);

CREATE POLICY "Users can insert own players" ON players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own players" ON players FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own players" ON players FOR DELETE USING (auth.uid() = user_id);

-- Video Tracks RLS
ALTER TABLE video_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tracks for their videos" ON video_tracks FOR SELECT USING (
  EXISTS (SELECT 1 FROM videos WHERE videos.id = video_tracks.video_id AND videos.user_id = auth.uid())
);

CREATE POLICY "Users can insert tracks for their videos" ON video_tracks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM videos WHERE videos.id = video_tracks.video_id AND videos.user_id = auth.uid())
);

CREATE POLICY "Users can update their video tracks" ON video_tracks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM videos WHERE videos.id = video_tracks.video_id AND videos.user_id = auth.uid())
);

CREATE POLICY "Users can delete their video tracks" ON video_tracks FOR DELETE USING (
  EXISTS (SELECT 1 FROM videos WHERE videos.id = video_tracks.video_id AND videos.user_id = auth.uid())
);

-- Commentary Tracks RLS
ALTER TABLE commentary_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own commentary" ON commentary_tracks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own commentary" ON commentary_tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own commentary" ON commentary_tracks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own commentary" ON commentary_tracks FOR DELETE USING (auth.uid() = user_id);

-- Player Stats RLS
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stats for their players" ON player_stats FOR SELECT USING (
  EXISTS (SELECT 1 FROM players WHERE players.id = player_stats.player_id AND players.user_id = auth.uid())
);

CREATE POLICY "Users can insert stats for their players" ON player_stats FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM players WHERE players.id = player_stats.player_id AND players.user_id = auth.uid())
);

-- Social Posts RLS
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own social posts" ON social_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own social posts" ON social_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own social posts" ON social_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own social posts" ON social_posts FOR DELETE USING (auth.uid() = user_id);

-- ==============================================
-- UPDATE EXISTING RLS FOR TEAM SUPPORT
-- ==============================================

-- Drop old policies for videos
DROP POLICY IF EXISTS "Users can view own videos" ON videos;
DROP POLICY IF EXISTS "Users can insert own videos" ON videos;
DROP POLICY IF EXISTS "Users can update own videos" ON videos;
DROP POLICY IF EXISTS "Users can delete own videos" ON videos;

-- New policies: users OR team members can access
CREATE POLICY "Users can view own or team videos" ON videos FOR SELECT USING (
  auth.uid() = user_id
  OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = videos.team_id AND team_members.user_id = auth.uid()))
);

CREATE POLICY "Users can insert own videos" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or team videos" ON videos FOR UPDATE USING (
  auth.uid() = user_id
  OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = videos.team_id AND team_members.user_id = auth.uid() AND team_members.role IN ('admin', 'editor')))
);

CREATE POLICY "Users can delete own videos" ON videos FOR DELETE USING (auth.uid() = user_id);

-- Drop old policies for clips
DROP POLICY IF EXISTS "Users can view own clips" ON clips;
DROP POLICY IF EXISTS "Users can insert own clips" ON clips;
DROP POLICY IF EXISTS "Users can update own clips" ON clips;
DROP POLICY IF EXISTS "Users can delete own clips" ON clips;

-- New policies for clips with team support
CREATE POLICY "Users can view own or team clips" ON clips FOR SELECT USING (
  auth.uid() = user_id
  OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = clips.team_id AND team_members.user_id = auth.uid()))
);

CREATE POLICY "Users can insert own clips" ON clips FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or team clips" ON clips FOR UPDATE USING (
  auth.uid() = user_id
  OR (team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = clips.team_id AND team_members.user_id = auth.uid() AND team_members.role IN ('admin', 'editor')))
);

CREATE POLICY "Users can delete own clips" ON clips FOR DELETE USING (auth.uid() = user_id);

-- ==============================================
-- PERFORMANCE INDEXES
-- ==============================================

-- Teams indexes
CREATE INDEX idx_teams_created_by ON teams(created_by);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);

-- Players indexes
CREATE INDEX idx_players_user_id ON players(user_id);
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_players_number ON players(number);

-- Video tracks indexes
CREATE INDEX idx_video_tracks_video_id ON video_tracks(video_id);
CREATE INDEX idx_video_tracks_player_id ON video_tracks(player_id);

-- Commentary indexes
CREATE INDEX idx_commentary_tracks_video_id ON commentary_tracks(video_id);
CREATE INDEX idx_commentary_tracks_clip_id ON commentary_tracks(clip_id);
CREATE INDEX idx_commentary_tracks_status ON commentary_tracks(status);

-- Stats indexes
CREATE INDEX idx_player_stats_player_id ON player_stats(player_id);
CREATE INDEX idx_player_stats_video_id ON player_stats(video_id);
CREATE INDEX idx_player_stats_stat_type ON player_stats(stat_type);

-- Social posts indexes
CREATE INDEX idx_social_posts_clip_id ON social_posts(clip_id);
CREATE INDEX idx_social_posts_platform ON social_posts(platform);

-- Team support indexes on existing tables
CREATE INDEX idx_videos_team_id ON videos(team_id);
CREATE INDEX idx_clips_team_id ON clips(team_id);

-- ==============================================
-- REALTIME SUBSCRIPTIONS
-- ==============================================

-- Enable realtime for new tables (useful for collaboration)
ALTER PUBLICATION supabase_realtime ADD TABLE commentary_tracks;
ALTER PUBLICATION supabase_realtime ADD TABLE video_tracks;

-- ==============================================
-- UPDATED TRIGGERS
-- ==============================================

-- Updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to new tables
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_video_tracks_updated_at BEFORE UPDATE ON video_tracks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_commentary_tracks_updated_at BEFORE UPDATE ON commentary_tracks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- VALIDATION FUNCTIONS
-- ==============================================

-- Function to check if user is team admin
CREATE OR REPLACE FUNCTION is_team_admin(team_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = $1
    AND team_members.user_id = $2
    AND team_members.role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM teams
    WHERE teams.id = $1
    AND teams.created_by = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team member count
CREATE OR REPLACE FUNCTION get_team_member_count(team_id UUID)
RETURNS INT AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM team_members WHERE team_members.team_id = $1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
