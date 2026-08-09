-- ============================================================
-- Soft delete for projects
-- Hard delete + cascade destroys all estimates and takeoff data permanently.
-- deleted_at allows recovery and audit trails.
-- ============================================================

-- Add deleted_at to both projects tables (IF NOT EXISTS is safe)
DO $$ BEGIN
  ALTER TABLE public.projects ADD COLUMN deleted_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE projects ADD COLUMN deleted_at timestamptz;
EXCEPTION WHEN undefined_table THEN NULL; WHEN duplicate_column THEN NULL; END $$;

-- Partial index: fast filtering for non-deleted rows (most common query)
CREATE INDEX IF NOT EXISTS idx_projects_not_deleted
  ON public.projects(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Update the SELECT policy to exclude deleted projects
DROP POLICY IF EXISTS "users_read_own_projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;

CREATE POLICY "users_read_own_projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);
