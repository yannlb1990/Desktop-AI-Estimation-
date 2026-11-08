import { buildDashboard, nextStep } from '@/lib/dashboardData';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };
const today = new Date('2026-11-20T10:00:00');
const claim = (inc: number, xero?: any): any => ({ id: 'c', number: 1, date: 'x', stages: [], retentionPct: 0, completedToDate: 0, retentionHeld: 0, thisClaimExGst: inc / 1.1, gst: 0, thisClaimIncGst: inc, xero });
const projects = [
  { id: 'a', name: 'A', stage: 'quote_sent', stage_changed_at: '2026-11-01T00:00:00Z', estimate_items: [1] },
  { id: 'b', name: 'B', stage: 'in_progress', approved_quote: { totalIncGst: 110000, approvedAt: '2026-11-03T00:00:00Z' },
    progress_claims: [claim(22000, { invoiceId: 'i', number: 'INV-1', url: '', sentAt: '', status: 'AUTHORISED', amountPaid: 0, amountDue: 22000, dueDate: '2026-11-10' })] },
  { id: 'c', name: 'C', estimate_items: [1] },
  { id: 'd', name: 'D', stage: 'quote_sent', stage_suggestion: { stage: 'won', reason: 'Quote Q-1 approved', at: 'x' } },
  { id: 'e', name: 'E', stage: 'lost' },
];
const d = buildDashboard(projects, p => (p.id === 'a' ? 50000 : p.id === 'c' ? 20000 : 0), p => (p.id === 'c' ? 2 : 0), today);
expect('quotes out', d.quotesOut.count === 2 && d.quotesOut.value === 50000, d.quotesOut);
expect('won this month uses approval date', d.wonThisMonth.count === 1 && d.wonThisMonth.value === 110000, d.wonThisMonth);
expect('owing and overdue', d.owing.amount === 22000 && d.owing.overdue === 22000, d.owing);
expect('in progress', d.inProgress.count === 1);
expect('pipeline has every stage', d.pipeline.length === 8 && d.pipeline.find(c => c.stage === 'estimating')!.count === 1);
expect('attention order', d.attention.map(a => a.kind).join() === 'suggestion,overdue,follow_up,fix', d.attention);
expect('next step: fixes', nextStep({ estimate_items: [1] }, 3, today).label === '3 lines to fix');
expect('next step: follow up', nextStep(projects[0], 0, today).label === 'Follow up (19 days)');
expect('next step: deposit', nextStep({ stage: 'won', approved_quote: {} }, 0, today).label === 'Invoice deposit');
expect('next step: overdue', nextStep(projects[1], 0, today).label.includes('overdue'));
if (failures) { console.log(`${failures} dashboard failures`); process.exit(1); }
console.log('all dashboard tests passed');
