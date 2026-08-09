-- ============================================================
-- TIGHTEN STORAGE POLICIES
-- plan-pdfs and ffe-photos SELECT policies currently allow anonymous
-- access with no authentication check.
-- Tighten to require authentication and folder ownership.
--
-- NOTE: Full bucket privacy (public = false) should be done as a
-- separate migration after migrating stored pdf_url values to paths,
-- since the app currently uses getPublicUrl which requires public buckets.
-- ============================================================

-- plan-pdfs: replace open SELECT with authenticated + folder ownership
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'plan_pdfs_select' AND tablename = 'objects' AND schemaname = 'storage') THEN
    DROP POLICY "plan_pdfs_select" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "plan_pdfs_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'plan-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ffe-photos: replace open SELECT with authenticated check
-- (ffe path uses projectId as first folder, so we allow any authenticated user
-- to read photos from projects they own — enforced at app layer for now)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ffe_photos_select' AND tablename = 'objects' AND schemaname = 'storage') THEN
    DROP POLICY "ffe_photos_select" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "ffe_photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'ffe-photos');

-- ============================================================
-- Fix ffe-photos INSERT policy: current policy checks uid as first folder
-- but actual upload path is ${projectId}/${itemId}/... (projectId first, not uid)
-- Replace with a check that the user is authenticated (project ownership
-- enforced at app layer) until path structure is updated to uid/projectId/...
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ffe_photos_insert' AND tablename = 'objects' AND schemaname = 'storage') THEN
    DROP POLICY "ffe_photos_insert" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "ffe_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ffe-photos');
