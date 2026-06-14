-- ============================================================
-- Metricore — Recipes Module
-- Migration 001 — Seed data
-- All rates marked source='system_estimate' — calibrate against
-- Rawlinsons / Cordell before public launch.
-- Rates are ex-GST, AU-NAT baseline, June 2026.
-- ============================================================

-- ---------- TRADES (system — org_id NULL) ----------
INSERT INTO public.trades (code, name, sort_order) VALUES
  ('PREL', 'Preliminaries',    0),
  ('CARP', 'Carpentry',       10),
  ('PLST', 'Plasterboard',    20),
  ('INSL', 'Insulation',      30),
  ('PLMB', 'Plumbing',        40),
  ('ELEC', 'Electrical',      50),
  ('HVAC', 'HVAC',            60),
  ('PNT',  'Painting',        70);

-- ---------- ELEMENT CATEGORIES (system — org_id NULL) ----------
-- Level 1 roots
INSERT INTO public.element_categories (code, name, default_uom, sort_order) VALUES
  ('WALL', 'Wall',          'm2',   10),
  ('CEIL', 'Ceiling',       'm2',   20),
  ('FLR',  'Floor',         'm2',   30),
  ('WET',  'Wet Areas',     'm2',   40),
  ('PREL', 'Preliminaries', 'item',  0);

-- Level 2 — Wall children
INSERT INTO public.element_categories (parent_id, code, name, default_uom, sort_order)
SELECT id, 'WALL.INT.PART', 'Internal Wall — Partition', 'm2', 10
FROM public.element_categories WHERE code = 'WALL' AND org_id IS NULL;

-- Level 2 — Ceiling children
INSERT INTO public.element_categories (parent_id, code, name, default_uom, sort_order)
SELECT id, 'CEIL.PART', 'Partition Ceiling (direct fix)', 'm2', 10
FROM public.element_categories WHERE code = 'CEIL' AND org_id IS NULL;

INSERT INTO public.element_categories (parent_id, code, name, default_uom, sort_order)
SELECT id, 'CEIL.DROP', 'Drop Ceiling (suspended grid)', 'm2', 20
FROM public.element_categories WHERE code = 'CEIL' AND org_id IS NULL;

INSERT INTO public.element_categories (parent_id, code, name, default_uom, sort_order)
SELECT id, 'CEIL.INS', 'Ceiling Insulation', 'm2', 30
FROM public.element_categories WHERE code = 'CEIL' AND org_id IS NULL;

-- Level 2 — Floor children
INSERT INTO public.element_categories (parent_id, code, name, default_uom, sort_order)
SELECT id, 'FLR.INS', 'Floor Insulation (underfloor)', 'm2', 10
FROM public.element_categories WHERE code = 'FLR' AND org_id IS NULL;

-- ---------- COST ITEMS (system — org_id NULL) ----------
-- Wall assembly items
INSERT INTO public.cost_items (code, name, item_type, uom, pack_size, default_trade_id)
SELECT 'MAT.STUD.90.MGP10', '90×35 MGP10 pine stud', 'material', 'lm', NULL, id
FROM public.trades WHERE code = 'CARP' AND org_id IS NULL;

INSERT INTO public.cost_items (code, name, item_type, uom, pack_size, default_trade_id)
SELECT 'MAT.PB.13.STD', '13mm standard plasterboard', 'material', 'm2', 3.6, id
FROM public.trades WHERE code = 'PLST' AND org_id IS NULL;

INSERT INTO public.cost_items (code, name, item_type, uom, pack_size, default_trade_id)
SELECT 'MAT.INS.R25.BATT', 'R2.5 wall insulation batt', 'material', 'm2', 8.0, id
FROM public.trades WHERE code = 'INSL' AND org_id IS NULL;

INSERT INTO public.cost_items (code, name, item_type, uom, pack_size, default_trade_id)
SELECT 'LAB.CARP.HR', 'Carpenter labour', 'labour', 'hr', NULL, id
FROM public.trades WHERE code = 'CARP' AND org_id IS NULL;

