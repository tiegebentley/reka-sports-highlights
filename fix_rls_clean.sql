-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own videos" ON videos;

-- Recreate insert policy
CREATE POLICY "Users can insert own videos"
ON videos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enable RLS
ALTER TABLE videos FORCE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT ALL ON videos TO authenticated;
