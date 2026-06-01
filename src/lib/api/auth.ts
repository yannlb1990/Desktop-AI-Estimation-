import { callEdge } from './client';

// ── user-onboard ───────────────���──────────────────────────────────────────────

export interface OnboardReq {
  name: string;
  email: string;
  phone: string;
  project_type: 'residential' | 'commercial' | 'industrial' | 'renovation' | 'other';
  plan_id: 'starter' | 'pro' | 'business';
  billing_period: 'monthly' | 'annual';
}

interface OnboardRes {
  success: true;
  user_id: string;
}

/**
 * Registers a new user account and sets their initial subscription plan.
 * Uses auth: 'none' — this is a public endpoint called before login.
 */
export async function onboardUser(data: OnboardReq): Promise<OnboardRes> {
  return callEdge<OnboardReq, OnboardRes>('user-onboard', data, { auth: 'none' });
}
