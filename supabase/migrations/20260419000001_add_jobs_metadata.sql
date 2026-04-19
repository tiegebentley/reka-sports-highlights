-- Add metadata column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_jobs_metadata ON jobs USING gin(metadata);
