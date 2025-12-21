-- Make plans storage bucket public so URLs are accessible
UPDATE storage.buckets 
SET public = true 
WHERE id = 'plans';