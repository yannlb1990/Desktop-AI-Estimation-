import { useState } from 'react';
import { SCOPE_BY_ROOM, ROOM_TYPES, roomQuantities, scopeQuantity, type SiteVisit } from '@/lib/site/visit';
import { SitePhotoThumb, SitePhotoViewer } from '@/components/site/SitePhotoThumb';

const n = (v: number) => (Math.round(v * 100) / 100).toLocaleString('en-AU');

/**
 * Everything recorded on a site visit, readable on the computer and printable: the job,
 * whole-job notes, then each room with its sizes, what was ticked on site with the
 * quantities those sizes give, other measurements, notes and photos.
 */
export function SiteVisitReport({ visit, photoSize = 'h-28 w-28' }: { visit: SiteVisit; photoSize?: string }) {
  const [big, setBig] = useState<{ url: string; caption: string } | null>(null);
  const photos = visit.rooms.reduce((s, r) => s + r.photos.length, 0);
  return (
    <div className="space-y-5 text-sm">
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground">Job</p>
          <p className="font-semibold">{visit.jobName || 'Site visit'}</p>
        </div>
        <div><p className="text-xs text-muted-foreground">Client</p><p>{visit.clientName || 'Not recorded'}</p></div>
        <div><p className="text-xs text-muted-foreground">Visited</p><p>{new Date(visit.createdAt).toLocaleDateString('en-AU')}</p></div>
        <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Address</p><p>{visit.address || 'Not recorded'}</p></div>
        <div><p className="text-xs text-muted-foreground">Rooms</p><p>{visit.rooms.length}</p></div>
        <div><p className="text-xs text-muted-foreground">Photos</p><p>{photos}</p></div>
      </div>

      {visit.notes && (
        <section>
          <h3 className="mb-1 font-semibold">Notes for the whole job</h3>
          <p className="whitespace-pre-line text-muted-foreground">{visit.notes}</p>
        </section>
      )}

      {visit.rooms.map(room => {
        const q = roomQuantities(room);
        const options = SCOPE_BY_ROOM[room.type] ?? [];
        const ticked = room.scope.map(k => options.find(o => o.key === k)).filter(Boolean) as typeof options;
        const typeLabel = ROOM_TYPES.find(t => t.type === room.type)?.label;
        return (
          <section key={room.id} className="break-inside-avoid rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">{room.name}{typeLabel && typeLabel !== room.name ? <span className="ml-2 text-xs font-normal text-muted-foreground">{typeLabel}</span> : null}</h3>
              <span className="text-xs text-muted-foreground">
                {room.lengthM && room.widthM ? `${room.lengthM} x ${room.widthM} m` : 'no length and width'}
                {room.heightM ? `, ${room.heightM} m high` : ''}
                {q.floor > 0 ? ` · floor ${n(q.floor)} m²` : ''}
                {q.walls > 0 ? ` · walls ${n(q.walls)} m²` : ''}
                {q.perimeter > 0 ? ` · perimeter ${n(q.perimeter)} m` : ''}
              </span>
            </div>
            {ticked.length > 0 && (
              <ul className="mt-2 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                {ticked.map(o => {
                  const qty = scopeQuantity(o, q);
                  return <li key={o.key}>{o.label} <span className="text-muted-foreground">{qty > 0 ? `${n(qty)} ${o.unit}` : ''} · {o.trade}</span></li>;
                })}
              </ul>
            )}
            {(room.measures ?? []).length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Other measurements</p>
                <ul className="grid gap-x-6 sm:grid-cols-2">
                  {(room.measures ?? []).map(m => <li key={m.id}>{m.label || 'Measurement'}: {m.value ?? '?'} {m.unit}{m.trade ? <span className="text-muted-foreground"> · {m.trade}</span> : null}</li>)}
                </ul>
              </div>
            )}
            {room.notes && <p className="mt-2 whitespace-pre-line text-muted-foreground">{room.notes}</p>}
            {room.photos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {room.photos.map(p => (
                  <figure key={p.id} className="space-y-1">
                    <SitePhotoThumb photo={p} size={photoSize} onOpen={(url, caption) => setBig({ url, caption })} />
                    {p.caption && <figcaption className="max-w-[7rem] text-[11px] leading-tight text-muted-foreground">{p.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {visit.rooms.length === 0 && <p className="text-muted-foreground">No rooms were recorded on this visit.</p>}
      <SitePhotoViewer photo={big} onClose={() => setBig(null)} />
    </div>
  );
}
