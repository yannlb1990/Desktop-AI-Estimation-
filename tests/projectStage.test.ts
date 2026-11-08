import { stageOf, quoteStatusFor, openSuggestion, stagePatch } from '@/lib/projectStage';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };
expect('chosen stage wins', stageOf({ stage: 'lead', estimate_items: [1], quoteStatus: 'won' }) === 'lead');
expect('guess: lines = estimating, not tender ready', stageOf({ estimate_items: [1] }) === 'estimating');
expect('guess: won', stageOf({ quoteStatus: 'won' }) === 'won' && stageOf({ approved_quote: {}, progress_claims: [{}] }) === 'in_progress');
expect('guess: lost and sent', stageOf({ quoteStatus: 'lost', estimate_items: [1] }) === 'lost' && stageOf({ quoteStatus: 'sent' }) === 'quote_sent');
expect('guess: plan = measuring, empty = lead', stageOf({ plan_file_name: 'a.pdf' }) === 'measuring' && stageOf({}) === 'lead');
expect('quote status in step', quoteStatusFor('in_progress') === 'won' && quoteStatusFor('quote_sent') === 'sent' && quoteStatusFor('estimating') === 'draft');
const p = { stage: 'quote_sent', stage_suggestion: { stage: 'won', reason: 'Client approved', at: 'x' } };
expect('forward suggestion shown', openSuggestion(p)?.stage === 'won');
expect('backward suggestion hidden', openSuggestion({ stage: 'in_progress', stage_suggestion: { stage: 'won', reason: '', at: '' } }) === null);
expect('nothing for lost', openSuggestion({ stage: 'lost', stage_suggestion: { stage: 'won', reason: '', at: '' } }) === null);
const patch = stagePatch('won', 't');
expect('patch clears suggestion', patch.stage_suggestion === null && patch.quoteStatus === 'won' && patch.stage_changed_at === 't');
if (failures) { console.log(`${failures} stage failures`); process.exit(1); }
console.log('all stage tests passed');
