-- Add scope-of-works reference to schedule tasks
ALTER TABLE public.schedule_tasks ADD COLUMN IF NOT EXISTS sow_ref text;
