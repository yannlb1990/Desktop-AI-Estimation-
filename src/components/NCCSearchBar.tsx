import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ExternalLink, BookOpen, ChevronDown, ChevronUp, Info } from "lucide-react";
import { toast } from "sonner";
import { searchNCC, NCCReference } from "@/data/nccReferences";

export const NCCSearchBar = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<NCCReference[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.info("Enter a search term");
      return;
    }
    setIsSearching(true);
    const searchResults = searchNCC(searchQuery);
    setResults(searchResults);

    if (searchResults.length > 0) {
      toast.success(`Found ${searchResults.length} NCC reference${searchResults.length > 1 ? 's' : ''}`);
      setExpandedId(searchResults[0].id); // Auto-expand first result
    } else {
      toast.info("No results. Try: footings, framing, insulation, waterproofing, fire, stairs, ventilation");
    }
    setIsSearching(false);
  };

  const getSearchUrl = (ref: NCCReference) => {
    const query = encodeURIComponent(`NCC 2022 ${ref.section} ${ref.title} site:ncc.abcb.gov.au OR ABCB`);
    return `https://www.google.com/search?q=${query}`;
  };

  const openNccLink = (url?: string) => {
    const targetUrl = url || 'https://ncc.abcb.gov.au/';
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    toast.success("Opening NCC search in new tab");
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Structure': 'bg-muted/20 text-foreground/90',
      'Fire Safety': 'bg-red-100 text-red-800',
      'Access & Egress': 'bg-muted/20 text-foreground/80',
      'Health & Amenity': 'bg-muted/15 text-muted-foreground',
      'Energy Efficiency': 'bg-amber-100 text-amber-800',
      'Plumbing': 'bg-muted/15 text-[#E1DCC9]/90',
      'Electrical': 'bg-yellow-100 text-yellow-800',
      'Governing Requirements': 'bg-gray-100 text-gray-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5 text-primary" />
        <h3 className="font-display text-xl font-bold">NCC Standards Research</h3>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Search NCC standards (e.g., footings, framing, insulation, waterproofing...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={isSearching}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
        <Button onClick={() => openNccLink()} variant="outline">
          <ExternalLink className="h-4 w-4 mr-2" />
          NCC Website
        </Button>
      </div>

      {/* Quick Search Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs text-muted-foreground">Quick searches:</span>
        {['waterproofing', 'insulation', 'fire rating', 'stairs', 'ceiling height', 'ventilation', 'glazing'].map(term => (
          <Badge
            key={term}
            variant="outline"
            className="cursor-pointer hover:bg-primary/10"
            onClick={() => {
              setSearchQuery(term);
              setIsSearching(true);
              const searchResults = searchNCC(term);
              setResults(searchResults);
              if (searchResults.length > 0) {
                setExpandedId(searchResults[0].id);
              }
              setIsSearching(false);
            }}
          >
            {term}
          </Badge>
        ))}
      </div>

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground">
            {results.length} result{results.length > 1 ? 's' : ''} found
          </h4>

          {results.map(ref => (
            <div
              key={ref.id}
              className="border rounded-lg overflow-hidden"
            >
              {/* Header - Always visible */}
              <div
                className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted/80"
                onClick={() => setExpandedId(expandedId === ref.id ? null : ref.id)}
              >
                <div className="flex items-center gap-3">
                  <Badge className={getCategoryColor(ref.category)}>
                    {ref.category}
                  </Badge>
                  <div>
                    <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded mr-2">
                      {ref.section}
                    </span>
                    <span className="font-medium text-sm">{ref.title}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openNccLink(getSearchUrl(ref));
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  {expandedId === ref.id ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === ref.id && (
                <div className="p-4 bg-background border-t space-y-3">
                  {/* Short Description */}
                  <p className="text-sm">{ref.description}</p>

                  {/* Estimation Details - Key info for estimators */}
                  {ref.estimationNotes && (
                    <div className="bg-muted/10 dark:bg-background p-3 rounded-md">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-foreground/70 mt-0.5 shrink-0" />
                        <div>
                          <h5 className="font-semibold text-sm text-foreground/90 dark:text-foreground/80 mb-1">
                            Estimation Notes
                          </h5>
                          <p className="text-sm text-foreground/80 dark:text-foreground/70 whitespace-pre-line">
                            {ref.estimationNotes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Key Requirements */}
                  {ref.keyRequirements && ref.keyRequirements.length > 0 && (
                    <div className="space-y-1">
                      <h5 className="font-semibold text-sm">Key Requirements:</h5>
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {ref.keyRequirements.map((req, idx) => (
                          <li key={idx}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Quantity Required */}
                  {ref.quantityRequired && (
                    <div className="bg-blue-50/10 dark:bg-blue-950/20 border border-blue-200/20 rounded-md p-3">
                      <h5 className="font-semibold text-xs text-blue-400 mb-1 uppercase tracking-wide">Quantity Required</h5>
                      <p className="text-sm text-foreground/80 leading-snug">{ref.quantityRequired}</p>
                    </div>
                  )}

                  {/* Spacing Requirements */}
                  {ref.spacingRequirements && (
                    <div className="bg-purple-50/10 dark:bg-purple-950/20 border border-purple-200/20 rounded-md p-3">
                      <h5 className="font-semibold text-xs text-purple-400 mb-1 uppercase tracking-wide">Spacing Requirements</h5>
                      <p className="text-sm text-foreground/80 leading-snug">{ref.spacingRequirements}</p>
                    </div>
                  )}

                  {/* Installation Method */}
                  {ref.installationMethod && (
                    <div className="bg-emerald-50/10 dark:bg-emerald-950/20 border border-emerald-200/20 rounded-md p-3">
                      <h5 className="font-semibold text-xs text-emerald-400 mb-1 uppercase tracking-wide">Installation Method</h5>
                      <p className="text-sm text-foreground/80 leading-snug">{ref.installationMethod}</p>
                    </div>
                  )}

                  {/* Keywords */}
                  <div className="flex flex-wrap gap-1">
                    {ref.keywords.map(keyword => (
                      <Badge key={keyword} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>

                  {/* Link to NCC */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openNccLink(getSearchUrl(ref))}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Search NCC Online ({ref.section})
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && searchQuery && !isSearching && (
        <div className="bg-muted p-4 rounded-lg text-center">
          <p className="text-sm text-muted-foreground">
            No results found for "{searchQuery}". Try different keywords like:
          </p>
          <p className="text-sm font-medium mt-1">
            footings, framing, insulation, waterproofing, fire, ceiling height, stairs, ventilation, glazing, BAL
          </p>
        </div>
      )}
    </Card>
  );
};
