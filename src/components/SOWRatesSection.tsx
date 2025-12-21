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
import { Wrench, Plus, Search, List, Grid3x3, BookOpen, ExternalLink } from "lucide-react";
import { SCOPE_OF_WORK_RATES, getSOWCategories } from "@/data/scopeOfWorkRates";
import { lookupNCCForSOW } from "@/lib/nccLookup";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type State = "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";

export const SOWRatesSection = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState<State>("NSW");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "grouped">("table");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSOW, setNewSOW] = useState({
    trade: "",
    sowName: "",
    description: "",
    unit: "",
    rate: "",
    state: "NSW"
  });

  const categories = ["all", ...getSOWCategories()];

  const filteredSOW = SCOPE_OF_WORK_RATES.filter(item => {
    const matchesSearch = 
      item.sow.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.trade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group SOW items by trade
  const groupedByTrade = filteredSOW.reduce((acc, item) => {
    if (!acc[item.trade]) {
      acc[item.trade] = [];
    }
    acc[item.trade].push(item);
    return acc;
  }, {} as Record<string, typeof SCOPE_OF_WORK_RATES>);

  const getRate = (item: typeof SCOPE_OF_WORK_RATES[0]): number => {
    // Access rate directly using state as key (new data structure)
    const rate = item[selectedState];
    return typeof rate === 'number' ? rate : 0;
  };

  // Cache NCC lookups for performance
  const nccLookupCache = useMemo(() => {
    const cache: Record<string, ReturnType<typeof lookupNCCForSOW>> = {};
    SCOPE_OF_WORK_RATES.forEach(item => {
      cache[item.id] = lookupNCCForSOW(item.sow, item.category, item.description);
    });
    return cache;
  }, []);

  const NCCBadge = ({ item }: { item: typeof SCOPE_OF_WORK_RATES[0] }) => {
    const lookup = nccLookupCache[item.id];
    if (!lookup || !lookup.primaryCode) return <span className="text-muted-foreground text-xs">-</span>;

    const primaryRef = lookup.references[0];

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs font-mono bg-blue-100 text-blue-800 hover:bg-blue-200"
              onClick={() => primaryRef?.url && window.open(primaryRef.url, '_blank')}
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

  const handleAddSOW = async () => {
    if (!newSOW.trade || !newSOW.sowName || !newSOW.unit || !newSOW.rate) {
      toast.error("Please fill in all required fields");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to add custom SOW rates");
      return;
    }

    const { error } = await supabase.from('custom_sow_rates').insert({
      user_id: user.id,
      trade: newSOW.trade,
      sow_name: newSOW.sowName,
      description: newSOW.description,
      unit: newSOW.unit,
      rate: parseFloat(newSOW.rate),
      state: newSOW.state
    });

    if (error) {
      toast.error("Failed to add SOW rate");
      console.error(error);
      return;
    }

    toast.success("SOW rate added successfully");
    setShowAddDialog(false);
    setNewSOW({ trade: "", sowName: "", description: "", unit: "", rate: "", state: "NSW" });
  };

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-accent flex-shrink-0" />
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">Scope of Work Rates</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Market rates for common construction scopes across Australia
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 whitespace-nowrap">
          <Plus className="h-4 w-4 mr-2" />
          Add Custom SOW
        </Button>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search scope of work..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={selectedState} onValueChange={(value) => setSelectedState(value as State)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NSW">NSW Pricing</SelectItem>
                <SelectItem value="VIC">VIC Pricing</SelectItem>
                <SelectItem value="QLD">QLD Pricing</SelectItem>
                <SelectItem value="SA">SA Pricing</SelectItem>
                <SelectItem value="WA">WA Pricing</SelectItem>
                <SelectItem value="TAS">TAS Pricing</SelectItem>
                <SelectItem value="NT">NT Pricing</SelectItem>
                <SelectItem value="ACT">ACT Pricing</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="rounded-r-none"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grouped" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grouped")}
                className="rounded-l-none"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
          <TabsList className="w-full flex flex-wrap justify-start h-auto gap-2 bg-transparent p-0">
            {categories.map((cat) => (
              <TabsTrigger 
                key={cat} 
                value={cat} 
                className="capitalize text-xs sm:text-sm px-3 py-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
              >
                {cat === "all" ? "All" : cat}
              </TabsTrigger>
            ))}
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
                    <TableHead className="min-w-[80px]">Unit</TableHead>
                    <TableHead className="text-right min-w-[100px]">{selectedState} Rate</TableHead>
                    <TableHead className="min-w-[90px]">NCC Code</TableHead>
                    <TableHead className="min-w-[100px]">Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSOW.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        No items found. Try adjusting your search or filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSOW.map((item, index) => (
                      <TableRow key={index} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{item.trade}</TableCell>
                        <TableCell className="font-medium">{item.sow}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.description}</TableCell>
                        <TableCell className="uppercase text-xs font-mono">{item.unit}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          ${getRate(item).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <NCCBadge item={item} />
                        </TableCell>
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
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredSOW.length} of {SCOPE_OF_WORK_RATES.length} items
          </div>
        </>
      ) : (
        <Accordion type="multiple" className="w-full">
          {Object.entries(groupedByTrade).map(([trade, items]) => {
            const avgRate = items.reduce((sum, item) => sum + getRate(item), 0) / items.length;
            const minRate = Math.min(...items.map(getRate));
            const maxRate = Math.max(...items.map(getRate));
            
            return (
              <AccordionItem key={trade} value={trade}>
                <AccordionTrigger className="hover:bg-muted/50 px-4">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{trade}</span>
                      <Badge variant="secondary">{items.length} items</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Avg: ${avgRate.toFixed(2)} | Range: ${minRate.toFixed(2)} - ${maxRate.toFixed(2)}
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
                          <TableHead className="text-right">{selectedState} Rate</TableHead>
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
                            <TableCell>
                              <NCCBadge item={item} />
                            </TableCell>
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

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom SOW Rate</DialogTitle>
            <DialogDescription>
              Add your own custom scope of work rate for {newSOW.state}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Trade</Label>
              <Input
                value={newSOW.trade}
                onChange={(e) => setNewSOW({ ...newSOW, trade: e.target.value })}
                placeholder="e.g., Carpenter"
              />
            </div>
            <div>
              <Label>Scope of Work Name</Label>
              <Input
                value={newSOW.sowName}
                onChange={(e) => setNewSOW({ ...newSOW, sowName: e.target.value })}
                placeholder="e.g., Wall Framing"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={newSOW.description}
                onChange={(e) => setNewSOW({ ...newSOW, description: e.target.value })}
                placeholder="Detailed description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unit</Label>
                <Select value={newSOW.unit} onValueChange={(value) => setNewSOW({ ...newSOW, unit: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lm">LM (Linear Metre)</SelectItem>
                    <SelectItem value="m²">M² (Square Metre)</SelectItem>
                    <SelectItem value="m³">M³ (Cubic Metre)</SelectItem>
                    <SelectItem value="ea">EA (Each)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rate (AUD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newSOW.rate}
                  onChange={(e) => setNewSOW({ ...newSOW, rate: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label>State</Label>
              <Select value={newSOW.state} onValueChange={(value) => setNewSOW({ ...newSOW, state: value })}>
                <SelectTrigger>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSOW} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Add SOW Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
