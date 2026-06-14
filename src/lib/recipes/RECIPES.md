# Metricore — Recipes (Assemblies) Module

Version: 1.0 — June 2026  
Status: **Planned — not yet built**

---

## What this module does

A recipe is a building element (wall, ceiling, floor) that contains a list of components —
materials, labour, plant — each tagged with a trade. When a user drops a recipe into an
estimate and enters a measurement (e.g. 25 m² of wall), the calc engine explodes the recipe
into individual `CostItem` rows with quantities, waste, and rates already calculated.

This replaces manual line-by-line entry. A carpenter sees only carpentry components; a builder
sees everything. Same library, different lens.

---

## File map

```
src/lib/recipes/
├── RECIPES.md          ← this file
├── types.ts            ← TypeScript interfaces (Assembly, AssemblyComponent, etc.)
├── calcEngine.ts       ← pure explodeAssembly() function — no Supabase dependency
└── api.ts              ← Supabase queries: listAssemblies, getAssemblyWithComponents, resolveRates

src/components/recipes/
└── RecipePickerDialog.tsx   ← dialog opened from CostEstimator "From Recipe" button

supabase/migrations/
├── 20260613000000_create_recipes.sql   ← schema: 6 tables, views, resolve_rate(), RLS
└── 20260613000001_seed_recipes.sql     ← seed: 8 trades, element categories, cost items, 1 assembly
```

**Only existing file modified:** `src/components/takeoff/CostEstimator.tsx`
— one "From Recipe" button added to the toolbar, wired to RecipePickerDialog.

---

## Data model (summary)

```
element_categories (Wall → Internal Wall → Partition)
        │
    assemblies  ──  assembly_components  ──  cost_items  ──  cost_item_rates
   (the recipe)     (qty driver per m²,      (atomic items:    (price history,
                     waste %, trade tag)      stud, PB sheet,   versioned,
                                              carpenter hr)     by region)
```

### Key design decisions

**Two-axis, not a tree.**
Building element (wall/ceiling/floor) is the primary object. Trade is a tag on each component.
A plumber filters the library and sees only plumbing scope inside each assembly. A builder sees
everything. Same assembly, different lens — no duplication per trade.

**Rates never hardcoded.**
Assemblies reference `cost_items` → `cost_item_rates`. When a rate updates, all assemblies update.
Estimates freeze the rate at time of use (`unit_rate` copied into the CostItem on explosion).

**`org_id = auth.uid()` (not a JWT claim).**
This app is user-per-account, not team/org. `org_id IS NULL` = Metricore system library (readable
by all, writable only by service role). `org_id = auth.uid()` = user's own custom library (full CRUD).

**No new estimate tables.**
The spec proposed `estimates` / `estimate_sections` / `estimate_lines` tables. These already exist
as `projects` / `estimate_items` in the DB. Recipe explosion outputs `CostItem[]` objects that feed
into the existing `onAddCostItem` → `transferItems()` localStorage flow unchanged.

---

## Quantity explosion formula (v1)

```
qty = measured_qty
    × qty_per_unit
    × (sides  if side_count_applies  else 1)
    × (1 + waste_pct / 100)

if rounding = 'up_to_pack':
    qty = ceil(qty / pack_size) × pack_size
```

Example — 25 m² partition wall, 13mm PB both sides, 10% waste, pack_size 3.6 m²:

```
qty = 25 × 1.00 × 2 × 1.10 = 55.0 m²
rounded up to pack: ceil(55.0 / 3.6) × 3.6 = ceil(15.28) × 3.6 = 16 × 3.6 = 57.6 m²
```

---

## Integration point

```
RecipePickerDialog
    → user picks assembly + enters measured_qty + sides
    → calls explodeAssembly() (calcEngine.ts)
    → calls resolveRates() (api.ts) for current prices
    → produces CostItem[]  ← same interface as types.ts CostItem
    → calls onAddCostItem(item) for each
    → existing CostEstimator rows + transferItems() flow unchanged
```

---

## Rate library — seed data

