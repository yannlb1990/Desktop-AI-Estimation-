import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Check, Loader2 } from 'lucide-react';
import { getMyTeam, getSharedProjects, shareProject } from '@/lib/db/teams';
import type { Team } from '@/lib/db/teams';
import { getSubscriptionStatus } from '@/lib/subscription';
import { useToast } from '@/hooks/use-toast';

interface ShareProjectButtonProps {
  projectId: string;
  projectName: string;
  projectData: Record<string, unknown>;
}

const ShareProjectButton = ({ projectId, projectName, projectData }: ShareProjectButtonProps) => {
  const { toast } = useToast();
  const [team, setTeam] = useState<Team | null>(null);
  const [isShared, setIsShared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  // Only show for Business plan
  const { effectivePlan } = getSubscriptionStatus();
  const isBusiness = effectivePlan === 'business';

  useEffect(() => {
    if (!isBusiness) {
      setLoading(false);
      return;
    }

    getMyTeam()
      .then(async (t) => {
        setTeam(t);
        if (t) {
          const shared = await getSharedProjects(t.id);
          const alreadyShared = shared.some((sp) => sp.project_name === projectName);
          setIsShared(alreadyShared);
        }
      })
      .catch(() => {
        // Silently fail — button just won't appear
      })
      .finally(() => setLoading(false));
  }, [projectId, projectName, isBusiness]);

  // Not on Business plan or no team
  if (!isBusiness || loading || !team) return null;

  const handleShare = async () => {
    if (isShared || sharing) return;
    setSharing(true);
    try {
      await shareProject(team.id, projectName, projectData);
      setIsShared(true);
      toast({ title: `"${projectName}" shared with team` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not share project';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setSharing(false);
    }
  };

  if (isShared) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
        <Check className="h-3.5 w-3.5" />
        Shared with team
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleShare}
      disabled={sharing}
      className="border-[#412D15] text-[#E1DCC9] hover:bg-[#1A110A] hover:border-amber-500/40 text-xs gap-1.5"
    >
      {sharing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Share2 className="h-3.5 w-3.5" />
      )}
      Share with team
    </Button>
  );
};

export default ShareProjectButton;
