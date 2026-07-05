import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

// Auth is Bearer-token-based, not cookie-based, so wildcard CORS is safe.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getCors(_origin: string) {
  return CORS_HEADERS;
}

// Tool schema — Claude must call this to return the analysis.
// Using tool_use guarantees valid JSON; no regex fallback needed.
const ANALYSIS_TOOL = {
  name: "submit_analysis",
  description: "Submit the complete construction quantity take-off analysis.",
  input_schema: {
    type: "object",
    required: ["rooms", "openings", "totalFloorArea", "estimatedTrades", "notes", "constructionOverview", "scopeHighlights", "riskItems", "assumptions"],
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
        description: "Comprehensive quantity take-off for all relevant trades. Include as many as you can derive with reasonable confidence.",
        items: {
          type: "object",
          required: ["trade", "quantity", "unit", "confidence", "rateId"],
          properties: {
            trade: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            confidence: { type: "number", description: "0.0 to 1.0" },
            rateId: {
              type: "string",
              description: "Rate ID from scopeOfWorkRates.ts — must match exactly one of the provided IDs.",
            },
            notes: { type: "string" },
            materialSpec: {
              type: "string",
              description: "Brief material specification for this trade item. e.g. '90mm pine studs @ 450mm centres, F5 grade' or 'Colorbond Surfmist steel roofing, 0.42 BMT' or '600x600 rectified porcelain tiles'.",
            },
            nccRef: {
              type: "string",
              description: "Most relevant NCC 2022 Volume 2 section for this work item, if applicable. e.g. 'NCC Vol 2 Part 3.4.2' or 'NCC Vol 2 H6.3'. Leave blank if not directly applicable.",
            },
          },
        },
      },
      notes: {
        type: "array",
        description: "Key observations: double storey, alfresco, unusual construction, plan quality, etc.",
        items: { type: "string" },
      },
      constructionOverview: {
        type: "string",
        description: "One concise sentence describing the construction: frame type, external cladding, roof type, foundation, storeys. e.g. 'Timber frame, brick veneer cladding, Colorbond hip roof, concrete slab on ground, single storey, 4 bed 2 bath.'",
      },
      scopeHighlights: {
        type: "array",
        description: "8-12 concise scope-of-works statements covering the major work items in this project, written as a builder's scope checklist. Each item should be one clear sentence.",
        items: { type: "string" },
      },
      riskItems: {
        type: "array",
        description: "Items that increase cost risk or need clarification before finalising an estimate: structural queries, specification gaps, scope ambiguity, unusual features, coordination risks. Each as one sentence.",
        items: { type: "string" },
      },
      assumptions: {
        type: "array",
        description: "Key assumptions underpinning the quantities in this analysis. Each as one sentence.",
        items: { type: "string" },
      },
    },
  },
};

// Rate reference table included in the prompt so Claude can map quantities to IDs.
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
`;

const SYSTEM_PROMPT = `You are a senior Australian construction estimator with 20+ years of experience reading architectural drawings. You will be given one or more images of a construction document set. Analyse EVERY image carefully before responding.

STEP 1 — CLASSIFY EACH PAGE
Identify what each image shows: floor-plan (state which level), elevation (state which direction), site-plan, roof-plan, section, schedule (door/window/finish), specification, detail, title-page, or other.

STEP 2 — EXTRACT FROM FLOOR PLANS
For EACH floor plan image:
- List every habitable room with its approximate area in m²
- Count INTERNAL PASSAGE DOORS only (quarter-circle arc symbol). Exclude wardrobe/robe doors, linen cupboards, storage doors, garage roller doors.
- Count WINDOWS (parallel lines breaking a wall). Sliding glass doors count as external doors, not windows.
- If a door/window SCHEDULE page is present, use those counts instead of visual counts — schedules are authoritative.
- If multiple storey floor plans appear, SUM the floor areas (do NOT count the same storey twice if it repeats across pages).
- totalFloorArea = habitable area only (exclude garage, carport, alfresco, balcony).

