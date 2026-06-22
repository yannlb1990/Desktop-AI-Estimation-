-- Create storage bucket for FFE (Furniture, Fixtures & Equipment) photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ffe-photos',
  'ffe-photos',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to their own folder (uid/filename)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ffe_photos_insert' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "ffe_photos_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'ffe-photos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Public read — CDN URLs work without auth headers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ffe_photos_select' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "ffe_photos_select"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'ffe-photos');
  END IF;
END $$;

-- Users can delete their own photos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ffe_photos_delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "ffe_photos_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'ffe-photos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;
