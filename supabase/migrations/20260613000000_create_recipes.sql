-- ============================================================
-- Metricore — Recipes (Assemblies) Module
-- Migration 000 — Schema, views, rate resolution, RLS
-- PostgreSQL 15+ / Supabase
-- org_id = auth.uid() for user rows; NULL = Metricore system library
-- ============================================================

-- ---------- ENUMS ----------
CREATE TYPE item_type        AS ENUM ('material','labour','plant','subcontract','other');
CREATE TYPE assembly_type    AS ENUM ('standard','preliminaries');
CREATE TYPE assembly_status  AS ENUM ('draft','published','archived');
CREATE TYPE rounding_rule    AS ENUM ('none','up_to_pack');
CREATE TYPE prelim_driver_type AS ENUM ('pct_of_contract','per_week','per_month','fixed');

-- ---------- TRADES ----------
CREATE TABLE public.trades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NULL,
  code        text NOT NULL,
  name        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY trades_read ON public.trades
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth.uid());

CREATE POLICY trades_write ON public.trades
  FOR ALL TO authenticated
  USING (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

-- ---------- ELEMENT CATEGORIES ----------
CREATE TABLE public.element_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NULL,
  parent_id   uuid NULL REFERENCES public.element_categories(id) ON DELETE RESTRICT,
  code        text NOT NULL,
  name        text NOT NULL,
  default_uom text NOT NULL DEFAULT 'm2',
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE INDEX idx_element_categories_parent ON public.element_categories(parent_id);

ALTER TABLE public.element_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY element_categories_read ON public.element_categories
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth.uid());

CREATE POLICY element_categories_write ON public.element_categories
  FOR ALL TO authenticated
  USING (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

-- ---------- COST ITEMS ----------
CREATE TABLE public.cost_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NULL,
  code             text NOT NULL,
  name             text NOT NULL,
  item_type        item_type NOT NULL,
  uom              text NOT NULL,
  pack_size        numeric(12,4) NULL,
  default_trade_id uuid NULL REFERENCES public.trades(id),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE INDEX idx_cost_items_trade ON public.cost_items(default_trade_id);

ALTER TABLE public.cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_items_read ON public.cost_items
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth.uid());

CREATE POLICY cost_items_write ON public.cost_items
  FOR ALL TO authenticated
  USING (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

-- ---------- COST ITEM RATES ----------
CREATE TABLE public.cost_item_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_item_id   uuid NOT NULL REFERENCES public.cost_items(id) ON DELETE CASCADE,
  org_id         uuid NULL,
  region_code    text NOT NULL DEFAULT 'AU-NAT',
  unit_rate      numeric(12,4) NOT NULL CHECK (unit_rate >= 0),
  currency       text NOT NULL DEFAULT 'AUD',
  supplier       text NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to   date NULL,
  source         text NOT NULL DEFAULT 'system_estimate',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rates_lookup
  ON public.cost_item_rates(cost_item_id, region_code, effective_from DESC);

ALTER TABLE public.cost_item_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_item_rates_read ON public.cost_item_rates
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth.uid());

CREATE POLICY cost_item_rates_write ON public.cost_item_rates
  FOR ALL TO authenticated
  USING (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

-- ---------- ASSEMBLIES ----------
CREATE TABLE public.assemblies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NULL,
  element_category_id uuid NOT NULL REFERENCES public.element_categories(id),
  code                text NOT NULL,
  name                text NOT NULL,
  description         text NULL,
  uom                 text NOT NULL DEFAULT 'm2',
  assembly_type       assembly_type NOT NULL DEFAULT 'standard',
  region_code         text NOT NULL DEFAULT 'AU-NAT',
  status              assembly_status NOT NULL DEFAULT 'draft',
  version             int NOT NULL DEFAULT 1,
  cloned_from_id      uuid NULL REFERENCES public.assemblies(id),
  tags                text[] NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE INDEX idx_assemblies_category ON public.assemblies(element_category_id);
CREATE INDEX idx_assemblies_status   ON public.assemblies(status);

CREATE TRIGGER assemblies_updated_at
  BEFORE UPDATE ON public.assemblies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.assemblies ENABLE ROW LEVEL SECURITY;

CREATE POLICY assemblies_read ON public.assemblies
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth.uid());

