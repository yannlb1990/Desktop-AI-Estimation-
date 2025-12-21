import { useState, useEffect } from 'react';
import { FileText, Ruler, Home, MessageSquare, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { extractAllElements, ExtractedElement } from '@/lib/takeoff/pdfTextExtractor';

interface PDFElementsPanelProps {
  pdfUrl: string | null;
  pageIndex: number;
  onElementClick?: (element: ExtractedElement) => void;
  onElementDoubleClick?: (element: ExtractedElement) => void;
}

export const PDFElementsPanel = ({
  pdfUrl,
  pageIndex,
  onElementClick,
  onElementDoubleClick,
}: PDFElementsPanelProps) => {
  const [elements, setElements] = useState<ExtractedElement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'dimension' | 'room_label' | 'annotation'>('all');

  const loadElements = async () => {
    if (!pdfUrl) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const extracted = await extractAllElements(pdfUrl, pageIndex);
      setElements(extracted);
    } catch (err) {
      setError('Failed to extract elements');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadElements();
  }, [pdfUrl, pageIndex]);

  const filteredElements = elements.filter(el => {
    const matchesTab = activeTab === 'all' || el.type === activeTab;
    const matchesFilter = !filter || el.content.toLowerCase().includes(filter.toLowerCase());
    return matchesTab && matchesFilter;
  });

  const getIcon = (type: ExtractedElement['type']) => {
    switch (type) {
      case 'dimension': return <Ruler className="h-3 w-3" />;
      case 'room_label': return <Home className="h-3 w-3" />;
      case 'annotation': return <MessageSquare className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  const getTypeColor = (type: ExtractedElement['type']) => {
    switch (type) {
      case 'dimension': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'room_label': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'annotation': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const counts = {
    all: elements.length,
    dimension: elements.filter(e => e.type === 'dimension').length,
    room_label: elements.filter(e => e.type === 'room_label').length,
    annotation: elements.filter(e => e.type === 'annotation').length,
  };

  if (!pdfUrl) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground text-center">
          Upload a PDF to extract elements
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">PDF Elements</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={loadElements}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder="Filter elements..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 pl-7 text-xs"
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid grid-cols-4 h-8">
          <TabsTrigger value="all" className="text-xs px-2">
            All ({counts.all})
          </TabsTrigger>
          <TabsTrigger value="dimension" className="text-xs px-2">
            Dim ({counts.dimension})
          </TabsTrigger>
          <TabsTrigger value="room_label" className="text-xs px-2">
            Rooms ({counts.room_label})
          </TabsTrigger>
          <TabsTrigger value="annotation" className="text-xs px-2">
            Notes ({counts.annotation})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive text-center py-4">{error}</p>
      ) : filteredElements.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No elements found
        </p>
      ) : (
        <ScrollArea className="h-[280px]">
          <div className="space-y-1.5">
            {filteredElements.map((el, idx) => (
              <div
                key={`${el.type}-${idx}-${el.bounds.x}`}
                className="p-2 rounded-md border border-border/60 hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => onElementClick?.(el)}
                onDoubleClick={() => onElementDoubleClick?.(el)}
              >
                <div className="flex items-start gap-2">
                  <Badge 
                    variant="secondary" 
                    className={`${getTypeColor(el.type)} px-1.5 py-0.5`}
                  >
                    {getIcon(el.type)}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{el.content}</p>
                    <p className="text-[10px] text-muted-foreground">
                      x: {el.bounds.x.toFixed(0)}, y: {el.bounds.y.toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        Click to highlight • Double-click to create label
      </p>
    </Card>
  );
};
