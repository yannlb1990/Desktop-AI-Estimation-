import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getUserStorageKey } from '@/lib/localAuth';
import { syncProjectToSupabase } from '@/lib/db/projects';
import { projectVisits, photoUrl } from '@/lib/site/siteStore';
import { draftLinesFromVisit, siteScopeText, type SiteDraftLine } from '@/lib/site/toEstimate';
import { planSiteUpdates, type SiteLinkedItem, type SiteChange } from '@/lib/site/siteUpdates';
import type { SitePhoto, SiteVisit } from '@/lib/site/visit';

interface Props {
  projectId: string;
  /** keys of site lines already in this estimate */
  addedKeys: Set<string>;
  /** estimate lines, to keep the ones from site in step with the visit */
  siteItems: SiteLinkedItem[];
  onAdd: (lines: SiteDraftLine[], visit: SiteVisit) => void;
  onUpdate: (changes: SiteChange[], quiet?: boolean) => void;
}

function Thumb({ photo, onOpen }: { photo: SitePhoto; onOpen: (url: string) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    photoUrl(photo).then(u => { url = u; setSrc(u); });
    return () => { if (url?.startsWith('blob:')) URL.revokeObjectURL(url); };
  }, [photo.id, photo.path]);
  if (!photo.path && !src) return <div className="grid h-16 w-16 place-items-center rounded border border-border text-[10px] text-muted-foreground">uploading</div>;
  return (
    <button type="button" onClick={() => src && onOpen(src)} className="h-16 w-16 overflow-hidden rounded border border-border bg-muted">
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
    </button>
  );
}

