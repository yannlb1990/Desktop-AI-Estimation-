-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  abn TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_name TEXT,
  site_address TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'complete', 'sent')),
  plan_file_url TEXT,
  plan_file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Create estimates table
CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_materials DECIMAL(12,2) DEFAULT 0,
  total_labour DECIMAL(12,2) DEFAULT 0,
  overhead_percentage DECIMAL(5,2) DEFAULT 15,
  margin_percentage DECIMAL(5,2) DEFAULT 18,
  gst_percentage DECIMAL(5,2) DEFAULT 10,
  subtotal DECIMAL(12,2) DEFAULT 0,
  total_inc_gst DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own estimates"
  ON public.estimates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own estimates"
  ON public.estimates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own estimates"
  ON public.estimates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own estimates"
  ON public.estimates FOR DELETE
  USING (auth.uid() = user_id);

-- Create estimate_items table (materials and labour breakdown)
CREATE TABLE public.estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'Framing', 'Lining', 'Roofing', etc.
  item_type TEXT NOT NULL CHECK (item_type IN ('material', 'labour')),
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit TEXT, -- 'm2', 'lm', 'ea', etc.
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  supplier TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items from their estimates"
  ON public.estimate_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.estimates e
      WHERE e.id = estimate_items.estimate_id
      AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create items in their estimates"
  ON public.estimate_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.estimates e
      WHERE e.id = estimate_items.estimate_id
      AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in their estimates"
  ON public.estimate_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.estimates e
      WHERE e.id = estimate_items.estimate_id
      AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items from their estimates"
  ON public.estimate_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.estimates e
      WHERE e.id = estimate_items.estimate_id
      AND e.user_id = auth.uid()
    )
  );

-- Create tenders table
CREATE TABLE public.tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tender_number TEXT,
  inclusions TEXT[],
  exclusions TEXT[],
  payment_terms TEXT,
  deposit_percentage DECIMAL(5,2) DEFAULT 10,
  progress_payment_percentage DECIMAL(5,2) DEFAULT 40,
  final_payment_percentage DECIMAL(5,2) DEFAULT 50,
  validity_days INTEGER DEFAULT 30,
  pdf_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tenders"
  ON public.tenders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tenders"
  ON public.tenders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tenders"
  ON public.tenders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tenders"
  ON public.tenders FOR DELETE
  USING (auth.uid() = user_id);

-- Create AI analysis results table
CREATE TABLE public.ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL, -- 'takeoff', 'compliance', 'pricing'
  input_data JSONB,
  results JSONB,
  confidence_score DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI analyses"
  ON public.ai_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI analyses"
  ON public.ai_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_tenders_updated_at
  BEFORE UPDATE ON public.tenders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, company_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'company_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();