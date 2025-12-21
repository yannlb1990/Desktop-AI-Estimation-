import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, Plus, Search, Download } from "lucide-react";
import { AUSTRALIAN_MATERIALS, getMaterialCategories } from "@/data/australianMaterials";
import { SCOPE_OF_WORK_RATES } from "@/data/scopeOfWorkRates";
import { MARKET_LABOUR_RATES } from "@/data/marketLabourRates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const MaterialsPricingSection = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    category: "",
    subcategory: "",
    unit: "",
    avgPrice: "",
    supplier: "",
    notes: ""
  });

  const categories = ["all", ...getMaterialCategories()];

  const filteredMaterials = AUSTRALIAN_MATERIALS.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.subcategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const exportComprehensiveCSV = () => {
    // Combine all data sources into one CSV
    let csvContent = "Type,Trade,Category,Item,Description,Unit,NSW Rate,VIC Rate,QLD Rate,Suppliers,Price Range,Notes\n";
    
    // Add materials
    AUSTRALIAN_MATERIALS.forEach(m => {
      const suppliers = m.suppliers.join(';');
      csvContent += `Material,General,${m.category},"${m.name}","${m.subcategory}",${m.unit},${m.avgPrice.toFixed(2)},${m.avgPrice.toFixed(2)},${m.avgPrice.toFixed(2)},"${suppliers}","${m.priceRange}",Avg price shown\n`;
    });
    
    // Add SOW rates
    SCOPE_OF_WORK_RATES.forEach(s => {
      csvContent += `SOW,${s.trade},${s.category},"${s.sow}","${s.description}",${s.unit},${s.NSW.toFixed(2)},${s.VIC.toFixed(2)},${s.QLD.toFixed(2)},-,-,Complete rate\n`;
    });
    
    // Add labour rates
    MARKET_LABOUR_RATES.forEach(l => {
      csvContent += `Labour,${l.trade},-,"${l.trade} Labour","Hourly labour rate",hr,${l.NSW.toFixed(2)},${l.VIC.toFixed(2)},${l.QLD.toFixed(2)},-,-,Market rate\n`;
    });

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Esti-mate_Comprehensive_Pricing_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${AUSTRALIAN_MATERIALS.length + SCOPE_OF_WORK_RATES.length + MARKET_LABOUR_RATES.length} items to CSV`);
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.name || !newMaterial.category || !newMaterial.unit || !newMaterial.avgPrice) {
      toast.error("Please fill in all required fields");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to add custom materials");
      return;
    }

    const { error } = await supabase.from('custom_materials').insert({
      user_id: user.id,
      name: newMaterial.name,
      category: newMaterial.category,
      subcategory: newMaterial.subcategory || newMaterial.category,
      unit: newMaterial.unit,
      avg_price: parseFloat(newMaterial.avgPrice),
      supplier: newMaterial.supplier,
      notes: newMaterial.notes
    });

    if (error) {
      toast.error("Failed to add material");
      console.error(error);
      return;
    }

    toast.success("Material added successfully");
    setShowAddDialog(false);
    setNewMaterial({ name: "", category: "", subcategory: "", unit: "", avgPrice: "", supplier: "", notes: "" });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-accent" />
          <h3 className="font-display text-xl font-bold">Materials Pricing</h3>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportComprehensiveCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export All Data (CSV)
          </Button>
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Material
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Current market prices for building materials across Australia (500+ items)
      </p>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search materials by name, category, or subcategory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid grid-cols-5 lg:grid-cols-10 w-full mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.slice(1).map(cat => (
            <TabsTrigger key={cat} value={cat} className="text-xs">
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-semibold">Category</th>
                  <th className="text-left py-3 px-2 font-semibold">Material</th>
                  <th className="text-center py-3 px-2 font-semibold">Unit</th>
                  <th className="text-right py-3 px-2 font-semibold">Price Range</th>
                  <th className="text-right py-3 px-2 font-semibold">Avg Price</th>
                  <th className="text-center py-3 px-2 font-semibold">Suppliers</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.slice(0, 100).map((item, idx) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-3 px-2 text-muted-foreground text-xs">{item.subcategory}</td>
                    <td className="py-3 px-2 font-medium">{item.name}</td>
                    <td className="py-3 px-2 text-center text-muted-foreground">{item.unit}</td>
                    <td className="py-3 px-2 text-right text-muted-foreground text-xs">{item.priceRange}</td>
                    <td className="py-3 px-2 text-right font-mono font-bold">${item.avgPrice.toFixed(2)}</td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {item.suppliers.map(s => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredMaterials.length > 100 && (
              <p className="text-sm text-muted-foreground mt-3 text-center">
                Showing 100 of {filteredMaterials.length} results. Refine your search to see more.
              </p>
            )}
            {filteredMaterials.length === 0 && (
              <p className="text-sm text-muted-foreground mt-3 text-center py-8">
                No materials found. Try a different search term or category.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Material</DialogTitle>
            <DialogDescription>
              Add a material with your own pricing to track project-specific costs.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Material Name *</Label>
              <Input
                id="name"
                value={newMaterial.name}
                onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                placeholder="e.g., Premium Pine Timber"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={newMaterial.category}
                  onChange={(e) => setNewMaterial({ ...newMaterial, category: e.target.value })}
                  placeholder="e.g., Timber"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subcategory">Subcategory</Label>
                <Input
                  id="subcategory"
                  value={newMaterial.subcategory}
                  onChange={(e) => setNewMaterial({ ...newMaterial, subcategory: e.target.value })}
                  placeholder="e.g., Structural Timber"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Input
                  id="unit"
                  value={newMaterial.unit}
                  onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                  placeholder="e.g., lm, m², sheet"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="avgPrice">Avg Price ($) *</Label>
                <Input
                  id="avgPrice"
                  type="number"
                  step="0.01"
                  value={newMaterial.avgPrice}
                  onChange={(e) => setNewMaterial({ ...newMaterial, avgPrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={newMaterial.supplier}
                onChange={(e) => setNewMaterial({ ...newMaterial, supplier: e.target.value })}
                placeholder="e.g., Bunnings, Mitre 10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={newMaterial.notes}
                onChange={(e) => setNewMaterial({ ...newMaterial, notes: e.target.value })}
                placeholder="Additional information..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMaterial}>
              Add Material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