/** Estimate > Add to estimate: what was recorded on site for this project, ready to price. */
export function SiteVisitPanel({ projectId, addedKeys, siteItems, onAdd, onUpdate }: Props) {
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [qtyOverride, setQtyOverride] = useState<Record<string, string>>({});
  const [bigPhoto, setBigPhoto] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    projectVisits(projectId).then(vs => { if (alive) setVisits(vs); }).catch(() => {});
    return () => { alive = false; };
  }, [projectId]);

  const drafts = useMemo(() => visits.map(v => ({ v, lines: draftLinesFromVisit(v) })), [visits]);
  const plan = useMemo(() => planSiteUpdates(siteItems, drafts.flatMap(d => d.lines), visits.map(v => v.id)), [siteItems, drafts, visits]);

  // Lines nobody touched in the estimate follow the site by themselves
  useEffect(() => {
    if (plan.follow.length) onUpdate(plan.follow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.follow.map(f => `${f.id}:${f.quantity}:${f.scope}:${f.siteQty}`).join('|')]);

  if (visits.length === 0) return null;
  const withQty = (l: SiteDraftLine): SiteDraftLine => {
    const typed = parseFloat((qtyOverride[l.key] ?? '').replace(',', '.'));
    // the site's own figure is kept separately, so a later site figure is offered, not forced
    return Number.isFinite(typed) && typed > 0 ? { ...l, quantity: typed, needsQuantity: false, siteQuantity: l.quantity } : l;
  };

  const copyNotes = (v: SiteVisit) => {
    try {
      const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
      const idx = projects.findIndex((p: any) => p.id === projectId);
      if (idx === -1) return;
      projects[idx].site_scope_notes = siteScopeText(v);
      localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
      syncProjectToSupabase(projects[idx]);
      toast.success('Site notes saved to the project: they fill the scope notes on the quote');
    } catch { toast.error('Could not save the notes'); }
  };

  return (
    <div className="mt-3 rounded-lg border border-border px-4 py-3 text-sm space-y-4">
      <div className="font-medium">From site</div>
      {(plan.offer.length > 0 || plan.gone.length > 0) && (
        <div className="rounded-md border border-amber-400/40 bg-amber-400/5 p-3 space-y-1.5">
          <div className="text-amber-400">Changed on site since you priced it</div>
          {plan.offer.map(o => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{o.scope}: estimate has {o.current} {o.unit}, site now says {o.site} {o.unit}</span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onUpdate([{ id: o.id, quantity: o.site, siteQty: o.site }])}>Use {o.site}</Button>
                <Button size="sm" variant="ghost" onClick={() => onUpdate([{ id: o.id, siteQty: o.site }], true)}>Keep mine</Button>
              </span>
            </div>
          ))}
          {plan.gone.map(g => (
            <div key={g.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{g.scope}: no longer ticked on site</span>
              <Button size="sm" variant="outline" onClick={() => onUpdate([{ id: g.id, remove: true }])}>Remove line</Button>
            </div>
          ))}
        </div>
      )}
      {drafts.map(({ v, lines }) => {
        const fresh = lines.filter(l => !addedKeys.has(l.key));
        const chosen = fresh.filter(l => picked.has(l.key));
        return (
          <div key={v.id} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <span className="font-medium">{v.jobName || 'Site visit'}</span>
                <span className="ml-2 text-muted-foreground">{new Date(v.updatedAt).toLocaleDateString('en-AU')} · {v.status === 'sent' ? 'sent from site' : 'draft on the phone'}</span>
              </span>
              <button type="button" className="text-xs text-[#D4A045] hover:underline" onClick={() => copyNotes(v)}>Use notes for the quote's scope</button>
            </div>
            {v.notes && <p className="text-muted-foreground whitespace-pre-line">{v.notes}</p>}

            {v.rooms.map(room => {
              const roomLines = lines.filter(l => l.roomId === room.id);
              return (
                <div key={room.id} className="rounded-md border border-border/60 p-3 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{room.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {room.lengthM && room.widthM ? `${room.lengthM} x ${room.widthM} m${room.heightM ? `, ${room.heightM} m high` : ''}` : 'no sizes taken'}
                    </span>
                  </div>
                  {room.notes && <p className="text-muted-foreground whitespace-pre-line">{room.notes}</p>}
                  {room.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">{room.photos.map(p => <Thumb key={p.id} photo={p} onOpen={setBigPhoto} />)}</div>
                  )}
                  {roomLines.map(l => {
                    const inEstimate = addedKeys.has(l.key);
                    return (
                      <label key={l.key} className={`flex items-center gap-3 ${inEstimate ? 'opacity-60' : 'cursor-pointer'}`}>
                        <input type="checkbox" disabled={inEstimate} checked={inEstimate || picked.has(l.key)}
                          onChange={e => setPicked(s => { const n = new Set(s); e.target.checked ? n.add(l.key) : n.delete(l.key); return n; })} />
                        <span className="flex-1">{l.scope} <span className="text-xs text-muted-foreground">({l.trade})</span></span>
                        {l.needsQuantity && !inEstimate ? (
                          <span className="flex items-center gap-1" onClick={e => e.preventDefault()}>
                            <input inputMode="decimal" placeholder="qty" value={qtyOverride[l.key] ?? ''}
                              onChange={e => setQtyOverride(m => ({ ...m, [l.key]: e.target.value }))}
                              className="h-7 w-20 rounded border border-amber-400/60 bg-background px-2 text-right font-mono text-xs" />
                            <span className="text-xs text-muted-foreground">{l.unit}</span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs">{l.quantity} {l.unit}</span>
                        )}
                        <span className="w-40 text-right text-[11px] text-muted-foreground">{inEstimate ? 'in estimate' : l.basis}</span>
                      </label>
                    );
                  })}
                </div>
              );
            })}

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={chosen.length === 0} onClick={() => { onAdd(chosen.map(withQty), v); setPicked(new Set()); }}>
                Add {chosen.length || ''} selected line{chosen.length === 1 ? '' : 's'}
              </Button>
              <Button size="sm" variant="outline" disabled={fresh.length === 0} onClick={() => setPicked(new Set(fresh.map(l => l.key)))}>
                Select all {fresh.length}
              </Button>
              <span className="text-xs text-muted-foreground">Lines come in without a price: price them in the estimate, or from your library.</span>
            </div>
          </div>
        );
      })}

      {bigPhoto && (
        <div className="fixed inset-0 z-[10050] grid place-items-center bg-black/80 p-6" onClick={() => setBigPhoto(null)}>
          <img src={bigPhoto} alt="" className="max-h-full max-w-full rounded-lg" />
          <button type="button" className="absolute right-6 top-6 rounded-md bg-card px-3 py-1.5 text-sm">Close</button>
        </div>
      )}
    </div>
  );
}
