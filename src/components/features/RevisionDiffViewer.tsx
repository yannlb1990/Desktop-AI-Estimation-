// Revision Diff Viewer Component
// Displays side-by-side comparison of estimate revisions

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowRight,
  Plus,
  Minus,
  Edit3,
  FileText,
  TrendingUp,
  TrendingDown,
  Download,
  Printer,
  History,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import {
  compareRevisions,
  formatVariationNoticeText,
  generateVariationNotice,
  getRevisionHistory,
  getCumulativeChanges,
  EstimateRevision,
  RevisionDiff,
  LineItemChange,
  VariationNotice,
} from '@/lib/revisionTracker';

interface RevisionDiffViewerProps {
  revisions: EstimateRevision[];
  clientName?: string;
  projectAddress?: string;
  onGenerateVariation?: (notice: VariationNotice) => void;
  className?: string;
}

export function RevisionDiffViewer({
  revisions,
  clientName = '',
  projectAddress = '',
  onGenerateVariation,
  className = '',
}: RevisionDiffViewerProps) {
  const [selectedRevisionA, setSelectedRevisionA] = useState<string>('');
  const [selectedRevisionB, setSelectedRevisionB] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'diff' | 'history' | 'variation'>('diff');
  const [variationNotes, setVariationNotes] = useState('');
  const [copied, setCopied] = useState(false);

  // Sort revisions by number
  const sortedRevisions = useMemo(() => {
    return [...revisions].sort((a, b) => a.revisionNumber - b.revisionNumber);
  }, [revisions]);

  // Auto-select revisions if not set
  React.useEffect(() => {
    if (sortedRevisions.length >= 2 && !selectedRevisionA && !selectedRevisionB) {
      setSelectedRevisionA(sortedRevisions[sortedRevisions.length - 2].id);
      setSelectedRevisionB(sortedRevisions[sortedRevisions.length - 1].id);
    }
  }, [sortedRevisions, selectedRevisionA, selectedRevisionB]);

  // Get selected revisions
  const revisionA = useMemo(() => {
    return sortedRevisions.find(r => r.id === selectedRevisionA);
  }, [sortedRevisions, selectedRevisionA]);

  const revisionB = useMemo(() => {
    return sortedRevisions.find(r => r.id === selectedRevisionB);
  }, [sortedRevisions, selectedRevisionB]);

  // Calculate diff
  const diff = useMemo(() => {
    if (!revisionA || !revisionB) return null;
    return compareRevisions(revisionA, revisionB);
  }, [revisionA, revisionB]);

  // Get revision history with diffs
  const historyWithDiffs = useMemo(() => {
    return getRevisionHistory(revisions);
  }, [revisions]);

  // Get cumulative changes
  const cumulativeChanges = useMemo(() => {
    return getCumulativeChanges(revisions);
  }, [revisions]);

  // Generate variation notice
  const variationNotice = useMemo(() => {
    if (!diff) return null;
    return generateVariationNotice(diff, revisionB?.estimateId || '', clientName, projectAddress, variationNotes);
  }, [diff, revisionB, clientName, projectAddress, variationNotes]);

  // Format variation notice text
  const variationText = useMemo(() => {
    if (!variationNotice) return '';
    return formatVariationNoticeText(variationNotice);
  }, [variationNotice]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });

  // Copy variation text
  const copyVariationText = async () => {
    await navigator.clipboard.writeText(variationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Change type styling
  const getChangeTypeStyle = (type: 'added' | 'removed' | 'modified') => {
    const styles = {
      added: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: Plus },
      removed: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: Minus },
      modified: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: Edit3 },
    };
    return styles[type];
  };

  if (revisions.length < 2) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>At least 2 revisions are needed to compare changes.</p>
          <p className="text-sm">Create a new revision to see the diff view.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Revision Selector */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Compare Revisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-1 block">From Revision</label>
              <Select value={selectedRevisionA} onValueChange={setSelectedRevisionA}>
                <SelectTrigger>
                  <SelectValue placeholder="Select revision" />
                </SelectTrigger>
                <SelectContent>
                  {sortedRevisions.map(rev => (
                    <SelectItem key={rev.id} value={rev.id} disabled={rev.id === selectedRevisionB}>
                      Rev {rev.revisionNumber} - {formatDate(rev.createdAt)} ({formatCurrency(rev.total)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRight className="h-5 w-5 text-muted-foreground mt-6" />

            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-1 block">To Revision</label>
              <Select value={selectedRevisionB} onValueChange={setSelectedRevisionB}>
                <SelectTrigger>
                  <SelectValue placeholder="Select revision" />
                </SelectTrigger>
                <SelectContent>
                  {sortedRevisions.map(rev => (
                    <SelectItem key={rev.id} value={rev.id} disabled={rev.id === selectedRevisionA}>
                      Rev {rev.revisionNumber} - {formatDate(rev.createdAt)} ({formatCurrency(rev.total)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Stats */}
          {diff && (
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Added</span>
                </div>
                <div className="text-lg font-semibold text-green-800">
                  {diff.summary.addedItems} items
                </div>
                <div className="text-sm text-green-600">
                  +{formatCurrency(diff.summary.totalAdded)}
                </div>
              </div>

              <div className="bg-red-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <Minus className="h-4 w-4" />
                  <span className="text-sm font-medium">Removed</span>
                </div>
                <div className="text-lg font-semibold text-red-800">
                  {diff.summary.removedItems} items
                </div>
                <div className="text-sm text-red-600">
                  -{formatCurrency(diff.summary.totalRemoved)}
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700">
                  <Edit3 className="h-4 w-4" />
                  <span className="text-sm font-medium">Modified</span>
                </div>
                <div className="text-lg font-semibold text-amber-800">
                  {diff.summary.modifiedItems} items
                </div>
                <div className="text-sm text-amber-600">
                  {diff.summary.totalModified >= 0 ? '+' : ''}
                  {formatCurrency(diff.summary.totalModified)}
                </div>
              </div>

              <div className={`p-3 rounded-lg ${diff.summary.netValueChange >= 0 ? 'bg-blue-50' : 'bg-purple-50'}`}>
                <div className={`flex items-center gap-2 ${diff.summary.netValueChange >= 0 ? 'text-blue-700' : 'text-purple-700'}`}>
                  {diff.summary.netValueChange >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">Net Change</span>
                </div>
                <div className={`text-lg font-semibold ${diff.summary.netValueChange >= 0 ? 'text-blue-800' : 'text-purple-800'}`}>
                  {diff.summary.netValueChange >= 0 ? '+' : ''}
                  {formatCurrency(diff.summary.netValueChange)}
                </div>
                <div className={`text-sm ${diff.summary.netValueChange >= 0 ? 'text-blue-600' : 'text-purple-600'}`}>
                  {diff.summary.percentChange >= 0 ? '+' : ''}
                  {diff.summary.percentChange.toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for Diff / History / Variation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="diff">Changes Detail</TabsTrigger>
          <TabsTrigger value="history">Revision History</TabsTrigger>
          <TabsTrigger value="variation">Variation Notice</TabsTrigger>
        </TabsList>

        {/* Diff Tab */}
        <TabsContent value="diff">
          <Card>
            <CardContent className="pt-4">
              {diff && diff.changes.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {diff.changes.map((change, idx) => {
                      const style = getChangeTypeStyle(change.type);
                      const Icon = style.icon;

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border ${style.bg} ${style.border}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded ${style.text} bg-white`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">{change.trade}</Badge>
                                <span className="font-medium">{change.sow}</span>
                              </div>

                              {change.type === 'added' && change.after && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">
                                    {change.after.quantity} {change.after.unit} @ {formatCurrency(change.after.rate)}
                                  </span>
                                  <span className="font-medium ml-2">
                                    = {formatCurrency(change.after.total)}
                                  </span>
                                </div>
                              )}

                              {change.type === 'removed' && change.before && (
                                <div className="text-sm line-through opacity-70">
                                  <span className="text-muted-foreground">
                                    {change.before.quantity} {change.before.unit} @ {formatCurrency(change.before.rate)}
                                  </span>
                                  <span className="font-medium ml-2">
                                    = {formatCurrency(change.before.total)}
                                  </span>
                                </div>
                              )}

                              {change.type === 'modified' && change.changes && (
                                <div className="space-y-1 text-sm">
                                  {change.changes.map((fieldChange, fIdx) => (
                                    <div key={fIdx} className="flex items-center gap-2">
                                      <span className="text-muted-foreground">{fieldChange.fieldLabel}:</span>
                                      <span className="line-through opacity-50">{fieldChange.oldValue}</span>
                                      <ChevronRight className="h-3 w-3" />
                                      <span className="font-medium">{fieldChange.newValue}</span>
                                      {fieldChange.valueDifference !== undefined && (
                                        <Badge variant="outline" className="text-xs">
                                          {fieldChange.valueDifference >= 0 ? '+' : ''}
                                          {fieldChange.valueDifference}
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className={`text-sm font-medium mt-2 ${style.text}`}>
                                Value change: {change.valueDifference >= 0 ? '+' : ''}
                                {formatCurrency(change.valueDifference)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No changes between selected revisions.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {/* Cumulative Summary */}
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Cumulative Changes (All Revisions)</h4>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Revisions:</span>
                      <span className="font-medium ml-2">{cumulativeChanges.revisionCount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Additions:</span>
                      <span className="font-medium text-green-600 ml-2">
                        +{formatCurrency(cumulativeChanges.totalAdditions)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Deductions:</span>
                      <span className="font-medium text-red-600 ml-2">
                        -{formatCurrency(cumulativeChanges.totalDeductions)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Net Change:</span>
                      <span className={`font-medium ml-2 ${cumulativeChanges.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {cumulativeChanges.netChange >= 0 ? '+' : ''}
                        {formatCurrency(cumulativeChanges.netChange)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <ScrollArea className="h-[400px]">
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                    {historyWithDiffs.map((entry, idx) => (
                      <div key={entry.revision.id} className="relative pl-10 pb-6">
                        <div className={`absolute left-2 w-5 h-5 rounded-full border-2 ${
                          idx === historyWithDiffs.length - 1
                            ? 'bg-primary border-primary'
                            : 'bg-background border-muted-foreground'
                        }`} />

                        <div className="bg-muted p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge>Rev {entry.revision.revisionNumber}</Badge>
                              <span className="font-medium">{formatCurrency(entry.revision.total)}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(entry.revision.createdAt)}
                            </span>
                          </div>

                          {entry.revision.reason && (
                            <p className="text-sm text-muted-foreground mb-2">
                              Reason: {entry.revision.reason}
                            </p>
                          )}

                          {entry.diff && (
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-green-600">
                                +{entry.diff.summary.addedItems} added
                              </span>
                              <span className="text-red-600">
                                -{entry.diff.summary.removedItems} removed
                              </span>
                              <span className="text-amber-600">
                                ~{entry.diff.summary.modifiedItems} modified
                              </span>
                              <span className={entry.diff.summary.netValueChange >= 0 ? 'text-blue-600' : 'text-purple-600'}>
                                {entry.diff.summary.netValueChange >= 0 ? '+' : ''}
                                {formatCurrency(entry.diff.summary.netValueChange)}
                              </span>
                            </div>
                          )}

                          {idx === 0 && (
                            <Badge variant="outline" className="mt-2 text-xs">Initial Estimate</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Variation Notice Tab */}
        <TabsContent value="variation">
          <Card>
            <CardContent className="pt-4">
              <div className="mb-4">
                <label className="text-sm font-medium mb-1 block">Additional Notes</label>
                <textarea
                  value={variationNotes}
                  onChange={e => setVariationNotes(e.target.value)}
                  placeholder="Add any notes for the variation notice..."
                  className="w-full p-3 border rounded-lg text-sm h-20 resize-none"
                />
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Variation Notice Preview</h4>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyVariationText}>
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="h-4 w-4 mr-1" />
                      Print
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[400px]">
                  <pre className="text-sm font-mono whitespace-pre-wrap bg-white p-4 rounded border">
                    {variationText || 'Select two revisions to generate variation notice'}
                  </pre>
                </ScrollArea>
              </div>

              {onGenerateVariation && variationNotice && (
                <div className="mt-4 flex justify-end">
                  <Button onClick={() => onGenerateVariation(variationNotice)}>
                    <Download className="h-4 w-4 mr-2" />
                    Generate PDF Variation Notice
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RevisionDiffViewer;
