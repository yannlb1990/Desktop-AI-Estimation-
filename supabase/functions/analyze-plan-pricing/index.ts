import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, takeoffItems } = await req.json();
    console.log(`[analyze-plan-pricing] Starting pricing analysis for project ${projectId}`);

    if (!takeoffItems || !Array.isArray(takeoffItems)) {
      throw new Error('Takeoff items required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Get user profile for regional pricing
    const { data: profile } = await supabase
      .from('profiles')
      .select('state, region')
      .eq('id', user.id)
      .single();

    const userState = profile?.state || 'NSW';

    // Prepare AI prompt for pricing analysis
    const systemPrompt = `You are an expert Australian construction estimator. Your task is to provide detailed pricing for construction takeoff items based on current Australian market rates (2025).

Consider:
- Material costs (Australian suppliers: Bunnings, Mitre 10, Reece, etc.)
- Labour rates by trade (typical Australian rates)
- Regional variations (${userState} pricing)
- Waste factors (10% materials, 5% labour typically)
- Productivity rates
- GST (10%)

For each item, provide:
1. Material unit price ($/unit)
2. Material total cost
3. Labour hours required
4. Labour rate ($/hour)
5. Labour total cost
6. Total cost (materials + labour)
7. Recommended markup percentage
8. Notes/assumptions

Be realistic with Australian market pricing. Use typical ${userState} rates.`;

    const userPrompt = `Price these construction takeoff items using current Australian market rates.

State: ${userState}

Takeoff Items:
${JSON.stringify(takeoffItems, null, 2)}

Return as JSON array with this structure:
[
  {
    "trade": "Original trade",
    "sow": "Original SOW",
    "description": "Original description",
    "quantity": 0,
    "unit": "Original unit",
    "materialUnitPrice": 0,
    "materialTotal": 0,
    "labourHours": 0,
    "labourRate": 85,
    "labourTotal": 0,
    "totalCost": 0,
    "recommendedMarkup": 20,
    "notes": "Pricing assumptions",
    "confidence": "high|medium|low"
  }
]

Be thorough and use realistic Australian pricing.`;

    console.log('[analyze-plan-pricing] Calling AI API');

    const startTime = Date.now();
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    const elapsed = Date.now() - startTime;

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analyze-plan-pricing] AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '';

    // Parse pricing results
    let pricedItems = [];
    try {
      const jsonMatch = aiResponse.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/) || 
                        aiResponse.match(/(\[[\s\S]*\])/);
      
      if (jsonMatch) {
        pricedItems = JSON.parse(jsonMatch[1]);
      } else {
        pricedItems = JSON.parse(aiResponse);
      }

      console.log(`[analyze-plan-pricing] Priced ${pricedItems.length} items`);
    } catch (parseError) {
      console.error('[analyze-plan-pricing] Error parsing response:', parseError);
      throw new Error('Failed to parse AI pricing response');
    }

    // Calculate totals
    const totals = pricedItems.reduce((acc: any, item: any) => {
      acc.materialTotal += item.materialTotal || 0;
      acc.labourTotal += item.labourTotal || 0;
      acc.total += item.totalCost || 0;
      return acc;
    }, { materialTotal: 0, labourTotal: 0, total: 0 });

    // Store in ai_analyses table
    await supabase
      .from('ai_analyses')
      .insert({
        project_id: projectId,
        user_id: user.id,
        analysis_type: 'pricing',
        input_data: { takeoffItems, state: userState },
        results: {
          pricedItems,
          totals,
          state: userState,
          analyzedAt: new Date().toISOString(),
          analysisTime: elapsed,
        },
        confidence_score: 0.85,
      });

    console.log('[analyze-plan-pricing] Pricing completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        pricedItems,
        totals,
        analysisTime: elapsed,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[analyze-plan-pricing] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
