import { claimInvoiceLines, depositCapPct } from '@/lib/xero/claimInvoice';
import { computeClaim } from '@/lib/contractMath';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };
const sum = (ls: { amount: number }[]) => Math.round(ls.reduce((s, l) => s + l.amount, 0) * 100) / 100;

const deposit: any = { id: 'd', number: 1, date: '2026-10-25', stages: [], retentionPct: 0, completedToDate: 0, retentionHeld: 0, thisClaimExGst: 2500, gst: 250, thisClaimIncGst: 2750, kind: 'deposit', depositPct: 5, contractExGst: 50000 };
const stages = (a: number, b: number) => [{ id: 'carp', name: 'Carpenter', value: 30000, percentComplete: a }, { id: 'tile', name: 'Tiler', value: 20000, percentComplete: b }];
const mk = (id: string, n: number, st: any[], prev: any[]) => ({ id, number: n, date: '2026-11-01', stages: st, retentionPct: 5, ...computeClaim(st, 5, prev, 10) });

const c1: any = mk('c1', 2, stages(50, 0), [deposit]);
let lines = claimInvoiceLines(c1, [deposit, c1], 'Q-12');
expect('claim 1 adds up', sum(lines) === c1.thisClaimExGst, [sum(lines), c1.thisClaimExGst]);
expect('claim 1 lines', lines.length === 3 && lines[0].amount === 15000 && lines[1].amount === -750 && lines[2].description.includes('deposit') && lines[2].amount === -2500, lines);

const c2: any = mk('c2', 3, stages(100, 40), [deposit, c1]);
lines = claimInvoiceLines(c2, [deposit, c1, c2], 'Q-12');
expect('claim 2 adds up', sum(lines) === c2.thisClaimExGst, [sum(lines), c2.thisClaimExGst]);
expect('claim 2: work since claim 1 only, no deposit line', lines[0].amount === 15000 && lines[1].amount === 8000 && !lines.some(l => /deposit/i.test(l.description)), lines);

lines = claimInvoiceLines(deposit, [deposit], 'Q-12');
expect('deposit line', lines.length === 1 && lines[0].amount === 2500 && lines[0].description.includes('5%'), lines);
expect('QLD cap', depositCapPct(19999) === 10 && depositCapPct(20000) === 5);

// awkward cents still add up exactly
const odd = [{ id: 'a', name: 'A', value: 333.33, percentComplete: 33.3 }, { id: 'b', name: 'B', value: 777.77, percentComplete: 66.7 }];
const c3: any = { id: 'c3', number: 1, date: 'x', stages: odd, retentionPct: 2.5, ...computeClaim(odd, 2.5, [], 10) };
expect('odd cents add up', sum(claimInvoiceLines(c3, [c3])) === c3.thisClaimExGst, [sum(claimInvoiceLines(c3, [c3])), c3.thisClaimExGst]);

// retention drops at practical completion: a release, not a deduction
const c4: any = { id: 'c4', number: 4, date: 'x', stages: stages(100, 100), retentionPct: 2.5, ...computeClaim(stages(100, 100), 2.5, [deposit, c1, c2], 10) };
lines = claimInvoiceLines(c4, [deposit, c1, c2, c4]);
expect('release adds up', sum(lines) === c4.thisClaimExGst, [sum(lines), c4.thisClaimExGst]);
expect('release worded as release', lines.some(l => /released/i.test(l.description) && l.amount > 0), lines);

// a variation invoiced on its own: its items are the lines; later claims do not count it
const vo: any = { id: 'v1', number: 0, date: 'x', stages: [], retentionPct: 0, completedToDate: 0, retentionHeld: 0, thisClaimExGst: 1250, gst: 125, thisClaimIncGst: 1375, kind: 'variation', variationId: 'abc', variationLabel: 'Variation VO-003: Extra power points',
  variationItems: [{ description: 'Double power point', qty: 6, unit: 'ea', rate: 150, amount: 900 }, { description: 'Circuit to garage', qty: 1, unit: 'ls', rate: 350, amount: 350 }] };
lines = claimInvoiceLines(vo, [vo]);
expect('variation lines from items', lines.length === 2 && lines[0].amount === 900 && lines[0].kind === 'variation' && lines[0].description.includes('6 ea'), lines);
expect('variation adds up', sum(lines) === 1250);
const withVo: any = mk('c9', 1, stages(10, 0), [vo]);
expect('variation invoice not counted as claimed', withVo.previouslyClaimedExGst === 0, withVo.previouslyClaimedExGst);

if (failures) { console.log(`${failures} claim invoice failures`); process.exit(1); }
console.log('all claim invoice tests passed');
