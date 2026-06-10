import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export { redirectToStripeCheckout } from "@/lib/api/stripe";

type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];

// Reads the user's paid subscription from Supabase DB and merges it into localStorage.
// Called on app start and after a successful checkout.
// Returns true if sync succeeded, false otherwise.
export async function syncSubscriptionFromDB(retries = 3): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan_id, billing_period, status, current_period_end, created_at")
        .eq("user_id", session.user.id)
        .single<Pick<SubscriptionRow, "plan_id" | "billing_period" | "status" | "current_period_end" | "created_at">>();

      if (error || !data) {
        if (attempt < retries) await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (data.status === "canceled") return false;

      const storageKey = `${session.user.email}:estimate_subscription`;
      const raw = localStorage.getItem(storageKey);
      const existing = raw ? JSON.parse(raw) : null;

      const now = new Date().toISOString();
      const isPastDue = data.status === "past_due";

      const updated = existing
        ? {
            ...existing,
            activePlan: data.plan_id,
            billingPeriod: data.billing_period,
            subscribedAt: existing.subscribedAt ?? data.created_at ?? now,
            stripeStatus: data.status,
            pastDueSince: isPastDue ? (existing.pastDueSince ?? now) : undefined,
          }
        : {
            email: session.user.email ?? "",
            displayName: session.user.user_metadata?.displayName ?? "",
            activePlan: data.plan_id,
            selectedPlan: data.plan_id,
            billingPeriod: data.billing_period,
            trialStartedAt: data.created_at ?? now,
            trialEndsAt: data.created_at ?? now,
            subscribedAt: data.created_at ?? now,
            stripeStatus: data.status,
            pastDueSince: isPastDue ? now : undefined,
          };

      localStorage.setItem(storageKey, JSON.stringify(updated));
      return true;
    } catch {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  return false;
}
