import { useState, useMemo } from 'react';
import { Check, Trash2, ChevronDown, ChevronRight, Plus, Search, X, Lock, MessageSquare, Clock, MapPin, Combine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Measurement, MeasurementUnit, MeasurementArea, MATERIAL_CATEGORIES } from '@/lib/takeoff/types';

const AREA_OPTIONS: MeasurementArea[] = [
  'Kitchen', 'Bathroom', 'Bedroom', 'Living Room', 'Dining Room', 'Laundry',
  'Garage', 'Patio', 'Balcony', 'Hallway', 'Entry', 'Office', 'Storage',
  'Utility', 'Ensuite', 'WC', 'External', 'Other'
];

const TYPE_OPTIONS = ['Wall', 'Floor', 'Ceiling', 'Tiling', 'Roofing', 'Cladding', 'Concrete Slab', 'Framing', 'Painting', 'Waterproofing', 'Insulation', 'Other'] as const;
type MeasurementTypeOption = typeof TYPE_OPTIONS[number];

// Framing system options
const FRAMING_OPTIONS = [
  { value: 'steel_64', label: 'Steel Frame 64mm' },
  { value: 'steel_92', label: 'Steel Frame 92mm' },
  { value: 'timber_90_mgp12', label: 'Timber Frame 90mm MGP12' },
  { value: 'timber_90_mgp10', label: 'Timber Frame 90mm MGP10' },
  { value: 'none', label: 'None' },
];

// Lining options
const LINING_OPTIONS = [
  { value: 'pb_10', label: 'Plasterboard 10mm' },
  { value: 'pb_13', label: 'Plasterboard 13mm' },
  { value: 'fc_6', label: 'FC Cement 6mm' },
  { value: 'fc_9', label: 'FC Cement 9mm' },
  { value: 'custom', label: 'Custom' },
];

// Insulation options
const INSULATION_OPTIONS = [
  { value: 'r2_batts', label: 'R2.0 Batts' },
  { value: 'r25_batts', label: 'R2.5 Batts' },
  { value: 'r3_batts', label: 'R3.0 Batts' },
  { value: 'r4_batts', label: 'R4.0 Batts' },
  { value: 'foam', label: 'Spray Foam' },
  { value: 'reflective', label: 'Reflective Foil' },
  { value: 'acoustic', label: 'Acoustic Batts' },
  { value: 'custom', label: 'Custom' },
];

// Concrete type options
const CONCRETE_OPTIONS = [
  { value: '20mpa', label: '20 MPa' },
  { value: '25mpa', label: '25 MPa' },
  { value: '32mpa', label: '32 MPa' },
  { value: '40mpa', label: '40 MPa' },
  { value: 'custom', label: 'Custom' },
];

// Count item presets
const COUNT_PRESETS = ['Toilet', 'Window', 'Door', 'Light', 'Power Point', 'Switch', 'Custom'];

interface TakeoffTableProps {
  measurements: Measurement[];
  onUpdateMeasurement: (id: string, updates: Partial<Measurement>) => void;
  onDeleteMeasurement: (id: string) => void;
  onAddToEstimate: (measurementIds: string[]) => void;
  onFetchNCCCode?: (measurementId: string, area: string, materials: string[]) => Promise<string>;
  inline?: boolean;
}

