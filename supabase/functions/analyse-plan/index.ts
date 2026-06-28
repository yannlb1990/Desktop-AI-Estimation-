import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const ALLOWED_ORIGINS = [
  "https://www.metricore.com.au",
  "https://metricore.com.au",
  "http://localhost:8080",
];

function getCors(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const SYSTEM_PROMPT = `You are an expert Australian construction estimator analysing an architectural floor plan image.

Analyse the plan and respond ONLY with a valid JSON object in this exact format (no markdown, no explanation):
{
  "rooms": [{"name": "string", "areaSqm": number}],
  "openings": {"doors": number, "windows": number},
  "totalFloorArea": number,
  "estimatedTrades": [
    {"trade": "string", "quantity": number, "unit": "string", "confidence": number}
  ],
  "notes": ["string"]
}

DOOR COUNTING RULES (critical):
- Count each UNIQUE door opening ONCE. A door symbol is a quarter-circle arc on the plan.
- Door tags (D1, D2, D3…) are IDENTIFIERS not counts — the tag and its arc together = 1 door.
- Do NOT count wardrobe doors, robe doors, linen press doors, or storage cupboard doors.
- Do NOT count garage roller doors or carport openings.
- Count only external entry doors and internal passage doors between habitable rooms.
- Scale check: a 55–80 m² studio typically has 2–4 doors. A 3-bed house has 8–14 doors.

WINDOW COUNTING RULES:
- Windows appear as parallel lines breaking a wall. Count each unique window symbol once.
- Glass sliding doors count as doors/openings, not windows.

Other guidelines:
- rooms: all habitable spaces with estimated area in m²
- totalFloorArea: habitable floor area only (exclude garage, carport, covered outdoor areas)
- estimatedTrades: Framing (LM wall), Plasterboard (M2), Roofing (M2), Concrete (M3), Tiling (M2), Painting (M2)
  confidence: 0.0–1.0
- notes: double storey, alfresco, pool, unusual features, plan quality observations

If you cannot determine a value use 0 or an empty array. Never omit keys.`;

serve(async (req) => {
  const cors = getCors(req.headers.get("origin") ?? "");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { imageBase64, projectContext, userMessage } = await req.json();

    if (!imageBase64) {
      throw new Error("imageBase64 is required");
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const contextNote = projectContext
      ? `\n\nProject context: ${JSON.stringify(projectContext)}`
      : "";
    const userNote = userMessage ? `\n\nAdditional instructions: ${userMessage}` : "";

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: SYSTEM_PROMPT + contextNote + userNote,
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

    return new Response(JSON.stringify(anthropicData), {
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
