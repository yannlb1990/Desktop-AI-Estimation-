import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2, Download, Ruler, Square, Box, Hash, Edit2 } from "lucide-react";
import { exportMeasurementsToCSV, exportMeasurementsToJSON } from "@/utils/measurementExport";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  points: any;
}

interface MeasurementsSidebarProps {
  measurements: Measurement[];
  onDelete: (id: string) => void;
  onEdit: (measurement: Measurement) => void;
  planPageId: string;
}

export const MeasurementsSidebar = ({ measurements, onDelete, onEdit, planPageId }: MeasurementsSidebarProps) => {
  const linesMeasurements = measurements.filter(m => m.measurement_type === 'linear');
  const areaMeasurements = measurements.filter(m => m.measurement_type === 'area');
  const volumeMeasurements = measurements.filter(m => m.measurement_type === 'volume');
  const eaMeasurements = measurements.filter(m => m.measurement_type === 'ea');
  
  const totalArea = areaMeasurements.reduce((sum, m) => sum + (m.real_value || 0), 0);
  const totalVolume = volumeMeasurements.reduce((sum, m) => sum + (m.volume_m3 || 0), 0);

  const handleExport = (format: 'csv' | 'json') => {
    try {
      if (format === 'csv') {
        exportMeasurementsToCSV(measurements, planPageId);
      } else {
        exportMeasurementsToJSON(measurements, planPageId);
      }
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("Export failed");
    }
  };

  return (
    <Card className="w-80 max-h-[calc(100vh-8rem)] sticky top-4 flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Measurements</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('json')}>
              Export JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {measurements.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Ruler className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No measurements yet</p>
              <p className="text-xs mt-1">Use tools to measure</p>
            </div>
          ) : (
            measurements.map((measurement) => (
              <Card key={measurement.id} className="p-3 hover:bg-accent/50 transition-colors">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-1">
                    {measurement.measurement_type === 'linear' && (
                      <Ruler className="h-4 w-4 text-red-500" />
                    )}
                    {measurement.measurement_type === 'area' && (
                      <Square className="h-4 w-4 text-green-500" />
                    )}
                    {measurement.measurement_type === 'volume' && (
                      <Box className="h-4 w-4 text-blue-500" />
                    )}
                    {measurement.measurement_type === 'ea' && (
                      <Hash className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {measurement.label || `Measurement ${measurement.id.slice(0, 8)}`}
                    </div>
                    {measurement.measurement_type === 'volume' ? (
                      <div className="text-lg font-bold text-primary mt-1">
                        {measurement.volume_m3?.toFixed(2)} m³
                        <span className="text-xs text-muted-foreground ml-1">
                          ({measurement.thickness_mm}mm)
                        </span>
                      </div>
                    ) : (
                      <div className="text-lg font-bold text-primary mt-1">
                        {measurement.real_value?.toFixed(2)} {measurement.real_unit}
                      </div>
                    )}
                    {measurement.trade && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {measurement.trade}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(measurement)}
                      title="Edit measurement"
                    >
                      <Edit2 className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(measurement.id)}
                      title="Delete measurement"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {measurements.length > 0 && (
        <div className="p-4 border-t bg-muted/50">
          <div className="text-sm font-medium mb-2">Summary</div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">LM</div>
              <div className="font-semibold text-red-600">{linesMeasurements.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">M²</div>
              <div className="font-semibold text-green-600">{areaMeasurements.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">M³</div>
              <div className="font-semibold text-blue-600">{volumeMeasurements.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">EA</div>
              <div className="font-semibold text-orange-600">{eaMeasurements.length}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
            <div>
              <div className="text-muted-foreground">Total m²</div>
              <div className="font-semibold">{totalArea.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total m³</div>
              <div className="font-semibold">{totalVolume.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
