-- Export Jobs Table for Video Rendering Queue
-- Tracks video export jobs with progress and status

CREATE TABLE IF NOT EXISTS export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid REFERENCES clips(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  config jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  output_url text,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX idx_export_jobs_user_id ON export_jobs(user_id);
CREATE INDEX idx_export_jobs_clip_id ON export_jobs(clip_id);
CREATE INDEX idx_export_jobs_status ON export_jobs(status);
CREATE INDEX idx_export_jobs_created_at ON export_jobs(created_at DESC);

-- RLS Policies
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own export jobs
CREATE POLICY "Users can view own export jobs"
  ON export_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create export jobs
CREATE POLICY "Users can create export jobs"
  ON export_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own export jobs (for cancellation)
CREATE POLICY "Users can update own export jobs"
  ON export_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Social Posts Table Update (if not exists)
-- Add export_job_id reference for tracking which export was used
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'export_job_id'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN export_job_id uuid REFERENCES export_jobs(id);
    CREATE INDEX idx_social_posts_export_job_id ON social_posts(export_job_id);
  END IF;
END $$;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_export_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_export_jobs_updated_at_trigger
  BEFORE UPDATE ON export_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_export_jobs_updated_at();

-- Comments
COMMENT ON TABLE export_jobs IS 'Video export jobs with FFmpeg rendering queue';
COMMENT ON COLUMN export_jobs.config IS 'JSON configuration: format, resolution, fps, overlays, commentary, music, transitions';
COMMENT ON COLUMN export_jobs.status IS 'Job status: pending, processing, completed, failed';
COMMENT ON COLUMN export_jobs.progress IS 'Progress percentage (0-100)';
COMMENT ON COLUMN export_jobs.output_url IS 'Public URL of exported video';
