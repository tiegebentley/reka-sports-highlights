-- Fix infinite recursion in team_members RLS policies.
-- Root cause: SELECT policy on team_members did `team_id IN (SELECT team_id FROM team_members ...)`,
-- which re-triggers the same policy on every row check.
-- Fix: route membership/admin checks through SECURITY DEFINER helpers that bypass RLS.

CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_user_id AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_team_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid, uuid) TO authenticated;

-- Rebuild team_members policies without self-referencing subqueries.
DROP POLICY IF EXISTS "Users can view team members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can manage members" ON public.team_members;
DROP POLICY IF EXISTS "Users can insert own team membership" ON public.team_members;

CREATE POLICY "Users can view team members" ON public.team_members
FOR SELECT USING (
  user_id = auth.uid()
  OR public.is_team_member(team_id, auth.uid())
);

CREATE POLICY "Users can insert own team membership" ON public.team_members
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR public.is_team_admin(team_id, auth.uid())
);

CREATE POLICY "Team admins can update members" ON public.team_members
FOR UPDATE USING (
  user_id = auth.uid()
  OR public.is_team_admin(team_id, auth.uid())
);

CREATE POLICY "Team admins can delete members" ON public.team_members
FOR DELETE USING (
  user_id = auth.uid()
  OR public.is_team_admin(team_id, auth.uid())
);

-- Rebuild teams policies to use the helpers (they previously joined team_members,
-- which works but compounds the lock chain — helpers are cleaner and faster).
DROP POLICY IF EXISTS "Users can view own teams" ON public.teams;
DROP POLICY IF EXISTS "Team admins can update teams" ON public.teams;

CREATE POLICY "Users can view own teams" ON public.teams
FOR SELECT USING (
  created_by = auth.uid()
  OR public.is_team_member(id, auth.uid())
);

CREATE POLICY "Team admins can update teams" ON public.teams
FOR UPDATE USING (
  created_by = auth.uid()
  OR public.is_team_admin(id, auth.uid())
);