STEP 3 — DERIVE TRADE QUANTITIES
Using the extracted data, derive quantities for as many trades as possible. Use professional construction knowledge:

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
- roof-004 Downpipes lm = guttering lm × 0.5 (one per corner, 2.7m each)
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
- tile-001 Floor tiles = sum of wet area floors (bathroom, ensuite, laundry, kitchen, alfresco if tiled — read from rooms)
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

CLADDING or BRICKWORK (from plan or elevations if provided):
- If elevations shown, estimate external wall area from them
- Choose brick-001, clad-001 (weatherboard), or clad-002 (FC sheet) based on visible material notes

CARPENTRY FIT-OUT:
- carp-006 Internal doors = openings.internalDoors count
- carp-007 External doors = openings.externalDoors count
- carp-008 Windows = openings.windows count
- carp-009 Skirting lm = total room perimeter (estimate: sqrt(totalFloorArea) × 16)
- carp-010 Cornice lm = same as skirting estimate

STEP 4 — QUALITY CHECKS
- Every quantity must be a positive number. Use 0 only if genuinely absent (e.g., no deck).
- confidence 0.9+ = directly measured/counted; 0.7–0.89 = derived from plan with good accuracy; 0.5–0.69 = estimated from floor area ratios; below 0.5 = very rough approximation.
- If a schedule page exists for doors or windows, set confidence to 0.95 for those counts.
- Do NOT include the same trade twice with different rateIds unless they are genuinely separate work items.
- notes array: record number of storeys, any alfresco, pool, unusual construction type, plan scale if stated, scan quality.

STEP 5 — SCOPE REPORT (for qualified estimate preparation)

MATERIAL SPECIFICATIONS: For every trade in estimatedTrades, add a materialSpec field with a brief but precise specification note. Examples:
- Wall framing → "90mm MGP10 pine studs @ 600mm centres with top plate, bottom plate and noggings"
- Roof → "Colorbond® Custom Orb 0.42 BMT steel roofing, Windspeed N3 rated" or "300x300mm concrete roof tiles"
- Concrete slab → "100mm reinforced concrete slab on 200mm compacted fill, SL72 mesh"
- Brickwork → "Standard face brick, 10mm mortar joints, Single leaf 110mm"
- Plasterboard → "10mm Gyprock® to ceilings, 10mm Gyprock® to walls, cornice 55mm cove"
- Tiling → "600x600mm rectified porcelain tiles, 1.5mm grout joint" or describe as 'as-specified'
- Cabinetry → "Flat pack kitchen cabinetry, laminate finish, 16mm carcass"
- Electrical → "Standard domestic GPO with 3-core+earth cabling to AS/NZS 3000"
If material is not specified in the plans, note "Specification to be confirmed" or give a typical Australian residential default.

NCC REFERENCES: For each trade item, include the most directly applicable NCC 2022 Volume 2 section where it adds compliance value for the estimator. Key sections:
- Wall framing: NCC Vol 2 Part H1.3 (structural), Part H6.2 (energy)
- Roof framing: NCC Vol 2 Part H1.3
- Concrete slab: NCC Vol 2 Part H1.4 (footings), AS 2870 (residential slabs)
- Waterproofing: NCC Vol 2 Part F2.2 / AS 3740
- Energy (insulation): NCC Vol 2 Part H6 (thermal performance)
- Bushfire: NCC Vol 2 Part H7 if BAL rating evident on plans
- Smoke alarms: NCC Vol 2 Part G3
Only include an nccRef if it is directly relevant to the item. Leave blank for purely finish-level items (painting, cabinetry hardware).

CONSTRUCTION OVERVIEW: Write one sentence covering: frame type (timber/steel), external cladding material, roof type and material, foundation type, number of storeys, and configuration (e.g. "4 bed 2 bath"). If information is missing, note it as "unspecified".

