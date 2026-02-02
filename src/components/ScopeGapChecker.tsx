// Scope Gap Checker Component - Shows missing items and allows user to address them
import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Plus,
  X,
  HelpCircle,
  DollarSign,
  Shield,
  Zap,
  Droplets,
  Home,
  Wrench,
  FileCheck,
  Layers,
  Cable,
} from 'lucide-react';
import {
  ScopeGap,
  SuggestedItem,
  GapCategory,
  GapSeverity,
  calculateGapCost,
  getGapSummary,
  suggestedItemToEstimate,
} from '@/lib/scopeGapChecker';
import { EstimatedLineItem } from '@/lib/aiPlanAnalyzer';

interface ScopeGapCheckerProps {
  gaps: ScopeGap[];
  onAddItems: (items: EstimatedLineItem[]) => void;
  onAcknowledgeGap: (gapId: string, acknowledgedAs: ScopeGap['acknowledgedAs'], note?: string) => void;
}

const SEVERITY_CONFIG: Record<GapSeverity, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  critical: {
    icon: <AlertTriangle className="h-5 w-5" />,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
    label: 'Critical - Must Address',
  },
  warning: {
    icon: <AlertCircle className="h-5 w-5" />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
    label: 'Warning - Should Review',
  },
  info: {
    icon: <Info className="h-5 w-5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
    label: 'Info - Consider Adding',
  },
};

const CATEGORY_CONFIG: Record<GapCategory, { icon: React.ReactNode; label: string }> = {
  structure: { icon: <Home className="h-4 w-4" />, label: 'Structure' },
  services: { icon: <Zap className="h-4 w-4" />, label: 'Services' },
  wet_areas: { icon: <Droplets className="h-4 w-4" />, label: 'Wet Areas' },
  external: { icon: <Home className="h-4 w-4" />, label: 'External Works' },
  compliance: { icon: <Shield className="h-4 w-4" />, label: 'Compliance' },
  preliminaries: { icon: <Wrench className="h-4 w-4" />, label: 'Preliminaries' },
  finishes: { icon: <Layers className="h-4 w-4" />, label: 'Finishes' },
  connections: { icon: <Cable className="h-4 w-4" />, label: 'Connections' },
};

