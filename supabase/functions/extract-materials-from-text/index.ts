import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Noise filter: strip admin/legal lines that waste tokens ──────────────────
function filterNoise(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      return !/contractor|permit\s|code\s*compliance|construction\s*note|zoning|setback|easement|disclaimer|copyright|do\s*not\s*scale|revision\s*history|issued\s*for\s*(tender|construction|information)/i
        .test(line);
    })
    .join('\n');
}

// ── Split into ~2000-word chunks ─────────────────────────────────────────────
function chunkText(text: string, maxWords = 2000): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords).join(' ');
    if (chunk.trim()) chunks.push(chunk);
  }
  return chunks;
}

// ── Extract JSON array from AI response (handles markdown code blocks) ───────
function extractJSON(raw: string): unknown[] {
  // Try bare JSON first
  const bare = raw.trim();
  if (bare.startsWith('[')) {
    try { return JSON.parse(bare); } catch { /* fall through */ }
  }
  // Try ```json ... ``` block
  const block = bare.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) {
    try { return JSON.parse(block[1].trim()); } catch { /* fall through */ }
  }
  // Try finding the first [ ... ] span
  const start = bare.indexOf('[');
  const end = bare.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try { return JSON.parse(bare.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return [];
}

const SYSTEM_PROMPT = `You are a senior Australian construction estimator and quantity surveyor with 15+ years of experience analyzing architectural floor plans, structural drawings, and specifications.

Extract ALL construction materials from the text, organized by floor level → room → material.

Materials to detect (non-exhaustive):
- Structural connectors: MST48, MST37, HDU2–HDU11, LTP4, A34, joist hangers, post caps, hold-downs
- Timber framing: LVL beams, wall plates, studs, noggings, rafters, floor joists, trimmers, lintels
- Engineered wood: LVL (Laminated Veneer Lumber), GLB, PSL, LSL
- Concrete: slabs, footings, columns (m³)
- Steel: RHS, SHS, UB, UC, flat bar, angle (lm or kg)
- Linings: plasterboard 10mm / 13mm / 16mm, Villaboard, FC sheeting, cladding
- Finishes: floor tiles, wall tiles, carpet, vinyl, timber flooring, paint, render
- Hardware: screws, bolts, brackets, fixings
- Plumbing: basins, WCs, showers, baths, tapware, hot water units, pipes
- Electrical: GPOs, light points, switches, switchboards, smoke detectors, exhaust fans
- Windows and doors: by size and type
- Insulation: R-values, batts, foam, reflective

Classification rules:
- Structural: LVL, beams, columns, slabs, footings
- Connector: MST, HDU, joist hangers, hold-downs, brackets
- Framing: studs, plates, noggins, rafters, trimmers
- Lining: plasterboard, FC sheet, cladding, render
- Finish: tiles, carpet, vinyl, timber floor, paint
- Hardware: screws, bolts, nails, anchors
- Plumbing: tapware, fixtures, pipes
- Electrical: outlets, lights, switches, detectors
- Other: everything else

Quantity rules:
- Discrete items (connectors, doors, windows, fixtures, lights): count as integer, unit = "ea"
- Linear framing, pipes, cables: quantity in metres, unit = "lm"
- Area surfaces (flooring, wall lining, ceiling): quantity in m², unit = "m2"
- Volume (concrete, fill): quantity in m³, unit = "m3"
- Mass (steel, rebar): quantity in kg, unit = "kg"

Assumptions:
- Ceiling height: 2.7m residential, 3.0m commercial/industrial
- If floor level is unknown, use "Ground Floor"
- If room is unclear, use "General"
- Use metric units throughout (Australian standard)

Return ONLY a valid JSON array — no explanation, no markdown, no extra text:
[{"floor":"Ground Floor","room":"Kitchen","material":"Ceramic Floor Tiles 600x600mm","materialType":"Finish","quantity":12.5,"unit":"m2"},{"floor":"Ground Floor","room":"Kitchen","material":"MST48 Strap","materialType":"Connector","quantity":4,"unit":"ea"}]`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, projectName } = await req.json() as { text: string; projectName?: string };

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

    // Filter noise, then chunk
    const cleaned = filterNoise(text);
    const chunks = chunkText(cleaned, 2000);

    console.log(`Processing ${chunks.length} chunk(s) for project: ${projectName || 'unknown'}`);

    const allItems: unknown[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.split(/\s+/).length} words)`);

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
            {
              role: 'user',
              content: `Extract all construction materials from this drawing text${projectName ? ` for project "${projectName}"` : ''}:\n\n${chunk}`,
            },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        console.error(`AI gateway error on chunk ${i + 1}: ${status}`);
        if (status === 429) {
          // Rate limited — return what we have so far rather than failing completely
          break;
        }
        continue;
      }

      const aiData = await response.json() as { choices: { message: { content: string } }[] };
      const raw = aiData.choices[0]?.message?.content || '[]';
      const items = extractJSON(raw);
      allItems.push(...items);
    }

    // Deduplicate by floor+room+material key
    const seen = new Set<string>();
    const deduped = allItems.filter((item) => {
      const i = item as Record<string, unknown>;
      const key = `${i.floor}|${i.room}|${i.material}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`Extracted ${deduped.length} unique materials from ${chunks.length} chunk(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        items: deduped,
        totalItems: deduped.length,
        chunksProcessed: chunks.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('extract-materials-from-text error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
