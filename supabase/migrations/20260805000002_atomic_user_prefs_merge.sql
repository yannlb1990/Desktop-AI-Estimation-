-- Atomic JSONB merge for user_preferences.
-- Replaces the read-modify-write in userPreferences.ts with a single
-- server-side upsert using the || operator so concurrent writes can't
-- overwrite each other's keys.
CREATE OR REPLACE FUNCTION public.merge_user_preferences(patch jsonb)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO user_preferences (user_id, preferences, updated_at)
  VALUES (auth.uid(), patch, now())
  ON CONFLICT (user_id) DO UPDATE
    SET preferences = user_preferences.preferences || patch,
        updated_at  = now();
$$;
