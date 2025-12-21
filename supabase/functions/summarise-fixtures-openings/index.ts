import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, planPageId } = await req.json();

    if (!projectId && !planPageId) {
      throw new Error("Either projectId or planPageId is required");
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Authorization header is required");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    console.log(`[summarise-fixtures-openings] Starting for ${projectId ? 'projectId: ' + projectId : 'planPageId: ' + planPageId}`);

    // Build query based on input
    let query = supabase
      .from('plan_symbols')
      .select('*, plan_pages!inner(project_id)')
      .eq('user_id', user.id);

    if (planPageId) {
      query = query.eq('plan_page_id', planPageId);
    } else if (projectId) {
      query = query.eq('plan_pages.project_id', projectId);
    }

    const { data: symbols, error: symbolsError } = await query;

    if (symbolsError) {
      console.error('[summarise-fixtures-openings] Error fetching symbols:', symbolsError);
      throw symbolsError;
    }

    console.log(`[summarise-fixtures-openings] Found ${symbols?.length || 0} symbols`);

    const issues: string[] = [];

    if (!symbols || symbols.length === 0) {
      issues.push("No symbols found for the specified project/page");
      return new Response(
        JSON.stringify({
          success: true,
          summary: {
            doors: [],
            windows: [],
            fixtures: { toilet: 0, basin: 0, shower: 0, sink: 0 },
            issues
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group doors by schedule_id
    const doorGroups = new Map<string, any[]>();
    const windowGroups = new Map<string, any[]>();
    const fixtureCounts = {
      toilet: 0,
      basin: 0,
      shower: 0,
      sink: 0
    };

    symbols.forEach(symbol => {
      const type = symbol.symbol_type?.toLowerCase() || 'other';

      if (type === 'door') {
        const scheduleId = symbol.schedule_id || 'unscheduled';
        if (!doorGroups.has(scheduleId)) {
          doorGroups.set(scheduleId, []);
        }
        doorGroups.get(scheduleId)!.push(symbol);
      } else if (type === 'window') {
        const scheduleId = symbol.schedule_id || 'unscheduled';
        if (!windowGroups.has(scheduleId)) {
          windowGroups.set(scheduleId, []);
        }
        windowGroups.get(scheduleId)!.push(symbol);
      } else if (type in fixtureCounts) {
        fixtureCounts[type as keyof typeof fixtureCounts]++;
      }
    });

    // Convert door groups to array format
    const doors = Array.from(doorGroups.entries()).map(([scheduleId, symbolList]) => {
      const firstSymbol = symbolList[0];
      return {
        schedule_id: scheduleId === 'unscheduled' ? null : scheduleId,
        type: 'door',
        count: symbolList.length,
        width_mm: firstSymbol.size_width_mm || null,
        height_mm: firstSymbol.size_height_mm || null
      };
    });

    // Convert window groups to array format
    const windows = Array.from(windowGroups.entries()).map(([scheduleId, symbolList]) => {
      const firstSymbol = symbolList[0];
      return {
        schedule_id: scheduleId === 'unscheduled' ? null : scheduleId,
        type: 'window',
        count: symbolList.length,
        width_mm: firstSymbol.size_width_mm || null,
        height_mm: firstSymbol.size_height_mm || null
      };
    });

    // Check for unscheduled items
    const unscheduledDoors = doors.find(d => d.schedule_id === null);
    const unscheduledWindows = windows.find(w => w.schedule_id === null);
    
    if (unscheduledDoors) {
      issues.push(`${unscheduledDoors.count} door(s) have no schedule assignment`);
    }
    if (unscheduledWindows) {
      issues.push(`${unscheduledWindows.count} window(s) have no schedule assignment`);
    }

    console.log(`[summarise-fixtures-openings] Summary: ${doors.length} door types, ${windows.length} window types, ${Object.values(fixtureCounts).reduce((a, b) => a + b, 0)} fixtures`);
    console.log(`[summarise-fixtures-openings] Issues: ${issues.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          doors,
          windows,
          fixtures: fixtureCounts,
          issues
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[summarise-fixtures-openings] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});