// Calculation Breakdown Component - Shows detailed audit trail for estimate line items
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calculator,
  AlertTriangle,
  CheckCircle,
  Info,
  Package,
  Clock,
  DollarSign,
  FileText,
  ChevronRight,
  Search,
  ExternalLink,
} from 'lucide-react';
import { EstimatedLineItem, MaterialLookupInfo, CalculationBreakdown as BreakdownType } from '@/lib/aiPlanAnalyzer';

interface CalculationBreakdownProps {
  item: EstimatedLineItem;
  trigger?: React.ReactNode;
}

export function CalculationBreakdownDialog({ item, trigger }: CalculationBreakdownProps) {
  const [open, setOpen] = useState(false);
  const breakdown = item.calculationBreakdown;
  const materialLookup = item.materialLookup;

  const hasWarnings = breakdown?.warnings && breakdown.warnings.length > 0;
  const materialNotFound = materialLookup && !materialLookup.found;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
            <Calculator className="h-3 w-3 mr-1" />
            How calculated?
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculation Breakdown
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4">
            {/* Item Summary */}
            <Card className="p-4 bg-muted/30">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{item.description}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.trade} • {item.category}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">${item.totalCost.toLocaleString()}</p>
                  <Badge variant={item.source === 'detected' ? 'default' : item.source === 'schedule' ? 'secondary' : 'outline'}>
                    {item.source}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Warnings Section */}
            {(hasWarnings || materialNotFound) && (
              <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800 dark:text-amber-200">Attention Required</h4>
                    <ul className="mt-1 space-y-1 text-sm text-amber-700 dark:text-amber-300">
                      {breakdown?.warnings.map((warning, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <ChevronRight className="h-3 w-3 mt-1 flex-shrink-0" />
                          {warning}
                        </li>
                      ))}
                      {materialNotFound && (
                        <li className="flex items-start gap-1">
                          <ChevronRight className="h-3 w-3 mt-1 flex-shrink-0" />
                          {materialLookup.reason}
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </Card>
            )}

            <Separator />

            {/* Quantity Section */}
            <div>
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-blue-600" />
                1. Quantity Determination
              </h4>
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Quantity</p>
                    <p className="text-2xl font-bold">{item.quantity} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Source</p>
                    <p className="text-sm">{breakdown?.quantitySource || 'Not specified'}</p>
                  </div>
                </div>

                {breakdown?.quantityFormula && (
                  <div className="mt-3 p-2 bg-muted rounded font-mono text-sm">
                    {breakdown.quantityFormula}
                  </div>
                )}

                {breakdown?.assumptions && breakdown.assumptions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground uppercase mb-1">Assumptions</p>
                    <ul className="text-sm space-y-1">
                      {breakdown.assumptions.map((assumption, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Info className="h-3 w-3 text-muted-foreground" />
                          {assumption}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </div>

            {/* Material Lookup Section */}
            <div>
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-green-600" />
                2. Material Rate Lookup
              </h4>
              <Card className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {materialLookup?.found ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="font-medium">
                        {materialLookup?.found ? 'Found in Database' : 'Not Found - Using Defaults'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {materialLookup?.materialName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">${breakdown?.materialRate.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{materialLookup?.priceUnit || 'per unit'}</p>
                  </div>
                </div>

                <div className="text-sm">
                  <p className="text-xs text-muted-foreground uppercase">Source</p>
                  <p>{breakdown?.materialSource}</p>
                </div>

                {materialLookup?.found && materialLookup.supplier && (
                  <div className="mt-2 text-sm">
                    <p className="text-xs text-muted-foreground uppercase">Supplier</p>
                    <p>{materialLookup.supplier}</p>
                  </div>
                )}

                {/* Alternatives */}
                {materialLookup?.alternatives && materialLookup.alternatives.length > 0 && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-xs text-muted-foreground uppercase mb-2">
                      <Search className="h-3 w-3 inline mr-1" />
                      Alternative Suppliers
                    </p>
                    <div className="space-y-2">
                      {materialLookup.alternatives.slice(0, 3).map((alt, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                          <span>{alt.name}</span>
                          <div className="text-right">
                            <span className="font-medium">${alt.price.toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground ml-2">({alt.supplier})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Labour Section */}
            <div>
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-purple-600" />
                3. Labour Calculation
              </h4>
              <Card className="p-4">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Hourly Rate</p>
                    <p className="text-lg font-bold">${breakdown?.labourRate}/hr</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Hours/Unit</p>
                    <p className="text-lg font-bold">{breakdown?.labourHoursPerUnit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Total Hours</p>
                    <p className="text-lg font-bold">{item.labourHours.toFixed(1)}</p>
                  </div>
                </div>
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground uppercase">Source</p>
                  <p>{breakdown?.labourSource}</p>
                </div>
              </Card>
            </div>

            {/* Final Calculation */}
            <div>
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                4. Final Calculation
              </h4>
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Material Cost</span>
                    <span className="font-mono">
                      {item.quantity} × ${breakdown?.materialRate.toFixed(2)} = <strong>${item.materialCost.toLocaleString()}</strong>
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Labour Cost</span>
                    <span className="font-mono">
                      {item.labourHours.toFixed(1)}hrs × ${breakdown?.labourRate} = <strong>${item.labourCost.toLocaleString()}</strong>
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-medium">
                    <span>Subtotal (ex GST)</span>
                    <span>${item.totalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>GST (10%)</span>
                    <span>${(item.totalCost * 0.1).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total (inc GST)</span>
                    <span>${(item.totalCost * 1.1).toLocaleString()}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Confidence Score */}
            <Card className="p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Confidence Score</p>
                  <p className="text-xs text-muted-foreground">
                    Based on detection accuracy and data quality
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${
                    item.confidence >= 0.8 ? 'text-green-600' :
                    item.confidence >= 0.6 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {Math.round(item.confidence * 100)}%
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Compact inline breakdown for table rows
export function InlineCalculationBreakdown({ item }: { item: EstimatedLineItem }) {
  const materialLookup = item.materialLookup;
  const breakdown = item.calculationBreakdown;

  return (
    <div className="text-xs text-muted-foreground space-y-1">
      <div className="flex items-center gap-2">
        <span>Material: ${breakdown?.materialRate.toFixed(2)}/unit</span>
        {materialLookup?.found ? (
          <Badge variant="outline" className="h-4 text-[10px]">
            <CheckCircle className="h-2 w-2 mr-1" />
            {materialLookup.supplier}
          </Badge>
        ) : (
          <Badge variant="secondary" className="h-4 text-[10px]">
            <AlertTriangle className="h-2 w-2 mr-1" />
            Default rate
          </Badge>
        )}
      </div>
      <div>
        Labour: ${breakdown?.labourRate}/hr × {breakdown?.labourHoursPerUnit}hrs
      </div>
    </div>
  );
}

export default CalculationBreakdownDialog;
