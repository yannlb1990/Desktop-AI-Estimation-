-- Atomic JSONB merge for default_rates.
-- Settings.tsx stores company/branding/rates/labour_presets/suppliers/
-- quote_settings/notif_prefs as sections inside one JSONB blob on this table.
-- syncUserSettings() previously did SELECT -> merge in JS -> UPSERT the whole
-- row, so two settings tabs saved in quick succession could race: both reads
-- fire before either write lands, and the second upsert silently drops the
-- first save's section (this is how branding data went missing). Mirrors the
-- same fix already applied to user_preferences in
-- 20260805000002_atomic_user_prefs_merge.sql.
CREATE OR REPLACE FUNCTION public.merge_default_rates_section(section text, data jsonb)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO default_rates (user_id, rates, updated_at)
  VALUES (auth.uid(), jsonb_build_object(section, data), now())
  ON CONFLICT (user_id) DO UPDATE
    SET rates      = default_rates.rates || jsonb_build_object(section, data),
        updated_at = now();
$$;
