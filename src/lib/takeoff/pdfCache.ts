const DB_NAME = 'metricore-pdf-cache';
const STORE_NAME = 'pdfs';

interface CachedPDF {
  planId: string;
  data: ArrayBuffer;
  name: string;
  pageCount: number;
  cachedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
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

export async function cachePDF(planId: string, data: ArrayBuffer, name: string, pageCount: number): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry: CachedPDF = { planId, data, name, pageCount, cachedAt: Date.now() };
      const req = store.put(entry);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => { db.close(); resolve(); };
    });
  } catch {
    // IndexedDB unavailable (private browsing, quota exceeded) — silently skip
  }
}

export async function getCachedPDF(planId: string): Promise<CachedPDF | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(planId);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
