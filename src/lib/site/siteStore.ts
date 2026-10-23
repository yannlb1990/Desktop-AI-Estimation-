/**
 * Site visits on the phone: kept locally first (no reception on site is normal), then
 * synced. Photos are shrunk on the phone, held in IndexedDB until uploaded, and uploaded
 * under a fixed path per photo id, so retrying after a dropped connection never duplicates.
 *
 * Rules learned from the robustness review (24 Oct):
 * - one sync at a time per visit; a change during a sync triggers one more run
 * - the cloud always gets the newest local copy, read at the moment of upload
 * - every network call has a timeout (weak signal makes fetch hang for minutes)
 * - deletes are remembered (tombstones) until the cloud confirms them
 * - a pull never writes back an older local copy than what is on the phone now
 */
import { supabase } from '@/integrations/supabase/client';
import { getUserStorageKey } from '@/lib/localAuth';
import { mergeVisits, type SitePhoto, type SiteVisit } from './visit';

const VISITS_KEY = () => getUserStorageKey('site_visits');
const TOMBSTONES_KEY = () => getUserStorageKey('site_visits_deleted');
const DB_NAME = 'metricore-site';
const STORE = 'photos';
const BUCKET = 'site-photos';
/** Bucket limit is 15 MB; leave room */
const MAX_PHOTO_BYTES = 14 * 1024 * 1024;

export class StorageFullError extends Error {}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(p).then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// ── visits (localStorage) ─────────────────────────────────────────────────────
export function loadLocalVisits(): SiteVisit[] {
  try { return JSON.parse(localStorage.getItem(VISITS_KEY()) || '[]'); } catch { return []; }
}
function saveLocalVisits(visits: SiteVisit[]) {
  try {
    localStorage.setItem(VISITS_KEY(), JSON.stringify(visits));
  } catch {
    throw new StorageFullError('This phone has no room left to save. Free some space, then try again.');
  }
}
/** Save an edit (stamps updatedAt). Throws StorageFullError when the phone is full. */
export function saveLocalVisit(v: SiteVisit): SiteVisit {
  const next = { ...v, updatedAt: new Date().toISOString() };
  saveLocalVisits([next, ...loadLocalVisits().filter(x => x.id !== v.id)]);
  return next;
}
function patchLocal(id: string, change: (v: SiteVisit) => SiteVisit): SiteVisit | null {
  const all = loadLocalVisits();
  const cur = all.find(v => v.id === id);
  if (!cur) return null; // deleted meanwhile: never bring it back
  const next = change(cur);
  saveLocalVisits(all.map(v => (v.id === id ? next : v)));
  return next;
}

function tombstones(): string[] {
  try { return JSON.parse(localStorage.getItem(TOMBSTONES_KEY()) || '[]'); } catch { return []; }
}
function setTombstones(ids: string[]) {
  try { localStorage.setItem(TOMBSTONES_KEY(), JSON.stringify([...new Set(ids)])); } catch { /* best effort */ }
}

/** Ask the browser not to clear this site's storage (Safari otherwise may after 7 idle days). */
export function requestPersistentStorage() {
  try { (navigator as any).storage?.persist?.(); } catch { /* not supported */ }
}

// ── photo blobs (IndexedDB) ───────────────────────────────────────────────────
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.onabort = () => reject(tx.error);
  });
}
/** Throws StorageFullError when the phone cannot keep the photo. */
export async function putPhotoBlob(id: string, blob: Blob): Promise<void> {
  try { await idb<void>('readwrite', s => s.put(blob, id)); }
  catch { throw new StorageFullError('The photo could not be saved on this phone (storage full or private browsing).'); }
}
export async function getPhotoBlob(id: string): Promise<Blob | undefined> {
  try { return await idb<Blob | undefined>('readonly', s => s.get(id)); } catch { return undefined; }
}
export const deletePhotoBlob = (id: string) => idb<void>('readwrite', s => s.delete(id)).catch(() => undefined);

/**
 * Phone photos are 3-8 MB: resize to 1600 px on the long side as JPEG (about 0.3 MB).
 * iPhone HEIC photos decode in Safari; anything that fails to decode is kept as is
 * (and refused later if it is over the upload limit).
 */
export async function shrinkPhoto(file: Blob, maxSide = 1600, quality = 0.78): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', quality));
    canvas.width = 0; canvas.height = 0;
    return out && out.size < file.size ? out : file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export const photoTooBig = (b: Blob) => b.size > MAX_PHOTO_BYTES;

/** Something to show for a photo: the local copy if this phone has it, else a signed link. */
export async function photoUrl(p: SitePhoto): Promise<string | null> {
  const blob = await getPhotoBlob(p.id);
  if (blob) return URL.createObjectURL(blob);
  if (!p.path) return null;
  try {
    const { data } = await withTimeout(supabase.storage.from(BUCKET).createSignedUrl(p.path, 6 * 3600), 10_000);
    return data?.signedUrl ?? null;
  } catch { return null; }
}

