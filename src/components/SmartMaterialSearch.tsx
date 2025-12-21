import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Fuse from "fuse.js";
import { AUSTRALIAN_MATERIALS } from "@/data/australianMaterials";

interface SearchSuggestion {
  type: string;
  examples: string[];
}

interface SearchResult {
  supplier: string;
  title: string;
  priceRange: string;
  url: string;
  description?: string;
  category: string;
  benchmark: "low" | "medium" | "high";
}

export const SmartMaterialSearch = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showClarification, setShowClarification] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setLoading(true);

    try {
      // Try AI search first
      const { data, error } = await supabase.functions.invoke('ai-material-search', {
        body: { searchTerm }
      });

      if (error) {
        // If AI credits depleted (402) or rate limited (429), fallback to local search
        if (error.message?.includes('402') || error.message?.includes('credits') || 
            error.message?.includes('429') || error.message?.includes('rate limit')) {
          toast.info("Using local search (AI unavailable)");
          performLocalSearch();
          return;
        } else {
          toast.error("Search failed. Using local fallback.");
          performLocalSearch();
          return;
        }
      }

      if (data.error) {
        toast.error("Using local search");
        performLocalSearch();
        return;
      }

      if (data.needsClarification) {
        setSuggestions(data.suggestions || []);
        setShowClarification(true);
        setLoading(false);
        return;
      }

      setResults(data.results || []);
      toast.success(`Found ${data.results?.length || 0} suppliers`);
    } catch (error) {
      console.error("Search error:", error);
      toast.info("Using local search");
      performLocalSearch();
    } finally {
      setLoading(false);
    }
  };

  const performLocalSearch = () => {
    // Fuzzy search with Fuse.js
    const fuse = new Fuse(AUSTRALIAN_MATERIALS, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'category', weight: 0.2 },
        { name: 'subcategory', weight: 0.2 },
        { name: 'description', weight: 0.1 }
      ],
      threshold: 0.3,
      includeScore: true,
    });

    const fuseResults = fuse.search(searchTerm);
    
    // Convert to SearchResult format
    const localResults: SearchResult[] = fuseResults.slice(0, 10).map(result => {
      const item = result.item;
      const avgPrice = item.avgPrice;
      
      // Determine benchmark based on price range
      let benchmark: "low" | "medium" | "high" = "medium";
      if (avgPrice < 10) benchmark = "low";
      else if (avgPrice > 50) benchmark = "high";
      
      return {
        supplier: item.suppliers[0] || "Various",
        title: item.name,
        priceRange: item.priceRange || `$${avgPrice.toFixed(2)}`,
        url: `https://www.bunnings.com.au/search?q=${encodeURIComponent(item.name)}`,
        description: `${item.subcategory} - ${item.unit}`,
        category: item.category,
        benchmark: benchmark
      };
    });

    setResults(localResults);
    setLoading(false);
    toast.success(`Found ${localResults.length} local matches`);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchTerm(suggestion);
    setShowClarification(false);
    setTimeout(() => handleSearch(), 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <>
      <Card className="p-6">
        <h3 className="font-display text-xl font-bold mb-4">Smart Material Price Search</h3>
        <p className="text-sm text-muted-foreground mb-4">
          AI-powered search across major Australian building suppliers
        </p>
        
        <div className="flex gap-2 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., timber screws, plasterboard, copper pipes..."
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
              <p className="text-xs text-muted-foreground">Price benchmarks included</p>
            </div>
            
            <div className="grid gap-3">
              {results.map((result, idx) => (
                <div key={idx} className="border border-border rounded-lg p-4 hover:border-primary transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm">{result.supplier}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="font-mono text-lg font-bold text-accent">{result.priceRange}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          result.benchmark === 'low' ? 'bg-green-500/20 text-green-700 dark:text-green-400' :
                          result.benchmark === 'high' ? 'bg-red-500/20 text-red-700 dark:text-red-400' :
                          'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                        }`}>
                          {result.benchmark === 'low' ? '$ Low' : result.benchmark === 'high' ? '$$$ High' : '$$ Mid'}
                        </span>
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
                <strong>Note:</strong> Price benchmarks are comparative. "Low" indicates below-average market price, 
                "High" indicates premium pricing. Click through for current pricing and availability.
              </p>
            </div>
          </div>
        )}

        {!loading && results.length === 0 && !showClarification && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Enter a material name to search Australian suppliers</p>
            <p className="text-xs mt-2">AI will help you find the most relevant products</p>
          </div>
        )}
      </Card>

      {/* Clarification Dialog */}
      <Dialog open={showClarification} onOpenChange={setShowClarification}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-accent" />
              Can you be more specific?
            </DialogTitle>
            <DialogDescription>
              Your search for "{searchTerm}" is a bit vague. Please select a more specific option:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {suggestions.map((suggestion, idx) => (
              <div key={idx} className="space-y-2">
                <h4 className="font-semibold text-sm">{suggestion.type}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {suggestion.examples.map((example, exIdx) => (
                    <Button
                      key={exIdx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick(example)}
                      className="justify-start"
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
