-- ============================================================
-- Site visits: rooms, sizes, scope ticks and notes captured on a phone, reviewed on the
-- desktop and turned into estimate lines. Photos live in the private site-photos bucket
-- under <user id>/<visit id>/<photo id>.jpg; only the owner can read or write them.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_visits (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  uuid,
  data        jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'done')),
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visits_user ON public.site_visits (user_id, updated_at DESC);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_visits_owner_all" ON public.site_visits;
CREATE POLICY "site_visits_owner_all" ON public.site_visits
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Private bucket, 15 MB cap per photo (phones resize to ~0.3 MB before upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-photos', 'site-photos', false, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "site_photos_select" ON storage.objects;
CREATE POLICY "site_photos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'site-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "site_photos_insert" ON storage.objects;
CREATE POLICY "site_photos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "site_photos_update" ON storage.objects;
CREATE POLICY "site_photos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'site-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "site_photos_delete" ON storage.objects;
CREATE POLICY "site_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
