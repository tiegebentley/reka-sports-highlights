-- This will show you exactly what's in the job metadata
-- which includes what Reka has returned
SELECT
  j.id,
  j.status,
  j.progress,
  j.metadata,
  j.error,
  j.result,
  j.created_at,
  j.updated_at,
  EXTRACT(EPOCH FROM (NOW() - j.created_at))/60 as minutes_elapsed
FROM jobs j
WHERE j.id = 'ad183cdf-79dc-4879-89b7-bce39243217a';