INSERT INTO public.cost_items (code, name, item_type, uom, pack_size, default_trade_id)
SELECT 'LAB.PLST.HR', 'Plasterer labour (fix + set)', 'labour', 'hr', NULL, id
FROM public.trades WHERE code = 'PLST' AND org_id IS NULL;

-- Insulation items (new — researched Jun 2026)
INSERT INTO public.cost_items (code, name, item_type, uom, pack_size, default_trade_id)
SELECT 'MAT.INS.R41.CEIL', 'R4.1 ceiling insulation batt (Bradford Gold)', 'material', 'm2', 5.0, id
FROM public.trades WHERE code = 'INSL' AND org_id IS NULL;

INSERT INTO public.cost_items (code, name, item_type, uom, pack_size, default_trade_id)
SELECT 'MAT.INS.R60.CEIL', 'R6.0 ceiling insulation batt (Bradford Gold Hi-Performance)', 'material', 'm2', 3.0, id
FROM public.trades WHERE code = 'INSL' AND org_id IS NULL;

INSERT INTO public.cost_items (code, name, item_type, uom, pack_size, default_trade_id)
SELECT 'MAT.INS.R25.UFL', 'R2.5 underfloor insulation (polyester roll)', 'material', 'm2', 5.0, id
FROM public.trades WHERE code = 'INSL' AND org_id IS NULL;

INSERT INTO public.cost_items (code, name, item_type, uom, pack_size, default_trade_id)
SELECT 'LAB.INSL.HR', 'Insulation installer charge rate', 'labour', 'hr', NULL, id
FROM public.trades WHERE code = 'INSL' AND org_id IS NULL;

-- ---------- COST ITEM RATES (system — org_id NULL, ex-GST, AU-NAT baseline) ----------
-- Wall items
-- Source: Tile Importer / JBM Online (retail Jun 2026) — trade price ~$3.30/lm
INSERT INTO public.cost_item_rates (cost_item_id, region_code, unit_rate, source)
SELECT id, 'AU-NAT', 3.30, 'system_estimate'
FROM public.cost_items WHERE code = 'MAT.STUD.90.MGP10' AND org_id IS NULL;

-- Source: Specifier / Blacktown Building Supplies (retail Jun 2026)
INSERT INTO public.cost_item_rates (cost_item_id, region_code, unit_rate, source)
SELECT id, 'AU-NAT', 10.20, 'system_estimate'
FROM public.cost_items WHERE code = 'MAT.PB.13.STD' AND org_id IS NULL;

-- Source: Pricewise Insulation / Bradford Gold pack (retail Jun 2026)
INSERT INTO public.cost_item_rates (cost_item_id, region_code, unit_rate, source)
SELECT id, 'AU-NAT', 10.50, 'system_estimate'
FROM public.cost_items WHERE code = 'MAT.INS.R25.BATT' AND org_id IS NULL;

-- Source: EIR Labour Hire 2026 / Yakka Labour 2026 — charge rate
INSERT INTO public.cost_item_rates (cost_item_id, region_code, unit_rate, source)
SELECT id, 'AU-NAT', 88.00, 'system_estimate'
FROM public.cost_items WHERE code = 'LAB.CARP.HR' AND org_id IS NULL;

-- Source: PayScale Brisbane/Gold Coast 2026 — charge rate
INSERT INTO public.cost_item_rates (cost_item_id, region_code, unit_rate, source)
SELECT id, 'AU-NAT', 80.00, 'system_estimate'
FROM public.cost_items WHERE code = 'LAB.PLST.HR' AND org_id IS NULL;

-- Insulation items — researched Jun 2026
-- R4.1: Bradford Gold R4.1 — JustRite Store $8.45/m² incl GST = $7.68 ex; using $7.80 ex-GST
INSERT INTO public.cost_item_rates (cost_item_id, region_code, unit_rate, source)
SELECT id, 'AU-NAT', 7.80, 'system_estimate'
FROM public.cost_items WHERE code = 'MAT.INS.R41.CEIL' AND org_id IS NULL;

