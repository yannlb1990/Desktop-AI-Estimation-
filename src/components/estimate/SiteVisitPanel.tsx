import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getUserStorageKey } from '@/lib/localAuth';
import { syncProjectToSupabase } from '@/lib/db/projects';
import { projectVisits, photoUrl } from '@/lib/site/siteStore';
import { draftLinesFromVisit, siteScopeText, type SiteDraftLine } from '@/lib/site/toEstimate';
import type { SitePhoto, SiteVisit } from '@/lib/site/visit';

interface Props {
  projectId: string;
  /** keys of site lines already in this estimate */
  addedKeys: Set<string>;
  onAdd: (lines: SiteDraftLine[], visit: SiteVisit) => void;
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
export function SiteVisitPanel({ projectId, addedKeys, onAdd }: Props) {
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bigPhoto, setBigPhoto] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    projectVisits(projectId).then(vs => { if (alive) setVisits(vs); }).catch(() => {});
    return () => { alive = false; };
  }, [projectId]);

  const drafts = useMemo(() => visits.map(v => ({ v, lines: draftLinesFromVisit(v) })), [visits]);
  if (visits.length === 0) return null;

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
                        <span className={`font-mono text-xs ${l.needsQuantity ? 'text-amber-400' : ''}`}>
                          {l.needsQuantity ? 'qty to enter' : `${l.quantity} ${l.unit}`}
                        </span>
                        <span className="w-40 text-right text-[11px] text-muted-foreground">{inEstimate ? 'in estimate' : l.basis}</span>
                      </label>
                    );
                  })}
                </div>
              );
            })}

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={chosen.length === 0} onClick={() => { onAdd(chosen, v); setPicked(new Set()); }}>
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
