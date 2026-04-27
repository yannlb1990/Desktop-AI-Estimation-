import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calculator, DollarSign, Plus, Trash2, FileDown, Percent, Clock, ExternalLink, ChevronDown, ChevronRight, Wrench, CheckCircle2, Package, Link2, Unlink } from 'lucide-react';
import { Measurement, CostItem, MeasurementArea, TRADE_OPTIONS, RelatedMaterial, ConsumableItem } from '@/lib/takeoff/types';
import { cn } from '@/lib/utils';
import { SCOPE_OF_WORK_RATES, type AustralianState } from '@/data/scopeOfWorkRates';
import { toast } from 'sonner';

// Area options
const AREA_OPTIONS: MeasurementArea[] = [
  'Kitchen', 'Bathroom', 'Bedroom', 'Living Room', 'Dining Room', 'Laundry',
  'Garage', 'Patio', 'Balcony', 'Hallway', 'Entry', 'Office', 'Storage',
  'Utility', 'Ensuite', 'WC', 'External', 'Other'
];

// Unit options
const UNIT_OPTIONS = ['LM', 'M2', 'M3', 'count'] as const;

// Material options by category
const MATERIAL_OPTIONS: Record<string, string[]> = {
  Framing: ['Steel 64mm', 'Steel 92mm', 'Timber 90mm MGP12', 'Timber 90mm MGP10', 'LVL', 'Custom'],
  Lining: ['Plasterboard 10mm', 'Plasterboard 13mm', 'FC Cement 6mm', 'FC Cement 9mm', 'MDF', 'Ply', 'Custom'],
  Insulation: ['R2.0 Batts', 'R2.5 Batts', 'R3.0 Batts', 'R4.0 Batts', 'Foam', 'Reflective', 'Custom'],
  Flooring: ['Tiles 300x300', 'Tiles 600x600', 'Timber', 'Vinyl', 'Carpet', 'Polished Concrete', 'Epoxy', 'Custom'],
  Painting: ['Dulux Wash & Wear', 'Dulux Weathershield', 'Primer + 2 Coats', 'Custom'],
  Waterproofing: ['Membrane', 'Sealant', 'Tanking', 'Custom'],
  General: ['Custom'],
};

// Suggested related materials by category
const SUGGESTED_MATERIALS: Record<string, { name: string; unit: string; qtyPerM2: number; unitCost: number }[]> = {
  Framing: [
    { name: '10g Wafer Head Screws (box)', unit: 'box', qtyPerM2: 0.04, unitCost: 8.50 },
    { name: 'Paslode Gas + Nails', unit: 'pack', qtyPerM2: 0.02, unitCost: 85.00 },
    { name: 'Framing Brackets', unit: 'EA', qtyPerM2: 0.5, unitCost: 3.50 },
  ],
  Lining: [
    { name: 'PB Screws 25mm (box)', unit: 'box', qtyPerM2: 0.03, unitCost: 7.80 },
    { name: 'Corner Bead 3m', unit: 'EA', qtyPerM2: 0.1, unitCost: 4.50 },
    { name: 'Joint Compound 20kg', unit: 'bucket', qtyPerM2: 0.02, unitCost: 35.00 },
    { name: 'Paper Tape 75m', unit: 'roll', qtyPerM2: 0.01, unitCost: 8.00 },
  ],
  Insulation: [
    { name: 'Insulation Staples (box)', unit: 'box', qtyPerM2: 0.01, unitCost: 12.00 },
    { name: 'Foil Tape 50m', unit: 'roll', qtyPerM2: 0.005, unitCost: 18.00 },
  ],
};

// Default consumables
const DEFAULT_CONSUMABLES: Omit<ConsumableItem, 'id' | 'total'>[] = [
  { name: 'Saw Blades', description: 'Circular saw blades', quantity: 2, unit: 'EA', unitCost: 25.00 },
  { name: 'Sandpaper Pack', description: 'Assorted grits', quantity: 1, unit: 'pack', unitCost: 15.00 },
  { name: 'Masking Tape', description: '48mm x 50m', quantity: 3, unit: 'roll', unitCost: 8.00 },
  { name: 'PPE - Gloves', description: 'Work gloves', quantity: 2, unit: 'pair', unitCost: 12.00 },
  { name: 'PPE - Dust Masks', description: 'P2 masks 10pk', quantity: 1, unit: 'pack', unitCost: 25.00 },
];

interface CostEstimatorProps {
  projectId: string;
  measurements: Measurement[];
  costItems: CostItem[];
  onAddCostItem: (item: CostItem) => void;
  onUpdateCostItem: (id: string, updates: Partial<CostItem>) => void;
  onDeleteCostItem: (id: string) => void;
  onLinkMeasurement: (measurementId: string, costItemId: string) => void;
}

