import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, AlertTriangle, Building2, MapPin, User, DollarSign, Clock, ClipboardCheck } from 'lucide-react';

interface QuoteShare {
  token: string;
  projectId: string;
  projectName: string;
  clientName: string;
  siteAddress: string;
  grandTotal: number;
  estimateItems: Array<{
    id: string;
    category?: string;
    trade?: string;
    name?: string;
    description?: string;
    quantity: number;
    unit: string;
    unitCost: number;
    total: number;
  }>;
  generatedAt: string;
  expiresAt: string;
  status: 'pending' | 'approved' | 'changes_requested';
  approvedByName?: string;
  approvedAt?: string;
  changeComments?: string;
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(v);

export default function QuoteApproval() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<QuoteShare | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [expired, setExpired] = useState(false);
  const [clientNameInput, setClientNameInput] = useState('');
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState<'approved' | 'changes_requested' | null>(null);

  useEffect(() => {
    if (!token) { setNotFound(true); return; }
    const raw = localStorage.getItem(`quote_share_${token}`);
    if (!raw) { setNotFound(true); return; }
    try {
      const data: QuoteShare = JSON.parse(raw);
      if (new Date(data.expiresAt) < new Date()) { setExpired(true); return; }
      setQuote(data);
      if (data.status === 'approved') setSubmitted('approved');
      if (data.status === 'changes_requested') setSubmitted('changes_requested');
      setClientNameInput(data.approvedByName ?? data.clientName ?? '');
    } catch {
      setNotFound(true);
    }
  }, [token]);

  const respond = (action: 'approved' | 'changes_requested') => {
    if (!quote || !token) return;
    const updated: QuoteShare = {
      ...quote,
      status: action,
      approvedByName: clientNameInput,
      approvedAt: new Date().toISOString(),
      changeComments: action === 'changes_requested' ? comments : undefined,
    };
    localStorage.setItem(`quote_share_${token}`, JSON.stringify(updated));
    setQuote(updated);
    setSubmitted(action);
  };

