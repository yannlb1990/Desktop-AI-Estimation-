-- Buildamax AI Tender - Initial Database Schema
-- Supabase Migration: 001_initial_schema
-- Created: 2024

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  address TEXT NOT NULL,
  suburb VARCHAR(100),
  state VARCHAR(10) NOT NULL,
  postcode VARCHAR(10) NOT NULL,
  project_type VARCHAR(50) NOT NULL DEFAULT 'residential',
  status VARCHAR(50) NOT NULL DEFAULT 'enquiry',
  estimated_value DECIMAL(12, 2),
  actual_value DECIMAL(12, 2),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  notes TEXT,
  tags TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project indexes
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_state ON projects(state);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- ============================================
-- ESTIMATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  revision INTEGER NOT NULL DEFAULT 1,
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  project_address TEXT,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  gst DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  margin_percent DECIMAL(5, 2) NOT NULL DEFAULT 25,
  valid_until TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Estimate indexes
CREATE INDEX idx_estimates_project_id ON estimates(project_id);
CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_estimates_created_by ON estimates(created_by);
CREATE INDEX idx_estimates_created_at ON estimates(created_at DESC);

-- ============================================
-- ESTIMATE LINE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS estimate_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  trade VARCHAR(100) NOT NULL,
  sow VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(20) NOT NULL,
  quantity DECIMAL(12, 4) NOT NULL,
  rate DECIMAL(12, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  category VARCHAR(100),
  ncc_codes TEXT[],
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Line item indexes
CREATE INDEX idx_line_items_estimate_id ON estimate_line_items(estimate_id);
CREATE INDEX idx_line_items_trade ON estimate_line_items(trade);
CREATE INDEX idx_line_items_sort_order ON estimate_line_items(sort_order);

-- ============================================
-- SUPPLIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name VARCHAR(255) NOT NULL,
  trading_name VARCHAR(255),
  abn VARCHAR(20),
  contact_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  address TEXT,
  suburb VARCHAR(100),
  state VARCHAR(10) NOT NULL,
  postcode VARCHAR(10),
  categories TEXT[] NOT NULL DEFAULT '{}',
  brands TEXT[],
  delivery_areas TEXT[],
  minimum_order DECIMAL(10, 2),
  payment_terms VARCHAR(100),
  account_number VARCHAR(50),
  rating DECIMAL(2, 1) NOT NULL DEFAULT 0,
  notes TEXT,
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supplier indexes
CREATE INDEX idx_suppliers_state ON suppliers(state);
CREATE INDEX idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX idx_suppliers_is_preferred ON suppliers(is_preferred);
CREATE INDEX idx_suppliers_categories ON suppliers USING GIN(categories);

-- ============================================
-- SUPPLIER QUOTE REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_quote_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  items JSONB NOT NULL DEFAULT '[]',
  delivery_address TEXT NOT NULL,
  required_by_date TIMESTAMPTZ,
  notes TEXT,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  quoted_total DECIMAL(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quote request indexes
CREATE INDEX idx_quote_requests_supplier_id ON supplier_quote_requests(supplier_id);
CREATE INDEX idx_quote_requests_project_id ON supplier_quote_requests(project_id);
CREATE INDEX idx_quote_requests_status ON supplier_quote_requests(status);

-- ============================================
-- SUBCONTRACTORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subcontractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  abn VARCHAR(20),
  license_number VARCHAR(50),
  trades TEXT[] NOT NULL DEFAULT '{}',
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  rating DECIMAL(2, 1) NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subcontractor indexes
CREATE INDEX idx_subcontractors_trades ON subcontractors USING GIN(trades);
CREATE INDEX idx_subcontractors_service_areas ON subcontractors USING GIN(service_areas);
CREATE INDEX idx_subcontractors_is_active ON subcontractors(is_active);

-- ============================================
-- SUBCONTRACTOR RATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subcontractor_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subbie_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  trade VARCHAR(100) NOT NULL,
  sow_type VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(20) NOT NULL,
  rate DECIMAL(10, 2) NOT NULL,
  min_call_out DECIMAL(10, 2),
  includes_gst BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  notes TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate indexes
CREATE INDEX idx_subbie_rates_subbie_id ON subcontractor_rates(subbie_id);
CREATE INDEX idx_subbie_rates_trade ON subcontractor_rates(trade);
CREATE INDEX idx_subbie_rates_effective ON subcontractor_rates(effective_from, effective_to);

-- ============================================
-- RATE HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rate_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subbie_rate_id UUID REFERENCES subcontractor_rates(id) ON DELETE CASCADE,
  previous_rate DECIMAL(10, 2) NOT NULL,
  new_rate DECIMAL(10, 2) NOT NULL,
  change_percent DECIMAL(6, 2) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT
);

-- Rate history indexes
CREATE INDEX idx_rate_history_rate_id ON rate_history(subbie_rate_id);
CREATE INDEX idx_rate_history_changed_at ON rate_history(changed_at DESC);

-- ============================================
-- MATERIAL PRICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS material_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  category VARCHAR(100) NOT NULL,
  supplier VARCHAR(255) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  previous_price DECIMAL(10, 2),
  price_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  lead_time_days INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Material price indexes
CREATE INDEX idx_material_prices_category ON material_prices(category);
CREATE INDEX idx_material_prices_supplier ON material_prices(supplier);
CREATE INDEX idx_material_prices_product_name ON material_prices(product_name);
CREATE INDEX idx_material_prices_is_active ON material_prices(is_active);

-- ============================================
-- WEBHOOKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret VARCHAR(255),
  headers JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  retry_count INTEGER NOT NULL DEFAULT 3,
  last_triggered_at TIMESTAMPTZ,
  last_status VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook indexes
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active);
CREATE INDEX idx_webhooks_events ON webhooks USING GIN(events);

