import { callEdge } from './client';

// ── team-invite ────────────���─────────────────────────────���────────────────────

interface TeamInviteReq {
  email: string;
}

interface TeamInviteRes {
  success: true;
  seats_used: number;
  seats_total: number;
}

/** Sends a team invitation email. Throws EdgeFunctionError on seat limit or invalid email. */
export async function inviteTeamMember(email: string): Promise<TeamInviteRes> {
  return callEdge<TeamInviteReq, TeamInviteRes>('team-invite', { email });
}

// ── team-accept-invite ���───────────────────────────────────────────────────────

interface TeamAcceptRes {
  success: true;
  team_id: string;
}

/** Accepts the pending team invitation for the currently authenticated user. */
export async function acceptTeamInvite(): Promise<TeamAcceptRes> {
  return callEdge<Record<string, never>, TeamAcceptRes>('team-accept-invite', {});
}
