-- analyze-events caches Reka's indexed video_id in videos.metadata so subsequent
-- Q&A calls skip the upload+index step. Without this column every analyze run
-- re-uploads the full video and quickly exhausts Reka's 180-min indexing quota.

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN videos.metadata IS 'Free-form metadata: reka_video_id (cached), reka_upload_response, etc.';