-- R6.0: Bradford Gold Hi-Performance — Pricewise/Better Batt ~$14.67-$19.63 incl GST; using $14.50 ex-GST
INSERT INTO public.cost_item_rates (cost_item_id, region_code, unit_rate, source)
SELECT id, 'AU-NAT', 14.50, 'system_estimate'
FROM public.cost_items WHERE code = 'MAT.INS.R60.CEIL' AND org_id IS NULL;

-- R2.5 underfloor: EcoMaster QLD Polymax — $7-13/m² supply; using $9.50 ex-GST
INSERT INTO public.cost_item_rates (cost_item_id, region_code, unit_rate, source)
SELECT id, 'AU-NAT', 9.50, 'system_estimate'
FROM public.cost_items WHERE code = 'MAT.INS.R25.UFL' AND org_id IS NULL;

-- Insulation labour: PayScale Brisbane wage $21/hr → charge rate ~$70/hr
INSERT INTO public.cost_item_rates (cost_item_id, region_code, unit_rate, source)
SELECT id, 'AU-NAT', 70.00, 'system_estimate'
FROM public.cost_items WHERE code = 'LAB.INSL.HR' AND org_id IS NULL;

-- ---------- ASSEMBLY 1: 90mm stud partition wall ----------
INSERT INTO public.assemblies
  (element_category_id, code, name, description, uom, status, region_code, tags)
SELECT
  ec.id,
  'WALL.PART.90.PB13.R25',
  '90mm stud partition — 13mm PB both sides, R2.5 insulation',
  'Supply and install 90×35 MGP10 timber stud framing at 450mm centres with top and bottom plates and noggings. Fix 13mm standard plasterboard both sides, set to level 4 finish. Install R2.5 insulation batts to cavity. Excludes painting, doors, and openings adjustment.',
  'm2', 'published', 'AU-NAT',
  ARRAY['residential', 'internal', 'non-loadbearing']
FROM public.element_categories ec
WHERE ec.code = 'WALL.INT.PART' AND ec.org_id IS NULL;

-- Components for partition wall
INSERT INTO public.assembly_components
  (assembly_id, cost_item_id, trade_id, qty_per_unit, waste_pct, rounding, side_count_applies, is_optional, notes, sort_order)
SELECT a.id, ci.id, t.id, 3.20, 5, 'none', false, false,
  'Studs at 450mm ctrs incl top/bottom plates and noggings allowance', 10
FROM public.assemblies a, public.cost_items ci, public.trades t
WHERE a.code = 'WALL.PART.90.PB13.R25' AND a.org_id IS NULL
  AND ci.code = 'MAT.STUD.90.MGP10' AND ci.org_id IS NULL
  AND t.code = 'CARP' AND t.org_id IS NULL;

INSERT INTO public.assembly_components
  (assembly_id, cost_item_id, trade_id, qty_per_unit, waste_pct, rounding, side_count_applies, is_optional, notes, sort_order)
SELECT a.id, ci.id, t.id, 1.00, 10, 'up_to_pack', true, false,
  '13mm PB one side; side_count_applies=true doubles qty for both sides', 20
FROM public.assemblies a, public.cost_items ci, public.trades t
WHERE a.code = 'WALL.PART.90.PB13.R25' AND a.org_id IS NULL
  AND ci.code = 'MAT.PB.13.STD' AND ci.org_id IS NULL
  AND t.code = 'PLST' AND t.org_id IS NULL;

INSERT INTO public.assembly_components
  (assembly_id, cost_item_id, trade_id, qty_per_unit, waste_pct, rounding, side_count_applies, is_optional, notes, sort_order)
SELECT a.id, ci.id, t.id, 1.00, 5, 'up_to_pack', false, true,
  'R2.5 batts to cavity — optional toggle (not all partitions need insulation)', 30
FROM public.assemblies a, public.cost_items ci, public.trades t
WHERE a.code = 'WALL.PART.90.PB13.R25' AND a.org_id IS NULL
  AND ci.code = 'MAT.INS.R25.BATT' AND ci.org_id IS NULL
  AND t.code = 'INSL' AND t.org_id IS NULL;

