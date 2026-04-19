SELECT 
  id,
  title,
  clip_url,
  reka_clip_id,
  quality_score,
  created_at
FROM clips
ORDER BY created_at DESC
LIMIT 5;
