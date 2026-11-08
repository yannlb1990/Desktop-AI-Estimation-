-- Private storage for tender documents (company insurances, licence, project contracts,
-- drawings) under each builder's own folder: <uid>/company/... and <uid>/<projectId>/...
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('tender-documents', 'tender-documents', false, 20971520)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tender documents: owner uploads" ON storage.objects;
CREATE POLICY "tender documents: owner uploads" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tender-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "tender documents: owner reads" ON storage.objects;
CREATE POLICY "tender documents: owner reads" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tender-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "tender documents: owner deletes" ON storage.objects;
CREATE POLICY "tender documents: owner deletes" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tender-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
