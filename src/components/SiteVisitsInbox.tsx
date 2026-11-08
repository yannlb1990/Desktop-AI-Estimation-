import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getUserStorageKey } from '@/lib/localAuth';
import { syncProjectToSupabase } from '@/lib/db/projects';
import { ensureClientForProject } from '@/lib/db/clients';
import { stateFromAddress } from '@/lib/defaultState';
import { pullVisits, linkVisitToProject } from '@/lib/site/siteStore';
import type { SiteVisit } from '@/lib/site/visit';
import { SitePhotoThumb, SitePhotoViewer } from '@/components/site/SitePhotoThumb';

/** Dashboard: visits sent from site. Linked ones open the estimate; new jobs become a project in one click. */
export function SiteVisitsInbox() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [linkTo, setLinkTo] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState<{ url: string; caption: string } | null>(null);
  // Visits from the last 30 days, linked or not, newest first: each one opens as a full report
  useEffect(() => {
    const since = Date.now() - 30 * 86_400_000;
    pullVisits().then(all => setVisits(all
      .filter(v => (v.rooms.length > 0 || v.notes) && new Date(v.updatedAt).getTime() >= since)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))).catch(() => {});
  }, []);
  if (visits.length === 0) return null;

  const projects: { id: string; name: string }[] = (() => {
    try { return JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]').map((p: any) => ({ id: p.id, name: p.name || 'Untitled' })); } catch { return []; }
  })();
  const nameOf = (id: string | null) => projects.find(p => p.id === id)?.name;

  const attach = async (v: SiteVisit, projectId: string) => {
    const ok = await linkVisitToProject(v.id, projectId);
    if (!ok) toast.warning('Linked on this computer; the cloud link is saved when the connection is back');
    setVisits(vs => vs.map(x => x.id === v.id ? { ...x, projectId } : x));
    navigate(`/project/${projectId}`);
  };

  const createProject = async (v: SiteVisit) => {
    if (busy) return;
    setBusy(true);
    const project = {
      id: crypto.randomUUID(),
      name: v.jobName || v.address || 'Site visit job',
      client_name: v.clientName || null,
      site_address: v.address || null,
      address: v.address || 'TBD',
      state: stateFromAddress(v.address),
      postcode: null,
      status: 'in_progress',
      created_at: new Date().toISOString(),
      estimate_items: [],
    };
    const all = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
    all.unshift(project);
    localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(all));
    syncProjectToSupabase(project);
    ensureClientForProject(project.client_name, project.state);
    toast.success(`Project created from the site visit: ${project.name}`);
    await attach(v, project.id);
  };

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 space-y-3">
      <div className="font-semibold">From site, last 30 days ({visits.length})</div>
      {visits.map(v => {
        const linked = v.projectId && nameOf(v.projectId);
        const lines = v.rooms.reduce((n, r) => n + r.scope.length, 0);
        const photos = v.rooms.reduce((n, r) => n + r.photos.length, 0);
        return (
          <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-sm first:border-0 first:pt-0">
            <span className="flex flex-wrap items-center gap-3">
              <span>
                <span className="font-medium">{v.jobName || 'Site visit'}</span>
                <span className="ml-2 text-muted-foreground">
                  {new Date(v.updatedAt).toLocaleDateString('en-AU')} · {v.address || 'no address'} · {v.rooms.length} room{v.rooms.length !== 1 ? 's' : ''}, {lines} item{lines !== 1 ? 's' : ''}, {photos} photo{photos !== 1 ? 's' : ''}
                </span>
              </span>
              <span className="flex gap-1.5">
                {v.rooms.flatMap(r => r.photos).slice(0, 3).map(p => (
                  <SitePhotoThumb key={p.id} photo={p} size="h-10 w-10" onOpen={(url, caption) => setBig({ url, caption })} />
                ))}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`/site-report/${v.id}`)}>View site report</Button>
            {linked ? (
              <Button size="sm" variant="outline" onClick={() => navigate(`/project/${v.projectId}`)}>Open {linked}</Button>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={busy} onClick={() => createProject(v)}>Create project</Button>
                <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={linkTo[v.id] ?? ''}
                  onChange={e => setLinkTo(m => ({ ...m, [v.id]: e.target.value }))}>
                  <option value="">or add to a project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {linkTo[v.id] && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setBusy(true); attach(v, linkTo[v.id]); }}>Add</Button>}
              </span>
            )}
            </span>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">View site report shows the rooms, sizes, ticks, notes and photos, ready to print. In the project, Estimate, Add to estimate turns them into lines.</p>
      <SitePhotoViewer photo={big} onClose={() => setBig(null)} />
    </div>
  );
}
