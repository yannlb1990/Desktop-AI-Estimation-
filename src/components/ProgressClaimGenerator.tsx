import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { PlusCircle, Trash2, FileDown, DollarSign } from 'lucide-react';
import { generateProgressClaimPdf } from '@/lib/takeoff/progressClaimPdf';
import type { ProgressClaimStage } from '@/lib/takeoff/progressClaimPdf';

interface Props {
  projectName: string;
  siteAddress?: string;
  clientName?: string;
  state?: string;
  contractSum?: number;
}

const DEFAULT_STAGES: ProgressClaimStage[] = [
  { id: '1', name: 'Slab & Foundation', value: 0, percentComplete: 0 },
  { id: '2', name: 'Frame & Roof', value: 0, percentComplete: 0 },
  { id: '3', name: 'Lockup', value: 0, percentComplete: 0 },
];

function fmt(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ProgressClaimGenerator({ projectName, siteAddress = '', clientName = '', state = 'NSW', contractSum = 0 }: Props) {
  const [claimNumber, setClaimNumber] = useState('1');
  const [claimDate, setClaimDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [contractSumInput, setContractSumInput] = useState(contractSum > 0 ? String(contractSum) : '');
  const [retentionPct, setRetentionPct] = useState('5');
  const [previouslyClaimed, setPreviouslyClaimed] = useState('0');
  const [contractorName, setContractorName] = useState('');
  const [contractorAbn, setContractorAbn] = useState('');
  const [stages, setStages] = useState<ProgressClaimStage[]>(DEFAULT_STAGES);

  const parsedContractSum = parseFloat(contractSumInput) || 0;
  const parsedRetention = parseFloat(retentionPct) || 0;
  const parsedPrevious = parseFloat(previouslyClaimed) || 0;

  const summary = useMemo(() => {
    const totalClaimed = stages.reduce((s, st) => s + st.value * (st.percentComplete / 100), 0);
    const retention = totalClaimed * (parsedRetention / 100);
    const netClaim = Math.max(0, totalClaimed - retention - parsedPrevious);
    const gst = netClaim * 0.1;
    return { totalClaimed, retention, netClaim, gst, totalDue: netClaim + gst };
  }, [stages, parsedRetention, parsedPrevious]);

  function addStage() {
    setStages(prev => [
      ...prev,
      { id: String(Date.now()), name: 'New Stage', value: 0, percentComplete: 0 },
    ]);
  }

  function removeStage(id: string) {
    setStages(prev => prev.filter(s => s.id !== id));
  }

  function updateStage(id: string, field: keyof ProgressClaimStage, value: string | number) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  function handleGenerate() {
    generateProgressClaimPdf({
      projectName,
      siteAddress,
      clientName,
      state,
      claimNumber: parseInt(claimNumber) || 1,
      claimDate,
      contractSum: parsedContractSum,
      retentionPct: parsedRetention,
      previouslyClaimed: parsedPrevious,
      stages,
      contractorName,
      contractorAbn,
    });
  }

  return (
    <div className="space-y-6">
      {/* Claim details */}
      <Card className="border-border bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Claim Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Claim Number</Label>
            <Input
              type="number" min="1" value={claimNumber}
              onChange={e => setClaimNumber(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Claim Date</Label>
            <Input
              type="date" value={claimDate}
              onChange={e => setClaimDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">State / Territory</Label>
            <Input
              value={state} readOnly
              className="h-8 text-sm bg-muted/30 cursor-not-allowed"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Contract Sum ($)</Label>
            <Input
              type="number" min="0" value={contractSumInput}
              onChange={e => setContractSumInput(e.target.value)}
              placeholder="e.g. 450000"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Retention (%)</Label>
            <Input
              type="number" min="0" max="10" step="0.5" value={retentionPct}
              onChange={e => setRetentionPct(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Previously Claimed ($)</Label>
            <Input
              type="number" min="0" value={previouslyClaimed}
              onChange={e => setPreviouslyClaimed(e.target.value)}
              placeholder="0"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1 col-span-2 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Contractor / Company Name</Label>
            <Input
              value={contractorName}
              onChange={e => setContractorName(e.target.value)}
              placeholder="Your company name"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ABN</Label>
            <Input
              value={contractorAbn}
              onChange={e => setContractorAbn(e.target.value)}
              placeholder="xx xxx xxx xxx"
              className="h-8 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stages */}
      <Card className="border-border bg-card/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">Claim Stages</CardTitle>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={addStage}>
            <PlusCircle className="h-3.5 w-3.5" />
            Add Stage
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {stages.map((stage) => (
            <div key={stage.id} className="grid grid-cols-12 gap-3 items-center p-3 rounded-lg border border-border bg-muted/20">
              {/* Stage name */}
              <div className="col-span-12 sm:col-span-4">
                <Input
                  value={stage.name}
                  onChange={e => updateStage(stage.id, 'name', e.target.value)}
                  className="h-7 text-sm"
                  placeholder="Stage name"
                />
              </div>
              {/* Stage value */}
              <div className="col-span-6 sm:col-span-3 space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Value ($)</Label>
                <Input
                  type="number" min="0"
                  value={stage.value || ''}
                  onChange={e => updateStage(stage.id, 'value', parseFloat(e.target.value) || 0)}
                  className="h-7 text-sm"
                  placeholder="0"
                />
              </div>
              {/* % complete */}
              <div className="col-span-5 sm:col-span-4 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground">Complete</Label>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{stage.percentComplete}%</Badge>
                </div>
                <Slider
                  value={[stage.percentComplete]}
                  onValueChange={([v]) => updateStage(stage.id, 'percentComplete', v)}
                  min={0} max={100} step={5}
                  className="py-1"
                />
              </div>
              {/* Remove */}
              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => removeStage(stage.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  title="Remove stage"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Value claimed preview */}
              <div className="col-span-12 flex items-center justify-end gap-1.5 pt-0.5">
                <span className="text-[10px] text-muted-foreground">Claimed this stage:</span>
                <span className="text-xs font-semibold text-cyan-400">
                  ${fmt(stage.value * (stage.percentComplete / 100))}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Live summary */}
      <Card className="border-blue-500/30 bg-blue-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-blue-300 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Total Value Claimed', value: summary.totalClaimed, className: 'text-foreground' },
              { label: `Retention (${parsedRetention}%)`, value: -summary.retention, className: 'text-amber-400' },
              { label: 'Previously Claimed', value: -parsedPrevious, className: 'text-amber-400' },
              { label: 'Amount Excl. Prior Claims', value: summary.netClaim, className: 'text-foreground font-semibold border-t border-border pt-2 mt-2' },
              { label: 'GST (10%)', value: summary.gst, className: 'text-muted-foreground text-xs' },
            ].map(({ label, value, className }) => (
              <div key={label} className={`flex justify-between items-center ${className}`}>
                <span>{label}</span>
                <span className={value < 0 ? 'text-amber-400' : ''}>
                  {value < 0 ? `($${fmt(Math.abs(value))})` : `$${fmt(value)}`}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center border-t-2 border-blue-500/40 pt-3 mt-1">
              <span className="font-bold text-base text-blue-200">TOTAL DUE THIS CLAIM</span>
              <span className="font-bold text-base text-cyan-400">${fmt(summary.totalDue)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate button */}
      <div className="flex justify-end">
        <Button
          onClick={handleGenerate}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
          disabled={stages.length === 0}
        >
          <FileDown className="h-4 w-4" />
          Generate Progress Claim PDF
        </Button>
      </div>
    </div>
  );
}