  // Group line items by category/trade
  const grouped = quote
    ? Object.entries(
        (quote.estimateItems ?? []).reduce<Record<string, typeof quote.estimateItems>>((acc, item) => {
          const key = item.category ?? item.trade ?? 'General';
          (acc[key] = acc[key] ?? []).push(item);
          return acc;
        }, {})
      )
    : [];

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white p-6">
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-bold">Link not found</h1>
          <p className="text-slate-400">This quote link has expired or is invalid. Please contact the estimator for a new link.</p>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white p-6">
        <div className="text-center space-y-4 max-w-md">
          <Clock className="h-12 w-12 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-bold">Quote link expired</h1>
          <p className="text-slate-400">This quote link has expired (links are valid for 30 days). Please contact the estimator for a fresh link.</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Brand header */}
      <div className="bg-[#0a1628] border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-cyan-400" />
            <span className="font-bold text-lg tracking-tight">Metricore</span>
          </div>
          <div className="text-xs text-slate-500">Quote Reference · {token?.slice(0, 8).toUpperCase()}</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Project header */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-white">{quote.projectName}</h1>
              <p className="text-slate-400 text-sm mt-1">Estimate prepared by Metricore</p>
            </div>
            <Badge
              variant="outline"
              className={
                quote.status === 'approved'
                  ? 'border-green-500 text-green-400 bg-green-500/10 text-sm px-3 py-1'
                  : quote.status === 'changes_requested'
                  ? 'border-amber-500 text-amber-400 bg-amber-500/10 text-sm px-3 py-1'
                  : 'border-slate-500 text-slate-400 bg-slate-500/10 text-sm px-3 py-1'
              }
            >
              {quote.status === 'approved' ? '✓ Approved' : quote.status === 'changes_requested' ? '⚠ Changes Requested' : 'Awaiting Approval'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {quote.clientName && (
              <div className="flex items-center gap-2 text-slate-300">
                <User className="h-4 w-4 text-slate-500 shrink-0" />
                <span>{quote.clientName}</span>
              </div>
            )}
            {quote.siteAddress && (
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="h-4 w-4 text-slate-500 shrink-0" />
                <span>{quote.siteAddress}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="h-4 w-4 text-slate-500 shrink-0" />
              <span>Issued {new Date(quote.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="h-4 w-4 text-slate-500 shrink-0" />
              <span>Valid until {new Date(quote.expiresAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Grand total banner */}
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Total Estimate (excl. GST)</p>
            <p className="text-4xl font-bold text-cyan-400 mt-1">{fmtCurrency(quote.grandTotal)}</p>
          </div>
          <DollarSign className="h-12 w-12 text-cyan-400/30" />
        </div>

        {/* Line items by category */}
        {grouped.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-200">Estimate Breakdown</h2>
            {grouped.map(([category, items]) => {
              const catTotal = items.reduce((s, i) => s + (i.total ?? 0), 0);
              return (
                <div key={category} className="bg-slate-800/40 border border-slate-700 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/60">
                    <span className="text-sm font-semibold text-slate-200">{category}</span>
                    <span className="text-sm font-mono text-cyan-400">{fmtCurrency(catTotal)}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left px-4 py-2 text-slate-400 font-normal">Item</th>
                        <th className="text-right px-4 py-2 text-slate-400 font-normal w-20">Qty</th>
                        <th className="text-right px-4 py-2 text-slate-400 font-normal w-20">Unit</th>
                        <th className="text-right px-4 py-2 text-slate-400 font-normal w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={item.id ?? i} className="border-b border-slate-700/50 last:border-0">
                          <td className="px-4 py-2 text-slate-200">{item.name ?? item.description ?? '—'}</td>
                          <td className="px-4 py-2 text-right text-slate-300 tabular-nums">{item.quantity}</td>
                          <td className="px-4 py-2 text-right text-slate-400">{item.unit}</td>
                          <td className="px-4 py-2 text-right text-slate-200 tabular-nums font-mono">{fmtCurrency(item.total ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            <div className="flex justify-end">
              <div className="text-right space-y-1">
                <div className="flex gap-8 text-sm text-slate-400">
                  <span>Subtotal (excl. GST)</span>
                  <span className="font-mono tabular-nums text-slate-200">{fmtCurrency(quote.grandTotal)}</span>
                </div>
                <div className="flex gap-8 text-sm text-slate-400">
                  <span>GST (10%)</span>
                  <span className="font-mono tabular-nums text-slate-200">{fmtCurrency(quote.grandTotal * 0.1)}</span>
                </div>
                <Separator className="bg-slate-600 my-2" />
                <div className="flex gap-8 font-bold text-lg">
                  <span className="text-slate-200">Total (incl. GST)</span>
                  <span className="font-mono tabular-nums text-cyan-400">{fmtCurrency(quote.grandTotal * 1.1)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Approval section */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-semibold">Digital Approval</h2>
          </div>

          {submitted === 'approved' ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-400" />
              <h3 className="text-xl font-bold text-green-400">Quote Approved</h3>
              <p className="text-slate-400">
                Approved by <span className="text-slate-200">{quote.approvedByName}</span> on{' '}
                {quote.approvedAt ? new Date(quote.approvedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
              </p>
              <p className="text-slate-500 text-sm">The estimator has been notified. You will receive a copy of this approval by email.</p>
            </div>
          ) : submitted === 'changes_requested' ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle className="h-14 w-14 text-amber-400" />
              <h3 className="text-xl font-bold text-amber-400">Changes Requested</h3>
              <p className="text-slate-400">Your feedback has been sent to the estimator.</p>
              {quote.changeComments && (
                <div className="bg-slate-700/50 rounded-lg p-4 text-sm text-slate-300 text-left max-w-md">
                  <p className="font-medium text-slate-200 mb-1">Your comments:</p>
                  <p>{quote.changeComments}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-slate-400 text-sm">
                By approving, you confirm acceptance of the estimate total of{' '}
                <span className="text-white font-semibold">{fmtCurrency(quote.grandTotal * 1.1)} incl. GST</span> and authorise the estimator to proceed.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Your full name *</label>
                  <Input
                    placeholder="e.g. John Smith"
                    value={clientNameInput}
                    onChange={e => setClientNameInput(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Comments (optional)</label>
                  <Textarea
                    placeholder="Any notes or conditions for your approval, or changes you'd like to request…"
                    value={comments}
                    onChange={e => setComments(e.target.value)}
                    rows={3}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold h-11"
                    disabled={!clientNameInput.trim()}
                    onClick={() => respond('approved')}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve Quote
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-amber-600 text-amber-400 hover:bg-amber-500/10 h-11"
                    disabled={!clientNameInput.trim()}
                    onClick={() => respond('changes_requested')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Request Changes
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 pb-6">
          This quote was prepared using Metricore — Australian Construction Estimation Software.
          <br />
          Quote reference: {token?.toUpperCase()}
        </div>
      </div>
    </div>
  );
}
