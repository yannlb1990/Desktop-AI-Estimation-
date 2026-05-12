import { useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { Measurement } from '@/lib/takeoff/types';
import { computeGroupSummaries, formatGroupTotal } from '@/lib/takeoff/groups';

interface GroupLegendProps {
  measurements: Measurement[];
}

export const GroupLegend = ({ measurements }: GroupLegendProps) => {
  const [collapsed, setCollapsed] = useState(false);

  if (measurements.length === 0) return null;
  const groups = computeGroupSummaries(measurements);
  if (groups.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <button
        className="flex items-center justify-between w-full px-3 py-2 text-left"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Groups ({groups.length})
          </span>
        </div>
        {collapsed
          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-1.5">
          {groups.map((g) => (
            <div key={g.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: g.color }}
                />
                <span className="font-medium truncate">{g.name}</span>
                <span className="text-muted-foreground shrink-0">×{g.count}</span>
              </div>
              <span className="font-mono font-semibold ml-2 shrink-0">
                {formatGroupTotal(g.total, g.unit)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
