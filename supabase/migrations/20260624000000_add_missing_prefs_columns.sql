-- Add waste % defaults to cost_estimator_prefs (added in app after initial migration)
ALTER TABLE public.cost_estimator_prefs
  ADD COLUMN IF NOT EXISTS default_mat_waste numeric(6,2) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS default_lab_waste numeric(6,2) NOT NULL DEFAULT 10;

-- Add used_in_estimate to subcontractor_quotes
ALTER TABLE public.subcontractor_quotes
  ADD COLUMN IF NOT EXISTS used_in_estimate boolean NOT NULL DEFAULT false;
