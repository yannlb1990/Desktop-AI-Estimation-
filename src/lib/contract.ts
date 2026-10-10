/**
 * The contract for a project: the quote version the client approved, plus approved
 * variations. Job Cost and Progress Claims both work off this, so they always agree
 * with what the client actually signed.
 *
 * Stored on the project record (synced to Supabase via syncProjectToSupabase).
 */
import { getUserStorageKey } from '@/lib/localAuth';
import { syncProjectToSupabase } from '@/lib/db/projects';
import { lsLoadVariations } from '@/lib/db/variations';
import { calculateProjectTotals, resolveProjectPricing, roundCents } from '@/lib/pricing/estimatePricing';
import { readUserPricingDefaults } from '@/lib/pricing/userPricingDefaults';

export interface ApprovedQuoteLine {
  description: string;
  trade: string;
  amount: number; // ex GST
}

export interface ApprovedQuote {
  versionId: string;
  versionNumber: number;
  quoteNumber: string;
  approvedAt: string;
  approvedBy?: string;
  subtotalExGst: number;
  gstPct: number;
  totalIncGst: number;
  lines: ApprovedQuoteLine[];
  paymentSchedule?: { depositPct: number; progressPct: number; finalPct: number };
}

export interface ClaimStage {
  id: string;
  name: string;
  value: number;            // ex GST
  percentComplete: number;  // cumulative, 0-100
}

export interface ProgressClaimRecord {
  id: string;
  number: number;
  date: string;
  stages: ClaimStage[];
  retentionPct: number;
  completedToDate: number;  // value of work completed to date, ex GST
  retentionHeld: number;
  thisClaimExGst: number;
  gst: number;
  thisClaimIncGst: number;
}

// ── Project record helpers ────────────────────────────────────────────────────

export function loadProject(projectId: string): any | null {
  try {
    const projects: any[] = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    return projects.find(p => p.id === projectId) ?? null;
  } catch {
    return null;
  }
}

function patchProject(projectId: string, patch: Record<string, unknown>): any | null {
  const key = getUserStorageKey('local_projects');
  const projects: any[] = JSON.parse(localStorage.getItem(key) || '[]');
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1) return null;
  projects[idx] = { ...projects[idx], ...patch };
  localStorage.setItem(key, JSON.stringify(projects));
  syncProjectToSupabase(projects[idx]);
  return projects[idx];
}

export function projectGstPct(project: any): number {
  return resolveProjectPricing(project, readUserPricingDefaults()).config.gstPct;
}

// ── Quote approval ────────────────────────────────────────────────────────────

