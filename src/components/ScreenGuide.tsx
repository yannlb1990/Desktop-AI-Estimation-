import { useState } from 'react';
import { getUserStorageKey } from '@/lib/localAuth';
import { syncUserPreferencesToSupabase } from '@/lib/db/userPreferences';

const KEY = () => getUserStorageKey('guides_dismissed');
const readDismissed = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(KEY()) || '{}'); } catch { return {}; } };

/**
 * A short "how this works" at the top of a screen: one line and three steps. "Got it"
 * folds it to a small link that brings it back. Remembered per user, on every device.
 */
export function ScreenGuide({ id, title, intro, steps }: { id: string; title: string; intro: string; steps: string[] }) {
  const [hidden, setHidden] = useState(() => !!readDismissed()[id]);
  const set = (v: boolean) => {
    const next = { ...readDismissed(), [id]: v };
    try { localStorage.setItem(KEY(), JSON.stringify(next)); } catch { /* this session only */ }
    syncUserPreferencesToSupabase({ guides_dismissed: next });
    setHidden(v);
  };
  if (hidden) {
    return (
      <div className="flex justify-end">
        <button type="button" className="text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={() => set(false)}>How this works</button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-muted-foreground">{intro}</p>
          <ol className="mt-2 grid gap-2 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{i + 1}</span>
                <span className="text-foreground/90">{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <button type="button" className="shrink-0 rounded-md border border-border px-3 py-1 text-xs hover:bg-muted" onClick={() => set(true)}>Got it</button>
      </div>
    </div>
  );
}