CREATE POLICY assemblies_write ON public.assemblies
  FOR ALL TO authenticated
  USING (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

-- ---------- ASSEMBLY COMPONENTS ----------
CREATE TABLE public.assembly_components (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id        uuid NOT NULL REFERENCES public.assemblies(id) ON DELETE CASCADE,
  cost_item_id       uuid NOT NULL REFERENCES public.cost_items(id),
  trade_id           uuid NOT NULL REFERENCES public.trades(id),
  qty_per_unit       numeric(12,6) NOT NULL CHECK (qty_per_unit >= 0),
  waste_pct          numeric(5,2)  NOT NULL DEFAULT 0 CHECK (waste_pct >= 0),
  rounding           rounding_rule NOT NULL DEFAULT 'none',
  formula            text NULL,
  side_count_applies boolean NOT NULL DEFAULT false,
  is_optional        boolean NOT NULL DEFAULT false,
  notes              text NULL,
  sort_order         int NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_components_assembly ON public.assembly_components(assembly_id);
CREATE INDEX idx_components_trade    ON public.assembly_components(trade_id);

ALTER TABLE public.assembly_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY components_read ON public.assembly_components
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assemblies a
    WHERE a.id = assembly_id
      AND (a.org_id IS NULL OR a.org_id = auth.uid())
  ));

CREATE POLICY components_write ON public.assembly_components
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assemblies a
    WHERE a.id = assembly_id AND a.org_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assemblies a
    WHERE a.id = assembly_id AND a.org_id = auth.uid()
  ));

-- ---------- PRELIM DRIVERS ----------
CREATE TABLE public.prelim_drivers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id  uuid NOT NULL REFERENCES public.assemblies(id) ON DELETE CASCADE,
  cost_item_id uuid NULL REFERENCES public.cost_items(id),
  driver_type  prelim_driver_type NOT NULL,
  value        numeric(12,4) NOT NULL,
  trade_id     uuid NOT NULL REFERENCES public.trades(id),
  notes        text NULL
);

ALTER TABLE public.prelim_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY prelim_drivers_read ON public.prelim_drivers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assemblies a
    WHERE a.id = assembly_id
      AND (a.org_id IS NULL OR a.org_id = auth.uid())
  ));

CREATE POLICY prelim_drivers_write ON public.prelim_drivers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assemblies a
    WHERE a.id = assembly_id AND a.org_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assemblies a
    WHERE a.id = assembly_id AND a.org_id = auth.uid()
  ));

-- ---------- VIEWS ----------
CREATE VIEW public.assembly_trades AS
  SELECT DISTINCT assembly_id, trade_id
  FROM public.assembly_components;

-- ---------- RATE RESOLUTION FUNCTION ----------
-- Resolution order: org+region → org+national → system+region → system+national
CREATE OR REPLACE FUNCTION public.resolve_rate(
  p_cost_item_id uuid,
  p_org_id       uuid,
  p_region       text,
  p_on_date      date DEFAULT CURRENT_DATE
) RETURNS TABLE (rate_id uuid, unit_rate numeric) AS $$
  SELECT r.id, r.unit_rate
  FROM public.cost_item_rates r
  WHERE r.cost_item_id = p_cost_item_id
    AND r.effective_from <= p_on_date
    AND (r.effective_to IS NULL OR r.effective_to >= p_on_date)
    AND (r.org_id = p_org_id OR r.org_id IS NULL)
    AND (r.region_code = p_region OR r.region_code = 'AU-NAT')
  ORDER BY
    (r.org_id = p_org_id) DESC,
    (r.region_code = p_region) DESC,
    r.effective_from DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;
