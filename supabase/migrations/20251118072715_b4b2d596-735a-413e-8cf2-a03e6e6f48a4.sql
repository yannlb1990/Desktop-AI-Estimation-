-- Create tender_documents table for file uploads
CREATE TABLE IF NOT EXISTS tender_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tender_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their project tender documents"
  ON tender_documents FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tender documents to their projects"
  ON tender_documents FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    ) AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their project tender documents"
  ON tender_documents FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their project tender documents"
  ON tender_documents FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Create storage bucket for tender documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('tender-documents', 'tender-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Users can upload tender documents to their projects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tender-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their tender documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tender-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their tender documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tender-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );