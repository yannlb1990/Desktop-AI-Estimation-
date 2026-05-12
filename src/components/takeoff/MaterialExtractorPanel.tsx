import React, { useState, useCallback } from 'react';
import { Loader2, Sparkles, PackageSearch, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { extractFullPageText } from '@/lib/takeoff/pdfTextExtractor';
import type { ExtractedMaterial, MaterialExtractionResult, MaterialType } from '@/lib/takeoff/materialExtractorTypes';
import type { Measurement, MeasurementArea } from '@/lib/takeoff/types';

interface MaterialExtractorPanelProps {
  pdfUrl: string | null;
  pageCount: number;
  projectName?: string;
  onImport: (measurements: Measurement[]) => void;
}

const TYPE_COLORS: Record<MaterialType, string> = {
  Structural:  'bg-red-100 text-red-700',
  Connector:   'bg-orange-100 text-orange-700',
  Framing:     'bg-amber-100 text-amber-700',
  Lining:      'bg-yellow-100 text-yellow-700',
  Finish:      'bg-green-100 text-green-700',
  Hardware:    'bg-teal-100 text-teal-700',
  Plumbing:    'bg-blue-100 text-blue-700',
  Electrical:  'bg-purple-100 text-purple-700',
  Other:       'bg-gray-100 text-gray-600',
};

const ROOM_TO_AREA: Record<string, MeasurementArea> = {
  kitchen: 'Kitchen', bathroom: 'Bathroom', bath: 'Bathroom',
  bed: 'Bedroom', bedroom: 'Bedroom', master: 'Bedroom',
  living: 'Living Room', lounge: 'Living Room', family: 'Living Room',
  dining: 'Dining Room', meals: 'Dining Room',
  laundry: 'Laundry', ldry: 'Laundry',
  garage: 'Garage', carport: 'Garage',
  patio: 'Patio', alfresco: 'Patio', deck: 'Patio',
  balcony: 'Balcony',
  hall: 'Hallway', hallway: 'Hallway', corridor: 'Hallway',
  entry: 'Entry', foyer: 'Entry', porch: 'Entry',
  office: 'Office', study: 'Office',
  store: 'Storage', storage: 'Storage', robe: 'Storage', wir: 'Storage',
  utility: 'Utility', plant: 'Utility', mechanical: 'Utility',
  ensuite: 'Ensuite', ens: 'Ensuite',
  wc: 'WC', toilet: 'WC', powder: 'WC',
  external: 'External', site: 'External', landscape: 'External',
};

function roomToArea(room: string): MeasurementArea {
  const lower = room.toLowerCase();
  for (const [key, area] of Object.entries(ROOM_TO_AREA)) {
    if (lower.includes(key)) return area;
  }
  return 'Other';
}

function materialToMeasurement(item: ExtractedMaterial): Measurement {
  return {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'rectangle',
    worldPoints: [],
    worldValue: 0,
    realValue: item.quantity,
    unit: item.unit,
    color: '#10b981',
    label: item.material,
    area: roomToArea(item.room),
    pageIndex: 0,
    timestamp: new Date(),
    comments: `AI extracted — ${item.floor} › ${item.room}`,
  };
}

export const MaterialExtractorPanel: React.FC<MaterialExtractorPanelProps> = ({
  pdfUrl,
  pageCount,
  projectName,
  onImport,
}) => {
  const [status, setStatus] = useState<'idle' | 'reading' | 'analyzing' | 'done' | 'error'>('idle');
  const [items, setItems] = useState<ExtractedMaterial[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [progress, setProgress] = useState('');

  // Group items by floor → room for display
  const grouped = items.reduce<Record<string, Record<string, ExtractedMaterial[]>>>(
    (acc, item, idx) => {
      const f = item.floor || 'Ground Floor';
      const r = item.room || 'General';
      if (!acc[f]) acc[f] = {};
      if (!acc[f][r]) acc[f][r] = [];
      acc[f][r].push({ ...item, _idx: idx } as ExtractedMaterial & { _idx: number });
      return acc;
    },
    {},
  );

  const handleExtract = useCallback(async () => {
    if (!pdfUrl) { toast.error('No PDF loaded'); return; }

    setStatus('reading');
    setError(null);
    setItems([]);
    setSelected(new Set());
    setProgress('Reading PDF text…');

    // Extract text from all pages
    const pageTexts: string[] = [];
    for (let i = 0; i < pageCount; i++) {
      setProgress(`Reading page ${i + 1} of ${pageCount}…`);
      try {
        const text = await extractFullPageText(pdfUrl, i);
        if (text.trim()) pageTexts.push(`--- PAGE ${i + 1} ---\n${text}`);
      } catch {
        // skip unreadable pages
      }
    }

    if (pageTexts.length === 0) {
      setError('No readable text found in PDF. The document may be a scanned image.');
      setStatus('error');
      return;
    }

    const combined = pageTexts.join('\n\n');
    setStatus('analyzing');
    setProgress('Sending to AI for material extraction…');

    const { data, error: fnError } = await supabase.functions.invoke<MaterialExtractionResult>(
      'extract-materials-from-text',
      { body: { text: combined, projectName: projectName || 'Takeoff' } },
    );

    if (fnError || !data?.success) {
      const msg = fnError?.message || data?.error || 'Extraction failed';
      setError(msg);
      setStatus('error');
      toast.error(msg);
      return;
    }

    setItems(data.items);
    setSelected(new Set(data.items.map((_, i) => i)));
    setStatus('done');
    setProgress('');
    toast.success(`Extracted ${data.totalItems} materials from ${data.chunksProcessed} text chunk${data.chunksProcessed !== 1 ? 's' : ''}`);
  }, [pdfUrl, pageCount, projectName]);

  const toggleItem = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(selected.size === items.length ? new Set() : new Set(items.map((_, i) => i)));
  };

  const handleImport = () => {
    const toImport = items
      .filter((_, i) => selected.has(i))
      .map(materialToMeasurement);
    if (toImport.length === 0) { toast.error('Select at least one item to import'); return; }
    onImport(toImport);
    toast.success(`Added ${toImport.length} items to measurements`);
    setSelected(new Set());
  };

  const busy = status === 'reading' || status === 'analyzing';

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PackageSearch className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">AI Material Extractor</h3>
        </div>
        {status === 'done' && (
          <Badge variant="secondary" className="text-xs">{items.length} items</Badge>
        )}
      </div>

      {error && (
        <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
          {error}
        </div>
      )}

      <Button
        onClick={handleExtract}
        disabled={!pdfUrl || busy}
        className="w-full"
        size="sm"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {progress || 'Working…'}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            {status === 'done' ? 'Re-extract Materials' : 'Extract Materials with AI'}
          </>
        )}
      </Button>

      {status === 'done' && items.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {open ? 'Hide' : 'Show'} results
            </CollapsibleTrigger>
            <button onClick={toggleAll} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {selected.size === items.length
                ? <CheckSquare className="h-3 w-3" />
                : <Square className="h-3 w-3" />}
              {selected.size === items.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <CollapsibleContent>
            <ScrollArea className="h-64 mt-2 border rounded">
              <div className="p-2 space-y-3">
                {Object.entries(grouped).map(([floor, rooms]) => (
                  <div key={floor}>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">{floor}</p>
                    {Object.entries(rooms).map(([room, roomItems]) => (
                      <div key={room} className="mb-2">
                        <p className="text-xs font-medium text-foreground mb-1 pl-1">{room}</p>
                        {(roomItems as (ExtractedMaterial & { _idx: number })[]).map((item) => (
                          <div
                            key={item._idx}
                            className="flex items-start gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleItem(item._idx)}
                          >
                            {selected.has(item._idx)
                              ? <CheckSquare className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                              : <Square className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs leading-tight truncate">{item.material}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.quantity} {item.unit}
                              </p>
                            </div>
                            <Badge className={`text-[10px] px-1 py-0 shrink-0 ${TYPE_COLORS[item.materialType] || TYPE_COLORS.Other}`}>
                              {item.materialType}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {status === 'done' && selected.size > 0 && (
        <Button size="sm" className="w-full" onClick={handleImport}>
          Import {selected.size} item{selected.size !== 1 ? 's' : ''} as Measurements
        </Button>
      )}

      <p className="text-xs text-muted-foreground leading-tight">
        Reads text from all PDF pages, filters noise, then uses AI to identify materials by floor and room.
      </p>
    </Card>
  );
};
