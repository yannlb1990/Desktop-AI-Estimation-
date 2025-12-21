-- Create user_labour_rates table for persisting custom labour rates
CREATE TABLE IF NOT EXISTS public.user_labour_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trade_name TEXT NOT NULL,
  hourly_rate NUMERIC NOT NULL DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, trade_name)
);

-- Enable RLS
ALTER TABLE public.user_labour_rates ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own labour rates
CREATE POLICY "Users can manage their own labour rates"
  ON public.user_labour_rates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_labour_rates_user_id ON public.user_labour_rates(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_labour_rates_updated_at
  BEFORE UPDATE ON public.user_labour_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();