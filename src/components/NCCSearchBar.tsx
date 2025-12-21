import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { searchNCC } from "@/data/nccReferences";

export const NCCSearchBar = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [summary, setSummary] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = () => {
    setIsSearching(true);
    const results = searchNCC(searchQuery);
    
    if (results.length > 0) {
      const topResult = results[0];
      setSummary(topResult.description);
      setCurrentUrl(topResult.url);
      toast.success("NCC reference found");
    } else {
      setSummary("No specific NCC reference found. Try keywords like: footings, framing, spacing, insulation, waterproofing, fire, ceiling height, stairs, ventilation, glazing, BAL ratings, energy efficiency");
      setCurrentUrl("");
      toast.info("Try different keywords");
    }
    setIsSearching(false);
  };

  const openNccLink = () => {
    if (currentUrl) {
      window.open(currentUrl, '_blank', 'noopener,noreferrer');
      toast.success("Opening NCC reference in new tab");
    } else {
      window.open('https://ncc.abcb.gov.au/', '_blank', 'noopener,noreferrer');
      toast.info("Opening NCC main website");
    }
  };

  return (
    <Card className="p-6">
      <h3 className="font-display text-xl font-bold mb-4">NCC Standards Research</h3>
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Search NCC standards (e.g., footings, framing, spacing, insulation...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={isSearching}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
        <Button onClick={openNccLink} variant="outline">
          <ExternalLink className="h-4 w-4 mr-2" />
          Open NCC
        </Button>
      </div>
      
      {summary && (
        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-semibold mb-2">NCC Summary:</h4>
          <p className="text-sm">{summary}</p>
        </div>
      )}
    </Card>
  );
};
