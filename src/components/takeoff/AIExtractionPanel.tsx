import React, { useState, useCallback } from 'react';
import { Loader2, Sparkles, FileSearch, Table2, Ruler, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  pdfExtractionApi,
  isPDFExtractionAvailable,
  ExtractionResponse,
  PageAnalysis,
  DimensionExtraction,
  ExtractedTable,
  OCRResult,
} from '@/lib/api/pdfExtractionApi';

interface AIExtractionPanelProps {
  pdfFile: File | null;
  pdfUrl: string | null;
  currentPage: number;
  onDimensionsExtracted?: (dimensions: DimensionExtraction[]) => void;
  onTablesExtracted?: (tables: ExtractedTable[]) => void;
  onTextExtracted?: (text: string) => void;
}

type ExtractionStatus = 'idle' | 'checking' | 'extracting' | 'success' | 'error';

export const AIExtractionPanel: React.FC<AIExtractionPanelProps> = ({
  pdfFile,
  pdfUrl,
  currentPage,
  onDimensionsExtracted,
  onTablesExtracted,
  onTextExtracted,
}) => {
  const [status, setStatus] = useState<ExtractionStatus>('idle');
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDimensions, setSelectedDimensions] = useState<Set<string>>(new Set());

  // Collapsible sections
  const [dimensionsOpen, setDimensionsOpen] = useState(true);
  const [tablesOpen, setTablesOpen] = useState(true);
  const [textOpen, setTextOpen] = useState(false);

  // Check API availability
  const checkAPIAvailability = useCallback(async () => {
    setStatus('checking');
    const available = await isPDFExtractionAvailable();
    setApiAvailable(available);
    setStatus('idle');

    if (!available) {
      setError('PDF extraction API not available. Start the backend server.');
    }
    return available;
  }, []);

  // Perform extraction
  const handleExtract = useCallback(async () => {
    if (!pdfFile) {
      toast.error('No PDF file loaded');
      return;
    }

    // Check API first
    if (apiAvailable === null) {
      const available = await checkAPIAvailability();
      if (!available) return;
    } else if (!apiAvailable) {
      toast.error('PDF extraction API not available');
      return;
    }

    setStatus('extracting');
    setError(null);

    const result = await pdfExtractionApi.extractPDF(pdfFile, {
      extractLayout: true,
      extractText: true,
      extractTables: true,
      extractDimensions: true,
      dpi: 200,
    });

    if (result.success && result.data) {
      setExtractionResult(result.data);
      setStatus('success');

      // Notify parent of extracted data
      const currentPageData = result.data.pages.find(p => p.page_number === currentPage);
      if (currentPageData) {
        onDimensionsExtracted?.(currentPageData.dimensions);
        onTablesExtracted?.(currentPageData.tables);
        onTextExtracted?.(currentPageData.ocr_results.map(r => r.text).join(' '));
      }

      toast.success(`Extracted data from ${result.data.total_pages} pages`);
    } else {
      setError(result.error || 'Extraction failed');
      setStatus('error');
      toast.error(result.error || 'Extraction failed');
    }
  }, [pdfFile, apiAvailable, currentPage, checkAPIAvailability, onDimensionsExtracted, onTablesExtracted, onTextExtracted]);

  // Get current page data
  const currentPageData: PageAnalysis | undefined = extractionResult?.pages.find(
    p => p.page_number === currentPage
  );

  // Toggle dimension selection
  const toggleDimension = (id: string) => {
    setSelectedDimensions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all dimensions on current page
  const selectAllDimensions = () => {
    if (currentPageData) {
      setSelectedDimensions(new Set(currentPageData.dimensions.map(d => d.id)));
    }
  };

  // Format dimension for display
  const formatDimension = (dim: DimensionExtraction): string => {
    const normalized = pdfExtractionApi.normalizeDimension(dim);
    if (dim.dimension_type === 'area') {
      return `${normalized.toFixed(2)} m²`;
    }
    if (normalized >= 1) {
      return `${normalized.toFixed(2)} m`;
    }
    return `${(normalized * 1000).toFixed(0)} mm`;
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI Extraction</h3>
        </div>
        {apiAvailable === true && (
          <Badge variant="outline" className="text-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            API Ready
          </Badge>
        )}
        {apiAvailable === false && (
          <Badge variant="outline" className="text-red-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            API Offline
          </Badge>
        )}
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        onClick={handleExtract}
        disabled={!pdfFile || status === 'extracting' || status === 'checking'}
        className="w-full"
      >
        {status === 'checking' && (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Checking API...
          </>
        )}
        {status === 'extracting' && (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Extracting...
          </>
        )}
        {(status === 'idle' || status === 'success' || status === 'error') && (
          <>
            <FileSearch className="h-4 w-4 mr-2" />
            {extractionResult ? 'Re-extract PDF' : 'Extract PDF Content'}
          </>
        )}
      </Button>

      {extractionResult && (
        <div className="text-xs text-muted-foreground">
          Processed {extractionResult.total_pages} pages in {(extractionResult.processing_time_ms / 1000).toFixed(1)}s
        </div>
      )}

      {/* Dimensions Section */}
      {currentPageData && currentPageData.dimensions.length > 0 && (
        <Collapsible open={dimensionsOpen} onOpenChange={setDimensionsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              <span className="font-medium text-sm">Dimensions</span>
              <Badge variant="secondary" className="text-xs">
                {currentPageData.dimensions.length}
              </Badge>
            </div>
            {dimensionsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 pt-2">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllDimensions}>
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDimensions(new Set())}
                >
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {currentPageData.dimensions.map((dim) => (
                    <div
                      key={dim.id}
                      className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded text-sm"
                    >
                      <Checkbox
                        checked={selectedDimensions.has(dim.id)}
                        onCheckedChange={() => toggleDimension(dim.id)}
                      />
                      <span className="flex-1 font-mono">{dim.text}</span>
                      <Badge variant="outline" className="text-xs">
                        {formatDimension(dim)}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {dim.dimension_type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {selectedDimensions.size > 0 && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const dims = currentPageData.dimensions.filter(d => selectedDimensions.has(d.id));
                    onDimensionsExtracted?.(dims);
                    toast.success(`Added ${dims.length} dimensions to measurements`);
                  }}
                >
                  Add {selectedDimensions.size} to Measurements
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Tables Section */}
      {currentPageData && currentPageData.tables.length > 0 && (
        <Collapsible open={tablesOpen} onOpenChange={setTablesOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2">
            <div className="flex items-center gap-2">
              <Table2 className="h-4 w-4" />
              <span className="font-medium text-sm">Tables</span>
              <Badge variant="secondary" className="text-xs">
                {currentPageData.tables.length}
              </Badge>
            </div>
            {tablesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="h-48 pt-2">
              <div className="space-y-2">
                {currentPageData.tables.map((table) => (
                  <div key={table.id} className="p-2 border rounded text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Table ({table.rows}x{table.cols})</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onTablesExtracted?.([table]);
                          toast.success('Table data extracted');
                        }}
                      >
                        Use Table
                      </Button>
                    </div>
                    {table.html && (
                      <div
                        className="text-xs overflow-auto max-h-24 border rounded p-1 bg-muted/30"
                        dangerouslySetInnerHTML={{ __html: table.html }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Text/OCR Section */}
      {currentPageData && currentPageData.ocr_results.length > 0 && (
        <Collapsible open={textOpen} onOpenChange={setTextOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4" />
              <span className="font-medium text-sm">Extracted Text</span>
              <Badge variant="secondary" className="text-xs">
                {currentPageData.ocr_results.length} blocks
              </Badge>
            </div>
            {textOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="h-48 pt-2">
              <div className="text-xs font-mono whitespace-pre-wrap p-2 bg-muted/30 rounded">
                {currentPageData.ocr_results.map(r => r.text).join('\n')}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* No data message */}
      {extractionResult && !currentPageData && (
        <div className="text-sm text-muted-foreground text-center py-4">
          No data extracted for page {currentPage + 1}
        </div>
      )}

      {/* API instructions */}
      {apiAvailable === false && (
        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded">
          <p className="font-medium">To enable AI extraction:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Navigate to the backend directory</li>
            <li>Run: <code className="bg-muted px-1 rounded">pip install -r requirements.txt</code></li>
            <li>Start: <code className="bg-muted px-1 rounded">python main.py</code></li>
          </ol>
        </div>
      )}
    </Card>
  );
};
