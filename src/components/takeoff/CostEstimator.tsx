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
  measurements: Measurement[];
  costItems: CostItem[];
  onAddCostItem: (item: CostItem) => void;
  onUpdateCostItem: (id: string, updates: Partial<CostItem>) => void;
  onDeleteCostItem: (id: string) => void;
  onLinkMeasurement: (measurementId: string, costItemId: string) => void;
}

type State = AustralianState;

export const CostEstimator = ({
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
            <Label className="text-[10px] text-muted-foreground">State</Label>
            <Select value={selectedState} onValueChange={(v: State) => setSelectedState(v)}>
              <SelectTrigger className="w-20 h-8">
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
            <Label className="text-[10px] text-muted-foreground">Margin %</Label>
            <Input
              type="number"
              value={marginPercent}
              onChange={(e) => setMarginPercent(Number(e.target.value))}
              className="w-16 h-8"
              min={0}
              max={100}
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground">GST</Label>
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
                <TableRow className="text-[9px] bg-muted/50">
                  <TableHead className="w-5 px-0.5"></TableHead>
                  <TableHead className="w-14 px-0.5">Cat</TableHead>
                  <TableHead className="w-16 px-0.5">Trade</TableHead>
                  <TableHead className="w-24 px-0.5">Item</TableHead>
                  <TableHead className="w-20 px-0.5">Material</TableHead>
                  <TableHead className="w-14 px-0.5">Area</TableHead>
                  <TableHead className="w-14 px-0.5 text-right">Qty</TableHead>
                  <TableHead className="w-12 px-0.5">Unit</TableHead>
                  <TableHead className="w-16 px-0.5 text-right">$/Unit</TableHead>
                  <TableHead className="w-12 px-0.5 text-center">M%</TableHead>
                  <TableHead className="w-12 px-0.5 text-right">Hrs</TableHead>
                  <TableHead className="w-14 px-0.5 text-right">$/Hr</TableHead>
                  <TableHead className="w-12 px-0.5 text-center">L%</TableHead>
                  <TableHead className="w-12 px-0.5 text-center">+%</TableHead>
                  <TableHead className="w-20 px-0.5 text-right">Total</TableHead>
                  <TableHead className="w-5 px-0.5"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costItems.map(item => {
                  const { materialTotal, labourTotal, lineTotal } = calculateLineTotals(item);
                  const isExpanded = expandedItems.has(item.id);
                  const suggestions = getSuggestedMaterials(item);

                  return (
                    <React.Fragment key={item.id}>
                      <TableRow className="text-[10px]">
                        {/* Expand */}
                        <TableCell className="px-0.5 w-5">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => toggleExpand(item.id)}>
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </Button>
                        </TableCell>

                        {/* Category */}
                        <TableCell className="px-0.5 w-14">
                          <Badge variant="outline" className={cn("text-[7px] px-1",
                            item.category === 'Framing' && "border-orange-400 text-orange-600",
                            item.category === 'Lining' && "border-blue-400 text-blue-600",
                            item.category === 'Insulation' && "border-green-400 text-green-600"
                          )}>{item.category.slice(0, 5)}</Badge>
                        </TableCell>

                        {/* Trade */}
                        <TableCell className="px-0.5 w-16">
                          <Select value={item.trade || ''} onValueChange={(v) => onUpdateCostItem(item.id, { trade: v })}>
                            <SelectTrigger className="h-6 text-[8px] w-full px-1">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover max-h-48">
                              {TRADE_OPTIONS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Item Name */}
                        <TableCell className="px-0.5 w-24">
                          <Input
                            value={item.name}
                            onChange={(e) => onUpdateCostItem(item.id, { name: e.target.value })}
                            className="h-6 text-[8px] border-border px-1 w-full"
                            title={item.name}
                          />
                        </TableCell>

                        {/* Material */}
                        <TableCell className="px-0.5 w-20">
                          {item.material === 'Custom' || !MATERIAL_OPTIONS[item.category]?.includes(item.material || '') ? (
                            <Input
                              value={item.customMaterial || item.material || ''}
                              onChange={(e) => onUpdateCostItem(item.id, { customMaterial: e.target.value, material: 'Custom' })}
                              className="h-6 text-[8px] border-border px-1 w-full"
                              placeholder="Custom"
                            />
                          ) : (
                            <Select value={item.material || ''} onValueChange={(v) => onUpdateCostItem(item.id, { material: v })}>
                              <SelectTrigger className="h-6 text-[8px] px-1">
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
                        <TableCell className="px-0.5 w-14">
                          <Select value={item.area || ''} onValueChange={(v: MeasurementArea) => onUpdateCostItem(item.id, { area: v })}>
                            <SelectTrigger className="h-6 text-[7px] px-1">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover max-h-48">
                              {AREA_OPTIONS.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Qty */}
                        <TableCell className="px-0.5 w-14">
                          <Input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => onUpdateCostItem(item.id, { quantity: Number(e.target.value) })}
                            className="h-6 text-[9px] text-right font-mono border-border px-1 w-full"
                          />
                        </TableCell>

                        {/* Unit */}
                        <TableCell className="px-0.5 w-12">
                          <Select value={item.unit} onValueChange={(v: typeof UNIT_OPTIONS[number]) => onUpdateCostItem(item.id, { unit: v })}>
                            <SelectTrigger className="h-6 text-[8px] w-full px-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u} className="text-xs">{u === 'count' ? 'EA' : u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* $/Unit (Material) */}
                        <TableCell className="px-0.5 w-16">
                          <Input
                            type="number"
                            value={item.unitCost || ''}
                            onChange={(e) => onUpdateCostItem(item.id, { unitCost: Number(e.target.value) })}
                            className="h-6 text-[9px] text-right font-mono border-border px-1 w-full"
                            placeholder="0"
                          />
                        </TableCell>

                        {/* Material Waste % */}
                        <TableCell className="px-0.5 w-12">
                          <Input
                            type="number"
                            value={item.materialWastePercent ?? 5}
                            onChange={(e) => onUpdateCostItem(item.id, { materialWastePercent: Number(e.target.value) })}
                            className="h-6 text-[9px] text-center border-border px-1 w-full"
                          />
                        </TableCell>

                        {/* Hours */}
                        <TableCell className="px-0.5 w-12">
                          <Input
                            type="number"
                            value={item.laborHours || ''}
                            onChange={(e) => onUpdateCostItem(item.id, { laborHours: Number(e.target.value) })}
                            className="h-6 text-[9px] text-right border-border px-1 w-full"
                            placeholder="0"
                          />
                        </TableCell>

                        {/* Hourly Rate */}
                        <TableCell className="px-0.5 w-14">
                          <Input
                            type="number"
                            value={item.hourlyRate ?? 65}
                            onChange={(e) => onUpdateCostItem(item.id, { hourlyRate: Number(e.target.value) })}
                            className="h-6 text-[9px] text-right font-mono border-border px-1 w-full"
                          />
                        </TableCell>

                        {/* Labour Waste % */}
                        <TableCell className="px-0.5 w-12">
                          <Input
                            type="number"
                            value={item.labourWastePercent ?? 10}
                            onChange={(e) => onUpdateCostItem(item.id, { labourWastePercent: Number(e.target.value) })}
                            className="h-6 text-[9px] text-center border-border px-1 w-full"
                          />
                        </TableCell>

                        {/* Markup % */}
                        <TableCell className="px-0.5 w-12">
                          <Input
                            type="number"
                            value={item.markupPercent ?? 0}
                            onChange={(e) => onUpdateCostItem(item.id, { markupPercent: Number(e.target.value) })}
                            className="h-6 text-[9px] text-center border-border px-1 w-full"
                          />
                        </TableCell>

                        {/* Line Total */}
                        <TableCell className="px-0.5 w-20 text-right">
                          <div className="font-mono font-semibold text-[10px]">${lineTotal.toFixed(0)}</div>
                          <div className="text-[7px] text-muted-foreground">
                            M:{materialTotal.toFixed(0)} L:{labourTotal.toFixed(0)}
                          </div>
                        </TableCell>

                        {/* Delete */}
                        <TableCell className="px-0.5 w-5">
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => onDeleteCostItem(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={16} className="p-3">
                            <div className="grid grid-cols-2 gap-4">
                              {/* Related Materials / Fixings */}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <Wrench className="h-4 w-4 text-amber-600" />
                                  <span className="text-xs font-semibold">Related Materials (Suggestions)</span>
                                </div>
                                <div className="space-y-1">
                                  {suggestions.map((s, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-[10px] bg-white dark:bg-background rounded p-2 border">
                                      <div>
                                        <span className="font-medium">{s.name}</span>
                                        <span className="text-muted-foreground ml-2">{s.quantity} {s.unit} @ ${s.unitCost.toFixed(2)}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono">${(s.quantity * s.unitCost).toFixed(2)}</span>
                                        <Button size="sm" variant="outline" className="h-5 text-[9px]">
                                          <Plus className="h-3 w-3 mr-1" /> Accept
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                  <Button size="sm" variant="ghost" className="h-6 text-[10px] w-full">
                                    <Plus className="h-3 w-3 mr-1" /> Add Custom Material
                                  </Button>
                                </div>
                              </div>

                              {/* Additional Info */}
                              <div className="space-y-2">
                                <div>
                                  <Label className="text-[10px]">Supplier URL</Label>
                                  <Input
                                    value={item.supplierUrl || ''}
                                    onChange={(e) => onUpdateCostItem(item.id, { supplierUrl: e.target.value })}
                                    className="h-7 text-[10px]"
                                    placeholder="https://..."
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">Description / Notes</Label>
                                  <Input
                                    value={item.description}
                                    onChange={(e) => onUpdateCostItem(item.id, { description: e.target.value })}
                                    className="h-7 text-[10px]"
                                  />
                                </div>
                                {item.linkedMeasurements.length > 0 && (
                                  <div className="flex items-center gap-1 text-[10px] text-green-600">
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
          <Button size="sm" variant="outline" onClick={addConsumable} className="h-6 text-[10px]">
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="text-[9px]">
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
              <TableRow key={c.id} className="text-[10px]">
                <TableCell>
                  <Input value={c.name} onChange={(e) => updateConsumable(c.id, { name: e.target.value })} className="h-6 text-[10px]" />
                </TableCell>
                <TableCell>
                  <Input type="number" value={c.quantity} onChange={(e) => updateConsumable(c.id, { quantity: Number(e.target.value) })} className="w-14 h-6 text-[10px] text-right" />
                </TableCell>
                <TableCell>
                  <Input value={c.unit} onChange={(e) => updateConsumable(c.id, { unit: e.target.value })} className="w-10 h-6 text-[10px]" />
                </TableCell>
                <TableCell>
                  <Input type="number" value={c.unitCost} onChange={(e) => updateConsumable(c.id, { unitCost: Number(e.target.value) })} className="w-14 h-6 text-[10px] text-right font-mono" />
                </TableCell>
                <TableCell className="text-right font-mono font-medium">${c.total.toFixed(2)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteConsumable(c.id)}>
                    <Trash2 className="h-3 w-3" />
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
            <div className="text-[9px] text-muted-foreground">Materials</div>
            <div className="text-sm font-bold">${totals.materialsCost.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-[9px] text-muted-foreground">Labour</div>
            <div className="text-sm font-bold">${totals.labourCost.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
            <div className="text-[9px] text-amber-700">Fixings</div>
            <div className="text-sm font-bold text-amber-800">${totals.fixingsCost.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-[9px] text-muted-foreground">Consumables</div>
            <div className="text-sm font-bold">${totals.consumablesTotal.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-[9px] text-muted-foreground">Subtotal</div>
            <div className="text-sm font-bold">${totals.subtotal.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
            <div className="text-[9px] text-blue-700">Margin ({marginPercent}%)</div>
            <div className="text-sm font-bold text-blue-800">${totals.margin.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-[9px] text-muted-foreground">GST (10%)</div>
            <div className="text-sm font-bold">${totals.gst.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-primary text-primary-foreground rounded">
            <div className="text-[9px] opacity-80">TOTAL</div>
            <div className="text-lg font-bold">${totals.grandTotal.toFixed(2)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
