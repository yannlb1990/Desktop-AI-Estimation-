import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Webhooks must be POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2024-06-20",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ── Signature verification ────────────────────────────────────────────────
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
    );
  } catch (err) {
    console.error("Webhook signature failed:", err);
    return new Response(`Webhook signature error: ${err}`, { status: 400 });
  }

  // ── Event handling ────────────────────────────────────────────────────────
  try {
    switch (event.type) {

      // Payment completed — activate subscription
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        const billingPeriod = session.metadata?.billing_period;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (!userId || !planId || !subscriptionId) {
          console.error("checkout.session.completed missing metadata", session.metadata);
          break;
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

        const { error } = await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan_id: planId,
            billing_period: billingPeriod ?? "monthly",
            status: "active",
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

        if (error) console.error("upsert failed:", error);
        else console.log(`Activated ${planId}/${billingPeriod} for user ${userId}`);
        break;
      }

      // Plan changed, payment succeeded / trial started → update status
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        const planId = sub.metadata?.plan_id;
        const billingPeriod = sub.metadata?.billing_period;

        const stripeStatus = sub.status; // active | past_due | canceled | trialing | …
        const dbStatus =
          stripeStatus === "active" || stripeStatus === "trialing"
            ? "active"
            : stripeStatus === "past_due"
            ? "past_due"
            : "canceled";

        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: sub.customer as string,
            stripe_subscription_id: sub.id,
            plan_id: planId ?? "pro",
            billing_period: billingPeriod ?? "monthly",
            status: dbStatus,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        console.log(`Updated subscription for user ${userId}: ${dbStatus}`);
        break;
      }

      // Subscription cancelled
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        await supabase
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        console.log(`Subscription canceled for user ${userId}`);
        break;
      }

      // Payment failed — mark past_due so they can fix it
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        await supabase
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        console.log(`Payment failed for user ${userId}`);
        break;
      }

      default:
        // Unhandled events — still return 200 so Stripe doesn't retry
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
