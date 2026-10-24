import { planSiteUpdates } from '@/lib/site/siteUpdates';

let failures = 0;
const expect = (name: string, ok: boolean) => { if (!ok) { failures++; console.log('FAIL', name); } };
const d = (key: string, quantity: number, scope = 'Tile floor') => ({ key, roomId: 'r', roomName: 'Bathroom', scope, trade: 'Tiler', unit: 'm²', quantity, basis: '', needsQuantity: false });

const items = [
  { id: 'a', site_key: 'v1:r:tile_floor', site_qty: 4.32, site_scope: 'Tile floor', quantity: 4.32, scope_of_work: 'Tile floor' }, // untouched, site changed
  { id: 'b', site_key: 'v1:r:tile_walls', site_qty: 20.16, site_scope: 'Tile walls', quantity: 22, scope_of_work: 'Tile walls' }, // estimator edited
  { id: 'c', site_key: 'v1:r:vanity', site_qty: 1, quantity: 1, scope_of_work: 'Vanity and basin' },                               // unticked on site
  { id: 'd', site_key: 'v1:r:strip', site_qty: 4.32, site_scope: 'Strip out', quantity: 4.32, scope_of_work: 'Strip out' },
  { id: 'e', quantity: 3, scope_of_work: 'Manual line' },
  { id: 'f', site_key: 'v2:r:x', site_qty: 1, quantity: 1 },
  // estimator renamed it; site unchanged -> nothing happens (review 1)
  { id: 'h', site_key: 'v1:r:paint', site_qty: 10, site_scope: 'Paint walls', quantity: 10, scope_of_work: 'Paint walls 3 coats' },
];
const drafts = [d('v1:r:tile_floor', 6), d('v1:r:tile_walls', 24, 'Tile walls'), d('v1:r:strip', 4.32, 'Strip out'), d('v1:r:paint', 10, 'Paint walls')];
const p = planSiteUpdates(items, drafts, ['v1']);
expect('untouched line follows', p.follow.length === 1 && p.follow[0].id === 'a' && p.follow[0].quantity === 6);
expect('edited line offered', p.offer.length === 1 && p.offer[0].id === 'b' && p.offer[0].site === 24);
expect('unticked flagged', p.gone.length === 1 && p.gone[0].id === 'c');
expect('renamed line with no site change left alone', ![...p.follow, ...p.offer].some(x => x.id === 'h'));
// legacy line (no site_qty): offered, never overwritten (review 2)
const legacy = planSiteUpdates([{ id: 'g', site_key: 'v1:r:tile_floor', quantity: 5, scope_of_work: 'Tile floor' }], drafts, ['v1']);
expect('legacy line offered not followed', legacy.follow.length === 0 && legacy.offer[0]?.site === 6);
// quantity typed in the panel (site said 0): later site figure is offered (review 3)
const typed = planSiteUpdates([{ id: 't', site_key: 'v1:r:tile_floor', site_qty: 0, site_scope: 'Tile floor', quantity: 5, scope_of_work: 'Tile floor' }], drafts, ['v1']);
expect('typed qty kept, site figure offered', typed.follow.length === 0 && typed.offer[0]?.site === 6);
// dismissed offer: site_qty recorded at the site figure -> no offer until the site changes again
const dismissed = planSiteUpdates([{ id: 'b2', site_key: 'v1:r:tile_walls', site_qty: 24, site_scope: 'Tile walls', quantity: 22, scope_of_work: 'Tile walls' }], drafts, ['v1']);
expect('dismissed offer stays quiet', dismissed.offer.length === 0 && dismissed.follow.length === 0);
// site renamed an untouched line -> name follows
const renamed = planSiteUpdates([{ id: 'n', site_key: 'v1:r:strip', site_qty: 4.32, site_scope: 'Strip-out', quantity: 4.32, scope_of_work: 'Strip-out' }], drafts, ['v1']);
expect('site rename follows', renamed.follow[0]?.scope === 'Strip out');

if (failures) { console.log(`${failures} site update failures`); process.exit(1); }
console.log('all site update tests passed');
