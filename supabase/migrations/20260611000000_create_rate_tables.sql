-- Rate metadata: tracks when base rates were last updated and when next update is due
CREATE TABLE IF NOT EXISTS rate_metadata (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_updated DATE NOT NULL,
  next_update DATE NOT NULL,
  version TEXT NOT NULL,
  data_source TEXT NOT NULL,
  notes TEXT
);

-- Seed with current metadata from scopeOfWorkRates.ts
INSERT INTO rate_metadata (id, last_updated, next_update, version, data_source)
VALUES (1, '2025-12-01', '2026-03-01', '2025.4', 'Rawlinsons Construction Cost Guide, MBA, Cordell Housing Building Cost Guide')
ON CONFLICT (id) DO NOTHING;

-- Rate overrides: per-rate, per-state value overrides on top of the base dataset
CREATE TABLE IF NOT EXISTS rate_overrides (
  rate_id TEXT NOT NULL,
  state TEXT NOT NULL,
  value NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  notes TEXT,
  PRIMARY KEY (rate_id, state)
);

-- Enable RLS
ALTER TABLE rate_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_overrides ENABLE ROW LEVEL SECURITY;

-- rate_metadata: public read (no auth needed to display staleness banner)
CREATE POLICY "rate_metadata_public_read"
  ON rate_metadata FOR SELECT
  TO anon, authenticated
  USING (true);

-- rate_overrides: authenticated users can read (needed in CostEstimator)
CREATE POLICY "rate_overrides_authenticated_read"
  ON rate_overrides FOR SELECT
  TO authenticated
  USING (true);

-- rate_overrides: only admin email can write
CREATE POLICY "rate_overrides_admin_write"
  ON rate_overrides FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'admin@metricore.com.au')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@metricore.com.au');
