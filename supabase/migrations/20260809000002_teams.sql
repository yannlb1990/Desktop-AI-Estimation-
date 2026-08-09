-- Teams MVP: shared_projects table (teams + team_members already exist from 20260517000001)
-- This migration adds shared_projects only, using the existing schema where possible.

CREATE TABLE IF NOT EXISTS shared_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  project_data jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shared_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_project_select" ON shared_projects FOR SELECT TO authenticated USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active')
  OR team_id IN (SELECT id FROM teams WHERE owner_user_id = auth.uid())
);

CREATE POLICY "shared_project_insert" ON shared_projects FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid() AND (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active')
    OR team_id IN (SELECT id FROM teams WHERE owner_user_id = auth.uid())
  )
);
