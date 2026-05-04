-- Fix infinite recursion in team_members RLS policies
-- The issue: policies were querying team_members within team_members policies

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Team admins can manage members" ON team_members;

-- Create fixed policies without recursion
-- Policy 1: Users can view team members if they are a member of that team
CREATE POLICY "Users can view team members" ON team_members FOR SELECT USING (
  -- User can see members of teams they belong to
  team_id IN (
    SELECT tm.team_id
    FROM team_members tm
    WHERE tm.user_id = auth.uid()
  )
  -- Or user can see their own membership record
  OR user_id = auth.uid()
);

-- Policy 2: Team admins can manage members
CREATE POLICY "Team admins can manage members" ON team_members FOR ALL USING (
  -- User is an admin of this team
  team_id IN (
    SELECT tm.team_id
    FROM team_members tm
    WHERE tm.user_id = auth.uid()
    AND tm.role = 'admin'
  )
  -- Or it's the user's own record (can leave team)
  OR user_id = auth.uid()
);
