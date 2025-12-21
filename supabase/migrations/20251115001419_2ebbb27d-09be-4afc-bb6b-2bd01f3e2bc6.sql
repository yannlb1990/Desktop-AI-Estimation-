-- Create custom_materials table for user-added materials
CREATE TABLE IF NOT EXISTS public.custom_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  unit TEXT NOT NULL,
  avg_price NUMERIC NOT NULL,
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.custom_materials ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_materials
CREATE POLICY "Users manage own custom materials"
  ON public.custom_materials FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create custom_sow_rates table for user-added SOW rates
CREATE TABLE IF NOT EXISTS public.custom_sow_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trade TEXT NOT NULL,
  sow_name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.custom_sow_rates ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_sow_rates
CREATE POLICY "Users manage own custom SOW rates"
  ON public.custom_sow_rates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);