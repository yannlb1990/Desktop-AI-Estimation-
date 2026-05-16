import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Columns, DoorOpen, AppWindow } from 'lucide-react';

interface AddToEstimateDialogProps {
  open: boolean;
  measurementLabel: string;
  onPick: (mode: 'wall' | 'door' | 'window') => void;
  onSkip: () => void;
}

const TYPES = [
  { id: 'wall' as const, label: 'Wall', icon: Columns, color: 'bg-amber-500' },
  { id: 'door' as const, label: 'Door', icon: DoorOpen, color: 'bg-violet-500' },
  { id: 'window' as const, label: 'Window', icon: AppWindow, color: 'bg-cyan-500' },
];

export const AddToEstimateDialog: React.FC<AddToEstimateDialogProps> = ({
  open,
  measurementLabel,
  onPick,
  onSkip,
}) => (
  <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onSkip(); }}>
    <DialogContent className="sm:max-w-sm z-[10002]">
      <DialogHeader>
        <DialogTitle>Add to estimate?</DialogTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Measurement saved: <strong>{measurementLabel}</strong>
        </p>
      </DialogHeader>

      <div className="space-y-2 py-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
          Select type to generate cost items:
        </p>
        {TYPES.map(({ id, label, icon: Icon, color }) => (
          <Button
            key={id}
            variant="outline"
            className="w-full justify-start gap-3 h-11"
            onClick={() => onPick(id)}
          >
            <span className={`h-3 w-3 rounded-full shrink-0 ${color}`} />
            <Icon className="h-4 w-4" />
            <span className="font-medium">{label}</span>
          </Button>
        ))}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onSkip} className="w-full">
          No thanks — just save the measurement
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
