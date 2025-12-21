-- Plan pages with scale and coordinate system
CREATE TABLE plan_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  file_url TEXT NOT NULL,
  page_number INTEGER DEFAULT 1,
  scale_factor FLOAT,
  scale_known_distance_mm FLOAT,
  scale_point_a JSONB,
  scale_point_b JSONB,
  detected_scale_text TEXT,
  canvas_width FLOAT,
  canvas_height FLOAT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE plan_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own plan pages"
  ON plan_pages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own plan pages"
  ON plan_pages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plan pages"
  ON plan_pages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plan pages"
  ON plan_pages FOR DELETE
  USING (auth.uid() = user_id);

-- Stored measurements (linear and polygon)
CREATE TABLE plan_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_page_id UUID REFERENCES plan_pages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  measurement_type TEXT NOT NULL,
  points JSONB NOT NULL,
  raw_value FLOAT,
  real_value FLOAT,
  real_unit TEXT,
  label TEXT,
  room_name TEXT,
  trade TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE plan_measurements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own measurements"
  ON plan_measurements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own measurements"
  ON plan_measurements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own measurements"
  ON plan_measurements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own measurements"
  ON plan_measurements FOR DELETE
  USING (auth.uid() = user_id);

-- Detected symbols (doors, windows, fixtures)
CREATE TABLE plan_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_page_id UUID REFERENCES plan_pages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  symbol_type TEXT NOT NULL,
  bounding_box JSONB NOT NULL,
  center_point JSONB,
  confidence FLOAT DEFAULT 0.5,
  schedule_id TEXT,
  size_width_mm FLOAT,
  size_height_mm FLOAT,
  room_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE plan_symbols ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own symbols"
  ON plan_symbols FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own symbols"
  ON plan_symbols FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own symbols"
  ON plan_symbols FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own symbols"
  ON plan_symbols FOR DELETE
  USING (auth.uid() = user_id);

-- Door/Window schedules extracted from plans
CREATE TABLE plan_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_page_id UUID REFERENCES plan_pages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  schedule_type TEXT NOT NULL,
  schedule_id TEXT NOT NULL,
  width_mm FLOAT,
  height_mm FLOAT,
  description TEXT,
  material TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE plan_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own schedules"
  ON plan_schedules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own schedules"
  ON plan_schedules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedules"
  ON plan_schedules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedules"
  ON plan_schedules FOR DELETE
  USING (auth.uid() = user_id);

-- Summarized quantities for estimation
CREATE TABLE plan_quantities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  quantity_type TEXT NOT NULL,
  trade TEXT,
  room_name TEXT,
  quantity FLOAT NOT NULL,
  unit TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE plan_quantities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own quantities"
  ON plan_quantities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quantities"
  ON plan_quantities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quantities"
  ON plan_quantities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quantities"
  ON plan_quantities FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_plan_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_plan_pages_updated_at_trigger
BEFORE UPDATE ON plan_pages
FOR EACH ROW
EXECUTE FUNCTION update_plan_pages_updated_at();