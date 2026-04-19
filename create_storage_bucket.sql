-- Create the video-uploads bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('video-uploads', 'video-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Verify bucket was created
SELECT id, name, public, created_at
FROM storage.buckets
WHERE id = 'video-uploads';
