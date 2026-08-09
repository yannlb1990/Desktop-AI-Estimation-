-- ============================================================
-- Make plan-pdfs and ffe-photos private
-- The app now uses signed URLs (storage: prefix + createSignedUrl)
-- so public CDN access is no longer needed.
-- ============================================================

UPDATE storage.buckets
SET public = false
WHERE id IN ('plan-pdfs', 'ffe-photos');

-- Migrate existing pdf_url values in takeoff_sessions from full public URLs
-- to storage paths (storage:plan-pdfs/uid/fileId.ext).
-- The app resolves these to signed URLs on load via createSignedUrl().
DO $$ BEGIN
  UPDATE public.takeoff_sessions
  SET pdf_url = 'storage:plan-pdfs/' || SPLIT_PART(pdf_url, '/plan-pdfs/', 2)
  WHERE pdf_url LIKE 'https://%/plan-pdfs/%';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
