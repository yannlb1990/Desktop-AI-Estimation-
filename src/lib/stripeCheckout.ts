import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export async function redirectToStripeCheckout(
  planId: string,
  billingPeriod: string,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("You must be signed in to subscribe");

  const res = await fetch(`${FUNCTIONS_URL}/stripe-create-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      plan_id: planId,
      billing_period: billingPeriod,
      success_url: `${window.location.origin}/checkout-success`,
      cancel_url: `${window.location.origin}/pricing`,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Checkout request failed (${res.status})`);
  }

  const { url } = await res.json();
  window.location.href = url;
}

// Reads the user's paid subscription from Supabase DB and merges it into localStorage.
// Called on app start and after a successful checkout.
export async function syncSubscriptionFromDB(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("subscriptions")
      .select("plan_id, billing_period, status, current_period_end, created_at")
      .eq("user_id", session.user.id)
      .single();

    if (error || !data || data.status === "canceled") return;

    // Update the user's scoped localStorage subscription key so the rest of the
    // app (which is synchronous) sees the paid plan immediately.
    const storageKey = `${session.user.email}:estimate_subscription`;
    const raw = localStorage.getItem(storageKey);
    const existing = raw ? JSON.parse(raw) : null;

    const now = new Date().toISOString();
    const updated = existing
      ? {
          ...existing,
          activePlan: data.plan_id,
          billingPeriod: data.billing_period,
          subscribedAt: existing.subscribedAt ?? data.created_at ?? now,
        }
      : {
          email: session.user.email ?? "",
          displayName: session.user.user_metadata?.displayName ?? "",
          activePlan: data.plan_id,
          selectedPlan: data.plan_id,
          billingPeriod: data.billing_period,
          trialStartedAt: data.created_at ?? now,
          trialEndsAt: data.created_at ?? now, // already past trial
          subscribedAt: data.created_at ?? now,
        };

    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch {
    // Never crash — fall back to localStorage state
  }
}
