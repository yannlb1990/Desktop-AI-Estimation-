import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Search, BookOpen, ChevronRight, Loader2, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

import { listAssemblies, listElementCategories, listTrades, getAssemblyWithComponents } from '@/lib/recipes/api';
import { explodeAssembly } from '@/lib/recipes/calcEngine';
import type { Assembly, AssemblyFilters, ElementCategory, TradeRecord } from '@/lib/recipes/types';
import type { CostItem } from '@/lib/takeoff/types';

interface RecipePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCostItem: (item: CostItem) => void;
  selectedState?: string;
}

const STATE_TO_REGION: Record<string, string> = {
  QLD: 'AU-QLD', NSW: 'AU-NSW', VIC: 'AU-VIC',
  WA:  'AU-WA',  SA:  'AU-SA',  TAS: 'AU-NAT',
  NT:  'AU-NAT', ACT: 'AU-NAT',
};

export function RecipePickerDialog({
  open,
  onOpenChange,
  onAddCostItem,
  selectedState = 'QLD',
}: RecipePickerDialogProps) {
  const region = STATE_TO_REGION[selectedState] ?? 'AU-NAT';

  // Lookup data
  const [categories, setCategories]   = useState<ElementCategory[]>([]);
  const [trades, setTrades]           = useState<TradeRecord[]>([]);
  const [assemblies, setAssemblies]   = useState<Assembly[]>([]);

  // Filters
  const [search, setSearch]           = useState('');
  const [categoryId, setCategoryId]   = useState<string>('all');
  const [tradeCode, setTradeCode]     = useState<string>('all');

  // Selection + config
  const [selected, setSelected]       = useState<Assembly | null>(null);
  const [measuredQty, setMeasuredQty] = useState<string>('');
  const [sides, setSides]             = useState(2);
  const [includeOptional, setIncludeOptional] = useState(true);

  // Loading
  const [loadingList, setLoadingList]   = useState(false);
  const [loadingAdd, setLoadingAdd]     = useState(false);

  // Load lookup data once on mount
  useEffect(() => {
    if (!open) return;
    Promise.all([listElementCategories(), listTrades()])
      .then(([cats, trs]) => { setCategories(cats); setTrades(trs); })
      .catch(() => toast.error('Failed to load recipe data'));
  }, [open]);

  // Load assemblies when filters change
  const loadAssemblies = useCallback(async () => {
    setLoadingList(true);
    try {
      const filters: AssemblyFilters = {
        status: 'published',
        categoryId: categoryId === 'all' ? undefined : categoryId,
        tradeCode:  tradeCode  === 'all' ? undefined : tradeCode,
        searchText: search || undefined,
      };
      setAssemblies(await listAssemblies(filters));
    } catch {
      toast.error('Failed to load assemblies');
    } finally {
      setLoadingList(false);
    }
  }, [categoryId, tradeCode, search]);

  useEffect(() => {
    if (open) loadAssemblies();
  }, [open, loadAssemblies]);

  // Reset selection when assembly changes
  useEffect(() => { setMeasuredQty(''); setSides(2); }, [selected]);

  const handleClose = () => {
    onOpenChange(false);
    setSelected(null);
    setSearch('');
    setCategoryId('all');
    setTradeCode('all');
  };

  const isWallAssembly = (a: Assembly) => a.uom === 'm2' &&
    categories.find(c => c.id === a.element_category_id)?.code.startsWith('WALL');

  const handleAdd = async () => {
    if (!selected) return;
    const qty = parseFloat(measuredQty);
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity'); return; }

    setLoadingAdd(true);
    try {
      const assembled = await getAssemblyWithComponents(selected.id, region);
      const items = explodeAssembly(
        assembled.assembly,
        assembled.components,
        assembled.costItems,
        assembled.trades,
        assembled.resolvedRates,
        qty,
        isWallAssembly(selected) ? sides : 1,
        includeOptional,
      );

      if (items.length === 0) {
        toast.error('No items produced. Check the assembly components and try again.');
        return;
      }

      items.forEach(item => onAddCostItem(item));
      toast.success(`${items.length} item${items.length > 1 ? 's' : ''} added from recipe`);
      handleClose();
    } catch {
      toast.error('Failed to explode recipe. Please try again.');
    } finally {
      setLoadingAdd(false);
    }
  };

  // Build category tree — only show roots + direct children (max 2 levels)
  const rootCats  = categories.filter(c => !c.parent_id);
  const childCats = categories.filter(c => !!c.parent_id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Pick from Recipe Library
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          /* ── Assembly list view ── */
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assemblies..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-2">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-8 text-xs">
                  <LayoutGrid className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="All elements" />
                </SelectTrigger>
                <SelectContent className="z-[10001]">
                  <SelectItem value="all">All elements</SelectItem>
                  {rootCats.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                  {childCats.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      &nbsp;&nbsp;{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tradeCode} onValueChange={setTradeCode}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All trades" />
                </SelectTrigger>
                <SelectContent className="z-[10001]">
                  <SelectItem value="all">All trades</SelectItem>
                  {trades.map(t => (
                    <SelectItem key={t.id} value={t.code}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assembly list */}
            <ScrollArea className="h-64">
              {loadingList ? (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-sm gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : assemblies.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No assemblies found.</p>
                </div>
              ) : (
                <div className="space-y-1 pr-2">
                  {assemblies.map(a => {
                    const cat = categories.find(c => c.id === a.element_category_id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelected(a)}
                        className="w-full text-left rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{a.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {cat?.name ?? '—'} · per {a.uom}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2 shrink-0">
                            {a.tags.slice(0, 2).map(tag => (
                              <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0">{tag}</Badge>
                            ))}
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          /* ── Config view after selecting an assembly ── */
          <div className="space-y-4">
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              ← Back to list
            </button>

            <div className="rounded-md border px-3 py-2 bg-muted/30">
              <p className="text-sm font-medium">{selected.name}</p>
              {selected.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {selected.description}
                </p>
              )}
            </div>

            {/* Quantity input */}
            <div className="space-y-1">
              <Label className="text-xs">
                Measured quantity ({selected.uom})
              </Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder={`e.g. 25`}
                value={measuredQty}
                onChange={e => setMeasuredQty(e.target.value)}
                autoFocus
              />
            </div>

            {/* Sides toggle — only for wall assemblies */}
            {isWallAssembly(selected) && (
              <div className="space-y-1">
                <Label className="text-xs">Sides lined (plasterboard)</Label>
                <div className="flex gap-2">
                  {[1, 2].map(n => (
                    <Button
                      key={n}
                      size="sm"
                      variant={sides === n ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setSides(n)}
                    >
                      {n === 1 ? '1 side' : '2 sides'}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Optional components toggle */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-xs text-muted-foreground">Include optional components (e.g. insulation)</span>
              <Switch
                checked={includeOptional}
                onCheckedChange={setIncludeOptional}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleAdd}
              disabled={!measuredQty || parseFloat(measuredQty) <= 0 || loadingAdd}
            >
              {loadingAdd
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</>
                : `Add to Estimator`
              }
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
