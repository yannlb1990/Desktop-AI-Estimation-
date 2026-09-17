import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Plus, Trash2, Check, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CostItem, TRADE_OPTIONS } from '@/lib/takeoff/types';
import { loadSuppliers, addSupplier, removeSupplier, type SavedSupplier } from '@/lib/suppliers';
import { getUserStorageKey } from '@/lib/localAuth';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

interface SupplierQuoteDialogProps {
  open: boolean;
  onClose: () => void;
  items: CostItem[];
  projectName?: string;
  siteAddress?: string;
}

interface Brand {
  companyName?: string;
  logo?: string;    // base64 data URL
  primary?: string; // hex
  accent?: string;  // hex
  abn?: string;
  acn?: string;
  phone?: string;
  email?: string;
}

const EMPTY_NEW_SUPPLIER = { name: '', email: '', phone: '', state: '', trades: [] as string[] };

function loadBrand(): Brand {
  try { return JSON.parse(localStorage.getItem(getUserStorageKey('quote_brand')) || '{}'); }
  catch { return {}; }
}

function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [26, 17, 10];
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

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
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [brand, setBrand] = useState<Brand>({});

  useEffect(() => {
    if (open) {
      loadSuppliers().then(setSuppliers);
      setProjectNameVal(projectName);
      setSiteAddressVal(siteAddress);
      setSelectedSupplierId('');
      setShowAddForm(false);
      setNewSupplier(EMPTY_NEW_SUPPLIER);
      setMessage('');
      setSelectedItemIds(new Set(items.map(i => i.id)));
      setBrand(loadBrand());
    }
  }, [open, projectName, siteAddress, items]);

  const tradeOptions = useMemo(() => {
    const trades = new Set(items.map(i => i.trade || i.category || 'General').filter(Boolean));
    return Array.from(trades);
  }, [items]);

  const relevantSuppliers = useMemo(() => {
    if (!tradeOptions.length) return suppliers;
    return suppliers.filter(s => s.trades.length === 0 || s.trades.some(t => tradeOptions.includes(t)));
  }, [suppliers, tradeOptions]);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
  const selectedItems = items.filter(i => selectedItemIds.has(i.id));
  const allSelected = selectedItemIds.size === items.length;

  const selectedTrades = useMemo(() => {
    const trades = new Set(selectedItems.map(i => i.trade || i.category || 'General').filter(Boolean));
    return Array.from(trades);
  }, [selectedItems]);

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedItemIds(allSelected ? new Set() : new Set(items.map(i => i.id)));
  };

  const handleToggleTradeOnNew = (trade: string) => {
    setNewSupplier(prev => ({
      ...prev,
      trades: prev.trades.includes(trade) ? prev.trades.filter(t => t !== trade) : [...prev.trades, trade],
    }));
  };

  const handleSaveNewSupplier = async () => {
    if (!newSupplier.name.trim() || !newSupplier.email.trim()) {
      toast.error('Supplier name and email are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newSupplier.email)) {
      toast.error('Enter a valid email address');
      return;
    }
    try {
      const saved = await addSupplier({
        name: newSupplier.name.trim(),
        email: newSupplier.email.trim(),
        phone: newSupplier.phone.trim() || undefined,
        state: newSupplier.state || undefined,
        trades: newSupplier.trades,
      });
      setSuppliers(await loadSuppliers());
      setSelectedSupplierId(saved.id);
      setShowAddForm(false);
      setNewSupplier(EMPTY_NEW_SUPPLIER);
      toast.success(`${saved.name} saved`);
    } catch {
      toast.error('Failed to save supplier');
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    try {
      await removeSupplier(id);
      setSuppliers(await loadSuppliers());
      if (selectedSupplierId === id) setSelectedSupplierId('');
    } catch {
      toast.error('Failed to remove supplier');
    }
  };

  const buildQuoteItems = () =>
    selectedItems.map(item => ({
      trade: item.trade || item.category || 'General',
      description: item.name + (item.description ? ` — ${item.description}` : ''),
      unit: item.unit,
      quantity: item.quantity,
    }));

  const fileBaseName = () =>
    `Quote_${(projectNameVal || 'Project').replace(/\s+/g, '_')}_${selectedSupplier?.name?.replace(/\s+/g, '_') ?? 'Supplier'}`;

  const buildPDFBuffer = (): ArrayBuffer => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const primary = hexToRgb(brand.primary || '#1a110a');
    const accent = hexToRgb(brand.accent || '#d4a045');
    const companyLabel = brand.companyName || contractorName || 'Quote Request';

    // Header bar
    doc.setFillColor(...primary);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setFillColor(...accent);
    doc.rect(0, 30, 210, 2, 'F');

    // Logo in header
    let textX = 14;
    if (brand.logo) {
      try {
        doc.addImage(brand.logo, 'AUTO', 12, 5, 0, 20);
        textX = 50;
      } catch { /* skip logo if it fails */ }
    }

    // Company name in header
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(companyLabel, textX, 20);

    // Company details under header
    doc.setTextColor(80, 60, 40);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let y = 38;
    const contactParts: string[] = [];
    if (brand.abn) contactParts.push(`ABN ${brand.abn}`);
    if (brand.phone) contactParts.push(brand.phone);
    if (brand.email) contactParts.push(brand.email);
    if (contactParts.length > 0) {
      doc.setTextColor(120, 100, 80);
      doc.text(contactParts.join('  ·  '), 14, y);
      y += 7;
    }

    // Project info
    doc.setTextColor(80, 60, 40);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (projectNameVal) { doc.text(`Project: ${projectNameVal}`, 14, y); y += 6; }
    if (siteAddressVal) { doc.text(`Site: ${siteAddressVal}`, 14, y); y += 6; }
    if (selectedSupplier) { doc.text(`To: ${selectedSupplier.name} <${selectedSupplier.email}>`, 14, y); y += 6; }

    doc.setTextColor(120, 100, 80);
    doc.text('Please fill in your price (excl. GST) for each item and return this document.', 14, y + 2);

    autoTable(doc, {
      startY: y + 10,
      head: [['Trade', 'Description', 'Qty', 'Unit', 'Your Price (excl GST)']],
      body: buildQuoteItems().map(i => [i.trade, i.description, i.quantity.toFixed(2), i.unit, '']),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [252, 250, 246] },
      columnStyles: { 2: { halign: 'right' }, 4: { cellWidth: 40 } },
    });

    return doc.output('arraybuffer');
  };

  const buildExcelBuffer = async (): Promise<ArrayBuffer> => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Quote Request');
    const primaryHex = (brand.primary || '#1a110a').replace('#', 'FF').toUpperCase().padStart(8, 'F');
    const accentHex = (brand.accent || '#d4a045').replace('#', 'FF').toUpperCase().padStart(8, 'F');

    ws.columns = [
      { key: 'trade', width: 20 },
      { key: 'description', width: 40 },
      { key: 'qty', width: 12 },
      { key: 'unit', width: 10 },
      { key: 'price', width: 28 },
    ];

    const headerStyle = { font: { bold: true, color: { argb: 'FF8a7060' } } };
    const company = brand.companyName || contractorName;
    if (company) { const r = ws.addRow(['From:', company]); r.getCell(1).style = headerStyle; }
    if (brand.abn) { const r = ws.addRow(['ABN:', brand.abn]); r.getCell(1).style = headerStyle; }
    if (brand.phone) { const r = ws.addRow(['Phone:', brand.phone]); r.getCell(1).style = headerStyle; }
    if (projectNameVal) { const r = ws.addRow(['Project:', projectNameVal]); r.getCell(1).style = headerStyle; }
    if (siteAddressVal) { const r = ws.addRow(['Site:', siteAddressVal]); r.getCell(1).style = headerStyle; }
    if (selectedSupplier) { const r = ws.addRow(['To:', `${selectedSupplier.name} <${selectedSupplier.email}>`]); r.getCell(1).style = headerStyle; }
    ws.addRow(['Instructions:', 'Fill in your price (excl. GST) for each item and return this file.']).getCell(1).style = headerStyle;
    ws.addRow([]);

    const colRow = ws.addRow(['Trade', 'Description', 'Qty', 'Unit', 'Your Price (excl GST)']);
    colRow.eachCell(cell => {
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryHex } },
        alignment: { vertical: 'middle' },
        border: { bottom: { style: 'thin', color: { argb: accentHex } } },
      };
    });
    colRow.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    buildQuoteItems().forEach(item => {
      const r = ws.addRow([item.trade, item.description, Number(item.quantity.toFixed(2)), item.unit, '']);
      r.getCell(3).alignment = { horizontal: 'right' };
      r.getCell(5).border = { bottom: { style: 'hair', color: { argb: accentHex } } };
    });

    return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
  };

  const handleSend = async () => {
    if (!selectedSupplier) { toast.error('Select a supplier'); return; }
    if (!contractorEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contractorEmail)) {
      toast.error('Enter a valid reply-to email address');
      return;
    }
    if (selectedItems.length === 0) { toast.error('Select at least one item'); return; }

    setSending(true);
    try {
      const [pdfBuffer, xlsxBuffer] = await Promise.all([
        Promise.resolve(buildPDFBuffer()),
        buildExcelBuffer(),
      ]);

      const base = fileBaseName();
      const attachments = [
        { filename: `${base}.pdf`, content: bufferToBase64(pdfBuffer) },
        { filename: `${base}.xlsx`, content: bufferToBase64(xlsxBuffer) },
      ];

      const { data: sendData, error } = await supabase.functions.invoke('send-supplier-quote-request', {
        body: {
          supplierEmail: selectedSupplier.email,
          supplierName: selectedSupplier.name,
          projectName: projectNameVal,
          siteAddress: siteAddressVal,
          trades: selectedTrades,
          contractorName: contractorName || brand.companyName || 'Estimator',
          contractorEmail,
          message: message || undefined,
          brand: {
            companyName: brand.companyName,
            logo: brand.logo,
            primary: brand.primary,
            accent: brand.accent,
            abn: brand.abn,
            phone: brand.phone,
          },
          attachments,
        },
      });
      if (error) throw new Error(error.message);

      // Persist to Supabase — fire-and-forget (don't block the success UX)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        supabase.from('supplier_quote_requests').insert({
          user_id: user.id,
          status: 'sent',
          items: buildQuoteItems() as unknown as import('@/integrations/supabase/types').Json,
          delivery_address: siteAddressVal || null,
          project_name: projectNameVal || null,
          site_address: siteAddressVal || null,
          trades: selectedTrades,
          supplier_name: selectedSupplier.name,
          supplier_email: selectedSupplier.email,
          contractor_name: contractorName || brand.companyName || null,
          contractor_email: contractorEmail,
          message: message || null,
          resend_id: (sendData as { id?: string } | null)?.id ?? null,
          sent_at: new Date().toISOString(),
        }).then(({ error: dbErr }) => {
          if (dbErr) console.error('Quote request save failed:', dbErr.message);
        });
      }

      toast.success(`Quote request sent to ${selectedSupplier.name}`);
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send quote request');
    } finally {
      setSending(false);
    }
  };

  const handleExportPDF = () => {
    if (selectedItems.length === 0) { toast.error('Select at least one item'); return; }
    const buffer = buildPDFBuffer();
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileBaseName()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('PDF downloaded');
  };

  const handleExportExcel = async () => {
    if (selectedItems.length === 0) { toast.error('Select at least one item'); return; }
    const buffer = await buildExcelBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileBaseName()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Excel downloaded');
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
          {/* Items with selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">
                Items ({selectedItemIds.size} of {items.length} selected)
              </Label>
              <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 w-8">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </th>
                    <th className="text-left px-2 py-2 font-medium">Trade</th>
                    <th className="text-left px-2 py-2 font-medium">Item</th>
                    <th className="text-right px-2 py-2 font-medium">Qty</th>
                    <th className="text-left px-2 py-2 font-medium">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr
                      key={item.id}
                      className={cn(
                        'border-t border-border/40 cursor-pointer transition-colors',
                        selectedItemIds.has(item.id) ? 'bg-primary/5' : 'hover:bg-muted/30'
                      )}
                      onClick={() => toggleItem(item.id)}
                    >
                      <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selectedItemIds.has(item.id)} onCheckedChange={() => toggleItem(item.id)} />
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{item.trade || item.category || '—'}</td>
                      <td className="px-2 py-1.5">{item.name}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{item.quantity.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedTrades.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">Scope: {selectedTrades.join(', ')}</p>
            )}
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
              <Input value={contractorName} onChange={e => setContractorName(e.target.value)} placeholder={brand.companyName || 'Your company / name'} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Your Email (reply-to) *</Label>
              <Input value={contractorEmail} onChange={e => setContractorEmail(e.target.value)} placeholder="you@company.com.au" className="h-8 text-sm" type="email" />
            </div>
          </div>

          {/* Brand preview strip */}
          {(brand.companyName || brand.logo || brand.primary) && (
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-muted/20">
              {brand.logo && (
                <img src={brand.logo} alt="Logo" className="h-8 object-contain shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{brand.companyName || 'Your company'}</p>
                <p className="text-[10px] text-muted-foreground">Documents will use your brand from Settings</p>
              </div>
              <div className="flex gap-1 shrink-0 ml-auto">
                {brand.primary && <span className="w-4 h-4 rounded-full border border-border/40" style={{ background: brand.primary }} />}
                {brand.accent && <span className="w-4 h-4 rounded-full border border-border/40" style={{ background: brand.accent }} />}
              </div>
            </div>
          )}

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
                      'flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors',
                      selectedSupplierId === s.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
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
                <Plus className="h-3.5 w-3.5 mr-1" /> Add New Supplier
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
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="State..." /></SelectTrigger>
                      <SelectContent>
                        {['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Trades (optional)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {TRADE_OPTIONS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleToggleTradeOnNew(t)}
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                          newSupplier.trades.includes(t)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50'
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

          {selectedItems.length > 0 && (
            <p className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
              The email will include a branded PDF and Excel quote form for the supplier to fill in and return.
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={selectedItems.length === 0}>
                <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={selectedItems.length === 0}>
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Excel
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
              <Button onClick={handleSend} disabled={sending || !selectedSupplier || selectedItems.length === 0}>
                <Mail className="h-4 w-4 mr-1.5" />
                {sending ? 'Sending...' : `Send to ${selectedSupplier?.name ?? 'Supplier'}`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