type State = AustralianState;

// Map CostItem category to nearest AU trade
const CATEGORY_TO_TRADE: Record<string, string> = {
  Framing: 'Carpenter', Lining: 'Plasterer', Insulation: 'Carpenter',
  Flooring: 'Tiler', Painting: 'Painter', Waterproofing: 'Tiler',
  Roofing: 'Roofer', Concrete: 'Concreter', Plumbing: 'Plumber',
  Electrical: 'Electrician', Brickwork: 'Bricklayer', Landscaping: 'Landscaper',
  General: 'Carpenter',
};

// Read / write the set of costItem IDs already transferred for this project
const transferredKey = (projectId: string) => `transferred_cost_items_${projectId}`;
const getTransferred = (projectId: string): Set<string> =>
  new Set(JSON.parse(localStorage.getItem(transferredKey(projectId)) || '[]'));
const saveTransferred = (projectId: string, ids: Set<string>) =>
  localStorage.setItem(transferredKey(projectId), JSON.stringify([...ids]));

export const CostEstimator = ({
  projectId,
  measurements,
  costItems,
  onAddCostItem,
  onUpdateCostItem,
  onDeleteCostItem,
  onLinkMeasurement,
}: CostEstimatorProps) => {
  const [selectedState, setSelectedState] = useState<State>('NSW');
  const [marginPercent, setMarginPercent] = useState(15);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSOW, setSelectedSOW] = useState<string>('');
  const [selectedMeasurement, setSelectedMeasurement] = useState<string>('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [consumables, setConsumables] = useState<ConsumableItem[]>(
    DEFAULT_CONSUMABLES.map(c => ({ ...c, id: crypto.randomUUID(), total: c.quantity * c.unitCost }))
  );
  const [transferredIds, setTransferredIds] = useState<Set<string>>(() => getTransferred(projectId));

  // Write a batch of CostItems into the Estimate (local_projects localStorage)
  const transferItems = (items: CostItem[]) => {
    if (items.length === 0) { toast.error('No items to transfer'); return; }

    // Build EstimateItem objects from CostItems
    const projects: any[] = JSON.parse(localStorage.getItem('local_projects') || '[]');
    let projectIndex = projects.findIndex((p: any) => p.id === projectId);
    if (projectIndex === -1) {
      // Auto-create stub entry so user doesn't have to visit Estimate tab first
      projects.push({ id: projectId, estimate_items: [] });
      projectIndex = projects.length - 1;
    }

    const existing: any[] = projects[projectIndex].estimate_items || [];
    const existingCostIds = new Set(existing.map((e: any) => e._costItemId).filter(Boolean));

    const newEstimateItems: any[] = [];
    const newTransferred = new Set(transferredIds);

    items.forEach(item => {
      if (existingCostIds.has(item.id)) return; // already transferred — skip
      const { lineTotal } = calculateLineTotals(item);
      const estimateItem = {
        id: `ci-${item.id}`,
        _costItemId: item.id,          // back-reference for undo/dedup
        section_id: null,
        area: item.area || '',
        trade: CATEGORY_TO_TRADE[item.category] || item.trade || 'Carpenter',
        scope_of_work: item.name || item.category,
        material_type: item.customMaterial || item.material || item.name || '',
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unitCost,
        labour_hours: item.laborHours ?? 0,
        labour_rate: item.hourlyRate ?? 65,
        material_wastage_pct: item.materialWastePercent ?? 5,
        labour_wastage_pct: item.labourWastePercent ?? 10,
        markup_pct: item.markupPercent ?? marginPercent,
        notes: item.description || item.notes || '',
        expanded: false,
        item_number: `${existing.length + newEstimateItems.length + 1}`,
        isEditing: false,
        relatedMaterials: (item.relatedMaterials || []).filter(rm => rm.isAccepted),
        _transferredAt: Date.now(),
      };
      newEstimateItems.push(estimateItem);
      newTransferred.add(item.id);
    });

    if (newEstimateItems.length === 0) {
      toast.info('All selected items already transferred');
      return;
    }

    projects[projectIndex].estimate_items = [...existing, ...newEstimateItems];
    localStorage.setItem('local_projects', JSON.stringify(projects));
    saveTransferred(projectId, newTransferred);
    setTransferredIds(new Set(newTransferred));

    // Notify EstimateTemplate to reload
    window.dispatchEvent(new CustomEvent('estimate-updated', { detail: { projectId } }));

    const transferredItemIds = newEstimateItems.map((e: any) => e.id);
    toast.success(`${newEstimateItems.length} item${newEstimateItems.length > 1 ? 's' : ''} sent to Estimate`, {
      action: {
        label: 'Undo',
        onClick: () => {
          const ps: any[] = JSON.parse(localStorage.getItem('local_projects') || '[]');
          const pi = ps.findIndex((p: any) => p.id === projectId);
          if (pi !== -1) {
            ps[pi].estimate_items = (ps[pi].estimate_items || []).filter(
              (e: any) => !transferredItemIds.includes(e.id)
            );
            localStorage.setItem('local_projects', JSON.stringify(ps));
            // Remove from transferred set so they can be re-transferred
            const undoSet = new Set(newTransferred);
            newEstimateItems.forEach((e: any) => undoSet.delete(e._costItemId));
            saveTransferred(projectId, undoSet);
            setTransferredIds(undoSet);
            window.dispatchEvent(new CustomEvent('estimate-updated', { detail: { projectId } }));
            toast.success('Transfer undone');
          }
        },
      },
    });
  };

  // Toggle expand/collapse
  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedItems(newSet);
  };

  // Generate suggested related materials for an item
  const getSuggestedMaterials = (item: CostItem): RelatedMaterial[] => {
    const suggestions = SUGGESTED_MATERIALS[item.category] || [];
    return suggestions.map(s => ({
      id: crypto.randomUUID(),
      name: s.name,
      quantity: Math.ceil(item.quantity * s.qtyPerM2),
      unit: s.unit,
      unitCost: s.unitCost,
      isAccepted: false,
      isManual: false,
    }));
  };

  // Calculate line totals for an item
  const calculateLineTotals = (item: CostItem) => {
    const matWaste = item.materialWastePercent ?? 5;
    const labWaste = item.labourWastePercent ?? 10;
    const hourlyRate = item.hourlyRate ?? 65;
    const hours = item.laborHours ?? 0;

    const materialTotal = item.quantity * item.unitCost * (1 + matWaste / 100);
    const labourTotal = hours * hourlyRate * (1 + labWaste / 100);
    const lineSubtotal = materialTotal + labourTotal;
    const markup = item.markupPercent ?? 0;
    const lineTotal = lineSubtotal * (1 + markup / 100);

    return { materialTotal, labourTotal, lineSubtotal, lineTotal };
  };

  // Calculate all totals
  const totals = useMemo(() => {
    let materialsCost = 0;
    let labourCost = 0;
    let fixingsCost = 0;

    costItems.forEach(item => {
      const { materialTotal, labourTotal } = calculateLineTotals(item);
      materialsCost += materialTotal;
      labourCost += labourTotal;

      // Calculate fixings from related materials
      if (item.relatedMaterials) {
        fixingsCost += item.relatedMaterials
          .filter(rm => rm.isAccepted)
          .reduce((sum, rm) => sum + rm.quantity * rm.unitCost, 0);
      }
    });

    const consumablesTotal = consumables.reduce((sum, c) => sum + c.total, 0);
    const subtotal = materialsCost + labourCost + fixingsCost + consumablesTotal;
    const margin = subtotal * (marginPercent / 100);
    const subtotalWithMargin = subtotal + margin;
    const gst = gstEnabled ? subtotalWithMargin * 0.10 : 0;
    const grandTotal = subtotalWithMargin + gst;

    return { materialsCost, labourCost, fixingsCost, consumablesTotal, subtotal, margin, gst, grandTotal };
  }, [costItems, consumables, marginPercent, gstEnabled]);

  // Get unlinked measurements
  const unlinkedMeasurements = useMemo(() => {
    const linkedIds = new Set(costItems.flatMap(item => item.linkedMeasurements));
    return measurements.filter(m => !linkedIds.has(m.id));
  }, [measurements, costItems]);

  // Get effective quantity from measurement
  const getEffectiveQuantity = (m: Measurement): number => {
    if (m.measurementType === 'Wall' && m.height && m.unit === 'LM') {
      return m.computedM2 || (m.realValue * m.height);
    }
    if (m.measurementType === 'Floor' && m.isConcreteFloor && m.concreteDepth) {
      return m.computedM3 || (m.realValue * m.concreteDepth);
    }
    return m.realValue;
  };

  // Handle adding from SOW
  const handleAddFromSOW = () => {
    if (!selectedSOW || !selectedMeasurement) {
      toast.error('Please select a SOW rate and measurement');
      return;
    }

    const sowItem = SCOPE_OF_WORK_RATES.find(s => s.id === selectedSOW);
    const measurement = measurements.find(m => m.id === selectedMeasurement);

    if (!sowItem || !measurement) {
      toast.error('Invalid selection');
      return;
    }

    const rate = sowItem[selectedState] || 0;
    const quantity = getEffectiveQuantity(measurement);

    let effectiveUnit = measurement.unit;
    if (measurement.measurementType === 'Wall' && measurement.height && measurement.unit === 'LM') {
      effectiveUnit = 'M2';
    }
    if (measurement.measurementType === 'Floor' && measurement.isConcreteFloor && measurement.concreteDepth) {
      effectiveUnit = 'M3';
    }

    const newItem: CostItem = {
      id: crypto.randomUUID(),
      category: sowItem.category,
      name: sowItem.sow,
      description: sowItem.description,
      unit: effectiveUnit,
      unitCost: rate,
      quantity: quantity,
      linkedMeasurements: [measurement.id],
      wasteFactor: 1.05,
      subtotal: quantity * rate * 1.05,
      area: measurement.area,
      measurementType: measurement.measurementType,
      drawingNumber: measurement.drawingNumber || `Page ${measurement.pageIndex + 1}`,
      laborHours: measurement.labourHours,
      materialWastePercent: 5,
      labourWastePercent: 10,
      hourlyRate: 65,
    };

    onAddCostItem(newItem);
    onLinkMeasurement(measurement.id, newItem.id);

    setSelectedSOW('');
    setSelectedMeasurement('');
    setShowAddDialog(false);
    toast.success('Cost item added');
  };

  // Handle manual cost item with measurement link option
  const handleAddManual = (measurementId?: string) => {
    const measurement = measurementId ? measurements.find(m => m.id === measurementId) : null;
    const quantity = measurement ? getEffectiveQuantity(measurement) : 0;

    const newItem: CostItem = {
      id: crypto.randomUUID(),
      category: 'General',
      name: 'Custom Item',
      description: 'Manually added cost item',
      unit: measurement?.unit || 'M2',
      unitCost: 0,
      quantity: quantity,
      linkedMeasurements: measurementId ? [measurementId] : [],
      wasteFactor: 1.0,
      subtotal: 0,
      area: measurement?.area,
      materialWastePercent: 5,
      labourWastePercent: 10,
      hourlyRate: 65,
    };

    onAddCostItem(newItem);
    if (measurementId) {
      onLinkMeasurement(measurementId, newItem.id);
    }
    toast.success('Manual item added');
  };

  // Update consumable
  const updateConsumable = (id: string, updates: Partial<ConsumableItem>) => {
    setConsumables(prev => prev.map(c => {
      if (c.id === id) {
        const updated = { ...c, ...updates };
        updated.total = updated.quantity * updated.unitCost;
        return updated;
      }
      return c;
    }));
  };

  // Add consumable
  const addConsumable = () => {
    setConsumables(prev => [...prev, {
      id: crypto.randomUUID(),
      name: 'New Item',
      quantity: 1,
      unit: 'EA',
      unitCost: 0,
      total: 0,
    }]);
  };

  // Delete consumable
  const deleteConsumable = (id: string) => {
    setConsumables(prev => prev.filter(c => c.id !== id));
  };

  // Export to CSV
  const exportToCSV = () => {
    let csv = 'Category,Trade,Name,Material,Area,Qty,Unit,Mat $/Unit,Mat Waste %,Hrs,$/Hr,Lab Waste %,Markup %,Material Total,Labour Total,Line Total\n';

    costItems.forEach(item => {
      const { materialTotal, labourTotal, lineTotal } = calculateLineTotals(item);
      csv += `"${item.category}","${item.trade || ''}","${item.name}","${item.material || item.customMaterial || ''}","${item.area || ''}",${item.quantity.toFixed(2)},${item.unit},${item.unitCost.toFixed(2)},${item.materialWastePercent ?? 5},${item.laborHours || 0},${item.hourlyRate ?? 65},${item.labourWastePercent ?? 10},${item.markupPercent ?? 0},${materialTotal.toFixed(2)},${labourTotal.toFixed(2)},${lineTotal.toFixed(2)}\n`;
    });

    csv += `\nCONSUMABLES\n`;
    csv += `Name,Qty,Unit,Unit Cost,Total\n`;
    consumables.forEach(c => {
      csv += `"${c.name}",${c.quantity},${c.unit},${c.unitCost.toFixed(2)},${c.total.toFixed(2)}\n`;
    });

    csv += `\nSUMMARY\n`;
    csv += `Materials,$${totals.materialsCost.toFixed(2)}\n`;
    csv += `Labour,$${totals.labourCost.toFixed(2)}\n`;
    csv += `Fixings,$${totals.fixingsCost.toFixed(2)}\n`;
    csv += `Consumables,$${totals.consumablesTotal.toFixed(2)}\n`;
    csv += `Subtotal,$${totals.subtotal.toFixed(2)}\n`;
    csv += `Margin (${marginPercent}%),$${totals.margin.toFixed(2)}\n`;
    csv += `GST (10%),$${totals.gst.toFixed(2)}\n`;
    csv += `GRAND TOTAL,$${totals.grandTotal.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estimate_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Estimate exported to CSV');
  };

  if (measurements.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">No Measurements Yet</h3>
        <p className="text-muted-foreground text-sm">
          Add measurements from the PDF to start building your cost estimate.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <Label className="text-sm text-muted-foreground">State</Label>
            <Select value={selectedState} onValueChange={(v: State) => setSelectedState(v)}>
              <SelectTrigger className="w-24 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Margin %</Label>
            <Input
              type="number"
              value={marginPercent}
              onChange={(e) => setMarginPercent(Number(e.target.value))}
              className="w-20 h-9"
              min={0}
              max={100}
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">GST</Label>
            <input
              type="checkbox"
              checked={gstEnabled}
              onChange={(e) => setGstEnabled(e.target.checked)}
              className="h-4 w-4"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <FileDown className="h-4 w-4 mr-1" />
            CSV
          </Button>
          {costItems.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-blue-400 text-blue-700 hover:bg-blue-50"
              onClick={() => transferItems(costItems.filter(i => !transferredIds.has(i.id)))}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Send All to Estimate
              {costItems.filter(i => !transferredIds.has(i.id)).length > 0 && (
                <span className="ml-1 bg-blue-100 text-blue-700 text-xs px-1 rounded-full">
                  {costItems.filter(i => !transferredIds.has(i.id)).length}
                </span>
              )}
            </Button>
          )}
          <Button size="sm" onClick={() => setShowAddDialog(!showAddDialog)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Add Dialog */}
      {showAddDialog && (
        <Card className="p-4 space-y-3 bg-muted/50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Link to Measurement</Label>
              <Select value={selectedMeasurement} onValueChange={setSelectedMeasurement}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="none">No Link (Manual)</SelectItem>
                  {unlinkedMeasurements.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label || m.type} - {getEffectiveQuantity(m).toFixed(2)} {m.unit}
                      {m.area && ` (${m.area})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">SOW Rate (Optional)</Label>
              <Select value={selectedSOW} onValueChange={setSelectedSOW}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select rate..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {SCOPE_OF_WORK_RATES.slice(0, 50).map(sow => (
                    <SelectItem key={sow.id} value={sow.id}>
                      {sow.sow} (${sow[selectedState]?.toFixed(2)}/{sow.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button size="sm" onClick={handleAddFromSOW} disabled={!selectedSOW || !selectedMeasurement || selectedMeasurement === 'none'}>
                Add from SOW
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAddManual(selectedMeasurement !== 'none' ? selectedMeasurement : undefined)}>
                Add Manual
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Unlinked Alert */}
      {unlinkedMeasurements.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded">
          <strong>{unlinkedMeasurements.length}</strong> measurements not linked to cost items
        </div>
      )}

      {/* Main Cost Items Table */}
      {costItems.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="text-xs bg-muted/50">
                  <TableHead className="w-8 px-1"></TableHead>
                  <TableHead className="w-20 px-1">Category</TableHead>
                  <TableHead className="w-28 px-1">Trade</TableHead>
                  <TableHead className="w-32 px-1">Item</TableHead>
                  <TableHead className="w-28 px-1">Material</TableHead>
                  <TableHead className="w-24 px-1">Area</TableHead>
                  <TableHead className="w-20 px-1 text-right">Qty</TableHead>
                  <TableHead className="w-16 px-1">Unit</TableHead>
                  <TableHead className="w-20 px-1 text-right">$/Unit</TableHead>
                  <TableHead className="w-16 px-1 text-center">Mat %</TableHead>
                  <TableHead className="w-16 px-1 text-right">Hrs</TableHead>
                  <TableHead className="w-20 px-1 text-right">$/Hr</TableHead>
                  <TableHead className="w-16 px-1 text-center">Lab %</TableHead>
                  <TableHead className="w-16 px-1 text-center">Mkp %</TableHead>
                  <TableHead className="w-24 px-1 text-right">Total</TableHead>
                  <TableHead className="w-16 px-1"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costItems.map(item => {
                  const { materialTotal, labourTotal, lineTotal } = calculateLineTotals(item);
                  const isExpanded = expandedItems.has(item.id);
                  const suggestions = getSuggestedMaterials(item);

                  return (
                    <React.Fragment key={item.id}>
                      <TableRow className="text-xs">
                        {/* Expand */}
                        <TableCell className="px-1 w-8">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleExpand(item.id)}>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>

                        {/* Category */}
                        <TableCell className="px-1 w-20">
                          <Badge variant="outline" className={cn("text-xs px-1.5",
                            item.category === 'Framing' && "border-orange-400 text-orange-600",
                            item.category === 'Lining' && "border-blue-400 text-blue-600",
                            item.category === 'Insulation' && "border-green-400 text-green-600"
                          )}>{item.category.slice(0, 5)}</Badge>
                        </TableCell>

                        {/* Trade */}
                        <TableCell className="px-1 w-28">
                          <Select value={item.trade || ''} onValueChange={(v) => onUpdateCostItem(item.id, { trade: v })}>
                            <SelectTrigger className="h-8 text-xs w-full px-2">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover max-h-48">
                              {TRADE_OPTIONS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Item Name */}
                        <TableCell className="px-1 w-32">
                          <Input
                            value={item.name}
                            onChange={(e) => onUpdateCostItem(item.id, { name: e.target.value })}
                            className="h-8 text-xs border-border px-2 w-full"
                            title={item.name}
                          />
                        </TableCell>

                        {/* Material */}
                        <TableCell className="px-1 w-28">
                          {item.material === 'Custom' || !MATERIAL_OPTIONS[item.category]?.includes(item.material || '') ? (
                            <Input
                              value={item.customMaterial || item.material || ''}
                              onChange={(e) => onUpdateCostItem(item.id, { customMaterial: e.target.value, material: 'Custom' })}
                              className="h-8 text-xs border-border px-2 w-full"
                              placeholder="Custom"
                            />
                          ) : (
                            <Select value={item.material || ''} onValueChange={(v) => onUpdateCostItem(item.id, { material: v })}>
                              <SelectTrigger className="h-8 text-xs px-2">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent className="bg-popover max-h-48">
                                {(MATERIAL_OPTIONS[item.category] || MATERIAL_OPTIONS.General).map(m => (
                                  <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>

                        {/* Area */}
                        <TableCell className="px-1 w-24">
                          <Select value={item.area || ''} onValueChange={(v: MeasurementArea) => onUpdateCostItem(item.id, { area: v })}>
                            <SelectTrigger className="h-8 text-xs px-2">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover max-h-48">
                              {AREA_OPTIONS.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Qty */}
                        <TableCell className="px-1 w-20">
                          <Input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => onUpdateCostItem(item.id, { quantity: Number(e.target.value) })}
                            className="h-8 text-xs text-right font-mono border-border px-2 w-full"
                          />
                        </TableCell>

                        {/* Unit */}
                        <TableCell className="px-1 w-16">
                          <Select value={item.unit} onValueChange={(v: typeof UNIT_OPTIONS[number]) => onUpdateCostItem(item.id, { unit: v })}>
                            <SelectTrigger className="h-8 text-xs w-full px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u} className="text-xs">{u === 'count' ? 'EA' : u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* $/Unit (Material) */}
                        <TableCell className="px-1 w-20">
                          <Input
                            type="number"
                            value={item.unitCost || ''}
                            onChange={(e) => onUpdateCostItem(item.id, { unitCost: Number(e.target.value) })}
                            className="h-8 text-xs text-right font-mono border-border px-2 w-full"
                            placeholder="0"
                          />
                        </TableCell>

                        {/* Material Waste % */}
                        <TableCell className="px-1 w-16">
                          <Input
                            type="number"
                            value={item.materialWastePercent ?? 5}
                            onChange={(e) => onUpdateCostItem(item.id, { materialWastePercent: Number(e.target.value) })}
                            className="h-8 text-xs text-center border-border px-2 w-full"
                          />
                        </TableCell>

                        {/* Hours */}
                        <TableCell className="px-1 w-16">
                          <Input
                            type="number"
                            value={item.laborHours || ''}
                            onChange={(e) => onUpdateCostItem(item.id, { laborHours: Number(e.target.value) })}
                            className="h-8 text-xs text-right border-border px-2 w-full"
                            placeholder="0"
                          />
                        </TableCell>

                        {/* Hourly Rate */}
                        <TableCell className="px-1 w-20">
                          <Input
                            type="number"
                            value={item.hourlyRate ?? 65}
                            onChange={(e) => onUpdateCostItem(item.id, { hourlyRate: Number(e.target.value) })}
                            className="h-8 text-xs text-right font-mono border-border px-2 w-full"
                          />
                        </TableCell>

                        {/* Labour Waste % */}
                        <TableCell className="px-1 w-16">
                          <Input
                            type="number"
                            value={item.labourWastePercent ?? 10}
                            onChange={(e) => onUpdateCostItem(item.id, { labourWastePercent: Number(e.target.value) })}
                            className="h-8 text-xs text-center border-border px-2 w-full"
                          />
                        </TableCell>

                        {/* Markup % */}
                        <TableCell className="px-1 w-16">
                          <Input
                            type="number"
                            value={item.markupPercent ?? 0}
                            onChange={(e) => onUpdateCostItem(item.id, { markupPercent: Number(e.target.value) })}
                            className="h-8 text-xs text-center border-border px-2 w-full"
                          />
                        </TableCell>

                        {/* Line Total */}
                        <TableCell className="px-1 w-24 text-right">
                          <div className="font-mono font-semibold text-sm">${lineTotal.toFixed(0)}</div>
                          <div className="text-xs text-muted-foreground">
                            M:{materialTotal.toFixed(0)} L:{labourTotal.toFixed(0)}
                          </div>
                        </TableCell>

                        {/* Transfer + Delete */}
                        <TableCell className="px-1 w-10">
                          <div className="flex items-center gap-1">
                            {transferredIds.has(item.id) ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="h-7 w-7 flex items-center justify-center text-green-600">
                                      <CheckCircle2 className="h-4 w-4" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-xs">In Estimate</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                                      onClick={() => transferItems([item])}>
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-xs">Send to Estimate</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDeleteCostItem(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={16} className="p-3">
                            <div className="grid grid-cols-2 gap-4">
                              {/* Related Materials / Fixings */}
                              <div>
                                {/* ── Pending suggestions ── */}
                                {(() => {
                                  const acceptedNames = new Set((item.relatedMaterials || []).map(rm => rm.name));
                                  const pending = suggestions.filter(s => !acceptedNames.has(s.name));
                                  const accepted = item.relatedMaterials || [];

                                  const acceptOne = (s: RelatedMaterial) => {
                                    const updated = [...(item.relatedMaterials || []), { ...s, id: crypto.randomUUID(), isAccepted: true }];
                                    onUpdateCostItem(item.id, { relatedMaterials: updated });
                                    toast.success(`Added ${s.name}`);
                                  };

                                  const acceptAll = () => {
                                    const updated = [
                                      ...(item.relatedMaterials || []),
                                      ...pending.map(s => ({ ...s, id: crypto.randomUUID(), isAccepted: true })),
                                    ];
                                    onUpdateCostItem(item.id, { relatedMaterials: updated });
                                    toast.success(`Added ${pending.length} materials`);
                                  };

                                  const removeAccepted = (rmId: string) => {
                                    const updated = (item.relatedMaterials || []).filter(rm => rm.id !== rmId);
                                    onUpdateCostItem(item.id, { relatedMaterials: updated });
                                  };

                                  const updateAccepted = (rmId: string, field: keyof RelatedMaterial, value: any) => {
                                    const updated = (item.relatedMaterials || []).map(rm =>
                                      rm.id === rmId ? { ...rm, [field]: value } : rm
                                    );
                                    onUpdateCostItem(item.id, { relatedMaterials: updated });
                                  };

                                  return (
                                    <>
                                      {/* Header */}
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <Wrench className="h-4 w-4 text-amber-600" />
                                          <span className="text-xs font-semibold">Related Materials</span>
                                          {accepted.length > 0 && (
                                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                              {accepted.length} added
                                            </span>
                                          )}
                                        </div>
                                        {pending.length > 0 && (
                                          <Button size="sm" variant="outline" className="h-6 text-xs border-green-400 text-green-700 hover:bg-green-50"
                                            onClick={acceptAll}>
                                            <CheckCircle2 className="h-3 w-3 mr-1" /> Accept All ({pending.length})
                                          </Button>
                                        )}
                                      </div>

                                      {/* Pending suggestions */}
                                      {pending.length > 0 && (
                                        <div className="space-y-1 mb-2">
                                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Suggestions</p>
                                          {pending.map((s, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-xs bg-amber-50 dark:bg-amber-950/20 rounded p-2 border border-amber-200">
                                              <div>
                                                <span className="font-medium">{s.name}</span>
                                                <span className="text-muted-foreground ml-2">{s.quantity} {s.unit} @ ${s.unitCost.toFixed(2)}</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <span className="font-mono text-amber-700">${(s.quantity * s.unitCost).toFixed(2)}</span>
                                                <Button size="sm" variant="outline" className="h-6 text-xs border-green-400 text-green-700 hover:bg-green-50"
                                                  onClick={() => acceptOne(s)}>
                                                  <Plus className="h-3 w-3 mr-1" /> Accept
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Accepted materials — editable */}
                                      {accepted.length > 0 && (
                                        <div className="space-y-1 mb-2">
                                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Added</p>
                                          {accepted.map(rm => (
                                            <div key={rm.id} className="flex items-center gap-1 text-xs bg-green-50 dark:bg-green-950/20 rounded p-2 border border-green-200">
                                              <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                                              <span className="font-medium flex-1 min-w-0 truncate">{rm.name}</span>
                                              <input
                                                type="number"
                                                min="0"
                                                value={rm.quantity}
                                                onChange={e => updateAccepted(rm.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="w-12 h-5 border rounded px-1 text-xs text-center bg-white"
                                              />
                                              <span className="text-muted-foreground">{rm.unit}</span>
                                              <span className="font-mono text-green-700">${(rm.quantity * rm.unitCost).toFixed(2)}</span>
                                              <button onClick={() => removeAccepted(rm.id)}
                                                className="text-red-400 hover:text-red-600 ml-1">
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          ))}
                                          <div className="text-right text-xs font-mono font-semibold text-green-700 pr-1">
                                            Materials total: ${accepted.reduce((s, rm) => s + rm.quantity * rm.unitCost, 0).toFixed(2)}
                                          </div>
                                        </div>
                                      )}

                                      {/* Add custom material row */}
                                      <Button size="sm" variant="ghost" className="h-8 text-xs w-full border border-dashed"
                                        onClick={() => {
                                          const name = prompt('Material name:');
                                          if (!name?.trim()) return;
                                          const qty = parseFloat(prompt('Quantity:') || '1') || 1;
                                          const cost = parseFloat(prompt('Unit cost ($):') || '0') || 0;
                                          const unit = prompt('Unit (EA, m, box…):') || 'EA';
                                          const custom: RelatedMaterial = { id: crypto.randomUUID(), name: name.trim(), quantity: qty, unit, unitCost: cost, isAccepted: true, isManual: true };
                                          onUpdateCostItem(item.id, { relatedMaterials: [...(item.relatedMaterials || []), custom] });
                                          toast.success(`Added ${name}`);
                                        }}>
                                        <Plus className="h-3 w-3 mr-1" /> Add Custom Material
                                      </Button>
                                    </>
                                  );
                                })()}
                              </div>

                              {/* Additional Info */}
                              <div className="space-y-2">
                                <div>
                                  <Label className="text-sm">Supplier URL</Label>
                                  <Input
                                    value={item.supplierUrl || ''}
                                    onChange={(e) => onUpdateCostItem(item.id, { supplierUrl: e.target.value })}
                                    className="h-9 text-sm"
                                    placeholder="https://..."
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">Description / Notes</Label>
                                  <Input
                                    value={item.description}
                                    onChange={(e) => onUpdateCostItem(item.id, { description: e.target.value })}
                                    className="h-9 text-sm"
                                  />
                                </div>
                                {item.linkedMeasurements.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-green-600">
                                    <Link2 className="h-3 w-3" />
                                    Linked to {item.linkedMeasurements.length} measurement(s)
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Consumables Table */}
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Consumables</span>
          </div>
          <Button size="sm" variant="outline" onClick={addConsumable} className="h-8 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-32">Item</TableHead>
              <TableHead className="w-16 text-right">Qty</TableHead>
              <TableHead className="w-12">Unit</TableHead>
              <TableHead className="w-16 text-right">$/Unit</TableHead>
              <TableHead className="w-20 text-right">Total</TableHead>
              <TableHead className="w-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consumables.map(c => (
              <TableRow key={c.id} className="text-xs">
                <TableCell>
                  <Input value={c.name} onChange={(e) => updateConsumable(c.id, { name: e.target.value })} className="h-8 text-xs" />
                </TableCell>
                <TableCell>
                  <Input type="number" value={c.quantity} onChange={(e) => updateConsumable(c.id, { quantity: Number(e.target.value) })} className="w-16 h-8 text-xs text-right" />
                </TableCell>
                <TableCell>
                  <Input value={c.unit} onChange={(e) => updateConsumable(c.id, { unit: e.target.value })} className="w-14 h-8 text-xs" />
                </TableCell>
                <TableCell>
                  <Input type="number" value={c.unitCost} onChange={(e) => updateConsumable(c.id, { unitCost: Number(e.target.value) })} className="w-16 h-8 text-xs text-right font-mono" />
                </TableCell>
                <TableCell className="text-right font-mono font-medium text-sm">${c.total.toFixed(2)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteConsumable(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Totals Summary */}
      <Card className="p-4">
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-center">
          <div className="p-2 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Materials</div>
            <div className="text-sm font-bold">${totals.materialsCost.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Labour</div>
            <div className="text-sm font-bold">${totals.labourCost.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
            <div className="text-xs text-amber-700">Fixings</div>
            <div className="text-sm font-bold text-amber-800">${totals.fixingsCost.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Consumables</div>
            <div className="text-sm font-bold">${totals.consumablesTotal.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Subtotal</div>
            <div className="text-sm font-bold">${totals.subtotal.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
            <div className="text-xs text-blue-700">Margin ({marginPercent}%)</div>
            <div className="text-sm font-bold text-blue-800">${totals.margin.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-xs text-muted-foreground">GST (10%)</div>
            <div className="text-sm font-bold">${totals.gst.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-primary text-primary-foreground rounded">
            <div className="text-xs opacity-80">TOTAL</div>
            <div className="text-lg font-bold">${totals.grandTotal.toFixed(2)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
