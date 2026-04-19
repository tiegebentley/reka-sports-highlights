-- Get the most recent processing job with Reka clip ID
SELECT
  j.id as job_id,
  j.status,
  j.metadata->>'reka_clip_id' as reka_clip_id,
  j.created_at,
  j.updated_at,
  EXTRACT(EPOCH FROM (NOW() - j.created_at))/60 as minutes_elapsed,
  v.title,
  v.duration_seconds,
  v.file_size_bytes/1024/1024 as file_size_mb
FROM jobs j
JOIN videos v ON v.id = j.video_id
WHERE j.status IN ('queued', 'processing')
  AND j.job_type = 'clip_generation'
  AND j.metadata->>'reka_clip_id' IS NOT NULL
ORDER BY j.created_at DESC
LIMIT 1;
