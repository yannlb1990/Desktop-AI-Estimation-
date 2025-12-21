import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SearchResult {
  supplier: string;
  title: string;
  priceRange: string;
  url: string;
  description?: string;
  category: string;
}

// Material categories and their relevant suppliers with indicative price ranges
const MATERIAL_SUPPLIERS: Record<string, { supplier: string; priceRange: string; url: string; description: string }[]> = {
  timber: [
    { supplier: "Bunnings", priceRange: "$8-45/LM", url: "https://www.bunnings.com.au/search/products?search=timber%20framing", description: "Structural & framing timber" },
    { supplier: "Mitre 10", priceRange: "$10-50/LM", url: "https://www.mitre10.com.au/search?text=timber", description: "Quality timber supplies" },
    { supplier: "Tradelink", priceRange: "$12-55/LM", url: "https://www.tradelink.com.au/search?q=timber", description: "Trade timber specialist" },
  ],
  plumbing: [
    { supplier: "Reece", priceRange: "$5-250/unit", url: "https://www.reece.com.au/search?q=plumbing", description: "Premium plumbing supplies" },
    { supplier: "Tradelink", priceRange: "$4-220/unit", url: "https://www.tradelink.com.au/search?q=plumbing", description: "Trade plumbing solutions" },
    { supplier: "Bunnings", priceRange: "$3-180/unit", url: "https://www.bunnings.com.au/search/products?search=plumbing", description: "Retail plumbing range" },
  ],
  electrical: [
    { supplier: "Total Tools", priceRange: "$15-350/item", url: "https://www.totaltools.com.au/search?q=electrical", description: "Professional electrical supplies" },
    { supplier: "Bunnings", priceRange: "$8-280/item", url: "https://www.bunnings.com.au/search/products?search=electrical", description: "Electrical hardware & cables" },
  ],
  cladding: [
    { supplier: "Bunnings", priceRange: "$35-180/sheet", url: "https://www.bunnings.com.au/our-range/building-hardware/external-cladding", description: "External cladding systems" },
    { supplier: "Mitre 10", priceRange: "$40-200/sheet", url: "https://www.mitre10.com.au/building-construction/cladding", description: "Weatherboard & cladding" },
  ],
  roofing: [
    { supplier: "Bunnings", priceRange: "$18-85/LM", url: "https://www.bunnings.com.au/our-range/building-hardware/roofing", description: "Colorbond & roofing materials" },
    { supplier: "Mitre 10", priceRange: "$20-90/LM", url: "https://www.mitre10.com.au/building-construction/roofing", description: "Roof sheets & accessories" },
  ],
  concrete: [
    { supplier: "Bunnings", priceRange: "$8-25/bag", url: "https://www.bunnings.com.au/our-range/building-hardware/cement-concrete-sand", description: "Cement, concrete & premix" },
    { supplier: "Mitre 10", priceRange: "$9-28/bag", url: "https://www.mitre10.com.au/building-construction/concrete-cement", description: "Concrete supplies" },
  ],
  tiles: [
    { supplier: "Bunnings", priceRange: "$15-120/m²", url: "https://www.bunnings.com.au/our-range/bathrooms-plumbing/tiles", description: "Wall & floor tiles" },
    { supplier: "Reece", priceRange: "$25-180/m²", url: "https://www.reece.com.au/bathrooms/tiles", description: "Premium tile range" },
  ],
  paint: [
    { supplier: "Bunnings", priceRange: "$45-185/4L", url: "https://www.bunnings.com.au/our-range/paint-decorating/paint", description: "Interior & exterior paints" },
    { supplier: "Mitre 10", priceRange: "$48-195/4L", url: "https://www.mitre10.com.au/decorating/paint", description: "Trade quality paints" },
  ],
  insulation: [
    { supplier: "Bunnings", priceRange: "$8-35/m²", url: "https://www.bunnings.com.au/our-range/building-hardware/insulation", description: "Thermal & acoustic insulation" },
    { supplier: "Mitre 10", priceRange: "$9-38/m²", url: "https://www.mitre10.com.au/building-construction/insulation", description: "Insulation batts & boards" },
  ],
  hardware: [
    { supplier: "Total Tools", priceRange: "$2-150/item", url: "https://www.totaltools.com.au/", description: "Professional tools & hardware" },
    { supplier: "Bunnings", priceRange: "$1-120/item", url: "https://www.bunnings.com.au/our-range/tools", description: "General hardware & fixings" },
  ]
};

