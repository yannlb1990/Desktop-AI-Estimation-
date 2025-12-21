-- Enable RLS on au_pricing_regions table
ALTER TABLE public.au_pricing_regions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow everyone to read pricing regions (public reference data)
CREATE POLICY "Pricing regions are viewable by everyone"
ON public.au_pricing_regions FOR SELECT
USING (true);