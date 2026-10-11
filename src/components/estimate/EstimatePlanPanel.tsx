import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { BookOpen, ChefHat, FileSpreadsheet, FileText, Mail, Ruler, X } from 'lucide-react';
import type { CostItem, Measurement } from '@/lib/takeoff/types';
import type { MaterialEntry } from '@/lib/materials/types';
import { getUserStorageKey } from '@/lib/localAuth';
import { addCostItemsToEstimate, estimateLinesAsCostItems, CATEGORY_TO_TRADE } from '@/lib/estimate/fromCostItem';
import { markTakeoffAdded } from '@/lib/estimate/planLinkSync';
import { resolveProjectPricing, calculateProjectTotals } from '@/lib/pricing/estimatePricing';
import { readUserPricingDefaults } from '@/lib/pricing/userPricingDefaults';
import { getEffectiveRate } from '@/data/labourRates';
import { exportToBOQCsv } from '@/lib/takeoff/export';
import { MaterialPickerDialog } from '@/components/takeoff/MaterialPickerDialog';
import { RecipePickerDialog } from '@/components/recipes/RecipePickerDialog';
import { SupplierQuoteDialog } from '@/components/SupplierQuoteDialog';
import { SOWGeneratorDialog } from '@/components/takeoff/SOWGeneratorDialog';

interface Props {
  projectId: string;
  /** Bumped by the Estimate whenever its items reload, so this panel re-reads too */
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

function readTakeoff(projectId: string): { measurements: Measurement[]; costItems: CostItem[] } {
  try {
    const t = JSON.parse(localStorage.getItem(`takeoff_${projectId}`) || '{}');
    return { measurements: t.measurements || [], costItems: t.costItems || [] };
  } catch {
    return { measurements: [], costItems: [] };
  }
}

const projectState = (project: any): string =>
  (String(project?.site_address || project?.address || '').match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/i)?.[1] || project?.state || 'NSW').toUpperCase();

/**
 * Everything the old Costs tab did, working on the one Estimate:
 * takeoff items waiting to be added, plus Library, Recipes, supplier quotes and
 * the BOQ / Scope of Work exports.
 */
export function EstimatePlanPanel({ projectId, refreshKey }: Props) {
  const [project, setProject] = useState<any>(() => readProject(projectId));
  const [takeoff, setTakeoff] = useState(() => readTakeoff(projectId));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [supplierItems, setSupplierItems] = useState<CostItem[] | null>(null);
  const [sowOpen, setSowOpen] = useState(false);

  useEffect(() => {
    setProject(readProject(projectId));
    setTakeoff(readTakeoff(projectId));
  }, [projectId, refreshKey]);

  const suggestions = useMemo(() => {
    const ids = new Set<string>(project?.takeoff_suggestions || []);
    return takeoff.costItems.filter(c => ids.has(c.id));
  }, [project, takeoff]);

  const state = projectState(project);
  const add = (items: CostItem[], fromSuggestions = false) => {
    const added = addCostItemsToEstimate(projectId, items, takeoff.measurements);
    markTakeoffAdded(projectId, items.map(i => i.id), fromSuggestions);
    setProject(readProject(projectId));
    return added.length;
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

  const lines = () => estimateLinesAsCostItems(readProject(projectId));

  const exportBOQ = () => {
    const p = readProject(projectId);
    const items = estimateLinesAsCostItems(p);
    if (items.length === 0) { toast.error('The estimate has no lines yet'); return; }
    const defaults = readUserPricingDefaults(p);
    const { config } = resolveProjectPricing(p, defaults);
    const t = calculateProjectTotals(p, defaults);
    const linesTotal = items.reduce((sum, i) => sum + (i.subtotal || 0), 0);
    const csv = exportToBOQCsv({
      projectName: p?.name || 'Project',
      projectLocation: p?.site_address || p?.address || '',
      state,
      costItems: items,
      estimateTotals: {
        rows: [
          { label: 'SUPERVISION, OVERHEADS, PRELIMINARIES AND ALLOWANCES', amount: t.preMargin - linesTotal },
          { label: `CONTINGENCY (${config.contingencyPct}%)`, amount: t.contingency },
          { label: 'OTHER ADJUSTMENTS', amount: t.customConfigsTotal },
          { label: `MARGIN (${config.marginPct}%)`, amount: t.margin },
        ],
        exGst: t.taxable,
        gst: t.gst,
        gstPct: config.gstPct,
        incGst: t.totalPrice,
      },
    });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `BOQ_${(p?.name || 'project').replace(/[^\w-]+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-amber-400" />
          <span className="font-semibold">From the plan</span>
          <span className="text-xs text-muted-foreground">
            Lines marked PLAN follow their measurements. Anything you add in the takeoff lands here.
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setLibraryOpen(true)}>
            <BookOpen className="h-3.5 w-3.5 mr-1" />Library
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setRecipeOpen(true)}>
            <ChefHat className="h-3.5 w-3.5 mr-1" />Recipe
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSupplierItems(lines())}>
            <Mail className="h-3.5 w-3.5 mr-1" />Quote supplier
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportBOQ}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />BOQ
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSowOpen(true)}>
            <FileText className="h-3.5 w-3.5 mr-1" />Scope of work
          </Button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              {suggestions.length} item{suggestions.length !== 1 ? 's' : ''} from your takeoff {suggestions.length !== 1 ? 'are' : 'is'} not in the estimate yet.
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs" onClick={() => {
                const n = add(suggestions, true);
                toast.success(`${n} line${n !== 1 ? 's' : ''} added to the estimate`);
              }}>
                Add all
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                markTakeoffAdded(projectId, suggestions.map(s => s.id), true);
                setProject(readProject(projectId));
              }}>
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
                  <span className="rounded border border-amber-500/30 px-1 text-[9px] uppercase text-amber-400">Plan</span>
                )}
                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => add([s], true)}>Add</Button>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Dismiss"
                  onClick={() => { markTakeoffAdded(projectId, [s.id], true); setProject(readProject(projectId)); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <MaterialPickerDialog open={libraryOpen} onOpenChange={setLibraryOpen} onSelect={addFromLibrary} />
      <RecipePickerDialog
        open={recipeOpen}
        onOpenChange={setRecipeOpen}
        onAddCostItem={(item) => add([item])}
        selectedState={state}
      />
      <SupplierQuoteDialog
        open={supplierItems !== null}
        onClose={() => setSupplierItems(null)}
        items={supplierItems ?? []}
        projectName={project?.name}
        siteAddress={project?.site_address || project?.address}
      />
      <SOWGeneratorDialog
        open={sowOpen}
        onOpenChange={setSowOpen}
        costItems={sowOpen ? lines() : []}
        defaultProjectName={project?.name || ''}
      />
    </div>
  );
}