INSERT INTO public.assembly_components
  (assembly_id, cost_item_id, trade_id, qty_per_unit, waste_pct, rounding, side_count_applies, is_optional, notes, sort_order)
SELECT a.id, ci.id, t.id, 0.45, 0, 'none', false, false,
  'Framing labour ~0.45 hr/m²', 40
FROM public.assemblies a, public.cost_items ci, public.trades t
WHERE a.code = 'WALL.PART.90.PB13.R25' AND a.org_id IS NULL
  AND ci.code = 'LAB.CARP.HR' AND ci.org_id IS NULL
  AND t.code = 'CARP' AND t.org_id IS NULL;

INSERT INTO public.assembly_components
  (assembly_id, cost_item_id, trade_id, qty_per_unit, waste_pct, rounding, side_count_applies, is_optional, notes, sort_order)
SELECT a.id, ci.id, t.id, 0.25, 0, 'none', true, false,
  'Fix + set ~0.25 hr/m² per side; side_count_applies doubles for both sides', 50
FROM public.assemblies a, public.cost_items ci, public.trades t
WHERE a.code = 'WALL.PART.90.PB13.R25' AND a.org_id IS NULL
  AND ci.code = 'LAB.PLST.HR' AND ci.org_id IS NULL
  AND t.code = 'PLST' AND t.org_id IS NULL;

-- ---------- ASSEMBLY 2: R4.1 ceiling insulation batts ----------
INSERT INTO public.assemblies
  (element_category_id, code, name, description, uom, status, region_code, tags)
SELECT
  ec.id,
  'CEIL.INS.R41',
  'R4.1 ceiling insulation batts (450mm rafter spacing)',
  'Supply and install Bradford Gold R4.1 fibreglass ceiling insulation batts to ceiling space. Batts installed between rafters at 450mm centres. Minimum NCC R-value for climate zones 2–4 (coastal QLD, coastal NSW). Excludes sarking and ventilation provisions.',
  'm2', 'published', 'AU-NAT',
  ARRAY['residential', 'ceiling', 'ncc-cz2', 'ncc-cz3', 'ncc-cz4']
FROM public.element_categories ec
WHERE ec.code = 'CEIL.INS' AND ec.org_id IS NULL;

INSERT INTO public.assembly_components
  (assembly_id, cost_item_id, trade_id, qty_per_unit, waste_pct, rounding, side_count_applies, is_optional, notes, sort_order)
SELECT a.id, ci.id, t.id, 1.00, 5, 'up_to_pack', false, false,
  'R4.1 batts; 5% waste for cuts at perimeter and obstacles', 10
FROM public.assemblies a, public.cost_items ci, public.trades t
WHERE a.code = 'CEIL.INS.R41' AND a.org_id IS NULL
  AND ci.code = 'MAT.INS.R41.CEIL' AND ci.org_id IS NULL
  AND t.code = 'INSL' AND t.org_id IS NULL;

INSERT INTO public.assembly_components
  (assembly_id, cost_item_id, trade_id, qty_per_unit, waste_pct, rounding, side_count_applies, is_optional, notes, sort_order)
SELECT a.id, ci.id, t.id, 0.07, 0, 'none', false, false,
  'Install labour ~0.07 hr/m² (ceiling access via manhole; ~14 m²/hr solo installer)', 20
FROM public.assemblies a, public.cost_items ci, public.trades t
WHERE a.code = 'CEIL.INS.R41' AND a.org_id IS NULL
  AND ci.code = 'LAB.INSL.HR' AND ci.org_id IS NULL
  AND t.code = 'INSL' AND t.org_id IS NULL;

-- ---------- ASSEMBLY 3: R6.0 ceiling insulation batts ----------
INSERT INTO public.assemblies
  (element_category_id, code, name, description, uom, status, region_code, tags)
