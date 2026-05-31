-- Create public bucket for plan PDFs (persistent cross-session storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plan-pdfs',
  'plan-pdfs',
  true,
  52428800,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to their own folder (uid/planId/filename)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'plan_pdfs_insert' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "plan_pdfs_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'plan-pdfs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Public read — permanent CDN URLs work without auth headers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'plan_pdfs_select' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "plan_pdfs_select"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'plan-pdfs');
  END IF;
END $$;

-- Users can delete their own files
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'plan_pdfs_delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "plan_pdfs_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'plan-pdfs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;
