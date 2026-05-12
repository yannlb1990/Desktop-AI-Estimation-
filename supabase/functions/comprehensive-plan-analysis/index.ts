import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function filterNoise(text: string): string {
  return text
    .split('\n')
    .filter((line) =>
      !/^\s*$/.test(line) &&
      !/copyright|do\s*not\s*scale|issued\s*for\s*(tender|construction|information|approval)\s*$|revision\s*history|drawn\s*by|checked\s*by|approved\s*by|date\s*:\s*\d|scale\s*:\s*1\s*:|sheet\s*\d+\s*of\s*\d+/i
        .test(line),
    )
    .join('\n');
}

function chunkText(text: string, maxWords = 2000): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords).join(' ');
    if (chunk.trim()) chunks.push(chunk);
  }
  return chunks;
}

function extractJSON(raw: string): Record<string, unknown> {
  const bare = raw.trim();
  if (bare.startsWith('{')) { try { return JSON.parse(bare); } catch { /* fall through */ } }
  const block = bare.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) { try { return JSON.parse(block[1].trim()); } catch { /* fall through */ } }
  const start = bare.indexOf('{');
  const end = bare.lastIndexOf('}');
  if (start !== -1 && end > start) { try { return JSON.parse(bare.slice(start, end + 1)); } catch { /* fall through */ } }
  return {};
}

