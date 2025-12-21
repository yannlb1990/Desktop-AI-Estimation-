-- Create storage bucket for plan uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plans', 
  'plans', 
  false,
  52428800,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.dwg', 'application/x-dwg', 'application/acad']
);

-- RLS policies for plans bucket
CREATE POLICY "Users can upload their own plans"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'plans' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own plans"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'plans' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own plans"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'plans' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own plans"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'plans' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add scope_of_work field to projects
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS scope_of_work TEXT[];

-- Create estimate_sections table for organized estimates
CREATE TABLE IF NOT EXISTS public.estimate_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL,
  user_id UUID NOT NULL,
  area TEXT NOT NULL,
  trade TEXT NOT NULL,
  scope_of_work TEXT NOT NULL,
  sequence_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.estimate_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own estimate sections"
ON public.estimate_sections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own estimate sections"
ON public.estimate_sections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own estimate sections"
ON public.estimate_sections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own estimate sections"
ON public.estimate_sections FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_estimate_sections_updated_at
BEFORE UPDATE ON public.estimate_sections
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Update estimate_items to link to sections
ALTER TABLE public.estimate_items
ADD COLUMN IF NOT EXISTS section_id UUID,
ADD COLUMN IF NOT EXISTS labour_hours NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS labour_rate NUMERIC DEFAULT 90,
ADD COLUMN IF NOT EXISTS material_wastage_pct NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS labour_wastage_pct NUMERIC DEFAULT 5;