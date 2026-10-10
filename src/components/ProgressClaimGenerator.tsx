import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { PlusCircle, Trash2, FileDown, DollarSign, AlertTriangle, CheckCircle2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { generateProgressClaimPdf } from '@/lib/takeoff/progressClaimPdf';
import {
  contractSummary,
  loadProgressClaims,
  saveProgressClaims,
  stagesForNextClaim,
  computeClaim,
  type ClaimStage,
  type ProgressClaimRecord,
} from '@/lib/contract';

interface Props {
  projectId: string;
  projectName: string;
  siteAddress?: string;
  clientName?: string;
  state?: string;
}

function fmt(n: number) {
  // Avoid "-0.00" for a zero deduction
  const v = Math.abs(n) < 0.005 ? 0 : n;
  return v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Progress claims work off the quote the client approved (plus approved variations).
 * Every claim is saved, so "previously claimed" is calculated, not typed in.
 */
export function ProgressClaimGenerator({ projectId, projectName, siteAddress = '', clientName = '', state = 'NSW' }: Props) {
  const [contract, setContract] = useState(() => contractSummary(projectId));
  const [claims, setClaims] = useState<ProgressClaimRecord[]>(() => loadProgressClaims(projectId));
  const lastClaim = claims[claims.length - 1];

  const [claimDate, setClaimDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [retentionPct, setRetentionPct] = useState(() => String(lastClaim?.retentionPct ?? 5));
  const [contractorName, setContractorName] = useState('');
  const [contractorAbn, setContractorAbn] = useState('');
  const [stages, setStages] = useState<ClaimStage[]>(() => stagesForNextClaim(projectId, lastClaim));

  // Pick up a newly approved quote or variation when the tab is opened again
  const refresh = useCallback(() => {
    const latestClaims = loadProgressClaims(projectId);
    setContract(contractSummary(projectId));
    setClaims(latestClaims);
    setStages(stagesForNextClaim(projectId, latestClaims[latestClaims.length - 1]));
  }, [projectId]);
  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  const claimNumber = claims.length + 1;
  const parsedRetention = parseFloat(retentionPct) || 0;
  const stagesTotal = stages.reduce((s, st) => s + (st.value || 0), 0);
  const summary = useMemo(
    () => computeClaim(stages, parsedRetention, claims, contract.gstPct),
    [stages, parsedRetention, claims, contract.gstPct],
  );
  const stagesMismatch = contract.approvedQuote && Math.abs(stagesTotal - contract.contractExGst) > 1;

  function addStage() {
    setStages(prev => [...prev, { id: `custom-${Date.now()}`, name: 'New stage', value: 0, percentComplete: 0 }]);
  }
  function removeStage(id: string) {
    setStages(prev => prev.filter(s => s.id !== id));
  }
  function updateStage(id: string, field: keyof ClaimStage, value: string | number) {
    setStages(prev => prev.map(s => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function saveClaim(): ProgressClaimRecord | null {
    if (summary.thisClaimExGst < 0) {
      toast.error('This claim is negative: the % complete is lower than already claimed.');
      return null;
    }
    const record: ProgressClaimRecord = {
      id: crypto.randomUUID(),
      number: claimNumber,
      date: claimDate,
      stages,
      retentionPct: parsedRetention,
      completedToDate: summary.completedToDate,
      retentionHeld: summary.retentionHeld,
      thisClaimExGst: summary.thisClaimExGst,
      gst: summary.gst,
      thisClaimIncGst: summary.thisClaimIncGst,
    };
    const updated = [...claims, record];
    saveProgressClaims(projectId, updated);
    setClaims(updated);
    toast.success(`Claim ${record.number} saved ($${fmt(record.thisClaimIncGst)} inc GST)`);
    return record;
  }

  function handleGenerate() {
    const record = saveClaim();
    if (!record) return;
    generateProgressClaimPdf({
      projectName,
      siteAddress,
      clientName,
      state,
      claimNumber: record.number,
      claimDate: record.date,
      contractSum: contract.contractExGst || stagesTotal,
      retentionPct: record.retentionPct,
      previouslyClaimed: summary.previouslyClaimedExGst,
      gstPct: contract.gstPct,
      stages: record.stages,
      contractorName,
      contractorAbn,
    });
  }

  return (
    <div className="space-y-6">
      {/* Contract the claims work off */}
      {contract.approvedQuote ? (
        <Card className="border-border bg-card/60">
          <CardContent className="pt-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="col-span-2 md:col-span-4 flex items-center gap-2 text-foreground">
              <CheckCircle2 className="h-4 w-4 text-amber-400" />
              Working off approved quote {contract.approvedQuote.quoteNumber} (version {contract.approvedQuote.versionNumber}),
              approved {new Date(contract.approvedQuote.approvedAt).toLocaleDateString('en-AU')}
            </div>
            <div><p className="text-xs text-muted-foreground">Approved quote (ex GST)</p><p className="font-semibold">${fmt(contract.quoteExGst)}</p></div>
            <div><p className="text-xs text-muted-foreground">Approved variations</p><p className="font-semibold">${fmt(contract.variationsExGst)}</p></div>
            <div><p className="text-xs text-muted-foreground">Contract sum (ex GST)</p><p className="font-semibold">${fmt(contract.contractExGst)}</p></div>
            <div><p className="text-xs text-muted-foreground">Contract sum (inc GST)</p><p className="font-semibold text-[#E1DCC9]">${fmt(contract.contractIncGst)}</p></div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-5 flex gap-3 text-sm">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">No approved quote yet</p>
              <p className="text-muted-foreground mt-1">
                Open Generate Quote, save a version, then in History click "Mark as approved by client".
                Claims will then use that quote's amounts and trades. Until then you can enter stages by hand.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Claim details */}
      <Card className="border-border bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Claim {claimNumber}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Claim Date</Label>
            <Input type="date" value={claimDate} onChange={e => setClaimDate(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">State / Territory</Label>
            <Input value={state} readOnly className="h-8 text-sm bg-muted/30 cursor-not-allowed" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Retention (%)</Label>
            <Input type="number" min="0" max="10" step="0.5" value={retentionPct} onChange={e => setRetentionPct(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-muted-foreground">Contractor / Company Name</Label>
            <Input value={contractorName} onChange={e => setContractorName(e.target.value)} placeholder="Your company name" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ABN</Label>
            <Input value={contractorAbn} onChange={e => setContractorAbn(e.target.value)} placeholder="xx xxx xxx xxx" className="h-8 text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Stages */}
      <Card className="border-border bg-card/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">Claim Stages (% complete to date)</CardTitle>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={addStage}>
            <PlusCircle className="h-3.5 w-3.5" />
            Add Stage
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {stagesMismatch && (
            <p className="text-xs text-amber-400">
              Stage values add up to ${fmt(stagesTotal)}, but the contract sum is ${fmt(contract.contractExGst)}.
            </p>
          )}
          {stages.length === 0 && (
            <p className="text-sm text-muted-foreground">No stages yet. Approve a quote, or add stages by hand.</p>
          )}
          {stages.map(stage => (
            <div key={stage.id} className="grid grid-cols-12 gap-3 items-center p-3 rounded-lg border border-border bg-muted/20">
              <div className="col-span-12 sm:col-span-4">
                <Input value={stage.name} onChange={e => updateStage(stage.id, 'name', e.target.value)} className="h-7 text-sm" placeholder="Stage name" />
              </div>
              <div className="col-span-6 sm:col-span-3 space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Value ex GST ($)</Label>
                <Input
                  type="number" min="0" value={stage.value || ''}
                  onChange={e => updateStage(stage.id, 'value', parseFloat(e.target.value) || 0)}
                  className="h-7 text-sm" placeholder="0"
                />
              </div>
              <div className="col-span-5 sm:col-span-4 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground">Complete to date</Label>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{stage.percentComplete}%</Badge>
                </div>
                <Slider
                  value={[stage.percentComplete]}
                  onValueChange={([v]) => updateStage(stage.id, 'percentComplete', v)}
                  min={0} max={100} step={5} className="py-1"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <button onClick={() => removeStage(stage.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1" title="Remove stage">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="col-span-12 flex items-center justify-end gap-1.5 pt-0.5">
                <span className="text-[10px] text-muted-foreground">Completed to date:</span>
                <span className="text-xs font-semibold text-[#E1DCC9]">${fmt(stage.value * (stage.percentComplete / 100))}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Live summary */}
      <Card className="border-border/40 bg-background/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground/70 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Work completed to date', value: summary.completedToDate, className: 'text-foreground' },
              { label: `Retention held (${parsedRetention}%)`, value: -summary.retentionHeld, className: '' },
              { label: `Previously claimed (${claims.length} claim${claims.length === 1 ? '' : 's'})`, value: -summary.previouslyClaimedExGst, className: '' },
              { label: 'This claim (ex GST)', value: summary.thisClaimExGst, className: 'text-foreground font-semibold border-t border-border pt-2 mt-2' },
              { label: `GST (${contract.gstPct}%)`, value: summary.gst, className: 'text-muted-foreground text-xs' },
            ].map(({ label, value, className }) => (
              <div key={label} className={`flex justify-between items-center ${className}`}>
                <span>{label}</span>
                <span className={value < -0.005 ? 'text-amber-400' : ''}>
                  {value < -0.005 ? `($${fmt(Math.abs(value))})` : `$${fmt(value)}`}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center border-t-2 border-border/40 pt-3 mt-1">
              <span className="font-bold text-base text-foreground/80">TOTAL DUE THIS CLAIM</span>
              <span className="font-bold text-base text-[#E1DCC9]">${fmt(summary.thisClaimIncGst)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => saveClaim()} className="gap-2" disabled={stages.length === 0}>
          <Save className="h-4 w-4" />
          Save Claim {claimNumber}
        </Button>
        <Button onClick={handleGenerate} className="gap-2 bg-muted/70 hover:bg-muted/80" disabled={stages.length === 0}>
          <FileDown className="h-4 w-4" />
          Save and Generate PDF
        </Button>
      </div>

      {/* Claim history */}
      {claims.length > 0 && (
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Claim history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {[...claims].reverse().map(c => (
              <div key={c.id} className="flex justify-between border-b border-border/40 py-1.5">
                <span>Claim {c.number}, {new Date(c.date).toLocaleDateString('en-AU')}</span>
                <span className="text-muted-foreground">to date ${fmt(c.completedToDate)}</span>
                <span className="font-semibold">${fmt(c.thisClaimIncGst)} inc GST</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
