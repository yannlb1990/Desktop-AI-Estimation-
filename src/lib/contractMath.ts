// Claim maths with no app dependencies, so it can be tested on its own.
import { roundCents, gstOn } from '@/lib/pricing/estimatePricing';
import type { ClaimStage, ProgressClaimRecord } from './contract';

/**
 * SOPA-style claim maths: value of work completed to date, less retention held,
 * less the net amount already claimed, equals this claim (plus GST).
 */
export function computeClaim(stages: ClaimStage[], retentionPct: number, previousClaims: ProgressClaimRecord[], gstPct: number) {
  const completedToDate = roundCents(stages.reduce((s, st) => s + (st.value || 0) * ((st.percentComplete || 0) / 100), 0));
  const retentionHeld = roundCents(completedToDate * (retentionPct / 100));
  // a variation invoiced on its own is outside the stages, so it is not "already claimed" here
  const previouslyClaimedExGst = roundCents(previousClaims.filter(c => c.kind !== 'variation').reduce((s, c) => s + c.thisClaimExGst, 0));
  const thisClaimExGst = roundCents(completedToDate - retentionHeld - previouslyClaimedExGst);
  const gst = gstOn(thisClaimExGst, gstPct);
  return { completedToDate, retentionHeld, previouslyClaimedExGst, thisClaimExGst, gst, thisClaimIncGst: roundCents(thisClaimExGst + gst) };
}

