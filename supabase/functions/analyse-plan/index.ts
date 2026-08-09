import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const ALLOWED_ORIGINS = [
  "https://www.metricore.com.au",
  "https://metricore.com.au",
  "http://localhost:3002",
  "http://localhost:5173",
];

function getCors(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ─── FULL ANALYSIS TOOL (backward compat / no focusCategory) ───────────────

const ANALYSIS_TOOL = {
  name: "submit_analysis",
  description: "Submit the complete construction quantity take-off analysis.",
  input_schema: {
    type: "object",
    required: ["rooms", "openings", "totalFloorArea", "estimatedTrades", "notes", "constructionOverview", "scopeHighlights", "riskItems", "assumptions", "buildingElements"],
    properties: {
      rooms: {
        type: "array",
        description: "All habitable rooms across all storeys (no duplicates across pages).",
        items: {
          type: "object",
          required: ["name", "areaSqm"],
          properties: {
            name: { type: "string" },
            areaSqm: { type: "number" },
            level: { type: "string", description: "Ground, Upper, Basement or blank" },
          },
        },
      },
      openings: {
        type: "object",
        required: ["doors", "windows", "externalDoors", "internalDoors"],
        properties: {
          doors: { type: "integer", description: "Total door count (internal + external)" },
          windows: { type: "integer" },
          externalDoors: { type: "integer" },
          internalDoors: { type: "integer" },
        },
      },
      totalFloorArea: {
        type: "number",
        description: "Sum of all habitable floor area in m² across all storeys.",
      },
      levels: { type: "integer", description: "Number of storeys (1 = single, 2 = double, etc.)" },
      documentTypes: {
        type: "array",
        description: "What each page image shows.",
        items: {
          type: "object",
          properties: {
            pageIndex: { type: "integer" },
            type: {
              type: "string",
              enum: ["floor-plan", "elevation", "site-plan", "roof-plan", "section", "schedule", "specification", "detail", "title-page", "other"],
            },
            level: { type: "string", description: "e.g. Ground, Upper, North, South" },
          },
        },
      },
      estimatedTrades: {
        type: "array",
        description: "Comprehensive quantity take-off for all relevant trades.",
        items: {
          type: "object",
          required: ["trade", "quantity", "unit", "confidence", "rateId"],
          properties: {
            trade: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            confidence: { type: "number", description: "0.0 to 1.0" },
            rateId: { type: "string" },
            notes: { type: "string" },
            materialSpec: { type: "string" },
            nccRef: { type: "string" },
          },
        },
      },
      projectType: {
        type: "string",
        enum: ["residential", "commercial", "industrial", "mixed_use"],
      },
      notes: { type: "array", items: { type: "string" } },
      constructionOverview: { type: "string" },
      scopeHighlights: { type: "array", items: { type: "string" } },
      riskItems: { type: "array", items: { type: "string" } },
      assumptions: { type: "array", items: { type: "string" } },
      buildingElements: {
        type: "object",
        properties: {
          structureType: { type: "string", enum: ["timber_frame", "steel_frame", "brick_veneer", "double_brick", "unknown"] },
          wallHeight: { type: "number" },
          studSpacing: { type: "number", enum: [450, 600] },
          studSize: { type: "string" },
          timberGrade: { type: "string" },
          roofType: { type: "string", enum: ["hip", "gable", "skillion", "flat", "dutch_gable", "unknown"] },
          roofCover: { type: "string", enum: ["colorbond", "concrete_tile", "terracotta", "zincalume", "unknown"] },
          roofPitch: { type: "number" },
          foundationType: { type: "string", enum: ["slab_on_ground", "suspended_floor", "pier_and_beam", "unknown"] },
          climateZone: { type: "number" },
          ceilingRValue: { type: "number" },
          wallRValue: { type: "number" },
          externalCladding: { type: "string", enum: ["brick_veneer", "weatherboard", "fc_sheet", "render", "unknown"] },
          wetAreas: { type: "array", items: { type: "string" } },
        },
      },
      elementSources: {
        type: "array",
        description: "For each buildingElements value explicitly stated in the drawings (not inferred), record where it was found.",
        items: {
          type: "object",
          required: ["field", "pageIndex", "excerpt"],
          properties: {
            field: { type: "string", description: "The buildingElements key e.g. 'studSpacing', 'roofPitch'" },
            pageIndex: { type: "integer", description: "1-based page number where found" },
            excerpt: { type: "string", description: "Verbatim text from the drawing, max 120 chars" },
          },
        },
      },
      pendingItems: {
        type: "array",
        description: "Construction elements clearly visible in the plans that CANNOT be priced using the AVAILABLE RATE IDs.",
        items: {
          type: "object",
          required: ["description", "estimatedQuantity", "unit", "reason"],
          properties: {
            description: { type: "string" },
            estimatedQuantity: { type: "number" },
            unit: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
    },
  },
};

// ─── BASE PASS TOOL (spatial + structure + framing + roof + envelope) ────────

const BASE_TOOL = {
  name: "submit_base",
  description: "Submit spatial project data plus structural, framing, roof, and external envelope trade quantities.",
  input_schema: {
    type: "object",
    required: ["rooms", "openings", "totalFloorArea", "notes", "constructionOverview", "estimatedTrades"],
    properties: {
      rooms: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "areaSqm"],
          properties: {
            name: { type: "string" },
            areaSqm: { type: "number" },
            level: { type: "string" },
          },
        },
      },
      openings: {
        type: "object",
        required: ["doors", "windows", "externalDoors", "internalDoors"],
        properties: {
          doors: { type: "integer" },
          windows: { type: "integer" },
          externalDoors: { type: "integer" },
          internalDoors: { type: "integer" },
        },
      },
      totalFloorArea: { type: "number" },
      levels: { type: "integer" },
      projectType: { type: "string", enum: ["residential", "commercial", "industrial", "mixed_use"] },
      notes: { type: "array", items: { type: "string" } },
      constructionOverview: { type: "string", description: "One sentence: frame type, cladding, roof, foundation, storeys." },
      scopeHighlights: { type: "array", items: { type: "string" } },
      riskItems: { type: "array", items: { type: "string" } },
      assumptions: { type: "array", items: { type: "string" } },
      buildingElements: {
        type: "object",
        properties: {
          structureType: { type: "string", enum: ["timber_frame", "steel_frame", "brick_veneer", "double_brick", "unknown"] },
          wallHeight: { type: "number" },
          studSpacing: { type: "number", enum: [450, 600] },
          studSize: { type: "string" },
          timberGrade: { type: "string" },
          roofType: { type: "string", enum: ["hip", "gable", "skillion", "flat", "dutch_gable", "unknown"] },
          roofCover: { type: "string", enum: ["colorbond", "concrete_tile", "terracotta", "zincalume", "unknown"] },
          roofPitch: { type: "number" },
          foundationType: { type: "string", enum: ["slab_on_ground", "suspended_floor", "pier_and_beam", "unknown"] },
          climateZone: { type: "number" },
          ceilingRValue: { type: "number" },
          wallRValue: { type: "number" },
          externalCladding: { type: "string", enum: ["brick_veneer", "weatherboard", "fc_sheet", "render", "unknown"] },
          wetAreas: { type: "array", items: { type: "string" } },
        },
      },
      elementSources: {
        type: "array",
        description: "For each buildingElements value explicitly stated in the drawings (not inferred), record where it was found.",
        items: {
          type: "object",
          required: ["field", "pageIndex", "excerpt"],
          properties: {
            field: { type: "string", description: "The buildingElements key e.g. 'studSpacing', 'roofPitch'" },
            pageIndex: { type: "integer", description: "1-based page number where found" },
            excerpt: { type: "string", description: "Verbatim text from the drawing, max 120 chars" },
          },
        },
      },
      estimatedTrades: {
        type: "array",
        description: "Trade quantities for structure, framing, roof, external envelope only.",
        items: {
          type: "object",
          required: ["trade", "quantity", "unit", "confidence", "rateId"],
          properties: {
            trade: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            confidence: { type: "number" },
            rateId: { type: "string" },
            notes: { type: "string" },
            materialSpec: { type: "string" },
            nccRef: { type: "string" },
          },
        },
      },
      pendingItems: {
        type: "array",
        description: "Structural items visible on plans but without a matching rate ID.",
        items: {
          type: "object",
          required: ["description", "estimatedQuantity", "unit", "reason"],
          properties: {
            description: { type: "string" },
            estimatedQuantity: { type: "number" },
            unit: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
    },
  },
};

// ─── TRADES-ONLY TOOL (interior and services passes) ─────────────────────────

const TRADES_TOOL = {
  name: "submit_trades",
  description: "Submit trade quantities for the specified category.",
  input_schema: {
    type: "object",
    required: ["estimatedTrades"],
    properties: {
      estimatedTrades: {
        type: "array",
        items: {
          type: "object",
          required: ["trade", "quantity", "unit", "confidence", "rateId"],
          properties: {
            trade: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            confidence: { type: "number" },
            rateId: { type: "string" },
            notes: { type: "string" },
            materialSpec: { type: "string" },
            nccRef: { type: "string" },
          },
        },
      },
      pendingItems: {
        type: "array",
        description: "Items in this category visible on plans but without a matching rate ID.",
        items: {
          type: "object",
          required: ["description", "estimatedQuantity", "unit", "reason"],
          properties: {
            description: { type: "string" },
            estimatedQuantity: { type: "number" },
            unit: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
    },
  },
};

// ─── FOCUSED SYSTEM PROMPTS ───────────────────────────────────────────────────

const BASE_PROMPT = `You are a senior Australian construction estimator. Analyse ALL of these plan images carefully.

=== THIS PASS: SPATIAL DATA + STRUCTURE + FRAMING + ROOF + EXTERNAL ENVELOPE ===

STEP 1 — READ ALL PAGES FIRST
Before extracting anything, scan every page. Identify: title blocks (scale, NCC class, address), dimension strings, room area annotations, north points, material legends, schedule pages.

STEP 2 — EXTRACT SPATIAL DATA
- Every habitable room: name, area m², level. Read area annotations directly where visible. Never double-count across pages.
- Openings: count internal doors (quarter-circle arc only — NOT wardrobe/robe/storage/garage doors), external doors, windows. Use door/window SCHEDULE if present — it overrides visual counts.
- totalFloorArea = habitable area only (exclude garage, carport, alfresco, balcony).
- projectType: "residential" / "commercial" / "industrial" / "mixed_use"
- constructionOverview: one sentence (frame type, cladding, roof, foundation, storeys)
- 6-8 scope highlights (builder's brief)
- Up to 5 risk items
- Up to 5 key assumptions
- buildingElements: structureType, wallHeight, studSpacing, roofType, roofCover, roofPitch, foundationType, climateZone, ceilingRValue, wallRValue, externalCladding, wetAreas

NCC climate zones: 1=Darwin/Cairns, 2=Brisbane, 3=Alice Springs, 4=Perth, 5=Sydney, 6=Melbourne, 7=Ballarat, 8=Alpine.
NCC R-value requirements by zone — ceiling/wall: Z1→R3.2/R0.5, Z2→R3.2/R1.3, Z3→R3.8/R2.8, Z4→R3.8/R2.8, Z5→R4.1/R2.8, Z6→R6.3/R2.8, Z7→R6.3/R2.8, Z8→R7.3/R4.6.

STEP 3 — EXTRACT TRADE QUANTITIES (structure + framing + roof + envelope ONLY)

CONFIDENCE RULE: 0.95+ = dimension string directly read | 0.85-0.94 = calculated from readable strings | 0.70-0.84 = derived from floor area ratios | 0.50-0.69 = visual estimate (add note "Verify dimensions") | below 0.50 = put in pendingItems, NOT estimatedTrades.

ANTI-DUPLICATION: Each rateId appears EXACTLY ONCE. Aggregate all floors. Do NOT use both carp-001 and carp-011 — choose ONE (carp-011 m² preferred).

AVAILABLE RATE IDs FOR THIS PASS:
STRUCTURE / CONCRETE:
  conc-001  Concreter | Slab Pour & Finish | m²  (ground floor area incl. garage if concrete floor)
  conc-003  Concreter | Footings Strip | lm  (estimate from building perimeter)
  conc-005  Concreter | Industrial Hardstand 150mm | m²  (industrial/warehouse only)
  conc-006  Concreter | Tilt-Up Concrete Panel | m²  (tilt-panel construction only)
  steel-001  Structural Steel | Portal Frame Supply & Erect | m²  (industrial/commercial)
  steel-002  Structural Steel | Columns & Beams | tonne  (commercial structural steel)
  site-001  Excavation | Earthworks | m³  (site cut/fill if shown on site plan)
FRAMING:
  carp-011  Carpenter | Wall Framing | m²  (PREFERRED — total wall face area both sides: floor_area × 0.8 × wall_height × 2)
  carp-002  Carpenter | Roof Framing Conventional | m²  (cut roof: floor_area × pitch_factor)
  carp-003  Carpenter | Roof Framing Truss | m²  (trussed roof: floor_area × pitch_factor)
  carp-004  Carpenter | Floor Frame Timber | m²  (suspended timber floor only)
ROOFING:
  roof-001  Roofer | Roof Installation Metal | m²  (Colorbond — area = floor_area × pitch_factor)
  roof-002  Roofer | Roof Installation Tiles | m²  (concrete/terracotta tiles)
  roof-003  Roofer | Guttering Install | lm  (estimate: perimeter = sqrt(floor_area) × 4)
  roof-004  Roofer | Downpipes Install | lm  (estimate: guttering_lm × 0.5)
  roof-005  Roofer | Fascia & Barge Install | lm  (estimate: guttering_lm × 1.1)
EXTERNAL ENVELOPE / CLADDING:
  brick-001  Bricklayer | Bricklaying Standard | m²  (face brick external walls)
  brick-002  Bricklayer | Bricklaying Feature | m²  (feature/textured brick)
  brick-003  Bricklayer | Block Work Standard | m²  (concrete blocks)
  clad-001  Cladding Installer | Weatherboard Installation | m²
  clad-002  Cladding Installer | FC Sheet Cladding | m²
  clad-003  Cladding Installer | Brick Veneer | m²
  plas-004  Plasterer | Render External Acrylic | m²  (rendered external walls)
INSULATION:
  insul-001  Insulation Installer | Ceiling Batts R2.5 | m²  (= totalFloorArea)
  insul-002  Insulation Installer | Wall Batts R2.0 | m²  (external wall area)
  insul-003  Insulation Installer | Ceiling Batts R4.0 | m²  (use this for zones 5-8 instead of insul-001)
PRELIMINARIES:
  prelim-003  Preliminaries | Site Supervision | wk  (estimate weeks from project size: 1-2 for reno, 4-8 for new build)
  prelim-004  Preliminaries | Temporary Fencing | lm  (site perimeter — from site plan)

PENDING ITEMS: Put in pendingItems if visible on plans but no rate ID applies:
- Retaining walls (structural masonry/concrete) — no standard residential rate
- Basement/podium structure, suspended slab — specialist quote
- Piling or deep footings — specialist quote
- LGS (light gauge steel) stud framing — no rate ID
- Insulated roof panel systems (not standard Colorbond) — specialist quote

ELEMENT SOURCES (critical — populate for every buildingElements field you read directly from the drawings):
For each value that appears as text on the plan (NOT inferred from address, ratios, or NCC tables), add an entry to elementSources:
  { "field": "<buildingElements key>", "pageIndex": <1-based page number>, "excerpt": "<verbatim text, max 120 chars>" }
Examples of values to SOURCE (they appear as notes/labels on drawings):
  - studSpacing: "TIMBER FRAMING: 90x45 MGP10 @ 450mm c/c" → field='studSpacing', excerpt=that text
  - roofPitch: "PITCH: 3°" or "SKILLION ROOF 3 DEGREES" → field='roofPitch'
  - wallHeight: "F.F.L TO U.F.L = 2740" or "Wall Ht = 2.74m" → field='wallHeight'
  - foundationType: "300 THICK RAFT SLAB" or "SLAB ON GROUND" → field='foundationType'
  - roofCover: "COLORBOND STEEL ROOFING" → field='roofCover'
  - roofType: "SKILLION ROOF" or "HIP ROOF" → field='roofType'
  - externalCladding: "WEATHERBOARD CLADDING" or "FC SHEET EXTERNAL" → field='externalCladding'
  - studSize / timberGrade: read from framing notes or specification page
  - structureType: "TIMBER FRAME CONSTRUCTION" → field='structureType'
DO NOT add elementSources entries for: climateZone (inferred from address), ceilingRValue/wallRValue (derived from NCC table), wetAreas (inferred from room types).
Only include what is explicitly written on the drawings.

Now call submit_base with all spatial data and these trade quantities.`;

// ─────────────────────────────────────────────────────────────────────────────

const INTERIOR_PROMPT = `You are a senior Australian construction estimator. Analyse ALL of these plan images.

=== THIS PASS: OPENINGS + INTERIOR FINISHES + WET AREAS + CABINETRY ===

ONLY extract trade quantities for the categories listed below. Do NOT include structural, framing, roofing, or services items.

CONFIDENCE RULE: 0.95+ = counted directly from schedule | 0.85+ = counted from floor plan | 0.7 = derived from room count/area ratios | below 0.5 = put in pendingItems.

DOOR COUNTING (critical):
- Internal doors: quarter-circle arc symbols ONLY. Each unique arc = 1 door. Tags (D1, D2…) are identifiers not counts.
- Exclude: wardrobe doors, robe doors, linen, storage, garage roller doors.
- Scale check: 3-bed house = 8-14 doors, 4-bed double storey = 14-20 doors.
- WINDOW counting: parallel lines breaking wall = 1 window. Sliding glass doors = EXTERNAL DOORS, not windows.
- Use door/window SCHEDULE page if present — it overrides all visual counting (set confidence 0.95).

AVAILABLE RATE IDs FOR THIS PASS:
CARPENTRY FIT-OUT / OPENINGS:
  carp-006  Carpenter | Door Hang Internal | ea  (hollow core, internal doors only)
  carp-007  Carpenter | Door Hang External | ea  (solid timber/composite external doors)
  carp-008  Carpenter | Window Frame Install | ea  (aluminium window frames)
  carp-009  Carpenter | Skirting & Architraves | lm  (estimate: sqrt(totalFloorArea) × 16)
  carp-010  Carpenter | Cornice Install | lm  (estimate: sqrt(totalFloorArea) × 16)
  carp-005  Carpenter | Deck Construction Timber | m²  (timber deck — if visible on plans)
  perg-001  Carpentry | Insulated Panel Pergola | m²  (insulated panel pergola only)
  perg-003  Carpentry | Pergola Open Top Pine | m²  (open timber pergola only)
INTERIOR LININGS:
  plas-001  Plasterer | Plasterboard Ceiling | m²  (= totalFloorArea)
  plas-002  Plasterer | Plasterboard Walls | m²  (both sides: floor_area × 0.8 × 2.7 × 2)
  plas-003  Plasterer | Plasterboard Stop & Set | m²  (= plas-001 + plas-002)
  plas-005  Plasterer | Cornice 90mm | lm  (= carp-010 estimate)
PAINTING:
  paint-001  Painter | Interior Walls 2 Coats | m²  (= plas-002 area)
  paint-002  Painter | Ceiling Paint 2 Coats | m²  (= totalFloorArea)
  paint-003  Painter | Exterior Walls 2 Coats | m²  (external wall area = perimeter × wall_height)
  paint-004  Painter | Door Paint Both Sides | ea  (= total door count)
  paint-005  Painter | Window Frame Paint | ea  (= window count)
FLOOR FINISHES:
  floor-001  Flooring Installer | Carpet Supply & Lay | m²  (bedrooms + living if carpet shown)
  floor-002  Flooring Installer | Floating Floor Supply & Lay | m²  (hallways + open plan if noted)
WET AREAS & CABINETRY:
  tile-001  Tiler | Floor Tiling Supply & Install | m²  (wet area floors + kitchen + laundry)
  tile-002  Tiler | Wall Tiling Supply & Install | m²  (bathroom walls: bathrooms × 10m² avg)
  tile-003  Tiler | Shower Recess Tiling | ea  (= shower count)
  tile-004  Tiler | Splashback Kitchen | lm  (kitchen bench length, typically 4-6 lm)
  wproof-001  Waterproofer | Shower Waterproofing | ea  (= shower count, NCC F2.2)
  cab-001  Cabinetmaker | Kitchen Standard | lm  (kitchen bench run — measure from floor plan)
  cab-002  Cabinetmaker | Vanity Custom | ea  (bathrooms + ensuites)
  cab-003  Cabinetmaker | Built-in Wardrobe | lm  (bedrooms × 1.8 lm average)
COMMERCIAL CEILINGS:
  susc-001  Suspended Ceilings | Grid & Tile 600x600 | m²  (commercial office/retail only)
  susc-002  Suspended Ceilings | Plasterboard Suspended | m²  (commercial — FRL zones, corridors)

PENDING ITEMS for this category:
- Aluminium bifold doors, stacker doors (> 2 panels) — no standard door hang rate
- Garage roller doors — no rate ID
- Custom stone/caesarstone benchtops — no rate ID
- Butler's pantry full fit-out — no rate ID
- Pool/spa, water feature — no rate ID
- Specialty floor finishes (polished concrete, vinyl plank over 200m²) — no rate ID

Call submit_trades with these trade quantities only.`;

// ─────────────────────────────────────────────────────────────────────────────

const SERVICES_PROMPT = `You are a senior Australian construction estimator. Analyse ALL of these plan images.

=== THIS PASS: ELECTRICAL + PLUMBING + HVAC + FIRE SERVICES + EXTERNAL WORKS ===

ONLY extract trade quantities for the categories below. Do NOT include structural, framing, interior finish, or wet area items.

CONFIDENCE RULE: 0.85+ = counted directly from plans/schedules | 0.7 = derived from room count ratios | below 0.5 = pendingItems.

AVAILABLE RATE IDs FOR THIS PASS:
ELECTRICAL:
  elec-001  Electrician | Power Point Install | ea  (bedrooms×4 + living/dining×6 + kitchen×8 + others×3)
  elec-002  Electrician | Light Point Install | ea  (rooms × 2 average)
  elec-003  Electrician | Switch Install | ea  (light_points × 0.8)
  elec-004  Electrician | Downlight Install | ea  (kitchen + wet area ceilings, if downlights common)
  elec-005  Electrician | Exhaust Fan Install | ea  (bathrooms + ensuites + laundry)
  elec-006  Electrician | Switchboard Install | ea  (1 per dwelling/tenancy)
  elec-007  Electrician | Meter Box Install | ea  (1 per dwelling — new build)
  elec-008  Electrician | Smoke Alarm Install | ea  (bedrooms + living areas, NCC Vol 2 G3)
PLUMBING:
  plum-001  Plumber | Rough-in Complete House | m²  (= totalFloorArea)
  plum-002  Plumber | Toilet Installation | ea  (WC + bathrooms with toilets)
  plum-003  Plumber | Vanity & Basin Install | ea  (bathrooms + ensuites)
  plum-004  Plumber | Kitchen Sink Install | ea  (1 per kitchen)
  plum-005  Plumber | Hot Water System Gas | ea  (if gas HWS noted/likely)
  plum-006  Plumber | Hot Water System Electric | ea  (if electric HWS or no gas)
  plum-007  Plumber | Rainwater Tank 5000L | ea  (if tank shown on site plan)
  plum-008  Plumber | Gas Line Installation | lm  (if gas service shown — estimate from plan)
HVAC / MECHANICAL:
  hvac-001  Mechanical | Split System Air Con | ea  (if split systems noted/marked on plans)
  mech-001  Mechanical | Ducted HVAC System | m²  (commercial/large residential with ducted AC)
FIRE SERVICES (commercial/industrial):
  fire-001  Fire Services | Wet Pipe Sprinkler System | m²  (commercial >2000m² or NCC Spec C1.10)
  fire-002  Fire Services | Fire Detection & Alarm | m²  (all commercial, NCC AS 1670)
  fire-003  Fire Services | Fire Hose Reel | ea  (1 per 800m² of floor area)
  fire-004  Fire Services | Portable Fire Extinguisher | ea  (1 per 200m² plus 1 per exit)
EXTERNAL WORKS:
  conc-002  Concreter | Driveway Concrete | m²  (measure from site plan — typical 3m wide)
  conc-004  Concreter | Concrete Path | m²  (paths/paving from site plan)
  land-001  Landscaper | Turf Laying | m²  (lawn areas from site plan)
  land-002  Landscaper | Retaining Wall Sleeper | m²  (timber sleeper retaining walls)
  land-003  Landscaper | Paving Supply & Lay | m²  (pavers: alfresco, entertaining)
  land-005  Landscaper | Fence Panel Colorbond | lm  (boundary fencing from site plan)
  land-006  Landscaping | Turf Supply & Lay | m²  (includes grading and preparation)
  land-008  Landscaping | Tree/Large Plant Removal | ea  (if site clearing noted)
  prelim-001  Preliminaries | Skip Bin 6m³ | ea  (1-2 per renovation)
  prelim-002  Preliminaries | Skip Bin 9m³ | ea  (1-2 for new build or large reno)
  prelim-006  Preliminaries | Bond Clean | ea  (1 per project on completion)

PENDING ITEMS for this category:
- Solar PV system, battery storage, EV charging — specialist quote, no rate ID
- CCTV, security system, structured data/comms cabling — no rate ID
- Commercial kitchen extract ventilation — no rate ID
- Industrial evaporative cooling / mechanical ventilation — no rate ID
- Swimming pool, spa, water feature — no rate ID
- Significant site earthworks / cut-and-fill requiring geotechnical — no rate ID
- External lighting (decorative/feature) — no rate ID

Call submit_trades with these trade quantities only.`;

// ─── FULL ANALYSIS RATE REFERENCE (used for legacy no-focusCategory path) ────

const RATE_REFERENCE = `
AVAILABLE RATE IDs (use EXACTLY as written):
FRAMING:
  carp-001  Carpenter | Wall Framing 90mm | lm
  carp-011  Carpenter | Wall Framing | m²
  carp-002  Carpenter | Roof Framing Conventional | m²
  carp-003  Carpenter | Roof Framing Truss | m²
  carp-004  Carpenter | Floor Frame Timber | m²
CARPENTRY FIT-OUT:
  carp-006  Carpenter | Door Hang Internal | ea
  carp-007  Carpenter | Door Hang External | ea
  carp-008  Carpenter | Window Frame Install | ea
  carp-009  Carpenter | Skirting & Architraves | lm
  carp-010  Carpenter | Cornice Install | lm
  carp-005  Carpenter | Deck Construction Timber | m²
ELECTRICAL:
  elec-001  Electrician | Power Point Install | ea
  elec-002  Electrician | Light Point Install | ea
  elec-003  Electrician | Switch Install | ea
  elec-004  Electrician | Downlight Install | ea
  elec-005  Electrician | Exhaust Fan Install | ea
  elec-006  Electrician | Switchboard Install | ea
  elec-008  Electrician | Smoke Alarm Install | ea
PLUMBING:
  plum-001  Plumber | Rough-in Complete House | m²
  plum-002  Plumber | Toilet Installation | ea
  plum-003  Plumber | Vanity & Basin Install | ea
  plum-004  Plumber | Kitchen Sink Install | ea
  plum-005  Plumber | Hot Water System Gas | ea
PLASTERING / PLASTERBOARD:
  plas-001  Plasterer | Plasterboard Ceiling | m²
  plas-002  Plasterer | Plasterboard Walls | m²
  plas-003  Plasterer | Plasterboard Stop & Set | m²
  plas-004  Plasterer | Render External Acrylic | m²
  plas-005  Plasterer | Cornice 90mm | lm
PAINTING:
  paint-001  Painter | Interior Walls 2 Coats | m²
  paint-002  Painter | Ceiling Paint 2 Coats | m²
  paint-003  Painter | Exterior Walls 2 Coats | m²
  paint-004  Painter | Door Paint Both Sides | ea
  paint-005  Painter | Window Frame Paint | ea
TILING:
  tile-001  Tiler | Floor Tiling Supply & Install | m²
  tile-002  Tiler | Wall Tiling Supply & Install | m²
  tile-003  Tiler | Shower Recess Tiling | ea
  tile-004  Tiler | Splashback Kitchen | lm
CONCRETING:
  conc-001  Concreter | Slab Pour & Finish | m²
  conc-003  Concreter | Footings Strip | lm
ROOFING:
  roof-001  Roofer | Roof Installation Metal | m²
  roof-002  Roofer | Roof Installation Tiles | m²
  roof-003  Roofer | Guttering Install | lm
  roof-004  Roofer | Downpipes Install | lm
  roof-005  Roofer | Fascia & Barge Install | lm
BRICKLAYING:
  brick-001  Bricklayer | Bricklaying Standard | m²
  brick-003  Bricklayer | Block Work Standard | m²
CLADDING:
  clad-001  Cladding Installer | Weatherboard Installation | m²
  clad-002  Cladding Installer | FC Sheet Cladding | m²
INSULATION:
  insul-001  Insulation Installer | Ceiling Batts R2.5 | m²
  insul-002  Insulation Installer | Wall Batts R2.0 | m²
  insul-003  Insulation Installer | Ceiling Batts R4.0 | m²
WATERPROOFING:
  wproof-001  Waterproofer | Shower Waterproofing | ea
CABINETRY:
  cab-001  Cabinetmaker | Kitchen Standard | lm
  cab-002  Cabinetmaker | Vanity Custom | ea
  cab-003  Cabinetmaker | Built-in Wardrobe | lm
PRELIMINARIES:
  prelim-001  Preliminaries | Skip Bin 6m³ | ea
  prelim-003  Preliminaries | Site Supervision | wk
  prelim-004  Preliminaries | Temporary Fencing | lm
COMMERCIAL — SUSPENDED CEILINGS:
  susc-001  Suspended Ceilings | Grid & Tile 600x600 | m²
  susc-002  Suspended Ceilings | Plasterboard Suspended | m²
COMMERCIAL — MECHANICAL (HVAC):
  mech-001  Mechanical | Ducted HVAC System | m²
  mech-002  Mechanical | Split System Air Con | ea
COMMERCIAL — STRUCTURAL STEEL:
  steel-001  Structural Steel | Portal Frame Supply & Erect | m²
  steel-002  Structural Steel | Columns & Beams | tonne
COMMERCIAL — FIRE SERVICES:
  fire-001  Fire Services | Wet Pipe Sprinkler System | m²
  fire-002  Fire Services | Fire Detection & Alarm | m²
  fire-003  Fire Services | Fire Hose Reel | ea
  fire-004  Fire Services | Portable Fire Extinguisher | ea
INDUSTRIAL — CONCRETE:
  conc-005  Concreter | Industrial Hardstand 150mm Heavy Duty | m²
  conc-006  Concreter | Tilt-Up Concrete Panel | m²
COMMERCIAL — GLAZING:
  glazing-001  Glazier | Commercial Aluminium Glazing | m²
  glazing-002  Glazier | Shopfront Aluminium Glazing | m²
`;

const SYSTEM_PROMPT = `You are a senior Australian construction estimator and certified quantity surveyor with 20+ years reading architectural, structural, and services drawings across residential, commercial, and industrial projects. You will be given one or more images of a construction document set. Analyse EVERY image carefully before responding.

=== PRE-ANALYSIS PROTOCOL ===

Before extracting quantities, mentally inventory EVERY page in order:
1. Title blocks — read the scale, NCC class, address, date, project name
2. Dimension strings — always USE THESE first; they are more accurate than any estimation
3. Room area annotations — if areas are printed inside rooms (e.g. "12.5 m²"), READ and USE them directly, do NOT re-estimate
4. Scale bars — use to calibrate visual measurements
5. Material notes and legends — identify cladding, roof, floor finish
6. North point — orientation helps identify front/rear elevations
7. Grid references (commercial/industrial) — column grid spacing reveals structural bay sizes
8. Notes and specifications — text notes override visual inference
9. Schedule pages (door/window/finish) — authoritative counts, override visual counting

=== MEASUREMENT ACCURACY — STRICT PROTOCOL ===

Confidence levels based on information available:
- 0.95+: Dimension string or area annotation directly read from the drawing
- 0.85-0.94: Derived by calculation from readable dimension strings (e.g. room width × height = wall area)
- 0.70-0.84: Derived from readable floor area using the standard ratio formulas below
- 0.50-0.69: Visual estimation only — no readable dimensions — ALWAYS add a note "Dimension not readable — verify on site"
- Below 0.50: Do NOT include in estimatedTrades — put in pendingItems with reason "Dimension not readable on provided drawings"

NO GUESSING RULE: If a quantity cannot be reliably derived from the drawings with confidence ≥ 0.50, put it in pendingItems, not estimatedTrades. Never invent a dimension. It is better to put something in pendingItems than to guess a wrong quantity.

SCALE CONVERSION RULE:
- Scale 1:100: 10mm on plan = 1.0m actual
- Scale 1:200: 10mm on plan = 2.0m actual
- Scale 1:500: 10mm on plan = 5.0m actual
If a scale is stated, USE IT for all dimension estimates. If you can read printed dimension strings, use those DIRECTLY.

TRADE SEPARATION RULE: Each trade item in estimatedTrades must be a SEPARATE entry with its own rateId. Never combine multiple rateIds into a single entry. List EVERY relevant trade for this project individually — a comprehensive residential estimate should have 25-40+ separate trade entries.

=== STEP 0 — PROJECT TYPE CLASSIFICATION ===

Classify the project type FIRST before any other analysis. This determines which knowledge base and formulas to apply.

RESIDENTIAL (Class 1a, 1b, 2):
Indicators: bedroom labels, bathrooms, kitchen, living room, laundry, garage, granny flat, "Bed 1/2/3", "Ensuite", "WIR", "Alfresco". Scale typically 1:100–1:200. NCC Volume 2 applies.
Common plan types: single-storey house, double-storey house, duplex, townhouse, unit, apartment.

COMMERCIAL (Class 3, 5, 6, 7a, 9):
Indicators: "OFFICE", "RECEPTION", "MEETING ROOM", "RETAIL", "CAFÉ", "SERVER ROOM", "PLANT ROOM", "LOBBY", "AMENITIES", "WC" (without bedrooms), NCC Class 5/6/9 in title block. Scale typically 1:200–1:500. NCC Volume 1 applies.
Common plan types: office fitout, retail shop, medical centre, café, restaurant, school, hotel, childcare.

INDUSTRIAL (Class 7b, 8):
Indicators: "WAREHOUSE", "FACTORY", "WORKSHOP", "LOADING DOCK", "FORKLIFT AREA", large clear-span areas without rooms, portal frame spacings (e.g. 7500mm bays), "CIH" (clear internal height), industrial equipment shown. Scale typically 1:200–1:1000.
Common plan types: warehouse, distribution centre, manufacturing, cold storage, workshop.

MIXED_USE: Combination of residential above commercial, or retail/office components within primarily residential.

Set the projectType field to: "residential", "commercial", "industrial", or "mixed_use".

STEP 1 — CLASSIFY EACH PAGE
Identify what each image shows: floor-plan (state which level), elevation (state which direction), site-plan, roof-plan, section, schedule (door/window/finish), specification, detail, title-page, or other.

STEP 2 — EXTRACT FROM FLOOR PLANS
For EACH floor plan image:
- List every habitable room with its approximate area in m²
- Read dimension strings or room area annotations where visible — USE THESE directly
- Count INTERNAL PASSAGE DOORS only (quarter-circle arc symbol). Exclude wardrobe/robe doors, linen cupboards, storage doors, garage roller doors.
- Count WINDOWS (parallel lines breaking a wall). Sliding glass doors count as external doors, not windows.
- If a door/window SCHEDULE page is present, use those counts instead of visual counts — schedules are authoritative.
- If multiple storey floor plans appear, SUM the floor areas (do NOT count the same storey twice if it repeats across pages).
- totalFloorArea = habitable area only (exclude garage, carport, alfresco, balcony).

STEP 3 — DERIVE TRADE QUANTITIES

=== RESIDENTIAL TRADES ===

FRAMING (from floor plan perimeter + wall height):
- Wall framing m² = total internal wall face area (estimate: floor area × 0.8 × wall height 2.7m for GF, × 0.6 for upper)
- Roof framing m² = totalFloorArea × pitch factor (1.25 for low pitch, 1.4 for medium, 1.55 for steep)
- Choose carp-002 (conventional) vs carp-003 (truss) based on visible roof plan or notes

PLASTERBOARD (wall area = wall framing m²; ceiling = floor area):
- plas-001 Ceiling = totalFloorArea
- plas-002 Walls = wall framing area (both sides if internal partition)
- plas-003 Stop & Set = same m² as plas-002 + plas-001

PAINTING:
- paint-001 Interior Walls = same as plas-002 (wall m²)
- paint-002 Ceiling = totalFloorArea
- paint-003 Exterior Walls = external wall perimeter × wall height (estimate from plan)
- paint-004 Doors = total door count
- paint-005 Windows = total window count

CONCRETE:
- conc-001 Slab = ground floor area (including garage if concrete floor shown)

ROOFING:
- Choose roof-001 (metal/Colorbond) or roof-002 (tile) based on notes or context
- roof-003 Guttering lm = building perimeter (approx sqrt(totalFloorArea) × 4)
- roof-004 Downpipes lm = guttering lm × 0.5
- roof-005 Fascia & Barge = guttering lm × 1.1

ELECTRICAL (from room count):
- elec-001 Power points = bedrooms × 4 + living/dining × 6 + kitchen × 8 + other rooms × 3
- elec-002 Light points = total rooms × 2 (average)
- elec-003 Switches = light points × 0.8
- elec-004 Downlights = kitchen area + ensuite area × 2 (if downlights visible/common)
- elec-005 Exhaust fans = bathrooms + ensuites + WC count
- elec-006 Switchboard = 1 per dwelling
- elec-008 Smoke alarms = bedrooms + living areas

PLUMBING (from bathroom/kitchen count):
- plum-001 Rough-in = totalFloorArea (m²)
- plum-002 Toilets = bathrooms + ensuites + separate WC count
- plum-003 Vanity = bathrooms + ensuites count
- plum-004 Kitchen sink = 1 per kitchen
- plum-005 Hot water = 1 per dwelling

TILING (from wet area count):
- tile-001 Floor tiles = sum of wet area floors (bathroom, ensuite, laundry, kitchen, alfresco if tiled)
- tile-002 Wall tiles = bathrooms × 10 m² + kitchen splashback height × bench lm
- tile-003 Shower recess = ensuites + bathrooms with showers
- tile-004 Kitchen splashback lm = kitchen bench length (estimate 4–6 lm typical)

CABINETRY:
- cab-001 Kitchen = bench length in lm (estimate from kitchen room width: typical 3.5–5 lm)
- cab-002 Vanity = bathrooms + ensuites count
- cab-003 Built-in Wardrobe = bedroom count × 1.8 lm average

WATERPROOFING:
- wproof-001 Shower = same as tile-003 count

INSULATION:
- insul-001 or insul-003 Ceiling batts = totalFloorArea
- insul-002 Wall batts = external wall area (estimate from perimeter × wall height)

CLADDING or BRICKWORK:
- Choose brick-001, clad-001 (weatherboard), or clad-002 (FC sheet) based on visible material notes

CARPENTRY FIT-OUT:
- carp-006 Internal doors = openings.internalDoors count
- carp-007 External doors = openings.externalDoors count
- carp-008 Windows = openings.windows count
- carp-009 Skirting lm = total room perimeter (estimate: sqrt(totalFloorArea) × 16)
- carp-010 Cornice lm = same as skirting estimate

STEP 4 — QUALITY CHECKS
- Every quantity must be a positive number. Use 0 only if genuinely absent.
- confidence 0.9+ = directly measured/counted from dimension strings or schedules; 0.7–0.89 = derived from plan with good accuracy; 0.5–0.69 = estimated from floor area ratios; below 0.5 = rough approximation.
- If a schedule page exists for doors or windows, set confidence to 0.95 for those counts.
- Do NOT include the same trade twice with different rateIds unless they are genuinely separate work items.
- notes array: record project type, number of storeys, any unusual construction, scale if stated, scan quality.

STEP 5 — SCOPE REPORT

MATERIAL SPECIFICATIONS: For each trade in estimatedTrades add a materialSpec with a brief precise spec note (under 15 words).

NCC REFERENCES: Add nccRef only where directly applicable.

CONSTRUCTION OVERVIEW: One sentence — frame type, cladding, roof type, foundation, storeys.

SCOPE HIGHLIGHTS: 6-8 concise scope-of-works statements a builder would use to brief subcontractors.

RISK ITEMS: Up to 5 items affecting estimate quality or project cost.

ASSUMPTIONS: Up to 5 key assumptions underpinning the quantities.

${RATE_REFERENCE}

STEP 6 — BUILDING ELEMENTS & NCC COMPLIANCE (populate buildingElements)

FRAMING SPECIFICATION (residential):
- Default: 600mm c/c for single-storey; 450mm c/c for upper floor or high wind zone (N2+)
- studSize: "90x45" standard; "70x45" light partitions; "140x45" wet wall or cold climate
- timberGrade: "MGP10" standard; "MGP12" engineered or high-load

NCC 2022 CLIMATE ZONE INSULATION REQUIREMENTS (Vol 2 Part H6.3):
| Zone | Typical locations                      | Min Ceiling R | Min Wall R |
|------|----------------------------------------|---------------|------------|
| 1    | Darwin, Cairns, Broome, Townsville     | R3.2          | R0.5       |
| 2    | Brisbane, Gold Coast, Bundaberg        | R3.2          | R1.3       |
| 3    | Alice Springs, Longreach, Broken Hill  | R3.8          | R2.8       |
| 4    | Perth, Geraldton, Port Augusta         | R3.8          | R2.8       |
| 5    | Sydney, Newcastle, Wollongong, ACT     | R4.1          | R2.8       |
| 6    | Melbourne, Canberra, Launceston        | R6.3          | R2.8       |
| 7    | Ballarat, Ararat, Daylesford           | R6.3          | R2.8       |
| 8    | Alpine areas (Mt Buller, Thredbo)      | R7.3          | R4.6       |

ANTI-DUPLICATION RULE (critical — strictly enforced):
- Each rateId may appear EXACTLY ONCE in estimatedTrades. No exceptions.
- Aggregate quantities across ALL floors into a SINGLE entry per rateId.
- Do NOT include both carp-001 (Wall Framing lm) AND carp-011 (Wall Framing m²). Choose ONE (m² preferred).

PENDING ITEMS (critical — use this for items without a matching rate ID):
If you identify a construction element that is clearly visible on the plans but has NO matching rateId in the AVAILABLE RATE IDs list, put it into pendingItems.

Common items that belong in pendingItems:
- Swimming pool, spa, pond, water feature
- Solar PV system, battery storage, EV charging
- Retaining walls (structural masonry or concrete)
- Aluminium bifold doors, stacker doors
- Skylights, roof windows
- Lift / elevator installation
- External sheds, garages (separate structure)
- Bulk earthworks requiring geotechnical

DOOR COUNTING (critical):
- Each UNIQUE door opening counted ONCE. Quarter-circle arc = 1 door.
- Tags (D1, D2, D3…) are identifiers not counts.
- Do NOT count: wardrobe doors, robe doors, linen press, storage, garage roller doors.

WINDOW COUNTING:
- Windows = parallel lines breaking a wall. Each unique symbol counted once.
- Glass sliding doors count as external doors, NOT windows.

Now call the submit_analysis tool with your complete findings.`;

// ─── PAGE INPUT TYPE ──────────────────────────────────────────────────────────

interface PageInput {
  pageIndex: number;
  imageBase64: string;
  mediaType?: string;
}

// ─── SERVE HANDLER ────────────────────────────────────────────────────────────

serve(async (req) => {
  const cors = getCors(req.headers.get("origin") ?? "");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization header is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Admin bypass — owner always has access regardless of subscription row
    const OWNER_EMAIL = "yannlb1990@gmail.com";
    if (user.email !== OWNER_EMAIL) {
      const { data: sub, error: subError } = await supabase
        .from("subscriptions")
        .select("plan_id, status")
        .eq("user_id", user.id)
        .maybeSingle();

      const hasAccess =
        !subError &&
        sub !== null &&
        sub.status === "active" &&
        (sub.plan_id === "pro" || sub.plan_id === "business");

      if (!hasAccess) {
        return new Response(JSON.stringify({ error: "Plan upgrade required" }), {
          status: 403,
          headers: { ...cors, "content-type": "application/json" },
        });
      }
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const body = await req.json();
    const { pages, imageBase64, projectContext, focusCategory, isScanned } = body as {
      pages?: PageInput[];
      imageBase64?: string;
      projectContext?: object;
      focusCategory?: 'base' | 'interior' | 'services';
      isScanned?: boolean;
    };

    const scannedNote = isScanned
      ? "Note: this is a scanned plan with no text layer — rely entirely on visual recognition of drawn elements, dimensions, room labels, and annotations. Do not expect machine-readable text. Estimate all quantities from visual geometry and standard construction conventions.\n\n"
      : "";

    const contextNote = projectContext
      ? `\n\nProject context: ${JSON.stringify(projectContext)}`
      : "";

    // Build the image content blocks
    let imageBlocks: object[];
    if (pages && pages.length > 0) {
      imageBlocks = pages.map((p) => ({
        type: "image",
        source: {
          type: "base64",
          media_type: p.mediaType ?? "image/jpeg",
          data: p.imageBase64,
        },
      }));
    } else if (imageBase64) {
      // Legacy single-image path
      imageBlocks = [{
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: imageBase64,
        },
      }];
    } else {
      throw new Error("Either 'pages' array or 'imageBase64' is required");
    }

    const pageCount = imageBlocks.length;
    const pageNote = pageCount > 1
      ? `\n\nYou have been given ${pageCount} pages from the document set. Analyse ALL of them before responding.`
      : "";

    // ── Select tool, prompt, and token budget based on focusCategory ──────────
    //
    // focusCategory = 'base'     → spatial data + structure + framing + roof + envelope
    //                             uses BASE_TOOL, outputs full spatial result + base trades
    //                             max_tokens 8000 (20-25 trades + spatial fields)
    //
    // focusCategory = 'interior' → openings + finishes + wet areas + cabinetry
    //                             uses TRADES_TOOL, outputs trades only
    //                             max_tokens 6000 (15-20 trades)
    //
    // focusCategory = 'services' → electrical + plumbing + HVAC + external works
    //                             uses TRADES_TOOL, outputs trades only
    //                             max_tokens 6000 (15-20 trades)
    //
    // no focusCategory           → legacy full-analysis path (backward compat)
    //                             max_tokens 16000

    let selectedTool: object;
    let systemPrompt: string;
    let maxTokens: number;
    let toolName: string;

    if (focusCategory === 'base') {
      selectedTool = BASE_TOOL;
      systemPrompt = scannedNote + BASE_PROMPT;
      maxTokens = 8000;
      toolName = 'submit_base';
    } else if (focusCategory === 'interior') {
      selectedTool = TRADES_TOOL;
      systemPrompt = scannedNote + INTERIOR_PROMPT;
      maxTokens = 6000;
      toolName = 'submit_trades';
    } else if (focusCategory === 'services') {
      selectedTool = TRADES_TOOL;
      systemPrompt = scannedNote + SERVICES_PROMPT;
      maxTokens = 6000;
      toolName = 'submit_trades';
    } else {
      // Legacy full-analysis path — no focusCategory supplied
      selectedTool = ANALYSIS_TOOL;
      systemPrompt = scannedNote + SYSTEM_PROMPT;
      maxTokens = 16000;
      toolName = 'submit_analysis';
    }

    // 130 s hard limit — Supabase kills edge functions at 150 s.
    // Aborting cleanly at 130 s lets us return a helpful error instead of a hard 504.
    // With focused passes each completing in 20-40s this should never fire.
    const abortCtrl = new AbortController();
    const abortTimer = setTimeout(() => abortCtrl.abort(), 130_000);

    let anthropicResponse: Response;
    try {
      anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: abortCtrl.signal,
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          tools: [selectedTool],
          tool_choice: { type: "any" },
          messages: [
            {
              role: "user",
              content: [
                ...imageBlocks,
                {
                  type: "text",
                  text: systemPrompt + contextNote + pageNote,
                },
              ],
            },
          ],
        }),
      });
    } finally {
      clearTimeout(abortTimer);
    }

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      throw new Error(`Anthropic API error: ${anthropicResponse.status} ${errText}`);
    }

    const anthropicData = await anthropicResponse.json();

    // Extract structured result from the correct tool_use block
    const toolUseBlock = anthropicData.content?.find(
      (b: { type: string; name?: string }) => b.type === "tool_use" && b.name === toolName
    ) as { input: object } | undefined;

    if (!toolUseBlock) {
      // Fallback: return raw response so client can attempt its own parsing
      return new Response(JSON.stringify({ raw: anthropicData }), {
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ result: toolUseBlock.input }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const isTimeout = raw.toLowerCase().includes('abort') || raw.toLowerCase().includes('timed out');
    const message = isTimeout
      ? "Analysis took too long. Try uploading fewer pages, or a simpler plan section."
      : raw;
    console.error("[analyse-plan] Error:", raw);
    return new Response(JSON.stringify({ error: message }), {
      status: isTimeout ? 504 : raw === "Unauthorized" ? 401 : 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
