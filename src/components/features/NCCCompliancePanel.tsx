// NCC Compliance Panel Component
// Displays compliance check results and suggests missing items

import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  FileText,
  Plus,
  Info,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import {
  checkNccCompliance,
  ComplianceCheckResult,
  ComplianceRequirement,
  MissingItem,
  EstimateLineItem,
} from '@/lib/nccComplianceChecker';

interface NCCCompliancePanelProps {
  lineItems: EstimateLineItem[];
  projectType?: string;
  onAddItem?: (item: MissingItem) => void;
  onAddMultipleItems?: (items: MissingItem[]) => void;
  className?: string;
}

export function NCCCompliancePanel({
  lineItems,
  projectType,
  onAddItem,
  onAddMultipleItems,
  className = '',
}: NCCCompliancePanelProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Run compliance check
  const result = useMemo(() => {
    return checkNccCompliance(lineItems, projectType);
  }, [lineItems, projectType]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 70) return 'bg-amber-100';
    return 'bg-red-100';
  };

  // Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  // Select all missing items
  const selectAllMissing = () => {
    const allIds = result.missingItems.map(item => item.id);
    setSelectedItems(new Set(allIds));
  };

  // Add selected items
  const addSelectedItems = () => {
    const items = result.missingItems.filter(item => selectedItems.has(item.id));
    if (onAddMultipleItems && items.length > 0) {
      onAddMultipleItems(items);
      setSelectedItems(new Set());
    }
  };

  // Calculate total for selected items
  const selectedTotal = useMemo(() => {
    return result.missingItems
      .filter(item => selectedItems.has(item.id))
      .reduce((sum, item) => sum + item.estimatedCost, 0);
  }, [result.missingItems, selectedItems]);

  // Get work type badge color
  const getWorkTypeColor = (workType: string) => {
    const colors: Record<string, string> = {
      bathroom: 'bg-blue-100 text-blue-800',
      shower: 'bg-cyan-100 text-cyan-800',
      laundry: 'bg-indigo-100 text-indigo-800',
      deck: 'bg-amber-100 text-amber-800',
      electrical: 'bg-yellow-100 text-yellow-800',
      plumbing: 'bg-sky-100 text-sky-800',
      insulation: 'bg-orange-100 text-orange-800',
      glazing: 'bg-violet-100 text-violet-800',
      fire: 'bg-red-100 text-red-800',
      access: 'bg-green-100 text-green-800',
    };
    return colors[workType] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Compliance Score Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            NCC Compliance Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Score Circle */}
            <div
              className={`flex items-center justify-center w-24 h-24 rounded-full ${getScoreBg(
                result.complianceScore
              )}`}
            >
              <div className="text-center">
                <div className={`text-3xl font-bold ${getScoreColor(result.complianceScore)}`}>
                  {result.complianceScore}%
                </div>
                <div className="text-xs text-muted-foreground">Compliant</div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Requirements Met</span>
                  <span className="font-medium">
                    {result.metRequirements} / {result.totalRequirements}
                  </span>
                </div>
                <Progress value={(result.metRequirements / result.totalRequirements) * 100} className="h-2" />
              </div>

              <div className="flex items-center gap-4">
                {result.isCompliant ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Fully Compliant
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">
                    <XCircle className="h-3 w-3 mr-1" />
                    {result.missingItems.filter(i => i.mandatory).length} Mandatory Items Missing
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Detected Work Types */}
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Detected Work Types</h4>
            <div className="flex flex-wrap gap-2">
              {result.workTypes.map(workType => (
                <Badge key={workType} className={getWorkTypeColor(workType)}>
                  {workType.charAt(0).toUpperCase() + workType.slice(1)}
                </Badge>
              ))}
              {result.workTypes.length === 0 && (
                <span className="text-sm text-muted-foreground">No specific work types detected</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Missing Items Card */}
      {result.missingItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                Missing Compliance Items ({result.missingItems.length})
              </CardTitle>
              {onAddMultipleItems && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllMissing}>
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    onClick={addSelectedItems}
                    disabled={selectedItems.size === 0}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Selected ({selectedItems.size})
                  </Button>
                </div>
              )}
            </div>
            {selectedItems.size > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Selected total: {formatCurrency(selectedTotal)}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.missingItems.map(item => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    item.mandatory
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                  } ${selectedItems.has(item.id) ? 'ring-2 ring-primary' : ''}`}
                >
                  {onAddMultipleItems && (
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                      className="mt-1 h-4 w-4 rounded"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{item.trade}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-sm">{item.description}</span>
                      {item.mandatory && (
                        <Badge variant="destructive" className="text-xs">
                          Mandatory
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {item.nccCode}
                      </span>
                      <span>{item.unit}</span>
                      <span className="font-medium">Est: {formatCurrency(item.estimatedCost)}</span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
                    )}
                  </div>
                  {onAddItem && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onAddItem(item)}
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requirements By Work Type */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            NCC Requirements Detail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {Object.entries(result.requirementsByWorkType).map(([workType, requirements]) => (
              <AccordionItem key={workType} value={workType}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Badge className={getWorkTypeColor(workType)}>
                      {workType.charAt(0).toUpperCase() + workType.slice(1)}
                    </Badge>
                    <span className="text-sm">
                      {requirements.filter(r => r.met).length} / {requirements.length} requirements met
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    {requirements.map((req, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-2 rounded ${
                          req.met ? 'bg-green-50' : req.mandatory ? 'bg-red-50' : 'bg-amber-50'
                        }`}
                      >
                        {req.met ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                        ) : req.mandatory ? (
                          <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-muted px-1 rounded">
                              {req.nccCode}
                            </span>
                            <span className="text-sm">{req.description}</span>
                          </div>
                          {!req.met && req.suggestedLineItem && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Suggested: {req.suggestedLineItem}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {Object.keys(result.requirementsByWorkType).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No specific NCC requirements detected for current line items.</p>
              <p className="text-sm">Add work items to see applicable requirements.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NCC Reference Link */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-sm">National Construction Code 2022</p>
                <p className="text-xs text-muted-foreground">
                  Always verify requirements against the latest NCC
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://ncc.abcb.gov.au"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View NCC
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default NCCCompliancePanel;
