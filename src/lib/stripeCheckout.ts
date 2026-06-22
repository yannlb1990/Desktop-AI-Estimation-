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
        .maybeSingle<Pick<SubscriptionRow, "plan_id" | "billing_period" | "status" | "current_period_end" | "created_at">>();

      if (error) {
        if (attempt < retries) await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      // No subscription row → user is on free trial; reset localStorage to trial so
      // a manually crafted activePlan value in localStorage cannot grant paid access.
      if (!data) {
        const storageKey = `${session.user.email}:estimate_subscription`;
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          try {
            const existing = JSON.parse(raw);
            if (existing.activePlan && existing.activePlan !== 'trial') {
              localStorage.setItem(storageKey, JSON.stringify({ ...existing, activePlan: 'trial', stripeStatus: undefined }));
            }
          } catch { /* corrupt entry — leave it */ }
        }
        return false;
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
            currentPeriodEnd: data.current_period_end ?? existing.currentPeriodEnd,
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
            currentPeriodEnd: data.current_period_end ?? undefined,
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
