-- Check if storage bucket exists
SELECT * FROM storage.buckets WHERE id = 'video-uploads';

-- Check storage policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
