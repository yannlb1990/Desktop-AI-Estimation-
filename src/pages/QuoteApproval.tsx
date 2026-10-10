import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, AlertTriangle, Building2, MapPin, User, Clock, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { QuoteSharePayload } from '@/lib/contract';

interface ShareView {
  token: string;
  payload: QuoteSharePayload;
  status: 'pending' | 'approved' | 'changes_requested';
  responded_name: string | null;
  responded_at: string | null;
  comments: string | null;
  expires_at: string;
  expired: boolean;
}

const money = (v: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 }).format(v);

/**
 * Public page a client opens from the estimator's approval link. No account needed:
 * the quote is read and answered through two database functions keyed on the token.
 */
export default function QuoteApproval() {
  const { token } = useParams<{ token: string }>();
  const [share, setShare] = useState<ShareView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [name, setName] = useState('');
  const [comments, setComments] = useState('');
  const [mode, setMode] = useState<'approve' | 'changes'>('approve');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setState('notfound'); return; }
    (supabase as any).rpc('get_quote_share', { p_token: token }).then(({ data, error }: any) => {
      if (error || !data) { setState('notfound'); return; }
      setShare(data as ShareView);
      setName((data as ShareView).payload.clientName || '');
      setState('ready');
    });
  }, [token]);

  const respond = async () => {
    if (!token || !share) return;
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (mode === 'changes' && !comments.trim()) { setError('Please describe the changes you need.'); return; }
    setSubmitting(true);
    setError(null);
    const { data, error: rpcError } = await (supabase as any).rpc('respond_quote_share', {
      p_token: token,
      p_status: mode === 'approve' ? 'approved' : 'changes_requested',
      p_name: name.trim(),
      p_comments: mode === 'changes' ? comments.trim() : null,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(/already answered/.test(rpcError.message) ? 'This quote has already been answered.'
        : /expired/.test(rpcError.message) ? 'This link has expired. Please ask for a new one.'
        : 'Something went wrong. Please try again.');
      return;
    }
    setShare(data as ShareView);
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === 'notfound' || !share) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="text-center space-y-3 max-w-md">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-bold">Link not found</h1>
          <p className="text-muted-foreground">This quote link is invalid. Please contact your builder for a new link.</p>
        </div>
      </div>
    );
  }

  const q = share.payload;
  const byTrade = q.lines.reduce<Record<string, typeof q.lines>>((acc, l) => {
    (acc[l.trade || 'General'] = acc[l.trade || 'General'] || []).push(l);
    return acc;
  }, {});
  const answered = share.status !== 'pending';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Header */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <p className="text-xs uppercase tracking-wider text-amber-400 font-semibold">Quotation {q.quoteNumber}</p>
          <h1 className="text-2xl font-bold">{q.projectName}</h1>
          <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Building2 className="h-4 w-4" />{q.company.name || 'Your builder'}{q.company.abn ? `, ABN ${q.company.abn}` : ''}</span>
            {q.siteAddress && <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{q.siteAddress}</span>}
            {q.clientName && <span className="flex items-center gap-2"><User className="h-4 w-4" />Prepared for {q.clientName}</span>}
            <span className="flex items-center gap-2"><Clock className="h-4 w-4" />Valid until {new Date(share.expires_at).toLocaleDateString('en-AU')}</span>
          </div>
        </div>

        {/* Lines */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          {Object.entries(byTrade).map(([trade, lines]) => (
            <div key={trade}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{trade}</p>
              {lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-4 py-1.5 text-sm border-b border-border/40">
                  <span>{l.description}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{l.qty} {l.unit}</span>
                  <span className="font-mono whitespace-nowrap">{money(l.qty * l.unitPrice)}</span>
                </div>
              ))}
            </div>
          ))}
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (ex GST)</span><span className="font-mono">{money(q.subtotalExGst)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST ({q.gstPct}%)</span><span className="font-mono">{money(q.gst)}</span></div>
            <div className="flex justify-between text-lg font-bold pt-1"><span>Total (inc GST)</span><span className="font-mono text-[#E1DCC9]">{money(q.totalIncGst)}</span></div>
          </div>
          {q.paymentSchedule && (
            <p className="text-xs text-muted-foreground">
              Payments: {q.paymentSchedule.depositPct}% deposit, {q.paymentSchedule.progressPct}% progress, {q.paymentSchedule.finalPct}% on completion.
            </p>
          )}
        </div>

        {/* Response */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          {answered ? (
            <div className="flex gap-3 items-start">
              {share.status === 'approved'
                ? <CheckCircle2 className="h-6 w-6 text-amber-400 shrink-0" />
                : <MessageSquare className="h-6 w-6 text-orange-400 shrink-0" />}
              <div>
                <p className="font-semibold">
                  {share.status === 'approved' ? 'Quote approved' : 'Changes requested'} by {share.responded_name}
                  {share.responded_at ? ` on ${new Date(share.responded_at).toLocaleDateString('en-AU')}` : ''}
                </p>
                {share.comments && <p className="text-sm text-muted-foreground mt-1">"{share.comments}"</p>}
                <p className="text-sm text-muted-foreground mt-2">Your builder has been notified in Metricore.</p>
              </div>
            </div>
          ) : share.expired ? (
            <p className="text-sm text-amber-400">This link has expired. Please ask your builder for a new one.</p>
          ) : (
            <>
              <div className="flex gap-2">
                <Button variant={mode === 'approve' ? 'default' : 'outline'} onClick={() => setMode('approve')} className="flex-1">Approve quote</Button>
                <Button variant={mode === 'changes' ? 'default' : 'outline'} onClick={() => setMode('changes')} className="flex-1">Request changes</Button>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Your full name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
              </div>
              {mode === 'changes' && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">What would you like changed?</label>
                  <Textarea value={comments} onChange={e => setComments(e.target.value)} rows={4} />
                </div>
              )}
              {mode === 'approve' && (
                <p className="text-xs text-muted-foreground">
                  By approving, you accept this quotation of {money(q.totalIncGst)} including GST.
                </p>
              )}
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button onClick={respond} disabled={submitting} className="w-full">
                {submitting ? 'Sending...' : mode === 'approve' ? 'Approve this quote' : 'Send change request'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