function dedupeByContent<T extends { content?: string; specification?: string; action?: string; code?: string }>(
  arr: T[],
): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const key = (item.content || item.specification || item.action || item.code || JSON.stringify(item))
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SYSTEM_PROMPT = `You are a senior Australian superintendent, estimator, and NCC compliance expert with 20+ years reading architectural, structural, hydraulic, electrical, mechanical, and civil drawings.

Your job is to read ALL text from a construction drawing set and extract EVERY piece of information that affects estimation, procurement, compliance, or construction — especially small text and notes that less experienced estimators typically miss.

You must extract four categories:

═══════════════════════════════════════════════
1. PLAN_NOTES — every note, callout, and annotation
═══════════════════════════════════════════════
Types:
- "critical"  → structural, fire, safety, or compliance-critical information
- "warning"   → items that will cause cost overruns, delays, or defects if missed
- "specification" → material or workmanship specs called out on the drawings
- "verify"    → anything requiring confirmation from engineer, architect, or authority before pricing
- "general"   → cross-references, general notes, drawing intent

Examples of things people commonly miss:
• "ALL FRAMING CONNECTIONS TO ENGINEER'S DETAILS"
• "HOT DIP GALVANISED BOLTS AND FIXINGS THROUGHOUT"
• "CONTRACTOR TO VERIFY ALL DIMENSIONS ON SITE"
• "ALLOW FOR HYDRAULIC ENGINEER'S SPECIFICATION"
• "FOOTING DESIGN SUBJECT TO GEOTECHNICAL REPORT"
• "FFL = RL XX.XXX" floor level references
• "SSL = RL XX.XXX" structural slab levels
• "REFER ENGINEER'S SPECIFICATION FOR REINFORCEMENT"
• "COLORBOND ULTRA WHERE WITHIN 1KM OF COASTLINE"
• "ALL TIMBER IN SUBFLOOR TO BE H4 TREATED"
• Specific product names with model numbers
• Fire compartment boundaries and FRL requirements
• Acoustic separation requirements
• "NTS" (not to scale) warnings on specific drawings
• "DO NOT DIMENSION FROM THIS DRAWING"
• Revision clouds describing what changed

═══════════════════════════════════════════════
2. SPECIFICATIONS — all material grades and technical specs
═══════════════════════════════════════════════
Categories: Timber, Concrete, Steel, Masonry, Insulation, Glazing, Waterproofing, Fixings, Roofing, Fire, Energy, Acoustic, Plumbing, Electrical, Other

Key specs to extract:
TIMBER: MGP10 / MGP12 / MGP15 / F5 / F7 / F17 / LVL / GL
TREATMENT: H1 / H2 / H3 / H4 / H5 / H6 / CCA / ACQ / LOSP (in-ground vs above-ground)
CONCRETE: 20MPa / 25MPa / 32MPa / 40MPa, slump class S2/S3/S4, exposure class A1/A2/B1/B2/C1/C2
STEEL: Grade 250 / Grade 350, HDG (hot dip galvanised), 275 g/m² zinc, stainless grade
FIRE: FRL values e.g. "FRL 90/90/90", "FRL 60/-/-", fire doorsets, smoke seals
INSULATION: R-values (R1.5/R2.5/R3.5/R4.1/R5.0), bulk batts vs reflective foil
GLAZING: 6mm / 10mm / 12mm, toughened, laminated "6.38 PVB", IGU, Low-E, argon filled
WATERPROOFING: membrane type, thickness (1.5mm/2mm), wet area extent, AS 3740
FIXINGS: M10/M12/M16 bolts, nail type and size, chemical anchors, epoxy
ENERGY: 6-star NatHERS, BASIX score, Section J compliance, SHGC values
ROOFING: Colorbond grade/profile, concrete tile type, sarking, underlay R-value

═══════════════════════════════════════════════
3. STANDARDS — all referenced and implicitly applicable codes
═══════════════════════════════════════════════
Always extract explicitly mentioned codes. Also INFER and flag applicable standards based on building type and elements:

RESIDENTIAL (Class 1 & 10):
- AS 1684.2/3/4 — Residential timber-framed construction
- AS 2870 — Residential slabs and footings (soil classification M/H1/H2/E/P)
- AS 4055 — Wind loads for housing (N1-N6 classification)
- AS 3959 — Construction in bushfire-prone areas (BAL rating)
- NCC Volume 2 — Housing Provisions
- AS 3660.1 — Termite management
- AS 3740 — Waterproofing of domestic wet areas
- AS/NZS 4200 — Pliable building membranes

COMMERCIAL (Class 2-9):
- NCC Volume 1 — Building Code of Australia
- AS 3600 — Concrete structures
- AS 4100 — Steel structures
- AS 1170 — Structural design actions (wind, snow, earthquake)
- NCC Section C — Fire resistance
- NCC Section D — Access and egress
- NCC Section F — Health and amenity (F5 acoustic)
- NCC Section J — Energy efficiency (or NCC 2022 Part 10)

ALWAYS APPLICABLE:
- AS 1288 — Glass in buildings (glazing selection and installation)
- AS 3000 — Wiring rules (electrical)
- AS 3500 — Plumbing and drainage
- AS 1657 — Fixed platforms, walkways, stairways and ladders
- AS/NZS 1170.1 — Structural design actions — permanent and imposed actions
- AS 1562 — Design and installation of sheet roof and wall cladding

═══════════════════════════════════════════════
4. ACTION_ITEMS — things the estimator must do before finalising the price
═══════════════════════════════════════════════
Priority HIGH: blocks pricing — missing information, unresolved engineering, unclear scope
Priority MEDIUM: affects allowances — needs assumption documented or confirmed
Priority LOW: worth checking — optional accuracy improvements

Return ONLY valid JSON (no markdown, no text outside the JSON):
{
  "notes": [
    {
      "type": "critical",
      "content": "full verbatim or paraphrased note",
      "location": "sheet reference or area of plan if mentioned",
      "trade": "trade most affected"
    }
  ],
  "specifications": [
    {
      "category": "Timber",
      "specification": "90x45 MGP12 wall framing studs @ 600 c/c",
      "value": "MGP12",
      "standard": "AS 1684.2",
      "locations": ["all external walls", "internal load-bearing walls"]
    }
  ],
  "standards": [
    {
      "code": "AS 2870",
      "title": "Residential slabs and footings",
      "context": "Site classification required before footing design confirmed",
      "compliance_required": true
    }
  ],
  "action_items": [
    {
      "priority": "high",
      "action": "Obtain geotechnical report and confirm soil classification",
      "reason": "Footing design and concrete quantities cannot be confirmed until site classification (M/H1/H2/E/P) is established under AS 2870",
      "trade": "Concrete"
    }
  ]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, projectName, projectType } = await req.json() as {
      text: string;
      projectName?: string;
      projectType?: string;
    };

    if (!text || text.trim().length < 50) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const cleaned = filterNoise(text);
    const chunks = chunkText(cleaned, 2000);

    console.log(`Comprehensive analysis: ${chunks.length} chunk(s), project: ${projectName || 'unknown'}, type: ${projectType || 'unknown'}`);

    const allNotes: unknown[] = [];
    const allSpecs: unknown[] = [];
    const allStandards: unknown[] = [];
    const allActions: unknown[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length}`);

      const userMsg = [
        projectName ? `Project: ${projectName}` : null,
        projectType ? `Project type: ${projectType}` : null,
        `\nDrawing text:\n${chunk}`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMsg },
          ],
          temperature: 0.15,
        }),
      });

      if (!response.ok) {
        console.error(`Chunk ${i + 1} failed: ${response.status}`);
        if (response.status === 429) break; // return partial results
        continue;
      }

      const aiData = await response.json() as { choices: { message: { content: string } }[] };
      const raw = aiData.choices[0]?.message?.content || '{}';
      const parsed = extractJSON(raw);

      if (Array.isArray(parsed.notes)) allNotes.push(...parsed.notes as unknown[]);
      if (Array.isArray(parsed.specifications)) allSpecs.push(...parsed.specifications as unknown[]);
      if (Array.isArray(parsed.standards)) allStandards.push(...parsed.standards as unknown[]);
      if (Array.isArray(parsed.action_items)) allActions.push(...parsed.action_items as unknown[]);
    }

    const result = {
      success: true,
      notes: dedupeByContent(allNotes as { content: string }[]),
      specifications: dedupeByContent(allSpecs as { specification: string }[]),
      standards: dedupeByContent(allStandards as { code: string }[]),
      action_items: dedupeByContent(allActions as { action: string }[]),
      chunksProcessed: chunks.length,
    };

    console.log(`Analysis complete: ${result.notes.length} notes, ${result.specifications.length} specs, ${result.standards.length} standards, ${result.action_items.length} actions`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('comprehensive-plan-analysis error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
