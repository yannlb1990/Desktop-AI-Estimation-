import React, { useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Cloud, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFFEPhoto } from '@/lib/ffe/storage';
import type { FFEItem, FFECategory, FFEStatus, FFEPhoto } from '@/lib/ffe/types';

const CATEGORIES: FFECategory[] = ['Appliance', 'Fixture', 'Fitting', 'Furniture', 'Equipment', 'Other'];
const STATUSES: FFEStatus[] = ['Specified', 'Allowance', 'TBC', 'Client Supply'];

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyItem(): FFEItem {
  return {
    id: newId(),
    name: '',
    category: 'Appliance',
    quantity: 1,
    unit: 'ea',
    supplyCost: 0,
    installCost: 0,
    supplier: '',
    model: '',
    notes: '',
    status: 'Specified',
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

interface FFEItemFormProps {
  open: boolean;
  onClose: () => void;
  initial?: FFEItem;
  projectId: string;
  onSave: (item: FFEItem) => void;
}

export const FFEItemForm: React.FC<FFEItemFormProps> = ({ open, onClose, initial, projectId, onSave }) => {
  const [item, setItem] = useState<FFEItem>(() => initial ? { ...initial } : emptyItem());
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<FFEItem>) => setItem(prev => ({ ...prev, ...patch }));

  // Reset when opening with new initial
  React.useEffect(() => {
    if (open) setItem(initial ? { ...initial } : emptyItem());
  }, [open, initial]);

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files) return;
    const newPhotos: FFEPhoto[] = [];

    for (const file of Array.from(files).slice(0, 4 - item.photos.length)) {
      if (!file.type.startsWith('image/')) continue;
      const localUrl = URL.createObjectURL(file);
      const photo: FFEPhoto = { id: newId(), localUrl, fileName: file.name, uploading: true };
      newPhotos.push(photo);
    }

    if (newPhotos.length === 0) return;
    set({ photos: [...item.photos, ...newPhotos] });

    // Upload to Supabase in background
    for (let i = 0; i < newPhotos.length; i++) {
      const photo = newPhotos[i];
      const file = Array.from(files)[i];
      const supabaseUrl = await uploadFFEPhoto(projectId, item.id, file);
      setItem(prev => ({
        ...prev,
        photos: prev.photos.map(p =>
          p.id === photo.id ? { ...p, supabaseUrl: supabaseUrl ?? undefined, uploading: false } : p
        ),
      }));
      if (supabaseUrl) toast.success('Photo saved to cloud');
    }
  };

  const removePhoto = (id: string) => {
    setItem(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== id) }));
  };

  const handleSave = () => {
    if (!item.name.trim()) { toast.error('Item name is required'); return; }
    onSave({ ...item, updatedAt: new Date().toISOString() });
    onClose();
  };

  const total = (item.supplyCost + item.installCost) * item.quantity;

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial ? 'Edit Item' : 'Add FF&E Item'}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <Label>Item Name *</Label>
            <Input
              placeholder="e.g. Fisher & Paykel Dishwasher"
              value={item.name}
              onChange={e => set({ name: e.target.value })}
            />
          </div>

          {/* Category + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={item.category} onValueChange={v => set({ category: v as FFECategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={item.status} onValueChange={v => set({ status: v as FFEStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Qty + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={item.quantity}
                onChange={e => set({ quantity: Number(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Input
                placeholder="ea"
                value={item.unit}
                onChange={e => set({ unit: e.target.value })}
              />
            </div>
          </div>

          {/* Supply + Install cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Supply Cost (ex GST)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min={0}
                  className="pl-6"
                  value={item.supplyCost || ''}
                  onChange={e => set({ supplyCost: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Install Cost (ex GST)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min={0}
                  className="pl-6"
                  value={item.installCost || ''}
                  onChange={e => set({ installCost: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Line total */}
          <div className="flex justify-end">
            <span className="text-sm text-muted-foreground mr-2">Line total:</span>
            <span className="text-sm font-semibold">
              {total.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 })}
            </span>
          </div>

          {/* Supplier + Model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Supplier</Label>
              <Input placeholder="e.g. Harvey Norman" value={item.supplier} onChange={e => set({ supplier: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Model / Spec</Label>
              <Input placeholder="e.g. DD60DCHX9" value={item.model} onChange={e => set({ model: e.target.value })} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              placeholder="Colour, finish, size, special requirements…"
              rows={2}
              value={item.notes}
              onChange={e => set({ notes: e.target.value })}
            />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label>Photos (max 4)</Label>
            {item.photos.length < 4 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Upload className="h-4 w-4" />
                Click to upload photos
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handlePhotoFiles(e.target.files)}
            />

            {item.photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {item.photos.map(photo => (
                  <div key={photo.id} className="relative aspect-square rounded overflow-hidden border bg-muted">
                    <img
                      src={photo.localUrl || photo.supabaseUrl}
                      alt={photo.fileName}
                      className="w-full h-full object-cover"
                    />
                    {photo.uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                      </div>
                    )}
                    {photo.supabaseUrl && !photo.uploading && (
                      <div className="absolute bottom-1 right-1">
                        <Cloud className="h-3 w-3 text-white drop-shadow" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5 hover:bg-black/70"
                    >
                      <X className="h-2.5 w-2.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>
            {initial ? 'Save Changes' : 'Add Item'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
