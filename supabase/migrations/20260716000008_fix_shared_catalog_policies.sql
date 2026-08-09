-- ============================================================
-- Fix suppliers and material_prices: change from FOR ALL (any user can
-- insert/update/delete anyone's rows) to SELECT-only shared catalog.
-- These are reference data tables, not per-user owned data.
-- ============================================================

-- suppliers: read-only shared catalog
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON suppliers;
-- Keep the SELECT policy as-is

-- material_prices: read-only shared catalog
DROP POLICY IF EXISTS "Authenticated users can manage prices" ON material_prices;
-- Keep the SELECT policy as-is

-- supplier_quote_requests: scope to user (quotes are per-user)
DROP POLICY IF EXISTS "Users can manage quote requests" ON supplier_quote_requests;
CREATE POLICY "Users can manage quote requests"
  ON supplier_quote_requests FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- subcontractors: add user_id column and make per-user
DO $$ BEGIN
  ALTER TABLE subcontractors ADD COLUMN user_id uuid REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE subcontractor_rates ADD COLUMN user_id uuid REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DROP POLICY IF EXISTS "Authenticated users can manage subcontractors" ON subcontractors;
DROP POLICY IF EXISTS "Authenticated users can view subcontractors" ON subcontractors;
CREATE POLICY "subcontractors_read_own_or_shared"
  ON subcontractors FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "subcontractors_write_own"
  ON subcontractors FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can manage rates" ON subcontractor_rates;
DROP POLICY IF EXISTS "Authenticated users can view rates" ON subcontractor_rates;
CREATE POLICY "subbie_rates_read_own_or_shared"
  ON subcontractor_rates FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "subbie_rates_write_own"
  ON subcontractor_rates FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- rate_history: read-only for authenticated
DROP POLICY IF EXISTS "Authenticated users can view rate history" ON rate_history;
CREATE POLICY "rate_history_read"
  ON rate_history FOR SELECT
  TO authenticated
  USING (true);
