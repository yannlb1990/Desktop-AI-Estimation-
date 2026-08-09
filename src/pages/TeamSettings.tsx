import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, UserPlus, Loader2 } from 'lucide-react';
import { getMyTeam, createTeam, getTeamMembers, inviteMember } from '@/lib/db/teams';
import type { Team, TeamMember } from '@/lib/db/teams';
import { useToast } from '@/hooks/use-toast';

const TeamSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  const [newTeamName, setNewTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    getMyTeam()
      .then(async (t) => {
        setTeam(t);
        if (t) {
          const m = await getTeamMembers(t.id);
          setMembers(m);
        }
      })
      .catch(() => {
        toast({ title: 'Could not load team data', variant: 'destructive' });
      })
      .finally(() => setLoadingTeam(false));
  }, []);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    try {
      const created = await createTeam(newTeamName.trim());
      setTeam(created);
      setMembers(await getTeamMembers(created.id));
      toast({ title: 'Team created' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create team';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !team) return;
    setInviting(true);
    try {
      await inviteMember(team.id, inviteEmail.trim().toLowerCase());
      const updated = await getTeamMembers(team.id);
      setMembers(updated);
      setInviteEmail('');
      toast({ title: `Invite sent to ${inviteEmail.trim()}` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not send invite';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-[#E1DCC9]">
      <div className="container mx-auto px-4 md:px-6 py-8 max-w-2xl">

        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 text-sm text-[#8a7060] hover:text-[#E1DCC9] mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Users className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Team</h1>
            <p className="text-sm text-[#8a7060]">Collaborate with your team on shared estimates</p>
          </div>
        </div>

        {loadingTeam ? (
          <div className="flex items-center gap-3 text-[#8a7060] py-12 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading team...</span>
          </div>
        ) : !team ? (
          /* No team yet */
          <Card className="p-6 bg-card border border-[#412D15]">
            <h2 className="font-semibold text-lg mb-2">Create your team</h2>
            <p className="text-sm text-[#8a7060] mb-6">
              Give your team a name to get started. You can invite members after creating it.
            </p>
            <div className="flex gap-3">
              <Input
                placeholder="e.g. Watermark Constructions"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
                className="bg-background border-[#412D15] text-[#E1DCC9] placeholder:text-[#8a7060] focus:border-amber-500/60"
              />
              <Button
                onClick={handleCreateTeam}
                disabled={creatingTeam || !newTeamName.trim()}
                className="bg-amber-500 hover:bg-amber-400 text-background font-semibold shrink-0"
              >
                {creatingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create team'}
              </Button>
            </div>
          </Card>
        ) : (
          /* Has a team */
          <div className="space-y-6">

            <Card className="p-6 bg-card border border-[#412D15]">
              <h2 className="font-display text-xl font-bold text-[#D4A045] mb-1">{team.name ?? 'My Team'}</h2>
              <p className="text-xs text-[#8a7060]">Up to {team.max_seats} seats</p>
            </Card>

            {/* Member list */}
            <Card className="bg-card border border-[#412D15]">
              <div className="px-5 py-4 border-b border-[#412D15]">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-[#8a7060]">Members</h3>
              </div>
              {members.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-[#8a7060]">No members yet. Invite someone below.</div>
              ) : (
                <div className="divide-y divide-[#412D15]/60">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="text-sm font-medium">{m.email}</div>
                        <div className="text-xs text-[#8a7060] capitalize">{m.role}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          m.status === 'active'
                            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs'
                            : 'border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs'
                        }
                      >
                        {m.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Invite */}
            <Card className="p-6 bg-card border border-[#412D15]">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="h-4 w-4 text-[#D4A045]" />
                <h3 className="font-semibold">Invite a member</h3>
              </div>
              <div className="flex gap-3">
                <Input
                  type="email"
                  placeholder="colleague@company.com.au"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  className="bg-background border-[#412D15] text-[#E1DCC9] placeholder:text-[#8a7060] focus:border-amber-500/60"
                />
                <Button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-background font-semibold shrink-0"
                >
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Invite'}
                </Button>
              </div>
              <p className="text-xs text-[#8a7060] mt-3">
                They will appear as pending until they log in with this email address.
              </p>
            </Card>

          </div>
        )}
      </div>
    </div>
  );
};

export default TeamSettings;
