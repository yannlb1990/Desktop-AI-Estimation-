import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Upload, Download, Edit, Trash2, Star, Search } from "lucide-react";

interface CustomMaterial {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  unit: string;
  avg_price: number;
  supplier: string | null;
  notes: string | null;
}

export const PreferredPricingSection = () => {
  const [materials, setMaterials] = useState<CustomMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<CustomMaterial | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "Timber",
    subcategory: "",
    unit: "lm",
    avg_price: "",
    supplier: "",
    notes: "",
  });

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("custom_materials")
        .select("*")
        .eq("user_id", user.id)
        .order("category", { ascending: true });

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error("Error loading materials:", error);
      toast.error("Failed to load preferred pricing");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to add materials");
        return;
      }

      const { error } = await supabase
        .from("custom_materials")
        .insert({
          user_id: user.id,
          name: formData.name,
          category: formData.category,
          subcategory: formData.subcategory || null,
          unit: formData.unit,
          avg_price: parseFloat(formData.avg_price),
          supplier: formData.supplier || null,
          notes: formData.notes || null,
        });

      if (error) throw error;

      toast.success("Material added successfully");
      setIsAddDialogOpen(false);
      resetForm();
      loadMaterials();
    } catch (error) {
      console.error("Error adding material:", error);
      toast.error("Failed to add material");
    }
  };

  const handleUpdate = async () => {
    if (!editingMaterial) return;

    try {
      const { error } = await supabase
        .from("custom_materials")
        .update({
          name: formData.name,
          category: formData.category,
          subcategory: formData.subcategory || null,
          unit: formData.unit,
          avg_price: parseFloat(formData.avg_price),
          supplier: formData.supplier || null,
          notes: formData.notes || null,
        })
        .eq("id", editingMaterial.id);

      if (error) throw error;

      toast.success("Material updated successfully");
      setEditingMaterial(null);
      resetForm();
      loadMaterials();
    } catch (error) {
      console.error("Error updating material:", error);
      toast.error("Failed to update material");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this material?")) return;

    try {
      const { error } = await supabase
        .from("custom_materials")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Material deleted successfully");
      loadMaterials();
    } catch (error) {
      console.error("Error deleting material:", error);
      toast.error("Failed to delete material");
    }
  };

  const handleEdit = (material: CustomMaterial) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      category: material.category,
      subcategory: material.subcategory || "",
      unit: material.unit,
      avg_price: material.avg_price.toString(),
      supplier: material.supplier || "",
      notes: material.notes || "",
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "Timber",
      subcategory: "",
      unit: "lm",
      avg_price: "",
      supplier: "",
      notes: "",
    });
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n");
        const headers = lines[0].split(",").map(h => h.trim());

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Please sign in to upload materials");
          return;
        }

        const materialsToAdd = [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = lines[i].split(",").map(v => v.trim());
          materialsToAdd.push({
            user_id: user.id,
            name: values[0],
            category: values[1],
            subcategory: values[2] || null,
            unit: values[3],
            avg_price: parseFloat(values[4]),
            supplier: values[5] || null,
            notes: values[6] || null,
          });
        }

        const { error } = await supabase
          .from("custom_materials")
          .insert(materialsToAdd);

        if (error) throw error;

        toast.success(`Successfully imported ${materialsToAdd.length} materials`);
        loadMaterials();
      } catch (error) {
        console.error("Error importing CSV:", error);
        toast.error("Failed to import CSV. Please check format.");
      }
    };
    reader.readAsText(file);
  };

  const downloadCSVTemplate = () => {
    const template = "Name,Category,Subcategory,Unit,Price,Supplier,Notes\nExample Material,Timber,Structural,lm,5.50,Bunnings,Sample notes";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "material_template.csv";
    a.click();
  };

  const filteredMaterials = materials.filter((material) => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || material.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(materials.map(m => m.category)));

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Star className="h-6 w-6 text-accent" />
          <h2 className="text-2xl font-semibold text-foreground">Preferred Pricing</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadCSVTemplate}>
            <Download className="h-4 w-4 mr-2" />
            CSV Template
          </Button>
          <label htmlFor="csv-upload">
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </span>
            </Button>
          </label>
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCSVUpload}
          />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Material
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Custom Material</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Material Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., MGP10 90x45mm Pine"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Timber">Timber</SelectItem>
                        <SelectItem value="Plasterboard">Plasterboard</SelectItem>
                        <SelectItem value="Insulation">Insulation</SelectItem>
                        <SelectItem value="Roofing">Roofing</SelectItem>
                        <SelectItem value="Concrete">Concrete</SelectItem>
                        <SelectItem value="Fasteners">Fasteners</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Subcategory</Label>
                    <Input
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Unit</Label>
                    <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lm">LM (Linear Metre)</SelectItem>
                        <SelectItem value="m²">M² (Square Metre)</SelectItem>
                        <SelectItem value="m³">M³ (Cubic Metre)</SelectItem>
                        <SelectItem value="sheet">Sheet</SelectItem>
                        <SelectItem value="ea">EA (Each)</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                        <SelectItem value="kg">KG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Price (AUD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.avg_price}
                      onChange={(e) => setFormData({ ...formData, avg_price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <Label>Supplier (Optional)</Label>
                  <Input
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="e.g., Bunnings"
                  />
                </div>
                <div>
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional information..."
                    rows={3}
                  />
                </div>
                <Button onClick={handleAdd} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                  Add Material
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <p className="text-muted-foreground mb-6">
        Manage your custom material pricing. These rates will override market pricing in your estimates.
      </p>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredMaterials.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Preferred Materials Yet</h3>
          <p className="text-muted-foreground mb-4">
            Add your custom materials or import from CSV to get started
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell className="font-medium">{material.name}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{material.category}</div>
                      {material.subcategory && (
                        <div className="text-xs text-muted-foreground">{material.subcategory}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="uppercase text-xs">{material.unit}</TableCell>
                  <TableCell className="text-right font-mono">
                    ${material.avg_price.toFixed(2)}
                  </TableCell>
                  <TableCell>{material.supplier || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(material)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Edit Material</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Material Name</Label>
                              <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Category</Label>
                                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Timber">Timber</SelectItem>
                                    <SelectItem value="Plasterboard">Plasterboard</SelectItem>
                                    <SelectItem value="Insulation">Insulation</SelectItem>
                                    <SelectItem value="Roofing">Roofing</SelectItem>
                                    <SelectItem value="Concrete">Concrete</SelectItem>
                                    <SelectItem value="Fasteners">Fasteners</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Unit</Label>
                                <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="lm">LM</SelectItem>
                                    <SelectItem value="m²">M²</SelectItem>
                                    <SelectItem value="sheet">Sheet</SelectItem>
                                    <SelectItem value="ea">EA</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <Label>Price (AUD)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.avg_price}
                                onChange={(e) => setFormData({ ...formData, avg_price: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Supplier</Label>
                              <Input
                                value={formData.supplier}
                                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                              />
                            </div>
                            <Button onClick={handleUpdate} className="w-full">
                              Update Material
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(material.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
};
