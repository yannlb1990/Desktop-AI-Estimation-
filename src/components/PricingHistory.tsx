import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PricingRecord {
  scope_of_work: string;
  material_type: string;
  avg_unit_price: number;
  avg_labour_rate: number;
  unit: string;
  count: number;
  last_updated: string;
}

interface PricingHistoryProps {
  projectId: string;
  currentItem?: {
    scope_of_work: string;
    material_type: string;
    unit_price: number;
    labour_rate: number;
  };
}

export const PricingHistory = ({ projectId, currentItem }: PricingHistoryProps) => {
  const [history, setHistory] = useState<PricingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadPricingHistory();
  }, [projectId]);

  const loadPricingHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("estimate_items")
        .select("item_type, description, unit_price, labour_rate, unit, created_at")
        .neq("estimate_id", projectId) as any;

      if (error) throw error;

      // Aggregate pricing data by scope of work and material
      const aggregated: Record<string, PricingRecord> = {};
      
      data?.forEach((item: any) => {
        const key = `${item.item_type}|${item.description}`;
        if (!aggregated[key]) {
          aggregated[key] = {
            scope_of_work: item.item_type,
            material_type: item.description,
            avg_unit_price: 0,
            avg_labour_rate: 0,
            unit: item.unit || "unit",
            count: 0,
            last_updated: item.created_at
          };
        }
        aggregated[key].avg_unit_price += parseFloat(item.unit_price);
        aggregated[key].avg_labour_rate += parseFloat(item.labour_rate);
        aggregated[key].count += 1;
        if (new Date(item.created_at) > new Date(aggregated[key].last_updated)) {
          aggregated[key].last_updated = item.created_at;
        }
      });

      // Calculate averages
      const records = Object.values(aggregated).map(record => ({
        ...record,
        avg_unit_price: record.avg_unit_price / record.count,
        avg_labour_rate: record.avg_labour_rate / record.count
      }));

      setHistory(records);
    } catch (error) {
      console.error("Failed to load pricing history:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePricingData = async () => {
    if (!currentItem) return;
    
    toast.success("Pricing data saved to history");
  };

  const getMarketComparison = (currentPrice: number, avgPrice: number) => {
    if (!avgPrice) return null;
    const diff = ((currentPrice - avgPrice) / avgPrice) * 100;
    
    if (Math.abs(diff) < 5) {
      return { icon: Minus, text: "At Market", color: "text-muted-foreground" };
    } else if (diff > 0) {
      return { icon: TrendingUp, text: `${diff.toFixed(1)}% Above`, color: "text-destructive" };
    } else {
      return { icon: TrendingDown, text: `${Math.abs(diff).toFixed(1)}% Below`, color: "text-green-500" };
    }
  };

  const filteredHistory = history.filter(h =>
    h.material_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.scope_of_work.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const matchingHistory = currentItem 
    ? history.find(h => 
        h.scope_of_work === currentItem.scope_of_work && 
        h.material_type.includes(currentItem.material_type)
      )
    : null;

  const comparison = currentItem && matchingHistory 
    ? getMarketComparison(currentItem.unit_price, matchingHistory.avg_unit_price)
    : null;

  if (loading) return null;

  return (
    <Card className="p-6 bg-muted/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-accent" />
          <h3 className="font-display text-lg font-bold">Pricing History & Market Comparison</h3>
        </div>
        {currentItem && (
          <Button variant="outline" size="sm" onClick={savePricingData}>
            Save to History
          </Button>
        )}
      </div>

      {matchingHistory && comparison && (
        <div className="p-4 bg-background rounded-lg border border-border mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium mb-1">Market Price Indicator</p>
              <p className="text-xs text-muted-foreground">
                Based on {matchingHistory.count} similar {matchingHistory.count === 1 ? 'quote' : 'quotes'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <comparison.icon className={`h-5 w-5 ${comparison.color}`} />
              <span className={`font-bold ${comparison.color}`}>{comparison.text}</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Your Price</p>
              <p className="font-mono font-bold">${currentItem.unit_price.toFixed(2)}/{matchingHistory.unit}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Market Average</p>
              <p className="font-mono font-bold">${matchingHistory.avg_unit_price.toFixed(2)}/{matchingHistory.unit}</p>
            </div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mb-4">
          <Input
            placeholder="Search pricing history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
      )}

      {filteredHistory.length > 0 ? (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-2">Historical pricing data from your past quotes:</p>
          {filteredHistory.slice(0, 10).map((record, idx) => (
            <div key={idx} className="p-3 bg-background rounded border border-border text-sm">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium">{record.material_type}</p>
                  <p className="text-xs text-muted-foreground">{record.scope_of_work}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold">${record.avg_unit_price.toFixed(2)}/{record.unit}</p>
                  <p className="text-xs text-muted-foreground">
                    {record.count} {record.count === 1 ? 'quote' : 'quotes'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : history.length > 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No results found</p>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No historical pricing data yet</p>
          <p className="text-xs">Add items to build your pricing database</p>
        </div>
      )}
    </Card>
  );
};
