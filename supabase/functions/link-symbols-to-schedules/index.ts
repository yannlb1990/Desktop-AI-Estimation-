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
    const { planPageId } = await req.json();

    if (!planPageId) {
      throw new Error("planPageId is required");
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

    console.log(`[link-symbols-to-schedules] Starting for planPageId: ${planPageId}`);

    // Fetch all symbols for this page
    const { data: symbols, error: symbolsError } = await supabase
      .from('plan_symbols')
      .select('*')
      .eq('plan_page_id', planPageId)
      .eq('user_id', user.id);

    if (symbolsError) {
      console.error('[link-symbols-to-schedules] Error fetching symbols:', symbolsError);
      throw symbolsError;
    }

    // Fetch all schedules for this page
    const { data: schedules, error: schedulesError } = await supabase
      .from('plan_schedules')
      .select('*')
      .eq('plan_page_id', planPageId)
      .eq('user_id', user.id);

    if (schedulesError) {
      console.error('[link-symbols-to-schedules] Error fetching schedules:', schedulesError);
      throw schedulesError;
    }

    console.log(`[link-symbols-to-schedules] Found ${symbols?.length || 0} symbols and ${schedules?.length || 0} schedules`);

    const issues: string[] = [];
    const updatedSymbols: any[] = [];

    if (!schedules || schedules.length === 0) {
      issues.push("No schedules found on this page - cannot link symbols");
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated: 0, 
          issues,
          message: "No schedules available for linking"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create schedule lookup by schedule_id
    const scheduleMap = new Map();
    schedules.forEach(schedule => {
      const id = schedule.schedule_id;
      if (!scheduleMap.has(id)) {
        scheduleMap.set(id, []);
      }
      scheduleMap.get(id).push(schedule);
    });

    // Check for duplicate schedule IDs
    scheduleMap.forEach((scheduleList, scheduleId) => {
      if (scheduleList.length > 1) {
        issues.push(`Duplicate schedule_id found: ${scheduleId} (${scheduleList.length} entries)`);
      }
    });

    // Link symbols to schedules
    for (const symbol of symbols || []) {
      // Try to match using label_nearby or schedule_id field
      const labelToMatch = symbol.label_nearby || symbol.schedule_id;
      
      if (!labelToMatch) {
        issues.push(`Symbol ${symbol.id} (${symbol.symbol_type}) has no label_nearby or schedule_id for matching`);
        continue;
      }

      const matchedSchedules = scheduleMap.get(labelToMatch);

      if (!matchedSchedules || matchedSchedules.length === 0) {
        issues.push(`Symbol ${symbol.id} references schedule '${labelToMatch}' but no matching schedule found`);
        continue;
      }

      // If multiple schedules with same ID, log issue but use first one
      const schedule = matchedSchedules[0];

      // Update symbol with schedule data
      const { error: updateError } = await supabase
        .from('plan_symbols')
        .update({
          schedule_id: schedule.schedule_id,
          size_width_mm: schedule.width_mm,
          size_height_mm: schedule.height_mm
        })
        .eq('id', symbol.id);

      if (updateError) {
        console.error(`[link-symbols-to-schedules] Error updating symbol ${symbol.id}:`, updateError);
        issues.push(`Failed to update symbol ${symbol.id}: ${updateError.message}`);
      } else {
        updatedSymbols.push({
          ...symbol,
          schedule_id: schedule.schedule_id,
          size_width_mm: schedule.width_mm,
          size_height_mm: schedule.height_mm
        });
      }
    }

    // Check for unplaced schedule items
    const linkedScheduleIds = new Set(updatedSymbols.map(s => s.schedule_id));
    schedules.forEach(schedule => {
      if (!linkedScheduleIds.has(schedule.schedule_id)) {
        issues.push(`Schedule '${schedule.schedule_id}' exists but no symbol found on plan (unplaced item)`);
      }
    });

    console.log(`[link-symbols-to-schedules] Updated ${updatedSymbols.length} symbols`);
    console.log(`[link-symbols-to-schedules] Issues: ${issues.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: updatedSymbols.length,
        symbols: updatedSymbols,
        issues
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[link-symbols-to-schedules] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});