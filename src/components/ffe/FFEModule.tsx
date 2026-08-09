import React, { useState, useCallback } from 'react';
import { Plus, Download, Sofa } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FFERoomSection } from './FFERoomSection';
import { loadFFESheet, saveFFESheet, sheetTotal } from '@/lib/ffe/storage';
import { exportFFEtoPDF } from '@/lib/ffe/pdfExport';
import type { FFESheet, FFEItem, FFERoom } from '@/lib/ffe/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface FFEModuleProps {
  projectId: string;
  projectName?: string;
}

export const FFEModule: React.FC<FFEModuleProps> = ({ projectId, projectName }) => {
  const [sheet, setSheet] = useState<FFESheet>(() => loadFFESheet(projectId));
  const [newRoomName, setNewRoomName] = useState('');
  const [addingRoom, setAddingRoom] = useState(false);
  const [exporting, setExporting] = useState(false);

  const persist = useCallback((updated: FFESheet) => {
    setSheet(updated);
    saveFFESheet(updated);
  }, []);

  const addRoom = () => {
    const name = newRoomName.trim();
    if (!name) { toast.error('Enter a room name'); return; }
    const room: FFERoom = { id: newId(), name, items: [], order: sheet.rooms.length };
    persist({ ...sheet, rooms: [...sheet.rooms, room] });
    setNewRoomName('');
    setAddingRoom(false);
  };

  const deleteRoom = (roomId: string) => {
    persist({ ...sheet, rooms: sheet.rooms.filter(r => r.id !== roomId) });
  };

  const addItem = (roomId: string, item: FFEItem) => {
    persist({
      ...sheet,
      rooms: sheet.rooms.map(r =>
        r.id === roomId ? { ...r, items: [...r.items, item] } : r
      ),
    });
  };

  const updateItem = (roomId: string, item: FFEItem) => {
    persist({
      ...sheet,
      rooms: sheet.rooms.map(r =>
        r.id === roomId
          ? { ...r, items: r.items.map(i => i.id === item.id ? item : i) }
          : r
      ),
    });
  };

  const deleteItem = (roomId: string, itemId: string) => {
    persist({
      ...sheet,
      rooms: sheet.rooms.map(r =>
        r.id === roomId ? { ...r, items: r.items.filter(i => i.id !== itemId) } : r
      ),
    });
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      // Resolve all photo URLs to base64 data URLs so jsPDF can embed them
      const resolvedUrls: Record<string, string> = {};
      for (const room of sheet.rooms) {
        for (const item of room.items) {
          for (const photo of item.photos) {
            // Local base64 — already usable
            if (photo.localUrl?.startsWith('data:')) {
              resolvedUrls[photo.id] = photo.localUrl;
              continue;
            }
            // Supabase storage path — get signed URL then convert to base64
            const su = photo.supabaseUrl ?? '';
            if (su.startsWith('storage:ffe-photos/')) {
              const path = su.replace('storage:ffe-photos/', '');
              const { data } = await supabase.storage.from('ffe-photos').createSignedUrl(path, 3600);
              if (data?.signedUrl) {
                const b64 = await fetchAsBase64(data.signedUrl);
                if (b64) resolvedUrls[photo.id] = b64;
              }
            } else if (su.startsWith('https://')) {
              const b64 = await fetchAsBase64(su);
              if (b64) resolvedUrls[photo.id] = b64;
            }
          }
        }
      }
      await exportFFEtoPDF(sheet, projectName || 'Project', resolvedUrls);
      toast.success('FF&E schedule downloaded');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  const total = sheetTotal(sheet);
  const totalItems = sheet.rooms.reduce((s, r) => s + r.items.length, 0);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sofa className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="font-semibold text-base">FF&amp;E Schedule</h2>
            <p className="text-xs text-muted-foreground">
              Fixtures, Fittings &amp; Equipment — {totalItems} item{totalItems !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddingRoom(v => !v)}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Room
          </Button>
          <Button
            size="sm"
            disabled={totalItems === 0 || exporting}
            onClick={handleExportPDF}
          >
            <Download className="h-4 w-4 mr-1" />
            {exporting ? 'Generating…' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* Add room inline input */}
      {addingRoom && (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Room name (e.g. Home Theatre)"
            value={newRoomName}
            onChange={e => setNewRoomName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addRoom(); if (e.key === 'Escape') setAddingRoom(false); }}
            className="h-9"
          />
          <Button size="sm" onClick={addRoom}>Add</Button>
          <Button size="sm" variant="ghost" onClick={() => setAddingRoom(false)}>Cancel</Button>
        </div>
      )}

      {/* Room sections */}
      <div className="space-y-3">
        {sheet.rooms.map(room => (
          <FFERoomSection
            key={room.id}
            room={room}
            projectId={projectId}
            onAddItem={addItem}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            onDeleteRoom={deleteRoom}
          />
        ))}
      </div>

      {/* Total bar */}
      {total > 0 && (
        <div className="sticky bottom-0 bg-background border-t pt-3 pb-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total FF&amp;E (excl. GST)</span>
            <span className="text-lg font-bold tabular-nums">
              {total.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-xs text-muted-foreground">Incl. GST</span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {(total * 1.1).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
