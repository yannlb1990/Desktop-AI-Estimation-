-- Add new columns to plan_measurements table for enhanced measurement types
ALTER TABLE plan_measurements 
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'LM',
ADD COLUMN IF NOT EXISTS thickness_mm DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS volume_m3 DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS notes TEXT;