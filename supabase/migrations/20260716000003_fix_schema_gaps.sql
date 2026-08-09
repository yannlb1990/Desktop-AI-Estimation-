-- ============================================================
-- FIX 1: subscriptions status CHECK — add missing Stripe statuses
-- 'trialing' is sent by Stripe but was not in the CHECK constraint
-- ============================================================
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN (
    'active',
    'trialing',
    'canceled',
    'past_due',
    'incomplete',
    'incomplete_expired',
    'unpaid'
  ));

-- ============================================================
-- FIX 2: Missing project columns (May 2026 migration used CREATE TABLE
-- IF NOT EXISTS which silently skipped when the old table already existed,
-- so the new columns were never added)
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_id     uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS state         text,
  ADD COLUMN IF NOT EXISTS project_type  text,
  ADD COLUMN IF NOT EXISTS address       text,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS team_id       uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Index the new FK/filter columns
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id   ON public.projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_state      ON public.projects(state);

-- ============================================================
-- FIX 3: progress_claims table — currently data only lives in React state
-- and is lost on every page refresh
-- ============================================================
CREATE TABLE IF NOT EXISTS public.progress_claims (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_number    int NOT NULL DEFAULT 1,
  period_start    date,
  period_end      date,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','submitted','approved','paid','disputed')),
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  gst             numeric(12,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  line_items      jsonb NOT NULL DEFAULT '[]',
  notes           text,
  submitted_at    timestamptz,
  approved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_claims_project_id ON public.progress_claims(project_id);
CREATE INDEX IF NOT EXISTS idx_progress_claims_user_id    ON public.progress_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_claims_status     ON public.progress_claims(status);

ALTER TABLE public.progress_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress_claims_crud_own"
  ON public.progress_claims FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER progress_claims_updated_at
  BEFORE UPDATE ON public.progress_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- FIX 4: billing_history table — no record of what was charged when
-- Written by the Stripe webhook (service role), read-only for users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.billing_history (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_invoice_id     text UNIQUE,
  stripe_subscription_id text,
  amount_paid           int NOT NULL DEFAULT 0,   -- cents
  currency              text NOT NULL DEFAULT 'aud',
  status                text NOT NULL
                        CHECK (status IN ('paid','open','void','uncollectible','draft')),
  invoice_url           text,
  period_start          timestamptz,
  period_end            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_history_user_id   ON public.billing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_created_at ON public.billing_history(created_at DESC NULLS LAST);

ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own billing history; writes are service-role only
CREATE POLICY "billing_history_select_own"
  ON public.billing_history FOR SELECT
  USING (user_id = auth.uid());
