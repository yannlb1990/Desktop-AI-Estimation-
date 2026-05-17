-- Paid subscription records written by the Stripe webhook (service role only)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_id text NOT NULL CHECK (plan_id IN ('starter', 'pro', 'business')),
  billing_period text NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
  status text NOT NULL CHECK (status IN ('active', 'canceled', 'past_due')),
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT subscriptions_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only read their own row
CREATE POLICY "users_read_own_subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);
-- INSERT / UPDATE / DELETE: service-role key only (no authenticated policy = blocked)
