import React, { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { Measurement, CostItem } from '@/lib/takeoff/types';

// ── Utilities ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function currency(n: number): string {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 });
}

function makeCostItem(params: {
  trade: string;
  name: string;
  unit: 'm²' | 'LM' | 'EA';
  unitCost: number;
  quantity: number;
  measurementId: string;
}): CostItem {
  const { trade, name, unit, unitCost, quantity, measurementId } = params;
  return {
    id: generateId(),
    category: trade,
    name,
    description: name,
    unit,
    unitCost,
    quantity,
    linkedMeasurements: [measurementId],
    wasteFactor: 1.05,
    subtotal: quantity * unitCost * 1.05,
    trade,
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ModificationDialogProps {
  open: boolean;
  mode: 'wall' | 'door' | 'window';
  measurement: Measurement;
  onConfirm: (measurement: Measurement, costItems: CostItem[]) => void;
  onCancel: () => void;
}

// ── Wall form ─────────────────────────────────────────────────────────────────

interface WallForm {
  wallType: 'Internal' | 'External';
  ceilingHeight: number;
  lining: 'Both sides' | 'One side' | 'None';
  insulation: boolean;
}

function buildWallItems(wallLength: number, form: WallForm, measurementId: string): CostItem[] {
  const { wallType, ceilingHeight, lining, insulation } = form;
  const isInternal = wallType === 'Internal';
  const framingRate = isInternal ? 85 : 120;
  const m2 = wallLength * ceilingHeight;
  const hasSide1 = lining !== 'None';
  const hasSide2 = lining === 'Both sides';

  const items: CostItem[] = [];

  items.push(makeCostItem({
    trade: 'Carpentry',
    name: `Wall Framing – ${wallType}`,
    unit: 'LM',
    unitCost: framingRate,
    quantity: wallLength,
    measurementId,
  }));

  if (hasSide1) {
    items.push(makeCostItem({
      trade: 'Plasterboard',
      name: 'Plasterboard – Side 1',
      unit: 'm²',
      unitCost: 45,
      quantity: m2,
      measurementId,
    }));
  }

  if (hasSide2) {
    items.push(makeCostItem({
      trade: 'Plasterboard',
      name: 'Plasterboard – Side 2',
      unit: 'm²',
      unitCost: 45,
      quantity: m2,
      measurementId,
    }));
  }

  if (insulation) {
    items.push(makeCostItem({
      trade: 'Carpentry',
      name: 'Insulation Batts',
      unit: 'm²',
      unitCost: 18,
      quantity: m2,
      measurementId,
    }));
  }

  if (hasSide1) {
    items.push(makeCostItem({
      trade: 'Painting',
      name: 'Painting – Side 1',
      unit: 'm²',
      unitCost: 35,
      quantity: m2,
      measurementId,
    }));
  }

  if (hasSide2) {
    items.push(makeCostItem({
      trade: 'Painting',
      name: 'Painting – Side 2',
      unit: 'm²',
      unitCost: 35,
      quantity: m2,
      measurementId,
    }));
  }

  if (isInternal && hasSide1) {
    items.push(makeCostItem({
      trade: 'Carpentry',
      name: 'Skirting',
      unit: 'LM',
      unitCost: 28,
      quantity: wallLength * 2,
      measurementId,
    }));
  }

  return items;
}

// ── Door form ─────────────────────────────────────────────────────────────────

interface DoorForm {
  doorType: 'Hinged' | 'Sliding' | 'Bifold' | 'Double Hinged';
  widthMm: number;
  heightMm: number;
  core: 'Hollow' | 'Solid';
  architrave: boolean;
  hardware: boolean;
}

function doorRate(form: DoorForm): number {
  const { doorType, core } = form;
  const rates: Record<string, number> = {
    'Hollow_Hinged': 680,
    'Solid_Hinged': 1100,
    'Sliding': 1200,
    'Bifold': 1800,
    'Double Hinged': 2200,
  };
  if (doorType === 'Hinged') return rates[`${core}_Hinged`] ?? 680;
  return rates[doorType] ?? 680;
}

function buildDoorItems(form: DoorForm, measurementId: string): CostItem[] {
  const { widthMm, heightMm, architrave, hardware } = form;
  const items: CostItem[] = [];

  items.push(makeCostItem({
    trade: 'Windows & Doors',
    name: `${form.core} ${form.doorType} Door Supply & Install`,
    unit: 'EA',
    unitCost: doorRate(form),
    quantity: 1,
    measurementId,
  }));

  if (hardware) {
    items.push(makeCostItem({
      trade: 'Carpentry',
      name: 'Door Hardware (handles/latch)',
      unit: 'EA',
      unitCost: 280,
      quantity: 1,
      measurementId,
    }));
  }

  if (architrave) {
    const architraveLm = ((widthMm + heightMm * 2) / 1000) * 2;
    items.push(makeCostItem({
      trade: 'Carpentry',
      name: 'Architrave',
      unit: 'LM',
      unitCost: 28,
      quantity: architraveLm,
      measurementId,
    }));
  }

  return items;
}

// ── Window form ───────────────────────────────────────────────────────────────

interface WindowForm {
  windowType: 'Sliding' | 'Fixed' | 'Awning' | 'Double-hung';
  widthMm: number;
  heightMm: number;
  glazing: 'Single' | 'Double';
  sill: boolean;
  reveal: boolean;
}

function windowBaseRate(type: WindowForm['windowType']): number {
  const rates: Record<string, number> = {
    Sliding: 950,
    Fixed: 680,
    Awning: 820,
    'Double-hung': 1050,
  };
  return rates[type] ?? 950;
}

function buildWindowItems(form: WindowForm, measurementId: string): CostItem[] {
  const { windowType, widthMm, heightMm, glazing, sill, reveal } = form;
  const baseRate = windowBaseRate(windowType);
  const rate = glazing === 'Double' ? baseRate * 1.4 : baseRate;
  const items: CostItem[] = [];

  items.push(makeCostItem({
    trade: 'Windows & Doors',
    name: `${windowType} Window ${glazing}-glazed Supply & Install`,
    unit: 'EA',
    unitCost: rate,
    quantity: 1,
    measurementId,
  }));

  if (sill) {
    items.push(makeCostItem({
      trade: 'Carpentry',
      name: 'Window Sill',
      unit: 'LM',
      unitCost: 85,
      quantity: widthMm / 1000,
      measurementId,
    }));
  }

  if (reveal) {
    const revealLm = ((widthMm + heightMm * 2) / 1000) * 2;
    items.push(makeCostItem({
      trade: 'Carpentry',
      name: 'Reveal / Architrave',
      unit: 'LM',
      unitCost: 32,
      quantity: revealLm,
      measurementId,
    }));
  }

  return items;
}

// ── Sub-forms ─────────────────────────────────────────────────────────────────

interface WallSubFormProps {
  form: WallForm;
  onChange: (form: WallForm) => void;
}

const WallSubForm: React.FC<WallSubFormProps> = ({ form, onChange }) => (
  <div className="space-y-3">
    <div className="space-y-1.5">
      <Label htmlFor="wallType">Wall type</Label>
      <Select
        value={form.wallType}
        onValueChange={(v) => {
          const wallType = v as WallForm['wallType'];
          onChange({
            ...form,
            wallType,
            lining: wallType === 'Internal' ? 'Both sides' : 'One side',
            insulation: wallType === 'External',
          });
        }}
      >
        <SelectTrigger id="wallType">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Internal">Internal</SelectItem>
          <SelectItem value="External">External</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="ceilingHeight">Ceiling height (m)</Label>
      <Input
        id="ceilingHeight"
        type="number"
        step={0.1}
        min={2}
        max={6}
        value={form.ceilingHeight}
        onChange={(e) => onChange({ ...form, ceilingHeight: parseFloat(e.target.value) || 2.4 })}
      />
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="lining">Lining</Label>
      <Select
        value={form.lining}
        onValueChange={(v) => onChange({ ...form, lining: v as WallForm['lining'] })}
      >
        <SelectTrigger id="lining">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Both sides">Both sides</SelectItem>
          <SelectItem value="One side">One side</SelectItem>
          <SelectItem value="None">None</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="flex items-center gap-2">
      <Checkbox
        id="insulation"
        checked={form.insulation}
        onCheckedChange={(v) => onChange({ ...form, insulation: !!v })}
      />
      <Label htmlFor="insulation">Insulation batts</Label>
    </div>
  </div>
);

interface DoorSubFormProps {
  form: DoorForm;
  onChange: (form: DoorForm) => void;
}

const DoorSubForm: React.FC<DoorSubFormProps> = ({ form, onChange }) => (
  <div className="space-y-3">
    <div className="space-y-1.5">
      <Label htmlFor="doorType">Door type</Label>
      <Select
        value={form.doorType}
        onValueChange={(v) => onChange({ ...form, doorType: v as DoorForm['doorType'] })}
      >
        <SelectTrigger id="doorType">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Hinged">Hinged</SelectItem>
          <SelectItem value="Sliding">Sliding</SelectItem>
          <SelectItem value="Bifold">Bifold</SelectItem>
          <SelectItem value="Double Hinged">Double Hinged</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="doorWidth">Width (mm)</Label>
        <Input
          id="doorWidth"
          type="number"
          step={10}
          min={600}
          max={2400}
          value={form.widthMm}
          onChange={(e) => onChange({ ...form, widthMm: parseInt(e.target.value, 10) || 820 })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doorHeight">Height (mm)</Label>
        <Input
          id="doorHeight"
          type="number"
          step={10}
          min={1800}
          max={3000}
          value={form.heightMm}
          onChange={(e) => onChange({ ...form, heightMm: parseInt(e.target.value, 10) || 2040 })}
        />
      </div>
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="core">Core</Label>
      <Select
        value={form.core}
        onValueChange={(v) => onChange({ ...form, core: v as DoorForm['core'] })}
      >
        <SelectTrigger id="core">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Hollow">Hollow</SelectItem>
          <SelectItem value="Solid">Solid</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="flex items-center gap-2">
      <Checkbox
        id="architrave"
        checked={form.architrave}
        onCheckedChange={(v) => onChange({ ...form, architrave: !!v })}
      />
      <Label htmlFor="architrave">Architrave (both sides)</Label>
    </div>

    <div className="flex items-center gap-2">
      <Checkbox
        id="hardware"
        checked={form.hardware}
        onCheckedChange={(v) => onChange({ ...form, hardware: !!v })}
      />
      <Label htmlFor="hardware">Hardware (handles/latch)</Label>
    </div>
  </div>
);

interface WindowSubFormProps {
  form: WindowForm;
  onChange: (form: WindowForm) => void;
}

const WindowSubForm: React.FC<WindowSubFormProps> = ({ form, onChange }) => (
  <div className="space-y-3">
    <div className="space-y-1.5">
      <Label htmlFor="windowType">Window type</Label>
      <Select
        value={form.windowType}
        onValueChange={(v) => onChange({ ...form, windowType: v as WindowForm['windowType'] })}
      >
        <SelectTrigger id="windowType">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Sliding">Sliding</SelectItem>
          <SelectItem value="Fixed">Fixed</SelectItem>
          <SelectItem value="Awning">Awning</SelectItem>
          <SelectItem value="Double-hung">Double-hung</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="winWidth">Width (mm)</Label>
        <Input
          id="winWidth"
          type="number"
          step={50}
          min={300}
          max={3000}
          value={form.widthMm}
          onChange={(e) => onChange({ ...form, widthMm: parseInt(e.target.value, 10) || 1200 })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="winHeight">Height (mm)</Label>
        <Input
          id="winHeight"
          type="number"
          step={50}
          min={300}
          max={3000}
          value={form.heightMm}
          onChange={(e) => onChange({ ...form, heightMm: parseInt(e.target.value, 10) || 1200 })}
        />
      </div>
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="glazing">Glazing</Label>
      <Select
        value={form.glazing}
        onValueChange={(v) => onChange({ ...form, glazing: v as WindowForm['glazing'] })}
      >
        <SelectTrigger id="glazing">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Single">Single</SelectItem>
          <SelectItem value="Double">Double (+40%)</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="flex items-center gap-2">
      <Checkbox
        id="sill"
        checked={form.sill}
        onCheckedChange={(v) => onChange({ ...form, sill: !!v })}
      />
      <Label htmlFor="sill">Window sill</Label>
    </div>

    <div className="flex items-center gap-2">
      <Checkbox
        id="reveal"
        checked={form.reveal}
        onCheckedChange={(v) => onChange({ ...form, reveal: !!v })}
      />
      <Label htmlFor="reveal">Reveal / Architrave</Label>
    </div>
  </div>
);

// ── Cost item preview row ─────────────────────────────────────────────────────

const CostItemPreviewRow: React.FC<{ item: CostItem }> = ({ item }) => (
  <div className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
    <div className="flex-1 min-w-0 pr-3">
      <p className="font-medium truncate">{item.name}</p>
      <p className="text-xs text-muted-foreground">{item.trade}</p>
    </div>
    <div className="text-right shrink-0">
      <p className="text-xs text-muted-foreground">
        {item.quantity.toFixed(2)} {item.unit} × {currency(item.unitCost)}
      </p>
      <p className="font-semibold">{currency(item.subtotal)}</p>
    </div>
  </div>
);

// ── Main Dialog ───────────────────────────────────────────────────────────────

export const ModificationDialog: React.FC<ModificationDialogProps> = ({
  open,
  mode,
  measurement,
  onConfirm,
  onCancel,
}) => {
  // Default wall form
  const [wallForm, setWallForm] = useState<WallForm>({
    wallType: 'Internal',
    ceilingHeight: 2.4,
    lining: 'Both sides',
    insulation: false,
  });

  // Default door form
  const [doorForm, setDoorForm] = useState<DoorForm>({
    doorType: 'Hinged',
    widthMm: 820,
    heightMm: 2040,
    core: 'Hollow',
    architrave: true,
    hardware: true,
  });

  // Default window form
  const [windowForm, setWindowForm] = useState<WindowForm>({
    windowType: 'Sliding',
    widthMm: 1200,
    heightMm: 1200,
    glazing: 'Single',
    sill: true,
    reveal: true,
  });

  // Wall length from measurement
  const wallLength = useMemo(() => measurement.realValue, [measurement.realValue]);

  // Live cost item generation
  const costItems = useMemo<CostItem[]>(() => {
    if (mode === 'wall') {
      return buildWallItems(wallLength, wallForm, measurement.id);
    }
    if (mode === 'door') {
      return buildDoorItems(doorForm, measurement.id);
    }
    if (mode === 'window') {
      return buildWindowItems(windowForm, measurement.id);
    }
    return [];
  }, [mode, wallLength, wallForm, doorForm, windowForm, measurement.id]);

  const totalCost = useMemo(() => costItems.reduce((s, i) => s + i.subtotal, 0), [costItems]);

  const title = mode === 'wall' ? 'New Wall' : mode === 'door' ? 'New Door' : 'New Window';
  const subtitle = mode === 'wall'
    ? `Wall length: ${wallLength.toFixed(2)} m (from plan)`
    : undefined;

  const handleConfirm = () => {
    // Build updated measurement with appropriate metadata
    let updatedMeasurement: Measurement;
    if (mode === 'wall') {
      updatedMeasurement = {
        ...measurement,
        measurementType: 'Wall',
        color: '#f59e0b',
        label: 'Wall modification',
      };
    } else if (mode === 'door') {
      updatedMeasurement = {
        ...measurement,
        countName: 'Door',
        color: '#8b5cf6',
        label: 'Door',
      };
    } else {
      updatedMeasurement = {
        ...measurement,
        countName: 'Window',
        color: '#06b6d4',
        label: 'Window',
      };
    }
    onConfirm(updatedMeasurement, costItems);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="sm:max-w-lg z-[10002]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Form */}
          {mode === 'wall' && (
            <WallSubForm form={wallForm} onChange={setWallForm} />
          )}
          {mode === 'door' && (
            <DoorSubForm form={doorForm} onChange={setDoorForm} />
          )}
          {mode === 'window' && (
            <WindowSubForm form={windowForm} onChange={setWindowForm} />
          )}

          <Separator />

          {/* Cost items preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Cost items to create</h4>
              <span className="text-xs text-muted-foreground">{costItems.length} item{costItems.length !== 1 ? 's' : ''}</span>
            </div>
            {costItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No cost items will be created with current settings.</p>
            ) : (
              <ScrollArea className="max-h-52">
                <div className="pr-3">
                  {costItems.map((item) => (
                    <CostItemPreviewRow key={item.id} item={item} />
                  ))}
                  <div className="flex items-center justify-between pt-2 text-sm font-semibold">
                    <span>Total (incl. 5% waste)</span>
                    <span>{currency(totalCost)}</span>
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={costItems.length === 0}>
            Add to Estimate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
