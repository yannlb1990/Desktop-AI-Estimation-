-- ============================================================
-- GST columns on variations and job_cost_entries
-- Required for ATO compliance — need to track GST separately per entry
-- ============================================================

DO $$ BEGIN
  ALTER TABLE public.variations
    ADD COLUMN gst_rate    numeric(5,4) NOT NULL DEFAULT 0.1,
    ADD COLUMN gst_amount  numeric(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN gst_inclusive boolean NOT NULL DEFAULT true;
EXCEPTION WHEN undefined_table THEN NULL; WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.job_cost_entries
    ADD COLUMN gst_rate    numeric(5,4) NOT NULL DEFAULT 0.1,
    ADD COLUMN gst_amount  numeric(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN gst_inclusive boolean NOT NULL DEFAULT true,
    ADD COLUMN abn         text,
    ADD COLUMN invoice_number text;
EXCEPTION WHEN undefined_table THEN NULL; WHEN duplicate_column THEN NULL; END $$;
