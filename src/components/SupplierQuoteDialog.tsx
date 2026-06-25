import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mail, Plus, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CostItem, TRADE_OPTIONS } from '@/lib/takeoff/types';
import { loadSuppliers, addSupplier, removeSupplier, type SavedSupplier } from '@/lib/suppliers';
import { cn } from '@/lib/utils';

interface SupplierQuoteDialogProps {
  open: boolean;
  onClose: () => void;
  items: CostItem[];
  projectName?: string;
  siteAddress?: string;
}

const EMPTY_NEW_SUPPLIER = { name: '', email: '', phone: '', state: '', trades: [] as string[] };

export function SupplierQuoteDialog({ open, onClose, items, projectName = '', siteAddress = '' }: SupplierQuoteDialogProps) {
  const [suppliers, setSuppliers] = useState<SavedSupplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState(EMPTY_NEW_SUPPLIER);
  const [projectNameVal, setProjectNameVal] = useState(projectName);
  const [siteAddressVal, setSiteAddressVal] = useState(siteAddress);
  const [contractorName, setContractorName] = useState('');
  const [contractorEmail, setContractorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setSuppliers(loadSuppliers());
      setProjectNameVal(projectName);
      setSiteAddressVal(siteAddress);
      setSelectedSupplierId('');
      setShowAddForm(false);
      setNewSupplier(EMPTY_NEW_SUPPLIER);
      setMessage('');
    }
  }, [open, projectName, siteAddress]);

  const tradeOptions = useMemo(() => {
    const trades = new Set(items.map(i => i.trade || i.category || 'General').filter(Boolean));
    return Array.from(trades);
  }, [items]);

  const relevantSuppliers = useMemo(() => {
    if (!tradeOptions.length) return suppliers;
    return suppliers.filter(s => s.trades.length === 0 || s.trades.some(t => tradeOptions.includes(t)));
  }, [suppliers, tradeOptions]);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  const handleToggleTradeOnNew = (trade: string) => {
    setNewSupplier(prev => ({
      ...prev,
      trades: prev.trades.includes(trade) ? prev.trades.filter(t => t !== trade) : [...prev.trades, trade],
    }));
  };

  const handleSaveNewSupplier = () => {
    if (!newSupplier.name.trim() || !newSupplier.email.trim()) {
      toast.error('Supplier name and email are required');
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newSupplier.email);
    if (!emailOk) {
      toast.error('Enter a valid email address');
      return;
    }
    const saved = addSupplier({
      name: newSupplier.name.trim(),
      email: newSupplier.email.trim(),
      phone: newSupplier.phone.trim() || undefined,
      state: newSupplier.state || undefined,
      trades: newSupplier.trades,
    });
    const updated = loadSuppliers();
    setSuppliers(updated);
    setSelectedSupplierId(saved.id);
    setShowAddForm(false);
    setNewSupplier(EMPTY_NEW_SUPPLIER);
    toast.success(`${saved.name} saved`);
  };

  const handleDeleteSupplier = (id: string) => {
    removeSupplier(id);
    setSuppliers(loadSuppliers());
    if (selectedSupplierId === id) setSelectedSupplierId('');
  };

  const handleSend = async () => {
    if (!selectedSupplier) {
      toast.error('Select a supplier');
      return;
    }
    if (!contractorEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contractorEmail)) {
      toast.error('Enter a valid reply-to (your) email address');
      return;
    }

    setSending(true);
    try {
      const quoteItems = items.map(item => ({
        trade: item.trade || item.category || 'General',
        description: item.name + (item.description ? ` — ${item.description}` : ''),
        unit: item.unit,
        quantity: item.quantity,
      }));

      const { error } = await supabase.functions.invoke('send-supplier-quote-request', {
        body: {
          supplierEmail: selectedSupplier.email,
          supplierName: selectedSupplier.name,
          projectName: projectNameVal,
          siteAddress: siteAddressVal,
          items: quoteItems,
          contractorName: contractorName || 'Estimator',
          contractorEmail: contractorEmail,
          message: message || undefined,
        },
      });

      if (error) throw new Error(error.message);

      toast.success(`Quote request sent to ${selectedSupplier.name}`);
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send quote request');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Request Supplier Quote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Items being quoted */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Items ({items.length})</Label>
            <div className="max-h-36 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Trade</th>
                    <th className="text-left px-3 py-2 font-medium">Item</th>
                    <th className="text-right px-3 py-2 font-medium">Qty</th>
                    <th className="text-left px-3 py-2 font-medium">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-t border-border/40">
                      <td className="px-3 py-1.5 text-muted-foreground">{item.trade || item.category || '—'}</td>
                      <td className="px-3 py-1.5">{item.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{item.quantity.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Project details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Project Name</Label>
              <Input value={projectNameVal} onChange={e => setProjectNameVal(e.target.value)} placeholder="e.g. Smith Residence" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Site Address</Label>
              <Input value={siteAddressVal} onChange={e => setSiteAddressVal(e.target.value)} placeholder="e.g. 12 Builder St, Sydney" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Your Name</Label>
              <Input value={contractorName} onChange={e => setContractorName(e.target.value)} placeholder="Your company / name" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Your Email (reply-to) *</Label>
              <Input value={contractorEmail} onChange={e => setContractorEmail(e.target.value)} placeholder="you@company.com.au" className="h-8 text-sm" type="email" />
            </div>
          </div>

          {/* Supplier selector */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Supplier</Label>

            {relevantSuppliers.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {relevantSuppliers.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSupplierId(s.id)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors",
                      selectedSupplierId === s.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedSupplierId === s.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}{s.phone ? ` · ${s.phone}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {s.trades.slice(0, 2).map(t => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                      ))}
                      {s.trades.length > 2 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{s.trades.length - 2}</Badge>}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDeleteSupplier(s.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!showAddForm ? (
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add New Supplier
              </Button>
            ) : (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Supplier</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs mb-1 block">Name *</Label>
                    <Input value={newSupplier.name} onChange={e => setNewSupplier(p => ({ ...p, name: e.target.value }))} placeholder="ABC Supplies" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Email *</Label>
                    <Input value={newSupplier.email} onChange={e => setNewSupplier(p => ({ ...p, email: e.target.value }))} placeholder="supplier@example.com" className="h-8 text-sm" type="email" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Phone</Label>
                    <Input value={newSupplier.phone} onChange={e => setNewSupplier(p => ({ ...p, phone: e.target.value }))} placeholder="0400 000 000" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">State</Label>
                    <Select value={newSupplier.state} onValueChange={v => setNewSupplier(p => ({ ...p, state: v }))}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="State..." />
                      </SelectTrigger>
                      <SelectContent>
                        {['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Trades (optional — for filtering)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {TRADE_OPTIONS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleToggleTradeOnNew(t)}
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                          newSupplier.trades.includes(t)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNewSupplier}>Save Supplier</Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setNewSupplier(EMPTY_NEW_SUPPLIER); }}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          {/* Optional message */}
          <div>
            <Label className="text-xs mb-1 block">Message (optional)</Label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Any specific requirements, access notes, preferred brands..."
              className="w-full h-20 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || !selectedSupplier}>
              <Mail className="h-4 w-4 mr-1.5" />
              {sending ? 'Sending...' : `Send to ${selectedSupplier?.name ?? 'Supplier'}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
