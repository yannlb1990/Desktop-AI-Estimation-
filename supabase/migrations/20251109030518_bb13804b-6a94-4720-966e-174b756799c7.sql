-- Add markup_pct column to estimate_items if it doesn't exist
ALTER TABLE estimate_items 
  ADD COLUMN IF NOT EXISTS markup_pct NUMERIC DEFAULT 20;

-- Create custom_trades table for user-defined trades
CREATE TABLE IF NOT EXISTS custom_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trade_name TEXT NOT NULL,
  default_rate NUMERIC DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on custom_trades
ALTER TABLE custom_trades ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_trades
CREATE POLICY "Users can manage their own custom trades"
  ON custom_trades
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);