export function ScopeGapChecker({
  gaps,
  onAddItems,
  onAcknowledgeGap,
}: ScopeGapCheckerProps) {
  const [selectedGap, setSelectedGap] = useState<ScopeGap | null>(null);
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [acknowledgeNote, setAcknowledgeNote] = useState('');
  const [acknowledgeAs, setAcknowledgeAs] = useState<ScopeGap['acknowledgedAs']>(null);
  const [editingItems, setEditingItems] = useState<Map<string, SuggestedItem>>(new Map());

  const summary = useMemo(() => getGapSummary(gaps), [gaps]);

  // Group gaps by category
  const gapsByCategory = useMemo(() => {
    const groups: Record<GapCategory, ScopeGap[]> = {
      structure: [],
      services: [],
      wet_areas: [],
      external: [],
      compliance: [],
      preliminaries: [],
      finishes: [],
      connections: [],
    };
    for (const gap of gaps) {
      groups[gap.category].push(gap);
    }
    return groups;
  }, [gaps]);

  const handleAddAllItems = (gap: ScopeGap) => {
    const items = gap.suggestedItems.map(suggested => {
      const edited = editingItems.get(`${gap.id}-${suggested.description}`);
      return suggestedItemToEstimate(edited || suggested, gap.id);
    });
    onAddItems(items);
    onAcknowledgeGap(gap.id, 'added');
  };

  const handleAddSingleItem = (gap: ScopeGap, suggested: SuggestedItem) => {
    const edited = editingItems.get(`${gap.id}-${suggested.description}`);
    const item = suggestedItemToEstimate(edited || suggested, gap.id);
    onAddItems([item]);
  };

  const handleAcknowledge = () => {
    if (selectedGap && acknowledgeAs) {
      onAcknowledgeGap(selectedGap.id, acknowledgeAs, acknowledgeNote);
      setAcknowledgeDialogOpen(false);
      setSelectedGap(null);
      setAcknowledgeNote('');
      setAcknowledgeAs(null);
    }
  };

  const openAcknowledgeDialog = (gap: ScopeGap) => {
    setSelectedGap(gap);
    setAcknowledgeDialogOpen(true);
  };

  const updateSuggestedItem = (gapId: string, original: SuggestedItem, field: 'qty' | 'rate', value: number) => {
    const key = `${gapId}-${original.description}`;
    const existing = editingItems.get(key) || { ...original };
    if (field === 'qty') {
      existing.estimatedQty = value;
    } else {
      existing.estimatedRate = value;
    }
    setEditingItems(new Map(editingItems.set(key, existing)));
  };

  const getItemValue = (gapId: string, original: SuggestedItem, field: 'qty' | 'rate'): number => {
    const key = `${gapId}-${original.description}`;
    const edited = editingItems.get(key);
    if (edited) {
      return field === 'qty' ? edited.estimatedQty : edited.estimatedRate;
    }
    return field === 'qty' ? original.estimatedQty : original.estimatedRate;
  };

  const unacknowledgedGaps = gaps.filter(g => !g.isAcknowledged);
  const acknowledgedGaps = gaps.filter(g => g.isAcknowledged);

  if (gaps.length === 0) {
    return (
      <Card className="p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Scope Gaps Detected</h3>
        <p className="text-muted-foreground">
          The estimate appears to cover all typical construction requirements.
          Always verify against the specific project requirements.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Scope Gap Analysis
            </h3>
            <p className="text-sm text-muted-foreground">
              {unacknowledgedGaps.length} potential gaps found - review to avoid missed items
            </p>
          </div>
          <div className="flex items-center gap-4">
            {summary.critical > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-sm">
                  {summary.critical} Critical
                </Badge>
              </div>
            )}
            {summary.warning > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm border-yellow-500 text-yellow-600">
                  {summary.warning} Warnings
                </Badge>
              </div>
            )}
            {summary.info > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm border-blue-500 text-blue-600">
                  {summary.info} Info
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Risk Value */}
        {summary.totalRisk > 0 && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-800 dark:text-red-200">
                Potential Missing Value: ${summary.totalRisk.toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              This is the estimated cost of unaddressed gaps. Review each item carefully.
            </p>
          </div>
        )}
      </Card>

      {/* Gap List by Category */}
      <ScrollArea className="h-[500px]">
        <Accordion type="multiple" defaultValue={Object.keys(gapsByCategory).filter(k => gapsByCategory[k as GapCategory].some(g => !g.isAcknowledged))} className="space-y-2">
          {Object.entries(gapsByCategory).map(([category, categoryGaps]) => {
            if (categoryGaps.length === 0) return null;
            const unacknowledged = categoryGaps.filter(g => !g.isAcknowledged);
            const config = CATEGORY_CONFIG[category as GapCategory];

            return (
              <AccordionItem key={category} value={category} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-2">
                      {config.icon}
                      <span className="font-medium">{config.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {unacknowledged.length > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          {unacknowledged.length} to review
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-500">
                          All addressed
                        </Badge>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-3">
                  {categoryGaps.map(gap => {
                    const severityConfig = SEVERITY_CONFIG[gap.severity];
                    const gapCost = calculateGapCost(gap);

                    return (
                      <Card
                        key={gap.id}
                        className={`p-4 ${gap.isAcknowledged ? 'opacity-60 bg-muted' : severityConfig.bgColor}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className={severityConfig.color}>
                              {gap.isAcknowledged ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                severityConfig.icon
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{gap.title}</h4>
                                {gap.isAcknowledged && (
                                  <Badge variant="outline" className="text-xs text-green-600">
                                    {gap.acknowledgedAs === 'added' ? 'Added to estimate' :
                                     gap.acknowledgedAs === 'not_required' ? 'Not required' :
                                     'Included elsewhere'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {gap.description}
                              </p>
                              <div className="text-xs bg-muted p-2 rounded mb-3">
                                <strong>Why flagged:</strong> {gap.reason}
                              </div>

                              {!gap.isAcknowledged && (
                                <>
                                  {/* Suggested Items Table */}
                                  <div className="border rounded-lg overflow-hidden mb-3">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-muted/50">
                                          <TableHead className="text-xs">Description</TableHead>
                                          <TableHead className="text-xs text-right w-20">Qty</TableHead>
                                          <TableHead className="text-xs text-right w-16">Unit</TableHead>
                                          <TableHead className="text-xs text-right w-24">Rate</TableHead>
                                          <TableHead className="text-xs text-right w-24">Total</TableHead>
                                          <TableHead className="w-10"></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {gap.suggestedItems.map((item, idx) => {
                                          const qty = getItemValue(gap.id, item, 'qty');
                                          const rate = getItemValue(gap.id, item, 'rate');
                                          const total = qty * rate;

                                          return (
                                            <TableRow key={idx}>
                                              <TableCell className="text-xs">
                                                <div>
                                                  <p className="font-medium">{item.description}</p>
                                                  <p className="text-muted-foreground text-[10px]">{item.basis}</p>
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-right">
                                                <Input
                                                  type="number"
                                                  value={qty}
                                                  onChange={(e) => updateSuggestedItem(gap.id, item, 'qty', parseFloat(e.target.value) || 0)}
                                                  className="w-16 h-7 text-xs text-right"
                                                />
                                              </TableCell>
                                              <TableCell className="text-xs text-right text-muted-foreground">
                                                {item.unit}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                <Input
                                                  type="number"
                                                  value={rate}
                                                  onChange={(e) => updateSuggestedItem(gap.id, item, 'rate', parseFloat(e.target.value) || 0)}
                                                  className="w-20 h-7 text-xs text-right"
                                                />
                                              </TableCell>
                                              <TableCell className="text-xs text-right font-medium">
                                                ${total.toLocaleString()}
                                              </TableCell>
                                              <TableCell>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 w-7 p-0"
                                                  onClick={() => handleAddSingleItem(gap, item)}
                                                  title="Add this item only"
                                                >
                                                  <Plus className="h-4 w-4" />
                                                </Button>
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">
                                      Suggested total: ${gapCost.toLocaleString()}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openAcknowledgeDialog(gap)}
                                      >
                                        <X className="h-4 w-4 mr-1" />
                                        Not Required
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handleAddAllItems(gap)}
                                        className="bg-accent text-accent-foreground hover:bg-accent/90"
                                      >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add All to Estimate
                                      </Button>
                                    </div>
                                  </div>
                                </>
                              )}

                              {gap.isAcknowledged && gap.acknowledgedNote && (
                                <p className="text-xs text-muted-foreground italic">
                                  Note: {gap.acknowledgedNote}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>

      {/* Acknowledged Summary */}
      {acknowledgedGaps.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Addressed Items ({acknowledgedGaps.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {acknowledgedGaps.map(gap => (
              <Badge
                key={gap.id}
                variant="outline"
                className="text-xs text-green-600 border-green-300"
              >
                {gap.title}
                {gap.acknowledgedAs === 'added' && ' - Added'}
                {gap.acknowledgedAs === 'not_required' && ' - N/A'}
                {gap.acknowledgedAs === 'included_elsewhere' && ' - Elsewhere'}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Acknowledge Dialog */}
      <Dialog open={acknowledgeDialogOpen} onOpenChange={setAcknowledgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Not Required</DialogTitle>
            <DialogDescription>
              {selectedGap?.title} - Explain why this item is not needed for this project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Select value={acknowledgeAs || ''} onValueChange={(v) => setAcknowledgeAs(v as ScopeGap['acknowledgedAs'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_required">Not required for this project</SelectItem>
                  <SelectItem value="included_elsewhere">Included in another line item</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={acknowledgeNote}
                onChange={(e) => setAcknowledgeNote(e.target.value)}
                placeholder="e.g., Client providing own appliances, or existing building has this already..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAcknowledgeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAcknowledge} disabled={!acknowledgeAs}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ScopeGapChecker;