-- ============================================
-- WEBHOOK DELIVERIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  status_code INTEGER,
  response TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Delivery indexes
CREATE INDEX idx_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_deliveries_created_at ON webhook_deliveries(created_at DESC);

-- ============================================
-- PROJECT TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  sub_category VARCHAR(100),
  typical_duration VARCHAR(50),
  typical_budget_min DECIMAL(12, 2),
  typical_budget_max DECIMAL(12, 2),
  line_items JSONB NOT NULL DEFAULT '[]',
  common_variations TEXT[],
  ncc_requirements TEXT[],
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Template indexes
CREATE INDEX idx_templates_category ON project_templates(category);
CREATE INDEX idx_templates_is_active ON project_templates(is_active);

-- ============================================
-- NCC COMPLIANCE CHECKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ncc_compliance_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  check_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  work_types TEXT[] NOT NULL DEFAULT '{}',
  compliance_score INTEGER NOT NULL,
  total_requirements INTEGER NOT NULL,
  met_requirements INTEGER NOT NULL,
  missing_items JSONB NOT NULL DEFAULT '[]',
  suggestions JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compliance check indexes
CREATE INDEX idx_compliance_estimate_id ON ncc_compliance_checks(estimate_id);
CREATE INDEX idx_compliance_check_date ON ncc_compliance_checks(check_date DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncc_compliance_checks ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = created_by);

-- Estimates policies
CREATE POLICY "Users can view own estimates" ON estimates
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create estimates" ON estimates
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own estimates" ON estimates
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own estimates" ON estimates
  FOR DELETE USING (auth.uid() = created_by);

-- Line items inherit from estimates
CREATE POLICY "Users can manage line items" ON estimate_line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = estimate_line_items.estimate_id
      AND estimates.created_by = auth.uid()
    )
  );

-- Suppliers - all authenticated users can view
CREATE POLICY "Authenticated users can view suppliers" ON suppliers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage suppliers" ON suppliers
  FOR ALL USING (auth.role() = 'authenticated');

-- Quote requests
CREATE POLICY "Users can manage quote requests" ON supplier_quote_requests
  FOR ALL USING (auth.role() = 'authenticated');

-- Subcontractors
CREATE POLICY "Authenticated users can view subcontractors" ON subcontractors
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage subcontractors" ON subcontractors
  FOR ALL USING (auth.role() = 'authenticated');

-- Subcontractor rates
CREATE POLICY "Authenticated users can view rates" ON subcontractor_rates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage rates" ON subcontractor_rates
  FOR ALL USING (auth.role() = 'authenticated');

