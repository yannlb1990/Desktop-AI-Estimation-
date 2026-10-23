-- Site visits: protections found in the robustness review.
-- 1. Project ids are not always uuids (shared/imported projects use proj_<time>_<rand>).
-- 2. A phone on weak signal can deliver an older copy after a newer one: it must not win.
-- 3. A visit deleted on one device stays deleted when another device uploads it later.

ALTER TABLE public.site_visits ALTER COLUMN project_id TYPE text USING project_id::text;

CREATE OR REPLACE FUNCTION public.site_visits_keep_newest()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    NEW.deleted_at := OLD.deleted_at;
  END IF;
  IF NEW.updated_at < OLD.updated_at AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS site_visits_keep_newest ON public.site_visits;
CREATE TRIGGER site_visits_keep_newest
  BEFORE UPDATE ON public.site_visits
  FOR EACH ROW EXECUTE FUNCTION public.site_visits_keep_newest();
