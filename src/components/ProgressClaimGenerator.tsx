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
  syncClientApprovals,
  type ClaimStage,
  type ProgressClaimRecord,
  loadProject,
} from '@/lib/contract';
import { lsLoadVariations } from '@/lib/db/variations';
import { claimInvoiceLines, claimReference, depositCapPct } from '@/lib/xero/claimInvoice';
import { xeroStatus, xeroSendInvoice, xeroStartConnect, xeroOptions, type XeroStatus, type XeroAccount } from '@/lib/xero/client';
import { XeroInvoiceDialog } from '@/components/estimate/XeroInvoiceDialog';
import type { InvoiceLine } from '@/lib/xero/claimInvoice';
import { gstOn, roundCents } from '@/lib/pricing/estimatePricing';

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
  // stages carry on from the last progress claim (not a deposit or a variation invoice)
  const lastClaim = [...claims].reverse().find(c => !c.kind);

  const [claimDate, setClaimDate] = useState(() => new Date().toISOString().split('T')[0]);
  // retention carries on from the last progress claim (a deposit has none)
  const [retentionPct, setRetentionPct] = useState(() => String([...claims].reverse().find(c => c.kind !== 'deposit')?.retentionPct ?? 5));
  const [contractorName, setContractorName] = useState('');
  const [contractorAbn, setContractorAbn] = useState('');
  const [stages, setStages] = useState<ClaimStage[]>(() => stagesForNextClaim(projectId, lastClaim));

  // Pick up a newly approved quote or variation when the tab is opened again
  const refresh = useCallback(() => {
    const latestClaims = loadProgressClaims(projectId);
    setContract(contractSummary(projectId));
    setClaims(latestClaims);
    setStages(stagesForNextClaim(projectId, [...latestClaims].reverse().find(c => !c.kind)));
  }, [projectId]);
  useEffect(() => {
    // A client may have approved through their link since this was last opened
    const check = () => { syncClientApprovals(projectId).then(recorded => { if (recorded) toast.success(`${recorded.approvedBy || 'Your client'} approved quote version ${recorded.versionNumber}`); refresh(); }); };
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [projectId, refresh]);

  // the deposit is not a numbered claim
  const progressClaims = claims.filter(c => !c.kind);
  const claimNumber = progressClaims.length + 1;

  // Xero: the connection (organisation name, accounts) for the bar, the buttons and the preview
  const [xero, setXero] = useState<XeroStatus | null>(null);
  const [xeroAccounts, setXeroAccounts] = useState<XeroAccount[]>([]);
  const xeroOn = xero === null ? null : xero.connected;
  useEffect(() => {
    xeroStatus().then(s => {
      setXero(s);
      if (s.connected) xeroOptions().then(o => setXeroAccounts(o.accounts)).catch(() => {});
    }).catch(() => setXero({ connected: false }));
  }, []);
  const [sending, setSending] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProgressClaimRecord | null>(null);
  const connectXero = () => xeroStartConnect(window.location.pathname + window.location.search)
    .catch(e => toast.error(e instanceof Error ? e.message : 'Xero did not respond'));
  const clientFor = () => {
    const project = loadProject(projectId);
    return { name: (clientName || project?.client_name || '').trim(), email: project?.client_email || undefined };
  };

  function sendToXero(c: ProgressClaimRecord) {
    if (!xeroOn) { connectXero(); return; }
    if (!(c.thisClaimExGst > 0)) { toast.error('There is nothing to invoice on this claim'); return; }
    if (!clientFor().name) { toast.error("Add the client's name to the project first: the invoice goes to them"); return; }
    setPreview(c);
  }

  async function confirmSend(c: ProgressClaimRecord, p: { reference: string; lines: InvoiceLine[] }) {
    setSending(c.id);
    try {
      const r = await xeroSendInvoice({
        projectId, sourceId: c.id,
        contact: clientFor(),
        reference: p.reference,
        date: c.date,
        lines: p.lines.map(l => ({ description: l.description.trim(), amount: l.amount, kind: l.kind, accountCode: l.accountCode })),
      });
      setPreview(null);
      const latest = loadProgressClaims(projectId).map(x => x.id === c.id
        ? { ...x, xero: { invoiceId: r.invoiceId, number: r.number, url: r.url, total: r.total, sentAt: new Date().toISOString() } }
        : x);
      saveProgressClaims(projectId, latest);
      setClaims(latest);
      // Xero works GST out line by line; ours is on the total: say so if they differ
      const centsOff = r.total != null ? Math.round((r.total - c.thisClaimIncGst) * 100) / 100 : 0;
      toast.success(`${r.updated ? 'Updated' : 'Draft'} invoice ${r.number ?? ''} in Xero`, {
        description: centsOff ? `Xero's total is $${fmt(r.total!)}, ${Math.abs(centsOff)} ${centsOff > 0 ? 'more' : 'less'} than the claim (GST rounded per line). Check before approving.` : undefined,
        action: { label: 'Open in Xero', onClick: () => window.open(r.url, '_blank', 'noopener') },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xero did not take the invoice');
    } finally {
      setSending(null);
    }
  }

  // Approved variations: on the next claim (default), or invoiced on their own as additional works
  const approvedVariations = useMemo(
    () => lsLoadVariations(projectId).filter((v: any) => v.status === 'approved').sort((a: any, b: any) => a.number - b.number),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, claims, contract],
  );
  const voLabel = (v: any) => `Variation VO-${String(v.number).padStart(3, '0')}: ${v.title || 'Untitled'}`;
  function invoiceVariation(v: any) {
    const amount = roundCents(Number(v.totalAmount) || 0);
    if (!(amount > 0)) { toast.error('This variation has no amount to invoice'); return; }
    const gst = gstOn(amount, contract.gstPct);
    const record: ProgressClaimRecord = {
      id: crypto.randomUUID(), number: 0, date: claimDate, stages: [], retentionPct: 0,
      completedToDate: 0, retentionHeld: 0, thisClaimExGst: amount, gst, thisClaimIncGst: roundCents(amount + gst),
      kind: 'variation', variationId: v.id, variationLabel: voLabel(v),
      variationItems: (v.items ?? []).map((i: any) => ({ description: i.description || 'Item', qty: Number(i.qty) || 0, unit: i.unit || 'ea', rate: Number(i.rate) || 0, amount: (Number(i.qty) || 0) * (Number(i.rate) || 0) })),
    };
    const updated = [...claims, record];
    saveProgressClaims(projectId, updated);
    setClaims(updated);
    setStages(st => st.filter(x => x.id !== `vo-${v.id}`));
    if (xeroOn) sendToXero(record);
    else toast.success(`${voLabel(v)} set to invoice on its own. Claims leave it out.`);
  }
  function putBackOnClaims(record: ProgressClaimRecord) {
    const updated = claims.filter(c => c.id !== record.id);
    saveProgressClaims(projectId, updated);
    setClaims(updated);
    setStages(stagesForNextClaim(projectId, [...updated].reverse().find(c => !c.kind)));
    toast.success('Back on the next claim');
  }

  // Deposit: before any progress claim, off the approved contract
  const hasDeposit = claims.some(c => c.kind === 'deposit');
  const [depositPctInput, setDepositPctInput] = useState(() =>
    String(contract.approvedQuote?.paymentSchedule?.depositPct || depositCapPct(contract.contractExGst)));
  const depositPct = parseFloat(depositPctInput) || 0;
  const depositExGst = roundCents(contract.contractExGst * depositPct / 100);
  const depositOverCap = state === 'QLD' && depositPct > depositCapPct(contract.contractExGst);
  function saveDeposit(): ProgressClaimRecord | null {
    if (!(depositExGst > 0)) { toast.error('Enter the deposit %'); return null; }
    const gst = gstOn(depositExGst, contract.gstPct);
    const record: ProgressClaimRecord = {
      id: crypto.randomUUID(), number: 0, date: claimDate, stages: [], retentionPct: 0,
      completedToDate: 0, retentionHeld: 0, thisClaimExGst: depositExGst, gst, thisClaimIncGst: roundCents(depositExGst + gst),
      kind: 'deposit', depositPct, contractExGst: contract.contractExGst,
    };
    const updated = [...claims, record];
    saveProgressClaims(projectId, updated);
    setClaims(updated);
    toast.success(`Deposit saved ($${fmt(record.thisClaimIncGst)} inc GST). Claims take it off as already claimed.`);
    return record;
  }
  const parsedRetention = parseFloat(retentionPct) || 0;
  const stagesTotal = stages.reduce((s, st) => s + (st.value || 0), 0);
  const summary = useMemo(
    () => computeClaim(stages, parsedRetention, claims, contract.gstPct),
    [stages, parsedRetention, claims, contract.gstPct],
  );
  // variations invoiced on their own are outside the claim stages
  const invoicedVariationsExGst = claims.filter(c => c.kind === 'variation').reduce((s, c) => s + c.thisClaimExGst, 0);
  const stagesMismatch = contract.approvedQuote && Math.abs(stagesTotal - (contract.contractExGst - invoicedVariationsExGst)) > 1;

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
    if (summary.thisClaimExGst <= 0) {
      const depositOnly = claims.length > 0 && claims.every(c => c.kind === 'deposit');
      toast.error(summary.thisClaimExGst === 0 ? 'Nothing to claim: no new work since the last claim.'
        : depositOnly ? 'The deposit already covers the work done so far: claim when the work is worth more than the deposit.'
        : 'This claim is negative: the % complete is lower than already claimed.');
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
      previousStagePct: Object.fromEntries(([...claims].reverse().find(c => c.kind !== 'deposit')?.stages ?? []).map(s => [s.id, s.percentComplete || 0])),
      contractorName,
      contractorAbn,
    });
  }

  return (
    <div className="space-y-6">
      {/* Where invoices go */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-4 py-2.5 text-sm">
        {xero === null ? (
          <span className="text-muted-foreground">Checking Xero...</span>
        ) : xero.connected ? (
          <>
            <span>Invoices go to <span className="font-medium">{xero.tenantName}</span> in Xero as drafts. Use Send to Xero on the deposit or a claim below.</span>
            <a href="/settings?tab=xero" className="text-xs text-[#D4A045] hover:underline">Accounts and branding</a>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Connect Xero to send the deposit and each claim as a draft invoice.</span>
            <Button size="sm" variant="outline" onClick={connectXero}>Connect Xero</Button>
          </>
        )}
      </div>

      {preview && xero?.connected && (
        <XeroInvoiceDialog
          open={!!preview}
          onOpenChange={v => { if (!v) setPreview(null); }}
          title={preview.kind === 'deposit' ? 'Deposit invoice' : preview.kind === 'variation' ? `${preview.variationLabel ?? 'Variation'}: additional works invoice` : `Progress claim ${preview.number} invoice`}
          status={xero}
          accounts={xeroAccounts}
          clientName={clientFor().name}
          reference={claimReference(preview, contract.approvedQuote?.quoteNumber, siteAddress)}
          date={preview.date}
          lines={claimInvoiceLines(preview, claims, contract.approvedQuote?.quoteNumber)}
          gstPct={contract.gstPct}
          existingNumber={preview.xero?.number}
          busy={sending === preview.id}
          onSend={p => confirmSend(preview, p)}
        />
      )}

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

      {contract.approvedQuote && !hasDeposit && progressClaims.length === 0 && (
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Deposit</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4 text-sm">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Deposit % of contract sum</Label>
              <Input inputMode="decimal" value={depositPctInput} onChange={e => setDepositPctInput(e.target.value)} className="h-8 w-28 text-sm" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Deposit</p>
              <p className="font-semibold">${fmt(depositExGst)} ex GST, ${fmt(roundCents(depositExGst + gstOn(depositExGst, contract.gstPct)))} inc GST</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => saveDeposit()}>Save deposit</Button>
            {xeroOn && (
              <Button size="sm" onClick={() => { const r = saveDeposit(); if (r) sendToXero(r); }}>Save and send to Xero</Button>
            )}
            {depositOverCap && (
              <p className="basis-full text-xs text-amber-400">
                Over the usual QLD limit for domestic building work: {depositCapPct(contract.contractExGst)}% for a contract of this size. Check your contract before invoicing it.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {approvedVariations.length > 0 && (
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Approved variations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="mb-2 text-xs text-muted-foreground">
              Each approved variation goes on the next claim as its own line. To bill one straight away, invoice it on its own as additional works: claims then leave it out.
            </p>
            {approvedVariations.map((v: any) => {
              const own = claims.find(c => c.kind === 'variation' && c.variationId === v.id);
              const onClaim = progressClaims.find(c => c.stages.some(st => st.id === `vo-${v.id}` && (st.percentComplete || 0) > 0));
              return (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-1.5">
                  <span className="min-w-48 flex-1">{voLabel(v)}</span>
                  <span className="font-mono">${fmt(Number(v.totalAmount) || 0)} ex GST</span>
                  <span className="flex items-center gap-2">
                    {own ? (
                      <>
                        <span className="text-xs text-[#D4A045]">{own.xero ? `Invoiced on its own (${own.xero.number ?? 'in Xero'})` : 'Invoiced on its own'}</span>
                        {!own.xero && <Button size="sm" variant="ghost" className="h-7" onClick={() => putBackOnClaims(own)}>Put back on claims</Button>}
                      </>
                    ) : onClaim ? (
                      <span className="text-xs text-muted-foreground">On claim {onClaim.number}</span>
                    ) : (
                      <>
                        <span className="text-xs text-muted-foreground">On the next claim</span>
                        <Button size="sm" variant="outline" className="h-7" disabled={sending !== null} onClick={() => invoiceVariation(v)}>
                          {xeroOn ? 'Invoice now as additional works' : 'Invoice on its own'}
                        </Button>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
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
              { label: `Previously claimed (${[progressClaims.length ? `${progressClaims.length} claim${progressClaims.length === 1 ? '' : 's'}` : '', hasDeposit ? 'deposit' : ''].filter(Boolean).join(' and ') || 'none'})`, value: -summary.previouslyClaimedExGst, className: '' },
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
        {xeroOn && (
          <Button onClick={() => { const r = saveClaim(); if (r) sendToXero(r); }} disabled={stages.length === 0}>
            Save and send to Xero
          </Button>
        )}
      </div>

      {/* Claim history */}
      {claims.length > 0 && (
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Claim history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {[...claims].reverse().map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-1.5">
                <span className="min-w-36">{c.kind === 'deposit' ? `Deposit (${c.depositPct}%)` : c.kind === 'variation' ? (c.variationLabel ?? 'Variation') : `Claim ${c.number}`}, {new Date(c.date).toLocaleDateString('en-AU')}</span>
                <span className="text-muted-foreground">{c.kind ? '' : `to date $${fmt(c.completedToDate)}`}</span>
                <span className="font-semibold">${fmt(c.thisClaimIncGst)} inc GST</span>
                <span className="flex items-center gap-2">
                  {c.xero && (
                    <a href={c.xero.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#D4A045] hover:underline">
                      {c.xero.number || 'Invoice'} in Xero
                    </a>
                  )}
                  <Button size="sm" variant="outline" className="h-7" disabled={sending !== null || xeroOn === null} onClick={() => sendToXero(c)}>
                    {sending === c.id ? 'Sending...' : !xeroOn ? 'Connect Xero' : c.xero ? 'Update in Xero' : 'Send to Xero'}
                  </Button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
