import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Wrench, Plus, Search, List, Grid3x3, BookOpen, ExternalLink, X } from "lucide-react";
import { SCOPE_OF_WORK_RATES, getSOWCategories } from "@/data/scopeOfWorkRates";
import { lookupNCCForSOW } from "@/lib/nccLookup";
import { toast } from "sonner";

type State = "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";

const CUSTOM_KEY = "custom_sow_rates";

interface CustomSOW {
  id: string;
  trade: string;
  sow: string;
  description: string;
  unit: string;
  rate: number;
  state: State;
  category: string;
  // Mirror the shape of SCOPE_OF_WORK_RATES entries for display
  NSW: number; VIC: number; QLD: number; SA: number;
  WA: number; TAS: number; NT: number; ACT: number;
  isCustom: true;
}

function loadCustomSOWs(): CustomSOW[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]"); }
  catch { return []; }
}

function saveCustomSOWs(items: CustomSOW[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(items));
}

interface Props {
  selectedState?: State;
}

export const SOWRatesSection = ({ selectedState: propState }: Props) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "grouped">("table");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [customSOWs, setCustomSOWs] = useState<CustomSOW[]>(loadCustomSOWs);
  const [newSOW, setNewSOW] = useState({
    trade: "", sowName: "", description: "", unit: "", rate: "", category: "Framing",
  });

  // Use prop state if provided, otherwise fall back to own selector
  const [ownState, setOwnState] = useState<State>("NSW");
  const selectedState: State = propState ?? ownState;

  const categories = ["all", ...getSOWCategories()];

  // Merge built-in + custom into a single list
  const allSOW = useMemo(() => {
    return [...SCOPE_OF_WORK_RATES, ...customSOWs];
  }, [customSOWs]);

  const filteredSOW = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return allSOW.filter(item => {
      const matchesSearch =
        item.sow.toLowerCase().includes(q) ||
        item.trade.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allSOW, searchTerm, selectedCategory]);

  // Counts per category for badge display
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allSOW.length };
    allSOW.forEach(item => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [allSOW]);

  // Group SOW items by trade
  const groupedByTrade = useMemo(() =>
    filteredSOW.reduce((acc, item) => {
      if (!acc[item.trade]) acc[item.trade] = [];
      acc[item.trade].push(item);
      return acc;
    }, {} as Record<string, typeof filteredSOW>),
  [filteredSOW]);

  const getRate = (item: typeof allSOW[0]): number => {
    const rate = (item as any)[selectedState];
    return typeof rate === "number" ? rate : 0;
  };

  // Cache NCC lookups
  const nccLookupCache = useMemo(() => {
    const cache: Record<string, ReturnType<typeof lookupNCCForSOW>> = {};
    SCOPE_OF_WORK_RATES.forEach(item => {
      cache[item.id] = lookupNCCForSOW(item.sow, item.category, item.description);
    });
    return cache;
  }, []);

  const NCCBadge = ({ item }: { item: typeof allSOW[0] }) => {
    if ((item as any).isCustom) return <span className="text-muted-foreground text-xs">Custom</span>;
    const lookup = nccLookupCache[item.id];
    if (!lookup || !lookup.primaryCode) return <span className="text-muted-foreground text-xs">—</span>;
    const primaryRef = lookup.references[0];
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost" size="sm"
              className="h-6 px-2 text-xs font-mono bg-blue-100 text-blue-800 hover:bg-blue-200"
              onClick={() => primaryRef?.url && window.open(primaryRef.url, "_blank")}
            >
              <BookOpen className="h-3 w-3 mr-1" />
              {lookup.primaryCode}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-sm">
            <div className="space-y-2">
              <p className="font-semibold">{primaryRef?.title}</p>
              <p className="text-xs text-muted-foreground">{primaryRef?.description}</p>
              {lookup.references.length > 1 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium mb-1">Related codes:</p>
                  {lookup.references.slice(1).map(ref => (
                    <span key={ref.id} className="text-xs mr-2">{ref.id}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Click to view NCC reference
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const handleAddSOW = () => {
    if (!newSOW.trade || !newSOW.sowName || !newSOW.unit || !newSOW.rate) {
      toast.error("Please fill in all required fields");
      return;
    }
    const rate = parseFloat(newSOW.rate);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Rate must be a positive number");
      return;
    }
    const entry: CustomSOW = {
      id: crypto.randomUUID(),
      trade: newSOW.trade,
      sow: newSOW.sowName,
      description: newSOW.description,
      unit: newSOW.unit,
      rate,
      state: selectedState,
      category: newSOW.category,
      // Apply same rate to all states for simplicity
      NSW: rate, VIC: rate, QLD: rate, SA: rate,
      WA: rate, TAS: rate, NT: rate, ACT: rate,
      isCustom: true,
    };
    const updated = [...customSOWs, entry];
    setCustomSOWs(updated);
    saveCustomSOWs(updated);
    toast.success("Custom SOW rate added");
    setShowAddDialog(false);
    setNewSOW({ trade: "", sowName: "", description: "", unit: "", rate: "", category: "Framing" });
  };

  const SOW_CATEGORIES = ["Framing", "External", "Fit Out", "First Fix", "Structure", "Lining",
    "Finishing", "Footings", "Roofing", "Landscaping", "Insulation", "Waterproofing",
    "Demolition", "Preliminaries"];

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-accent flex-shrink-0" />
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">Scope of Work Rates</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Market rates for common construction scopes — {selectedState}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm"
          className="bg-accent text-accent-foreground hover:bg-accent/90 whitespace-nowrap">
          <Plus className="h-4 w-4 mr-2" />Add Custom SOW
        </Button>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search with clear button */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search scope of work..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-9"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Only show state selector if not driven by prop */}
          {!propState && (
            <Select value={ownState} onValueChange={(v) => setOwnState(v as State)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["NSW","VIC","QLD","SA","WA","TAS","NT","ACT"] as State[]).map(s => (
                  <SelectItem key={s} value={s}>{s} Pricing</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* View toggle */}
          <div className="flex border rounded-md">
            <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm"
              onClick={() => setViewMode("table")} className="rounded-r-none">
              <List className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "grouped" ? "default" : "ghost"} size="sm"
              onClick={() => setViewMode("grouped")} className="rounded-l-none">
              <Grid3x3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Category tabs with counts */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="w-full flex flex-wrap justify-start h-auto gap-1.5 bg-transparent p-0">
            {categories.map((cat) => {
              const count = categoryCounts[cat] ?? 0;
              return (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="capitalize text-xs sm:text-sm px-3 py-1.5 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-1.5"
                >
                  {cat === "all" ? "All" : cat}
                  <span className={`text-[10px] px-1.5 py-0 rounded-full font-medium leading-4 ${
                    selectedCategory === cat
                      ? "bg-accent-foreground/20 text-accent-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>{count}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {viewMode === "table" ? (
        <>
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Trade</TableHead>
                    <TableHead className="min-w-[180px]">Scope of Work</TableHead>
                    <TableHead className="min-w-[250px]">Description</TableHead>
                    <TableHead className="min-w-[70px]">Unit</TableHead>
                    <TableHead className="text-right min-w-[90px]">Rate</TableHead>
                    <TableHead className="min-w-[90px]">NCC Code</TableHead>
                    <TableHead className="min-w-[100px]">Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSOW.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        {searchTerm
                          ? <>No items match "<strong>{searchTerm}</strong>" — <button className="text-primary underline" onClick={() => setSearchTerm("")}>clear search</button></>
                          : "No items found. Try adjusting your filters."
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSOW.map((item, index) => (
                      <TableRow key={index} className={`hover:bg-muted/50 transition-colors ${(item as any).isCustom ? "bg-accent/5" : ""}`}>
                        <TableCell className="font-medium">
                          {item.trade}
                          {(item as any).isCustom && <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">Custom</Badge>}
                        </TableCell>
                        <TableCell className="font-medium">{item.sow}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.description}</TableCell>
                        <TableCell className="uppercase text-xs font-mono">{item.unit}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          ${getRate(item).toFixed(2)}
                        </TableCell>
                        <TableCell><NCCBadge item={item} /></TableCell>
                        <TableCell>
                          <span className="inline-block px-2 py-1 text-xs bg-accent/20 text-accent-foreground rounded-md">
                            {item.category}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {filteredSOW.length} of {allSOW.length} items</span>
            {customSOWs.length > 0 && (
              <span className="text-xs">{customSOWs.length} custom rate{customSOWs.length !== 1 ? "s" : ""} added</span>
            )}
          </div>
        </>
      ) : (
        <Accordion type="multiple" className="w-full">
          {Object.entries(groupedByTrade).map(([trade, items]) => {
            const rates = items.map(getRate).filter(r => r > 0);
            const avgRate = rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
            const minRate = rates.length ? Math.min(...rates) : 0;
            const maxRate = rates.length ? Math.max(...rates) : 0;
            return (
              <AccordionItem key={trade} value={trade}>
                <AccordionTrigger className="hover:bg-muted/50 px-4">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{trade}</span>
                      <Badge variant="secondary">{items.length} items</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Avg: ${avgRate.toFixed(2)} · Range: ${minRate.toFixed(2)}–${maxRate.toFixed(2)}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-4 pb-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Scope of Work</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-center">Unit</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead>NCC Code</TableHead>
                          <TableHead>Category</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.sow}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.description}</TableCell>
                            <TableCell className="text-center uppercase text-xs font-mono">{item.unit}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">${getRate(item).toFixed(2)}</TableCell>
                            <TableCell><NCCBadge item={item} /></TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{item.category}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Add Custom SOW Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom SOW Rate</DialogTitle>
            <DialogDescription>
              Add your own rate for {selectedState} — it will appear in the table immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Trade *</Label>
                <Input value={newSOW.trade}
                  onChange={(e) => setNewSOW({ ...newSOW, trade: e.target.value })}
                  placeholder="e.g., Carpenter" />
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={newSOW.category} onValueChange={(v) => setNewSOW({ ...newSOW, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOW_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Scope of Work Name *</Label>
              <Input value={newSOW.sowName}
                onChange={(e) => setNewSOW({ ...newSOW, sowName: e.target.value })}
                placeholder="e.g., Wall Framing 90mm" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={newSOW.description}
                onChange={(e) => setNewSOW({ ...newSOW, description: e.target.value })}
                placeholder="Brief description of what's included" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unit *</Label>
                <Select value={newSOW.unit} onValueChange={(v) => setNewSOW({ ...newSOW, unit: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lm">LM – Linear Metre</SelectItem>
                    <SelectItem value="m²">m² – Square Metre</SelectItem>
                    <SelectItem value="m³">m³ – Cubic Metre</SelectItem>
                    <SelectItem value="ea">ea – Each</SelectItem>
                    <SelectItem value="hr">hr – Hour</SelectItem>
                    <SelectItem value="allow">allow – Allowance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rate (AUD) *</Label>
                <Input type="number" step="0.01" min="0"
                  value={newSOW.rate}
                  onChange={(e) => setNewSOW({ ...newSOW, rate: e.target.value })}
                  placeholder="0.00" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddSOW} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Add Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
