import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { newVisit, type SiteVisit } from '@/lib/site/visit';
import { MetricoreLogoMark } from '@/components/MetricoreLogoMark';
import { loadLocalVisits, pullVisits, saveLocalVisit, countPending, syncAll, requestPersistentStorage } from '@/lib/site/siteStore';

/** Phone home for site visits: the jobs walked, newest first, and a big button to start one. */
export default function SiteVisits() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<SiteVisit[]>(loadLocalVisits);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  // Push anything waiting (a visit sent in a dead zone), then refresh. Also when the app
  // comes back to the front and every minute: iOS rarely fires 'online' on weak signal.
  useEffect(() => {
    requestPersistentStorage();
    let alive = true;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      await syncAll().catch(() => {});
      const all = await pullVisits().catch(() => loadLocalVisits());
      if (alive) setVisits(all);
    };
    refresh();
    const on = () => { setOnline(true); refresh(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    const every = window.setInterval(refresh, 60_000);
    return () => {
      alive = false;
      window.removeEventListener('online', on); window.removeEventListener('offline', off);
      window.removeEventListener('pageshow', refresh); document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(every);
    };
  }, []);

  const [problem, setProblem] = useState('');
  const start = () => {
    try {
      const v = saveLocalVisit(newVisit());
      navigate(`/site/${v.id}`);
    } catch (e) { setProblem(e instanceof Error ? e.message : 'Could not start a visit on this phone'); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 max-w-xl mx-auto" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' }}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <MetricoreLogoMark height={26} />
          <span className="font-display text-lg font-bold">Metricore</span>
        </span>
        <button className="text-sm text-muted-foreground" onClick={() => navigate('/dashboard')}>Dashboard</button>
      </div>
      <h1 className="mt-6 font-display text-2xl font-bold">Site visits</h1>
      {!online && <p className="mt-2 text-sm text-amber-400">No signal: everything saves on this phone and uploads later.</p>}
      {problem && <p className="mt-2 text-sm text-red-400">{problem}</p>}

      <button onClick={start} className="mt-5 w-full rounded-xl bg-primary py-4 text-base font-semibold text-primary-foreground">
        Start a site visit
      </button>

      <div className="mt-6 space-y-3">
        {visits.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Walk the job room by room: photos, sizes, what needs doing. Send it to the office and the estimate starts from it.
          </p>
        )}
        {visits.map(v => {
          const pending = countPending(v);
          return (
            <button key={v.id} onClick={() => navigate(`/site/${v.id}`)} className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{v.jobName || 'Untitled visit'}</span>
                <span className={`shrink-0 text-xs ${pending ? 'text-amber-400' : 'text-[#D4A045]'}`}>{pending ? 'Waiting for signal' : 'In the office'}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {v.address || 'No address'} · {v.rooms.length} room{v.rooms.length !== 1 ? 's' : ''}
                {pending > 0 ? ` · ${pending} photo${pending !== 1 ? 's' : ''} to upload` : ''}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
