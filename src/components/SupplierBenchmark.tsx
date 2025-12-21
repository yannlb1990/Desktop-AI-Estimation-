import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Store, Star, Truck, Tag, ExternalLink, Search,
  TrendingDown, TrendingUp, Minus, Building2
} from "lucide-react";
import { SUPPLIER_DATABASE, AustralianState, Supplier } from "@/data/supplierDatabase";

type State = AustralianState;

// Sample price comparison data (in real app, this would come from API/scraping)
const BENCHMARK_PRICES: Record<string, Record<string, number>> = {
  "90x45 MGP10 Pine": {
    "Bunnings Warehouse": 3.15,
    "Mitre 10": 3.25,
    "Bowens": 2.98,
    "Dahlsens": 3.05,
    "Sydney Build Supplies": 2.95,
  },
  "Plasterboard 10mm": {
    "Bunnings Warehouse": 16.50,
    "Mitre 10": 17.20,
    "CSR Gyprock Direct": 15.80,
    "USG Boral": 16.00,
  },
  "Colorbond Roofing": {
    "Bunnings Warehouse": 35.00,
    "Stratco": 33.50,
    "Lysaght": 34.20,
    "Bowens": 34.80,
  },
  "Concrete 25MPa": {
    "Boral Concrete": 265.00,
    "Hanson Concrete": 270.00,
    "Holcim": 268.00,
  },
  "2.5mm TPS Cable (100m)": {
    "Bunnings Warehouse": 89.00,
    "Mitre 10": 92.00,
    "Electrical Wholesalers": 78.00,
    "Middy's": 82.00,
  },
};

export const SupplierBenchmark = () => {
  const [selectedState, setSelectedState] = useState<State>("NSW");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"suppliers" | "prices">("suppliers");

  const stateSuppliers = useMemo(() => {
    const stateData = SUPPLIER_DATABASE.find(s => s.state === selectedState);
    if (!stateData) return [];

    return stateData.suppliers.filter(supplier => {
      const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           supplier.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === "all" || supplier.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [selectedState, searchTerm, selectedType]);

  const supplierTypes = ["all", "hardware", "specialist", "wholesale", "trade", "online"];

  const getPriceLevelColor = (level: string) => {
    switch (level) {
      case 'budget': return 'bg-green-100 text-green-800';
      case 'mid-range': return 'bg-blue-100 text-blue-800';
      case 'premium': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'hardware': return <Store className="h-4 w-4" />;
      case 'specialist': return <Building2 className="h-4 w-4" />;
      case 'wholesale': return <Tag className="h-4 w-4" />;
      default: return <Store className="h-4 w-4" />;
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      );
    }
    return <div className="flex gap-0.5">{stars}</div>;
  };

  const getPriceComparison = (prices: Record<string, number>) => {
    const values = Object.values(prices);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { min, max, avg };
  };

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-accent flex-shrink-0" />
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">Supplier Benchmarking</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Compare suppliers and prices across Australian states
            </p>
          </div>
        </div>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "suppliers" | "prices")} className="mb-6">
        <TabsList>
          <TabsTrigger value="suppliers">Suppliers by State</TabsTrigger>
          <TabsTrigger value="prices">Price Comparison</TabsTrigger>
        </TabsList>
      </Tabs>

      {viewMode === "suppliers" && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedState} onValueChange={(value) => setSelectedState(value as State)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NSW">New South Wales</SelectItem>
                <SelectItem value="VIC">Victoria</SelectItem>
                <SelectItem value="QLD">Queensland</SelectItem>
                <SelectItem value="SA">South Australia</SelectItem>
                <SelectItem value="WA">Western Australia</SelectItem>
                <SelectItem value="TAS">Tasmania</SelectItem>
                <SelectItem value="NT">Northern Territory</SelectItem>
                <SelectItem value="ACT">ACT</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supplierTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type === "all" ? "All Types" : type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Supplier Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stateSuppliers.map((supplier, index) => (
              <Card key={index} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(supplier.type)}
                    <h3 className="font-semibold text-sm">{supplier.name}</h3>
                  </div>
                  <Badge className={getPriceLevelColor(supplier.priceLevel)}>
                    {supplier.priceLevel}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {supplier.description}
                </p>

                <div className="flex items-center justify-between mb-3">
                  {renderStars(supplier.rating)}
                  <span className="text-xs text-muted-foreground">{supplier.rating.toFixed(1)}</span>
                </div>

                <div className="flex gap-2 mb-3">
                  {supplier.tradeDiscount && (
                    <Badge variant="outline" className="text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      Trade
                    </Badge>
                  )}
                  {supplier.deliveryAvailable && (
                    <Badge variant="outline" className="text-xs">
                      <Truck className="h-3 w-3 mr-1" />
                      Delivery
                    </Badge>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(supplier.url, '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Visit Website
                </Button>
              </Card>
            ))}
          </div>

          {stateSuppliers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No suppliers found matching your criteria.
            </div>
          )}
        </>
      )}

      {viewMode === "prices" && (
        <>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Sample price benchmarks for common building materials. Prices are indicative and subject to change.
            </p>
          </div>

          <div className="space-y-6">
            {Object.entries(BENCHMARK_PRICES).map(([product, prices]) => {
              const { min, max, avg } = getPriceComparison(prices);
              const entries = Object.entries(prices).sort((a, b) => a[1] - b[1]);

              return (
                <Card key={product} className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{product}</h3>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600">
                        <TrendingDown className="h-4 w-4 inline mr-1" />
                        ${min.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground">
                        <Minus className="h-4 w-4 inline mr-1" />
                        ${avg.toFixed(2)} avg
                      </span>
                      <span className="text-red-600">
                        <TrendingUp className="h-4 w-4 inline mr-1" />
                        ${max.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">vs Avg</TableHead>
                        <TableHead className="text-right">Savings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map(([supplier, price], idx) => {
                        const vsAvg = ((price - avg) / avg * 100);
                        const savings = max - price;
                        const isCheapest = idx === 0;

                        return (
                          <TableRow key={supplier} className={isCheapest ? "bg-green-50" : ""}>
                            <TableCell className="font-medium">
                              {supplier}
                              {isCheapest && (
                                <Badge className="ml-2 bg-green-600">Best Price</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${price.toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${vsAvg < 0 ? 'text-green-600' : vsAvg > 0 ? 'text-red-600' : ''}`}>
                              {vsAvg > 0 ? '+' : ''}{vsAvg.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                              ${savings.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              );
            })}
          </div>

          <Card className="p-4 mt-6 bg-muted/50">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Prices shown are sample benchmarks for demonstration.
              Actual prices vary by location, quantity, and supplier agreements.
              Always request quotes for accurate pricing.
            </p>
          </Card>
        </>
      )}
    </Card>
  );
};
