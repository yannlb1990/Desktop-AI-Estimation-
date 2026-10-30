import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-key', { body });
  if (error) {
    const msg = await (error as any).context?.json?.().then((j: any) => j?.error).catch(() => null);
    throw new Error(msg || data?.error || 'Could not reach the server: try again');
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/**
 * Settings > AI: use your own Claude API key so plan analyses and site reviews are billed
 * to your Anthropic account. The key is checked, then kept encrypted on the server; it is
 * never shown again or sent back to the browser.
 */
export function AiKeySettings() {
  const [status, setStatus] = useState<{ saved: boolean; hint?: string } | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => call<{ saved: boolean; hint?: string }>({ action: 'status' }).then(setStatus).catch(() => setStatus({ saved: false }));
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    try { await call({ action: 'save', key: key.trim() }); setKey(''); toast.success('Key checked and saved'); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save the key'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await call({ action: 'remove' }); toast.success('Key removed: Metricore AI is used again'); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove the key'); }
    finally { setBusy(false); }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader><CardTitle>AI</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          The plan analyser and site visit reviews run on Claude. By default Metricore pays for them. If you run a lot of analyses, you can use your own Claude API key instead: they are then billed to your Anthropic account, with no limit from Metricore.
        </p>

        {status === null ? (
          <p className="text-muted-foreground">Checking...</p>
        ) : status.saved ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <span>Using your key <span className="font-mono">{status.hint}</span>. Analyses are billed to your Anthropic account.</span>
            <Button size="sm" variant="ghost" disabled={busy} onClick={remove}>Remove key</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Claude API key (starts with sk-ant-)</span>
              <Input type="password" autoComplete="off" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} placeholder="sk-ant-..." />
            </label>
            <Button size="sm" disabled={busy || !key.trim()} onClick={save}>{busy ? 'Checking with Anthropic...' : 'Check and save key'}</Button>
          </div>
        )}

        <div className="space-y-1 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How to get a key</p>
          <p>At console.anthropic.com: sign in or create an account, add credit under Billing, then API keys, Create key. Copy it and paste it above.</p>
          <p className="pt-1 font-medium text-foreground">What happens to it</p>
          <p>The key is checked with Anthropic, then kept encrypted on Metricore's server. It is never shown again or sent back to your browser, and only used for your own analyses. Remove it at any time.</p>
          <p>Your plans and photos go to Anthropic for the analysis, as they do with Metricore's AI. Anthropic does not use API data to train its models by default.</p>
        </div>
      </CardContent>
    </Card>
  );
}
