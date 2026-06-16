import React, { useState, useEffect } from "react";
import { ESTIMATE_TEMPLATES, EstimateTemplateData } from "@/data/estimateTemplates";
import { getUserStorageKey } from "@/lib/localAuth";
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
import { Plus, Trash2, ChevronDown, ChevronRight, DollarSign, Edit2, Save, X, Link, Copy, CheckCircle, BookOpen, Home, Droplets, Utensils, TreePine, Building2, LayoutTemplate, Percent } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { PreliminariesSection } from "./PreliminariesSection";
import { NCCSearchBar } from "./NCCSearchBar";
import { LabourRatesSection } from "./LabourRatesSection";
import { PricingHistory } from "./PricingHistory";
import { CustomMaterialDialog } from "./CustomMaterialDialog";
import { TourTip } from "@/components/TourTip";

// ── Template icon + colour mapping (by template id) ───────────────────────────
const TEMPLATE_STYLES: Record<string, { Icon: React.ElementType; bg: string; text: string }> = {
  'new-build':         { Icon: Home,           bg: 'bg-blue-400/10',   text: 'text-blue-400' },
  'bathroom-reno':     { Icon: Droplets,        bg: 'bg-teal-400/10',   text: 'text-teal-400' },
  'kitchen-reno':      { Icon: Utensils,        bg: 'bg-amber-400/10',  text: 'text-amber-400' },
  'deck-outdoor':      { Icon: TreePine,        bg: 'bg-green-400/10',  text: 'text-green-400' },
  'commercial-fitout': { Icon: Building2,       bg: 'bg-purple-400/10', text: 'text-purple-400' },
};
const CUSTOM_STYLE = { Icon: LayoutTemplate, bg: 'bg-primary/10', text: 'text-primary' };

function getTemplateStyle(id: string) {
  return TEMPLATE_STYLES[id] ?? CUSTOM_STYLE;
}

// ── Custom template storage helpers ──────────────────────────────────────────
const CUSTOM_TPL_KEY = 'custom_estimate_templates';

