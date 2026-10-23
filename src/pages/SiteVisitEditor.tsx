import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getUserStorageKey } from '@/lib/localAuth';
import {
  ROOM_TYPES, SCOPE_BY_ROOM, newRoom, roomQuantities, type RoomType, type SiteRoom, type SiteVisit,
} from '@/lib/site/visit';
import {
  loadLocalVisits, saveLocalVisit, syncVisit, syncAll, shrinkPhoto, putPhotoBlob, photoUrl, deletePhotoBlob, deleteVisit, countPending,
  photoTooBig, requestPersistentStorage, StorageFullError, removeUploadedPhoto,
} from '@/lib/site/siteStore';

const field = 'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground';
const num = (v: string): number | null => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };

/**
 * Speech to text where Safari offers it (not always in the home-screen app); otherwise the
 * keyboard's own microphone works in any box. One phrase per tap: iOS repeats text in
 * continuous mode.
 */
function useDictation(onText: (t: string) => void) {
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState('');
  const Ctor = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* already stopped */ } }, []);
  const start = () => {
    if (!Ctor || listening) return;
    setProblem('');
    try {
      const rec = new Ctor();
      rec.lang = 'en-AU';
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) { const t = String(e.results[i][0].transcript || '').trim(); if (t) onText(t); }
        }
      };
      rec.onend = () => setListening(false);
      rec.onerror = (e: any) => {
        setListening(false);
        setProblem(e?.error === 'not-allowed' || e?.error === 'service-not-allowed'
          ? 'Dictation is blocked here: use the microphone on the keyboard instead.'
          : 'Did not catch that: try again or use the keyboard microphone.');
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch { setProblem('Dictation is not available here: use the keyboard microphone.'); }
  };
  const stop = () => { try { recRef.current?.stop(); } catch { /* stopped */ } setListening(false); };
  return { supported: !!Ctor, listening, start, stop, problem };
}

function NotesBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const latest = useRef(value);
  latest.current = value;
  const d = useDictation(t => {
    const next = latest.current ? `${latest.current.trimEnd()} ${t}` : t;
    latest.current = next; // a second phrase arriving before the re-render builds on this one
    onChange(next);
  });
  return (
    <div className="space-y-1.5">
      <textarea className={`${field} min-h-[96px]`} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      {d.problem && <p className="text-xs text-amber-400">{d.problem}</p>}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Tap the microphone on the keyboard to talk instead of typing.</span>
        {d.supported && (
          <button type="button" className={`rounded-md border px-2.5 py-1 ${d.listening ? 'border-red-400 text-red-400' : 'border-border text-foreground'}`}
            onClick={d.listening ? d.stop : d.start}>
            {d.listening ? 'Stop' : 'Dictate'}
          </button>
        )}
      </div>
    </div>
  );
}

function PhotoThumb({ photo, onRemove }: { photo: SiteRoom['photos'][number]; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    photoUrl(photo).then(u => { url = u; setSrc(u); });
    return () => { if (url?.startsWith('blob:')) URL.revokeObjectURL(url); };
  }, [photo.id, photo.path]);
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground">Photo</span>}
      {!photo.path && <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-amber-300">not uploaded</span>}
      <button type="button" onClick={onRemove} className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">Remove</button>
    </div>
  );
}