-- Rate history
CREATE POLICY "Authenticated users can view rate history" ON rate_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- Material prices - all authenticated users
CREATE POLICY "Authenticated users can view prices" ON material_prices
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage prices" ON material_prices
  FOR ALL USING (auth.role() = 'authenticated');

-- Webhooks
CREATE POLICY "Authenticated users can manage webhooks" ON webhooks
  FOR ALL USING (auth.role() = 'authenticated');

-- Webhook deliveries
CREATE POLICY "Authenticated users can view deliveries" ON webhook_deliveries
  FOR SELECT USING (auth.role() = 'authenticated');

-- Templates - system templates viewable by all, custom by creator
CREATE POLICY "Users can view templates" ON project_templates
  FOR SELECT USING (is_system = TRUE OR auth.uid() = created_by);

CREATE POLICY "Users can create templates" ON project_templates
  FOR INSERT WITH CHECK (auth.uid() = created_by AND is_system = FALSE);

CREATE POLICY "Users can update own templates" ON project_templates
  FOR UPDATE USING (auth.uid() = created_by AND is_system = FALSE);

-- Compliance checks inherit from estimates
CREATE POLICY "Users can manage compliance checks" ON ncc_compliance_checks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = ncc_compliance_checks.estimate_id
      AND estimates.created_by = auth.uid()
    )
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_requests_updated_at BEFORE UPDATE ON supplier_quote_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subcontractors_updated_at BEFORE UPDATE ON subcontractors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_material_prices_updated_at BEFORE UPDATE ON material_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON project_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to recalculate estimate totals
CREATE OR REPLACE FUNCTION recalculate_estimate_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(12, 2);
  v_gst DECIMAL(12, 2);
  v_total DECIMAL(12, 2);
BEGIN
  -- Calculate subtotal from line items
  SELECT COALESCE(SUM(total), 0) INTO v_subtotal
  FROM estimate_line_items
  WHERE estimate_id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  -- Calculate GST (10%)
  v_gst := v_subtotal * 0.1;
  v_total := v_subtotal + v_gst;

  -- Update estimate
  UPDATE estimates
  SET subtotal = v_subtotal,
      gst = v_gst,
      total = v_total,
      updated_at = NOW()
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate totals on line item changes
CREATE TRIGGER recalc_estimate_on_line_item_change
  AFTER INSERT OR UPDATE OR DELETE ON estimate_line_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_estimate_totals();

-- Function to track rate history
CREATE OR REPLACE FUNCTION track_rate_history()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.rate IS DISTINCT FROM NEW.rate THEN
    INSERT INTO rate_history (subbie_rate_id, previous_rate, new_rate, change_percent)
    VALUES (
      NEW.id,
      OLD.rate,
      NEW.rate,
      ((NEW.rate - OLD.rate) / OLD.rate) * 100
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track rate changes
CREATE TRIGGER track_subbie_rate_changes
  AFTER UPDATE ON subcontractor_rates
  FOR EACH ROW EXECUTE FUNCTION track_rate_history();

-- ============================================
-- SEED DATA - Australian States
-- ============================================
-- This would typically be in a separate seed file
-- INSERT INTO ... for default suppliers, templates, etc.

COMMENT ON TABLE projects IS 'Construction projects with client and location details';
COMMENT ON TABLE estimates IS 'Estimates/quotes for projects with revision tracking';
COMMENT ON TABLE estimate_line_items IS 'Individual line items within estimates';
COMMENT ON TABLE suppliers IS 'Material suppliers with contact and category info';
COMMENT ON TABLE supplier_quote_requests IS 'RFQ system for requesting supplier quotes';
COMMENT ON TABLE subcontractors IS 'Subcontractor/tradie contact database';
COMMENT ON TABLE subcontractor_rates IS 'Subbie rates by trade and SOW type';
COMMENT ON TABLE rate_history IS 'Historical tracking of rate changes';
COMMENT ON TABLE material_prices IS 'Live material pricing database';
COMMENT ON TABLE webhooks IS 'Webhook configuration for external integrations';
COMMENT ON TABLE webhook_deliveries IS 'Webhook delivery history and retry queue';
COMMENT ON TABLE project_templates IS 'Pre-built project templates for quick estimating';
COMMENT ON TABLE ncc_compliance_checks IS 'NCC compliance check results per estimate';