export const MaterialPriceSearch = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const detectMaterialCategory = (term: string): string => {
    const lower = term.toLowerCase();
    if (lower.includes("timber") || lower.includes("wood") || lower.includes("framing") || lower.includes("mgp")) return "timber";
    if (lower.includes("pipe") || lower.includes("plumb") || lower.includes("tap") || lower.includes("drain")) return "plumbing";
    if (lower.includes("cable") || lower.includes("wire") || lower.includes("switch") || lower.includes("electrical")) return "electrical";
    if (lower.includes("clad") || lower.includes("weatherboard") || lower.includes("panel")) return "cladding";
    if (lower.includes("roof") || lower.includes("colorbond") || lower.includes("gutter") || lower.includes("flashing")) return "roofing";
    if (lower.includes("concrete") || lower.includes("cement") || lower.includes("mix")) return "concrete";
    if (lower.includes("tile") || lower.includes("porcelain") || lower.includes("ceramic")) return "tiles";
    if (lower.includes("paint") || lower.includes("primer") || lower.includes("sealer")) return "paint";
    if (lower.includes("insulation") || lower.includes("batt") || lower.includes("sarking")) return "insulation";
    return "hardware";
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setLoading(true);
    
    const category = detectMaterialCategory(searchTerm);
    const categorySuppliers = MATERIAL_SUPPLIERS[category] || [];
    
    // Get relevant suppliers or fallback to general search
    const searchResults: SearchResult[] = categorySuppliers.length > 0 
      ? categorySuppliers.map(s => ({
          supplier: s.supplier,
          title: searchTerm,
          priceRange: s.priceRange,
          url: s.url,
          description: s.description,
          category: category
        }))
      : [
          {
            supplier: "Bunnings Warehouse",
            title: searchTerm,
            priceRange: "View pricing",
            url: `https://www.bunnings.com.au/search/products?q=${encodeURIComponent(searchTerm)}`,
            description: "Australia's leading hardware retailer",
            category: "general"
          },
          {
            supplier: "Mitre 10",
            title: searchTerm,
            priceRange: "Compare prices",
            url: `https://www.mitre10.com.au/search?text=${encodeURIComponent(searchTerm)}`,
            description: "Home improvement specialist",
            category: "general"
          },
          {
            supplier: "Reece",
            title: searchTerm,
            priceRange: "Trade pricing",
            url: `https://www.reece.com.au/search/${encodeURIComponent(searchTerm)}`,
            description: "Plumbing & bathroom specialist",
            category: "general"
          }
        ];
    
    setResults(searchResults);
    setLoading(false);
    toast.success(`Found ${searchResults.length} relevant suppliers for ${category}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Card className="p-6">
      <h3 className="font-display text-xl font-bold mb-4">Australian Material Price Search</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Search across major Australian building suppliers for current material prices
      </p>
      
      <div className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., 90x45 MGP10, Colorbond roofing, PVC pipe..."
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Search
            </>
          )}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Search Results ({results.length} suppliers)</h4>
            <p className="text-xs text-muted-foreground">Click links to compare prices</p>
          </div>
          
          <div className="grid gap-3">
            {results.map((result, idx) => (
              <div key={idx} className="border border-border rounded-lg p-4 hover:border-primary transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{result.supplier}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="font-mono text-lg font-bold text-accent">{result.priceRange}</span>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{result.category}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{result.description}</p>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View on {result.supplier}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(result.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Visit
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Prices shown are indicative. Click through to suppliers for current pricing, 
              availability, and detailed product specifications. Prices may vary by location and quantity.
            </p>
          </div>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Enter a material name to search Australian suppliers</p>
        </div>
      )}
    </Card>
  );
};