Seeded rates are research estimates, **not Rawlinsons/Cordell verified**. Every seeded rate has
`source = 'system_estimate'`. Before shipping to paying users, calibrate against:
- Rawlinsons Construction Cost Guide (QLD/NSW edition)
- Cordell Housing Building Cost Guide
- MBA Queensland labour award rates

### Seeded rates (ex-GST, AU-NAT baseline, June 2026)

| Code | Item | Seeded rate | Spec placeholder | Research source |
|---|---|---|---|---|
| MAT.STUD.90.MGP10 | 90×35 MGP10 pine stud | **$3.30/lm** | $4.80/lm | Tile Importer, JBM Online — live Jun 2026 |
| MAT.PB.13.STD | 13mm standard plasterboard | **$10.20/m²** | $9.50/m² | Specifier, Blacktown Building Supplies |
| MAT.INS.R25.BATT | R2.5 wall insulation batt | **$10.50/m²** | $7.20/m² | Pricewise Insulation, Bradford Gold pack price |
| LAB.CARP.HR | Carpenter charge rate | **$88/hr** | $85/hr | EIR Labour Hire 2026, Yakka Labour 2026 |
| LAB.PLST.HR | Plasterer charge rate | **$80/hr** | $80/hr | PayScale Brisbane/Gold Coast 2026 |

### State multipliers (applied in resolveRates())

| Region | Multiplier | Basis |
|---|---|---|
| AU-QLD | 1.00 | baseline |
| AU-NSW | 1.08 | higher labour costs, Sydney metro premium |
| AU-VIC | 1.05 | Melbourne metro |
| AU-WA | 1.12 | remoteness, mining labour competition |
| AU-SA | 0.98 | slightly lower demand |
| AU-NAT | 1.00 | fallback national average |

---

## RLS pattern (all 6 new tables)

```sql
-- System rows: readable by all authenticated users, not writable by anyone (service role only)
CREATE POLICY read_system_or_own ON <table>
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth.uid());

-- User rows: full CRUD for own org only
CREATE POLICY write_own ON <table>
  FOR ALL TO authenticated
  USING (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());
```

Child tables (assembly_components, cost_item_rates) inherit access through their parent via EXISTS subquery.

---

## v1 exclusions (deliberate)

| Feature | Why excluded | Schema status |
|---|---|---|
| Formula expressions | Factor + waste covers 90% of residential cases | `formula` column exists, dormant |
| Supplier price feeds | Build after paying users exist | `source = 'supplier_feed'` enum ready |
| Multi-currency | AUD only | `currency` column exists |
| Crew/productivity labour | Simple hr/m² factor sufficient in v1 | Not modelled |
| Assembly version diff UI | Show "newer system version available" banner | `cloned_from_id` + `version` columns ready |

---

## Build order

1. Migration `20260613000000_create_recipes.sql` — schema + RLS
2. Migration `20260613000001_seed_recipes.sql` — trades, categories, items, rates, 1 sample assembly
3. `src/lib/recipes/types.ts` — interfaces
4. `src/lib/recipes/calcEngine.ts` — pure explosion function, unit test before wiring
5. `src/lib/recipes/api.ts` — Supabase queries
6. `src/components/recipes/RecipePickerDialog.tsx` — UI
7. `CostEstimator.tsx` — add "From Recipe" button

---

## SOW research sprint (post-build)

Target: 40–60 published assemblies for QLD/NSW residential before public launch.

Priority order (highest frequency in residential refurb + commercial fitout):
1. Partition walls (90mm, 70mm, fire-rated 92mm)
2. Partition ceilings (direct fix, batten, suspended grid)
3. Wet area assemblies (bathroom wall, floor waterproofing + tile)
4. Flooring (tile, vinyl plank, epoxy)
5. External works (paving, turf, decking)
6. Preliminaries (site setup, supervision, skips)

Each assembly needs a real SOW description paragraph — not generic. Use the Watermark Constructions
SOW documents and the Swell/32 Wentford QS documents as the calibration reference.