/** A size box saved as you type (screen lock or swipe-away fires no blur on iOS). */
function SizeInput({ value, placeholder, onValue }: { value: number | null; placeholder: string; onValue: (n: number | null) => void }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => { if (num(text) !== value) setText(value == null ? '' : String(value)); /* outside change */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const bad = text.trim() !== '' && num(text) === null;
  return (
    <input className={`${field} ${bad ? 'border-red-400' : ''}`} inputMode="decimal" placeholder={placeholder} value={text}
      onChange={e => { setText(e.target.value); onValue(num(e.target.value)); }} />
  );
}

function RoomCard({ room, open, onToggle, onChange, onRemove, onPhotos }: {
  room: SiteRoom; open: boolean; onToggle: () => void;
  /** applied to the latest copy of the room, so quick taps never undo each other */
  onChange: (change: (r: SiteRoom) => SiteRoom) => void; onRemove: () => void; onPhotos: (files: FileList) => void;
}) {
  const q = roomQuantities(room);
  const options = SCOPE_BY_ROOM[room.type];
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const set = (patch: Partial<SiteRoom>) => onChange(r => ({ ...r, ...patch }));
  return (
    <div className="rounded-xl border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="font-medium">{room.name}</span>
        <span className="text-xs text-muted-foreground">
          {room.scope.length} ticked · {room.photos.length} photo{room.photos.length !== 1 ? 's' : ''} {open ? '· Close' : ''}
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <input className={field} value={room.name} onChange={e => set({ name: e.target.value })} aria-label="Room name" />

          <div>
            <div className="mb-1.5 text-sm text-muted-foreground">Size (m)</div>
            <div className="grid grid-cols-3 gap-2">
              {(['lengthM', 'widthM', 'heightM'] as const).map((k, i) => (
                <SizeInput key={k} value={room[k]} placeholder={['Length', 'Width', 'Height'][i]}
                  onValue={n => set({ [k]: n } as Partial<SiteRoom>)} />
              ))}
            </div>
            {q.floor > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Floor {q.floor} m²{q.walls > 0 ? ` · Walls ${q.walls} m²` : ''} · Perimeter {q.perimeter} m
              </p>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-sm text-muted-foreground">What needs doing</div>
            <div className="flex flex-wrap gap-2">
              {options.map(o => {
                const on = room.scope.includes(o.key);
                return (
                  <button key={o.key} type="button"
                    onClick={() => onChange(r => ({ ...r, scope: r.scope.includes(o.key) ? r.scope.filter(k => k !== o.key) : [...r.scope, o.key] }))}
                    className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground'}`}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <NotesBox value={room.notes} onChange={notes => set({ notes })} placeholder="Anything else: condition, client wants, what to check" />

          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm text-muted-foreground">
              <span>Photos</span>
              <span className="flex gap-2">
                <button type="button" className="rounded-md border border-border px-3 py-1.5 text-foreground" onClick={() => camRef.current?.click()}>Take photo</button>
                <button type="button" className="rounded-md border border-border px-3 py-1.5 text-foreground" onClick={() => libRef.current?.click()}>From library</button>
              </span>
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { if (e.target.files?.length) onPhotos(e.target.files); e.target.value = ''; }} />
            <input ref={libRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files?.length) onPhotos(e.target.files); e.target.value = ''; }} />
            {room.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {room.photos.map(p => (
                  <PhotoThumb key={p.id} photo={p} onRemove={() => { deletePhotoBlob(p.id); removeUploadedPhoto(p.path); onChange(r => ({ ...r, photos: r.photos.filter(x => x.id !== p.id) })); }} />
                ))}
              </div>
            )}
          </div>

          <div className="text-right">
            {confirmRemove ? (
              <span className="text-sm">
                Remove this room?{' '}
                <button type="button" className="ml-2 text-red-400 underline" onClick={onRemove}>Remove</button>
                <button type="button" className="ml-3 text-muted-foreground underline" onClick={() => setConfirmRemove(false)}>Keep</button>
              </span>
            ) : (
              <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setConfirmRemove(true)}>Remove room</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SiteVisitEditor() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const [visit, setVisit] = useState<SiteVisit | null>(() => loadLocalVisits().find(v => v.id === visitId) ?? null);
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<string>('Saved on this phone');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const syncTimer = useRef<number | null>(null);
  const visitRef = useRef(visit);
  visitRef.current = visit;

  const projects: { id: string; name: string }[] = (() => {
    try { return JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]').map((p: any) => ({ id: p.id, name: p.name || 'Untitled' })); } catch { return []; }
  })();

  const runSync = useCallback(async () => {
    const id = visitRef.current?.id;
    if (!id) return;
    setSyncState('Uploading...');
    let r;
    try { r = await syncVisit(id); }
    catch (e) { setSyncState(e instanceof StorageFullError ? e.message : 'Saved on this phone. Upload will retry.'); return; }
    if (!r.visit) return;
    // keep anything typed while the upload ran; take the photo paths that just landed
    const latest = loadLocalVisits().find(v => v.id === id);
    if (latest) { visitRef.current = latest; setVisit(latest); }
    const pending = countPending(r.visit);
    setSyncState(r.offline ? `No signal: saved on this phone${pending ? `, ${pending} photo${pending !== 1 ? 's' : ''} to upload` : ''}`
      : r.error ? `Saved on this phone. ${r.error}`
      : pending ? `${pending} photo${pending !== 1 ? 's' : ''} still to upload` : 'Saved and uploaded');
  }, []);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(runSync, 2500);
  }, [runSync]);

  // iOS often keeps saying 'online' on weak signal, so also retry when the app comes back
  // to the front and every minute
  useEffect(() => {
    requestPersistentStorage();
    const kick = () => { if (document.visibilityState !== 'hidden') runSync(); };
    window.addEventListener('online', kick);
    window.addEventListener('pageshow', kick);
    document.addEventListener('visibilitychange', kick);
    const every = window.setInterval(kick, 60_000);
    runSync();
    return () => {
      window.removeEventListener('online', kick);
      window.removeEventListener('pageshow', kick);
      document.removeEventListener('visibilitychange', kick);
      window.clearInterval(every);
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
    };
  }, [runSync]);

  if (!visit) {
    return (
      <div className="min-h-screen bg-background px-4 pt-10 text-center text-foreground">
        <p>This site visit is not on this phone.</p>
        <button className="mt-4 underline" onClick={() => navigate('/site')}>Back to site visits</button>
      </div>
    );
  }

  const update = (patch: Partial<SiteVisit>) => {
    try {
      const saved = saveLocalVisit({ ...visitRef.current!, ...patch });
      visitRef.current = saved; // the next change in the same tick builds on this one
      setVisit(saved);
      setSyncState('Saved on this phone');
      scheduleSync();
    } catch (e) {
      setSyncState(e instanceof StorageFullError ? e.message : 'Could not save on this phone');
    }
  };
  const updateRoom = (roomId: string, change: (r: SiteRoom) => SiteRoom) =>
    update({ rooms: visitRef.current!.rooms.map(r => (r.id === roomId ? change(r) : r)) });

  const addPhotos = async (roomId: string, files: FileList) => {
    const list = Array.from(files);
    const added: { id: string; caption: string; takenAt: string }[] = [];
    let problem = '';
    for (let i = 0; i < list.length; i++) {
      setSyncState(`Saving photo ${i + 1} of ${list.length}...`);
      const blob = await shrinkPhoto(list[i]);
      if (photoTooBig(blob)) { problem = 'A photo was too large to keep (try a normal photo, not RAW).'; continue; }
      const id = crypto.randomUUID();
      try { await putPhotoBlob(id, blob); } catch (e) { problem = e instanceof Error ? e.message : 'A photo could not be saved.'; break; }
      added.push({ id, caption: '', takenAt: new Date().toISOString() });
    }
    // Photos saved so far are always kept, even if a later one failed
    if (added.length) {
      const v = visitRef.current!;
      update({ rooms: v.rooms.map(r => (r.id === roomId ? { ...r, photos: [...r.photos, ...added] } : r)) });
    }
    if (problem) setSyncState(problem);
  };

  const addRoom = (type: RoomType) => {
    const room = newRoom(type, visitRef.current!.rooms);
    update({ rooms: [...visitRef.current!.rooms, room] });
    setOpenRoom(room.id);
  };

  const [sending, setSending] = useState(false);
  const sendToOffice = async () => {
    if (sending) return;
    setSending(true);
    update({ status: 'sent' });
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    await runSync();
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 pb-28 pt-5 max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button className="text-sm text-muted-foreground underline" onClick={() => navigate('/site')}>Site visits</button>
        <span className="text-xs text-muted-foreground">{syncState}</span>
      </div>

      <div className="space-y-2">
        <input className={`${field} text-lg font-semibold`} placeholder="Job name" value={visit.jobName} onChange={e => update({ jobName: e.target.value })} />
        <input className={field} placeholder="Site address" value={visit.address} onChange={e => update({ address: e.target.value })} autoComplete="street-address" />
        <input className={field} placeholder="Client name" value={visit.clientName} onChange={e => update({ clientName: e.target.value })} />
        <select className={field} value={visit.projectId ?? ''} onChange={e => update({ projectId: e.target.value || null })}>
          <option value="">New job (no project yet)</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <NotesBox value={visit.notes} onChange={notes => update({ notes })} placeholder="Whole job: access, parking, power, age of the house, what the client wants" />
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Rooms</h2>
        {visit.rooms.map(r => (
          <RoomCard key={r.id} room={r} open={openRoom === r.id} onToggle={() => setOpenRoom(openRoom === r.id ? null : r.id)}
            onChange={change => updateRoom(r.id, change)} onRemove={() => { r.photos.forEach(p => deletePhotoBlob(p.id)); update({ rooms: visitRef.current!.rooms.filter(x => x.id !== r.id) }); }}
            onPhotos={files => addPhotos(r.id, files)} />
        ))}
        <div>
          <div className="mb-1.5 text-sm text-muted-foreground">Add a room</div>
          <div className="flex flex-wrap gap-2">
            {ROOM_TYPES.map(t => (
              <button key={t.type} type="button" onClick={() => addRoom(t.type)} className="rounded-lg border border-border px-3 py-2 text-sm">{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <button type="button" onClick={sendToOffice} disabled={visit.rooms.length === 0 || sending}
          className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-primary-foreground disabled:opacity-50">
          {visit.status === 'sent' ? 'Sent to office (send again with changes)' : 'Send to office'}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          The office sees the rooms, photos and ticks in the project's estimate. It uploads by itself when there is signal.
        </p>
        <div className="text-center">
          {confirmDelete ? (
            <span className="text-sm">
              Delete this visit and its photos?{' '}
              <button type="button" className="ml-2 text-red-400 underline" onClick={async () => { await deleteVisit(visit); navigate('/site'); }}>Delete</button>
              <button type="button" className="ml-3 text-muted-foreground underline" onClick={() => setConfirmDelete(false)}>Keep</button>
            </span>
          ) : (
            <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setConfirmDelete(true)}>Delete visit</button>
          )}
        </div>
      </div>
    </div>
  );
}
