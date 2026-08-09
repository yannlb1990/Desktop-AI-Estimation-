/**
 * Team data access layer — wraps Supabase calls for teams, members, and shared projects.
 * Schema source: supabase/migrations/20260517000001_create_teams.sql (teams/team_members)
 *                supabase/migrations/20260809000002_teams.sql (shared_projects)
 */
import { supabase } from '@/integrations/supabase/client';

export interface Team {
  id: string;
  name: string | null;
  owner_user_id: string;
  max_seats: number;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string | null;
  email: string;
  role: 'owner' | 'member';
  status: 'pending' | 'active' | 'removed';
  invited_at: string;
  joined_at: string | null;
}

export interface SharedProject {
  id: string;
  team_id: string;
  project_name: string;
  project_data: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

async function getAuthUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** Returns the first team the current user owns or is an active member of, or null. */
export async function getMyTeam(): Promise<Team | null> {
  const userId = await getAuthUserId();
  if (!userId) return null;

  // Check if owner first
  const { data: ownedTeam } = await (supabase as any)
    .from('teams')
    .select('*')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (ownedTeam) return ownedTeam as Team;

  // Check if active member
  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) return null;

  const { data: memberTeam } = await (supabase as any)
    .from('teams')
    .select('*')
    .eq('id', membership.team_id)
    .maybeSingle();

  return memberTeam as Team | null;
}

/** Creates a new team and adds the creator as owner member. Returns the new team. */
export async function createTeam(name: string): Promise<Team> {
  const userId = await getAuthUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data: team, error: teamError } = await (supabase as any)
    .from('teams')
    .insert({ name, owner_user_id: userId })
    .select()
    .single();

  if (teamError) throw new Error(teamError.message);

  // Add owner as a member row so member policies also apply
  const { data: { session } } = await supabase.auth.getSession();
  const ownerEmail = session?.user?.email ?? '';

  await (supabase as any)
    .from('team_members')
    .insert({
      team_id: team.id,
      user_id: userId,
      email: ownerEmail,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    });

  return team as Team;
}

/** Returns all members for a given team. */
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await (supabase as any)
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('invited_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMember[];
}

/** Invites a member by email — creates a pending row (user_id null until they log in). */
export async function inviteMember(teamId: string, email: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('team_members')
    .insert({
      team_id: teamId,
      email,
      user_id: null,
      role: 'member',
      status: 'pending',
    });

  if (error) throw new Error(error.message);
}

/** Returns shared projects for a team, newest first. */
export async function getSharedProjects(teamId: string): Promise<SharedProject[]> {
  const { data, error } = await (supabase as any)
    .from('shared_projects')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SharedProject[];
}

/** Shares a project copy to the team's shared_projects table. */
export async function shareProject(
  teamId: string,
  projectName: string,
  projectData: Record<string, unknown>
): Promise<SharedProject> {
  const userId = await getAuthUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await (supabase as any)
    .from('shared_projects')
    .insert({
      team_id: teamId,
      project_name: projectName,
      project_data: projectData,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as SharedProject;
}