export function approveQuoteVersion(
  projectId: string,
  version: { id: string; versionNumber: number; quoteNumber: string; lines: { description: string; qty: number; unitPrice: number; included: boolean; trade?: string }[] },
  paymentSchedule?: ApprovedQuote['paymentSchedule'],
  approvedBy?: string,
): ApprovedQuote | null {
  const project = loadProject(projectId);
  if (!project) return null;
  const gstPct = projectGstPct(project);
  const included = version.lines.filter(l => l.included);
  const lines: ApprovedQuoteLine[] = included
    .map(l => ({ description: l.description, trade: l.trade || 'General', amount: roundCents(l.qty * l.unitPrice) }));
  // Same rounding as the quote: sum the unrounded line amounts, then round once
  const subtotalExGst = roundCents(included.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const approved: ApprovedQuote = {
    versionId: version.id,
    versionNumber: version.versionNumber,
    quoteNumber: version.quoteNumber,
    approvedAt: new Date().toISOString(),
    approvedBy,
    subtotalExGst,
    gstPct,
    totalIncGst: roundCents(subtotalExGst + roundCents(subtotalExGst * gstPct / 100)),
    lines,
    paymentSchedule,
  };
  patchProject(projectId, { approved_quote: approved, quoteStatus: 'won' });
  return approved;
}

export function clearQuoteApproval(projectId: string): void {
  patchProject(projectId, { approved_quote: null, quoteStatus: 'sent' });
}

// ── Contract value ────────────────────────────────────────────────────────────

export function approvedVariationsExGst(projectId: string): { total: number; items: { id: string; name: string; amount: number }[] } {
  const approved = lsLoadVariations(projectId).filter((v: any) => v.status === 'approved');
  const items = approved.map((v: any) => ({
    id: `vo-${v.id}`,
    name: `Variation VO-${String(v.number).padStart(3, '0')}: ${v.title || 'Untitled'}`,
    amount: Number(v.totalAmount) || 0,
  }));
  return { total: roundCents(items.reduce((s, i) => s + i.amount, 0)), items };
}

export interface ContractSummary {
  approvedQuote: ApprovedQuote | null;
  quoteExGst: number;
  variationsExGst: number;
  contractExGst: number;
  gstPct: number;
  contractIncGst: number;
  /** Estimated cost to deliver (estimate before margin), the budget for job costing */
  estimatedCostExGst: number;
}

export function contractSummary(projectId: string): ContractSummary {
  const project = loadProject(projectId);
  const gstPct = project ? projectGstPct(project) : 10;
  const approvedQuote: ApprovedQuote | null = project?.approved_quote ?? null;
  const variations = approvedVariationsExGst(projectId);
  const totals = project ? calculateProjectTotals(project, readUserPricingDefaults()) : null;
  const quoteExGst = approvedQuote?.subtotalExGst ?? 0;
  const contractExGst = roundCents(quoteExGst + variations.total);
  return {
    approvedQuote,
    quoteExGst,
    variationsExGst: variations.total,
    contractExGst,
    gstPct,
    contractIncGst: roundCents(contractExGst + roundCents(contractExGst * gstPct / 100)),
    estimatedCostExGst: totals ? roundCents(totals.taxable - totals.margin - totals.totalMarkup) : 0,
  };
}

// ── Progress claims ───────────────────────────────────────────────────────────

export function loadProgressClaims(projectId: string): ProgressClaimRecord[] {
  return (loadProject(projectId)?.progress_claims as ProgressClaimRecord[]) ?? [];
}

export function saveProgressClaims(projectId: string, claims: ProgressClaimRecord[]): void {
  patchProject(projectId, { progress_claims: claims });
}

/**
 * SOPA-style claim maths: value of work completed to date, less retention held,
 * less the net amount already claimed, equals this claim (plus GST).
 */
export function computeClaim(stages: ClaimStage[], retentionPct: number, previousClaims: ProgressClaimRecord[], gstPct: number) {
  const completedToDate = roundCents(stages.reduce((s, st) => s + (st.value || 0) * ((st.percentComplete || 0) / 100), 0));
  const retentionHeld = roundCents(completedToDate * (retentionPct / 100));
  const previouslyClaimedExGst = roundCents(previousClaims.reduce((s, c) => s + c.thisClaimExGst, 0));
  const thisClaimExGst = roundCents(completedToDate - retentionHeld - previouslyClaimedExGst);
  const gst = roundCents(thisClaimExGst * (gstPct / 100));
  return { completedToDate, retentionHeld, previouslyClaimedExGst, thisClaimExGst, gst, thisClaimIncGst: roundCents(thisClaimExGst + gst) };
}

/** Stages for a first claim: the approved quote's lines grouped by trade, plus approved variations. */
export function stagesFromContract(projectId: string): ClaimStage[] {
  const project = loadProject(projectId);
  const approved: ApprovedQuote | null = project?.approved_quote ?? null;
  const byTrade = new Map<string, number>();
  approved?.lines.forEach(l => byTrade.set(l.trade, (byTrade.get(l.trade) || 0) + l.amount));
  const stages: ClaimStage[] = [...byTrade.entries()].map(([trade, value]) => ({
    id: `trade-${trade}`, name: trade, value: roundCents(value), percentComplete: 0,
  }));
  approvedVariationsExGst(projectId).items.forEach(v => stages.push({ id: v.id, name: v.name, value: v.amount, percentComplete: 0 }));
  return stages;
}

/** Keep the % complete from the last claim, and add stages for anything new (e.g. a newly approved variation). */
export function stagesForNextClaim(projectId: string, previous: ProgressClaimRecord | undefined): ClaimStage[] {
  const fresh = stagesFromContract(projectId);
  if (!previous) return fresh;
  const lastPct = new Map(previous.stages.map(s => [s.id, s.percentComplete]));
  const merged = fresh.map(s => ({ ...s, percentComplete: lastPct.get(s.id) ?? 0 }));
  // Stages added by hand on earlier claims are kept
  previous.stages.filter(s => !fresh.some(f => f.id === s.id)).forEach(s => merged.push({ ...s }));
  return merged;
}
