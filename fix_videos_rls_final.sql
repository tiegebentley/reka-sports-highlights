-- First, let's see what policies exist
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'videos';

-- Drop all existing policies on videos table
DROP POLICY IF EXISTS "Users can insert own videos" ON videos;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON videos;
DROP POLICY IF EXISTS "Enable read access for all users" ON videos;
DROP POLICY IF EXISTS "Users can view own videos" ON videos;

-- Create new insert policy
CREATE POLICY "Users can insert own videos"
ON videos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create select policy so users can see their own videos
CREATE POLICY "Users can view own videos"
ON videos
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON videos TO authenticated;

-- Verify the policies were created
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'videos';
