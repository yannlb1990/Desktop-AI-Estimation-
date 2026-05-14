import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Settings, Bookmark, BookmarkCheck, ChevronDown, ChevronRight } from "lucide-react";

const TEMPLATES_KEY = "overhead_templates";

interface OverheadTemplate {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  notes: string;
}

const loadTemplates = (): OverheadTemplate[] => {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]"); } catch { return []; }
};
const saveTemplates = (tpls: OverheadTemplate[]) =>
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(tpls));

const OVERHEAD_CATEGORIES = [
  "Insurance",
  "Equipment Hire",
  "Site Management",
  "Temporary Works",
  "Waste Removal",
  "Site Setup",
  "Safety & PPE",
  "Transport & Logistics",
  "Professional Fees",
  "Other"
];

interface OverheadItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  notes: string;
}

interface OverheadManagerProps {
  projectId: string;
}

const storageKey = (projectId: string) => `overhead_items_${projectId}`;

const loadFromStorage = (projectId: string): OverheadItem[] => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(projectId)) || "[]");
  } catch {
    return [];
  }
};

const saveToStorage = (projectId: string, items: OverheadItem[]) => {
  localStorage.setItem(storageKey(projectId), JSON.stringify(items));
};

export const OverheadManager = ({ projectId }: OverheadManagerProps) => {
  const [items, setItems] = useState<OverheadItem[]>(() => loadFromStorage(projectId));
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    amount: "",
    frequency: "one-time",
    notes: ""
  });
  const [templates, setTemplates] = useState<OverheadTemplate[]>(loadTemplates);
  const [libraryOpen, setLibraryOpen] = useState(true);

  // Reload when projectId changes
  useEffect(() => {
    setItems(loadFromStorage(projectId));
  }, [projectId]);

  const saveItemAsTemplate = (item: OverheadItem) => {
    const already = templates.some(t => t.name === item.name && t.category === item.category && t.amount === item.amount);
    if (already) { toast.info("Already in library"); return; }
    const tpl: OverheadTemplate = { id: crypto.randomUUID(), name: item.name, category: item.category, amount: item.amount, frequency: item.frequency, notes: item.notes };
    const updated = [...templates, tpl];
    setTemplates(updated);
    saveTemplates(updated);
    toast.success("Saved to overhead library");
  };

  const saveFormAsTemplate = () => {
    if (!newItem.name || !newItem.category || !newItem.amount) { toast.error("Fill description, category and amount first"); return; }
    const already = templates.some(t => t.name === newItem.name && t.category === newItem.category);
    if (already) { toast.info("Already in library"); return; }
    const tpl: OverheadTemplate = { id: crypto.randomUUID(), name: newItem.name, category: newItem.category, amount: parseFloat(newItem.amount), frequency: newItem.frequency, notes: newItem.notes };
    const updated = [...templates, tpl];
    setTemplates(updated);
    saveTemplates(updated);
    toast.success("Saved to overhead library");
  };

  const deleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
  };

  const applyTemplate = (tpl: OverheadTemplate) => {
    const item: OverheadItem = { id: crypto.randomUUID(), name: tpl.name, category: tpl.category, amount: tpl.amount, frequency: tpl.frequency, notes: tpl.notes };
    const updated = [...items, item];
    setItems(updated);
    saveToStorage(projectId, updated);
    toast.success(`Added "${tpl.name}" from library`);
  };

  const totalOverheads = items.reduce((sum, item) => sum + item.amount, 0);

  // Sync total to local_projects so EstimateTemplate and FullTenderGenerator can read it
  useEffect(() => {
    try {
      const projects = JSON.parse(localStorage.getItem("local_projects") || "[]");
      const updated = projects.map((p: any) =>
        p.id === projectId ? { ...p, overhead_total: totalOverheads } : p
      );
      localStorage.setItem("local_projects", JSON.stringify(updated));
    } catch (_) {}
  }, [totalOverheads, projectId]);

  const addItem = () => {
    if (!newItem.name || !newItem.category || !newItem.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    const item: OverheadItem = {
      id: crypto.randomUUID(),
      name: newItem.name,
      category: newItem.category,
      amount: parseFloat(newItem.amount),
      frequency: newItem.frequency,
      notes: newItem.notes,
    };

    const updated = [...items, item];
    setItems(updated);
    saveToStorage(projectId, updated);
    toast.success("Overhead item added");
    setNewItem({ name: "", category: "", amount: "", frequency: "one-time", notes: "" });
  };

  const deleteItem = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    saveToStorage(projectId, updated);
    toast.success("Item deleted");
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Project Overheads</p>
            <p className="text-3xl font-mono font-bold text-primary">
              ${totalOverheads.toFixed(2)}
            </p>
          </div>
          <Settings className="h-12 w-12 text-primary/30" />
        </div>
      </Card>

      {/* Library */}
      <Card className="p-4">
        <button
          className="flex items-center gap-2 w-full text-left"
          onClick={() => setLibraryOpen(v => !v)}
        >
          {libraryOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <BookmarkCheck className="h-4 w-4 text-primary" />
          <span className="font-semibold">Overhead Library</span>
          <Badge variant="secondary" className="ml-1">{templates.length}</Badge>
          <span className="text-xs text-muted-foreground ml-2">Saved templates — reuse across any project</span>
        </button>
        {libraryOpen && (
          <div className="mt-3">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates yet. Add an overhead item below then click the bookmark icon to save it here.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {templates.map(tpl => (
                  <div key={tpl.id} className="flex items-center gap-1.5 border border-border/60 rounded-lg px-3 py-1.5 bg-muted/30 text-sm">
                    <div>
                      <span className="font-medium">{tpl.name}</span>
                      <span className="text-muted-foreground ml-1.5">{tpl.category}</span>
                      <span className="font-mono font-bold text-primary ml-2">${tpl.amount.toFixed(2)}</span>
                      <span className="text-muted-foreground text-xs ml-1 capitalize">({tpl.frequency})</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:bg-primary/10" onClick={() => applyTemplate(tpl)} title="Add to this project">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => deleteTemplate(tpl.id)} title="Remove from library">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Add Overhead Form */}
      <Card className="p-6">
        <h3 className="font-display text-xl font-bold mb-4">Add Overhead Item</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <Label>Description *</Label>
            <Input
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              placeholder="e.g., Site Insurance - 6 months"
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              list="overhead-categories"
              placeholder="Select or type custom category"
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            />
            <datalist id="overhead-categories">
              {OVERHEAD_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>Amount ($) *</Label>
            <Input
              type="number"
              step="0.01"
              value={newItem.amount}
              onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Frequency</Label>
            <Select
              value={newItem.frequency}
              onValueChange={(value) => setNewItem({ ...newItem, frequency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-time">One-time</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-3">
            <Label>Notes</Label>
            <Input
              value={newItem.notes}
              onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
              placeholder="Additional details..."
            />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Button onClick={addItem} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Add Overhead
          </Button>
          <Button variant="outline" onClick={saveFormAsTemplate} title="Save this item to the library for reuse in future projects">
            <Bookmark className="h-4 w-4 mr-2" />
            Save to Library
          </Button>
        </div>
      </Card>

      {/* Items Table */}
      <Card className="p-6">
        <h3 className="font-display text-xl font-bold mb-4">Overhead Items</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="capitalize">{item.frequency}</TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    ${item.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.notes}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => saveItemAsTemplate(item)}
                        title="Save to library"
                        className={templates.some(t => t.name === item.name && t.amount === item.amount) ? "text-primary" : "text-muted-foreground"}
                      >
                        {templates.some(t => t.name === item.name && t.amount === item.amount)
                          ? <BookmarkCheck className="h-4 w-4" />
                          : <Bookmark className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteItem(item.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No overhead items yet. Add your first item above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
