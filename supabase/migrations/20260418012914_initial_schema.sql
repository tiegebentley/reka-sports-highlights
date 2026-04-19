-- Enable pgvector extension (for future search features)
CREATE EXTENSION IF NOT EXISTS vector;

-- Videos table
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'youtube', 'twitch')),
  source_url TEXT,
  storage_path TEXT,
  duration_seconds INT,
  resolution TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips table
CREATE TABLE clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  reka_clip_id TEXT,
  clip_url TEXT,
  title TEXT,
  caption TEXT,
  hashtags TEXT[],
  quality_score INT,
  start_time NUMERIC,
  end_time NUMERIC,
  aspect_ratio TEXT DEFAULT '9:16',
  resolution TEXT DEFAULT '720p',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags table
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID REFERENCES clips ON DELETE CASCADE,
  video_id UUID REFERENCES videos ON DELETE CASCADE,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('play_type', 'player', 'score', 'custom')),
  tag_value TEXT NOT NULL,
  timestamp NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table for processing queue
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  video_id UUID REFERENCES videos ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('clip_generation', 'tagging', 'analysis')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress INT DEFAULT 0,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own data
CREATE POLICY "Users can view own videos" ON videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own videos" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos" ON videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own videos" ON videos FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own clips" ON clips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clips" ON clips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clips" ON clips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clips" ON clips FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own tags" ON tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM clips WHERE clips.id = tags.clip_id AND clips.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM videos WHERE videos.id = tags.video_id AND videos.user_id = auth.uid())
);

CREATE POLICY "Users can insert own tags" ON tags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM clips WHERE clips.id = tags.clip_id AND clips.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM videos WHERE videos.id = tags.video_id AND videos.user_id = auth.uid())
);

CREATE POLICY "Users can view own jobs" ON jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON jobs FOR UPDATE USING (auth.uid() = user_id);

-- Enable Realtime for jobs table
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;

-- Indexes for performance
CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_clips_video_id ON clips(video_id);
CREATE INDEX idx_clips_user_id ON clips(user_id);
CREATE INDEX idx_tags_clip_id ON tags(clip_id);
CREATE INDEX idx_tags_video_id ON tags(video_id);
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_video_id ON jobs(video_id);