// ── sync ──────────────────────────────────────────────────────────────────────
/** Signed-in user id, or 'offline' when the session can't be checked in time. */
async function userId(): Promise<string | null | 'offline'> {
  try {
    const { data: { session } } = await withTimeout(supabase.auth.getSession(), 6_000);
    return session?.user.id ?? null;
  } catch { return 'offline'; }
}

export interface SyncResult { visit: SiteVisit | null; pendingPhotos: number; error?: string; offline?: boolean }

export function countPending(v: SiteVisit): number {
  return v.rooms.reduce((n, r) => n + r.photos.filter(p => !p.path).length, 0);
}
const needsSync = (v: SiteVisit) => countPending(v) > 0 || !v.syncedAt || v.syncedAt < v.updatedAt;

const inflight = new Map<string, Promise<SyncResult>>();
const rerun = new Set<string>();

/** Upload this visit's waiting photos, then its newest local copy. One run at a time per visit. */
export function syncVisit(id: string): Promise<SyncResult> {
  if (inflight.has(id)) { rerun.add(id); return inflight.get(id)!; }
  const run = (async (): Promise<SyncResult> => {
    let result: SyncResult;
    do {
      rerun.delete(id);
      result = await syncOnce(id);
    } while (rerun.has(id) && !result.offline);
    return result;
  })().finally(() => inflight.delete(id));
  inflight.set(id, run);
  return run;
}

