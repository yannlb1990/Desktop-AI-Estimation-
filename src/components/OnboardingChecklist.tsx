import { useState, useEffect, useCallback } from 'react';
import { Check } from 'lucide-react';

const STEPS = [
  { key: 'uploaded',   label: 'Upload a PDF plan' },
  { key: 'calibrated', label: 'Set the scale' },
  { key: 'measured',   label: 'Measure an area' },
  { key: 'ai',         label: 'Run the AI analyser' },
  { key: 'exported',   label: 'Export your BOQ' },
] as const;

export type OnboardingStepKey = typeof STEPS[number]['key'];

export function markOnboardingStep(step: OnboardingStepKey) {
  try {
    localStorage.setItem('onboarding_' + step, 'true');
    window.dispatchEvent(new Event('onboarding-update'));
  } catch {
    // localStorage unavailable, no-op
  }
}

function readStepState(): Record<string, boolean> {
  try {
    return Object.fromEntries(
      STEPS.map(s => [s.key, localStorage.getItem('onboarding_' + s.key) === 'true'])
    );
  } catch {
    return Object.fromEntries(STEPS.map(s => [s.key, false]));
  }
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem('onboarding_dismissed') === 'true';
  } catch {
    return false;
  }
}

/** Steps the builder has clearly done already, read from their jobs */
function doneFromProjects(projects: any[]): Record<string, boolean> {
  const has = (key: (id: string) => string, test: (v: any) => boolean) => projects.some(p => {
    try { const raw = localStorage.getItem(key(p.id)); return !!raw && test(JSON.parse(raw)); } catch { return false; }
  });
  return {
    uploaded: projects.some(p => p.plan_file_name || p.plan_file_url),
    calibrated: has(id => `takeoff_${id}`, t => !!(t?.scale || t?.pageScales && Object.keys(t.pageScales).length)),
    measured: has(id => `takeoff_${id}`, t => (t?.measurements ?? []).length > 0),
    ai: projects.some(p => { try { return !!localStorage.getItem(`planAnalysis_${p.id}`); } catch { return false; } }),
    exported: false,
  };
}

export default function OnboardingChecklist({ projects = [] }: { projects?: any[] }) {
  const [flags, setStepsDone] = useState<Record<string, boolean>>(readStepState);
  const fromJobs = doneFromProjects(projects);
  const stepsDone = Object.fromEntries(STEPS.map(s => [s.key, flags[s.key] || fromJobs[s.key]]));
  const [dismissed, setDismissed] = useState<boolean>(isDismissed);

  const refresh = useCallback(() => {
    setStepsDone(readStepState());
    setDismissed(isDismissed());
  }, []);

  useEffect(() => {
    window.addEventListener('onboarding-update', refresh);
    return () => window.removeEventListener('onboarding-update', refresh);
  }, [refresh]);

  const doneCount = STEPS.filter(s => stepsDone[s.key]).length;
  const allDone = doneCount === STEPS.length;

  // someone already running jobs through Metricore doesn't need a getting started list
  const established = projects.filter(p => (p.estimate_items ?? []).length > 0).length >= 3;
  if (dismissed || allDone || established) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem('onboarding_dismissed', 'true');
    } catch {
      // localStorage unavailable, no-op
    }
    setDismissed(true);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Title row */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm text-[#E1DCC9]">Getting started</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/25">
          {doneCount} of {STEPS.length} done
        </span>
      </div>

      {/* Steps */}
      <ul className="space-y-2">
        {STEPS.map(step => {
          const done = stepsDone[step.key];
          return (
            <li key={step.key} className="flex items-center gap-2.5">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  done
                    ? 'border-amber-400 bg-amber-400/15'
                    : 'border-border bg-transparent'
                }`}
              >
                {done && <Check className="h-3 w-3 text-amber-400" strokeWidth={2.5} />}
              </span>
              <span
                className={`text-sm transition-colors ${
                  done
                    ? 'line-through text-muted-foreground'
                    : 'text-[#E1DCC9]'
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Dismiss */}
      <div className="flex justify-end mt-3">
        <button
          onClick={handleDismiss}
          className="text-xs text-muted-foreground hover:text-[#E1DCC9] transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
