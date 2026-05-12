import React, { useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { CostItem } from '@/lib/takeoff/types';
import { generateSOWPdf, type SOWProjectMeta } from '@/lib/takeoff/sowGenerator';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costItems: CostItem[];
  defaultProjectName?: string;
}

function currency(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 });
}

export const SOWGeneratorDialog: React.FC<Props> = ({
  open, onOpenChange, costItems, defaultProjectName,
}) => {
  const [meta, setMeta] = useState<SOWProjectMeta>({
    projectName: defaultProjectName || '',
    clientName: '',
    clientContact: '',
    clientPhone: '',
    projectAddress: '',
    contactPerson: 'Yann',
    contactMobile: '',
    dateSubmitted: new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' }),
    tradeNotes: {},
    provisionalSums: {},
  });

  // Trade grouping for preview
  const byTrade = React.useMemo(() => {
    const map = new Map<string, CostItem[]>();
    for (const item of costItems) {
      const t = item.trade || 'General';
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(item);
    }
    return map;
  }, [costItems]);

  const subTotal = costItems.reduce((s, i) => s + (i.subtotal || 0), 0);
  const gst = subTotal * 0.1;
  const total = subTotal + gst;

  // Per-trade exclusion notes
  const [newNote, setNewNote] = useState<Record<string, string>>({});

  function addNote(trade: string) {
    const text = newNote[trade]?.trim();
    if (!text) return;
    setMeta((prev) => ({
      ...prev,
      tradeNotes: {
        ...prev.tradeNotes,
        [trade]: [...(prev.tradeNotes?.[trade] || []), text],
      },
    }));
    setNewNote((p) => ({ ...p, [trade]: '' }));
  }

  function removeNote(trade: string, idx: number) {
    setMeta((prev) => ({
      ...prev,
      tradeNotes: {
        ...prev.tradeNotes,
        [trade]: (prev.tradeNotes?.[trade] || []).filter((_, i) => i !== idx),
      },
    }));
  }

  function handleGenerate() {
    if (!meta.projectName.trim()) { toast.error('Enter a project name'); return; }
    if (!meta.clientName.trim())  { toast.error('Enter a client name'); return; }
    if (costItems.length === 0)   { toast.error('No cost items to include'); return; }
    try {
      generateSOWPdf({ meta, costItems });
      toast.success('SOW PDF downloaded');
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to generate PDF');
      console.error(err);
    }
  }

  const set = (field: keyof SOWProjectMeta) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMeta((p) => ({ ...p, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Generate Scope of Works
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-5 pb-2">
            {/* Project metadata */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Project Details
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Project Name *</Label>
                  <Input value={meta.projectName} onChange={set('projectName')} placeholder="Tiling works Level 1" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Client *</Label>
                  <Input value={meta.clientName} onChange={set('clientName')} placeholder="McKenzie Aged Care Group" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Client Contact</Label>
                  <Input value={meta.clientContact} onChange={set('clientContact')} placeholder="John Smith" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Client Phone</Label>
                  <Input value={meta.clientPhone} onChange={set('clientPhone')} placeholder="0400 000 000" className="h-8 text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Project Address</Label>
                  <Input value={meta.projectAddress} onChange={set('projectAddress')} placeholder="74 University Drive, Varsity Lakes QLD 4227" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Watermark Contact</Label>
                  <Input value={meta.contactPerson} onChange={set('contactPerson')} placeholder="Yann" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mobile</Label>
                  <Input value={meta.contactMobile} onChange={set('contactMobile')} placeholder="0400 000 000" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date Submitted</Label>
                  <Input value={meta.dateSubmitted} onChange={set('dateSubmitted')} className="h-8 text-sm" />
                </div>
              </div>
            </section>

            {/* Trade preview + exclusion notes */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Trade Sections — {byTrade.size} trade{byTrade.size !== 1 ? 's' : ''}
              </h3>

              {byTrade.size === 0 && (
                <p className="text-xs text-muted-foreground py-2">No cost items yet. Add items in the Cost Estimator first.</p>
              )}

              {Array.from(byTrade.entries()).map(([trade, items]) => {
                const tradeTotal = items.reduce((s, i) => s + (i.subtotal || 0), 0);
                const notes = meta.tradeNotes?.[trade] || [];
                return (
                  <div key={trade} className="border rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-primary/5">
                      <span className="text-sm font-semibold">{trade}</span>
                      <Badge variant="secondary" className="text-xs">{currency(tradeTotal)}</Badge>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {items.slice(0, 4).map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate max-w-[60%]">{item.name || item.description}</span>
                          <span>{item.quantity} {item.unit} @ {currency(item.unitCost)}</span>
                        </div>
                      ))}
                      {items.length > 4 && (
                        <p className="text-xs text-muted-foreground">+ {items.length - 4} more items</p>
                      )}
                    </div>

                    {/* Exclusion notes */}
                    <div className="px-3 pb-3 space-y-1 border-t pt-2">
                      <p className="text-xs font-medium text-muted-foreground">Exclusions / Notes</p>
                      {notes.map((n, i) => (
                        <div key={i} className="flex items-start gap-1 group">
                          <span className="text-xs flex-1">• {n}</span>
                          <button onClick={() => removeNote(trade, i)} className="opacity-0 group-hover:opacity-100 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-1">
                        <Input
                          value={newNote[trade] || ''}
                          onChange={(e) => setNewNote((p) => ({ ...p, [trade]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && addNote(trade)}
                          placeholder="Add exclusion or note…"
                          className="h-7 text-xs"
                        />
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => addNote(trade)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Totals summary */}
            {costItems.length > 0 && (
              <section className="border rounded-md overflow-hidden">
                <div className="px-3 py-2 bg-primary/5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
                </div>
                <div className="px-3 py-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sub Total</span>
                    <span>{currency(subTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST (10%)</span>
                    <span>{currency(gst)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total (inc. GST)</span>
                    <span className="text-primary">{currency(total)}</span>
                  </div>
                </div>
              </section>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={costItems.length === 0}>
            <FileText className="h-4 w-4 mr-2" />
            Download SOW PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
