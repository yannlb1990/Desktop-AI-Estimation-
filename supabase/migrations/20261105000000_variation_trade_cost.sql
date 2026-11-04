-- A variation's trade (from the one trade list) and what it costs the builder, so an
-- approved variation adds to that trade's budget in Job Cost.
ALTER TABLE public.variations ADD COLUMN IF NOT EXISTS trade text;
ALTER TABLE public.variations ADD COLUMN IF NOT EXISTS cost_amount numeric;
