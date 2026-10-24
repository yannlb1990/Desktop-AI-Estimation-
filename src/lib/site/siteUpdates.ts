/**
 * A visit changed on the phone after its lines went into the estimate. Lines follow it
 * instead of new ones being added. Each line remembers what the site said when it was
 * added or last followed (site_qty, site_scope); only a change on the site side counts:
 * - a line the estimator never changed takes the site's new quantity or name by itself
 * - a line the estimator edited keeps their figure; the site's new figure is offered
 *   (dismissing the offer records the site's figure, so it is not offered again)
 * - a line whose item was unticked on site is flagged, not deleted
 * - lines added before this existed (no site_qty) are only ever offered, never changed
 */
import type { SiteDraftLine } from './toEstimate';

export interface SiteLinkedItem {
  id: string;
  site_key?: string;
  site_qty?: number;
  site_scope?: string;
  quantity: number;
  scope_of_work?: string;
}

export interface SiteChange { id: string; quantity?: number; scope?: string; siteQty?: number; siteScope?: string; remove?: boolean }

export interface SitePlan {
  follow: SiteChange[];
  offer: { id: string; current: number; site: number; unit: string; scope: string }[];
  gone: { id: string; scope: string }[];
}

const same = (a: number, b: number) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;

export function planSiteUpdates(items: SiteLinkedItem[], drafts: SiteDraftLine[], visitIds: string[]): SitePlan {
  const byKey = new Map(drafts.map(d => [d.key, d]));
  const plan: SitePlan = { follow: [], offer: [], gone: [] };
  for (const it of items) {
    if (!it.site_key || !visitIds.some(v => it.site_key!.startsWith(`${v}:`))) continue;
    // AI suggestions are one-off drafts, not part of what the phone keeps in step
    if (it.site_key.includes(':ai:')) continue;
    const d = byKey.get(it.site_key);
    if (!d) { plan.gone.push({ id: it.id, scope: it.scope_of_work || 'Site line' }); continue; }
    const legacy = it.site_qty === undefined;
    const qtyChanged = legacy ? !same(d.quantity, it.quantity) : !same(d.quantity, it.site_qty!);
    const scopeChanged = it.site_scope !== undefined && it.site_scope !== d.scope;
    if (!qtyChanged && !scopeChanged) continue;

    const qtyUntouched = !legacy && same(it.quantity, it.site_qty!);
    const nameUntouched = it.site_scope === undefined || (it.scope_of_work ?? '') === it.site_scope;
    const change: SiteChange = { id: it.id, siteQty: d.quantity, siteScope: d.scope };
    let follow = false;
    if (qtyChanged && qtyUntouched && d.quantity > 0) { change.quantity = d.quantity; follow = true; }
    if (scopeChanged && nameUntouched && !legacy) { change.scope = d.scope; follow = true; }
    if (follow) plan.follow.push(change);
    if (qtyChanged && d.quantity > 0 && !same(d.quantity, it.quantity) && change.quantity === undefined) {
      plan.offer.push({ id: it.id, current: it.quantity, site: d.quantity, unit: d.unit, scope: d.scope });
    }
  }
  return plan;
}
