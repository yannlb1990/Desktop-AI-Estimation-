import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { planPageId, planUrl } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    console.log('Detecting symbols on plan:', planPageId);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'system',
          content: `You are an Australian construction plan symbol detector.

Detect these standard architectural symbols and return their bounding boxes:

DOORS (look for 90° arc + line):
- Single swing door
- Double door (two arcs)
- Sliding door (arrows)
- Bifold door (zigzag)

WINDOWS (parallel lines with glass indication):
- Standard window
- Sliding window
- Awning window

PLUMBING FIXTURES:
- Toilet (oval + cistern rectangle)
- Basin (small circle/oval)
- Shower (square with corner drain)
- Bath (large rectangle, rounded ends)
- Kitchen sink (double rectangle)

For each symbol return JSON:
{
  "symbols": [
    {
      "type": "door|window|toilet|basin|shower|bath|sink|other",
      "bounding_box": {"x": number, "y": number, "width": number, "height": number},
      "confidence": 0.0-1.0,
      "suggested_id": "D01|W01|null",
      "label_nearby": "exact text label found near this symbol (e.g., 'D02', 'W01') or null if none visible",
      "notes": "brief observation about this symbol (material, condition, or unique features)"
    }
  ]
}

IMPORTANT: 
- Return bounding box coordinates as PERCENTAGES of image dimensions (0-100).
- Only return symbols with confidence >= 0.4. Tag uncertain symbols as "other".
- label_nearby must be the EXACT text you see near the symbol
- notes should be brief (5-15 words) describing material, type, or notable features`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Detect all architectural symbols on this plan. Return bounding box coordinates as percentages of image dimensions (0-100).' },
            { type: 'image_url', image_url: { url: planUrl } }
          ]
        }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    console.log('Detected symbols:', result.symbols?.length || 0);

    // Save to database
    const symbolsToInsert = (result.symbols || []).map((symbol: any) => ({
      plan_page_id: planPageId,
      user_id: user.id,
      symbol_type: symbol.type,
      bounding_box: symbol.bounding_box,
      center_point: {
        x: symbol.bounding_box.x + symbol.bounding_box.width / 2,
        y: symbol.bounding_box.y + symbol.bounding_box.height / 2
      },
      confidence: symbol.confidence,
      schedule_id: symbol.suggested_id,
      label_nearby: symbol.label_nearby || null,
      notes: symbol.notes || null
    }));

    if (symbolsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('plan_symbols')
        .insert(symbolsToInsert);

      if (insertError) {
        console.error('Error inserting symbols:', insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, symbols: result.symbols || [], count: symbolsToInsert.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in plan-detect-symbols:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
