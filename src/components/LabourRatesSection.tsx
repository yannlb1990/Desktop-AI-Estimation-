import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DollarSign, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AU_TRADES = [
  "Carpenter", "Plumber", "Electrician", "Bricklayer", "Plasterer",
  "Painter", "Tiler", "Concreter", "Roofer", "Landscaper"
];

const DEFAULT_RATES: Record<string, number> = {
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
};

interface LabourRatesSectionProps {
  rates: Record<string, number>;
  onRatesChange: (rates: Record<string, number>) => void;
}

export const LabourRatesSection = ({ rates, onRatesChange }: LabourRatesSectionProps) => {
  const [customTrades, setCustomTrades] = useState<string[]>([]);
  const [allTrades, setAllTrades] = useState<string[]>(AU_TRADES);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTradeName, setNewTradeName] = useState("");
  const [newTradeRate, setNewTradeRate] = useState("90");
  const { toast } = useToast();

  useEffect(() => {
    loadCustomTrades();
    loadUserLabourRates();
  }, []);

  const loadUserLabourRates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_labour_rates")
        .select("trade_name, hourly_rate")
        .eq("user_id", user.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedRates: Record<string, number> = {};
        data.forEach(row => {
          loadedRates[row.trade_name] = row.hourly_rate;
        });
        onRatesChange({ ...rates, ...loadedRates });
      }
    } catch (error) {
      console.error("Error loading user labour rates:", error);
    }
  };

  const loadCustomTrades = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("custom_trades")
        .select("trade_name, default_rate")
        .eq("user_id", user.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const tradeNames = data.map(t => t.trade_name);
        setCustomTrades(tradeNames);
        setAllTrades([...AU_TRADES, ...tradeNames]);

        const customRates: Record<string, number> = {};
        data.forEach(trade => {
          customRates[trade.trade_name] = trade.default_rate || DEFAULT_RATES[trade.trade_name] || 90;
        });
        onRatesChange({ ...rates, ...customRates });
      }
    } catch (error) {
      console.error("Error loading custom trades:", error);
    }
  };

  const handleRateChange = async (trade: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    onRatesChange({
      ...rates,
      [trade]: numValue
    });

    // Save to database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_labour_rates")
        .upsert({
          user_id: user.id,
          trade_name: trade,
          hourly_rate: numValue,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,trade_name' });

      if (error) throw error;

      toast({
        title: "Rate saved",
        description: `${trade} rate updated to $${numValue}/hr`,
      });
    } catch (error) {
      console.error("Error saving labour rate:", error);
      toast({
        title: "Error",
        description: "Failed to save labour rate",
        variant: "destructive",
      });
    }
  };

  const addCustomTrade = async () => {
    if (!newTradeName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a trade name",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to add custom trades",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("custom_trades")
      .insert({
        user_id: user.id,
        trade_name: newTradeName.trim(),
        default_rate: parseFloat(newTradeRate) || 90
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add custom trade",
        variant: "destructive",
      });
      console.error(error);
      return;
    }

    toast({
      title: "Success",
      description: `${newTradeName} added successfully`,
    });
    setNewTradeName("");
    setNewTradeRate("90");
    setShowAddDialog(false);
    loadCustomTrades();
  };

  const deleteCustomTrade = async (tradeName: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("custom_trades")
      .delete()
      .eq("user_id", user.id)
      .eq("trade_name", tradeName);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete trade",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: `${tradeName} removed`,
    });
    loadCustomTrades();
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-accent" />
            <h3 className="font-display text-xl font-bold">Labour Hourly Rates by Trade</h3>
          </div>
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Trade
          </Button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {allTrades.map((trade) => {
            const isCustom = customTrades.includes(trade);
            
            return (
              <div key={trade} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Label className="text-sm flex-1 truncate font-medium">
                  {trade}
                  {isCustom && <span className="text-xs text-accent ml-1">*</span>}
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-xs">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={rates[trade] || DEFAULT_RATES[trade] || 90}
                    onChange={(e) => handleRateChange(trade, e.target.value)}
                    className="w-16 h-8 text-right text-sm"
                  />
                  {isCustom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCustomTrade(trade)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Trade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Trade Name</Label>
              <Input
                placeholder="e.g., Scaffolder, Crane Operator"
                value={newTradeName}
                onChange={(e) => setNewTradeName(e.target.value)}
              />
            </div>
            <div>
              <Label>Default Hourly Rate</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.50"
                  placeholder="90.00"
                  value={newTradeRate}
                  onChange={(e) => setNewTradeRate(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addCustomTrade}>
              Add Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};