function loadCustomTemplates(): EstimateTemplateData[] {
  try {
    const raw = localStorage.getItem(getUserStorageKey(CUSTOM_TPL_KEY));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistCustomTemplates(list: EstimateTemplateData[]) {
  localStorage.setItem(getUserStorageKey(CUSTOM_TPL_KEY), JSON.stringify(list));
}

const AU_TRADES = [
  "Carpenter", "Plumber", "Electrician", "Bricklayer", "Plasterer",
  "Painter", "Tiler", "Concreter", "Roofer", "Landscaper"
];

const ESTIMATE_AREAS = [
  'Site', 'Structure', 'Envelope', 'Roof', 'Internal', 'Wet Areas',
  'External', 'Finishes', 'Services', 'Fitout', 'Landscaping', 'Other',
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
  const [recentlyTransferred, setRecentlyTransferred] = useState<EstimateItem[]>([]);
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
  const [groupingMode, setGroupingMode] = useState<'none' | 'trade' | 'room'>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<EstimateTemplateData[]>(() => loadCustomTemplates());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [targetMarginEst, setTargetMarginEst] = useState<number>(25);

  useEffect(() => {
    loadOverheads();
    loadUserRateSettings();
  }, [projectId]);

  const loadOverheads = () => {
    const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    const project = projects.find((p: any) => p.id === projectId);
    if (project && project.overhead_total) {
      setOverheadTotal(project.overhead_total);
    }
  };

  const loadUserRateSettings = () => {
    try {
      // Apply default rates from Settings → Rates tab
      const savedRates = localStorage.getItem(getUserStorageKey('default_rates'));
      if (savedRates) {
        const r = JSON.parse(savedRates);
        const defaultLabour = parseFloat(r.labourRate);
        if (!isNaN(defaultLabour) && defaultLabour > 0) {
          setConfig(prev => ({ ...prev, defaultLabourRate: defaultLabour }));
        }
        if (r.overhead) setConfig(prev => ({ ...prev, overheadPct: parseFloat(r.overhead) || prev.overheadPct }));
        if (r.margin) setConfig(prev => ({ ...prev, marginPct: parseFloat(r.margin) || prev.marginPct }));
      }
      // Merge labour presets from Settings → Rates tab into per-trade rates
      const savedPresets = localStorage.getItem(getUserStorageKey('labour_presets'));
      if (savedPresets) {
        const presets: { id: string; name: string; rate: string }[] = JSON.parse(savedPresets);
        if (presets.length > 0) {
          const presetMap: Record<string, number> = {};
          presets.forEach(p => { if (p.name && p.rate) presetMap[p.name] = parseFloat(p.rate); });
          setLabourRates(prev => ({ ...prev, ...presetMap }));
        }
      }
    } catch { /* non-fatal */ }
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
    if (projectId) loadItems();
  }, [projectId]);

  // Reload when PDF Takeoff pushes items via custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.projectId === projectId) {
        loadItems();
        // Auto-clear the banner after 8 s so it doesn't linger
        setTimeout(() => setRecentlyTransferred([]), 8_000);
      }
    };
    window.addEventListener('estimate-updated', handler);
    return () => window.removeEventListener('estimate-updated', handler);
  }, [projectId]);

  // Allow external callers (e.g. top nav button) to open the template modal
  useEffect(() => {
    const handler = () => setShowTemplateModal(true);
    window.addEventListener('open-template-modal', handler);
    return () => window.removeEventListener('open-template-modal', handler);
  }, []);

  const loadItems = () => {
    // Load from localStorage — also ensure project entry exists so Takeoff can push items
    const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    let project = projects.find((p: any) => p.id === projectId);

    if (!project) {
      // Create a stub entry so CostEstimator.transferItems can always find it
      project = { id: projectId, estimate_items: [] };
      projects.push(project);
      localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
    }

    if (project.estimate_items && project.estimate_items.length > 0) {
      setItems(project.estimate_items);
      // Items transferred within the last 60 seconds get the highlight banner
      const cutoff = Date.now() - 60_000;
      const fresh = project.estimate_items.filter((i: any) => i._costItemId && i._transferredAt > cutoff);
      setRecentlyTransferred(fresh);
    }
    if (project.estimate_config?.groupingMode) {
      setGroupingMode(project.estimate_config.groupingMode as 'none' | 'trade' | 'room');
    }
  };

  const addItem = () => {
    if (!newItem.area || !newItem.trade || !newItem.material_type) {
      toast.error("Please fill in required fields");
      return;
    }

    const qty = parseFloat(newItem.quantity) || 0;
    const unitPrice = parseFloat(newItem.unit_price) || 0;
    const labourHrs = parseFloat(newItem.labour_hours) || 0;

    if (qty === 0 || unitPrice === 0) {
      toast.error("Quantity and unit price must be greater than 0");
      return;
    }

    // Create new estimate item
    const newEstimateItem: EstimateItem = {
      id: `item-${Date.now()}`,
      section_id: null,
      area: newItem.area,
      trade: newItem.trade,
      scope_of_work: newItem.scope_of_work,
      material_type: newItem.material_type,
      quantity: qty,
      unit: newItem.unit,
      unit_price: unitPrice,
      labour_hours: labourHrs,
      labour_rate: labourRates[newItem.trade] || config.defaultLabourRate,
      material_wastage_pct: config.materialWastage,
      labour_wastage_pct: config.labourWastage,
      markup_pct: config.defaultMarkup,
      notes: "",
      expanded: false,
      item_number: `${items.length + 1}`,
      isEditing: false,
      relatedMaterials: []
    };

    // Add to local state
    const updatedItems = [...items, newEstimateItem];
    setItems(updatedItems);

    // Save to localStorage
    const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    const projectIndex = projects.findIndex((p: any) => p.id === projectId);
    if (projectIndex !== -1) {
      projects[projectIndex].estimate_items = updatedItems;
    } else {
      projects.push({ id: projectId, estimate_items: updatedItems });
    }
    localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));

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
  };

  const deleteItem = (id: string) => {
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);

    const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    const projectIndex = projects.findIndex((p: any) => p.id === projectId);
    if (projectIndex !== -1) {
      projects[projectIndex].estimate_items = updatedItems;
    } else {
      projects.push({ id: projectId, estimate_items: updatedItems });
    }
    localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));

    toast.success("Item deleted");
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
      area: item.area,
      trade: item.trade,
      scope_of_work: item.scope_of_work,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = (id: string) => {
    // Update in local state
    const updatedItems = items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          quantity: editValues.quantity ?? item.quantity,
          unit_price: editValues.unit_price ?? item.unit_price,
          labour_hours: editValues.labour_hours ?? item.labour_hours,
          labour_rate: editValues.labour_rate ?? item.labour_rate,
          material_wastage_pct: editValues.material_wastage_pct ?? item.material_wastage_pct,
          labour_wastage_pct: editValues.labour_wastage_pct ?? item.labour_wastage_pct,
          markup_pct: editValues.markup_pct ?? item.markup_pct,
          area: editValues.area ?? item.area,
          material_type: editValues.material_type ?? item.material_type,
          trade: editValues.trade ?? item.trade,
          scope_of_work: editValues.scope_of_work ?? item.scope_of_work,
        };
      }
      return item;
    });
    setItems(updatedItems);

    const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    const projectIndex = projects.findIndex((p: any) => p.id === projectId);
    if (projectIndex !== -1) {
      projects[projectIndex].estimate_items = updatedItems;
    } else {
      projects.push({ id: projectId, estimate_items: updatedItems });
    }
    localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));

    toast.success("Item updated");
    setEditingId(null);
    setEditValues({});
  };

  const updateItemField = (id: string, field: keyof EstimateItem, value: any) => {
    const updatedItems = items.map(item => item.id === id ? { ...item, [field]: value } : item);
    setItems(updatedItems);
    const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    const projectIndex = projects.findIndex((p: any) => p.id === projectId);
    if (projectIndex !== -1) {
      projects[projectIndex].estimate_items = updatedItems;
      localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
    }
  };

  const handleRatesChange = (newRates: Record<string, number>) => {
    const changedTrades = Object.keys(newRates).filter(trade => newRates[trade] !== labourRates[trade]);
    if (changedTrades.length > 0) {
      const updatedItems = items.map(item =>
        changedTrades.includes(item.trade)
          ? { ...item, labour_rate: newRates[item.trade] }
          : item
      );
      setItems(updatedItems);
      const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
      const projectIndex = projects.findIndex((p: any) => p.id === projectId);
      if (projectIndex !== -1) {
        projects[projectIndex].estimate_items = updatedItems;
        localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
      }
    }
    setLabourRates(newRates);
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
    let totalMarkup = 0;

    items.forEach(item => {
      // Material calculation with wastage
      const matBase = (item.quantity || 0) * (item.unit_price || 0);
      const matWaste = matBase * ((item.material_wastage_pct || 0) / 100);
      let matTotal = matBase + matWaste;
      totalMaterials += matTotal;

      // Add related materials — included in both totalMaterials and markup base
      if (item.relatedMaterials) {
        item.relatedMaterials.forEach(rm => {
          const rmCost = (rm.quantity || 0) * (rm.unit_price || 0);
          totalMaterials += rmCost;
          matTotal += rmCost;
        });
      }

      // Labour calculation with wastage — always use current labourRates state so rate changes apply to existing items
      const labBase = (item.labour_hours || 0) * (labourRates[item.trade] || item.labour_rate || config.defaultLabourRate);
      const labWaste = labBase * ((item.labour_wastage_pct || 0) / 100);
      const labTotal = labBase + labWaste;
      totalLabour += labTotal;

      // Per-item markup applied to item subtotal (mat + related materials + labour with wastage)
      totalMarkup += (matTotal + labTotal) * ((item.markup_pct || 0) / 100);
    });

    // Add consumables to materials
    consumables.forEach(cons => {
      totalMaterials += (cons.quantity || 0) * (cons.unit_price || 0);
    });

    const baseSubtotal = totalMaterials + totalLabour;
    const supervision = totalLabour * (config.supervisionPct / 100);
    const overheadsPct = (baseSubtotal + supervision) * (config.overheadPct / 100);
    const totalOverheads = overheadsPct + overheadTotal;
    // totalMarkup is added to preMargin so contingency and overall margin apply on top
    const preMargin = baseSubtotal + totalMarkup + supervision + totalOverheads;
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
      totalMarkup,
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

  // Sync estimate_config, consumables, and estimate_totals to the project record so
  // QuoteGenerator and FullTenderGenerator always read current rates and percentages.
  useEffect(() => {
    if (!projectId) return;
    const projects: any[] = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    const idx = projects.findIndex((p: any) => p.id === projectId);
    if (idx === -1) return;
    projects[idx].estimate_config = { ...config, labourRates, customConfigs, groupingMode };
    projects[idx].consumables = consumables;
    projects[idx].estimate_totals = calculateTotals();
    localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
  }, [items, config, consumables, labourRates, overheadTotal, customConfigs, groupingMode, projectId]);

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

    // Labour with wastage — use the selected trade's rate, fall back to default
    const tradeRate = labourRates[newItem.trade] || config.defaultLabourRate;
    const labBase = labourHrs * tradeRate;
    const labWithWaste = labBase * (1 + config.labourWastage / 100);

    return {
      materials: matWithWaste,
      labour: labWithWaste,
      total: matWithWaste + labWithWaste
    };
  };

  const getGroups = (mode: 'trade' | 'room'): { order: string[]; groups: Record<string, EstimateItem[]> } => {
    const order: string[] = [];
    const groups: Record<string, EstimateItem[]> = {};
    items.forEach(item => {
      const key = mode === 'trade' ? (item.trade || 'Other') : (item.area || 'Other');
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(item);
    });
    return { order, groups };
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const loadTemplate = (template: EstimateTemplateData) => {
    const newItems: EstimateItem[] = template.items.map((ti, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      section_id: null,
      area: ti.area,
      trade: ti.trade,
      scope_of_work: ti.scope_of_work,
      material_type: ti.material_type,
      quantity: ti.quantity,
      unit: ti.unit,
      unit_price: ti.unit_price,
      labour_hours: ti.labour_hours,
      labour_rate: labourRates[ti.trade] || config.defaultLabourRate,
      material_wastage_pct: ti.material_wastage_pct,
      labour_wastage_pct: ti.labour_wastage_pct,
      markup_pct: ti.markup_pct,
      notes: '',
      expanded: false,
      item_number: `${idx + 1}`,
      isEditing: false,
      relatedMaterials: [],
    }));
    setItems(newItems);
    const projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    const projectIndex = projects.findIndex((p: any) => p.id === projectId);
    if (projectIndex !== -1) {
      projects[projectIndex].estimate_items = newItems;
      localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
    }
    setShowTemplateModal(false);
    toast.success(`${template.items.length} items loaded from "${template.name}"`);
  };

  const handleSaveAsTemplate = () => {
    if (!newTplName.trim() || items.length === 0) return;
    const tpl: EstimateTemplateData = {
      id: `custom-${Date.now()}`,
      name: newTplName.trim(),
      description: `${items.length} line item${items.length !== 1 ? 's' : ''}`,
      category: 'custom' as any,
      icon: 'custom',
      items: items.map(i => ({
        area: i.area, trade: i.trade, scope_of_work: i.scope_of_work,
        material_type: i.material_type, quantity: i.quantity, unit: i.unit,
        unit_price: i.unit_price, labour_hours: i.labour_hours,
        material_wastage_pct: i.material_wastage_pct,
        labour_wastage_pct: i.labour_wastage_pct, markup_pct: i.markup_pct,
      })),
    };
    const updated = [...loadCustomTemplates(), tpl];
    persistCustomTemplates(updated);
    setCustomTemplates(updated);
    setShowSaveModal(false);
    setNewTplName('');
    toast.success(`Template "${tpl.name}" saved`);
  };

  const handleDeleteCustomTemplate = (id: string) => {
    const updated = loadCustomTemplates().filter(t => t.id !== id);
    persistCustomTemplates(updated);
    setCustomTemplates(updated);
    toast.success('Template deleted');
  };

  const renderItem = (item: EstimateItem) => {
    const matBase = item.quantity * item.unit_price;
    const matWaste = matBase * (item.material_wastage_pct / 100);
    const relatedMatsTotal = (item.relatedMaterials || []).reduce((s, rm) => s + (rm.quantity || 0) * (rm.unit_price || 0), 0);
    const matTotalWithRelated = matBase + matWaste + relatedMatsTotal;
    const labBase = item.labour_hours * (labourRates[item.trade] || item.labour_rate || config.defaultLabourRate);
    const labWaste = labBase * (item.labour_wastage_pct / 100);
    const labTotal = labBase + labWaste;
    const subtotal = matTotalWithRelated + labTotal;
    const markup = subtotal * (item.markup_pct / 100);
    const lineTotal = subtotal + markup;
    const isEditing = editingId === item.id;
    const relatedMats = SOW_RELATED_MATERIALS[item.scope_of_work] || [];

    return (
      <React.Fragment key={item.id}>
        <TableRow className="group">
          <TableCell>
            {relatedMats.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
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
          <TableCell className="font-mono text-sm font-medium">{item.item_number}</TableCell>
          <TableCell>
            <Select
              value={isEditing ? (editValues.area ?? item.area ?? '') : (item.area ?? '')}
              onValueChange={(v) => {
                if (isEditing) {
                  setEditValues({ ...editValues, area: v });
                } else {
                  updateItemField(item.id, 'area', v);
                }
              }}
            >
              <SelectTrigger className="h-8 min-w-[90px] border-0 shadow-none hover:bg-muted/50 focus:ring-0 px-2 text-sm">
                <SelectValue placeholder="Area..." />
              </SelectTrigger>
              <SelectContent>
                {ESTIMATE_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            {isEditing ? (
              <Select
                value={editValues.trade ?? item.trade}
                onValueChange={(v) => setEditValues({ ...editValues, trade: v, scope_of_work: '' })}
              >
                <SelectTrigger className="h-8 min-w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AU_TRADES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : item.trade}
          </TableCell>
          <TableCell>
            {isEditing ? (
              <Select
                value={editValues.scope_of_work ?? item.scope_of_work ?? ''}
                onValueChange={(v) => setEditValues({ ...editValues, scope_of_work: v })}
              >
                <SelectTrigger className="h-8 min-w-[110px]"><SelectValue placeholder="Scope..." /></SelectTrigger>
                <SelectContent>
                  {(SCOPE_OF_WORK[(editValues.trade ?? item.trade) as keyof typeof SCOPE_OF_WORK] || []).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : item.scope_of_work}
          </TableCell>
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
                className="h-8 w-24 text-right"
              />
            ) : <span className="font-mono">{Number(item.quantity).toFixed(1)}</span>}
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
              className="h-8 w-8"
              onClick={() => openUrlDialog('item', item.id)}
            >
              <Link className="h-4 w-4" />
            </Button>
          </TableCell>
          <TableCell className="text-right">
            {isEditing ? (
              <Input
                type="number"
                step="0.5"
                value={editValues.labour_hours}
                onChange={(e) => setEditValues({ ...editValues, labour_hours: parseFloat(e.target.value) })}
                className="h-8 w-24 text-right"
              />
            ) : (
              <div className="text-right">
                <span className="font-mono">{Number(item.labour_hours).toFixed(1)}</span>
                <div className="text-xs text-muted-foreground mt-0.5">
                  @${(labourRates[item.trade] || item.labour_rate || config.defaultLabourRate).toFixed(0)}/hr
                </div>
              </div>
            )}
          </TableCell>
          <TableCell className="text-right">
            <div>
              <span className="font-mono text-sm">${matTotalWithRelated.toFixed(2)}</span>
              {relatedMatsTotal > 0 && (
                <div className="text-xs text-muted-foreground mt-0.5">incl. +${relatedMatsTotal.toFixed(2)} related</div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">
                {lineTotal > 0 ? ((matTotalWithRelated / lineTotal) * 100).toFixed(0) : '0'}%
              </div>
            </div>
          </TableCell>
          <TableCell className="text-right">
            <div>
              <span className="font-mono text-sm">${labTotal.toFixed(2)}</span>
              <div className="text-xs text-muted-foreground mt-0.5">
                {lineTotal > 0 ? ((labTotal / lineTotal) * 100).toFixed(0) : '0'}%
              </div>
            </div>
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
                className="h-8 w-20 text-right"
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
          <TableRow className="bg-muted/30">
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
                    {item.relatedMaterials.map((rm, rmIdx) => (
                      <div key={rm.id} className="space-y-2 border-l-2 border-primary/20 ml-4 pl-3">
                        <div className="bg-background rounded border border-border p-3 grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3 flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-primary/70 bg-primary/8 border border-primary/20 rounded px-1.5 py-0.5 flex-shrink-0 leading-none">{item.item_number}.{rmIdx + 1}</span>
                            <span className="text-sm font-medium">{rm.name}</span>
                          </div>
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
                            className="h-8 w-8"
                            onClick={() => openUrlDialog('related', item.id, rm.id)}
                          >
                            <Link className="h-4 w-4" />
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
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
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
      </React.Fragment>
    );
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
      {/* Transfer banner — appears briefly after items arrive from PDF Takeoff */}
      {recentlyTransferred.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-accent/10 border border-accent/30 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 text-accent-foreground font-medium">
            <CheckCircle className="h-4 w-4 text-accent" />
            {recentlyTransferred.length} item{recentlyTransferred.length > 1 ? 's' : ''} transferred from PDF Takeoff:&nbsp;
            <span className="font-normal text-muted-foreground">
              {recentlyTransferred.map(i => i.scope_of_work || i.trade).join(', ')}
            </span>
          </div>
          <button
            onClick={() => setRecentlyTransferred([])}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Materials</p>
            <p className="text-lg font-bold">${totals.totalMaterials.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Labour</p>
            <p className="text-lg font-bold">${totals.totalLabour.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Supervision</p>
            <p className="text-lg font-bold">${totals.supervision.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Overheads</p>
            <p className="text-lg font-bold">${totals.totalOverheads.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Contingency</p>
            <p className="text-lg font-bold">${totals.contingency.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Margin</p>
            <p className="text-lg font-bold">${totals.margin.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">GST (10%)</p>
            <p className="text-lg font-bold">${totals.gst.toFixed(2)}</p>
          </div>
          <div className="bg-accent/10 rounded-lg p-3">
            <p className="text-sm text-muted-foreground mb-1 font-medium">TOTAL PRICE</p>
            <p className="text-2xl font-bold text-accent">${totals.totalPrice.toFixed(2)}</p>
          </div>
        </div>
      </Card>

      {/* Margin vs Markup Calculator */}
      {(() => {
        const realMarginEst = config.marginPct / (100 + config.marginPct) * 100;
        const reqMarkup = targetMarginEst < 100 ? targetMarginEst / (100 - targetMarginEst) * 100 : 999;
        return (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Percent className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold">Margin vs Markup</span>
              <span className="text-xs text-muted-foreground ml-1">
                — your {config.marginPct}% markup earns only {realMarginEst.toFixed(1)}¢ per revenue dollar, not {config.marginPct}¢
              </span>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {/* Left: actual breakdown */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Markup Applied</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-muted rounded text-center">
                    <div className="text-xs text-muted-foreground">Cost base</div>
                    <div className="text-sm font-bold font-mono">${totals.preMargin.toFixed(2)}</div>
                  </div>
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-center">
                    <div className="text-xs text-blue-700">Markup ({config.marginPct}%)</div>
                    <div className="text-sm font-bold text-blue-800 font-mono">${totals.margin.toFixed(2)}</div>
                  </div>
                  <div className="p-2 bg-muted rounded text-center">
                    <div className="text-xs text-muted-foreground">Revenue (ex-GST)</div>
                    <div className="text-sm font-bold font-mono">${totals.taxable.toFixed(2)}</div>
                  </div>
                  <div className={`p-2 rounded text-center ${realMarginEst < 15 ? 'bg-red-100 dark:bg-red-950/30' : 'bg-amber-100 dark:bg-amber-950/30'}`}>
                    <div className={`text-xs font-medium ${realMarginEst < 15 ? 'text-red-700' : 'text-amber-700'}`}>Real Margin</div>
                    <div className={`text-xl font-bold font-mono ${realMarginEst < 15 ? 'text-red-800' : 'text-amber-800'}`}>{realMarginEst.toFixed(1)}%</div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Adding {config.marginPct}% on top of costs gives a real profit margin of {realMarginEst.toFixed(1)}% on revenue — not {config.marginPct}%.
                </p>
              </div>
              {/* Right: reverse calculator */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Margin Calculator</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs whitespace-nowrap">I want</label>
                  <input
                    type="number" min={1} max={99}
                    value={targetMarginEst}
                    onChange={(e) => setTargetMarginEst(Number(e.target.value))}
                    className="w-20 h-8 text-sm text-center font-mono border border-input rounded-md px-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <label className="text-xs whitespace-nowrap">% real margin</label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-green-100 dark:bg-green-950/30 rounded text-center">
                    <div className="text-xs text-green-700 font-medium">Required Markup</div>
                    <div className="text-xl font-bold text-green-800 font-mono">{reqMarkup.toFixed(1)}%</div>
                  </div>
                  <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded text-center">
                    <div className="text-xs text-muted-foreground">Net Profit $</div>
                    <div className="text-sm font-bold font-mono">${(totals.preMargin * reqMarkup / 100).toFixed(2)}</div>
                  </div>
                </div>
                <button
                  className="w-full h-8 text-xs rounded-md border border-green-400 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors"
                  onClick={() => setConfig({ ...config, marginPct: parseFloat(reqMarkup.toFixed(1)) })}
                >
                  Apply {reqMarkup.toFixed(1)}% markup to estimate
                </button>
                <p className="text-[11px] text-muted-foreground">
                  Required markup = target ÷ (100 − target) × 100.
                </p>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* 5. Preliminaries */}
      <PreliminariesSection />
      
      {/* 6. Labour Hourly Rates by Trade */}
      <LabourRatesSection
        rates={labourRates}
        onRatesChange={handleRatesChange}
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
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Materials:</span>
              <span>${calculateLineTotal().materials.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">(incl.</span>
              <input
                type="number" min="0" max="100" step="0.1"
                value={config.materialWastage}
                onChange={(e) => setConfig({ ...config, materialWastage: parseFloat(e.target.value) || 0 })}
                className="w-12 h-5 text-right text-xs border border-input rounded px-1 bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">% waste)</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Labour:</span>
              <span>${calculateLineTotal().labour.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">(incl.</span>
              <input
                type="number" min="0" max="100" step="0.1"
                value={config.labourWastage}
                onChange={(e) => setConfig({ ...config, labourWastage: parseFloat(e.target.value) || 0 })}
                className="w-12 h-5 text-right text-xs border border-input rounded px-1 bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">% waste)</span>
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Project Price Per Item</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-border overflow-hidden text-sm">
              {(['none', 'trade', 'room'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setGroupingMode(mode); setCollapsedGroups(new Set()); }}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    groupingMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {mode === 'none' ? 'Flat' : mode === 'trade' ? 'By Trade' : 'By Room'}
                </button>
              ))}
            </div>
            <TourTip text="Save your current estimate as a reusable template for future jobs." position="left">
              <Button variant="outline" size="sm" onClick={() => setShowSaveModal(true)} disabled={items.length === 0}>
                <Save className="h-4 w-4 mr-2" />
                Save as Template
              </Button>
            </TourTip>
            <TourTip text="Start your estimate from a pre-built template — New Build, Bathroom Reno, Kitchen, Deck, or Commercial Fitout. Loads all standard line items instantly." position="left">
              <Button variant="outline" size="sm" onClick={() => setShowTemplateModal(true)}>
                <BookOpen className="h-4 w-4 mr-2" />
                Load Template
              </Button>
            </TourTip>
          </div>
        </div>

        {/* Empty state — show template picker when no items yet */}
        {items.length === 0 && (
          <div className="px-2 pb-4">
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Start from a template</span>
                <span className="text-xs text-muted-foreground">— or add items manually using the form above</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {/* Custom templates first */}
                {customTemplates.map(t => {
                  const { Icon, bg, text } = getTemplateStyle(t.id);
                  return (
                    <button key={t.id} onClick={() => loadTemplate(t)}
                      className="flex flex-col items-start gap-1.5 p-3 rounded-lg border border-primary/30 bg-background hover:border-primary/60 hover:bg-primary/5 transition-all text-left group">
                      <div className={`p-1.5 rounded-md ${bg}`}><Icon className={`h-4 w-4 ${text}`} /></div>
                      <span className="text-xs font-semibold leading-tight group-hover:text-primary transition-colors">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground">{t.items.length} items</span>
                    </button>
                  );
                })}
                {/* Built-in templates */}
                {ESTIMATE_TEMPLATES.map(t => {
                  const { Icon, bg, text } = getTemplateStyle(t.id);
                  return (
                    <button key={t.id} onClick={() => loadTemplate(t)}
                      className="flex flex-col items-start gap-1.5 p-3 rounded-lg border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
                      <div className={`p-1.5 rounded-md ${bg}`}><Icon className={`h-4 w-4 ${text}`} /></div>
                      <span className="text-xs font-semibold leading-tight group-hover:text-primary transition-colors">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground">{t.items.length} items</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-16">Item #</TableHead>
                <TableHead className="min-w-[100px]">Area</TableHead>
                <TableHead className="min-w-[100px]">Trade</TableHead>
                <TableHead className="min-w-[120px]">Scope of Work</TableHead>
                <TableHead className="min-w-[140px]">Material</TableHead>
                <TableHead className="text-right w-20">Qty</TableHead>
                <TableHead className="w-16">Unit</TableHead>
                <TableHead className="text-right w-24">$/Unit</TableHead>
                <TableHead className="text-center w-12">URL</TableHead>
                <TableHead className="text-right w-24">Labour Hrs</TableHead>
                <TableHead className="text-right w-28">Mat $</TableHead>
                <TableHead className="text-right w-28">Labour $</TableHead>
                <TableHead className="text-right w-24">Markup %</TableHead>
                <TableHead className="text-right w-28">Line Total</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupingMode === 'none'
                ? items.map(item => renderItem(item))
                : (() => {
                    const { order, groups } = getGroups(groupingMode);
                    return order.map(groupName => {
                      const groupItems = groups[groupName];
                      const isCollapsed = collapsedGroups.has(groupName);
                      const sectionTotal = groupItems.reduce((sum, item) => {
                        const mb = item.quantity * item.unit_price;
                        const mw = mb * (item.material_wastage_pct / 100);
                        const rt = (item.relatedMaterials || []).reduce((s, rm) => s + (rm.quantity || 0) * (rm.unit_price || 0), 0);
                        const lb = item.labour_hours * (labourRates[item.trade] || item.labour_rate || config.defaultLabourRate);
                        const lw = lb * (item.labour_wastage_pct / 100);
                        return sum + (mb + mw + rt + lb + lw) * (1 + item.markup_pct / 100);
                      }, 0);
                      return (
                        <React.Fragment key={groupName}>
                          <TableRow
                            className="bg-primary/5 hover:bg-primary/8 cursor-pointer select-none border-t-2 border-primary/10"
                            onClick={() => toggleGroup(groupName)}
                          >
                            <TableCell colSpan={16} className="py-2.5 px-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {isCollapsed
                                    ? <ChevronRight className="h-4 w-4 text-primary" />
                                    : <ChevronDown className="h-4 w-4 text-primary" />
                                  }
                                  <span className="text-sm font-bold uppercase tracking-wide">{groupName}</span>
                                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                    {groupItems.length} item{groupItems.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <span className="font-mono text-sm font-semibold text-primary">${sectionTotal.toFixed(2)}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {!isCollapsed && groupItems.map(item => renderItem(item))}
                        </React.Fragment>
                      );
                    });
                  })()
              }
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
                  <TableCell className="text-right font-mono">{Number(cons.quantity).toFixed(1)}</TableCell>
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
              <p className="text-sm text-muted-foreground mb-1">Cost Before Overheads &amp; Margin</p>
              <p className="text-xl font-mono font-bold text-primary">
                ${(() => {
                  let total = 0;
                  items.forEach(item => {
                    const matBase = (item.quantity || 0) * (item.unit_price || 0);
                    const matWaste = matBase * ((item.material_wastage_pct || 0) / 100);
                    const labBase = (item.labour_hours || 0) * (labourRates[item.trade] || item.labour_rate || config.defaultLabourRate);
                    const labWaste = labBase * ((item.labour_wastage_pct || 0) / 100);
                    const sub = matBase + matWaste + labBase + labWaste;
                    total += sub * (1 + ((item.markup_pct || 0) / 100));
                  });
                  return total.toFixed(2);
                })()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{items.length} line items</p>
            </div>

            <div className="bg-card p-4 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground mb-1">Related Materials</p>
              <p className="text-xl font-mono font-bold text-primary">
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
              <p className="text-sm text-muted-foreground mb-1">Consumables</p>
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
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* ── Section: Base Costs (derived, read-only) ── */}
              <TableRow className="bg-muted/20">
                <TableCell colSpan={4} className="py-1 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Base Costs</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium pl-5">Base Materials</TableCell>
                <TableCell className="text-right font-mono">${totals.totalMaterials.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? ((totals.totalMaterials / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell className="font-medium pl-5">Labour Costs</TableCell>
                <TableCell className="text-right font-mono">${totals.totalLabour.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? ((totals.totalLabour / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                <TableCell />
              </TableRow>
              <TableRow className="border-t border-border">
                <TableCell className="font-semibold text-muted-foreground pl-5">Base Subtotal</TableCell>
                <TableCell className="text-right font-mono font-semibold">${totals.baseSubtotal.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? ((totals.baseSubtotal / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                <TableCell />
              </TableRow>

              {/* ── Section: Project Costs (editable %) ── */}
              <TableRow className="bg-muted/20">
                <TableCell colSpan={4} className="py-1 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project Costs</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Supervision</span>
                    <input type="number" min="0" max="100" step="0.1" value={config.supervisionPct}
                      onChange={(e) => setConfig({ ...config, supervisionPct: parseFloat(e.target.value) || 0 })}
                      className="w-14 h-6 text-right text-sm border border-input rounded px-1.5 bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                    <span className="text-sm text-muted-foreground">% of labour</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">${totals.supervision.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? ((totals.supervision / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell className="pl-5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Overheads</span>
                    <input type="number" min="0" max="100" step="0.1" value={config.overheadPct}
                      onChange={(e) => setConfig({ ...config, overheadPct: parseFloat(e.target.value) || 0 })}
                      className="w-14 h-6 text-right text-sm border border-input rounded px-1.5 bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                    <span className="text-sm text-muted-foreground">% of subtotal</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">${totals.overheadsPct.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? ((totals.overheadsPct / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                <TableCell />
              </TableRow>
              {totals.overheadTotal > 0 && (
                <TableRow>
                  <TableCell className="font-medium pl-5">Overheads (Fixed Items)</TableCell>
                  <TableCell className="text-right font-mono">${totals.overheadTotal.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? ((totals.overheadTotal / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                  <TableCell />
                </TableRow>
              )}
              {totals.totalMarkup > 0 && (
                <TableRow>
                  <TableCell className="font-medium pl-5">Per-item Markup</TableCell>
                  <TableCell className="text-right font-mono">${totals.totalMarkup.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? ((totals.totalMarkup / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                  <TableCell />
                </TableRow>
              )}
              <TableRow className="border-t border-border">
                <TableCell className="font-semibold text-muted-foreground pl-5">Total Project Costs</TableCell>
                <TableCell className="text-right font-mono font-semibold">${(totals.totalOverheads + totals.totalMarkup).toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? (((totals.totalOverheads + totals.totalMarkup) / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                <TableCell />
              </TableRow>

              {/* ── Section: Margins & Fees (editable %) ── */}
              <TableRow className="bg-muted/20">
                <TableCell colSpan={4} className="py-1 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Margins &amp; Fees</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Contingency</span>
                    <input type="number" min="0" max="100" step="0.1" value={config.contingencyPct}
                      onChange={(e) => setConfig({ ...config, contingencyPct: parseFloat(e.target.value) || 0 })}
                      className="w-14 h-6 text-right text-sm border border-input rounded px-1.5 bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">${totals.contingency.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? ((totals.contingency / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                <TableCell />
              </TableRow>
              {customConfigs.map(cc => (
                <TableRow key={cc.id}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{cc.name}</span>
                      <input type="number" min="0" max="100" step="0.1" value={cc.value}
                        onChange={(e) => updateCustomConfig(cc.id, parseFloat(e.target.value) || 0)}
                        className="w-14 h-6 text-right text-sm border border-input rounded px-1.5 bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">${(totals.preMargin * (cc.value / 100)).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? (((totals.preMargin * (cc.value / 100)) / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                  <TableCell className="text-center">
                    <button onClick={() => removeCustomConfig(cc.id)} className="text-muted-foreground hover:text-destructive transition-colors" title={`Remove ${cc.name}`}><X className="h-3.5 w-3.5" /></button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="pl-5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Margin</span>
                    <input type="number" min="0" max="100" step="0.1" value={config.marginPct}
                      onChange={(e) => setConfig({ ...config, marginPct: parseFloat(e.target.value) || 0 })}
                      className="w-14 h-6 text-right text-sm border border-input rounded px-1.5 bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">${totals.margin.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? ((totals.margin / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                <TableCell />
              </TableRow>

              {/* ── GST & Total ── */}
              <TableRow className="border-t-2 border-border">
                <TableCell className="font-semibold text-muted-foreground pl-5">Subtotal (Pre-GST)</TableCell>
                <TableCell className="text-right font-mono font-semibold">${totals.taxable.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? ((totals.taxable / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell className="pl-5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">GST</span>
                    <input type="number" min="0" max="100" step="0.1" value={config.gstPct}
                      onChange={(e) => setConfig({ ...config, gstPct: parseFloat(e.target.value) || 0 })}
                      className="w-14 h-6 text-right text-sm border border-input rounded px-1.5 bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">${totals.gst.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{totals.totalPrice > 0 ? ((totals.gst / totals.totalPrice) * 100).toFixed(1) : '0.0'}%</TableCell>
                <TableCell />
              </TableRow>
              <TableRow className="border-t-2 border-primary bg-primary/5">
                <TableCell className="font-bold text-lg">TOTAL PROJECT COST</TableCell>
                <TableCell className="text-right font-mono font-bold text-2xl text-primary">${totals.totalPrice.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">100%</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Material %</p>
              <p className="text-lg font-bold font-mono">
                {totals.baseSubtotal > 0 ? ((totals.totalMaterials / totals.baseSubtotal) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Labour %</p>
              <p className="text-lg font-bold font-mono">
                {totals.baseSubtotal > 0 ? ((totals.totalLabour / totals.baseSubtotal) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Gross Margin</p>
              <p className="text-lg font-bold font-mono">
                {totals.taxable > 0 ? ((totals.margin / totals.taxable) * 100).toFixed(1) : '0.0'}%
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

      {/* Template Library Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Estimate Templates
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1 mb-4">
            Select a template to load its items. Your current items will be replaced.
          </p>

          {/* My Templates section */}
          {customTemplates.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">My Templates</p>
              <div className="grid gap-2">
                {customTemplates.map(t => {
                  const { Icon, bg, text } = getTemplateStyle(t.id);
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5 hover:border-primary/40 transition-colors">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${bg}`}><Icon className={`h-5 w-5 ${text}`} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{t.name}</span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{t.items.length} items</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => loadTemplate(t)}>Load</Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0" onClick={() => handleDeleteCustomTemplate(t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Built-in templates */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Standard Templates</p>
          <div className="grid gap-2">
            {ESTIMATE_TEMPLATES.map(t => {
              const { Icon, bg, text } = getTemplateStyle(t.id);
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${bg}`}><Icon className={`h-5 w-5 ${text}`} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{t.name}</span>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{t.items.length} items</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <Button size="sm" variant="outline" className="flex-shrink-0" onClick={() => loadTemplate(t)}>Load</Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Save as Template Modal */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Save as Template
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Saves all {items.length} current line items as a reusable template.
          </p>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Template name</label>
              <input
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. Standard 4-bed House"
                value={newTplName}
                onChange={e => setNewTplName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveAsTemplate()}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowSaveModal(false); setNewTplName(''); }}>Cancel</Button>
              <Button size="sm" onClick={handleSaveAsTemplate} disabled={!newTplName.trim()}>Save Template</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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