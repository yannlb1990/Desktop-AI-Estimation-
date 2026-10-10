import { supabase } from '@/integrations/supabase/client';
import type { FFESheet, FFERoom, FFEPhoto } from './types';
import { DEFAULT_ROOMS } from './types';
import { getUserStorageKey } from '@/lib/localAuth';
import { syncProjectToSupabase } from '@/lib/db/projects';

// Scoped to the signed-in account (the old unscoped key leaked between accounts on a
// shared computer and is moved across on first load).
function key(projectId: string) {
  return getUserStorageKey(`ffe_sheet_${projectId}`);
}
const legacyKey = (projectId: string) => `ffe_sheet_${projectId}`;

function readProject(projectId: string): any | null {
  try {
    const projects: any[] = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    return projects.find(p => p.id === projectId) ?? null;
  } catch {
    return null;
  }
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadFFESheet(projectId: string): FFESheet {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (raw) return JSON.parse(raw) as FFESheet;
    const legacy = localStorage.getItem(legacyKey(projectId));
    if (legacy) {
      localStorage.setItem(key(projectId), legacy);
      localStorage.removeItem(legacyKey(projectId));
      return JSON.parse(legacy) as FFESheet;
    }
    // Another device: use the copy synced with the project
    const synced = readProject(projectId)?.ffe_sheet;
    if (synced?.rooms) return synced as FFESheet;
  } catch { /* ignore */ }
  // return default sheet
  return {
    projectId,
    rooms: DEFAULT_ROOMS.map(r => ({ ...r, id: newId() })),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Saves locally (with photo previews) and on the project record (without the in-browser
 * image data, which is too large), so the schedule syncs to the cloud and the FF&E total
 * can be included in the quote. Throws if the browser's storage is full.
 */
export function saveFFESheet(sheet: FFESheet): void {
  const updated = { ...sheet, updatedAt: new Date().toISOString() };
  localStorage.setItem(key(sheet.projectId), JSON.stringify(updated));

  try {
    const projectsKey = getUserStorageKey('local_projects');
    const projects: any[] = JSON.parse(localStorage.getItem(projectsKey) || '[]');
    const idx = projects.findIndex(p => p.id === sheet.projectId);
    if (idx === -1) return;
    const lightweight: FFESheet = {
      ...updated,
      rooms: updated.rooms.map(r => ({
        ...r,
        items: r.items.map(i => ({ ...i, photos: (i.photos || []).map(ph => ({ ...ph, localUrl: '' })) })),
      })),
    };
    projects[idx] = {
      ...projects[idx],
      ffe_sheet: lightweight,
      ffe_summary: { includeInQuote: !!updated.includeInQuote, totalExGst: sheetTotal(updated) },
    };
    localStorage.setItem(projectsKey, JSON.stringify(projects));
    syncProjectToSupabase(projects[idx]);
  } catch (e) {
    console.warn('[ffe] could not sync FF&E to the project:', e);
  }
}

export async function uploadFFEPhoto(
  projectId: string,
  itemId: string,
  file: File,
): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${projectId}/${itemId}/${newId()}.${ext}`;

  const { error } = await supabase.storage
    .from('ffe-photos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    console.error('FFE photo upload error', error);
    return null;
  }

  // Return the storage path — display uses base64 localUrl which never expires.
  // This path can be used to generate a fresh signed URL if needed in future.
  return `storage:ffe-photos/${path}`;
}

export async function deleteFFEPhoto(supabaseUrl: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  let path: string | null = null;
  if (supabaseUrl.startsWith('storage:ffe-photos/')) {
    path = supabaseUrl.replace('storage:ffe-photos/', '');
  } else {
    // Legacy: extract path from old public/signed URL
    const parts = supabaseUrl.split('/ffe-photos/');
    if (parts.length >= 2) path = parts[1].split('?')[0];
  }
  if (!path) return;

  await supabase.storage.from('ffe-photos').remove([path]);
}

export function roomTotal(room: FFERoom): number {
  return room.items.reduce((sum, item) => {
    return sum + (item.supplyCost + item.installCost) * item.quantity;
  }, 0);
}

export function sheetTotal(sheet: FFESheet): number {
  return sheet.rooms.reduce((sum, room) => sum + roomTotal(room), 0);
}
