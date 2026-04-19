-- Create storage bucket for video uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-uploads',
  'video-uploads',
  false,
  524288000, -- 500MB in bytes
  ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']::text[]
);

-- Storage policies: Users can upload and read their own videos
CREATE POLICY "Users can upload own videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'video-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read own videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'video-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'video-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'video-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
