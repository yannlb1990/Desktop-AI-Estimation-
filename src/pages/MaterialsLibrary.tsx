import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Search, Upload, Download, Pencil, Trash2,
  Package, Clock, Globe, MapPin, Filter,
} from 'lucide-react';
import { useMaterialsLibrary } from '@/hooks/useMaterialsLibrary';
import { MaterialEntry, SUPPLIER_TYPES } from '@/lib/materials/types';
import { TRADE_OPTIONS } from '@/lib/takeoff/types';
import { TAKEOFF_UNITS } from '@/lib/takeoff/units';

const EMPTY_FORM: Omit<MaterialEntry, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  trade: 'General',
  unit: 'M2',
  unitCost: 0,
  supplierName: '',
  supplierType: 'local',
  leadTimeWeeks: null,
  productCode: '',
  notes: '',
};

export default function MaterialsLibrary() {
  const navigate = useNavigate();
  const { materials, addMaterial, updateMaterial, deleteMaterial, importFromCSV, exportToCSV } = useMaterialsLibrary();

  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = materials.filter(m => {
    const matchSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      m.productCode.toLowerCase().includes(search.toLowerCase());
    const matchTrade = tradeFilter === 'all' || m.trade === tradeFilter;
    const matchType = typeFilter === 'all' || m.supplierType === typeFilter;
    return matchSearch && matchTrade && matchType;
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (m: MaterialEntry) => {
    setEditingId(m.id);
    setForm({
      name: m.name, trade: m.trade, unit: m.unit, unitCost: m.unitCost,
      supplierName: m.supplierName, supplierType: m.supplierType,
      leadTimeWeeks: m.leadTimeWeeks, productCode: m.productCode, notes: m.notes,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (editingId) {
      updateMaterial(editingId, form);
      toast.success('Material updated');
    } else {
      addMaterial(form);
      toast.success('Material added to library');
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMaterial(deleteId);
    setDeleteId(null);
    toast.success('Material removed');
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csv = ev.target?.result as string;
      const count = importFromCSV(csv);
      if (count > 0) {
        toast.success(`Imported ${count} materials`);
      } else {
        toast.error('No valid rows found — check CSV format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const usedTrades = Array.from(new Set(materials.map(m => m.trade))).sort();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Dashboard
            </Button>
            <div className="w-px h-5 bg-border" />
            <Package className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-bold">Materials Library</h1>
            <Badge variant="secondary">{materials.length} items</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV} disabled={materials.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Material
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6 space-y-4">
        {/* Info banner */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <p className="text-sm text-muted-foreground">
            Build your personal catalogue of materials with your own supplier pricing.
            Materials saved here can be pulled directly into any project estimate — saving you from re-entering prices every time.
            <span className="ml-1 font-medium text-foreground">Overseas items show lead time warnings in estimates.</span>
          </p>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, supplier, product code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={tradeFilter} onValueChange={setTradeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All trades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All trades</SelectItem>
                {usedTrades.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                <SelectItem value="local">Local only</SelectItem>
                <SelectItem value="overseas">Overseas only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(search || tradeFilter !== 'all' || typeFilter !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTradeFilter('all'); setTypeFilter('all'); }}>
              Clear filters
            </Button>
          )}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-lg mb-1">
              {materials.length === 0 ? 'No materials yet' : 'No results'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {materials.length === 0
                ? 'Add your first material or import a CSV price list from your supplier.'
                : 'Try adjusting your search or filters.'}
            </p>
            {materials.length === 0 && (
              <div className="flex justify-center gap-2">
                <Button onClick={openAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Material
                </Button>
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Lead Time</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{m.name}</p>
                        {m.notes && <p className="text-xs text-muted-foreground truncate max-w-48">{m.notes}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{m.trade}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{m.unit}</TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      ${m.unitCost.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {m.supplierName ? (
                        <div className="flex items-center gap-1.5">
                          {m.supplierType === 'overseas'
                            ? <Globe className="h-3 w-3 text-amber-500" />
                            : <MapPin className="h-3 w-3 text-green-500" />}
                          <span className="text-sm">{m.supplierName}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.leadTimeWeeks ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-amber-500" />
                          <span className={`text-sm font-medium ${m.leadTimeWeeks >= 8 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {m.leadTimeWeeks} wks
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.productCode || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(m.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* CSV format hint */}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">CSV import format</summary>
          <pre className="mt-2 p-3 bg-muted rounded text-xs font-mono overflow-x-auto">
{`Name,Trade,Unit,Unit Cost,Supplier,Type,Lead Time,Product Code,Notes
600x600 Porcelain Tile,Tiling,M2,85.00,Tile Republic,local,,TR-600-GRY,Grey matte
Italian Marble,Tiling,M2,320.00,Marmi Italia,overseas,14,MI-CAR-01,Carrara marble
Waterproofing Membrane,Waterproofing,M2,28.50,Sika,local,,SIKA-WP-01,`}
          </pre>
        </details>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Material' : 'Add Material to Library'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Material Name *</Label>
              <Input
                placeholder="e.g. 600×600 Porcelain Tile (Grey)"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Trade</Label>
                <Select value={form.trade} onValueChange={v => setForm(f => ({ ...f, trade: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {TRADE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {TAKEOFF_UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Unit Cost (AUD)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={form.unitCost || ''}
                onChange={e => setForm(f => ({ ...f, unitCost: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Supplier Name</Label>
                <Input
                  placeholder="e.g. Tile Republic"
                  value={form.supplierName}
                  onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Supplier Type</Label>
                <Select value={form.supplierType} onValueChange={v => setForm(f => ({ ...f, supplierType: v as 'local' | 'overseas' }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.supplierType === 'overseas' && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  Lead Time (weeks)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={52}
                  placeholder="e.g. 14"
                  value={form.leadTimeWeeks ?? ''}
                  onChange={e => setForm(f => ({ ...f, leadTimeWeeks: parseInt(e.target.value) || null }))}
                />
                {form.leadTimeWeeks && form.leadTimeWeeks >= 8 && (
                  <p className="text-xs text-amber-600">
                    Long lead time — order well before scheduled install date.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Product Code / SKU</Label>
              <Input
                placeholder="e.g. TR-600-GRY"
                value={form.productCode}
                onChange={e => setForm(f => ({ ...f, productCode: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Finish, colour, spec, where to use..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? 'Save Changes' : 'Add to Library'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove material?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from your library. Existing cost items in projects are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
