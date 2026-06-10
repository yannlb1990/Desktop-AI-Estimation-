-- Migration 000003: schedule_tasks, job_cost_entries, variations

-- ──────────────────────────────────────────────────────────────
-- schedule_tasks
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schedule_tasks (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL DEFAULT '',
  trade         text        NOT NULL DEFAULT '',
  color         text        NOT NULL DEFAULT '#3b82f6',
  start_date    date        NOT NULL,
  end_date      date        NOT NULL,
  duration_days integer     NOT NULL DEFAULT 1,
  progress      integer     NOT NULL DEFAULT 0,
  notes         text        NOT NULL DEFAULT '',
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.schedule_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own schedule tasks"
  ON public.schedule_tasks FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_schedule_tasks_updated_at
  BEFORE UPDATE ON public.schedule_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- job_cost_entries
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_cost_entries (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date        NOT NULL,
  trade       text        NOT NULL DEFAULT '',
  supplier    text        NOT NULL DEFAULT '',
  description text        NOT NULL DEFAULT '',
  amount      numeric(12,2) NOT NULL DEFAULT 0,
  type        text        NOT NULL DEFAULT 'invoice'
                CHECK (type IN ('invoice','labour','material','subcontract','other')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.job_cost_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own job cost entries"
  ON public.job_cost_entries FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_job_cost_entries_updated_at
  BEFORE UPDATE ON public.job_cost_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- variations
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.variations (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number       integer     NOT NULL DEFAULT 1,
  title        text        NOT NULL DEFAULT '',
  description  text        NOT NULL DEFAULT '',
  reason       text        NOT NULL DEFAULT '',
  status       text        NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','pending_approval','approved','rejected','disputed')),
  items        jsonb       NOT NULL DEFAULT '[]',
  notes        text        NOT NULL DEFAULT '',
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  approved_at  timestamptz,
  rejected_at  timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own variations"
  ON public.variations FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_variations_updated_at
  BEFORE UPDATE ON public.variations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
