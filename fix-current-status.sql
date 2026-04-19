-- Update the video status to processing
UPDATE videos
SET status = 'processing'
WHERE id IN (
  SELECT video_id
  FROM jobs
  WHERE id IN ('6096265f-8901-4444-86f9-f7124bd29a02', 'c1391878-7836-4955-b5e6-f6f1f7ce594d')
);

-- Check the Reka clip status for the job that has a reka_clip_id
-- This will show you if it's done or still processing
SELECT
  j.*,
  v.title,
  v.status as video_status
FROM jobs j
JOIN videos v ON v.id = j.video_id
WHERE j.id = 'c1391878-7836-4955-b5e6-f6f1f7ce594d';
