import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AppProfile, ProjectType, PROJECT_TYPE_LABELS, PROJECT_TYPE_PRESETS, TRADE_GROUPS, saveProfile,
} from '@/lib/takeoff/profile';
import { Home, Building2, Factory, Check } from 'lucide-react';

const TYPE_ICONS: Record<ProjectType, React.ReactNode> = {
  residential: <Home className="h-5 w-5" />,
  commercial: <Building2 className="h-5 w-5" />,
  industrial: <Factory className="h-5 w-5" />,
};

const TYPE_DESCRIPTIONS: Record<ProjectType, string> = {
  residential: 'Houses, units, renovations — carpentry, tiling, plumbing, electrical',
  commercial: 'Offices, retail, fitouts — full trade set including steel, HVAC, fire',
  industrial: 'Warehouses, factories — structural steel, epoxy, crane, certifications',
};

interface ProfileConfigDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: AppProfile;
  onSave: (profile: AppProfile) => void;
}

export const ProfileConfigDialog = ({ open, onOpenChange, profile, onSave }: ProfileConfigDialogProps) => {
  const [draft, setDraft] = useState<AppProfile>(() => ({
    projectType: profile.projectType,
    enabledTrades: [...profile.enabledTrades],
  }));

  // Sync draft when dialog opens
  React.useEffect(() => {
    if (open) {
      setDraft({ projectType: profile.projectType, enabledTrades: [...profile.enabledTrades] });
    }
  }, [open, profile]);

  function selectType(type: ProjectType) {
    setDraft({ projectType: type, enabledTrades: [...PROJECT_TYPE_PRESETS[type]] });
  }

  function toggleTrade(trade: string) {
    setDraft(prev => {
      const has = prev.enabledTrades.includes(trade);
      return {
        ...prev,
        enabledTrades: has
          ? prev.enabledTrades.filter(t => t !== trade)
          : [...prev.enabledTrades, trade],
      };
    });
  }

  function toggleGroup(trades: string[]) {
    const allOn = trades.every(t => draft.enabledTrades.includes(t));
    setDraft(prev => ({
      ...prev,
      enabledTrades: allOn
        ? prev.enabledTrades.filter(t => !trades.includes(t))
        : [...new Set([...prev.enabledTrades, ...trades])],
    }));
  }

  function handleSave() {
    saveProfile(draft);
    onSave(draft);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Project Profile</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Set your default project type and which trades you work with. This filters your trade dropdowns and SOW sections.
          </p>
        </DialogHeader>

        {/* Project Type Selector */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Type</p>
          <div className="grid grid-cols-3 gap-2">
            {(['residential', 'commercial', 'industrial'] as ProjectType[]).map(type => (
              <button
                key={type}
                onClick={() => selectType(type)}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-left transition-colors ${
                  draft.projectType === type
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-muted-foreground/40'
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  {TYPE_ICONS[type]}
                  {PROJECT_TYPE_LABELS[type]}
                </div>
                <p className="text-xs text-muted-foreground text-center leading-tight">
                  {TYPE_DESCRIPTIONS[type]}
                </p>
                {draft.projectType === type && (
                  <Badge variant="default" className="text-xs">Active</Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Trade checkboxes */}
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Enabled Trades</p>
            <span className="text-xs text-muted-foreground">{draft.enabledTrades.length} selected</span>
          </div>

          {TRADE_GROUPS.map(group => {
            const allOn = group.trades.every(t => draft.enabledTrades.includes(t));
            const someOn = group.trades.some(t => draft.enabledTrades.includes(t));
            return (
              <div key={group.label} className="space-y-1">
                <button
                  className="flex items-center gap-2 text-xs font-medium text-foreground/70 hover:text-foreground"
                  onClick={() => toggleGroup(group.trades)}
                >
                  <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${allOn ? 'bg-primary border-primary' : someOn ? 'bg-primary/30 border-primary/50' : 'border-border'}`}>
                    {allOn && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </div>
                  {group.label}
                </button>
                <div className="flex flex-wrap gap-1.5 pl-5">
                  {group.trades.map(trade => {
                    const on = draft.enabledTrades.includes(trade);
                    return (
                      <button
                        key={trade}
                        onClick={() => toggleTrade(trade)}
                        className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                          on
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border text-muted-foreground hover:border-muted-foreground/60'
                        }`}
                      >
                        {trade}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={draft.enabledTrades.length === 0}>
            Save Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
