import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronRight, DollarSign, Edit2, Save, X, Link, Copy, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { PreliminariesSection } from "./PreliminariesSection";
import { NCCSearchBar } from "./NCCSearchBar";
import { LabourRatesSection } from "./LabourRatesSection";
import { PricingHistory } from "./PricingHistory";
import { CustomMaterialDialog } from "./CustomMaterialDialog";

const AU_TRADES = [
  "Carpenter", "Plumber", "Electrician", "Bricklayer", "Plasterer",
  "Painter", "Tiler", "Concreter", "Roofer", "Landscaper"
];

const SCOPE_OF_WORK = {
  Carpenter: ["Framing", "Fix out", "Cladding", "Decking", "Stairs"],
  Plumber: ["Rough-in", "Fix out", "Drainage", "Gas"],
  Electrician: ["Rough-in", "Fit-off", "Solar", "Data"],
  Bricklayer: ["External walls", "Fencing", "Paving"],
  Plasterer: ["Internal walls", "Ceilings", "Cornice"],
  Painter: ["Interior", "Exterior", "Preparation"],
  Tiler: ["Floor tiling", "Wall tiling", "Splashbacks"],
  Concreter: ["Footings", "Slab", "Driveway", "Paths"],
  Roofer: ["Roof frame", "Tiles/Metal", "Gutters", "Flashings"],
  Landscaper: ["Retaining walls", "Fencing", "Gardens", "Paving"]
};

// Related materials for each scope of work
const SOW_RELATED_MATERIALS: Record<string, string[]> = {
  "Cladding": ["Sarking/Building wrap", "Clouts/Nails", "Adhesive/Glue", "Flashings", "Corner trims", "J-mould"],
  "Framing": ["Noggins", "Bracing straps", "Nails/Screws", "Treated timber bottom plate", "Galv straps"],
  "Roof frame": ["Hurricane ties", "Nails/Screws", "Gal straps", "Ridge capping", "Bracing"],
  "Tiles/Metal": ["Sarking", "Battens", "Screws/Clips", "Ridge caps", "Valley irons", "Flashings"],
  "Internal walls": ["Adhesive", "Screws", "Cornice cement", "Joint compound", "Paper tape"],
  "Ceilings": ["Adhesive", "Screws", "Battens", "Cornice cement", "Joint compound"],
  "Floor tiling": ["Adhesive", "Grout", "Waterproofing membrane", "Tile spacers", "Movement joints"],
  "Wall tiling": ["Adhesive", "Grout", "Waterproofing", "Tile spacers", "Corner trims"],
  "Interior": ["Undercoat", "Primer sealer", "Topcoat", "Fillers", "Sandpaper", "Drop sheets"],
  "Exterior": ["Undercoat", "Primer sealer", "Topcoat", "Fillers", "Sandpaper", "Masking tape"],
  "Slab": ["Plastic sheeting", "Rebar/Mesh", "Spacers", "Expansion joints", "Curing compound"],
  "Footings": ["Rebar", "Spacers", "Formwork timber", "Tie wire"],
  "Rough-in": ["Glue", "Clips", "Brackets", "Straps", "Tape"],
  "Fix out": ["Silicone", "Thread tape", "Brackets", "Screws"],
  "Drainage": ["Glue", "Clips", "Inspection openings", "Junction boxes"],
  "Fit-off": ["Cable ties", "Junction boxes", "Connectors", "Tape"],
  "Solar": ["MC4 connectors", "Cable clips", "Junction boxes", "Conduit"],
  "External walls": ["Mortar", "Wall ties", "Damp proof course", "Weep holes"],
  "Decking": ["Screws/Hidden fixings", "Joist hangers", "Post anchors", "Bracing"],
  "Stairs": ["Bolts", "Brackets", "Handrail brackets", "Balustrade fixings"]
};

const CONSUMABLES = [
  "Saw blades - Circular", "Saw blades - Jigsaw", "Saw blades - Reciprocating",
  "Drill bits - HSS", "Drill bits - Masonry", "Drill bits - Spade",
  "Screwdriver bits - Phillips", "Screwdriver bits - Flat", "Screwdriver bits - Torx",
  "Cutting discs - Metal", "Cutting discs - Masonry", "Grinding discs",
  "Sandpaper - 80 grit", "Sandpaper - 120 grit", "Sandpaper - 240 grit",
  "Pencils/Markers", "Chalk lines", "Measuring tape",
  "Safety glasses", "Gloves - Work", "Gloves - Chemical resistant",
  "Dust masks", "Ear plugs", "Hard hats",
  "Drop sheets", "Masking tape", "Duct tape",
  "Rags/Cloths", "Cleaning solvent", "WD-40",
  "Wire brushes", "Paint brushes - Disposable", "Paint rollers",
  "Caulking gun tips", "Grease gun cartridges", "Extension cords"
];

interface RelatedMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  comment: string;
  url: string;
  confirmed: boolean;
}

