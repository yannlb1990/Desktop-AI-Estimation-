-- Site visits: the office links a visit to a project by setting project_id only. A phone that
-- uploads later (its own copy still unlinked) must not clear that link.
CREATE OR REPLACE FUNCTION public.site_visits_keep_newest()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    NEW.deleted_at := OLD.deleted_at;
  END IF;
  IF NEW.project_id IS NULL AND OLD.project_id IS NOT NULL THEN
    NEW.project_id := OLD.project_id;
  END IF;
  IF NEW.updated_at < OLD.updated_at AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
     AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id THEN
    RETURN OLD;
  END IF;
  -- an older copy only gets to change the link or the deleted mark, never the content
  IF NEW.updated_at < OLD.updated_at THEN
    NEW.data := OLD.data;
    NEW.updated_at := OLD.updated_at;
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END $$;
