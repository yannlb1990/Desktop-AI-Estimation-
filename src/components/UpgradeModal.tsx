import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Zap, ArrowRight } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature: string;        // e.g. "BOQ Export"
  requiredPlan?: string;  // e.g. "Professional"
}

export const UpgradeModal = ({ open, onClose, feature, requiredPlan = 'Professional' }: UpgradeModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <div className="flex items-center justify-center mb-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center">Upgrade to unlock {feature}</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong>{feature}</strong> is available on the{' '}
            <Badge variant="secondary" className="text-xs">{requiredPlan}</Badge>{' '}
            plan and above.
          </p>
          <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-primary" />
            <span>14-day free trial included — no credit card required</span>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full bg-primary text-primary-foreground"
            onClick={() => { navigate('/pricing'); onClose(); }}
          >
            View Plans
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