interface EstimateItem {
  id: string;
  section_id: string | null;
  area: string;
  trade: string;
  scope_of_work: string;
  material_type: string;
  quantity: number;
  unit: string;
  unit_price: number;
  labour_hours: number;
  labour_rate: number;
  material_wastage_pct: number;
  labour_wastage_pct: number;
  markup_pct: number;
  notes: string;
  expanded: boolean;
  item_number?: string;
  isEditing?: boolean;
  product_url?: string;
  relatedMaterials?: RelatedMaterial[];
}

interface ConsumableItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

interface EstimateTemplateProps {
  projectId: string;
  estimateId?: string;
}

export const EstimateTemplate = ({ projectId, estimateId }: EstimateTemplateProps) => {
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [consumables, setConsumables] = useState<ConsumableItem[]>([]);
  const [overheadTotal, setOverheadTotal] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<EstimateItem>>({});
  const [showCustomMaterialDialog, setShowCustomMaterialDialog] = useState(false);
  const [newConsumable, setNewConsumable] = useState({ name: "", quantity: "", unit: "ea", unit_price: "" });
  const [urlDialog, setUrlDialog] = useState<{ open: boolean; url: string; type: 'item' | 'related'; itemId?: string; materialId?: string }>({ 
    open: false, url: "", type: 'item' 
  });
  const [labourRates, setLabourRates] = useState<Record<string, number>>({
    Carpenter: 90,
    Plumber: 95,
    Electrician: 100,
    Bricklayer: 85,
    Plasterer: 80,
    Painter: 75,
    Tiler: 85,
    Concreter: 90,
    Roofer: 95,
    Landscaper: 80
  });
  const [config, setConfig] = useState({
    defaultLabourRate: 90,
    materialWastage: 10,
    labourWastage: 5,
    contingencyPct: 5,
    defaultMarkup: 20,
    supervisionPct: 8,
    overheadPct: 12,
    marginPct: 15,
    gstPct: 10
  });
  const [customConfigs, setCustomConfigs] = useState<{ id: string; name: string; value: number }[]>([]);
  const [newCustomConfig, setNewCustomConfig] = useState({ name: "", value: "" });
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    loadOverheads();
  }, [projectId]);

  const loadOverheads = async () => {
    const { data } = await supabase
      .from("overhead_items")
      .select("amount")
      .eq("project_id", projectId);
    
    if (data) {
      const total = data.reduce((sum, item) => sum + item.amount, 0);
      setOverheadTotal(total);
    }
  };

  const [newItem, setNewItem] = useState({
    area: "",
    trade: "",
    scope_of_work: "",
    material_type: "",
    quantity: "",
    unit: "m²",
    unit_price: "",
    labour_hours: "",
  });

  useEffect(() => {
    if (estimateId) loadItems();
  }, [estimateId]);

  const loadItems = async () => {
    if (!estimateId) return;

    const { data, error } = await supabase
      .from("estimate_items")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("created_at");

    if (error) {
      console.error("Load error:", error);
      toast.error("Failed to load items");
      return;
    }

    if (data) {
      const mappedItems = data.map((item: any, index: number) => {
        // Generate item number based on trade grouping
        const tradeItems = data.filter((i: any) => i.category === item.category);
        const tradeIndex = tradeItems.findIndex((i: any) => i.id === item.id);
        const tradeNumber = data.filter((i: any, idx: number) => idx < index && i.category !== item.category)
          .reduce((acc: any, curr: any) => {
            if (!acc.includes(curr.category)) acc.push(curr.category);
            return acc;
          }, []).length + 1;
        const itemNumber = `${tradeNumber}.${tradeIndex + 1}`;

        return {
          id: item.id,
          section_id: item.section_id,
          area: item.description?.split(" - ")[0] || "",
          trade: item.category || "",
          scope_of_work: item.item_type || "",
          material_type: item.description?.split(" - ")[1] || item.description || "",
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit || "m²",
          unit_price: parseFloat(item.unit_price) || 0,
          labour_hours: parseFloat(item.labour_hours) || 0,
          labour_rate: parseFloat(item.labour_rate) || config.defaultLabourRate,
          material_wastage_pct: parseFloat(item.material_wastage_pct) || config.materialWastage,
          labour_wastage_pct: parseFloat(item.labour_wastage_pct) || config.labourWastage,
          markup_pct: item.markup_pct !== null && item.markup_pct !== undefined ? parseFloat(item.markup_pct) : config.defaultMarkup,
          notes: "",
          expanded: false,
          item_number: itemNumber,
          isEditing: false
        };
      });
      setItems(mappedItems);
    }
  };

  const addItem = async () => {
    if (!newItem.area || !newItem.trade || !newItem.material_type) {
      toast.error("Please fill in required fields");
      return;
    }

    if (!estimateId) {
      toast.error("No estimate found");
      return;
    }

    const qty = parseFloat(newItem.quantity) || 0;
    const unitPrice = parseFloat(newItem.unit_price) || 0;
    const labourHrs = parseFloat(newItem.labour_hours) || 0;

    if (qty === 0 || unitPrice === 0) {
      toast.error("Quantity and unit price must be greater than 0");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("estimate_items").insert({
      estimate_id: estimateId,
      category: newItem.trade,
      item_type: newItem.scope_of_work,
      description: `${newItem.area} - ${newItem.material_type}`,
      quantity: qty,
      unit: newItem.unit,
      unit_price: unitPrice,
      total_price: 0, // Will be calculated on load
      labour_hours: labourHrs,
      labour_rate: config.defaultLabourRate,
      material_wastage_pct: config.materialWastage,
      labour_wastage_pct: config.labourWastage,
    });

    if (error) {
      console.error("Insert error:", error);
      toast.error("Failed to add item: " + error.message);
      return;
    }

    toast.success("Item added successfully");
    setNewItem({
      area: "",
      trade: "",
      scope_of_work: "",
      material_type: "",
      quantity: "",
      unit: "m²",
      unit_price: "",
      labour_hours: "",
    });
    await loadItems();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("estimate_items").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Item deleted");
    loadItems();
  };

  const startEditing = (item: EstimateItem) => {
    setEditingId(item.id);
    setEditValues({
      quantity: item.quantity,
      unit_price: item.unit_price,
      labour_hours: item.labour_hours,
      labour_rate: item.labour_rate,
      material_wastage_pct: item.material_wastage_pct,
      labour_wastage_pct: item.labour_wastage_pct,
      markup_pct: item.markup_pct,
      material_type: item.material_type,
      area: item.area
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from("estimate_items")
      .update({
        quantity: editValues.quantity,
        unit_price: editValues.unit_price,
        labour_hours: editValues.labour_hours,
        labour_rate: editValues.labour_rate,
        material_wastage_pct: editValues.material_wastage_pct,
        labour_wastage_pct: editValues.labour_wastage_pct,
        markup_pct: editValues.markup_pct,
        description: `${editValues.area} - ${editValues.material_type}`
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update item");
      return;
    }

    toast.success("Item updated");
    setEditingId(null);
    setEditValues({});
    loadItems();
  };

  const toggleExpanded = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, expanded: !item.expanded } : item
    ));
  };

  const addRelatedMaterial = (itemId: string, materialName: string) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const newMaterial: RelatedMaterial = {
          id: Math.random().toString(),
          name: materialName,
          quantity: 0,
          unit: "ea",
          unit_price: 0,
          comment: "",
          url: "",
          confirmed: false
        };
        return {
          ...item,
          relatedMaterials: [...(item.relatedMaterials || []), newMaterial]
        };
      }
      return item;
    }));
  };

  const updateRelatedMaterial = (itemId: string, materialId: string, field: keyof RelatedMaterial, value: any) => {
    setItems(items.map(item => {
      if (item.id === itemId && item.relatedMaterials) {
        return {
          ...item,
          relatedMaterials: item.relatedMaterials.map(rm => 
            rm.id === materialId ? { ...rm, [field]: value } : rm
          )
        };
      }
      return item;
    }));
  };

  const deleteRelatedMaterial = (itemId: string, materialId: string) => {
    setItems(items.map(item => {
      if (item.id === itemId && item.relatedMaterials) {
        return {
          ...item,
          relatedMaterials: item.relatedMaterials.filter(rm => rm.id !== materialId)
        };
      }
      return item;
    }));
  };

  const toggleRelatedMaterialConfirmed = (itemId: string, materialId: string) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          relatedMaterials: item.relatedMaterials?.map(rm =>
            rm.id === materialId ? { ...rm, confirmed: !rm.confirmed } : rm
          )
        };
      }
      return item;
    }));
  };

  const openUrlDialog = (type: 'item' | 'related', itemId: string, materialId?: string) => {
    if (type === 'item') {
      const item = items.find(i => i.id === itemId);
      setUrlDialog({ open: true, url: item?.product_url || "", type, itemId });
    } else if (materialId) {
      const item = items.find(i => i.id === itemId);
      const material = item?.relatedMaterials?.find(rm => rm.id === materialId);
      setUrlDialog({ open: true, url: material?.url || "", type, itemId, materialId });
    }
  };

  const saveUrl = () => {
    if (urlDialog.type === 'item' && urlDialog.itemId) {
      setItems(items.map(item => 
        item.id === urlDialog.itemId ? { ...item, product_url: urlDialog.url } : item
      ));
    } else if (urlDialog.type === 'related' && urlDialog.itemId && urlDialog.materialId) {
      updateRelatedMaterial(urlDialog.itemId, urlDialog.materialId, 'url', urlDialog.url);
    }
    setUrlDialog({ open: false, url: "", type: 'item' });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  };

  const addConsumable = () => {
    if (!newConsumable.name || !newConsumable.quantity || !newConsumable.unit_price) {
      toast.error("Please fill all consumable fields");
      return;
    }
    const consumable: ConsumableItem = {
      id: Math.random().toString(),
      name: newConsumable.name,
      quantity: parseFloat(newConsumable.quantity),
      unit: newConsumable.unit,
      unit_price: parseFloat(newConsumable.unit_price)
    };
    setConsumables([...consumables, consumable]);
    setNewConsumable({ name: "", quantity: "", unit: "ea", unit_price: "" });
    toast.success("Consumable added");
  };

  const deleteConsumable = (id: string) => {
    setConsumables(consumables.filter(c => c.id !== id));
    toast.success("Consumable removed");
  };

  const calculateTotals = () => {
    let totalMaterials = 0;
    let totalLabour = 0;

    items.forEach(item => {
      // Material calculation with wastage
      const matBase = (item.quantity || 0) * (item.unit_price || 0);
      const matWaste = matBase * ((item.material_wastage_pct || 0) / 100);
      totalMaterials += matBase + matWaste;

      // Add related materials
      if (item.relatedMaterials) {
        item.relatedMaterials.forEach(rm => {
          totalMaterials += (rm.quantity || 0) * (rm.unit_price || 0);
        });
      }

      // Labour calculation with wastage
      const labBase = (item.labour_hours || 0) * (item.labour_rate || config.defaultLabourRate);
      const labWaste = labBase * ((item.labour_wastage_pct || 0) / 100);
      totalLabour += labBase + labWaste;
    });

    // Add consumables to materials
    consumables.forEach(cons => {
      totalMaterials += (cons.quantity || 0) * (cons.unit_price || 0);
    });

    const baseSubtotal = totalMaterials + totalLabour;
    const supervision = totalLabour * (config.supervisionPct / 100);
    const overheadsPct = (baseSubtotal + supervision) * (config.overheadPct / 100);
    const totalOverheads = overheadsPct + overheadTotal;
    const preMargin = baseSubtotal + supervision + totalOverheads;
    const contingency = preMargin * (config.contingencyPct / 100);
    
    // Add custom configs
    let customConfigsTotal = 0;
    customConfigs.forEach(cc => {
      customConfigsTotal += preMargin * (cc.value / 100);
    });
    
    const margin = preMargin * (config.marginPct / 100);
    const taxable = preMargin + contingency + customConfigsTotal + margin;
    const gst = taxable * (config.gstPct / 100);
    const totalPrice = taxable + gst;

    return {
      totalMaterials,
      totalLabour,
      baseSubtotal,
      supervision,
      overheadsPct,
      overheadTotal,
      totalOverheads,
      preMargin,
      contingency,
      customConfigsTotal,
      margin,
      taxable,
      gst,
      totalPrice
    };
  };

  const totals = calculateTotals();

  const handleAIItems = (aiItems: any[]) => {
    aiItems.forEach(item => {
      setNewItem({
        area: item.area,
        trade: item.trade,
        scope_of_work: item.scope_of_work,
        material_type: item.material_type,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        labour_hours: item.labour_hours
      });
      setTimeout(() => addItem(), 100);
    });
  };

  const calculateLineTotal = () => {
    const qty = parseFloat(newItem.quantity) || 0;
    const unitPrice = parseFloat(newItem.unit_price) || 0;
    const labourHrs = parseFloat(newItem.labour_hours) || 0;
    
    // Material with wastage
    const matBase = qty * unitPrice;
    const matWithWaste = matBase * (1 + config.materialWastage / 100);
    
    // Labour with wastage
    const labBase = labourHrs * config.defaultLabourRate;
    const labWithWaste = labBase * (1 + config.labourWastage / 100);
    
    return {
      materials: matWithWaste,
      labour: labWithWaste,
      total: matWithWaste + labWithWaste
    };
  };

  const addCustomConfig = () => {
    if (!newCustomConfig.name || !newCustomConfig.value) {
      toast.error("Please enter config name and value");
      return;
    }
    const customConfig = {
      id: crypto.randomUUID(),
      name: newCustomConfig.name,
      value: parseFloat(newCustomConfig.value) || 0
    };
    setCustomConfigs([...customConfigs, customConfig]);
    setNewCustomConfig({ name: "", value: "" });
    toast.success("Custom config added");
  };

  const removeCustomConfig = (id: string) => {
    setCustomConfigs(customConfigs.filter(c => c.id !== id));
    toast.success("Custom config removed");
  };

  const updateCustomConfig = (id: string, value: number) => {
    setCustomConfigs(customConfigs.map(c => 
      c.id === id ? { ...c, value } : c
    ));
  };

  return (
    <div className="space-y-6 p-6">
      {/* 1. NCC Standards Research */}
      <NCCSearchBar />
      
      {/* 2. Estimate Configuration */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Estimate Configuration</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="overhead">Overhead %</Label>
            <Input
              id="overhead"
              type="number"
              min="0"
              step="0.1"
              value={config.overheadPct}
              onChange={(e) => setConfig({ ...config, overheadPct: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="margin">Margin %</Label>
            <Input
              id="margin"
              type="number"
              min="0"
              step="0.1"
              value={config.marginPct}
              onChange={(e) => setConfig({ ...config, marginPct: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="gst">GST %</Label>
            <Input
              id="gst"
              type="number"
              min="0"
              step="0.1"
              value={config.gstPct}
              onChange={(e) => setConfig({ ...config, gstPct: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="supervision">Supervision %</Label>
            <Input
              id="supervision"
              type="number"
              min="0"
              step="0.1"
              value={config.supervisionPct}
              onChange={(e) => setConfig({ ...config, supervisionPct: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="materialWaste">Material Waste %</Label>
            <Input
              id="materialWaste"
              type="number"
              min="0"
              step="0.1"
              value={config.materialWastage}
              onChange={(e) => setConfig({ ...config, materialWastage: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="labourWaste">Labour Waste %</Label>
            <Input
              id="labourWaste"
              type="number"
              min="0"
              step="0.1"
              value={config.labourWastage}
              onChange={(e) => setConfig({ ...config, labourWastage: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="contingency">Contingency %</Label>
            <Input
              id="contingency"
              type="number"
              min="0"
              step="0.1"
              value={config.contingencyPct}
              onChange={(e) => setConfig({ ...config, contingencyPct: parseFloat(e.target.value) || 0 })}
            />
          </div>
          
          {/* Custom Config Items */}
          {customConfigs.map(custom => (
            <div key={custom.id} className="relative">
              <Label>{custom.name} %</Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={custom.value}
                  onChange={(e) => updateCustomConfig(custom.id, parseFloat(e.target.value) || 0)}
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => removeCustomConfig(custom.id)}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Custom Config Form */}
        <div className="mt-4 flex items-end gap-2">
          <div className="flex-1">
            <Label>Custom Config Name</Label>
            <Input
              value={newCustomConfig.name}
              onChange={(e) => setNewCustomConfig({ ...newCustomConfig, name: e.target.value })}
              placeholder="e.g., Site Allowance"
            />
          </div>
          <div className="w-32">
            <Label>Value %</Label>
            <Input
              type="number"
              value={newCustomConfig.value}
              onChange={(e) => setNewCustomConfig({ ...newCustomConfig, value: e.target.value })}
              placeholder="5"
            />
          </div>
          <Button onClick={addCustomConfig} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Custom
          </Button>
        </div>
      </Card>
      
      {/* 3. Price Summary */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-accent/20">
        <div className="grid grid-cols-2 md:grid-cols-8 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Materials</p>
            <p className="text-lg font-bold">${totals.totalMaterials.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Labour</p>
            <p className="text-lg font-bold">${totals.totalLabour.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Supervision</p>
            <p className="text-lg font-bold">${totals.supervision.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Overheads</p>
            <p className="text-lg font-bold">${totals.totalOverheads.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Contingency</p>
            <p className="text-lg font-bold">${totals.contingency.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Margin</p>
            <p className="text-lg font-bold">${totals.margin.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">GST (10%)</p>
            <p className="text-lg font-bold">${totals.gst.toFixed(2)}</p>
          </div>
          <div className="bg-accent/10 rounded-lg p-2">
            <p className="text-xs text-muted-foreground mb-1">TOTAL PRICE</p>
            <p className="text-2xl font-bold text-accent">${totals.totalPrice.toFixed(2)}</p>
          </div>
        </div>
      </Card>

      {/* 5. Preliminaries */}
      <PreliminariesSection />
      
      {/* 6. Labour Hourly Rates by Trade */}
      <LabourRatesSection 
        rates={labourRates}
        onRatesChange={setLabourRates}
      />
      
      {/* 7. Pricing Aid (Collapsible) */}
      <Collapsible defaultOpen={false}>
        <Card className="p-4">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <h3 className="text-lg font-semibold">Pricing Aid</h3>
            <ChevronDown className="h-4 w-4 transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <PricingHistory projectId={projectId} />
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 8. Add Line Item */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Add Line Item</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Area *</Label>
            <Input
              value={newItem.area}
              onChange={(e) => setNewItem({ ...newItem, area: e.target.value })}
              placeholder="e.g., Kitchen"
            />
          </div>
          <div>
            <Label>Trade *</Label>
            <Select
              value={newItem.trade}
              onValueChange={(value) => setNewItem({ ...newItem, trade: value, scope_of_work: "" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trade" />
              </SelectTrigger>
              <SelectContent>
                {AU_TRADES.map(trade => (
                  <SelectItem key={trade} value={trade}>{trade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Scope of Work *</Label>
            <Select
              value={newItem.scope_of_work}
              onValueChange={(value) => setNewItem({ ...newItem, scope_of_work: value })}
              disabled={!newItem.trade}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                {newItem.trade && SCOPE_OF_WORK[newItem.trade as keyof typeof SCOPE_OF_WORK]?.map(scope => (
                  <SelectItem key={scope} value={scope}>{scope}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Material Type *</Label>
            <Input
              value={newItem.material_type}
              onChange={(e) => setNewItem({ ...newItem, material_type: e.target.value })}
              placeholder="e.g., MGP12 90x45"
            />
          </div>
          <div>
            <Label>Qty *</Label>
            <Input
              type="number"
              step="0.01"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
            />
          </div>
          <div>
            <Label>Unit</Label>
            <Select
              value={newItem.unit}
              onValueChange={(value) => setNewItem({ ...newItem, unit: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="m²">m² (square metres)</SelectItem>
                <SelectItem value="lm">lm (linear metres)</SelectItem>
                <SelectItem value="m³">m³ (cubic metres)</SelectItem>
                <SelectItem value="ea">ea (each)</SelectItem>
                <SelectItem value="sets">sets</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unit Cost ($) *</Label>
            <Input
              type="number"
              step="0.01"
              value={newItem.unit_price}
              onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
            />
          </div>
          <div>
            <Label>Labour Hrs</Label>
            <Input
              type="number"
              step="0.5"
              value={newItem.labour_hours}
              onChange={(e) => setNewItem({ ...newItem, labour_hours: e.target.value })}
              placeholder="0"
            />
          </div>
        </div>

        <div className="col-span-full mt-6 p-4 bg-accent/10 rounded-lg flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm">
              <span className="text-muted-foreground">Materials:</span> ${calculateLineTotal().materials.toFixed(2)} 
              <span className="text-xs text-muted-foreground ml-2">(incl. {config.materialWastage}% waste)</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Labour:</span> ${calculateLineTotal().labour.toFixed(2)} 
              <span className="text-xs text-muted-foreground ml-2">(incl. {config.labourWastage}% waste)</span>
            </div>
            <div className="text-lg font-bold">
              Line Total: <span className="text-accent">${calculateLineTotal().total.toFixed(2)}</span>
            </div>
          </div>
          <Button onClick={addItem} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirm & Add to Estimate
          </Button>
        </div>
      </Card>

      {/* 9. Project Price Per Item */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Project Price Per Item</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Item #</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Trade</TableHead>
                <TableHead>SOW</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">$/Unit</TableHead>
                <TableHead className="text-center">URL</TableHead>
                <TableHead className="text-right">Labour Hrs</TableHead>
                <TableHead className="text-right">Markup %</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => {
                const matBase = item.quantity * item.unit_price;
                const matWaste = matBase * (item.material_wastage_pct / 100);
                const labBase = item.labour_hours * item.labour_rate;
                const labWaste = labBase * (item.labour_wastage_pct / 100);
                const subtotal = matBase + matWaste + labBase + labWaste;
                const markup = subtotal * (item.markup_pct / 100);
                const lineTotal = subtotal + markup;
                const isEditing = editingId === item.id;
                const relatedMats = SOW_RELATED_MATERIALS[item.scope_of_work] || [];

                return (
                  <>
                    <TableRow key={item.id} className="group">
                      <TableCell>
                        {relatedMats.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleExpanded(item.id)}
                          >
                            {item.expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.item_number}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editValues.area}
                            onChange={(e) => setEditValues({ ...editValues, area: e.target.value })}
                            className="h-8"
                          />
                        ) : item.area}
                      </TableCell>
                      <TableCell>{item.trade}</TableCell>
                      <TableCell>{item.scope_of_work}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editValues.material_type}
                            onChange={(e) => setEditValues({ ...editValues, material_type: e.target.value })}
                            className="h-8"
                          />
                        ) : item.material_type}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.quantity}
                            onChange={(e) => setEditValues({ ...editValues, quantity: parseFloat(e.target.value) })}
                            className="h-8 w-20 text-right"
                          />
                        ) : <span className="font-mono">{item.quantity}</span>}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.unit_price}
                            onChange={(e) => setEditValues({ ...editValues, unit_price: parseFloat(e.target.value) })}
                            className="h-8 w-24 text-right"
                          />
                        ) : <span className="font-mono">${item.unit_price.toFixed(2)}</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openUrlDialog('item', item.id)}
                        >
                          <Link className="h-3 w-3" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.5"
                            value={editValues.labour_hours}
                            onChange={(e) => setEditValues({ ...editValues, labour_hours: parseFloat(e.target.value) })}
                            className="h-8 w-20 text-right"
                          />
                        ) : <span className="font-mono">{item.labour_hours}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            value={editValues.markup_pct !== undefined ? editValues.markup_pct : 0}
                            onChange={(e) => {
                              const value = e.target.value;
                              setEditValues({ ...editValues, markup_pct: value === '' ? 0 : parseFloat(value) });
                            }}
                            className="h-8 w-16 text-right"
                          />
                        ) : <span className="font-mono">{item.markup_pct}%</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">${lineTotal.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => saveEdit(item.id)}
                                className="text-green-600 h-8 w-8"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={cancelEditing}
                                className="h-8 w-8"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEditing(item)}
                                className="h-8 w-8"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteItem(item.id)}
                                className="text-destructive h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {item.expanded && relatedMats.length > 0 && (
                      <TableRow key={`${item.id}-related`} className="bg-muted/30">
                        <TableCell colSpan={14} className="py-0">
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-muted-foreground">Related Materials for {item.scope_of_work}:</p>
                              <Select onValueChange={(value) => {
                                if (value === "__custom__") {
                                  setShowCustomMaterialDialog(true);
                                } else {
                                  addRelatedMaterial(item.id, value);
                                }
                              }}>
                                <SelectTrigger className="w-64 h-8">
                                  <SelectValue placeholder="Add material..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__custom__" className="font-semibold text-primary">
                                    + Add Custom Material
                                  </SelectItem>
                                  {relatedMats.map(mat => (
                                    <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {item.relatedMaterials && item.relatedMaterials.length > 0 && (
                              <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-2 px-3 pb-2 text-xs font-semibold text-muted-foreground border-b">
                                  <div className="col-span-3">Material Name</div>
                                  <div className="col-span-1 text-center">Qty</div>
                                  <div className="col-span-1 text-center">Unit</div>
                                  <div className="col-span-1 text-right">$/Unit</div>
                                  <div className="col-span-1 text-center">URL</div>
                                  <div className="col-span-4">Comment</div>
                                  <div className="col-span-1 text-right">Total</div>
                                </div>
                                {item.relatedMaterials.map(rm => (
                                  <div key={rm.id} className="space-y-2">
                                    <div className="bg-background rounded border border-border p-3 grid grid-cols-12 gap-2 items-center">
                                      <div className="col-span-3 text-sm font-medium">{rm.name}</div>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={rm.quantity}
                                        onChange={(e) => updateRelatedMaterial(item.id, rm.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        placeholder="Qty"
                                        className="col-span-1 h-8"
                                      />
                                      <Select
                                        value={rm.unit}
                                        onValueChange={(value) => updateRelatedMaterial(item.id, rm.id, 'unit', value)}
                                      >
                                        <SelectTrigger className="col-span-1 h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="ea">ea</SelectItem>
                                          <SelectItem value="m">m</SelectItem>
                                          <SelectItem value="m²">m²</SelectItem>
                                          <SelectItem value="kg">kg</SelectItem>
                                          <SelectItem value="L">L</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={rm.unit_price}
                                        onChange={(e) => updateRelatedMaterial(item.id, rm.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                        placeholder="$/Unit"
                                        className="col-span-1 h-8"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => openUrlDialog('related', item.id, rm.id)}
                                      >
                                        <Link className="h-3 w-3" />
                                      </Button>
                                      <Input
                                        value={rm.comment}
                                        onChange={(e) => updateRelatedMaterial(item.id, rm.id, 'comment', e.target.value)}
                                        placeholder="Comment"
                                        className="col-span-4 h-8"
                                      />
                                      <div className="col-span-1 text-right font-mono text-sm">
                                        ${(rm.quantity * rm.unit_price).toFixed(2)}
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteRelatedMaterial(item.id, rm.id)}
                                        className="h-6 w-6 text-destructive"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    <div className="flex justify-end px-3">
                                      {rm.confirmed ? (
                                        <div className="flex items-center gap-2 text-sm text-accent-foreground">
                                          <CheckCircle className="h-4 w-4" />
                                          <span>Added to Total</span>
                                        </div>
                                      ) : (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => toggleRelatedMaterialConfirmed(item.id, rm.id)}
                                          className="h-8"
                                        >
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          Confirm & Add to Total
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* URL Dialog */}
      <Dialog open={urlDialog.open} onOpenChange={(open) => setUrlDialog({ ...urlDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Product URL</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product Link</Label>
              <Textarea
                value={urlDialog.url}
                onChange={(e) => setUrlDialog({ ...urlDialog, url: e.target.value })}
                placeholder="Paste product URL here..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveUrl} className="flex-1">Save URL</Button>
              {urlDialog.url && (
                <Button variant="outline" onClick={() => copyUrl(urlDialog.url)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Consumables Section */}
      <Card className="p-6">
        <h3 className="font-display text-xl font-bold mb-4">Consumables</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div className="md:col-span-2">
            <Label>Consumable Item</Label>
            <Select
              value={newConsumable.name}
              onValueChange={(value) => setNewConsumable({ ...newConsumable, name: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select or type custom" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {CONSUMABLES.map(cons => (
                  <SelectItem key={cons} value={cons}>{cons}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              step="0.01"
              value={newConsumable.quantity}
              onChange={(e) => setNewConsumable({ ...newConsumable, quantity: e.target.value })}
              placeholder="0"
            />
          </div>
          <div>
            <Label>Unit</Label>
            <Select
              value={newConsumable.unit}
              onValueChange={(value) => setNewConsumable({ ...newConsumable, unit: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ea">ea (each)</SelectItem>
                <SelectItem value="box">box</SelectItem>
                <SelectItem value="pk">pk (pack)</SelectItem>
                <SelectItem value="set">set</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unit Price ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={newConsumable.unit_price}
              onChange={(e) => setNewConsumable({ ...newConsumable, unit_price: e.target.value })}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          <Button onClick={addConsumable} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Consumable
          </Button>
          <Input
            placeholder="Or type custom consumable name..."
            value={newConsumable.name}
            onChange={(e) => setNewConsumable({ ...newConsumable, name: e.target.value })}
            className="flex-1"
          />
        </div>
        
        {consumables.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumables.map(cons => (
                <TableRow key={cons.id}>
                  <TableCell>{cons.name}</TableCell>
                  <TableCell className="text-right font-mono">{cons.quantity}</TableCell>
                  <TableCell>{cons.unit}</TableCell>
                  <TableCell className="text-right font-mono">${cons.unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    ${(cons.quantity * cons.unit_price).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteConsumable(cons.id)}
                      className="text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Comprehensive Totals Summary Table */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10">
        <h3 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" />
          Project Cost Summary
        </h3>
        
        <div className="grid gap-6">
          {/* Breakdown by Section */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-card p-4 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Estimate Lines</p>
              <p className="text-xl font-mono font-bold text-primary">
                ${(() => {
                  let total = 0;
                  items.forEach(item => {
                    const matBase = (item.quantity || 0) * (item.unit_price || 0);
                    const matWaste = matBase * ((item.material_wastage_pct || 0) / 100);
                    const labBase = (item.labour_hours || 0) * (item.labour_rate || config.defaultLabourRate);
                    const labWaste = labBase * ((item.labour_wastage_pct || 0) / 100);
                    total += matBase + matWaste + labBase + labWaste;
                  });
                  return total.toFixed(2);
                })()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{items.length} line items</p>
            </div>

            <div className="bg-card p-4 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Related Materials</p>
              <p className="text-xl font-mono font-bold text-secondary">
                ${(() => {
                  let total = 0;
                  items.forEach(item => {
                    if (item.relatedMaterials) {
                      item.relatedMaterials.forEach(rm => {
                        total += (rm.quantity || 0) * (rm.unit_price || 0);
                      });
                    }
                  });
                  return total.toFixed(2);
                })()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {items.reduce((sum, item) => sum + (item.relatedMaterials?.length || 0), 0)} items
              </p>
            </div>

            <div className="bg-card p-4 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Consumables</p>
              <p className="text-xl font-mono font-bold text-accent">
                ${consumables.reduce((sum, c) => sum + (c.quantity * c.unit_price), 0).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{consumables.length} items</p>
            </div>
          </div>

          {/* Detailed Financial Breakdown */}
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold">Cost Component</TableHead>
                <TableHead className="text-right font-bold">Amount</TableHead>
                <TableHead className="text-right font-bold">Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Base Materials</TableCell>
                <TableCell className="text-right font-mono">${totals.totalMaterials.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {((totals.totalMaterials / totals.totalPrice) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Labour Costs</TableCell>
                <TableCell className="text-right font-mono">${totals.totalLabour.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {((totals.totalLabour / totals.totalPrice) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow className="border-t border-border">
                <TableCell className="font-medium text-muted-foreground">Base Subtotal</TableCell>
                <TableCell className="text-right font-mono font-semibold">${totals.baseSubtotal.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {((totals.baseSubtotal / totals.totalPrice) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  Supervision ({config.supervisionPct}%)
                </TableCell>
                <TableCell className="text-right font-mono">${totals.supervision.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {((totals.supervision / totals.totalPrice) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  Overheads (Percentage: {config.overheadPct}%)
                </TableCell>
                <TableCell className="text-right font-mono">${totals.overheadsPct.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {((totals.overheadsPct / totals.totalPrice) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Overheads (Fixed Items)</TableCell>
                <TableCell className="text-right font-mono">${totals.overheadTotal.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {((totals.overheadTotal / totals.totalPrice) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow className="border-t border-border">
                <TableCell className="font-medium text-muted-foreground">Total Overheads</TableCell>
                <TableCell className="text-right font-mono font-semibold">${totals.totalOverheads.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {((totals.totalOverheads / totals.totalPrice) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  Margin ({config.marginPct}%)
                </TableCell>
                <TableCell className="text-right font-mono">${totals.margin.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {((totals.margin / totals.totalPrice) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow className="border-t border-border">
                <TableCell className="font-medium text-muted-foreground">Subtotal (Pre-GST)</TableCell>
                <TableCell className="text-right font-mono font-semibold">${totals.taxable.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {((totals.taxable / totals.totalPrice) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  GST ({config.gstPct}%)
                </TableCell>
                <TableCell className="text-right font-mono">${totals.gst.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {((totals.gst / totals.totalPrice) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow className="border-t-2 border-primary bg-primary/5">
                <TableCell className="font-bold text-lg">TOTAL PROJECT COST</TableCell>
                <TableCell className="text-right font-mono font-bold text-2xl text-primary">
                  ${totals.totalPrice.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Material %</p>
              <p className="text-lg font-bold font-mono">
                {((totals.totalMaterials / totals.baseSubtotal) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Labour %</p>
              <p className="text-lg font-bold font-mono">
                {((totals.totalLabour / totals.baseSubtotal) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Gross Margin</p>
              <p className="text-lg font-bold font-mono">
                {((totals.margin / totals.taxable) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">GST Collected</p>
              <p className="text-lg font-bold font-mono">
                ${totals.gst.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <CustomMaterialDialog
        open={showCustomMaterialDialog}
        onOpenChange={setShowCustomMaterialDialog}
        onAdd={(material) => {
          const newItem: EstimateItem = {
            id: crypto.randomUUID(),
            section_id: null,
            area: material.area,
            trade: material.trade,
            scope_of_work: material.scope_of_work,
            material_type: material.material_type,
            quantity: material.quantity,
            unit: material.unit,
            unit_price: material.unit_cost,
            labour_hours: material.labour_hours,
            labour_rate: labourRates[material.trade] || config.defaultLabourRate,
            material_wastage_pct: config.materialWastage,
            labour_wastage_pct: config.labourWastage,
            markup_pct: config.defaultMarkup,
            notes: '',
            relatedMaterials: [],
            expanded: false,
            item_number: `${items.length + 1}`,
            isEditing: false
          };
          setItems([...items, newItem]);
          toast.success("Custom material added");
        }}
      />
    </div>
  );
};