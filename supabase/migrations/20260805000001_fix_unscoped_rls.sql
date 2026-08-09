-- Fix remaining unscoped RLS policies from 001_initial_schema.sql

-- ── supplier_quote_requests ───────────────────────────────────────────────
-- No user_id column exists; add one and scope per owner.
DO $$ BEGIN
  ALTER TABLE supplier_quote_requests ADD COLUMN user_id uuid REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Backfill from linked project for any existing rows
UPDATE supplier_quote_requests sqr
SET user_id = p.created_by
FROM projects p
WHERE sqr.project_id = p.id
  AND sqr.user_id IS NULL;

DROP POLICY IF EXISTS "Users can manage quote requests" ON supplier_quote_requests;
CREATE POLICY "quote_requests_own"
  ON supplier_quote_requests FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── webhooks / webhook_deliveries ─────────────────────────────────────────
-- These have no user_id column and are not queried from the frontend.
-- Remove the authenticated-access policies so only service_role can touch them.
DROP POLICY IF EXISTS "Authenticated users can manage webhooks" ON webhooks;
DROP POLICY IF EXISTS "Authenticated users can view deliveries" ON webhook_deliveries;

-- ── rate_history ──────────────────────────────────────────────────────────
-- Scope reads to the caller's own subcontractor rates (user_id = NULL means
-- shared/seed data that anyone may read).
DROP POLICY IF EXISTS "rate_history_read" ON rate_history;
CREATE POLICY "rate_history_read_own"
  ON rate_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subcontractor_rates sr
      WHERE sr.id = rate_history.subbie_rate_id
        AND (sr.user_id IS NULL OR sr.user_id = auth.uid())
    )
  );
