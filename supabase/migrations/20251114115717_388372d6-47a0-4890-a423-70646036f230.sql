-- Create project-files storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for project-files bucket
CREATE POLICY "Users can upload their own project files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read their own project files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own project files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create pricing history table
CREATE TABLE IF NOT EXISTS public.pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  trade TEXT NOT NULL,
  sow TEXT NOT NULL,
  material_description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on pricing_history
ALTER TABLE pricing_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for pricing_history
CREATE POLICY "Users manage own pricing history"
  ON pricing_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create tender_templates table
CREATE TABLE IF NOT EXISTS public.tender_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  content JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on tender_templates
ALTER TABLE tender_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for tender_templates
CREATE POLICY "Users manage their own tender templates"
  ON tender_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create plan_sections table for multi-section plan uploads
CREATE TABLE IF NOT EXISTS public.plan_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  section_type TEXT NOT NULL, -- architectural, electrical, hydraulic, structural, mechanical, boq, ffe
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  analysis_status TEXT DEFAULT 'pending', -- pending, analyzing, completed, failed
  analysis_results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on plan_sections
ALTER TABLE plan_sections ENABLE ROW LEVEL SECURITY;

-- RLS policies for plan_sections
CREATE POLICY "Users manage their own plan sections"
  ON plan_sections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);