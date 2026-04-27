import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DollarSign, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

// LocalStorage keys
const LABOUR_RATES_KEY = 'user_labour_rates';
const CUSTOM_TRADES_KEY = 'user_custom_trades';

interface CustomTrade {
  trade_name: string;
  default_rate: number;
}

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

  // Load labour rates from localStorage
  const loadUserLabourRates = () => {
    try {
      const storedRates = localStorage.getItem(LABOUR_RATES_KEY);
      if (storedRates) {
        const loadedRates: Record<string, number> = JSON.parse(storedRates);
        onRatesChange({ ...DEFAULT_RATES, ...loadedRates });
      } else {
        // Initialize with default rates
        onRatesChange({ ...DEFAULT_RATES });
      }
    } catch (error) {
      console.error("Error loading user labour rates:", error);
      onRatesChange({ ...DEFAULT_RATES });
    }
  };

  // Load custom trades from localStorage
  const loadCustomTrades = () => {
    try {
      const storedTrades = localStorage.getItem(CUSTOM_TRADES_KEY);
      if (storedTrades) {
        const trades: CustomTrade[] = JSON.parse(storedTrades);
        const tradeNames = trades.map(t => t.trade_name);
        setCustomTrades(tradeNames);
        setAllTrades([...AU_TRADES, ...tradeNames]);

        // Load custom trade rates
        const customRates: Record<string, number> = {};
        trades.forEach(trade => {
          customRates[trade.trade_name] = trade.default_rate || 90;
        });

        // Merge with existing rates
        const storedRates = localStorage.getItem(LABOUR_RATES_KEY);
        const existingRates = storedRates ? JSON.parse(storedRates) : {};
        onRatesChange({ ...DEFAULT_RATES, ...customRates, ...existingRates });
      }
    } catch (error) {
      console.error("Error loading custom trades:", error);
    }
  };

  // Save rate to localStorage
  const handleRateChange = (trade: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    const newRates = {
      ...rates,
      [trade]: numValue
    };
    onRatesChange(newRates);

    // Save to localStorage
    try {
      localStorage.setItem(LABOUR_RATES_KEY, JSON.stringify(newRates));
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

  // Add custom trade to localStorage
  const addCustomTrade = () => {
    if (!newTradeName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a trade name",
        variant: "destructive",
      });
      return;
    }

    // Check if trade already exists
    if (allTrades.includes(newTradeName.trim())) {
      toast({
        title: "Error",
        description: "This trade already exists",
        variant: "destructive",
      });
      return;
    }

    try {
      // Load existing custom trades
      const storedTrades = localStorage.getItem(CUSTOM_TRADES_KEY);
      const trades: CustomTrade[] = storedTrades ? JSON.parse(storedTrades) : [];

      // Add new trade
      const newTrade: CustomTrade = {
        trade_name: newTradeName.trim(),
        default_rate: parseFloat(newTradeRate) || 90
      };
      trades.push(newTrade);

      // Save to localStorage
      localStorage.setItem(CUSTOM_TRADES_KEY, JSON.stringify(trades));

      // Update rates
      const newRates = {
        ...rates,
        [newTradeName.trim()]: parseFloat(newTradeRate) || 90
      };
      localStorage.setItem(LABOUR_RATES_KEY, JSON.stringify(newRates));
      onRatesChange(newRates);

      toast({
        title: "Success",
        description: `${newTradeName} added successfully`,
      });
      setNewTradeName("");
      setNewTradeRate("90");
      setShowAddDialog(false);
      loadCustomTrades();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add custom trade",
        variant: "destructive",
      });
      console.error(error);
    }
  };

  // Delete custom trade from localStorage
  const deleteCustomTrade = (tradeName: string) => {
    try {
      // Load existing custom trades
      const storedTrades = localStorage.getItem(CUSTOM_TRADES_KEY);
      const trades: CustomTrade[] = storedTrades ? JSON.parse(storedTrades) : [];

      // Remove the trade
      const updatedTrades = trades.filter(t => t.trade_name !== tradeName);
      localStorage.setItem(CUSTOM_TRADES_KEY, JSON.stringify(updatedTrades));

      // Remove from rates
      const newRates = { ...rates };
      delete newRates[tradeName];
      localStorage.setItem(LABOUR_RATES_KEY, JSON.stringify(newRates));
      onRatesChange(newRates);

      toast({
        title: "Success",
        description: `${tradeName} removed`,
      });
      loadCustomTrades();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete trade",
        variant: "destructive",
      });
      console.error(error);
    }
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
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-sm font-medium">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={rates[trade] || DEFAULT_RATES[trade] || 90}
                    onChange={(e) => handleRateChange(trade, e.target.value)}
                    className="w-20 h-9 text-right text-sm font-mono"
                  />
                  {isCustom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCustomTrade(trade)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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