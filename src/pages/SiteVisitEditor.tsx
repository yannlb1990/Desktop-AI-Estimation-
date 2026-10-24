import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getUserStorageKey } from '@/lib/localAuth';
import {
  ROOM_TYPES, SCOPE_BY_ROOM, MEASURE_UNITS, SITE_TRADES, newRoom, roomQuantities,
  type RoomType, type SiteRoom, type SiteVisit, type SiteMeasure,
} from '@/lib/site/visit';
import { MetricoreLogoMark } from '@/components/MetricoreLogoMark';
import {
  loadLocalVisits, saveLocalVisit, syncVisit, syncAll, shrinkPhoto, putPhotoBlob, photoUrl, deletePhotoBlob, deleteVisit, countPending,
  photoTooBig, requestPersistentStorage, StorageFullError, removeUploadedPhoto,
} from '@/lib/site/siteStore';

const field = 'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground';
const num = (v: string): number | null => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };

/**
 * Talk instead of typing. Shows the words live, keeps listening through pauses (iOS stops
 * after a silence, so it restarts until Stop), and only adds new final words: Safari can
 * re-deliver results, so each session commits the difference from what it already added.
 * Where Safari offers no speech service (some home-screen apps), the keyboard microphone works.
 */
function useDictation(onText: (t: string) => void) {
  const recRef = useRef<any>(null);
  const wantRef = useRef(false);
  const committedRef = useRef(0);        // results committed in this session, by index
  const lastFinalRef = useRef('');       // Safari can repeat earlier words in a later result
  const quietRestartsRef = useRef(0);
  const heardRef = useRef(false);
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState('');
  const [problem, setProblem] = useState('');
  const Ctor = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

  const stopAll = () => { wantRef.current = false; try { recRef.current?.stop(); } catch { /* stopped */ } setListening(false); setLive(''); };
  useEffect(() => () => { wantRef.current = false; try { recRef.current?.abort(); } catch { /* stopped */ } }, []);

  const session = () => {
    const rec = new Ctor();
    rec.lang = 'en-AU';
    rec.continuous = true;
    rec.interimResults = true;
    committedRef.current = 0;
    heardRef.current = false;
    rec.onresult = (e: any) => {
      if (recRef.current !== rec) return;
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = String(e.results[i][0].transcript || '').trim();
        if (!e.results[i].isFinal) { interim += ` ${t}`; continue; }
        if (i < committedRef.current) continue;
        committedRef.current = i + 1;
        // drop words Safari repeated from the previous phrase
        const prev = lastFinalRef.current;
        const fresh = prev && t.toLowerCase().startsWith(prev.toLowerCase()) ? t.slice(prev.length).trim() : t;
        lastFinalRef.current = t;
        if (fresh) { heardRef.current = true; onText(fresh); }
      }
      setLive(interim.trim());
    };
    rec.onerror = (e: any) => {
      if (recRef.current !== rec) return;
      const err = e?.error;
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        wantRef.current = false;
        setProblem('Talking is blocked here: allow the microphone for metricore.com.au in Settings > Safari, or use the microphone on the keyboard.');
      } else if (err === 'audio-capture' || err === 'network' || err === 'aborted') {
        wantRef.current = false;
        setProblem(err === 'audio-capture' ? 'The microphone is busy (a call or another app): try again in a moment.'
          : err === 'network' ? 'Talking needs signal: type, or use the keyboard microphone.' : '');
      }
    };
    rec.onend = () => {
      if (recRef.current !== rec) return; // an old session ending late
      setLive('');
      quietRestartsRef.current = heardRef.current ? 0 : quietRestartsRef.current + 1;
      // iOS ends after a pause: carry on, with a short wait, but not forever in silence
      if (wantRef.current && quietRestartsRef.current < 3) {
        setTimeout(() => { if (wantRef.current && recRef.current === rec) { try { session(); return; } catch { /* fall through */ } } setListening(false); }, 400);
        return;
      }
      wantRef.current = false;
      setListening(false);
    };
    recRef.current = rec;
    rec.start();
  };

  const start = () => {
    if (!Ctor || listening) return;
    setProblem('');
    wantRef.current = true;
    quietRestartsRef.current = 0;
    lastFinalRef.current = '';
    try { session(); setListening(true); }
    catch { wantRef.current = false; setProblem('Talking is not available here: use the microphone on the keyboard.'); }
  };
  return { supported: !!Ctor, listening, live, start, stop: stopAll, problem };
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
    <div className="space-y-2">
      <textarea className={`${field} min-h-[96px]`} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      {d.listening && (
        <p className="rounded-lg border border-[#D4A045]/40 bg-[#D4A045]/10 px-3 py-2 text-sm text-foreground">
          {d.live || 'Listening... speak now'}
        </p>
      )}
      {d.problem && <p className="text-xs text-amber-400">{d.problem}</p>}
      {d.supported ? (
        <button type="button" onClick={d.listening ? d.stop : d.start}
          className={`w-full rounded-lg py-3 text-base font-semibold ${d.listening ? 'bg-red-500/90 text-white' : 'border border-[#D4A045] text-[#D4A045]'}`}>
          {d.listening ? 'Stop' : 'Talk'}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">Tap the microphone on the keyboard to talk instead of typing.</p>
      )}
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

