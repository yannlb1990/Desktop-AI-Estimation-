import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { CostItem, Measurement } from '@/lib/takeoff/types';
import type { MaterialEntry } from '@/lib/materials/types';
import { getUserStorageKey } from '@/lib/localAuth';
import { addCostItemsToEstimate, CATEGORY_TO_TRADE } from '@/lib/estimate/fromCostItem';
import { markTakeoffAdded } from '@/lib/estimate/planLinkSync';
import { projectStateCode } from '@/lib/estimate/exports';
import { getEffectiveRate } from '@/data/labourRates';
import { MaterialPickerDialog } from '@/components/takeoff/MaterialPickerDialog';
import { RecipePickerDialog } from '@/components/recipes/RecipePickerDialog';

interface Props {
  projectId: string;
  /** Bumped by the Estimate whenever its items reload, so this block re-reads too */
  refreshKey: unknown;
}

function readProject(projectId: string): any | null {
  try {
    const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    return projects.find((p: any) => p.id === projectId) ?? null;
  } catch {
    return null;
  }
}

export function readTakeoff(projectId: string): { measurements: Measurement[]; costItems: CostItem[] } {
  try {
    const t = JSON.parse(localStorage.getItem(`takeoff_${projectId}`) || '{}');
    return { measurements: t.measurements || [], costItems: t.costItems || [] };
  } catch {
    return { measurements: [], costItems: [] };
  }
}

/** Takeoff items that are not in the estimate yet (older projects). */
export function pendingPlanItems(projectId: string): CostItem[] {
  const ids = new Set<string>(readProject(projectId)?.takeoff_suggestions || []);
  if (ids.size === 0) return [];
  return readTakeoff(projectId).costItems.filter(c => ids.has(c.id));
}

/**
 * Sits at the top of "Add to estimate": items from the plan not priced yet,
 * and the Library / Recipe quick fills.
 */
export function EstimatePlanPanel({ projectId, refreshKey }: Props) {
  const [project, setProject] = useState<any>(() => readProject(projectId));
  const [takeoff, setTakeoff] = useState(() => readTakeoff(projectId));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);

  useEffect(() => {
    setProject(readProject(projectId));
    setTakeoff(readTakeoff(projectId));
  }, [projectId, refreshKey]);

  const suggestions = useMemo(() => {
    const ids = new Set<string>(project?.takeoff_suggestions || []);
    return takeoff.costItems.filter(c => ids.has(c.id));
  }, [project, takeoff]);

  const state = projectStateCode(project);
  const add = (items: CostItem[], fromSuggestions = false) => {
    const added = addCostItemsToEstimate(projectId, items, takeoff.measurements);
    if (fromSuggestions) markTakeoffAdded(projectId, items.map(i => i.id), true);
    setProject(readProject(projectId));
    return added.length;
  };
  const dismiss = (ids: string[]) => {
    markTakeoffAdded(projectId, ids, true);
    setProject(readProject(projectId));
  };

  const addFromLibrary = (material: MaterialEntry) => {
    const trade = CATEGORY_TO_TRADE[material.trade] || material.trade || 'Carpenter';
    add([{
      id: crypto.randomUUID(),
      category: material.trade,
      name: material.name,
      description: [material.productCode, material.supplierName, material.notes].filter(Boolean).join(' · ') || material.name,
      unit: material.unit,
      unitCost: material.unitCost,
      quantity: 1,
      linkedMeasurements: [],
      wasteFactor: 1,
      subtotal: 0,
      trade: material.trade,
      hourlyRate: getEffectiveRate(trade, state),
    } as CostItem]);
    toast.success(`Added "${material.name}" to the estimate`);
    if (material.leadTimeWeeks && material.leadTimeWeeks >= 8) {
      toast.warning(`Long lead time: ${material.leadTimeWeeks} weeks. Order early to avoid delays.`, { duration: 5000 });
    }
  };

  return (
    <div className="mt-4 space-y-3">
      {suggestions.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              From your takeoff, not priced yet ({suggestions.length})
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs" onClick={() => {
                const n = add(suggestions, true);
                toast.success(`${n} line${n !== 1 ? 's' : ''} added to the estimate`);
              }}>
                Add all
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dismiss(suggestions.map(s => s.id))}>
                Dismiss all
              </Button>
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-border/50">
            {suggestions.map(s => (
              <div key={s.id} className="flex items-center gap-3 py-1.5 text-xs">
                <span className="flex-1 truncate" title={s.name}>{s.name}</span>
                <span className="font-mono text-muted-foreground whitespace-nowrap">{Number(s.quantity).toFixed(1)} {s.unit}</span>
                {(s.linkedMeasurements?.length ?? 0) > 0 && (
                  <span className="text-[10px] text-muted-foreground">from plan</span>
                )}
                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => add([s], true)}>Add</Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={() => dismiss([s.id])}>
                  Dismiss
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Quick fill:</span>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setLibraryOpen(true)}>
          From your material library
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setRecipeOpen(true)}>
          From a recipe
        </Button>
        <span className="text-xs text-muted-foreground">or fill the line below. Quantities can come straight from a measurement.</span>
      </div>

      <MaterialPickerDialog open={libraryOpen} onOpenChange={setLibraryOpen} onSelect={addFromLibrary} />
      <RecipePickerDialog
        open={recipeOpen}
        onOpenChange={setRecipeOpen}
        onAddCostItem={(item) => add([item])}
        selectedState={state}
      />
    </div>
  );
}
