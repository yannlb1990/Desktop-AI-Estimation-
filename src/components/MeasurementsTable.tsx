import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2 } from "lucide-react";

interface Measurement {
  id: string;
  measurement_type: 'linear' | 'area' | 'volume' | 'ea';
  label: string | null;
  real_value: number | null;
  real_unit: string | null;
  unit: string;
  trade: string | null;
  thickness_mm: number | null;
  volume_m3: number | null;
  notes: string | null;
}

interface MeasurementsTableProps {
  measurements: Measurement[];
  onDelete: (id: string) => void;
  onEdit: (measurement: Measurement) => void;
}

export const MeasurementsTable = ({ measurements, onDelete, onEdit }: MeasurementsTableProps) => {
  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'linear': return 'Line';
      case 'area': return 'Area';
      case 'volume': return 'Slab';
      case 'ea': return 'Count';
      default: return type;
    }
  };
  
  const getTypeColor = (type: string) => {
    switch(type) {
      case 'linear': return 'bg-red-100 text-red-800';
      case 'area': return 'bg-green-100 text-green-800';
      case 'volume': return 'bg-blue-100 text-blue-800';
      case 'ea': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getQuantity = (m: Measurement) => {
    if (m.measurement_type === 'linear') return m.real_value?.toFixed(2) || '0';
    if (m.measurement_type === 'area') return m.real_value?.toFixed(2) || '0';
    if (m.measurement_type === 'volume') return m.volume_m3?.toFixed(2) || '0';
    if (m.measurement_type === 'ea') return '1';
    return m.real_value?.toFixed(2) || '0';
  };

  if (measurements.length === 0) {
    return null;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Label</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {measurements.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-medium">
              {m.label || `M-${m.id.slice(0, 6)}`}
            </TableCell>
            <TableCell>
              <Badge className={getTypeColor(m.measurement_type)}>
                {getTypeLabel(m.measurement_type)}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono">
              {getQuantity(m)}
            </TableCell>
            <TableCell>{m.unit}</TableCell>
            <TableCell>{m.trade || '-'}</TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {m.measurement_type === 'volume' && m.thickness_mm 
                ? `${m.thickness_mm}mm thick` 
                : (m.notes || '-')}
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onEdit(m)}
                  title="Edit measurement"
                >
                  <Edit2 className="h-4 w-4 text-primary" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onDelete(m.id)}
                  title="Delete measurement"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
