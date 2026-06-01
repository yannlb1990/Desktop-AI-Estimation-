// Subscription / plan management — localStorage-backed, ready to swap for real billing
import { getUserStorageKey } from '@/lib/localAuth';

export type PlanId = 'starter' | 'pro' | 'business';
export type BillingPeriod = 'monthly' | 'annual';

export interface Subscription {
  email: string;
  displayName: string;
  activePlan: PlanId | 'trial';
  selectedPlan: PlanId;
  billingPeriod: BillingPeriod;
  trialStartedAt: string;  // ISO
  trialEndsAt: string;     // ISO
  subscribedAt?: string;
  // Stripe payment status — set by syncSubscriptionFromDB
  stripeStatus?: 'active' | 'past_due' | 'canceled';
  // ISO timestamp when past_due was first detected (for 3-day grace period)
  pastDueSince?: string;
}

// ── Prices (AUD, monthly base) ────────────────────────────────────────────────
export const PLAN_PRICES: Record<PlanId, { monthly: number; annual: number }> = {
  starter:  { monthly: 79,  annual: 63 },   // $63/mo billed annually ($756/yr)
  pro:      { monthly: 149, annual: 119 },  // $119/mo billed annually ($1,428/yr)
  business: { monthly: 279, annual: 223 },  // $223/mo billed annually ($2,676/yr)
};

export const PLAN_NAMES: Record<PlanId, string> = {
  starter:  'Starter',
  pro:      'Professional',
  business: 'Business',
};

export const TRIAL_DAYS = 14;
const STORAGE_KEY = 'estimate_subscription';

// ── Feature caps ──────────────────────────────────────────────────────────────
interface PlanCaps {
  maxProjects: number;
  boqExport: boolean;
  sowExport: boolean;
  tenderDoc: boolean;
  marketInsights: boolean;
  materialsLibrary: boolean;
  teamSeats: number;
  takeoffPdfReport: boolean;
}

export const PLAN_CAPS: Record<PlanId, PlanCaps> = {
  starter: {
    maxProjects: 3,
    boqExport: false,
    sowExport: false,
    tenderDoc: false,
    marketInsights: false,
    materialsLibrary: false,
    teamSeats: 1,
    takeoffPdfReport: false,
  },
  pro: {
    maxProjects: Infinity,
    boqExport: true,
    sowExport: true,
    tenderDoc: true,
    marketInsights: true,
    materialsLibrary: true,
    teamSeats: 1,
    takeoffPdfReport: true,
  },
  business: {
    maxProjects: Infinity,
    boqExport: true,
    sowExport: true,
    tenderDoc: true,
    marketInsights: true,
    materialsLibrary: true,
    teamSeats: 5,
    takeoffPdfReport: true,
  },
};

// Trial always has Pro-level caps
const TRIAL_CAPS = PLAN_CAPS.pro;

// ── Storage helpers ───────────────────────────────────────────────────────────
export function loadSubscription(): Subscription | null {
  try {
    const raw = localStorage.getItem(getUserStorageKey(STORAGE_KEY));
    return raw ? (JSON.parse(raw) as Subscription) : null;
  } catch {
    return null;
  }
}

export function saveSubscription(sub: Subscription): void {
  localStorage.setItem(getUserStorageKey(STORAGE_KEY), JSON.stringify(sub));
}

export function clearSubscription(): void {
  localStorage.removeItem(getUserStorageKey(STORAGE_KEY));
}

// ── Create subscription on signup ─────────────────────────────────────────────
export function createTrialSubscription(
  email: string,
  displayName: string,
  selectedPlan: PlanId,
  billingPeriod: BillingPeriod
): Subscription {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

  const sub: Subscription = {
    email,
    displayName,
    activePlan: 'trial',
    selectedPlan,
    billingPeriod,
    trialStartedAt: now.toISOString(),
    trialEndsAt: trialEnd.toISOString(),
  };
  // Use email param directly — user may not have a session yet (pre-verification)
  localStorage.setItem(`${email}:${STORAGE_KEY}`, JSON.stringify(sub));
  return sub;
}

// ── Derived status ────────────────────────────────────────────────────────────
export interface SubscriptionStatus {
  subscription: Subscription | null;
  isActive: boolean;
  isTrialing: boolean;
  isTrialExpired: boolean;
  daysLeftInTrial: number;
  effectivePlan: PlanId;
  caps: PlanCaps;
  isPastDue: boolean;          // payment failed, within 3-day grace period
  pastDueGraceDaysLeft: number; // days remaining in grace period (0 = grace expired)
}

export function getSubscriptionStatus(): SubscriptionStatus {
  const sub = loadSubscription();

  const GRACE_MS = 3 * 86_400_000

  if (!sub) {
    return {
      subscription: null,
      isActive: false,
      isTrialing: false,
      isTrialExpired: false,
      daysLeftInTrial: 0,
      effectivePlan: 'starter',
      caps: PLAN_CAPS.starter,
      isPastDue: false,
      pastDueGraceDaysLeft: 0,
    };
  }

  const now = Date.now();
  const trialEnd = new Date(sub.trialEndsAt).getTime();
  const isTrialing = sub.activePlan === 'trial' && now < trialEnd;
  const isTrialExpired = sub.activePlan === 'trial' && now >= trialEnd;
  const daysLeft = isTrialing ? Math.ceil((trialEnd - now) / 86_400_000) : 0;

  const isPastDue = sub.stripeStatus === 'past_due';
  const pastDueSinceMs = isPastDue && sub.pastDueSince ? new Date(sub.pastDueSince).getTime() : 0;
  const pastDueGraceDaysLeft = isPastDue
    ? Math.max(0, Math.ceil((pastDueSinceMs + GRACE_MS - now) / 86_400_000))
    : 0;

  let effectivePlan: PlanId = sub.selectedPlan;
  if (isTrialExpired) effectivePlan = 'starter';

  const caps: PlanCaps =
    isTrialing ? TRIAL_CAPS
    : isTrialExpired ? PLAN_CAPS.starter
    : PLAN_CAPS[sub.activePlan as PlanId] ?? PLAN_CAPS.starter;

  return {
    subscription: sub,
    isActive: isTrialing || (!isTrialExpired && sub.activePlan !== 'trial'),
    isTrialing,
    isTrialExpired,
    daysLeftInTrial: daysLeft,
    effectivePlan,
    caps,
    isPastDue,
    pastDueGraceDaysLeft,
  };
}
