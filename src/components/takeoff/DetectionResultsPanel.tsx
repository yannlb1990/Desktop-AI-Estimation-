import React, { useState, useCallback } from 'react';
import {
  Loader2, ScanLine, DoorOpen, Square, Zap, Droplets,
  ChevronRight, MapPin, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  extractOpeningsAllPages,
  extractTextFromPDF,
  countSymbolReferences,
  DetectedOpening,
} from '@/lib/takeoff/pdfTextExtractor';

interface DetectionResultsPanelProps {
  pdfUrl: string | null;
  totalPages: number;
  /** Called when the user clicks "View" on a specific opening — jump to that page */
  onJumpToPage?: (pageIndex: number) => void;
  /** Called when scan finishes — passes all detected openings to parent */
  onScanComplete?: (openings: DetectedOpening[]) => void;
}

interface SymbolTotals {
  GPO: number;
  lights: number;
  switches: number;
  smokeDetectors: number;
  exhaustFans: number;
  toilets: number;
  basins: number;
  showers: number;
}

interface ScanResult {
  openings: DetectedOpening[];
  symbols: SymbolTotals;
}

type SheetCategory = 'windows' | 'doors' | null;

const SOURCE_LABEL: Record<string, string> = {
  merged:     '✓ Plan + Schedule',
  floor_plan: 'Floor Plan',
  schedule:   'Schedule Only',
};

