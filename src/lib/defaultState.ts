import { getUserStorageKey, getLocalUser } from '@/lib/localAuth';

export const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] as const;
export type AuState = typeof AU_STATES[number];

/** "1 Test St, Burleigh Heads QLD 4220" -> "QLD" */
export function stateFromAddress(address?: string | null): AuState | null {
  if (!address) return null;
  const match = address.toUpperCase().match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/);
  return (match?.[1] as AuState) ?? null;
}

/** The estimator's own state from Settings (Profile / Regional), else their sign-up state. */
export function profileState(): AuState | null {
  try {
    const profile = JSON.parse(localStorage.getItem(getUserStorageKey('estimate_profile')) || '{}');
    const fromProfile = String(profile.state || '').toUpperCase();
    if ((AU_STATES as readonly string[]).includes(fromProfile)) return fromProfile as AuState;
  } catch { /* fall through */ }
  const fromUser = String(getLocalUser()?.state || '').toUpperCase();
  return (AU_STATES as readonly string[]).includes(fromUser) ? (fromUser as AuState) : null;
}

/** Default pricing state for a project: its site address, then the profile, then NSW. */
export function defaultStateForProject(projectId?: string): AuState {
  if (projectId) {
    try {
      const projects: any[] = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
      const project = projects.find(p => p.id === projectId);
      const fromSite = stateFromAddress(project?.site_address || project?.address) ?? (project?.state ? stateFromAddress(project.state) : null);
      if (fromSite) return fromSite;
    } catch { /* fall through */ }
  }
  return profileState() ?? 'NSW';
}