async function syncOnce(id: string): Promise<SyncResult> {
  const start = loadLocalVisits().find(v => v.id === id) ?? null;
  if (!start || tombstones().includes(id)) return { visit: null, pendingPhotos: 0 };
  const uid = await userId();
  if (uid === 'offline' || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return { visit: start, pendingPhotos: countPending(start), error: 'Offline', offline: true };
  }
  if (!uid) return { visit: start, pendingPhotos: countPending(start), error: 'Signed out: sign in to upload' };
  let error: string | undefined;
  let offline = false;
  for (const room of start.rooms) {
    for (const photo of room.photos) {
      if (photo.path) continue;
      const blob = await getPhotoBlob(photo.id);
      if (!blob) continue;
      if (photoTooBig(blob)) { error = 'A photo is too large to upload: take it again'; continue; }
      const path = `${uid}/${id}/${photo.id}.jpg`;
      try {
        const { error: upErr } = await withTimeout<any>(
          supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' }), 90_000);
        if (upErr) { error = upErr.message; continue; }
      } catch { error = 'Weak signal: upload timed out, will retry'; offline = true; break; }
      // Record the path on the newest local copy (the user may have kept editing)
      patchLocal(id, v => ({
        ...v,
        rooms: v.rooms.map(r => ({ ...r, photos: r.photos.map(p => (p.id === photo.id ? { ...p, path } : p)) })),
      }));
    }
    if (offline) break;
  }
  // The newest copy at the moment of upload, never the one this run started with
  const latest = loadLocalVisits().find(v => v.id === id);
  if (!latest || tombstones().includes(id)) return { visit: null, pendingPhotos: 0 };
  if (!offline) {
    try {
      const row: Record<string, unknown> = { id, user_id: uid, data: latest, status: latest.status, updated_at: latest.updatedAt };
      if (latest.projectId) row.project_id = latest.projectId; // never send an empty link over the office's
      const { data: saved, error: rowErr } = await withTimeout<any>((supabase as any).from('site_visits')
        .upsert(row, { onConflict: 'id' }).select('updated_at, project_id, deleted_at'), 20_000);
      if (rowErr) error = rowErr.message;
      else {
        const back = saved?.[0];
        // Synced only if the server kept this copy (it keeps a newer one, and deleted stays deleted)
        const accepted = back && new Date(back.updated_at).getTime() === new Date(latest.updatedAt).getTime();
        patchLocal(id, v => ({
          ...v,
          projectId: v.projectId ?? back?.project_id ?? null,
          syncedAt: accepted && v.updatedAt === latest.updatedAt ? latest.updatedAt : v.syncedAt,
        }));
        if (back && !accepted) error = 'A newer copy is in the office: refresh the list to get it';
      }
    } catch { error = 'Weak signal: will retry'; offline = true; }
  }
  const now = loadLocalVisits().find(v => v.id === id) ?? latest;
  return { visit: now, pendingPhotos: countPending(now), error, offline };
}

/** Everything waiting on this phone: deletes first, then visits with unsent changes or photos. */
export async function syncAll(): Promise<void> {
  for (const id of tombstones()) await finishDelete(id);
  for (const v of loadLocalVisits()) if (needsSync(v)) await syncVisit(v.id);
}

/** Cloud and phone copies merged (newer wins, uploaded photo paths kept). */
export async function pullVisits(): Promise<SiteVisit[]> {
  const uid = await userId();
  if (!uid || uid === 'offline') return loadLocalVisits();
  let data: any[] | null = null;
  try {
    const res = await withTimeout<any>((supabase as any).from('site_visits')
      .select('id, data, deleted_at, project_id').eq('user_id', uid).order('updated_at', { ascending: false }), 15_000);
    data = res.error ? null : res.data;
  } catch { data = null; }
  if (!data) return loadLocalVisits();
  // Read the phone's copies now, after the network call, so edits made meanwhile are kept
  const local = loadLocalVisits();
  const dead = new Set<string>([...tombstones(), ...data.filter((r: any) => r.deleted_at).map((r: any) => r.id)]);
  // The link lives in the project_id column (set by the office); the JSON may predate it
  const cloud = new Map<string, SiteVisit>(data.filter((r: any) => !r.deleted_at && r.data?.id)
    .map((r: any) => [r.id, { ...(r.data as SiteVisit), projectId: r.project_id ?? r.data.projectId ?? null }]));
  const merged: SiteVisit[] = [];
  for (const l of local) {
    if (dead.has(l.id)) continue;
    const c = cloud.get(l.id);
    merged.push(c ? mergeVisits(l, c) : l);
    cloud.delete(l.id);
  }
  for (const c of cloud.values()) if (!dead.has(c.id)) merged.push({ ...c, syncedAt: c.updatedAt });
  merged.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  try { saveLocalVisits(merged); } catch { /* full: keep what is there */ }
  return merged;
}

async function finishDelete(id: string): Promise<boolean> {
  const uid = await userId();
  if (!uid || uid === 'offline') return false;
  try {
    const now = new Date().toISOString();
    const { data, error } = await withTimeout<any>((supabase as any).from('site_visits')
      .update({ deleted_at: now }).eq('id', id).eq('user_id', uid).select('data'), 15_000);
    if (error) return false;
    if (!data?.length) {
      // Never uploaded (or its upload is still in flight): leave a deleted row, so a late
      // upload lands on it and stays deleted
      const { error: insErr } = await withTimeout<any>((supabase as any).from('site_visits')
        .upsert({ id, user_id: uid, data: {}, status: 'draft', deleted_at: now, updated_at: now }, { onConflict: 'id' }), 15_000);
      if (insErr) return false;
    }
    const row = data?.[0]?.data as SiteVisit | undefined;
    const paths = (row?.rooms ?? []).flatMap(r => r.photos.map(p => p.path)).filter(Boolean) as string[];
    if (paths.length) await withTimeout(supabase.storage.from(BUCKET).remove(paths), 20_000).catch(() => undefined);
    setTombstones(tombstones().filter(t => t !== id));
    return true;
  } catch { return false; }
}

/** The office links a visit to a project: only the link changes, the phone's content stays. */
export async function linkVisitToProject(id: string, projectId: string): Promise<boolean> {
  try { patchLocal(id, v => ({ ...v, projectId })); } catch { /* the cloud link is what matters */ }
  const uid = await userId();
  if (!uid || uid === 'offline') return false;
  try {
    const { error } = await withTimeout<any>((supabase as any).from('site_visits')
      .update({ project_id: projectId }).eq('id', id).eq('user_id', uid), 15_000);
    return !error;
  } catch { return false; }
}

/** One project's visits, straight from the cloud (the desktop's estimate panel). */
export async function projectVisits(projectId: string): Promise<SiteVisit[]> {
  const uid = await userId();
  if (!uid || uid === 'offline') return loadLocalVisits().filter(v => v.projectId === projectId);
  try {
    const { data, error } = await withTimeout<any>((supabase as any).from('site_visits')
      .select('data, project_id').eq('user_id', uid).eq('project_id', projectId).is('deleted_at', null), 15_000);
    if (error || !data) return [];
    return data.filter((r: any) => r.data?.id).map((r: any) => ({ ...(r.data as SiteVisit), projectId: r.project_id }));
  } catch { return []; }
}

/** A photo removed from a visit: its uploaded copy goes too. */
export function removeUploadedPhoto(path: string | undefined) {
  if (path) supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
}

/** Removed from the phone now; the cloud copy is marked deleted now or at the next signal. */
export async function deleteVisit(v: SiteVisit): Promise<void> {
  setTombstones([...tombstones(), v.id]);
  try { saveLocalVisits(loadLocalVisits().filter(x => x.id !== v.id)); } catch { /* removing frees space */ }
  await Promise.all(v.rooms.flatMap(r => r.photos).map(p => deletePhotoBlob(p.id)));
  await finishDelete(v.id);
}