SELECT
  ec.id,
  'CEIL.INS.R60',
  'R6.0 ceiling insulation batts (450mm rafter spacing)',
  'Supply and install Bradford Gold Hi-Performance R6.0 fibreglass ceiling insulation batts. Required for NCC climate zones 5–8 (VIC, inland NSW, TAS, ACT). Suitable for energy-efficiency upgrades in any zone. Excludes sarking.',
  'm2', 'published', 'AU-NAT',
  ARRAY['residential', 'ceiling', 'ncc-cz5', 'ncc-cz6', 'ncc-cz7', 'ncc-cz8', 'energy-upgrade']
FROM public.element_categories ec
WHERE ec.code = 'CEIL.INS' AND ec.org_id IS NULL;

INSERT INTO public.assembly_components
  (assembly_id, cost_item_id, trade_id, qty_per_unit, waste_pct, rounding, side_count_applies, is_optional, notes, sort_order)
SELECT a.id, ci.id, t.id, 1.00, 5, 'up_to_pack', false, false,
  'R6.0 batts; 5% waste for cuts at perimeter and obstacles', 10
FROM public.assemblies a, public.cost_items ci, public.trades t
WHERE a.code = 'CEIL.INS.R60' AND a.org_id IS NULL
  AND ci.code = 'MAT.INS.R60.CEIL' AND ci.org_id IS NULL
  AND t.code = 'INSL' AND t.org_id IS NULL;

INSERT INTO public.assembly_components
  (assembly_id, cost_item_id, trade_id, qty_per_unit, waste_pct, rounding, side_count_applies, is_optional, notes, sort_order)
SELECT a.id, ci.id, t.id, 0.07, 0, 'none', false, false,
  'Install labour ~0.07 hr/m²', 20
FROM public.assemblies a, public.cost_items ci, public.trades t
WHERE a.code = 'CEIL.INS.R60' AND a.org_id IS NULL
  AND ci.code = 'LAB.INSL.HR' AND ci.org_id IS NULL
  AND t.code = 'INSL' AND t.org_id IS NULL;

-- ---------- ASSEMBLY 4: R2.5 underfloor insulation ----------
INSERT INTO public.assemblies
  (element_category_id, code, name, description, uom, status, region_code, tags)
SELECT
  ec.id,
  'FLR.INS.R25.ELEV',
  'R2.5 underfloor insulation — elevated timber floor',
  'Supply and install R2.5 polyester insulation rolls to underside of elevated timber floor. Secured between floor joists with netting or clips. Suitable for Queenslander and other elevated timber-framed homes. Subfloor access assumed via crawl space. Excludes netting if required separately.',
  'm2', 'published', 'AU-QLD',
  ARRAY['residential', 'underfloor', 'queenslander', 'elevated-floor', 'qld']
FROM public.element_categories ec
WHERE ec.code = 'FLR.INS' AND ec.org_id IS NULL;

INSERT INTO public.assembly_components
  (assembly_id, cost_item_id, trade_id, qty_per_unit, waste_pct, rounding, side_count_applies, is_optional, notes, sort_order)
SELECT a.id, ci.id, t.id, 1.00, 8, 'up_to_pack', false, false,
  'R2.5 polyester underfloor rolls; 8% waste for cuts around joists and pipes', 10
FROM public.assemblies a, public.cost_items ci, public.trades t
WHERE a.code = 'FLR.INS.R25.ELEV' AND a.org_id IS NULL
  AND ci.code = 'MAT.INS.R25.UFL' AND ci.org_id IS NULL
  AND t.code = 'INSL' AND t.org_id IS NULL;

INSERT INTO public.assembly_components
  (assembly_id, cost_item_id, trade_id, qty_per_unit, waste_pct, rounding, side_count_applies, is_optional, notes, sort_order)
SELECT a.id, ci.id, t.id, 0.10, 0, 'none', false, false,
  'Install labour ~0.10 hr/m² (harder access than ceiling; crawl space work)', 20
FROM public.assemblies a, public.cost_items ci, public.trades t
WHERE a.code = 'FLR.INS.R25.ELEV' AND a.org_id IS NULL
  AND ci.code = 'LAB.INSL.HR' AND ci.org_id IS NULL
  AND t.code = 'INSL' AND t.org_id IS NULL;
