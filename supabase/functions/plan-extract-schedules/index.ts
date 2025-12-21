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

    console.log('Extracting schedules from plan:', planPageId);

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
          content: `You are a construction plan table extractor.

Look for DOOR SCHEDULES with columns:
- Door ID (D01, D02, D03...)
- Width (mm)
- Height (mm)
- Type (solid, glazed, fire rated)
- Frame/Material
- Hardware

Look for WINDOW SCHEDULES with columns:
- Window ID (W01, W02...)
- Width (mm)
- Height (mm)
- Type (awning, sliding, fixed)
- Glazing
- Frame

Return JSON:
{
  "schedules": [
    {
      "type": "door|window",
      "id": "D01",
      "width_mm": 820,
      "height_mm": 2040,
      "description": "Solid core",
      "material": "Pine frame"
    }
  ]
}

If no schedules found, return {"schedules": []}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all door and window schedule data from this plan.' },
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

    console.log('Extracted schedules:', result.schedules?.length || 0);

    // Save to database
    const schedulesToInsert = (result.schedules || []).map((schedule: any) => ({
      plan_page_id: planPageId,
      user_id: user.id,
      schedule_type: schedule.type,
      schedule_id: schedule.id,
      width_mm: schedule.width_mm,
      height_mm: schedule.height_mm,
      description: schedule.description,
      material: schedule.material,
      raw_data: schedule
    }));

    if (schedulesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('plan_schedules')
        .insert(schedulesToInsert);

      if (insertError) {
        console.error('Error inserting schedules:', insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, schedules: result.schedules || [], count: schedulesToInsert.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in plan-extract-schedules:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
