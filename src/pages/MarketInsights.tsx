import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp, DollarSign, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { SmartMaterialSearch } from "@/components/SmartMaterialSearch";
import { MaterialsPricingSection } from "@/components/MaterialsPricingSection";
import { SOWRatesSection } from "@/components/SOWRatesSection";
import { PreferredPricingSection } from "@/components/PreferredPricingSection";
import { SupplierBenchmark } from "@/components/SupplierBenchmark";

interface CostItem {
  category: string;
  trade: string;
  sow: string;
  description: string;
  unit: string;
  cordell: number;
  rawlinsons: number;
  archicentre: number;
  masterbuild: number;
  bmtqs: number;
  avg_rate: number;
}

const MarketInsights = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("all");
  const [selectedSOW, setSelectedSOW] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [labourRates, setLabourRates] = useState<Record<string, number>>({});
  
  // Multi-source pricing data (Cordell, Rawlinsons, Archicentre, Master Builders, BMTQS)
  const [costData] = useState<CostItem[]>([
    // CARPENTER - Framing
    { trade: "Carpenter", sow: "Framing", category: "Materials", description: "90x45 MGP10 Pine", unit: "$/LM", cordell: 3.10, rawlinsons: 3.25, archicentre: 3.15, masterbuild: 3.30, bmtqs: 3.20, avg_rate: 3.20 },
    { trade: "Carpenter", sow: "Framing", category: "Materials", description: "90x35 MGP10 Pine", unit: "$/LM", cordell: 2.70, rawlinsons: 2.85, archicentre: 2.75, masterbuild: 2.90, bmtqs: 2.80, avg_rate: 2.80 },
    { trade: "Carpenter", sow: "Framing", category: "Materials", description: "140x45 MGP10 Pine", unit: "$/LM", cordell: 4.60, rawlinsons: 4.85, archicentre: 4.70, masterbuild: 4.95, bmtqs: 4.80, avg_rate: 4.78 },
    { trade: "Carpenter", sow: "Framing", category: "Materials", description: "LVL Beam 240x45", unit: "$/LM", cordell: 21.50, rawlinsons: 22.20, archicentre: 21.80, masterbuild: 22.50, bmtqs: 22.00, avg_rate: 22.00 },
    { trade: "Carpenter", sow: "Framing", category: "Labour", description: "Wall Framing", unit: "$/m²", cordell: 42.00, rawlinsons: 45.50, archicentre: 43.20, masterbuild: 46.00, bmtqs: 44.30, avg_rate: 44.20 },
    { trade: "Carpenter", sow: "Framing", category: "Labour", description: "Roof Framing", unit: "$/m²", cordell: 55.00, rawlinsons: 58.50, archicentre: 56.20, masterbuild: 59.00, bmtqs: 57.30, avg_rate: 57.20 },
    
    // CARPENTER - Fix out
    { trade: "Carpenter", sow: "Fix out", category: "Materials", description: "Cornice 90mm", unit: "$/LM", cordell: 4.20, rawlinsons: 4.40, archicentre: 4.25, masterbuild: 4.50, bmtqs: 4.35, avg_rate: 4.34 },
    { trade: "Carpenter", sow: "Fix out", category: "Materials", description: "Skirting 90mm", unit: "$/LM", cordell: 3.80, rawlinsons: 4.00, archicentre: 3.85, masterbuild: 4.10, bmtqs: 3.95, avg_rate: 3.94 },
    { trade: "Carpenter", sow: "Fix out", category: "Labour", description: "Second Fix Carpentry", unit: "$/hr", cordell: 92.00, rawlinsons: 96.50, archicentre: 93.50, masterbuild: 98.00, bmtqs: 95.00, avg_rate: 95.00 },
    
    // ELECTRICIAN - Rough-in
    { trade: "Electrician", sow: "Rough-in", category: "Materials", description: "2.5mm² TPS Cable", unit: "$/m", cordell: 2.80, rawlinsons: 2.95, archicentre: 2.85, masterbuild: 3.00, bmtqs: 2.90, avg_rate: 2.90 },
    { trade: "Electrician", sow: "Rough-in", category: "Materials", description: "Conduit 20mm PVC", unit: "$/m", cordell: 1.90, rawlinsons: 2.05, archicentre: 1.95, masterbuild: 2.10, bmtqs: 2.00, avg_rate: 2.00 },
    { trade: "Electrician", sow: "Rough-in", category: "Labour", description: "Rough-in Per Point", unit: "$/point", cordell: 68.00, rawlinsons: 72.50, archicentre: 69.50, masterbuild: 74.00, bmtqs: 71.00, avg_rate: 71.00 },
    
    // ELECTRICIAN - Fit-off
    { trade: "Electrician", sow: "Fit-off", category: "Materials", description: "GPO Single", unit: "$/unit", cordell: 12.50, rawlinsons: 13.20, archicentre: 12.80, masterbuild: 13.50, bmtqs: 13.00, avg_rate: 13.00 },
    { trade: "Electrician", sow: "Fit-off", category: "Labour", description: "Power Point Install", unit: "$/point", cordell: 142.00, rawlinsons: 155.00, archicentre: 146.00, masterbuild: 160.00, bmtqs: 150.00, avg_rate: 150.60 },
    { trade: "Electrician", sow: "Fit-off", category: "Labour", description: "Light Point Install", unit: "$/point", cordell: 118.00, rawlinsons: 128.00, archicentre: 122.00, masterbuild: 132.00, bmtqs: 125.00, avg_rate: 125.00 },
    
    // PLUMBER - Rough-in
    { trade: "Plumber", sow: "Rough-in", category: "Materials", description: "PVC Pipe 100mm", unit: "$/m", cordell: 8.50, rawlinsons: 9.00, archicentre: 8.70, masterbuild: 9.20, bmtqs: 8.85, avg_rate: 8.85 },
    { trade: "Plumber", sow: "Rough-in", category: "Materials", description: "Copper Pipe 15mm", unit: "$/m", cordell: 12.80, rawlinsons: 13.50, archicentre: 13.10, masterbuild: 13.80, bmtqs: 13.30, avg_rate: 13.30 },
    { trade: "Plumber", sow: "Rough-in", category: "Labour", description: "Rough-in Complete", unit: "$/m²", cordell: 85.00, rawlinsons: 92.00, archicentre: 87.50, masterbuild: 95.00, bmtqs: 90.00, avg_rate: 89.90 },
    
    // PLUMBER - Fix out
    { trade: "Plumber", sow: "Fix out", category: "Materials", description: "Toilet Suite Mid-Range", unit: "$/unit", cordell: 520.00, rawlinsons: 560.00, archicentre: 535.00, masterbuild: 575.00, bmtqs: 550.00, avg_rate: 548.00 },
    { trade: "Plumber", sow: "Fix out", category: "Labour", description: "Toilet Installation", unit: "$/unit", cordell: 380.00, rawlinsons: 410.00, archicentre: 390.00, masterbuild: 420.00, bmtqs: 400.00, avg_rate: 400.00 },
    
    // BRICKLAYER
    { trade: "Bricklayer", sow: "External walls", category: "Materials", description: "Clay Bricks Standard", unit: "$/1000", cordell: 1100.00, rawlinsons: 1180.00, archicentre: 1130.00, masterbuild: 1200.00, bmtqs: 1150.00, avg_rate: 1152.00 },
    { trade: "Bricklayer", sow: "External walls", category: "Materials", description: "Mortar Mix", unit: "$/m³", cordell: 185.00, rawlinsons: 198.00, archicentre: 190.00, masterbuild: 202.00, bmtqs: 195.00, avg_rate: 194.00 },
    { trade: "Bricklayer", sow: "External walls", category: "Labour", description: "Bricklaying", unit: "$/m²", cordell: 92.00, rawlinsons: 102.00, archicentre: 95.00, masterbuild: 105.00, bmtqs: 98.50, avg_rate: 98.50 },
    
    // PLASTERER
    { trade: "Plasterer", sow: "Internal walls", category: "Materials", description: "Plasterboard 10mm Standard", unit: "$/sheet", cordell: 16.20, rawlinsons: 17.00, archicentre: 16.50, masterbuild: 17.30, bmtqs: 16.80, avg_rate: 16.76 },
    { trade: "Plasterer", sow: "Internal walls", category: "Materials", description: "Plasterboard 13mm Standard", unit: "$/sheet", cordell: 20.80, rawlinsons: 21.80, archicentre: 21.20, masterbuild: 22.20, bmtqs: 21.50, avg_rate: 21.50 },
    { trade: "Plasterer", sow: "Internal walls", category: "Labour", description: "Plasterboard Install & Stop", unit: "$/m²", cordell: 42.00, rawlinsons: 46.00, archicentre: 43.50, masterbuild: 48.00, bmtqs: 45.00, avg_rate: 44.90 },
    
    // PAINTER
    { trade: "Painter", sow: "Interior", category: "Materials", description: "Interior Paint Premium", unit: "$/L", cordell: 38.00, rawlinsons: 42.00, archicentre: 39.50, masterbuild: 43.00, bmtqs: 40.50, avg_rate: 40.60 },
    { trade: "Painter", sow: "Interior", category: "Labour", description: "Interior Painting 2 Coats", unit: "$/m²", cordell: 28.00, rawlinsons: 32.00, archicentre: 29.50, masterbuild: 33.00, bmtqs: 30.50, avg_rate: 30.60 },
    { trade: "Painter", sow: "Exterior", category: "Materials", description: "Exterior Paint Acrylic", unit: "$/L", cordell: 45.00, rawlinsons: 50.00, archicentre: 46.50, masterbuild: 51.00, bmtqs: 48.00, avg_rate: 48.10 },
    { trade: "Painter", sow: "Exterior", category: "Labour", description: "Exterior Painting 2 Coats", unit: "$/m²", cordell: 35.00, rawlinsons: 40.00, archicentre: 36.50, masterbuild: 41.00, bmtqs: 38.00, avg_rate: 38.10 },
    
    // TILER
    { trade: "Tiler", sow: "Floor tiling", category: "Materials", description: "Floor Tiles 600x600 Porcelain", unit: "$/m²", cordell: 52.00, rawlinsons: 58.00, archicentre: 54.00, masterbuild: 60.00, bmtqs: 56.00, avg_rate: 56.00 },
    { trade: "Tiler", sow: "Floor tiling", category: "Labour", description: "Floor Tiling Supply & Install", unit: "$/m²", cordell: 95.00, rawlinsons: 105.00, archicentre: 98.00, masterbuild: 108.00, bmtqs: 101.00, avg_rate: 101.40 },
    { trade: "Tiler", sow: "Wall tiling", category: "Labour", description: "Wall Tiling Supply & Install", unit: "$/m²", cordell: 105.00, rawlinsons: 115.00, archicentre: 108.00, masterbuild: 118.00, bmtqs: 111.00, avg_rate: 111.40 },
    
    // CONCRETER
    { trade: "Concreter", sow: "Slab", category: "Materials", description: "Ready Mix Concrete 25MPa", unit: "$/m³", cordell: 260.00, rawlinsons: 275.00, archicentre: 265.00, masterbuild: 280.00, bmtqs: 270.00, avg_rate: 270.00 },
    { trade: "Concreter", sow: "Slab", category: "Materials", description: "Mesh SL82", unit: "$/m²", cordell: 8.50, rawlinsons: 9.20, archicentre: 8.80, masterbuild: 9.40, bmtqs: 9.00, avg_rate: 8.98 },
    { trade: "Concreter", sow: "Slab", category: "Labour", description: "Concrete Slab Pour & Finish", unit: "$/m²", cordell: 72.00, rawlinsons: 80.00, archicentre: 75.00, masterbuild: 82.00, bmtqs: 77.00, avg_rate: 77.20 },
    
    // ROOFER
    { trade: "Roofer", sow: "Tiles/Metal", category: "Materials", description: "Colorbond Roofing 0.42mm", unit: "$/m²", cordell: 33.00, rawlinsons: 37.00, archicentre: 34.50, masterbuild: 38.00, bmtqs: 35.50, avg_rate: 35.60 },
    { trade: "Roofer", sow: "Tiles/Metal", category: "Materials", description: "Concrete Roof Tiles", unit: "$/m²", cordell: 40.00, rawlinsons: 45.00, archicentre: 42.00, masterbuild: 46.00, bmtqs: 43.00, avg_rate: 43.20 },
    { trade: "Roofer", sow: "Tiles/Metal", category: "Labour", description: "Roof Installation Metal", unit: "$/m²", cordell: 65.00, rawlinsons: 72.00, archicentre: 67.50, masterbuild: 74.00, bmtqs: 69.50, avg_rate: 69.60 },
  ]);

  const trades = ["all", ...Array.from(new Set(costData.map(item => item.trade)))];
  const sows = selectedTrade === "all" 
    ? ["all"] 
    : ["all", ...Array.from(new Set(costData.filter(item => item.trade === selectedTrade).map(item => item.sow)))];
  const categories = ["all", "Materials", "Labour"];
  
  const filteredData = costData.filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.trade.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.sow.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTrade = selectedTrade === "all" || item.trade === selectedTrade;
    const matchesSOW = selectedSOW === "all" || item.sow === selectedSOW;
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesTrade && matchesSOW && matchesCategory;
  });

  const exportToCSV = () => {
    const headers = ["Trade", "SOW", "Category", "Description", "Unit", "Cordell", "Rawlinsons", "Archicentre", "Master Builders", "BMTQS", "Average"];
    const rows = filteredData.map(item => [
      item.trade,
      item.sow,
      item.category,
      item.description,
      item.unit,
      item.cordell.toFixed(2),
      item.rawlinsons.toFixed(2),
      item.archicentre.toFixed(2),
      item.masterbuild.toFixed(2),
      item.bmtqs.toFixed(2),
      item.avg_rate.toFixed(2)
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "market-insights-multi-source.csv";
    a.click();
    toast.success("Multi-source cost data exported");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">Market Insights</h1>
          <p className="text-muted-foreground">
            Current Australian construction costs and labour rates
          </p>
        </div>

        {/* Smart Material Search */}
        <div className="mb-8">
          <SmartMaterialSearch />
        </div>

        {/* Materials Pricing Section */}
        <div className="mb-8">
          <MaterialsPricingSection />
        </div>

        {/* SOW Rates Section */}
        <div className="mb-8">
          <SOWRatesSection />
        </div>

        {/* Preferred Pricing Section */}
        <div className="mb-8">
          <PreferredPricingSection />
        </div>

        {/* Supplier Benchmarking */}
        <div className="mb-8">
          <SupplierBenchmark />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="h-5 w-5 text-accent" />
              <span className="text-sm text-muted-foreground">Avg Labour Rate</span>
            </div>
            <div className="font-mono text-3xl font-bold">$90/hr</div>
            <div className="text-xs text-muted-foreground mt-1">NSW Metro</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-secondary" />
              <span className="text-sm text-muted-foreground">Material Inflation</span>
            </div>
            <div className="font-mono text-3xl font-bold">+4.2%</div>
            <div className="text-xs text-muted-foreground mt-1">YoY Average</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="h-5 w-5 text-accent" />
              <span className="text-sm text-muted-foreground">Concrete Price</span>
            </div>
            <div className="font-mono text-3xl font-bold">$270/m³</div>
            <div className="text-xs text-muted-foreground mt-1">25MPa Average</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Trade</label>
              <Select value={selectedTrade} onValueChange={(val) => {
                setSelectedTrade(val);
                setSelectedSOW("all");
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {trades.map(trade => (
                    <SelectItem key={trade} value={trade}>
                      {trade === "all" ? "All Trades" : trade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Scope of Work</label>
              <Select value={selectedSOW} onValueChange={setSelectedSOW} disabled={selectedTrade === "all"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sows.map(sow => (
                    <SelectItem key={sow} value={sow}>
                      {sow === "all" ? "All SOW" : sow}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat === "all" ? "All Types" : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Results</label>
              <div className="h-10 flex items-center px-3 bg-muted/50 rounded-md">
                <span className="text-sm font-medium">{filteredData.length} items</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Cost Data Table */}
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-lg mb-1">Multi-Source Pricing Comparison</h3>
            <p className="text-sm text-muted-foreground">
              Data aggregated from: Cordell, Rawlinsons, Archicentre, Master Builders, BMTQS
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-semibold">Trade</th>
                  <th className="text-left py-3 px-2 font-semibold">SOW</th>
                  <th className="text-left py-3 px-2 font-semibold">Type</th>
                  <th className="text-left py-3 px-2 font-semibold">Description</th>
                  <th className="text-center py-3 px-2 font-semibold">Unit</th>
                  <th className="text-right py-3 px-2 font-semibold text-xs">Cordell</th>
                  <th className="text-right py-3 px-2 font-semibold text-xs">Rawlinsons</th>
                  <th className="text-right py-3 px-2 font-semibold text-xs">Archicentre</th>
                  <th className="text-right py-3 px-2 font-semibold text-xs">Master B.</th>
                  <th className="text-right py-3 px-2 font-semibold text-xs">BMTQS</th>
                  <th className="text-right py-3 px-2 font-semibold">Avg</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, index) => (
                  <tr key={index} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-2">
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {item.trade}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs">{item.sow}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        item.category === "Labour" ? "bg-secondary/10 text-secondary" : "bg-accent/20 text-accent-foreground"
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-medium">{item.description}</td>
                    <td className="py-3 px-2 text-center text-muted-foreground text-xs">{item.unit}</td>
                    <td className="py-3 px-2 text-right font-mono text-xs">${item.cordell.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-mono text-xs">${item.rawlinsons.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-mono text-xs">${item.archicentre.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-mono text-xs">${item.masterbuild.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-mono text-xs">${item.bmtqs.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-accent">
                      ${item.avg_rate.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Disclaimer */}
        <Card className="p-6 mt-6 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            <strong>Disclaimer:</strong> Rates aggregated from 5 major Australian cost estimation sources (Cordell, Rawlinsons, Archicentre, Master Builders, BMTQS). 
            Based on NSW metro averages Q4 2024. Actual costs vary by project complexity, location, market conditions, and supplier agreements. 
            Always obtain multiple quotes for accurate pricing.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default MarketInsights;