export const TakeoffTable = ({
  measurements,
  onUpdateMeasurement,
  onDeleteMeasurement,
  onAddToEstimate,
  onFetchNCCCode,
  inline = false,
}: TakeoffTableProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [groupByArea, setGroupByArea] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const filteredMeasurements = useMemo(() => {
    if (!searchFilter) return measurements;
    const lower = searchFilter.toLowerCase();
    return measurements.filter(m =>
      m.label.toLowerCase().includes(lower) ||
      m.area?.toLowerCase().includes(lower) ||
      m.measurementType?.toLowerCase().includes(lower) ||
      m.drawingNumber?.toLowerCase().includes(lower) ||
      m.materials?.some(mat => mat.toLowerCase().includes(lower))
    );
  }, [measurements, searchFilter]);

  const groupedMeasurements = useMemo(() => {
    if (!groupByArea) return { All: filteredMeasurements };
    return filteredMeasurements.reduce((acc, m) => {
      const area = m.area || 'Unassigned';
      if (!acc[area]) acc[area] = [];
      acc[area].push(m);
      return acc;
    }, {} as Record<string, Measurement[]>);
  }, [filteredMeasurements, groupByArea]);

  const totals = useMemo(() => {
    return measurements.reduce(
      (acc, m) => {
        acc[m.unit] = (acc[m.unit] || 0) + m.realValue;
        return acc;
      },
      { LM: 0, M2: 0, M3: 0, count: 0 } as Record<string, number>
    );
  }, [measurements]);

  const validatedCount = useMemo(
    () => measurements.filter((m) => m.validated).length,
    [measurements]
  );

  const lockedCount = useMemo(
    () => measurements.filter((m) => m.lockedToSOW).length,
    [measurements]
  );

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMeasurements.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMeasurements.map((m) => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const handleCombineSelected = () => {
    const toMerge = measurements.filter(m => selectedIds.has(m.id));
    if (toMerge.length < 2) return;
    const units = [...new Set(toMerge.map(m => m.unit))];
    if (units.length > 1) {
      toast.error(`Can't combine — mixed units: ${units.join(', ')}. Select items with the same unit.`);
      return;
    }
    const [first, ...rest] = toMerge;
    const totalValue = toMerge.reduce((sum, m) => sum + m.realValue, 0);
    const areas = [...new Set(toMerge.map(m => m.area).filter(Boolean))];
    const combinedLabel = toMerge.map(m => m.label || m.type).filter(Boolean).join(' + ') || first.label;
    onUpdateMeasurement(first.id, {
      realValue: totalValue,
      label: combinedLabel,
      area: areas.length === 1 ? areas[0] as MeasurementArea : first.area,
    });
    rest.forEach(m => onDeleteMeasurement(m.id));
    setSelectedIds(new Set());
    toast.success(`Combined ${toMerge.length} measurements → ${totalValue.toFixed(2)} ${first.unit}`);
  };

  const handleMaterialToggle = (measurementId: string, material: string) => {
    const measurement = measurements.find((m) => m.id === measurementId);
    const currentMaterials = measurement?.materials || [];
    const newMaterials = currentMaterials.includes(material)
      ? currentMaterials.filter((m) => m !== material)
      : [...currentMaterials, material];
    onUpdateMeasurement(measurementId, { materials: newMaterials });
  };

  const handleFetchNCC = async (measurement: Measurement) => {
    if (!onFetchNCCCode || !measurement.area) return;
    const code = await onFetchNCCCode(
      measurement.id,
      measurement.area,
      measurement.materials || []
    );
    onUpdateMeasurement(measurement.id, { nccCode: code });
  };

  const handleValidate = (id: string) => {
    const measurement = measurements.find((m) => m.id === id);
    onUpdateMeasurement(id, { validated: !measurement?.validated });
  };

  const handleLockToSOW = (id: string) => {
    const measurement = measurements.find((m) => m.id === id);
    const isCurrentlyLocked = measurement?.lockedToSOW;

    // Toggle lock status
    onUpdateMeasurement(id, { lockedToSOW: !isCurrentlyLocked });

    // If locking (not unlocking), add to estimate with related items
    if (!isCurrentlyLocked && measurement) {
      onAddToEstimate([id]);
    }
  };

  // Calculate computed values (e.g., wall area from LM + height)
  const getComputedValue = (m: Measurement): { value: number; unit: string } => {
    if (m.measurementType === 'Wall' && m.height && m.unit === 'LM') {
      return { value: m.realValue * m.height, unit: 'm²' };
    }
    if (m.measurementType === 'Floor' && m.isConcreteFloor && m.concreteDepth && m.unit === 'M2') {
      return { value: m.realValue * m.concreteDepth, unit: 'm³' };
    }
    return { value: m.realValue, unit: m.unit === 'count' ? 'EA' : m.unit };
  };

  // Get wall area for lining/insulation calculations
  const getWallArea = (m: Measurement): number | null => {
    if (m.measurementType === 'Wall' && m.height && m.unit === 'LM') {
      return m.realValue * m.height;
    }
    if (m.measurementType === 'Wall' && m.unit === 'M2') {
      return m.realValue;
    }
    return null;
  };

  // Calculate screws/fixings based on area and type
  const calculateFixings = (m: Measurement): { screws: number; description: string }[] => {
    const results: { screws: number; description: string }[] = [];
    const wallArea = getWallArea(m);

    if (!wallArea) return results;

    // Framing screws (studs at 600mm centres, 2 screws per stud per sheet height)
    if (m.framingSystem && m.framingSystem !== 'none') {
      const studCount = Math.ceil((m.realValue * 1000) / 600); // studs at 600mm centres
      const screwsPerStud = m.framingSystem.includes('steel') ? 4 : 6; // steel needs fewer
      results.push({
        screws: studCount * screwsPerStud,
        description: `Framing screws (${m.framingSystem.includes('steel') ? '10g wafer head' : '8g x 65mm'})`
      });
    }

    // Lining screws (approximately 30 screws per m² for plasterboard)
    if (m.hasLining) {
      const screwsPerM2 = m.liningType?.includes('fc') ? 25 : 30; // FC needs fewer
      results.push({
        screws: Math.ceil(wallArea * screwsPerM2),
        description: `Lining screws (${m.liningType?.includes('fc') ? '32mm FC' : '25mm PB'})`
      });
    }

    return results;
  };

  const renderCountItemRow = (m: Measurement, index: number) => (
    <div key={m.id}>
      <div
        className={cn(
          'grid grid-cols-12 gap-2 p-3 border-b items-start text-sm',
          m.lockedToSOW && 'bg-blue-50 dark:bg-blue-950/30',
          m.validated && 'bg-green-50 dark:bg-green-950/30',
          selectedIds.has(m.id) && 'bg-accent/50'
        )}
      >
        {/* # + Checkbox */}
        <div className="col-span-1 flex items-center gap-1">
          <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
          <Checkbox
            checked={selectedIds.has(m.id)}
            onCheckedChange={() => toggleSelect(m.id)}
          />
        </div>

        {/* Count Name with presets */}
        <div className="col-span-2">
          <Select
            value={m.countName || 'Custom'}
            onValueChange={(v) => {
              onUpdateMeasurement(m.id, {
                countName: v,
                label: v !== 'Custom' ? `${v} (${m.realValue})` : m.label
              });
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {COUNT_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset} className="text-xs">
                  {preset}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Qty */}
        <div className="col-span-1 font-mono text-sm font-semibold">
          {m.realValue.toFixed(0)} EA
        </div>

        {/* Size */}
        <div className="col-span-2">
          <Input
            value={m.itemSize || ''}
            onChange={(e) => onUpdateMeasurement(m.id, { itemSize: e.target.value })}
            className="h-8 text-xs"
            placeholder="Size (e.g., 820x2040)"
          />
        </div>

        {/* Model */}
        <div className="col-span-2">
          <Input
            value={m.itemModel || ''}
            onChange={(e) => onUpdateMeasurement(m.id, { itemModel: e.target.value })}
            className="h-8 text-xs"
            placeholder="Model..."
          />
        </div>

        {/* Comments */}
        <div className="col-span-2">
          <Input
            value={m.comments || ''}
            onChange={(e) => onUpdateMeasurement(m.id, { comments: e.target.value })}
            className="h-8 text-xs"
            placeholder="Comments..."
          />
        </div>

        {/* Actions */}
        <div className="col-span-2 flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={m.lockedToSOW ? 'default' : 'ghost'}
                  size="icon"
                  className={cn('h-7 w-7', m.lockedToSOW && 'bg-blue-600 hover:bg-blue-700')}
                  onClick={() => handleLockToSOW(m.id)}
                >
                  <Lock className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {m.lockedToSOW ? 'Locked to SOW' : 'Lock to SOW'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDeleteMeasurement(m.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderMeasurementRow = (m: Measurement, index: number) => {
    // Check if this is a count measurement
    if (m.unit === 'count') {
      return renderCountItemRow(m, index);
    }

    const computed = getComputedValue(m);

    return (
      <div key={m.id}>
        <div
          className={cn(
            'grid grid-cols-12 gap-2 p-3 border-b items-start text-sm',
            m.lockedToSOW && 'bg-blue-50 dark:bg-blue-950/30',
            m.validated && 'bg-green-50 dark:bg-green-950/30',
            selectedIds.has(m.id) && 'bg-accent/50'
          )}
        >
          {/* # + Checkbox */}
          <div className="col-span-1 flex items-center gap-1">
            <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
            <Checkbox
              checked={selectedIds.has(m.id)}
              onCheckedChange={() => toggleSelect(m.id)}
            />
          </div>

          {/* Type */}
          <div className="col-span-2">
            <Select
              value={m.measurementType || ''}
              onValueChange={(v: MeasurementTypeOption) => onUpdateMeasurement(m.id, { measurementType: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Type..." />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Conditional: Height for Walls */}
            {m.measurementType === 'Wall' && m.unit === 'LM' && (
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">H:</span>
                <Input
                  type="number"
                  value={m.height || ''}
                  onChange={(e) => onUpdateMeasurement(m.id, { height: parseFloat(e.target.value) || undefined })}
                  className="h-6 text-xs w-16"
                  placeholder="m"
                  step="0.1"
                />
              </div>
            )}

            {/* Conditional: Concrete for Floors */}
            {m.measurementType === 'Floor' && (
              <div className="mt-1 space-y-1">
                <label className="flex items-center gap-1 text-[10px]">
                  <Checkbox
                    checked={m.isConcreteFloor || false}
                    onCheckedChange={(checked) => onUpdateMeasurement(m.id, { isConcreteFloor: !!checked })}
                    className="h-3 w-3"
                  />
                  Concrete
                </label>
                {m.isConcreteFloor && (
                  <>
                    <Select
                      value={m.concreteType || ''}
                      onValueChange={(v) => onUpdateMeasurement(m.id, { concreteType: v })}
                    >
                      <SelectTrigger className="h-6 text-[10px]">
                        <SelectValue placeholder="Type..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {CONCRETE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Depth:</span>
                      <Input
                        type="number"
                        value={m.concreteDepth ? Math.round(m.concreteDepth * 1000) : ''}
                        onChange={(e) => {
                          const mm = parseFloat(e.target.value);
                          // Convert mm to metres for storage
                          onUpdateMeasurement(m.id, { concreteDepth: mm ? mm / 1000 : undefined });
                        }}
                        className="h-6 text-xs w-14"
                        placeholder="mm"
                        min="50"
                        max="500"
                        step="10"
                      />
                      <span className="text-[9px] text-muted-foreground">mm</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Qty + Computed */}
          <div className="col-span-1">
            <div className="font-mono text-sm font-semibold">
              {m.realValue.toFixed(2)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {m.unit === 'count' ? 'EA' : m.unit}
            </div>
            {computed.value !== m.realValue && (
              <div className="mt-1 text-xs text-blue-600 font-medium">
                → {computed.value.toFixed(2)} {computed.unit}
              </div>
            )}
          </div>

          {/* Area */}
          <div className="col-span-1">
            <Select
              value={m.area || ''}
              onValueChange={(v: MeasurementArea) => onUpdateMeasurement(m.id, { area: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Area" />
              </SelectTrigger>
              <SelectContent className="bg-popover max-h-48">
                {AREA_OPTIONS.map((area) => (
                  <SelectItem key={area} value={area} className="text-xs">
                    {area}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Framing */}
          <div className="col-span-2">
            <Select
              value={m.framingSystem || 'none'}
              onValueChange={(v) => onUpdateMeasurement(m.id, { framingSystem: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Framing..." />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {FRAMING_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lining + Insulation - Hidden for concrete floors */}
          <div className="col-span-2 space-y-1">
            {m.isConcreteFloor ? (
              <span className="text-[9px] text-muted-foreground italic">N/A - Concrete</span>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <Checkbox
                    checked={m.hasLining || false}
                    onCheckedChange={(checked) => onUpdateMeasurement(m.id, { hasLining: !!checked })}
                    className="h-3 w-3"
                  />
                  <span className="text-[10px]">Lining</span>
                  {m.hasLining && (
                    <Select
                      value={m.liningType || ''}
                      onValueChange={(v) => onUpdateMeasurement(m.id, { liningType: v })}
                    >
                      <SelectTrigger className="h-6 text-[10px] flex-1">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {LINING_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {/* Show computed lining m² for walls */}
                {m.hasLining && getWallArea(m) && (
                  <div className="text-[10px] text-blue-600 font-medium pl-4">
                    → {getWallArea(m)?.toFixed(2)} m² lining
                  </div>
                )}
                {m.hasLining && m.liningType === 'custom' && (
                  <Input
                    value={m.customLining || ''}
                    onChange={(e) => onUpdateMeasurement(m.id, { customLining: e.target.value })}
                    className="h-6 text-xs"
                    placeholder="Custom lining..."
                  />
                )}
                <div className="flex items-center gap-1">
                  <Checkbox
                    checked={m.hasInsulation || false}
                    onCheckedChange={(checked) => onUpdateMeasurement(m.id, { hasInsulation: !!checked })}
                    className="h-3 w-3"
                  />
                  <span className="text-[10px]">Insul.</span>
                  {m.hasInsulation && (
                    <Select
                      value={m.insulationType || ''}
                      onValueChange={(v) => onUpdateMeasurement(m.id, { insulationType: v })}
                    >
                      <SelectTrigger className="h-6 text-[10px] flex-1">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {INSULATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {/* Show computed insulation m² for walls */}
                {m.hasInsulation && getWallArea(m) && (
                  <div className="text-[10px] text-green-600 font-medium pl-4">
                    → {getWallArea(m)?.toFixed(2)} m² insulation
                  </div>
                )}
              </>
            )}
          </div>

          {/* Expand + Actions */}
          <div className="col-span-2 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => toggleExpand(m.id)}
            >
              {expandedIds.has(m.id) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <MessageSquare className="h-3 w-3" />
              )}
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={m.lockedToSOW ? 'default' : 'ghost'}
                    size="icon"
                    className={cn('h-7 w-7', m.lockedToSOW && 'bg-blue-600 hover:bg-blue-700')}
                    onClick={() => handleLockToSOW(m.id)}
                  >
                    <Lock className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {m.lockedToSOW ? 'Locked to SOW' : 'Lock to SOW'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDeleteMeasurement(m.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          {/* NCC Badge (moved to row end) */}
          <div className="col-span-1">
            {m.nccCode ? (
              <Badge variant="outline" className="text-[10px]">
                {m.nccCode}
              </Badge>
            ) : m.area ? (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => handleFetchNCC(m)}
              >
                NCC
              </Button>
            ) : null}
          </div>
        </div>

        {/* Expanded: Drawing, Labour, Comments + Materials */}
        {expandedIds.has(m.id) && (
          <div className="p-3 bg-muted/30 border-b space-y-3">
            {/* Drawing Number + Labour Hours */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Drawing Reference
                </label>
                <Input
                  value={m.drawingNumber || ''}
                  onChange={(e) => onUpdateMeasurement(m.id, { drawingNumber: e.target.value })}
                  className="h-8 text-xs mt-1"
                  placeholder={`Page ${m.pageIndex + 1}`}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Labour Hours
                </label>
                <Input
                  type="number"
                  value={m.labourHours || ''}
                  onChange={(e) => onUpdateMeasurement(m.id, { labourHours: parseFloat(e.target.value) || undefined })}
                  className="h-8 text-xs mt-1"
                  placeholder="0.0"
                  step="0.5"
                />
              </div>
            </div>

            {/* Screws/Fixings Calculator */}
            {calculateFixings(m).length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
                <label className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1 block">
                  Screws & Fixings (Estimated)
                </label>
                <div className="space-y-1">
                  {calculateFixings(m).map((fix, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{fix.description}</span>
                      <span className="font-mono font-medium">{fix.screws.toLocaleString()} pcs</span>
                    </div>
                  ))}
                  <div className="border-t border-amber-200 dark:border-amber-800 pt-1 mt-1 flex justify-between text-xs font-semibold">
                    <span>Total Fixings</span>
                    <span className="font-mono">
                      {calculateFixings(m).reduce((sum, f) => sum + f.screws, 0).toLocaleString()} pcs
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Comments */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Comments</label>
              <Textarea
                value={m.comments || ''}
                onChange={(e) => onUpdateMeasurement(m.id, { comments: e.target.value })}
                className="h-16 text-xs mt-1"
                placeholder="Add notes, specifications, or comments..."
              />
            </div>

            {/* Materials */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Materials</label>
              {Object.entries(MATERIAL_CATEGORIES).map(([category, materials]) => (
                <div key={category} className="space-y-1 mb-2">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {category}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {materials.map((material) => (
                      <Badge
                        key={material}
                        variant={m.materials?.includes(material) ? 'default' : 'outline'}
                        className="cursor-pointer text-[10px]"
                        onClick={() => handleMaterialToggle(m.id, material)}
                      >
                        {material}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const tableContent = (
    <div className="space-y-3">
      {/* Search and Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search measurements..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
          {searchFilter && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5"
              onClick={() => setSearchFilter('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Button
          variant={groupByArea ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setGroupByArea(!groupByArea)}
        >
          Group by Area
        </Button>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 p-2 bg-muted/50 rounded-t-md text-[10px] font-medium text-muted-foreground items-center">
        <div className="col-span-1 flex items-center gap-1">
          <Checkbox
            checked={filteredMeasurements.length > 0 && selectedIds.size === filteredMeasurements.length}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all"
          />
          <span>#</span>
        </div>
        <div className="col-span-2">Type</div>
        <div className="col-span-1">Qty</div>
        <div className="col-span-1">Area</div>
        <div className="col-span-2">Framing</div>
        <div className="col-span-2">Lining/Insul.</div>
        <div className="col-span-2">Actions</div>
        <div className="col-span-1">NCC</div>
      </div>

      {/* Table Body */}
      <ScrollArea className="h-[55vh] border rounded-md">
        {filteredMeasurements.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No measurements yet. Use the tools to add items.
          </div>
        ) : groupByArea ? (
          Object.entries(groupedMeasurements).map(([area, items]) => (
            <div key={area}>
              <div className="bg-muted px-3 py-1.5 text-xs font-semibold border-b sticky top-0 z-10">
                {area} ({items.length})
              </div>
              {items.map((m, idx) => renderMeasurementRow(m, idx))}
            </div>
          ))
        ) : (
          filteredMeasurements.map((m, idx) => renderMeasurementRow(m, idx))
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 bg-muted/30 rounded-md space-y-3">
        {/* Totals */}
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <span className="font-medium">Totals:</span>
          {totals.LM > 0 && <Badge variant="outline">LM: {totals.LM.toFixed(2)}</Badge>}
          {totals.M2 > 0 && <Badge variant="outline">M²: {totals.M2.toFixed(2)}</Badge>}
          {totals.M3 > 0 && <Badge variant="outline">M³: {totals.M3.toFixed(3)}</Badge>}
          {totals.count > 0 && <Badge variant="outline">EA: {totals.count}</Badge>}
          <div className="ml-auto flex gap-2 text-muted-foreground">
            <span>Locked: {lockedCount}</span>
            <span>Validated: {validatedCount}/{measurements.length}</span>
          </div>
        </div>

        {/* Bulk actions — always show if any measurements exist */}
        {measurements.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {selectedIds.size >= 2 && (() => {
              const selected = measurements.filter(m => selectedIds.has(m.id));
              const units = [...new Set(selected.map(m => m.unit))];
              const mixedUnits = units.length > 1;
              const total = mixedUnits ? 0 : selected.reduce((s, m) => s + m.realValue, 0);
              return (
                <Button
                  variant="outline"
                  className={`col-span-2 ${mixedUnits ? 'border-amber-400 text-amber-400 opacity-70 cursor-not-allowed' : 'border-blue-400 text-blue-400 hover:bg-blue-950/40'}`}
                  onClick={mixedUnits ? undefined : handleCombineSelected}
                  disabled={mixedUnits}
                >
                  <Combine className="h-4 w-4 mr-2" />
                  {mixedUnits
                    ? `Mixed units (${units.join(' + ')}) — select same unit to combine`
                    : `Combine ${selectedIds.size} Selected (${total.toFixed(2)} ${units[0]})`}
                </Button>
              );
            })()}
          </div>
        )}
        {measurements.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {/* Add selected OR all */}
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                const ids = selectedIds.size > 0
                  ? Array.from(selectedIds)
                  : measurements.map(m => m.id);
                onAddToEstimate(ids);
                setSelectedIds(new Set());
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {selectedIds.size > 0
                ? `Add ${selectedIds.size} Selected`
                : `Add All (${measurements.length})`}
            </Button>

            {/* Validate / Lock selected OR all */}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                const ids = selectedIds.size > 0
                  ? Array.from(selectedIds)
                  : measurements.map(m => m.id);
                ids.forEach(id => onUpdateMeasurement(id, { validated: true, lockedToSOW: true }));
                onAddToEstimate(ids);
                setSelectedIds(new Set());
              }}
            >
              <Lock className="h-4 w-4 mr-2" />
              {selectedIds.size > 0
                ? `Validate ${selectedIds.size} Selected`
                : `Validate All (${measurements.length})`}
            </Button>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          Tip: tick checkboxes to act on specific rows, or leave unticked to act on all
        </p>
      </div>
    </div>
  );

  if (inline) {
    return <div className="h-full overflow-hidden">{tableContent}</div>;
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Takeoff Table ({measurements.length})
          {lockedCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {lockedCount} locked
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[92vh]">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center justify-between">
            <span>Takeoff Measurements ({measurements.length})</span>
            <span className="text-xs font-normal text-muted-foreground">
              Validate, assign type/area, then Add to Estimate — sheet stays open so you can keep going
            </span>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-2 h-full overflow-hidden">
          {tableContent}
        </div>
      </SheetContent>
    </Sheet>
  );
};
