import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { AUSTRALIAN_MATERIALS } from "@/data/australianMaterials";

interface MaterialSubstitutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMaterial: {
    name: string;
    category: string;
    subcategory: string;
    avgPrice: number;
    unit: string;
  };
  onSubstitute: (newMaterialName: string) => void;
}

export const MaterialSubstitutionDialog = ({ 
  open, 
  onOpenChange, 
  currentMaterial,
  onSubstitute 
}: MaterialSubstitutionDialogProps) => {
  const [selectedCriteria, setSelectedCriteria] = useState<"cost" | "quality" | "sustainability">("cost");

  // Find alternatives in same category/subcategory
  const getAlternatives = () => {
    let alternatives = AUSTRALIAN_MATERIALS.filter(m => 
      m.category === currentMaterial.category &&
      m.subcategory === currentMaterial.subcategory &&
      m.name !== currentMaterial.name
    );

    // Sort based on criteria
    if (selectedCriteria === "cost") {
      alternatives = alternatives.sort((a, b) => a.avgPrice - b.avgPrice);
    } else if (selectedCriteria === "quality") {
      // Sort by price descending (assuming higher price = better quality)
      alternatives = alternatives.sort((a, b) => b.avgPrice - a.avgPrice);
    } else if (selectedCriteria === "sustainability") {
      // Prioritize materials with sustainability keywords
      alternatives = alternatives.filter(a => 
        a.name.toLowerCase().includes('recycled') || 
        a.name.toLowerCase().includes('eco') ||
        a.name.toLowerCase().includes('fsc')
      );
    }

    return alternatives.slice(0, 5).map(alt => ({
      ...alt,
      savings: currentMaterial.avgPrice - alt.avgPrice,
      savingsPercent: ((currentMaterial.avgPrice - alt.avgPrice) / currentMaterial.avgPrice * 100).toFixed(1),
      structuralEquivalent: true, // Simplified - would need real logic
      availability: 'in-stock' as const,
      leadTime: 2
    }));
  };

  const alternatives = getAlternatives();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Material Alternatives for {currentMaterial.name}</DialogTitle>
          <DialogDescription>
            Current price: ${currentMaterial.avgPrice.toFixed(2)}/{currentMaterial.unit}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCriteria} onValueChange={(v) => setSelectedCriteria(v as any)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="cost">💰 Cost Optimize</TabsTrigger>
            <TabsTrigger value="quality">⭐ Quality</TabsTrigger>
            <TabsTrigger value="sustainability">🌿 Eco-Friendly</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedCriteria} className="mt-4 space-y-3">
            {alternatives.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                No alternatives found for this material.
              </Card>
            ) : (
              alternatives.map(alt => (
                <Card key={alt.name} className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg mb-1">{alt.name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{alt.subcategory}</p>
                      <div className="flex gap-2 flex-wrap">
                        {alt.structuralEquivalent ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Structural Equivalent
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Check with Engineer
                          </Badge>
                        )}
                        <Badge variant="secondary">{alt.availability}</Badge>
                        {alt.suppliers.map(s => (
                          <Badge key={s} variant="outline">{s}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-mono font-bold">
                        ${alt.avgPrice.toFixed(2)}
                        <span className="text-sm text-muted-foreground">/{alt.unit}</span>
                      </p>
                      {alt.savings !== 0 && (
                        <p className={`text-sm font-semibold mt-1 ${
                          alt.savings > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {alt.savings > 0 ? 'Save' : 'Extra'} ${Math.abs(alt.savings).toFixed(2)}/{alt.unit}
                          <span className="text-xs ml-1">({Math.abs(Number(alt.savingsPercent))}%)</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Availability</p>
                      <p className="font-medium capitalize">{alt.availability}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Lead Time</p>
                      <p className="font-medium">{alt.leadTime} days</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Suppliers</p>
                      <p className="font-medium">{alt.suppliers.length}</p>
                    </div>
                  </div>

                  <Button 
                    size="sm" 
                    className="w-full mt-3"
                    onClick={() => {
                      onSubstitute(alt.name);
                      onOpenChange(false);
                    }}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Use This Material
                  </Button>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
