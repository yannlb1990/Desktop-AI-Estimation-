import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FFEItemForm } from './FFEItemForm';
import type { FFERoom, FFEItem } from '@/lib/ffe/types';
import { CATEGORY_COLORS, STATUS_COLORS } from '@/lib/ffe/types';
import { roomTotal } from '@/lib/ffe/storage';

interface FFERoomSectionProps {
  room: FFERoom;
  projectId: string;
  onAddItem: (roomId: string, item: FFEItem) => void;
  onUpdateItem: (roomId: string, item: FFEItem) => void;
  onDeleteItem: (roomId: string, itemId: string) => void;
  onDeleteRoom: (roomId: string) => void;
}

export const FFERoomSection: React.FC<FFERoomSectionProps> = ({
  room,
  projectId,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onDeleteRoom,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<FFEItem | undefined>();

  const total = roomTotal(room);

  const openAdd = () => { setEditItem(undefined); setFormOpen(true); };
  const openEdit = (item: FFEItem) => { setEditItem(item); setFormOpen(true); };

  const handleSave = (item: FFEItem) => {
    if (editItem) {
      onUpdateItem(room.id, item);
    } else {
      onAddItem(room.id, item);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Room header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="font-medium text-sm">{room.name}</span>
          <Badge variant="secondary" className="text-xs">{room.items.length} item{room.items.length !== 1 ? 's' : ''}</Badge>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="text-sm font-semibold tabular-nums">
              {total.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 })}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={e => { e.stopPropagation(); openAdd(); }}
            title="Add item"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={e => { e.stopPropagation(); onDeleteRoom(room.id); }}
            title="Delete room"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Item list */}
      {expanded && (
        <div className="divide-y">
          {room.items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No items yet.{' '}
              <button className="text-primary underline" onClick={openAdd}>Add one</button>
            </div>
          ) : (
            room.items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 group">
                {/* Thumbnail */}
                <div className="w-8 h-8 rounded border bg-muted shrink-0 overflow-hidden">
                  {item.photos[0] ? (
                    <img
                      src={item.photos[0].localUrl || item.photos[0].supabaseUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <Badge className={`text-[10px] px-1 py-0 ${CATEGORY_COLORS[item.category]}`}>
                      {item.category}
                    </Badge>
                    <Badge className={`text-[10px] px-1 py-0 ${STATUS_COLORS[item.status]}`}>
                      {item.status}
                    </Badge>
                    {item.supplier && (
                      <span className="text-xs text-muted-foreground truncate">{item.supplier}</span>
                    )}
                  </div>
                </div>

                {/* Qty + total */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">
                    {((item.supplyCost + item.installCost) * item.quantity).toLocaleString('en-AU', {
                      style: 'currency', currency: 'AUD', minimumFractionDigits: 0,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.quantity} {item.unit}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(item)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteItem(room.id, item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}

          {room.items.length > 0 && (
            <div className="px-4 py-2 flex justify-end">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={openAdd}>
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
            </div>
          )}
        </div>
      )}

      <FFEItemForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editItem}
        projectId={projectId}
        onSave={handleSave}
      />
    </div>
  );
};
