import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export { redirectToStripeCheckout } from "@/lib/api/stripe";

type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];

// Reads the user's paid subscription from Supabase DB and merges it into localStorage.
// Called on app start and after a successful checkout.
// Returns true if sync succeeded, false otherwise.
const ADMIN_EMAIL = 'yannlb1990@gmail.com';

export async function syncSubscriptionFromDB(retries = 3): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;

  // Admin bypass — full business access, never expires, never redirected to pricing
  if (session.user.email === ADMIN_EMAIL) {
    const storageKey = `${session.user.email}:estimate_subscription`;
    const raw = localStorage.getItem(storageKey);
    const existing = raw ? JSON.parse(raw) : null;
    localStorage.setItem(storageKey, JSON.stringify({
      ...(existing ?? {}),
      email: ADMIN_EMAIL,
      displayName: existing?.displayName ?? 'Admin',
      activePlan: 'business',
      selectedPlan: 'business',
      billingPeriod: 'annual',
      trialStartedAt: session.user.created_at,
      trialEndsAt: '2099-12-31T00:00:00.000Z',
      stripeStatus: 'active',
      pastDueSince: undefined,
    }));
    return true;
  }

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

      // No subscription row → user is on free trial.
      // Recalculate trialEndsAt from session.user.created_at (server-sourced — cannot
      // be manipulated via DevTools). This closes the localStorage tampering gap.
      if (!data) {
        const storageKey = `${session.user.email}:estimate_subscription`;
        const raw = localStorage.getItem(storageKey);
        let existing: any = null;
        try { if (raw) existing = JSON.parse(raw); } catch {}

        // Always compute trial end from the Supabase-issued account creation date
        const trialStart = session.user.created_at ?? existing?.trialStartedAt ?? new Date().toISOString();
        const trialEnd = new Date(new Date(trialStart).getTime() + 14 * 86_400_000).toISOString();

        const enforced = {
          ...(existing ?? {}),
          email: session.user.email ?? existing?.email ?? '',
          displayName: existing?.displayName ?? (session.user.user_metadata?.displayName as string | undefined) ?? '',
          activePlan: 'trial',
          selectedPlan: existing?.selectedPlan ?? 'pro',
          billingPeriod: existing?.billingPeriod ?? 'monthly',
          trialStartedAt: trialStart,
          trialEndsAt: trialEnd,   // ← enforced from server, overrides any localStorage tampering
          stripeStatus: undefined,
          pastDueSince: undefined,
        };
        localStorage.setItem(storageKey, JSON.stringify(enforced));
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
