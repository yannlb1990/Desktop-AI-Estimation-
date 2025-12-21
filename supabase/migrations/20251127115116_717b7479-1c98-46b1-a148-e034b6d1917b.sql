-- Add missing columns to plan_symbols table for V2 auto-detection
ALTER TABLE plan_symbols 
ADD COLUMN IF NOT EXISTS label_nearby TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN plan_symbols.label_nearby IS 'Exact text label found near symbol (e.g., D02, W01)';
COMMENT ON COLUMN plan_symbols.notes IS 'Additional observations from AI detection';