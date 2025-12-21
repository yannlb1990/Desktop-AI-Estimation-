import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const AU_TRADES = [
  "Excavation & Earthworks",
  "Concrete & Formwork",
  "Masonry & Brickwork",
  "Structural Steel",
  "Carpentry & Joinery",
  "Roofing & Cladding",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Plastering & Rendering",
  "Tiling",
  "Painting & Decorating",
  "Flooring",
  "Glazing",
  "Landscaping",
];

const UNITS = ["m²", "m", "m³", "ea", "kg", "t", "L", "hrs"];

interface CustomMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (material: {
    area: string;
    trade: string;
    scope_of_work: string;
    material_type: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    labour_hours: number;
  }) => void;
}

export const CustomMaterialDialog = ({ open, onOpenChange, onAdd }: CustomMaterialDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    trade: '',
    scope_of_work: '',
    quantity: '',
    unit: 'm²',
    unit_cost: '',
    labour_hours: ''
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.trade) {
      return;
    }

    onAdd({
      area: "Custom",
      trade: formData.trade,
      scope_of_work: formData.scope_of_work || "Custom Material",
      material_type: formData.name,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
      unit_cost: parseFloat(formData.unit_cost) || 0,
      labour_hours: parseFloat(formData.labour_hours) || 0,
    });

    // Reset form
    setFormData({
      name: '',
      trade: '',
      scope_of_work: '',
      quantity: '',
      unit: 'm²',
      unit_cost: '',
      labour_hours: ''
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Custom Material</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="material-name">Material Name *</Label>
            <Input
              id="material-name"
              placeholder="e.g., Custom timber, Special paint..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="trade">Trade *</Label>
            <Select value={formData.trade} onValueChange={(value) => setFormData({ ...formData, trade: value })}>
              <SelectTrigger id="trade">
                <SelectValue placeholder="Select trade" />
              </SelectTrigger>
              <SelectContent>
                {AU_TRADES.map((trade) => (
                  <SelectItem key={trade} value={trade}>{trade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="scope">Scope of Work (optional)</Label>
            <Input
              id="scope"
              placeholder="e.g., Supply & install..."
              value={formData.scope_of_work}
              onChange={(e) => setFormData({ ...formData, scope_of_work: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unit">Unit</Label>
              <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="unit-cost">Unit Cost ($)</Label>
              <Input
                id="unit-cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="labour-hours">Labour Hours</Label>
              <Input
                id="labour-hours"
                type="number"
                step="0.1"
                min="0"
                placeholder="0"
                value={formData.labour_hours}
                onChange={(e) => setFormData({ ...formData, labour_hours: e.target.value })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!formData.name || !formData.trade}>
            Add Material
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
