-- Check videos with active jobs but wrong status
SELECT
  v.id,
  v.title,
  v.status as video_status,
  j.status as job_status,
  j.id as job_id
FROM videos v
LEFT JOIN jobs j ON j.video_id = v.id AND j.job_type = 'clip_generation'
WHERE j.status IN ('queued', 'processing')
  AND v.status != 'processing';

-- Fix: Update video status to match job status
UPDATE videos
SET status = 'processing'
WHERE id IN (
  SELECT v.id
  FROM videos v
  INNER JOIN jobs j ON j.video_id = v.id
  WHERE j.status IN ('queued', 'processing')
    AND j.job_type = 'clip_generation'
    AND v.status != 'processing'
);
