import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Calculator, DollarSign, Plus, Trash2, FileDown, Percent } from 'lucide-react';
import { Measurement, CostItem } from '@/lib/takeoff/types';
import { SCOPE_OF_WORK_RATES, type AustralianState } from '@/data/scopeOfWorkRates';
import { MARKET_LABOUR_RATES } from '@/data/marketLabourRates';
import { toast } from 'sonner';

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
  const [markupPercent, setMarkupPercent] = useState(15);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSOW, setSelectedSOW] = useState<string>('');
  const [selectedMeasurement, setSelectedMeasurement] = useState<string>('');

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = costItems.reduce((sum, item) => sum + item.subtotal, 0);
    const markup = subtotal * (markupPercent / 100);
    const total = subtotal + markup;

    const materialsCost = costItems
      .filter(item => item.category === 'Materials')
      .reduce((sum, item) => sum + item.subtotal, 0);

    const labourCost = costItems
      .filter(item => item.category === 'Labour')
      .reduce((sum, item) => sum + item.subtotal, 0);

    return { subtotal, markup, total, materialsCost, labourCost };
  }, [costItems, markupPercent]);

  // Get unlinked measurements
  const unlinkedMeasurements = useMemo(() => {
    const linkedIds = new Set(costItems.flatMap(item => item.linkedMeasurements));
    return measurements.filter(m => !linkedIds.has(m.id));
  }, [measurements, costItems]);

  // Handle adding a new cost item from SOW
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
    const quantity = measurement.realValue;
    const wasteFactor = 1.05; // 5% waste
    const subtotal = quantity * wasteFactor * rate;

    const newItem: CostItem = {
      id: crypto.randomUUID(),
      category: sowItem.category,
      name: sowItem.sow,
      description: sowItem.description,
      unit: measurement.unit,
      unitCost: rate,
      quantity: quantity,
      linkedMeasurements: [measurement.id],
      wasteFactor,
      subtotal,
    };

    onAddCostItem(newItem);
    onLinkMeasurement(measurement.id, newItem.id);

    setSelectedSOW('');
    setSelectedMeasurement('');
    setShowAddDialog(false);
    toast.success('Cost item added');
  };

  // Handle manual cost item
  const handleAddManual = () => {
    const newItem: CostItem = {
      id: crypto.randomUUID(),
      category: 'Other',
      name: 'Custom Item',
      description: 'Manually added cost item',
      unit: 'LM',
      unitCost: 0,
      quantity: 0,
      linkedMeasurements: [],
      wasteFactor: 1.0,
      subtotal: 0,
    };
    onAddCostItem(newItem);
  };

  // Export to CSV
  const exportToCSV = () => {
    let csv = 'Category,Name,Description,Unit,Quantity,Unit Cost,Waste Factor,Subtotal\n';

    costItems.forEach(item => {
      csv += `"${item.category}","${item.name}","${item.description}",${item.unit},${item.quantity.toFixed(2)},${item.unitCost.toFixed(2)},${item.wasteFactor.toFixed(2)},${item.subtotal.toFixed(2)}\n`;
    });

    csv += `\n,,,,,,,\n`;
    csv += `Subtotal,,,,,,,$${totals.subtotal.toFixed(2)}\n`;
    csv += `Markup (${markupPercent}%),,,,,,,$${totals.markup.toFixed(2)}\n`;
    csv += `TOTAL,,,,,,,$${totals.total.toFixed(2)}\n`;

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
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">State Pricing</Label>
            <Select value={selectedState} onValueChange={(v: State) => setSelectedState(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NSW">NSW</SelectItem>
                <SelectItem value="VIC">VIC</SelectItem>
                <SelectItem value="QLD">QLD</SelectItem>
                <SelectItem value="SA">SA</SelectItem>
                <SelectItem value="WA">WA</SelectItem>
                <SelectItem value="TAS">TAS</SelectItem>
                <SelectItem value="NT">NT</SelectItem>
                <SelectItem value="ACT">ACT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Markup %</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(Number(e.target.value))}
                className="w-20"
                min={0}
                max={100}
              />
              <Percent className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <FileDown className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(!showAddDialog)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Cost Item
          </Button>
        </div>
      </div>

      {/* Add from SOW Panel */}
      {showAddDialog && (
        <Card className="p-4 space-y-4 bg-muted/50">
          <h4 className="font-medium">Add Cost Item from SOW Rate</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Select Measurement</Label>
              <Select value={selectedMeasurement} onValueChange={setSelectedMeasurement}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose measurement..." />
                </SelectTrigger>
                <SelectContent>
                  {unlinkedMeasurements.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label || m.type} - {m.realValue.toFixed(2)} {m.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Select SOW Rate</Label>
              <Select value={selectedSOW} onValueChange={setSelectedSOW}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose rate..." />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OF_WORK_RATES.slice(0, 50).map(sow => (
                    <SelectItem key={sow.id} value={sow.id}>
                      {sow.trade} - {sow.sow} (${sow[selectedState]?.toFixed(2)}/{sow.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleAddFromSOW}>Add to Estimate</Button>
              <Button variant="outline" onClick={handleAddManual}>Add Manual</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Unlinked Measurements Alert */}
      {unlinkedMeasurements.length > 0 && (
        <Card className="p-3 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>{unlinkedMeasurements.length} measurements</strong> not linked to cost items.
            Click "Add Cost Item" to include them in your estimate.
          </p>
        </Card>
      )}

      {/* Cost Items Table */}
      {costItems.length > 0 ? (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costItems.map(item => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="outline">{item.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        onUpdateCostItem(item.id, {
                          quantity: qty,
                          subtotal: qty * item.wasteFactor * item.unitCost
                        });
                      }}
                      className="w-20 text-right"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
                  <TableCell className="text-right font-mono">
                    <Input
                      type="number"
                      value={item.unitCost}
                      onChange={(e) => {
                        const cost = Number(e.target.value);
                        onUpdateCostItem(item.id, {
                          unitCost: cost,
                          subtotal: item.quantity * item.wasteFactor * cost
                        });
                      }}
                      className="w-24 text-right"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    ${item.subtotal.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteCostItem(item.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Cost Items</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Link your measurements to SOW rates to generate cost estimates.
          </p>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Cost Item
          </Button>
        </Card>
      )}

      {/* Totals Summary */}
      {costItems.length > 0 && (
        <Card className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Materials</p>
              <p className="text-lg font-bold">${totals.materialsCost.toFixed(2)}</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Labour</p>
              <p className="text-lg font-bold">${totals.labourCost.toFixed(2)}</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Subtotal</p>
              <p className="text-lg font-bold">${totals.subtotal.toFixed(2)}</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Markup ({markupPercent}%)</p>
              <p className="text-lg font-bold">${totals.markup.toFixed(2)}</p>
            </div>
            <div className="text-center p-3 bg-primary text-primary-foreground rounded-lg">
              <p className="text-xs opacity-80">Total</p>
              <p className="text-xl font-bold">${totals.total.toFixed(2)}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
