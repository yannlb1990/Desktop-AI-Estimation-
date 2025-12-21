import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MATERIAL_SUPPLIERS: Record<string, { supplier: string; priceRange: string; url: string; description: string; benchmark: "low" | "medium" | "high" }[]> = {
  "timber_screws": [
    { supplier: "Bunnings", priceRange: "$12-18/box", url: "https://www.bunnings.com.au/search/products?q=timber%20screws", description: "Chipboard & timber fixing screws", benchmark: "low" },
    { supplier: "Total Tools", priceRange: "$15-25/box", url: "https://www.totaltools.com.au/search?q=timber+screws", description: "Professional grade timber screws", benchmark: "medium" },
    { supplier: "Mitre 10", priceRange: "$14-22/box", url: "https://www.mitre10.com.au/search?text=timber+screws", description: "Trade quality timber screws", benchmark: "medium" },
  ],
  "drywall_screws": [
    { supplier: "Bunnings", priceRange: "$8-15/box", url: "https://www.bunnings.com.au/search/products?q=drywall%20screws", description: "Plasterboard fixing screws", benchmark: "low" },
    { supplier: "Total Tools", priceRange: "$10-20/box", url: "https://www.totaltools.com.au/search?q=drywall+screws", description: "Professional drywall screws", benchmark: "medium" },
  ],
  "batten_screws": [
    { supplier: "Bunnings", priceRange: "$18-28/box", url: "https://www.bunnings.com.au/search/products?q=batten%20screws", description: "Roofing batten screws", benchmark: "medium" },
    { supplier: "Mitre 10", priceRange: "$20-32/box", url: "https://www.mitre10.com.au/search?text=batten+screws", description: "Metal roofing screws", benchmark: "high" },
  ],
  "plasterboard": [
    { supplier: "Bunnings", priceRange: "$16-22/sheet", url: "https://www.bunnings.com.au/search/products?q=plasterboard", description: "Standard plasterboard sheets", benchmark: "low" },
    { supplier: "Reece", priceRange: "$18-28/sheet", url: "https://www.reece.com.au/search?q=plasterboard", description: "Premium plasterboard range", benchmark: "medium" },
  ],
  "copper_pipes": [
    { supplier: "Reece", priceRange: "$12-18/m", url: "https://www.reece.com.au/search?q=copper+pipe", description: "Type B copper piping", benchmark: "medium" },
    { supplier: "Tradelink", priceRange: "$11-16/m", url: "https://www.tradelink.com.au/search?q=copper+pipe", description: "Trade copper pipes", benchmark: "low" },
  ],
  "pvc_pipes": [
    { supplier: "Bunnings", priceRange: "$8-15/m", url: "https://www.bunnings.com.au/search/products?q=pvc%20pipe", description: "DWV PVC pressure pipes", benchmark: "low" },
    { supplier: "Reece", priceRange: "$9-18/m", url: "https://www.reece.com.au/search?q=pvc+pipe", description: "Drainage & water PVC", benchmark: "medium" },
  ],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchTerm } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Use AI to analyze search intent
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: 'You are a construction materials expert. Analyze search queries and determine if they need clarification. If the query is too vague (e.g., "screws" without type), return suggestions. Otherwise, categorize the material type.'
          },
          {
            role: 'user',
            content: `Analyze this search: "${searchTerm}". Is it specific enough? If not, provide specific suggestions (e.g., for "screws", suggest "Timber screws", "Drywall screws", "Batten screws", "Concrete screws"). Return JSON: {"needsClarification": boolean, "category": string, "suggestions": [{"type": "Category", "examples": ["example1", "example2"]}]}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({
          error: "AI credits depleted. Please add credits in Settings → Workspace → Usage to continue using AI-powered material search.",
          needsClarification: false,
          results: []
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({
          error: "Rate limit exceeded. Please try again in a moment.",
          needsClarification: false,
          results: []
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '{}';
    
    let analysis;
    try {
      analysis = JSON.parse(aiContent);
    } catch {
      analysis = { needsClarification: false, category: "general" };
    }

    if (analysis.needsClarification) {
      return new Response(JSON.stringify({
        needsClarification: true,
        suggestions: analysis.suggestions || [
          {
            type: "Common Types",
            examples: ["Timber screws", "Drywall screws", "Batten screws", "Concrete screws"]
          }
        ]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map category to suppliers
    const categoryKey = analysis.category?.toLowerCase().replace(/\s+/g, '_') || 'general';
    const suppliers = MATERIAL_SUPPLIERS[categoryKey] || [];

    const results = suppliers.length > 0 
      ? suppliers.map(s => ({
          supplier: s.supplier,
          title: searchTerm,
          priceRange: s.priceRange,
          url: s.url,
          description: s.description,
          category: analysis.category || "General",
          benchmark: s.benchmark
        }))
      : [
          {
            supplier: "Bunnings",
            title: searchTerm,
            priceRange: "View pricing",
            url: `https://www.bunnings.com.au/search/products?q=${encodeURIComponent(searchTerm)}`,
            description: "Australia's leading hardware retailer",
            category: "general",
            benchmark: "medium" as const
          },
          {
            supplier: "Mitre 10",
            title: searchTerm,
            priceRange: "Compare prices",
            url: `https://www.mitre10.com.au/search?text=${encodeURIComponent(searchTerm)}`,
            description: "Home improvement specialist",
            category: "general",
            benchmark: "medium" as const
          }
        ];

    return new Response(JSON.stringify({
      needsClarification: false,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Material search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      needsClarification: false,
      results: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
