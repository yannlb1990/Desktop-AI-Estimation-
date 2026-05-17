-- Teams: one per Business subscriber (the owner)
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text,
  max_seats int DEFAULT 5 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT teams_owner_unique UNIQUE (owner_user_id)
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Owner can read/update their own team
CREATE POLICY "team_owner_access" ON public.teams FOR ALL
  USING (auth.uid() = owner_user_id);

-- Active members can read the team they belong to
CREATE POLICY "team_member_read" ON public.teams FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
  ));

-- ── Team members (pending invites + active members) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text DEFAULT 'member' NOT NULL CHECK (role IN ('owner', 'member')),
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'active', 'removed')),
  invited_at timestamptz DEFAULT now() NOT NULL,
  joined_at timestamptz,
  CONSTRAINT team_members_unique_email UNIQUE (team_id, email)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Owner sees all members in their team
CREATE POLICY "team_owner_sees_members" ON public.team_members FOR ALL
  USING (
    team_id IN (SELECT id FROM public.teams WHERE owner_user_id = auth.uid())
  );

-- Members see their own row
CREATE POLICY "member_sees_own_row" ON public.team_members FOR SELECT
  USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ── Add team_id to subscriptions for cascade cancel ───────────────────────────
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
