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
    const { projectId, planDescription, analysisType } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (analysisType === "takeoff") {
      systemPrompt = `You are an expert Australian quantity surveyor and construction estimator specializing in quantity takeoffs from building plans. You analyze construction drawings and provide detailed material and labour quantity estimates according to Australian standards (NCC/BCA).

Your task is to:
1. Identify all major construction elements (foundations, framing, walls, roofing, finishes)
2. Calculate quantities with appropriate units (m2, lm, m3, ea)
3. Break down by trade categories (Site Works, Framing, Lining, Roofing, etc.)
4. Include typical wastage factors (10-15% for most materials)
5. Note any NCC compliance considerations

Return structured data in JSON format with categories, items, quantities, and units.`;

      userPrompt = `Analyze the following construction project and generate a detailed quantity takeoff:

Project Description: ${planDescription}

Provide a comprehensive takeoff with:
- Site preparation and earthworks
- Concrete foundations and slabs
- Timber or steel framing
- Wall linings (plasterboard, cladding)
- Roofing materials and installation
- Windows and doors
- Internal finishes (paint, flooring, fixtures)
- Electrical and plumbing rough-ins

Format as JSON with this structure:
{
  "categories": [
    {
      "name": "Framing",
      "items": [
        {"description": "90x45 F7 Timber Frame", "quantity": 150, "unit": "lm"},
        {"description": "90x45 F7 Studs", "quantity": 80, "unit": "ea"}
      ]
    }
  ],
  "compliance_notes": ["Check bushfire rating requirements", "Ensure termite protection"],
  "confidence": 85
}`;

    } else if (analysisType === "pricing") {
      systemPrompt = `You are an Australian construction cost estimator with expertise in current material and labour pricing across QLD, NSW, VIC, and other states. You provide realistic cost estimates based on 2024-2025 Australian market rates.

Provide pricing estimates considering:
- Regional variations (metro vs regional)
- Current material costs from suppliers (Bunnings, CSR, Reece)
- Trade labour rates by category
- Overhead and margin allowances
- GST calculations`;

      userPrompt = `Provide pricing estimates for the following project:

Project: ${planDescription}

Generate realistic Australian pricing including:
- Material costs (current market rates)
- Labour costs by trade
- Recommended overhead % (12-15%)
- Recommended margin % (15-20%)
- Total estimate with GST

Return JSON format:
{
  "material_estimates": [
    {"category": "Framing Timber", "total": 8500, "supplier": "Bunnings/CSR"},
    {"category": "Plasterboard", "total": 4200, "supplier": "Boral"}
  ],
  "labour_estimates": [
    {"trade": "Carpentry", "hours": 120, "rate": 85, "total": 10200}
  ],
  "overhead_percentage": 15,
  "margin_percentage": 18,
  "subtotal": 45000,
  "gst": 4500,
  "total_inc_gst": 49500
}`;

    } else {
      systemPrompt = `You are an Australian building compliance expert with deep knowledge of the National Construction Code (NCC/BCA), Australian Standards, and QBCC requirements.

Identify potential compliance issues and provide recommendations.`;

      userPrompt = `Review this project for NCC/BCA compliance:

Project: ${planDescription}

Check for:
- Structural requirements
- Fire safety ratings
- Energy efficiency (Section J)
- Accessibility requirements
- Bushfire attack level considerations
- Waterproofing and weatherproofing

Return JSON with compliance items and recommendations.`;
    }

    console.log(`Starting AI analysis for project ${projectId}, type: ${analysisType}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      console.error(`AI gateway error: ${status}`);
      
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errorText = await aiResponse.text();
      console.error("AI response error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const analysisResult = aiData.choices[0].message.content;

    console.log(`AI analysis complete for project ${projectId}`);

    // Save analysis to database
    const { data: analysis, error: dbError } = await supabase
      .from('ai_analyses')
      .insert({
        project_id: projectId,
        user_id: user.id,
        analysis_type: analysisType,
        input_data: { planDescription },
        results: { raw: analysisResult },
        confidence_score: 85,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to save analysis" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        analysis: analysisResult,
        analysisId: analysis.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("analyze-plan error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
