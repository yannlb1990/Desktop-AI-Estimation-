-- User-level preferences (labour rates, custom trades, etc.)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_own" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_insert_own" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_update_own" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_delete_own" ON public.user_preferences
  FOR DELETE USING (auth.uid() = user_id);
