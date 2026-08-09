-- ============================================================
-- FIX 1: Old-schema UPDATE policies missing WITH CHECK
-- Affects projects and estimates in 001_initial_schema (uses created_by column)
-- ============================================================
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update own estimates" ON estimates;
CREATE POLICY "Users can update own estimates"
  ON estimates FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- ============================================================
-- FIX 2: project_templates UPDATE missing WITH CHECK
-- ============================================================
DROP POLICY IF EXISTS "Users can update own templates" ON project_templates;
CREATE POLICY "Users can update own templates"
  ON project_templates FOR UPDATE
  USING (auth.uid() = created_by AND is_system = FALSE)
  WITH CHECK (auth.uid() = created_by AND is_system = FALSE);

-- ============================================================
-- FIX 3: profiles table — add INSERT policy (missing, causes silent failure)
-- ============================================================
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;

CREATE POLICY "users_insert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- FIX 4: team_members — add WITH CHECK, using correct column name (owner_user_id)
-- ============================================================
DROP POLICY IF EXISTS "team_owner_sees_members" ON public.team_members;
DROP POLICY IF EXISTS "team_owner_manages_members" ON public.team_members;

CREATE POLICY "team_owner_manages_members"
  ON public.team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE teams.id = team_members.team_id
        AND teams.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE teams.id = team_members.team_id
        AND teams.owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- FIX 5: admins table + rate_overrides admin policy
-- Replace email JWT claim check (spoofable) with uid-based lookup
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_own" ON public.admins;
CREATE POLICY "admins_select_own"
  ON public.admins FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_write_rate_overrides" ON public.rate_overrides;
DROP POLICY IF EXISTS "Admins can manage rate overrides" ON public.rate_overrides;

CREATE POLICY "admin_write_rate_overrides"
  ON public.rate_overrides FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