/** One measurement: what it is, how much, which unit, which trade does it */
function MeasureRow({ m, onChange, onRemove }: { m: SiteMeasure; onChange: (m: SiteMeasure) => void; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-border p-2.5 space-y-2">
      <input className={field} placeholder="What (deck subframe, slab, ceiling height...)" value={m.label} onChange={e => onChange({ ...m, label: e.target.value })} />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <SizeInput value={m.value} placeholder="Amount" onValue={value => onChange({ ...m, value })} />
        <select className={`${field} w-24`} value={m.unit} onChange={e => onChange({ ...m, unit: e.target.value as SiteMeasure['unit'] })}>
          {MEASURE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <select className={field} value={m.trade} onChange={e => onChange({ ...m, trade: e.target.value })}>
          {SITE_TRADES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="button" className="shrink-0 px-2 text-sm text-muted-foreground underline" onClick={onRemove}>Remove</button>
      </div>
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
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">or floor area</span>
              <SizeInput value={room.areaM2 ?? null} placeholder="m² (not a rectangle)" onValue={n => set({ areaM2: n })} />
            </div>
            {q.floor > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Floor {q.floor} m²{q.walls > 0 ? ` · Walls ${q.walls} m²` : ''}{q.perimeter > 0 ? ` · Perimeter ${q.perimeter} m` : ''}
              </p>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-sm text-muted-foreground">Other measurements</div>
            <div className="space-y-2">
              {(room.measures ?? []).map(m => (
                <MeasureRow key={m.id} m={m}
                  onChange={next => onChange(r => ({ ...r, measures: (r.measures ?? []).map(x => (x.id === m.id ? next : x)) }))}
                  onRemove={() => onChange(r => ({ ...r, measures: (r.measures ?? []).filter(x => x.id !== m.id) }))} />
              ))}
            </div>
            <button type="button" className="mt-2 w-full rounded-lg border border-dashed border-border py-2.5 text-sm"
              onClick={() => onChange(r => ({ ...r, measures: [...(r.measures ?? []), { id: crypto.randomUUID(), label: '', value: null, unit: 'm²', trade: 'Carpenter' }] }))}>
              Add a measurement (m², lm, m³, height, count)
            </button>
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
  // true only when the last upload finished with nothing left to send
  const [inOffice, setInOffice] = useState(false);
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
    setInOffice(false);
    let r;
    try { r = await syncVisit(id); }
    catch (e) { setSyncState(e instanceof StorageFullError ? e.message : 'Saved on this phone. Upload will retry.'); return; }
    if (!r.visit) { setSyncState('Saved on this phone'); return; }
    setInOffice(!r.error && !r.offline && countPending(r.visit) === 0);
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

  // Every change already goes to the office by itself; Done confirms and closes the visit
  const [done, setDone] = useState(false);
  const finish = async () => {
    if (visitRef.current?.status !== 'sent') update({ status: 'sent' });
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    setDone(true);
    await runSync();
  };

  if (done) {
    const pending = countPending(visit);
    const uploaded = inOffice && pending === 0;
    return (
      <div className="min-h-screen bg-background text-foreground px-6 max-w-xl mx-auto flex flex-col" style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        <div className="flex-1">
          <div className={`grid h-24 w-24 place-items-center rounded-full ${uploaded ? 'bg-[#D4A045]' : 'bg-[#412D15]'}`}>
            <span className="text-4xl font-bold text-[#0B0704]">{uploaded ? '✓' : '…'}</span>
          </div>
          <h1 className="mt-8 font-display text-4xl font-bold">{uploaded ? 'Sent' : 'Saved'}</h1>
          <p className="mt-4 text-lg">
            {visit.jobName || 'This visit'}: {visit.rooms.length} room{visit.rooms.length !== 1 ? 's' : ''}, {visit.rooms.reduce((n, r) => n + r.photos.length, 0)} photos.
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            {uploaded
              ? 'The office has it. Open the project on your computer: Estimate, Add to estimate, From site.'
              : `${syncState}. It goes to the office by itself as soon as there is signal.`}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Changes you make later update the same visit in the office. Nothing is added twice.</p>
        </div>
        <button type="button" onClick={() => navigate('/site')} className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-primary-foreground">Done</button>
        <button type="button" onClick={() => setDone(false)} className="mt-4 w-full py-2 text-base text-[#D4A045]">Keep editing this visit</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 max-w-xl mx-auto space-y-5" style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))', paddingBottom: 'calc(9rem + env(safe-area-inset-bottom))' }}>
      <div className="flex items-center justify-between gap-3">
        <button className="flex items-center gap-2" onClick={() => navigate('/site')} aria-label="Back to site visits">
          <MetricoreLogoMark height={22} />
          <span className="text-sm text-muted-foreground">Site visits</span>
        </button>
        <span className={`text-right text-xs ${/No signal|failed|retry|full/i.test(syncState) ? 'text-amber-400' : 'text-muted-foreground'}`}>{syncState}</span>
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
        <button type="button" onClick={finish} disabled={visit.rooms.length === 0}
          className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-primary-foreground disabled:opacity-50">
          Done
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Everything you enter goes to the office by itself, and later changes update it there.
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
