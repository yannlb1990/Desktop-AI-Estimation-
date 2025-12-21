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
import { Plus, Trash2, Settings } from "lucide-react";

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

export const OverheadManager = ({ projectId }: OverheadManagerProps) => {
  const [items, setItems] = useState<OverheadItem[]>([]);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    amount: "",
    frequency: "one-time",
    notes: ""
  });

  useEffect(() => {
    loadItems();
  }, [projectId]);

  const loadItems = async () => {
    const { data, error } = await supabase
      .from("overhead_items")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at");

    if (error) {
      toast.error("Failed to load overhead items");
      return;
    }

    setItems(data || []);
  };

  const addItem = async () => {
    if (!newItem.name || !newItem.category || !newItem.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("overhead_items").insert({
      project_id: projectId,
      user_id: user.id,
      name: newItem.name,
      category: newItem.category,
      amount: parseFloat(newItem.amount),
      frequency: newItem.frequency,
      notes: newItem.notes,
    });

    if (error) {
      toast.error("Failed to add overhead item");
      return;
    }

    toast.success("Overhead item added");
    setNewItem({
      name: "",
      category: "",
      amount: "",
      frequency: "one-time",
      notes: ""
    });
    loadItems();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("overhead_items").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Item deleted");
    loadItems();
  };

  const totalOverheads = items.reduce((sum, item) => sum + item.amount, 0);

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
        <Button onClick={addItem} className="mt-4 bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" />
          Add Overhead
        </Button>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteItem(item.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
