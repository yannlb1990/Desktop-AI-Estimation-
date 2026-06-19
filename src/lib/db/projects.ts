/**
 * Write-through project persistence: localStorage (fast) + Supabase (durable).
 * On every save: write localStorage first (instant UI), then sync to Supabase in background.
 * On load: try Supabase first (cross-device), fall back to localStorage.
 */
import { supabase } from '@/integrations/supabase/client';
import { getUserStorageKey } from '@/lib/localAuth';

const LS_KEY = 'local_projects';

// ── localStorage helpers ──────────────────────────────────────────────────────

export function lsLoadProjects(): any[] {
  try {
    return JSON.parse(localStorage.getItem(getUserStorageKey(LS_KEY)) || '[]');
  } catch {
    return [];
  }
}

export function lsSaveProjects(projects: any[]): void {
  localStorage.setItem(getUserStorageKey(LS_KEY), JSON.stringify(projects));
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function getAuthUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** Push one project to Supabase (upsert). Retries up to 3 times with backoff. */
export async function syncProjectToSupabase(project: any, retries = 3): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;

  const row = {
    id: project.id,
    user_id: userId,
    name: project.name ?? 'Untitled',
    client_name: project.client_name ?? null,
    site_address: project.site_address ?? project.address ?? null,
    address: project.address ?? project.site_address ?? null,
    state: project.state ?? 'NSW',
    postcode: project.postcode ?? '0000',
    plan_file_name: project.plan_file_name ?? null,
    plan_file_url: project.plan_file_url ?? null,
    status: project.status ?? 'in_progress',
    quote_status: project.quoteStatus ?? null,
    due_date: project.due_date ?? null,
    // Full project JSON for lossless round-trip
    data: {
      estimate_items: project.estimate_items ?? [],
      consumables: project.consumables ?? [],
      estimate_config: project.estimate_config ?? {},
      overhead_total: project.overhead_total ?? 0,
      grand_total: project.grand_total ?? 0,
      total_materials: project.total_materials ?? 0,
      total_labour: project.total_labour ?? 0,
      total_markup: project.total_markup ?? 0,
      labour_rates: project.labour_rates ?? {},
      grouping_mode: project.grouping_mode ?? 'none',
      // any other fields not explicitly mapped
      ...Object.fromEntries(
        Object.entries(project).filter(([k]) =>
          !['id', 'user_id', 'name', 'client_name', 'site_address', 'address',
            'state', 'postcode', 'plan_file_name', 'plan_file_url', 'status',
            'quoteStatus', 'due_date', 'created_at', 'updated_at'].includes(k)
        )
      ),
    },
    updated_at: new Date().toISOString(),
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { error } = await (supabase as any)
        .from('projects')
        .upsert(row, { onConflict: 'id' });
      if (!error) return;
      throw new Error(error.message);
    } catch (e) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, attempt * 500));
      } else {
        console.error('[syncProject] Supabase sync failed after retries:', e instanceof Error ? e.message : e);
      }
    }
  }
}

/** Delete a project from Supabase. Never throws. */
export async function deleteProjectFromSupabase(projectId: string): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;
  try {
    await (supabase as any).from('projects').delete().eq('id', projectId).eq('user_id', userId);
  } catch (e) {
    console.error('[deleteProject] Supabase delete failed:', e instanceof Error ? e.message : e);
  }
}

/** Load all projects from Supabase, reconstruct full project objects. */
export async function loadProjectsFromSupabase(): Promise<any[]> {
  const userId = await getAuthUserId();
  if (!userId) return [];

  try {
    const { data, error } = await (supabase as any)
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      // Typed columns
      id: row.id,
      name: row.name,
      client_name: row.client_name,
      site_address: row.site_address,
      address: row.address,
      state: row.state,
      postcode: row.postcode,
      plan_file_name: row.plan_file_name,
      plan_file_url: row.plan_file_url,
      status: row.status,
      quoteStatus: row.quote_status,
      due_date: row.due_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      // Embedded JSON fields
      ...(row.data ?? {}),
    }));
  } catch {
    return [];
  }
}

/**
 * Merge strategy: newer updated_at wins for projects that exist in both stores.
 * localStorage-only projects are kept (offline-created, not yet synced).
 * If a localStorage version is newer than DB, it wins and gets synced back.
 */
export async function loadProjectsMerged(): Promise<any[]> {
  const [dbProjects, lsProjects] = await Promise.all([
    loadProjectsFromSupabase(),
    Promise.resolve(lsLoadProjects()),
  ]);

  if (dbProjects.length === 0) return lsProjects;

  const lsById = new Map(lsProjects.map((p: any) => [p.id, p]));
  const dbById = new Map(dbProjects.map((p: any) => [p.id, p]));
  const merged: any[] = [];

  for (const dbProject of dbProjects) {
    const lsProject = lsById.get(dbProject.id);
    if (lsProject) {
      const dbTime = new Date(dbProject.updated_at || dbProject.created_at || 0).getTime();
      const lsTime = new Date(lsProject.updated_at || lsProject.created_at || 0).getTime();
      if (lsTime > dbTime) {
        // Offline edit is newer — use it and sync back to DB
        merged.push(lsProject);
        syncProjectToSupabase(lsProject);
      } else {
        merged.push(dbProject);
      }
    } else {
      merged.push(dbProject);
    }
  }

  // LS-only projects (offline-created, not yet synced)
  for (const lsProject of lsProjects) {
    if (!dbById.has(lsProject.id)) {
      merged.push(lsProject);
      syncProjectToSupabase(lsProject);
    }
  }

  return merged.sort(
    (a, b) =>
      new Date(b.updated_at || b.created_at || 0).getTime() -
      new Date(a.updated_at || a.created_at || 0).getTime()
  );
}

/**
 * One-time migration: push all localStorage projects to Supabase.
 * Runs once per user, flagged with a localStorage key.
 */
export async function migrateLocalProjectsToSupabase(userEmail: string): Promise<void> {
  const flag = `${userEmail}:db_projects_migrated_v1`;
  if (localStorage.getItem(flag)) return;

  const projects = lsLoadProjects();
  if (projects.length === 0) {
    localStorage.setItem(flag, 'done');
    return;
  }

  await Promise.all(projects.map(p => syncProjectToSupabase(p)));
  localStorage.setItem(flag, 'done');
}
