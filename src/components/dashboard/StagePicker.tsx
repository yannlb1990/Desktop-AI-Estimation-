import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { STAGES, STAGE_LABEL, type ProjectStage } from '@/lib/projectStage';

/** Stage colours from the theme, so they read in light and dark mode */
export const STAGE_STYLE: Record<ProjectStage, string> = {
  lead: 'border-border bg-muted text-muted-foreground',
  measuring: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  estimating: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  quote_sent: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  won: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  in_progress: 'border-primary/40 bg-primary/10 text-primary',
  completed: 'border-border bg-muted text-foreground/70',
  lost: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400',
};

/** The job's stage as a pill; click it to move the job. */
export function StagePicker({ stage, onChange, className }: { stage: ProjectStage; onChange: (s: ProjectStage) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" onClick={e => e.stopPropagation()} title="Change the stage"
          className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium hover:opacity-80', STAGE_STYLE[stage], className)}>
          {STAGE_LABEL[stage]}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1" align="start" onClick={e => e.stopPropagation()}>
        {STAGES.map(s => (
          <button key={s.key} type="button"
            className={cn('flex w-full flex-col rounded px-2.5 py-1.5 text-left hover:bg-accent', s.key === stage && 'bg-accent')}
            onClick={() => { setOpen(false); if (s.key !== stage) onChange(s.key); }}>
            <span className="text-sm font-medium">{s.label}</span>
            <span className="text-[11px] text-muted-foreground">{s.hint}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
