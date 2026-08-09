import { callEdge } from './client';

// ── stripe-create-checkout ────────────────────────────────────────────────────

interface CreateCheckoutReq {
  plan_id: string;
  billing_period: 'monthly' | 'annual';
  success_url: string;
  cancel_url: string;
}

interface CreateCheckoutRes {
  url: string;
}

/** Initiates a Stripe checkout session and redirects the browser to Stripe. */
export async function redirectToStripeCheckout(
  planId: string,
  billingPeriod: 'monthly' | 'annual',
): Promise<void> {
  const { url } = await callEdge<CreateCheckoutReq, CreateCheckoutRes>(
    'stripe-create-checkout',
    {
      plan_id: planId,
      billing_period: billingPeriod,
      success_url: `${window.location.origin}/checkout-success?plan=${planId}&billing=${billingPeriod}`,
      cancel_url: `${window.location.origin}/pricing`,
    },
  );
  window.location.href = url;
}

// ── stripe-cancel-subscription ────────────────────────────────────────────────

interface CancelSubscriptionRes {
  success: true;
  cancel_at: string; // ISO — date access ends
}

/** Marks the subscription to cancel at end of billing period. Returns the cutoff date. */
export async function cancelSubscription(): Promise<CancelSubscriptionRes> {
  return callEdge<Record<string, never>, CancelSubscriptionRes>(
    'stripe-cancel-subscription',
    {},
  );
}
