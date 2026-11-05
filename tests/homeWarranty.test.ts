import { qbccPremium, homeWarranty } from '@/lib/pricing/homeWarranty';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };
// figures straight from the QBCC tables
expect('new 180,000', qbccPremium(180000, 'new') === 1016.45, qbccPremium(180000, 'new'));
expect('new 180,001 pays next step', qbccPremium(180001, 'new') === 1021.15, qbccPremium(180001, 'new'));
expect('new 5,000', qbccPremium(5000, 'new') === 202.15);
expect('renovation 5,000', qbccPremium(5000, 'renovation') === 222);
expect('renovation 180,000', qbccPremium(180000, 'renovation') === 1731.2, qbccPremium(180000, 'renovation'));
expect('minimum row', qbccPremium(3300, 'new') === 194.25 && qbccPremium(3300, 'renovation') === 209.85);
expect('3,000,000', qbccPremium(3_000_000, 'new') === 20671.45);
expect('over 3M', qbccPremium(3_000_500, 'new') === 20674.65, qbccPremium(3_000_500, 'new'));

const q = homeWarranty('QLD', 3000, { work: 'new' });
expect('QLD under threshold', !q.required && q.premium === 0);
const q2 = homeWarranty('qld', 180000, { work: 'renovation' });
expect('QLD table', q2.required && q2.basis === 'table' && q2.premium === 1731.2, q2);
const n = homeWarranty('NSW', 100000, {});
expect('NSW typical rate', n.required && n.basis === 'rate' && n.premium === 1100, n);
expect('NSW under 20k', !homeWarranty('NSW', 20000).required);
expect('own amount wins', homeWarranty('NSW', 100000, { amount: 1234.5 }).premium === 1234.5);
expect('own rate', homeWarranty('WA', 200000, { ratePct: 0.6 }).premium === 1200);
const t = homeWarranty('TAS', 500000);
expect('TAS none', !t.required && t.premium === 0);
if (failures) { console.log(`${failures} home warranty failures`); process.exit(1); }
console.log('all home warranty tests passed');
