import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Cloud, Loader2, FileText, ExternalLink, ImageOff } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFFEPhoto } from '@/lib/ffe/storage';
import type { FFEItem, FFECategory, FFEStatus, FFEPhoto, FFEQuoteDoc } from '@/lib/ffe/types';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isAllowedMedia(file: File) {
  if (file.type.startsWith('image/')) return true;
  if (file.type === 'application/pdf') return true;
  return /\.(jpe?g|png|gif|webp|heic|heif|tiff?|bmp|pdf|svg)$/i.test(file.name);
}

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

function isValidImgSrc(s: string) {
  return s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://');
}

interface FFEPhotoThumbProps {
  photo: FFEPhoto;
  resolvedUrl?: string;
  onRemove: () => void;
  onView: (src: string) => void;
}

const FFEPhotoThumb: React.FC<FFEPhotoThumbProps> = ({ photo, resolvedUrl, onRemove, onView }) => {
  // Track which URLs have failed — set-based so no race with onError + resolvedUrl arriving
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  // Reset failures when photo identity changes (new item opened)
  useEffect(() => { setFailedUrls(new Set()); }, [photo.id]);

  // Only include genuinely loadable URLs — storage: paths are never valid img src
  const candidates = [resolvedUrl, photo.localUrl, photo.supabaseUrl]
    .filter((s): s is string => !!s && isValidImgSrc(s));

  const src = candidates.find(s => !failedUrls.has(s));
  // Show spinner when no valid candidate yet but a signed URL is still being fetched
  const pendingResolution = !src && !!photo.supabaseUrl?.startsWith('storage:') && !resolvedUrl;
  const allFailed = !src && !pendingResolution && !photo.uploading;

  function handleError() {
    if (src) setFailedUrls(prev => { const n = new Set(prev); n.add(src); return n; });
  }

  return (
    <div
      className="relative aspect-square rounded overflow-hidden border bg-muted cursor-zoom-in"
      onClick={() => !photo.uploading && src && onView(src)}
    >
      {allFailed ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
          <ImageOff className="h-4 w-4 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground">Unavailable</span>
        </div>
      ) : src ? (
        <img
          src={src}
          alt={photo.fileName}
          className="w-full h-full object-cover"
          onError={handleError}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        </div>
      )}
      {photo.uploading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <Loader2 className="h-4 w-4 text-white animate-spin" />
        </div>
      )}
      {photo.supabaseUrl && !photo.uploading && (
        <div className="absolute bottom-1 left-1">
          <Cloud className="h-3 w-3 text-white/70 drop-shadow" />
        </div>
      )}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5 hover:bg-black/70"
      >
        <X className="h-2.5 w-2.5 text-white" />
      </button>
    </div>
  );
};

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
  const quoteDocRef = useRef<HTMLInputElement>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [viewingIsPdf, setViewingIsPdf] = useState(false);
  // Resolved signed URLs for photos stored as storage: paths
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  const set = (patch: Partial<FFEItem>) => setItem(prev => ({ ...prev, ...patch }));

  React.useEffect(() => {
    if (open) {
      setItem(initial ? { ...initial } : emptyItem());
      setResolvedUrls({});
    }
  }, [open, initial]);

  // When form opens with an existing item, resolve storage: paths to fresh signed URLs
  useEffect(() => {
    if (!open) return;
    // Resolve storage: paths AND old https:// public/signed URLs (bucket is now private)
    // Always resolve when a supabaseUrl exists — localUrl may be broken/truncated
    const photosNeedingResolution = (initial?.photos ?? []).filter(p => {
      const u = p.supabaseUrl ?? '';
      return u.startsWith('storage:ffe-photos/') || u.includes('/ffe-photos/');
    });
    if (photosNeedingResolution.length === 0) return;

    Promise.all(
      photosNeedingResolution.map(async p => {
        const u = p.supabaseUrl ?? '';
        let path: string;
        if (u.startsWith('storage:ffe-photos/')) {
          path = u.replace('storage:ffe-photos/', '');
        } else {
          // Old public URL: extract path after /ffe-photos/
          const parts = u.split('/ffe-photos/');
          if (parts.length < 2) return null;
          path = parts[1].split('?')[0];
        }
        const { data } = await supabase.storage.from('ffe-photos').createSignedUrl(path, 3600);
        return data?.signedUrl ? { id: p.id, url: data.signedUrl } : null;
      })
    ).then(results => {
      const map: Record<string, string> = {};
      results.forEach(r => { if (r) map[r.id] = r.url; });
      setResolvedUrls(map);
    });
  }, [open, initial]);

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files) return;
    const fileArr = Array.from(files).slice(0, 4 - item.photos.length);
    const valid = fileArr.filter(f => {
      if (isAllowedMedia(f)) return true;
      toast.error(`${f.name}: unsupported file type`);
      return false;
    });
    if (valid.length === 0) return;

    // Convert to base64 immediately so URLs survive localStorage round-trips
    const newPhotos: FFEPhoto[] = await Promise.all(
      valid.map(async (file) => ({
        id: newId(),
        localUrl: await fileToBase64(file),
        fileName: file.name,
        uploading: true,
      }))
    );

    set({ photos: [...item.photos, ...newPhotos] });

    // Also upload to Supabase in background for cloud backup
    for (let i = 0; i < newPhotos.length; i++) {
      const photo = newPhotos[i];
      const supabaseUrl = await uploadFFEPhoto(projectId, item.id, valid[i]);
      setItem(prev => ({
        ...prev,
        photos: prev.photos.map(p =>
          p.id === photo.id ? { ...p, supabaseUrl: supabaseUrl ?? undefined, uploading: false } : p
        ),
      }));
    }
  };

  const removePhoto = (id: string) => {
    setItem(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== id) }));
  };

  const handleQuoteDoc = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const sizeKb = file.size / 1024;
    if (sizeKb > 10240) { toast.error('File too large — 10 MB max'); return; }
    const doc: FFEQuoteDoc = { fileName: file.name, fileType: file.type, uploading: true };
    set({ quoteDoc: doc });
    try {
      const localUrl = await fileToBase64(file);
      const supabaseUrl = await uploadFFEPhoto(projectId, `${item.id}_quote`, file);
      set({ quoteDoc: { fileName: file.name, fileType: file.type, localUrl, supabaseUrl: supabaseUrl ?? undefined, uploading: false } });
      toast.success('Quote document saved');
    } catch {
      toast.error('Failed to save document');
      set({ quoteDoc: undefined });
    }
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
            <Label>Photos — JPEG, PNG, WEBP, HEIC (max 4)</Label>
            {item.photos.length < 4 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Upload className="h-4 w-4" />
                Upload photos
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.heic,.heif,.webp,.tiff,.bmp"
              multiple
              className="hidden"
              onChange={e => { handlePhotoFiles(e.target.files); e.target.value = ''; }}
            />
            {item.photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {item.photos.map(photo => (
                  <FFEPhotoThumb
                    key={photo.id}
                    photo={photo}
                    resolvedUrl={resolvedUrls[photo.id]}
                    onRemove={() => removePhoto(photo.id)}
                    onView={src => { setViewingUrl(src); setViewingIsPdf(false); }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Quote Document */}
          <div className="space-y-2">
            <Label>Quote Document — PDF, DOC, XLS</Label>
            {!item.quoteDoc ? (
              <button
                type="button"
                onClick={() => quoteDocRef.current?.click()}
                className="flex items-center gap-2 w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <FileText className="h-4 w-4" />
                Upload supplier quote
              </button>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.quoteDoc.fileName}</p>
                  {item.quoteDoc.uploading && <p className="text-xs text-muted-foreground">Saving...</p>}
                  {item.quoteDoc.supabaseUrl && !item.quoteDoc.uploading && <p className="text-xs text-muted-foreground flex items-center gap-1"><Cloud className="h-3 w-3" /> Saved to cloud</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(item.quoteDoc.supabaseUrl || item.quoteDoc.localUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        const url = item.quoteDoc!.supabaseUrl || item.quoteDoc!.localUrl;
                        if (url) { setViewingUrl(url); setViewingIsPdf(true); }
                      }}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                      title="View document"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => set({ quoteDoc: undefined })}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}
            <input
              ref={quoteDocRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={e => { handleQuoteDoc(e.target.files); e.target.value = ''; }}
            />
          </div>

          {/* Lightbox / Document viewer */}
          {viewingUrl && (
            <div
              className="fixed inset-0 z-[10002] bg-black/90 flex items-center justify-center"
              onClick={() => setViewingUrl(null)}
            >
              <button
                type="button"
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                onClick={() => setViewingUrl(null)}
              >
                <X className="h-5 w-5 text-white" />
              </button>
              {viewingIsPdf ? (
                <iframe
                  src={viewingUrl}
                  title="Document preview"
                  className="w-[90vw] h-[90vh] rounded-lg shadow-2xl border-0 bg-white"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                />
              ) : (
                <img
                  src={viewingUrl}
                  alt="Full size"
                  className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                />
              )}
            </div>
          )}
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
