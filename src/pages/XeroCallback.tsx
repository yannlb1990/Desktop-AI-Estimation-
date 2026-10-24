import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { xeroFinishConnect } from '@/lib/xero/client';

/** Where Xero sends the builder back after signing in: finish the connection, then go back. */
export default function XeroCallback() {
  const navigate = useNavigate();
  const [state, setState] = useState<{ done?: string; error?: string }>({});
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const q = new URLSearchParams(window.location.search);
    const back = (() => {
      try { const b = sessionStorage.getItem('xero_return'); sessionStorage.removeItem('xero_return'); return b && b.startsWith('/') && !b.startsWith('//') ? b : '/settings?tab=xero'; }
      catch { return '/settings?tab=xero'; }
    })();
    if (q.get('error')) { setState({ error: q.get('error') === 'access_denied' ? 'Xero was not connected: access was not allowed.' : 'Xero did not connect. Try again.' }); return; }
    const code = q.get('code'), st = q.get('state');
    if (!code || !st) { setState({ error: 'Nothing came back from Xero. Try connecting again.' }); return; }
    xeroFinishConnect(code, st)
      .then(r => { setState({ done: r.tenantName }); setTimeout(() => navigate(back, { replace: true }), 1500); })
      .catch(e => setState({ error: e instanceof Error ? e.message : 'Xero did not connect' }));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-xl border border-border bg-card p-6 text-center space-y-3">
        {state.done ? (
          <>
            <h1 className="font-display text-xl font-bold">Xero connected</h1>
            <p className="text-sm text-muted-foreground">{state.done}. Taking you back...</p>
          </>
        ) : state.error ? (
          <>
            <h1 className="font-display text-xl font-bold">Xero not connected</h1>
            <p className="text-sm text-muted-foreground">{state.error}</p>
            <Button onClick={() => navigate('/settings?tab=xero', { replace: true })}>Back to Settings</Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Connecting Xero...</p>
        )}
      </div>
    </div>
  );
}