SCOPE HIGHLIGHTS: Write 8-12 concise scope-of-works bullet points that a builder would use to describe the project to a subcontractor. Each should be a clear factual statement, not a sales phrase. Examples:
- "Supply and install 90mm timber wall framing to all internal and external walls, 2.7m ceiling height throughout"
- "Concrete ground floor slab including reinforcement, edge thickening and ant capping"
- "Brick veneer external cladding with 50mm cavity, standard modular brickwork"
- "Colorbond steel roofing to hip roof with concealed fix profile, including gutters and downpipes"

RISK ITEMS: Identify anything that could affect the estimate quality or project cost. Examples of risk items to flag:
- "Soil classification not shown — assume Class M; confirm with site investigation"
- "No window schedule provided — window sizes estimated from floor plan symbols"
- "Roof pitch not stated — pitch factor assumed at 1.3"
- "External cladding material unspecified — priced as brick veneer, confirm before tendering"
- "Retaining walls may be required — site levels not shown"
- "BAL rating not stated — bushfire provisions may apply depending on site"
- "No electrical or plumbing specifications — standard domestic spec assumed"

ASSUMPTIONS: List the key assumptions so the estimator knows what underpins the quantities:
- "Wall height assumed 2.7m throughout ground floor"
- "Roof framing priced as conventional timber (not trusses) — confirm with structural drawings"
- "Slab includes entire footprint of ground floor including garage"
- "Electrical fitout priced to standard domestic specification per AS/NZS 3000"
- "No allowance for demolition, site cut or fill — site assumed level"
- "Painting to two coat system throughout — substrate condition assumed good"

${RATE_REFERENCE}

DOOR COUNTING (critical):
- Count each UNIQUE door opening ONCE. A door symbol = a quarter-circle arc on the plan.
- Tags (D1, D2, D3…) are identifiers not counts — the tag + arc = 1 door.
- Do NOT count: wardrobe doors, robe doors, linen press doors, storage cupboard doors, garage roller doors, carport openings.
- Count: external entry doors + internal passage doors between habitable rooms.
- Scale check: 55–80m² studio → 2–4 doors; 3-bed house → 8–14 doors; 4-bed double storey → 14–20 doors.

WINDOW COUNTING:
- Windows = parallel lines breaking a wall. Count each unique window symbol once.
- Glass sliding doors count as external doors, NOT windows.

Now call the submit_analysis tool with your complete findings.`;

interface PageInput {
  pageIndex: number;
  imageBase64: string;
  mediaType?: string;
}

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");

    // Accept either a valid user session JWT or the project anon key.
    // The anon key is already public (bundled in the frontend), so this gates on
    // "is this a legitimate call from the site" rather than "is the user logged in".
    let isAuthorised = token === supabaseAnonKey && supabaseAnonKey.length > 0;
    if (!isAuthorised) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      isAuthorised = !authError && !!user;
    }
    if (!isAuthorised) throw new Error("Unauthorized");

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const body = await req.json();
    const { pages, imageBase64, projectContext } = body as {
      pages?: PageInput[];
      imageBase64?: string;
      projectContext?: object;
    };

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
      ? `\n\nYou have been given ${pageCount} pages from the document set. Analyse ALL of them before calling submit_analysis.`
      : "";

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        tools: [ANALYSIS_TOOL],
        tool_choice: { type: "any" },
        messages: [
          {
            role: "user",
            content: [
              ...imageBlocks,
              {
                type: "text",
                text: SYSTEM_PROMPT + contextNote + pageNote,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      throw new Error(`Anthropic API error: ${anthropicResponse.status} ${errText}`);
    }

    const anthropicData = await anthropicResponse.json();

    // Extract structured result from tool_use block
    const toolUseBlock = anthropicData.content?.find(
      (b: { type: string }) => b.type === "tool_use" && (b as { name: string }).name === "submit_analysis"
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
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyse-plan] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: message === "Unauthorized" ? 401 : 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
