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
import { calculateProjectTotals, resolveProjectPricing, roundCents, gstOn } from '@/lib/pricing/estimatePricing';
import { readUserPricingDefaults } from '@/lib/pricing/userPricingDefaults';
import { supabase } from '@/integrations/supabase/client';
import { shownTotal, lineAmount } from '@/lib/pricing/quoteLines';

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
  /** Set when the client approved through a shared link */
  shareToken?: string;
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
  /** a deposit invoice (no stages); later claims take it off as already claimed */
  kind?: 'deposit';
  depositPct?: number;
  contractExGst?: number;
  /** the draft invoice in Xero, once sent */
  xero?: { invoiceId: string; number?: string; url: string; total?: number; sentAt: string };
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
  return resolveProjectPricing(project, readUserPricingDefaults(project)).config.gstPct;
}

// ── Quote approval ────────────────────────────────────────────────────────────

export function approveQuoteVersion(
  projectId: string,
  version: { id: string; versionNumber: number; quoteNumber: string; lines: { description: string; qty: number; unitPrice: number; included: boolean; trade?: string }[] },
  paymentSchedule?: ApprovedQuote['paymentSchedule'],
  approvedBy?: string,
  extra?: { approvedAt?: string; shareToken?: string },
): ApprovedQuote | null {
  const project = loadProject(projectId);
  if (!project) return null;
  const gstPct = projectGstPct(project);
  const included = version.lines.filter(l => l.included);
  const lines: ApprovedQuoteLine[] = included
    .map(l => ({ description: l.description, trade: l.trade || 'General', amount: lineAmount(l) }));
  // Same subtotal as the quote: the printed line amounts added up
  const subtotalExGst = shownTotal(included);
  const approved: ApprovedQuote = {
    versionId: version.id,
    versionNumber: version.versionNumber,
    quoteNumber: version.quoteNumber,
    approvedAt: extra?.approvedAt ?? new Date().toISOString(),
    approvedBy,
    shareToken: extra?.shareToken,
    subtotalExGst,
    gstPct,
    totalIncGst: roundCents(subtotalExGst + gstOn(subtotalExGst, gstPct)),
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
  const totals = project ? calculateProjectTotals(project, readUserPricingDefaults(project)) : null;
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

export { computeClaim } from './contractMath';

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

// ── Client approval links ─────────────────────────────────────────────────────

export interface QuoteSharePayload {
  versionId: string;
  versionNumber: number;
  quoteNumber: string;
  projectName: string;
  clientName: string;
  siteAddress: string;
  company: { name?: string; abn?: string; phone?: string; email?: string };
  lines: { description: string; trade: string; qty: number; unit: string; unitPrice: number }[];
  subtotalExGst: number;
  gstPct: number;
  gst: number;
  totalIncGst: number;
  paymentSchedule?: ApprovedQuote['paymentSchedule'];
}

export interface QuoteShareRow {
  token: string;
  quote_version_id: string | null;
  payload: QuoteSharePayload;
  status: 'pending' | 'approved' | 'changes_requested';
  responded_name: string | null;
  responded_at: string | null;
  comments: string | null;
  expires_at: string;
  created_at: string;
}

export function quoteShareUrl(token: string): string {
  return `${window.location.origin}/quote/${token}`;
}

/** Snapshot a saved quote version and create a private link the client can approve. */
export async function createQuoteShare(
  projectId: string,
  version: { id: string; versionNumber: number; quoteNumber: string; lines: { description: string; qty: number; unit: string; unitPrice: number; included: boolean; trade?: string }[] },
  company: QuoteSharePayload['company'],
  paymentSchedule?: ApprovedQuote['paymentSchedule'],
): Promise<string> {
  const project = loadProject(projectId);
  if (!project) throw new Error('Project not found');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again');

  const gstPct = projectGstPct(project);
  const lines = version.lines.filter(l => l.included).map(l => ({
    description: l.description, trade: l.trade || 'General', qty: l.qty, unit: l.unit, unitPrice: l.unitPrice,
  }));
  const subtotalExGst = shownTotal(lines);
  const gst = gstOn(subtotalExGst, gstPct);
  const payload: QuoteSharePayload = {
    versionId: version.id,
    versionNumber: version.versionNumber,
    quoteNumber: version.quoteNumber,
    projectName: project.name || 'Project',
    clientName: project.client_name || '',
    siteAddress: project.site_address || project.address || '',
    company,
    lines,
    subtotalExGst,
    gstPct,
    gst,
    totalIncGst: roundCents(subtotalExGst + gst),
    paymentSchedule,
  };
  const { data, error } = await (supabase as any)
    .from('quote_shares')
    .insert({ user_id: session.user.id, project_id: projectId, quote_version_id: version.id, payload })
    .select('token')
    .single();
  if (error) {
    throw new Error(/relation .*quote_shares.* does not exist|schema cache/i.test(error.message)
      ? 'Client approval links are not set up on the database yet'
      : error.message);
  }
  return data.token as string;
}

export async function loadQuoteShares(projectId: string): Promise<QuoteShareRow[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('quote_shares')
      .select('token, quote_version_id, payload, status, responded_name, responded_at, comments, expires_at, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as QuoteShareRow[];
  } catch {
    return [];
  }
}

/**
 * If the client approved a quote through a link, record it as the project's approved
 * quote (once). Returns the newly recorded approval, or null if nothing changed.
 */
export async function syncClientApprovals(projectId: string): Promise<ApprovedQuote | null> {
  const project = loadProject(projectId);
  if (!project) return null;
  const shares = await loadQuoteShares(projectId);
  const approved = shares
    .filter(s => s.status === 'approved' && s.responded_at)
    .sort((a, b) => (b.responded_at || '').localeCompare(a.responded_at || ''))[0];
  if (!approved) return null;
  const current: ApprovedQuote | null = project.approved_quote ?? null;
  if (current?.shareToken === approved.token) return null;
  // A newer manual approval wins over an older client approval
  if (current && !current.shareToken && current.approvedAt > (approved.responded_at || '')) return null;
  const p = approved.payload;
  return approveQuoteVersion(
    projectId,
    { id: p.versionId, versionNumber: p.versionNumber, quoteNumber: p.quoteNumber, lines: p.lines.map(l => ({ ...l, included: true })) },
    p.paymentSchedule,
    approved.responded_name ?? undefined,
    { approvedAt: approved.responded_at ?? undefined, shareToken: approved.token },
  );
}
