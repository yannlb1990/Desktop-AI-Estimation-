import { getLocalUser } from '@/lib/localAuth';

const DB_NAME = 'metricore-pdf-cache';
const DB_VERSION = 2;
const STORE_NAME = 'pdfs';
const MAX_ENTRIES = 20;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CachedPDF {
  planId: string; // "{userId}:{originalPlanId}"
  data: ArrayBuffer;
  name: string;
  pageCount: number;
  cachedAt: number;
}

function getScopedKey(planId: string): string {
  const user = getLocalUser();
  const uid = user?.email ?? '__anon__';
  return `${uid}:${planId}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'planId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function evictOldEntries(db: IDBDatabase): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const all: CachedPDF[] = req.result ?? [];
        const now = Date.now();
        // Remove expired entries and enforce count cap
        const valid = all
          .filter(e => now - e.cachedAt < TTL_MS)
          .sort((a, b) => b.cachedAt - a.cachedAt)
          .slice(0, MAX_ENTRIES);
        const keepIds = new Set(valid.map(e => e.planId));
        for (const entry of all) {
          if (!keepIds.has(entry.planId)) store.delete(entry.planId);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Eviction failure is non-fatal
  }
}

export async function cachePDF(planId: string, data: ArrayBuffer, name: string, pageCount: number): Promise<void> {
  try {
    const db = await openDB();
    await evictOldEntries(db);
    const scopedId = getScopedKey(planId);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry: CachedPDF = { planId: scopedId, data, name, pageCount, cachedAt: Date.now() };
      const req = store.put(entry);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => { db.close(); resolve(); };
    });
  } catch {
    // IndexedDB unavailable (private browsing, quota exceeded) — silently skip
  }
}

export async function getCachedPDF(planId: string): Promise<{ data: ArrayBuffer; name: string; pageCount: number } | null> {
  try {
    const db = await openDB();
    const scopedId = getScopedKey(planId);
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(scopedId);
      req.onsuccess = () => {
        db.close();
        const entry: CachedPDF | undefined = req.result;
        if (!entry) { resolve(null); return; }
        if (Date.now() - entry.cachedAt > TTL_MS) { resolve(null); return; }
        resolve({ data: entry.data, name: entry.name, pageCount: entry.pageCount });
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
