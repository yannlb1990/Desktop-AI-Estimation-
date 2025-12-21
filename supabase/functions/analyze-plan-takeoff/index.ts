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
    const { planUrl, projectName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing plan:', planUrl);

    // Step 1: Ask AI to identify scope of work packages
    const scopeResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an Australian construction plan analyzer. Analyze building plans and identify scope of work packages.
            
Common Australian trade packages:
- Carpentry (framing, fix-out, cladding, decking)
- Concrete (footings, slabs, driveways)
- Demolition (strip out, site preparation)
- Plumbing (rough-in, fix-out, drainage)
- Electrical (rough-in, fit-off, solar)
- Roofing (tiles, metal, gutters)
- Bricklaying (walls, fencing, paving)
- Plastering (internal walls, ceiling)
- Painting (interior, exterior)
- Flooring (tiles, timber, carpet)
- Landscaping (retaining walls, fencing, gardens)

Return a JSON array of scope packages identified in the plan. Each package should have:
{
  "trade": "Trade name",
  "scopes": ["scope1", "scope2"],
  "areas": ["area1", "area2"],
  "priority": "high|medium|low"
}`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this construction plan for project "${projectName}". Identify all trade packages and scope of work items. Return only valid JSON.`
              },
              {
                type: 'image_url',
                image_url: { url: planUrl }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!scopeResponse.ok) {
      throw new Error(`Scope analysis failed: ${scopeResponse.status}`);
    }

    const scopeData = await scopeResponse.json();
    const scopePackages = JSON.parse(scopeData.choices[0].message.content);

    console.log('Identified scope packages:', scopePackages);

    // Step 2: Extract takeoff quantities for each scope
    const takeoffResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an Australian quantity surveyor. Extract material takeoff quantities from construction plans.

For each item provide:
{
  "area": "Room/Zone name",
  "trade": "Trade type",
  "scopeOfWork": "Specific scope",
  "materialType": "Material description",
  "quantity": number,
  "unit": "m²|m|lm|m³|ea|sets",
  "labourHours": estimated hours,
  "notes": "Any relevant details"
}

Use Australian measurements (metres, square metres, cubic metres).
Be specific about materials (e.g., "MGP12 90x45mm", "6mm FC board", "Colorbond 0.48 sheeting").
Estimate labour hours based on Australian productivity rates.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract detailed takeoff quantities from this plan. Focus on these scope packages: ${JSON.stringify(scopePackages)}. Return valid JSON array of items.`
              },
              {
                type: 'image_url',
                image_url: { url: planUrl }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!takeoffResponse.ok) {
      throw new Error(`Takeoff extraction failed: ${takeoffResponse.status}`);
    }

    const takeoffData = await takeoffResponse.json();
    const takeoffItems = JSON.parse(takeoffData.choices[0].message.content);

    console.log('Extracted takeoff items:', takeoffItems);

    return new Response(
      JSON.stringify({
        success: true,
        scopePackages,
        takeoffItems,
        analysis: {
          totalItems: takeoffItems.items?.length || 0,
          tradesIdentified: scopePackages.packages?.length || 0,
          confidence: 0.85
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in analyze-plan-takeoff function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});