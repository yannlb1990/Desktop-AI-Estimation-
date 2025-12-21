import { useState, useMemo } from 'react';
import { Check, Trash2, ChevronDown, ChevronRight, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Measurement, MeasurementUnit, MeasurementArea, MATERIAL_CATEGORIES } from '@/lib/takeoff/types';

const AREA_OPTIONS: MeasurementArea[] = [
  'Kitchen', 'Bathroom', 'Bedroom', 'Living Room', 'Dining Room', 'Laundry',
  'Garage', 'Patio', 'Balcony', 'Hallway', 'Entry', 'Office', 'Storage',
  'Utility', 'Ensuite', 'WC', 'External', 'Other'
];

interface EnhancedMeasurement extends Measurement {
  area?: MeasurementArea;
  materials?: string[];
  nccCode?: string;
  validated?: boolean;
  addedToEstimate?: boolean;
}

interface TakeoffTableProps {
  measurements: Measurement[];
  onUpdateMeasurement: (id: string, updates: Partial<EnhancedMeasurement>) => void;
  onDeleteMeasurement: (id: string) => void;
  onAddToEstimate: (measurementIds: string[]) => void;
  onFetchNCCCode?: (measurementId: string, area: string, materials: string[]) => Promise<string>;
}

export const TakeoffTable = ({
  measurements,
  onUpdateMeasurement,
  onDeleteMeasurement,
  onAddToEstimate,
  onFetchNCCCode,
}: TakeoffTableProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [groupByArea, setGroupByArea] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const enhancedMeasurements = measurements as EnhancedMeasurement[];

  const filteredMeasurements = useMemo(() => {
    if (!searchFilter) return enhancedMeasurements;
    const lower = searchFilter.toLowerCase();
    return enhancedMeasurements.filter(m => 
      m.label.toLowerCase().includes(lower) ||
      m.area?.toLowerCase().includes(lower) ||
      m.materials?.some(mat => mat.toLowerCase().includes(lower))
    );
  }, [enhancedMeasurements, searchFilter]);

  const groupedMeasurements = useMemo(() => {
    if (!groupByArea) return { All: filteredMeasurements };
    return filteredMeasurements.reduce((acc, m) => {
      const area = m.area || 'Unassigned';
      if (!acc[area]) acc[area] = [];
      acc[area].push(m);
      return acc;
    }, {} as Record<string, EnhancedMeasurement[]>);
  }, [filteredMeasurements, groupByArea]);

  const totals = useMemo(() => {
    return enhancedMeasurements.reduce(
      (acc, m) => {
        acc[m.unit] = (acc[m.unit] || 0) + m.realValue;
        return acc;
      },
      { LM: 0, M2: 0, M3: 0, count: 0 } as Record<MeasurementUnit, number>
    );
  }, [enhancedMeasurements]);

  const validatedCount = useMemo(
    () => enhancedMeasurements.filter((m) => m.validated).length,
    [enhancedMeasurements]
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

  const handleMaterialToggle = (measurementId: string, material: string) => {
    const measurement = enhancedMeasurements.find((m) => m.id === measurementId);
    const currentMaterials = measurement?.materials || [];
    const newMaterials = currentMaterials.includes(material)
      ? currentMaterials.filter((m) => m !== material)
      : [...currentMaterials, material];
    onUpdateMeasurement(measurementId, { materials: newMaterials });
  };

  const handleFetchNCC = async (measurement: EnhancedMeasurement) => {
    if (!onFetchNCCCode || !measurement.area) return;
    const code = await onFetchNCCCode(
      measurement.id,
      measurement.area,
      measurement.materials || []
    );
    onUpdateMeasurement(measurement.id, { nccCode: code });
  };

  const handleValidate = (id: string) => {
    const measurement = enhancedMeasurements.find((m) => m.id === id);
    onUpdateMeasurement(id, { validated: !measurement?.validated });
  };

  const renderMeasurementRow = (m: EnhancedMeasurement) => (
    <div key={m.id}>
      <div
        className={cn(
          'grid grid-cols-12 gap-2 p-2 border-b items-center text-sm',
          m.validated && 'bg-green-50 dark:bg-green-950/30',
          selectedIds.has(m.id) && 'bg-accent/50'
        )}
      >
        {/* Checkbox */}
        <div className="col-span-1 flex items-center">
          <Checkbox
            checked={selectedIds.has(m.id)}
            onCheckedChange={() => toggleSelect(m.id)}
          />
        </div>

        {/* Name */}
        <div className="col-span-2">
          <Input
            value={m.label}
            onChange={(e) => onUpdateMeasurement(m.id, { label: e.target.value })}
            className="h-8 text-xs"
            placeholder="Label..."
          />
        </div>

        {/* Area */}
        <div className="col-span-2">
          <Select
            value={m.area || ''}
            onValueChange={(v: MeasurementArea) => onUpdateMeasurement(m.id, { area: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {AREA_OPTIONS.map((area) => (
                <SelectItem key={area} value={area} className="text-xs">
                  {area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Qty */}
        <div className="col-span-1 font-mono text-xs">
          {m.realValue.toFixed(2)}
        </div>

        {/* Unit */}
        <div className="col-span-1">
          <Select
            value={m.unit}
            onValueChange={(v: MeasurementUnit) => onUpdateMeasurement(m.id, { unit: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="LM">LM</SelectItem>
              <SelectItem value="M2">M²</SelectItem>
              <SelectItem value="M3">M³</SelectItem>
              <SelectItem value="count">EA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Materials - Inline pills */}
        <div className="col-span-2">
          <div className="flex flex-wrap gap-1 items-center">
            {m.materials?.slice(0, 2).map((mat) => (
              <Badge key={mat} variant="secondary" className="text-[10px] px-1">
                {mat}
              </Badge>
            ))}
            {(m.materials?.length || 0) > 2 && (
              <Badge variant="outline" className="text-[10px] px-1">
                +{(m.materials?.length || 0) - 2}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => toggleExpand(m.id)}
            >
              {expandedIds.has(m.id) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>

        {/* NCC */}
        <div className="col-span-2">
          {m.nccCode ? (
            <Badge variant="outline" className="text-xs">
              {m.nccCode}
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleFetchNCC(m)}
              disabled={!m.area}
            >
              Fetch NCC
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="col-span-1 flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={m.validated ? 'default' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleValidate(m.id)}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {m.validated ? 'Validated' : 'Validate'}
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

      {/* Material Selection Panel */}
      {expandedIds.has(m.id) && (
        <div className="p-3 bg-muted/30 border-b space-y-2">
          {Object.entries(MATERIAL_CATEGORIES).map(([category, materials]) => (
            <div key={category} className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {category}
              </span>
              <div className="flex flex-wrap gap-1">
                {materials.map((material) => (
                  <Badge
                    key={material}
                    variant={m.materials?.includes(material) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => handleMaterialToggle(m.id, material)}
                  >
                    {material}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

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
      <div className="grid grid-cols-12 gap-2 p-2 bg-muted/50 rounded-t-md text-xs font-medium text-muted-foreground">
        <div className="col-span-1 flex items-center">
          <Checkbox
            checked={selectedIds.size === filteredMeasurements.length && filteredMeasurements.length > 0}
            onCheckedChange={toggleSelectAll}
          />
        </div>
        <div className="col-span-2">Name</div>
        <div className="col-span-2">Area</div>
        <div className="col-span-1">Qty</div>
        <div className="col-span-1">Unit</div>
        <div className="col-span-2">Materials</div>
        <div className="col-span-2">NCC</div>
        <div className="col-span-1">Actions</div>
      </div>

      {/* Table Body */}
      <ScrollArea className="h-[400px] border rounded-md">
        {filteredMeasurements.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No measurements yet. Use the tools to add items.
          </div>
        ) : groupByArea ? (
          Object.entries(groupedMeasurements).map(([area, items]) => (
            <div key={area}>
              <div className="bg-muted px-3 py-1.5 text-xs font-semibold border-b">
                {area} ({items.length})
              </div>
              {items.map(renderMeasurementRow)}
            </div>
          ))
        ) : (
          filteredMeasurements.map(renderMeasurementRow)
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 bg-muted/30 rounded-md space-y-3">
        {/* Totals */}
        <div className="flex items-center gap-4 text-xs">
          <span className="font-medium">Totals:</span>
          {totals.LM > 0 && <span>LM: {totals.LM.toFixed(2)}</span>}
          {totals.M2 > 0 && <span>M²: {totals.M2.toFixed(2)}</span>}
          {totals.M3 > 0 && <span>M³: {totals.M3.toFixed(3)}</span>}
          {totals.count > 0 && <span>EA: {totals.count}</span>}
          <span className="ml-auto text-muted-foreground">
            Validated: {validatedCount} / {measurements.length}
          </span>
        </div>

        {/* Add to Estimate Button */}
        {selectedIds.size > 0 && (
          <Button
            className="w-full"
            onClick={() => {
              onAddToEstimate(Array.from(selectedIds));
              setSelectedIds(new Set());
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {selectedIds.size} to Estimate
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Takeoff Table ({measurements.length})
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Takeoff Measurements</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          {tableContent}
        </div>
      </SheetContent>
    </Sheet>
  );
};
