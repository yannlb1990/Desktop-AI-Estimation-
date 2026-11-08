/**
 * What the dashboard shows, worked out from the projects: the numbers that matter, the
 * jobs that need something done, the pipeline by stage, and each job's next step.
 */
import { jobMoney } from '@/lib/xero/money';
import { STAGES, STAGE_LABEL, stageOf, openSuggestion, type ProjectStage } from '@/lib/projectStage';

export interface NextStep { label: string; tab?: string; tone: 'normal' | 'warn' | 'done' }

export interface AttentionItem {
  projectId: string;
  projectName: string;
  text: string;
  kind: 'suggestion' | 'overdue' | 'follow_up' | 'fix';
  tab?: string;
  suggestion?: ProjectStage;
}

export interface DashboardData {
  quotesOut: { count: number; value: number };
  wonThisMonth: { count: number; value: number };
  owing: { amount: number; overdue: number };
  inProgress: { count: number; value: number };
  pipeline: { stage: ProjectStage; label: string; count: number; value: number }[];
  attention: AttentionItem[];
}

const DAY = 86_400_000;
const money = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);

/** The job's value: the approved quote once there is one, else the estimate's total. */
export function jobValue(p: any, estimateValue: (p: any) => number): number {
  return p?.approved_quote?.totalIncGst ?? estimateValue(p);
}

export function nextStep(p: any, fixes: number, today = new Date()): NextStep {
  const stage = stageOf(p);
  const claims: any[] = p?.progress_claims ?? [];
  const cash = claims.length ? jobMoney(0, claims, today.toISOString().slice(0, 10)) : null;
  switch (stage) {
    case 'lead': return { label: 'Start measuring', tone: 'normal' };
    case 'measuring': return { label: 'Open takeoff', tone: 'normal' };
    case 'estimating': return fixes > 0
      ? { label: `${fixes} line${fixes !== 1 ? 's' : ''} to fix`, tab: 'estimate', tone: 'warn' }
      : { label: 'Make the quote', tab: 'estimate', tone: 'normal' };
    case 'quote_sent': {
      const since = p?.stage_changed_at ? Math.floor((today.getTime() - new Date(p.stage_changed_at).getTime()) / DAY) : null;
      return { label: since != null && since >= 7 ? `Follow up (${since} days)` : 'Waiting on client', tab: 'estimate', tone: since != null && since >= 7 ? 'warn' : 'normal' };
    }
    case 'won': return p?.approved_quote
      ? { label: claims.length ? 'Next claim' : 'Invoice deposit', tab: 'progressclaim', tone: 'normal' }
      : { label: 'Record the approval', tab: 'estimate', tone: 'warn' };
    case 'in_progress':
      if (cash && cash.overdueIncGst > 0.004) return { label: `${money(cash.overdueIncGst)} overdue`, tab: 'progressclaim', tone: 'warn' };
      return { label: 'Next claim', tab: 'progressclaim', tone: 'normal' };
    case 'completed':
      if (cash && cash.owingIncGst > 0.004) return { label: `${money(cash.owingIncGst)} owing`, tab: 'progressclaim', tone: cash.overdueIncGst > 0.004 ? 'warn' : 'normal' };
      return { label: 'Paid up', tab: 'progressclaim', tone: 'done' };
    case 'lost': return { label: '', tone: 'done' };
  }
}

export function buildDashboard(
  projects: any[],
  estimateValue: (p: any) => number,
  fixesFor: (p: any) => number,
  today = new Date(),
): DashboardData {
  const isoDay = today.toISOString().slice(0, 10);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const pipeline = STAGES.map(s => ({ stage: s.key, label: s.label, count: 0, value: 0 }));
  const d: DashboardData = {
    quotesOut: { count: 0, value: 0 }, wonThisMonth: { count: 0, value: 0 },
    owing: { amount: 0, overdue: 0 }, inProgress: { count: 0, value: 0 }, pipeline, attention: [],
  };
  const attention: (AttentionItem & { rank: number })[] = [];

  for (const p of projects) {
    const stage = stageOf(p);
    const value = jobValue(p, estimateValue);
    const col = pipeline.find(c => c.stage === stage)!;
    col.count++; col.value += value;
    if (stage === 'quote_sent') { d.quotesOut.count++; d.quotesOut.value += value; }
    if (stage === 'in_progress') { d.inProgress.count++; d.inProgress.value += value; }
    if (stage === 'won' || stage === 'in_progress' || stage === 'completed') {
      const when = new Date(p?.approved_quote?.approvedAt ?? p?.stage_changed_at ?? 0).getTime();
      if (when >= monthStart) { d.wonThisMonth.count++; d.wonThisMonth.value += value; }
    }
    const claims: any[] = p?.progress_claims ?? [];
    if (claims.length) {
      const m = jobMoney(0, claims, isoDay);
      d.owing.amount += m.owingIncGst; d.owing.overdue += m.overdueIncGst;
      if (m.overdueIncGst > 0.004) attention.push({ rank: 1, projectId: p.id, projectName: p.name, kind: 'overdue', tab: 'progressclaim', text: `${money(m.overdueIncGst)} overdue` });
    }
    const sug = openSuggestion(p);
    if (sug) attention.push({ rank: 0, projectId: p.id, projectName: p.name, kind: 'suggestion', suggestion: sug.stage, text: `${sug.reason}. Move to ${STAGE_LABEL[sug.stage]}?` });
    if (stage === 'quote_sent' && p?.stage_changed_at) {
      const days = Math.floor((today.getTime() - new Date(p.stage_changed_at).getTime()) / DAY);
      if (days >= 7) attention.push({ rank: 2, projectId: p.id, projectName: p.name, kind: 'follow_up', tab: 'estimate', text: `Quote sent ${days} days ago: follow up` });
    }
    if (stage === 'estimating') {
      const fixes = fixesFor(p);
      if (fixes > 0) attention.push({ rank: 3, projectId: p.id, projectName: p.name, kind: 'fix', tab: 'estimate', text: `${fixes} line${fixes !== 1 ? 's' : ''} to fix before quoting` });
    }
  }
  d.attention = attention.sort((a, b) => a.rank - b.rank).map(({ rank: _r, ...a }) => a);
  return d;
}
