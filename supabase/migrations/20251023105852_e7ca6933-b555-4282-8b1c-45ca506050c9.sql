-- Add Australian location fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS postcode TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS region TEXT;

-- Add Australian pricing region data
CREATE TABLE IF NOT EXISTS public.au_pricing_regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL,
  region TEXT NOT NULL,
  cost_index NUMERIC DEFAULT 1.0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert Australian state/region pricing data
INSERT INTO public.au_pricing_regions (state, region, cost_index, description) VALUES
('NSW', 'Sydney Metro', 1.15, 'Sydney metropolitan area - higher labour and material costs'),
('NSW', 'Regional NSW', 1.00, 'Regional NSW - standard pricing'),
('VIC', 'Melbourne Metro', 1.12, 'Melbourne metropolitan area'),
('VIC', 'Regional VIC', 0.98, 'Regional Victoria'),
('QLD', 'Brisbane Metro', 1.08, 'Brisbane metropolitan area'),
('QLD', 'Gold Coast', 1.10, 'Gold Coast region'),
('QLD', 'Regional QLD', 0.95, 'Regional Queensland'),
('WA', 'Perth Metro', 1.20, 'Perth metropolitan area - higher costs due to remoteness'),
('WA', 'Regional WA', 1.15, 'Regional Western Australia'),
('SA', 'Adelaide Metro', 1.05, 'Adelaide metropolitan area'),
('SA', 'Regional SA', 0.95, 'Regional South Australia'),
('TAS', 'Hobart', 1.08, 'Hobart area'),
('TAS', 'Regional TAS', 1.05, 'Regional Tasmania'),
('NT', 'Darwin', 1.25, 'Darwin - highest costs due to remoteness'),
('NT', 'Regional NT', 1.30, 'Regional Northern Territory'),
('ACT', 'Canberra', 1.10, 'Australian Capital Territory')
ON CONFLICT DO NOTHING;

-- Add GST rate and Australian-specific defaults to estimates
ALTER TABLE public.estimates
ALTER COLUMN gst_percentage SET DEFAULT 10;