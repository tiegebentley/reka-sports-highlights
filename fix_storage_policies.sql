-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload their own videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own videos" ON storage.objects;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'video-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own videos
CREATE POLICY "Users can read their own videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'video-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
