import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SYSTEM_PROMPT = `You are an expert Australian construction estimator and pricing advisor. You help builders, contractors, and estimators with:

1. PRICING CALCULATIONS: Calculate material quantities, labour hours, and costs for construction projects
2. MARKET PRICING: Provide current Australian market pricing guidance for materials and labour
3. COMPARISONS: Compare quoted prices against typical market rates and advise if prices are fair
4. FORMULAS: Help with construction formulas (concrete volume, area calculations, waste factors, etc.)
5. STANDARDS: Reference Australian NCC building codes and standards
6. ADVICE: Offer practical estimating advice based on Australian construction practices

Always provide:
- Clear calculations with working shown
- Realistic Australian pricing (2024-2025 rates)
- Practical advice on wastage allowances (typically 5-15% depending on material)
- References to NCC requirements where relevant
- Regional pricing variations (Sydney/Melbourne tend to be 10-20% higher than regional)

Be conversational, helpful, and specific with numbers and recommendations.`;


const ALLOWED_ORIGINS = [
  "https://www.metricore.com.au",
  "https://metricore.com.au",
  "http://localhost:3001",
  "http://localhost:8080",
];

function getCors(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

serve(async (req) => {
  const cors = getCors(req.headers.get("origin") ?? "");
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('AI Chat request received with', messages.length, 'messages');

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }), {
          status: 402,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
    });
  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      }
    );
  }
});