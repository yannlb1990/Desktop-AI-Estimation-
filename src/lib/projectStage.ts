/**
 * Where a job is, chosen by the builder. The app never moves a job by itself: when something
 * certain happens (the approval link was sent, the client approved) it records a suggestion
 * the dashboard offers, and the builder's choice always stands.
 */

export type ProjectStage = 'lead' | 'measuring' | 'estimating' | 'quote_sent' | 'won' | 'in_progress' | 'completed' | 'lost';

export const STAGES: { key: ProjectStage; label: string; hint: string }[] = [
  { key: 'lead', label: 'Lead', hint: 'An enquiry, nothing measured yet' },
  { key: 'measuring', label: 'Measuring', hint: 'Takeoff or site visit under way' },
  { key: 'estimating', label: 'Estimating', hint: 'Pricing the estimate' },
  { key: 'quote_sent', label: 'Quote sent', hint: 'With the client' },
  { key: 'won', label: 'Won', hint: 'Client approved, not started' },
  { key: 'in_progress', label: 'In progress', hint: 'Under construction' },
  { key: 'completed', label: 'Completed', hint: 'Handed over' },
  { key: 'lost', label: 'Lost', hint: 'Client went elsewhere' },
];

export const STAGE_LABEL = Object.fromEntries(STAGES.map(s => [s.key, s.label])) as Record<ProjectStage, string>;
const ORDER = Object.fromEntries(STAGES.map((s, i) => [s.key, i])) as Record<ProjectStage, number>;

const isStage = (v: unknown): v is ProjectStage => typeof v === 'string' && v in ORDER;

/**
 * The job's stage: the builder's choice, or, for jobs from before stages existed, a best
 * guess from what the job holds (the builder corrects it with one click).
 */
export function stageOf(p: any): ProjectStage {
  if (isStage(p?.stage)) return p.stage;
  if (p?.status === 'complete' || p?.status === 'completed') return 'completed';
  if (p?.quoteStatus === 'lost') return 'lost';
  if (p?.quoteStatus === 'won' || p?.approved_quote) return (p?.progress_claims ?? []).length ? 'in_progress' : 'won';
  if (p?.quoteStatus === 'sent') return 'quote_sent';
  if ((p?.estimate_items ?? []).length) return 'estimating';
  if (p?.plan_file_name || p?.plan_file_url || (p?.cost_items ?? []).length) return 'measuring';
  return 'lead';
}

/** The older quote status other screens read (draft / sent / won / lost), kept in step. */
export function quoteStatusFor(stage: ProjectStage): 'draft' | 'sent' | 'won' | 'lost' {
  if (stage === 'quote_sent') return 'sent';
  if (stage === 'won' || stage === 'in_progress' || stage === 'completed') return 'won';
  if (stage === 'lost') return 'lost';
  return 'draft';
}

export interface StageSuggestion { stage: ProjectStage; reason: string; at: string }

/** A suggestion still worth showing: it moves the job forward from where it is now. */
export function openSuggestion(p: any): StageSuggestion | null {
  const s = p?.stage_suggestion as StageSuggestion | undefined;
  if (!s || !isStage(s.stage)) return null;
  const now = stageOf(p);
  if (now === 'lost' || ORDER[s.stage] <= ORDER[now]) return null;
  return s;
}

/** The fields to write when the builder picks a stage. */
export function stagePatch(stage: ProjectStage, nowIso = new Date().toISOString()) {
  return { stage, stage_changed_at: nowIso, quoteStatus: quoteStatusFor(stage), stage_suggestion: null };
}

export function stageIndex(stage: ProjectStage): number {
  return ORDER[stage];
}
