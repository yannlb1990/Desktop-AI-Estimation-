import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PRELIMINARY_CATEGORIES = {
  "Site Setup": ["Site shed", "Temporary fencing", "Temporary power", "Temporary water", "Site signage", "First aid kit"],
  "Engineering": ["Soil test", "Engineering certification", "Surveyors pegs", "Set out", "Asbestos test"],
  "Insurance & Permits": ["Building permit", "Public liability insurance", "Contract works insurance", "Plumbing permit", "Electrical permit"],
  "Site Services": ["Toilet hire", "Skip bins", "Scaffolding", "Crane hire", "Concrete pump"],
  "Protection": ["Floor protection", "Window protection", "Erosion control", "Tree protection", "Neighbour protection"],
  "Clean Up": ["Rough clean", "Final clean", "Window clean", "Rubbish removal", "Site restoration"]
};

interface PreliminaryItem {
  id: string;
  category: string;
  item: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  notes: string;
}

export const PreliminariesSection = () => {
  const [items, setItems] = useState<PreliminaryItem[]>([]);
  const [customCategory, setCustomCategory] = useState("");
  const [customItem, setCustomItem] = useState("");
  const [newItem, setNewItem] = useState({
    category: "",
    item: "",
    quantity: "",
    unit: "ea",
    unitPrice: "",
    notes: ""
  });

  const addItem = () => {
    const categoryToUse = newItem.category === "__custom__" ? customCategory : newItem.category;
    const itemToUse = newItem.category === "__custom__" ? customItem : newItem.item;
    
    if (!categoryToUse || !itemToUse) return;

    const item: PreliminaryItem = {
      id: crypto.randomUUID(),
      category: categoryToUse,
      item: itemToUse,
      quantity: parseFloat(newItem.quantity) || 1,
      unit: newItem.unit,
      unitPrice: parseFloat(newItem.unitPrice) || 0,
      notes: newItem.notes
    };

    setItems([...items, item]);
    setNewItem({
      category: "",
      item: "",
      quantity: "",
      unit: "ea",
      unitPrice: "",
      notes: ""
    });
    setCustomCategory("");
    setCustomItem("");
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const totalPreliminaries = items.reduce((sum, item) => 
    sum + (item.quantity * item.unitPrice), 0
  );

  return (
    <Card className="p-6">
      {/* Add Item Form */}
      <div className="grid grid-cols-12 gap-3 mb-6 items-end">
        <div className="col-span-3">
          <Label>Category *</Label>
          <Select
            value={newItem.category}
            onValueChange={(value) => {
              setNewItem({ ...newItem, category: value, item: "" });
              if (value !== "__custom__") {
                setCustomCategory("");
                setCustomItem("");
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(PRELIMINARY_CATEGORIES).map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
              <SelectItem value="__custom__">+ Custom Category</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {newItem.category === "__custom__" ? (
          <>
            <div className="col-span-3">
              <Label>Custom Category Name *</Label>
              <Input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter category name"
              />
            </div>
            <div className="col-span-3">
              <Label>Custom Item Name *</Label>
              <Input
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                placeholder="Enter item name"
              />
            </div>
          </>
        ) : (
          <div className="col-span-3">
            <Label>Item *</Label>
            <Select
              value={newItem.item}
              onValueChange={(value) => setNewItem({ ...newItem, item: value })}
              disabled={!newItem.category}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {newItem.category && PRELIMINARY_CATEGORIES[newItem.category as keyof typeof PRELIMINARY_CATEGORIES]?.map(item => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="col-span-1">
          <Label>Qty</Label>
          <Input
            type="number"
            step="1"
            value={newItem.quantity}
            onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
            placeholder="1"
          />
        </div>

        <div className="col-span-2">
          <Label>Unit</Label>
          <Select
            value={newItem.unit}
            onValueChange={(value) => setNewItem({ ...newItem, unit: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ea">ea</SelectItem>
              <SelectItem value="week">week</SelectItem>
              <SelectItem value="month">month</SelectItem>
              <SelectItem value="ls">ls</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label>Unit Price ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={newItem.unitPrice}
            onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
            placeholder="0.00"
          />
        </div>

        <div className="col-span-1">
          <Button onClick={addItem} className="w-full">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="w-14 text-right">Qty</TableHead>
              <TableHead className="w-16">Unit</TableHead>
              <TableHead className="w-24 text-right">$/Unit</TableHead>
              <TableHead className="w-28 text-right">Total</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.category}</TableCell>
                <TableCell>{item.item}</TableCell>
                <TableCell className="w-14 text-right font-mono">{item.quantity}</TableCell>
                <TableCell className="w-16">{item.unit}</TableCell>
                <TableCell className="w-24 text-right font-mono">${item.unitPrice.toFixed(2)}</TableCell>
                <TableCell className="w-28 text-right font-mono font-bold">
                  ${(item.quantity * item.unitPrice).toFixed(2)}
                </TableCell>
                <TableCell className="w-10">
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
          </TableBody>
        </Table>
      </div>

      {items.length > 0 && (
        <div className="mt-4 flex justify-end">
          <div className="bg-primary/10 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Total Preliminaries</p>
            <p className="text-2xl font-mono font-bold">${totalPreliminaries.toFixed(2)}</p>
          </div>
        </div>
      )}
    </Card>
  );
};
