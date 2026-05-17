import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map plan:billing → Stripe Price ID (set as Edge Function secrets)
const PRICE_IDS: Record<string, string | undefined> = {
  "starter:monthly":  Deno.env.get("STRIPE_PRICE_STARTER_MONTHLY"),
  "starter:annual":   Deno.env.get("STRIPE_PRICE_STARTER_ANNUAL"),
  "pro:monthly":      Deno.env.get("STRIPE_PRICE_PRO_MONTHLY"),
  "pro:annual":       Deno.env.get("STRIPE_PRICE_PRO_ANNUAL"),
  "business:monthly": Deno.env.get("STRIPE_PRICE_BUSINESS_MONTHLY"),
  "business:annual":  Deno.env.get("STRIPE_PRICE_BUSINESS_ANNUAL"),
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const { plan_id, billing_period, success_url, cancel_url } = await req.json();

    if (!plan_id || !billing_period) {
      return json({ error: "Missing plan_id or billing_period" }, 400);
    }

    const priceId = PRICE_IDS[`${plan_id}:${billing_period}`];
    if (!priceId) {
      return json({ error: `No Stripe price configured for ${plan_id}:${billing_period}. Set the secret STRIPE_PRICE_${plan_id.toUpperCase()}_${billing_period.toUpperCase()}.` }, 400);
    }

    // ── Stripe ────────────────────────────────────────────────────────────────
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2024-06-20",
    });

    // Look up existing Stripe customer (stored in subscriptions table)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerId = existingSub?.stripe_customer_id as string | undefined;

    if (!customerId) {
      // Look up in Stripe by email to avoid duplicates
      const existing = await stripe.customers.list({ email: user.email!, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
      }
    }

    const origin = req.headers.get("origin") ?? "https://metricore.com.au";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success_url ?? `${origin}/checkout-success`,
      cancel_url: cancel_url ?? `${origin}/pricing`,
      allow_promotion_codes: true,
      metadata: {
        user_id: user.id,
        plan_id,
        billing_period,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id,
          billing_period,
        },
      },
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("stripe-create-checkout error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
