-- Validation script to verify schema setup
-- Run this after migrations to ensure everything is working

-- Check that all tables exist
SELECT
  table_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = t.table_name
  ) as exists
FROM (
  VALUES ('videos'), ('clips'), ('tags'), ('jobs')
) AS t(table_name);

-- Check RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('videos', 'clips', 'tags', 'jobs');

-- Check policies exist
SELECT
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check indexes
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('videos', 'clips', 'tags', 'jobs')
ORDER BY tablename, indexname;

-- Check storage bucket
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'video-uploads';

-- Check storage policies
SELECT
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%video%'
ORDER BY policyname;
