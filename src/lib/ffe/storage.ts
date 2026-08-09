import { supabase } from '@/integrations/supabase/client';
import type { FFESheet, FFERoom, FFEPhoto } from './types';
import { DEFAULT_ROOMS } from './types';

function key(projectId: string) {
  return `ffe_sheet_${projectId}`;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadFFESheet(projectId: string): FFESheet {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (raw) return JSON.parse(raw) as FFESheet;
  } catch { /* ignore */ }
  // return default sheet
  return {
    projectId,
    rooms: DEFAULT_ROOMS.map(r => ({ ...r, id: newId() })),
    updatedAt: new Date().toISOString(),
  };
}

export function saveFFESheet(sheet: FFESheet): void {
  const updated = { ...sheet, updatedAt: new Date().toISOString() };
  localStorage.setItem(key(sheet.projectId), JSON.stringify(updated));
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
