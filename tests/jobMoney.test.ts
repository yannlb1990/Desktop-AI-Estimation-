import { jobMoney, xeroStateLabel } from '@/lib/xero/money';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };
const rec = (id: string, inc: number, xero?: any, kind?: any): any => ({ id, number: 1, date: 'x', stages: [], retentionPct: 5, completedToDate: 0, retentionHeld: 500, thisClaimExGst: inc / 1.1, gst: 0, thisClaimIncGst: inc, kind, xero });
const today = '2026-11-20';
const claims = [
  rec('d', 5500, { invoiceId: 'a', number: 'INV-1', url: '', sentAt: '', status: 'PAID', amountPaid: 5500, amountDue: 0, paidOn: '2026-10-30' }, 'deposit'),
  rec('c1', 22000, { invoiceId: 'b', number: 'INV-2', url: '', sentAt: '', status: 'AUTHORISED', amountPaid: 10000, amountDue: 12000, dueDate: '2026-11-10' }),
  rec('c2', 11000, { invoiceId: 'c', number: 'INV-3', url: '', sentAt: '', status: 'DRAFT', amountPaid: 0, amountDue: 11000 }),
  rec('c3', 3300, { invoiceId: 'e', number: 'INV-4', url: '', sentAt: '', status: 'VOIDED' }),
  rec('c4', 1100),
];
const m = jobMoney(110000, claims, today);
expect('claimed skips voided', m.claimedIncGst === 39600, m);
expect('paid', m.paidIncGst === 15500, m);
expect('owing only issued', m.owingIncGst === 12000, m);
expect('overdue', m.overdueIncGst === 12000, m);
expect('not issued: draft + unsent', m.notIssuedIncGst === 12100, m);
expect('left to claim', m.leftToClaimIncGst === 70400, m);
expect('labels', xeroStateLabel(claims[0].xero, today)!.tone === 'done' && xeroStateLabel(claims[1].xero, today)!.text.includes('part paid') && xeroStateLabel(claims[1].xero, today)!.tone === 'late');
if (failures) { console.log(`${failures} job money failures`); process.exit(1); }
console.log('all job money tests passed');
