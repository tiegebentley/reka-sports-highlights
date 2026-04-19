-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can insert own videos" ON videos;

-- Recreate with correct policy
CREATE POLICY "Users can insert own videos"
ON videos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Also ensure service role can bypass RLS (for Edge Functions using service role)
ALTER TABLE videos FORCE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON videos TO authenticated;