export const DetectionResultsPanel: React.FC<DetectionResultsPanelProps> = ({
  pdfUrl,
  totalPages,
  onJumpToPage,
  onScanComplete,
}) => {
  const [scanning, setScanning]         = useState(false);
  const [progress, setProgress]         = useState(0);
  const [result, setResult]             = useState<ScanResult | null>(null);
  const [activeSheet, setActiveSheet]   = useState<SheetCategory>(null);

  const runScan = useCallback(async () => {
    if (!pdfUrl) return;
    setScanning(true);
    setProgress(0);
    setResult(null);

    try {
      const openings = await extractOpeningsAllPages(pdfUrl, totalPages, (done) => {
        setProgress(Math.round((done / totalPages) * 85)); // 0→85% for openings phase
      });

      // Count services symbols across all pages
      const symbols: SymbolTotals = {
        GPO: 0, lights: 0, switches: 0,
        smokeDetectors: 0, exhaustFans: 0,
        toilets: 0, basins: 0, showers: 0,
      };

      for (let p = 0; p < totalPages; p++) {
        const texts = await extractTextFromPDF(pdfUrl, p);
        const refs  = countSymbolReferences(texts);
        symbols.GPO            += refs.GPO            || 0;
        symbols.lights         += refs.lights         || 0;
        symbols.switches       += refs.switches       || 0;
        symbols.smokeDetectors += refs.smokeDetectors || 0;
        symbols.exhaustFans    += refs.exhaustFans    || 0;
        symbols.toilets        += refs.toilets        || 0;
        symbols.basins         += refs.basins         || 0;
        symbols.showers        += refs.showers        || 0;
        setProgress(85 + Math.round(((p + 1) / totalPages) * 15));
      }

      setResult({ openings, symbols });
      onScanComplete?.(openings);
      const w = openings.filter(o => o.type === 'window').length;
      const d = openings.filter(o => o.type === 'door').length;
      toast.success(`Scan complete — ${w} window${w !== 1 ? 's' : ''}, ${d} door${d !== 1 ? 's' : ''} found across ${totalPages} page${totalPages !== 1 ? 's' : ''}`);
    } catch (err) {
      toast.error('Scan failed — see console');
      console.error(err);
    } finally {
      setScanning(false);
      setProgress(100);
    }
  }, [pdfUrl, totalPages]);

  const windows         = result?.openings.filter(o => o.type === 'window') ?? [];
  const doors           = result?.openings.filter(o => o.type === 'door')   ?? [];
  const sheetItems      = activeSheet === 'windows' ? windows : doors;
  const hasServices     = result && Object.values(result.symbols).some(v => v > 0);

  const confColor = (c: number) =>
    c >= 0.9 ? 'text-green-600' : c >= 0.7 ? 'text-amber-600' : 'text-muted-foreground';

  return (
    <>
      <Card className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Opening Detection</h3>
          </div>
          {result && (
            <Badge variant="outline" className="text-xs text-green-600 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />Scanned
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Scans all {totalPages} page{totalPages !== 1 ? 's' : ''} for windows, doors,
          and building services — merges schedule data with floor-plan tags.
        </p>

        <Button
          onClick={runScan}
          disabled={!pdfUrl || scanning}
          className="w-full"
          variant={result ? 'outline' : 'default'}
        >
          {scanning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Scanning page {Math.ceil((progress / 100) * totalPages)} of {totalPages}…
            </>
          ) : (
            <>
              <ScanLine className="h-4 w-4 mr-2" />
              {result ? 'Re-scan All Pages' : 'Scan All Pages for Openings'}
            </>
          )}
        </Button>

        {scanning && <Progress value={progress} className="h-1.5" />}

        {/* Results */}
        {result && (
          <div className="space-y-3">
            {/* Openings */}
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Openings Detected
            </p>

            <div className="grid grid-cols-2 gap-2">
              {/* Windows chip */}
              <button
                className="flex items-center justify-between p-3 rounded-lg border bg-blue-50 border-blue-200 hover:bg-blue-100 active:scale-95 transition-all text-left"
                onClick={() => setActiveSheet('windows')}
              >
                <div className="flex items-center gap-1.5">
                  <Square className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Windows</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xl font-bold text-blue-700">{windows.length}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-blue-400" />
                </div>
              </button>

              {/* Doors chip */}
              <button
                className="flex items-center justify-between p-3 rounded-lg border bg-amber-50 border-amber-200 hover:bg-amber-100 active:scale-95 transition-all text-left"
                onClick={() => setActiveSheet('doors')}
              >
                <div className="flex items-center gap-1.5">
                  <DoorOpen className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-900">Doors</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xl font-bold text-amber-700">{doors.length}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-amber-400" />
                </div>
              </button>
            </div>

            {/* Nothing found warning */}
            {windows.length === 0 && doors.length === 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">No openings detected</p>
                  <p className="mt-0.5 text-amber-700">
                    Check that the uploaded file includes a floor plan with W/D tags or a
                    window/door schedule with dimensions.
                  </p>
                </div>
              </div>
            )}

            {/* Services symbols */}
            {hasServices && (
              <>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">
                  Services Symbols
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {result.symbols.GPO > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-purple-50 border border-purple-100 text-xs">
                      <span className="flex items-center gap-1 text-purple-800">
                        <Zap className="h-3 w-3" />GPO
                      </span>
                      <span className="font-bold text-purple-700">{result.symbols.GPO}</span>
                    </div>
                  )}
                  {result.symbols.lights > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-yellow-50 border border-yellow-100 text-xs">
                      <span className="text-yellow-800">Lights</span>
                      <span className="font-bold text-yellow-700">{result.symbols.lights}</span>
                    </div>
                  )}
                  {result.symbols.switches > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-yellow-50 border border-yellow-100 text-xs">
                      <span className="text-yellow-800">Switches</span>
                      <span className="font-bold text-yellow-700">{result.symbols.switches}</span>
                    </div>
                  )}
                  {result.symbols.smokeDetectors > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-red-50 border border-red-100 text-xs">
                      <span className="text-red-800">Smoke Det.</span>
                      <span className="font-bold text-red-700">{result.symbols.smokeDetectors}</span>
                    </div>
                  )}
                  {result.symbols.exhaustFans > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-slate-50 border border-slate-100 text-xs">
                      <span className="text-slate-700">Exhaust Fans</span>
                      <span className="font-bold text-slate-700">{result.symbols.exhaustFans}</span>
                    </div>
                  )}
                  {result.symbols.toilets > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-cyan-50 border border-cyan-100 text-xs">
                      <span className="flex items-center gap-1 text-cyan-800">
                        <Droplets className="h-3 w-3" />WC
                      </span>
                      <span className="font-bold text-cyan-700">{result.symbols.toilets}</span>
                    </div>
                  )}
                  {result.symbols.basins > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-cyan-50 border border-cyan-100 text-xs">
                      <span className="flex items-center gap-1 text-cyan-800">
                        <Droplets className="h-3 w-3" />Basin
                      </span>
                      <span className="font-bold text-cyan-700">{result.symbols.basins}</span>
                    </div>
                  )}
                  {result.symbols.showers > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-cyan-50 border border-cyan-100 text-xs">
                      <span className="flex items-center gap-1 text-cyan-800">
                        <Droplets className="h-3 w-3" />Shower
                      </span>
                      <span className="font-bold text-cyan-700">{result.symbols.showers}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Detail sheet — shown when user clicks Windows or Doors chip */}
      <Sheet open={activeSheet !== null} onOpenChange={(open) => !open && setActiveSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle className="flex items-center gap-2 text-lg">
              {activeSheet === 'windows' ? (
                <><Square className="h-5 w-5 text-blue-600" />{windows.length} Windows Detected</>
              ) : (
                <><DoorOpen className="h-5 w-5 text-amber-600" />{doors.length} Doors Detected</>
              )}
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              {onJumpToPage
                ? 'Click "View" to jump to the page where each opening was found.'
                : 'Full list of detected openings with dimensions and source confidence.'}
            </p>
          </SheetHeader>

          <ScrollArea className="flex-1 mt-4 -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 font-semibold">Ref</TableHead>
                  <TableHead className="font-semibold">Size</TableHead>
                  <TableHead className="w-20 font-semibold">Page</TableHead>
                  <TableHead className="font-semibold">Source</TableHead>
                  <TableHead className="w-24 font-semibold">Confidence</TableHead>
                  {onJumpToPage && <TableHead className="w-16"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheetItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={onJumpToPage ? 6 : 5} className="text-center py-10 text-muted-foreground">
                      No {activeSheet} detected
                    </TableCell>
                  </TableRow>
                ) : (
                  sheetItems.map((item) => (
                    <TableRow key={item.ref} className="group">
                      <TableCell className="font-mono font-bold text-base">{item.ref}</TableCell>
                      <TableCell>
                        {item.width && item.height ? (
                          <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                            {item.width}×{item.height}mm
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">No dimensions</span>
                        )}
                        {item.description && item.width && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">
                            {item.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <MapPin className="h-2.5 w-2.5" />p.{item.page + 1}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{SOURCE_LABEL[item.source] ?? item.source}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold ${confColor(item.confidence)}`}>
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </TableCell>
                      {onJumpToPage && (
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              onJumpToPage(item.page);
                              setActiveSheet(null);
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
};
