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

/** Dashboard: visits sent from site. Linked ones open the estimate; new jobs become a project in one click. */
export function SiteVisitsInbox() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [linkTo, setLinkTo] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);
  // Only visits still waiting for a project: linked ones live in their project's estimate
  useEffect(() => { pullVisits().then(all => setVisits(all.filter(v => v.status === 'sent' && !v.projectId))).catch(() => {}); }, []);
  if (visits.length === 0) return null;

  const projects: { id: string; name: string }[] = (() => {
    try { return JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]').map((p: any) => ({ id: p.id, name: p.name || 'Untitled' })); } catch { return []; }
  })();
  const nameOf = (id: string | null) => projects.find(p => p.id === id)?.name;

  const attach = async (v: SiteVisit, projectId: string) => {
    const ok = await linkVisitToProject(v.id, projectId);
    if (!ok) toast.warning('Linked on this computer; the cloud link is saved when the connection is back');
    setVisits(vs => vs.filter(x => x.id !== v.id));
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
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 space-y-3">
      <div className="font-semibold">From site ({visits.length})</div>
      {visits.map(v => {
        const linked = v.projectId && nameOf(v.projectId);
        const lines = v.rooms.reduce((n, r) => n + r.scope.length, 0);
        const photos = v.rooms.reduce((n, r) => n + r.photos.length, 0);
        return (
          <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>
              <span className="font-medium">{v.jobName || 'Site visit'}</span>
              <span className="ml-2 text-muted-foreground">
                {v.address || 'no address'} · {v.rooms.length} room{v.rooms.length !== 1 ? 's' : ''}, {lines} item{lines !== 1 ? 's' : ''}, {photos} photo{photos !== 1 ? 's' : ''}
              </span>
            </span>
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
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">In the project, open Estimate, Add to estimate, From site: photos, notes and draft lines with quantities from the room sizes.</p>
    </div>
  );
}
