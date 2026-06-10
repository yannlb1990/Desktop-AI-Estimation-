import { useState, useEffect, useCallback, useRef } from "react";
import {
  addDays,
  format,
  differenceInDays,
  parseISO,
  startOfWeek,
  eachWeekOfInterval,
  isToday,
  isBefore,
  isAfter,
} from "date-fns";
import { toast } from "sonner";
import { getUserStorageKey } from "@/lib/localAuth";
import { loadScheduleMerged, lsSaveSchedule, syncScheduleToSupabase } from "@/lib/db/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Printer,
  GripVertical,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleTask {
  id: string;
  name: string;
  trade: string;
  color: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  progress: number;
  notes: string;
}

interface GanttScheduleProps {
  projectId: string;
}

// ─── Trade sequence ───────────────────────────────────────────────────────────

const TRADE_SEQUENCE = [
  { keywords: ["site", "earthwork", "excavat", "demolit"], name: "Site Works", duration: 5, color: "#8B6914" },
  { keywords: ["footing", "slab", "concret", "found"], name: "Footings & Slab", duration: 7, color: "#6B7280" },
  { keywords: ["frame", "framing", "timber", "structural steel"], name: "Frame", duration: 10, color: "#92400E" },
  { keywords: ["roof"], name: "Roofing", duration: 5, color: "#1D4ED8" },
  { keywords: ["external", "clad", "window", "glazing", "brick", "masonry"], name: "External Envelope", duration: 7, color: "#B45309" },
  { keywords: ["plumb", "hydraul", "drain"], name: "Plumbing Rough-In", duration: 3, color: "#0369A1" },
  { keywords: ["electr", "power", "light"], name: "Electrical Rough-In", duration: 3, color: "#CA8A04" },
  { keywords: ["insulat"], name: "Insulation", duration: 2, color: "#15803D" },
  { keywords: ["plasterboard", "drywall", "gyprock", "lining"], name: "Plasterboard", duration: 5, color: "#9D174D" },
  { keywords: ["joinery", "cabinet", "kitchen", "vanity", "wardrobe"], name: "Joinery", duration: 5, color: "#7C3AED" },
  { keywords: ["tile", "tiling"], name: "Tiling", duration: 4, color: "#475569" },
  { keywords: ["paint"], name: "Painting", duration: 5, color: "#BE185D" },
  { keywords: ["floor"], name: "Flooring", duration: 3, color: "#B45309" },
  { keywords: ["landscape", "paving", "fence", "external work"], name: "Landscaping", duration: 5, color: "#166534" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const aud = (v: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);

function generateFromEstimate(estimateItems: any[]): ScheduleTask[] {
  const today = new Date();
  let cursor = today;
  const tasks: ScheduleTask[] = [];

  TRADE_SEQUENCE.forEach((tradeEntry) => {
    // Check if any estimate item matches any keyword for this trade
    const hasItems = estimateItems.some((item) => {
      const haystack = (
        (item.trade || "") +
        " " +
        (item.category || "") +
        " " +
        (item.scope_of_work || "")
      ).toLowerCase();
      return tradeEntry.keywords.some((kw) => haystack.includes(kw));
    });

    const startDate = format(cursor, "yyyy-MM-dd");
    const endDate = format(addDays(cursor, tradeEntry.duration - 1), "yyyy-MM-dd");

    tasks.push({
      id: crypto.randomUUID(),
      name: tradeEntry.name,
      trade: tradeEntry.name,
      color: tradeEntry.color,
      startDate,
      endDate,
      durationDays: tradeEntry.duration,
      progress: 0,
      notes: hasItems ? "" : "No estimate items matched – adjust dates as needed",
    });

    cursor = addDays(cursor, tradeEntry.duration);
  });

  return tasks;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GanttSchedule({ projectId }: GanttScheduleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ScheduleTask | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load from DB (merged with localStorage), fall back to generating from estimate
  useEffect(() => {
    loadScheduleMerged(projectId).then((saved) => {
      if (saved && saved.length > 0) {
        setTasks(saved);
        setLoaded(true);
        return;
      }
      const projectsRaw = localStorage.getItem(getUserStorageKey("local_projects"));
      const projects: any[] = projectsRaw ? JSON.parse(projectsRaw) : [];
      const project = projects.find((p: any) => p.id === projectId);
      const estimateItems: any[] = project?.estimate_items || [];
      const generated = generateFromEstimate(estimateItems);
      setTasks(generated);
      lsSaveSchedule(projectId, generated);
      syncScheduleToSupabase(projectId, generated);
      setLoaded(true);
    });
  }, [projectId]);

  const saveTasks = useCallback(
    (updated: ScheduleTask[]) => {
      setTasks(updated);
      lsSaveSchedule(projectId, updated);
      syncScheduleToSupabase(projectId, updated);
    },
    [projectId]
  );

  // ─── Gantt geometry ──────────────────────────────────────────────────────────

  const today = new Date();

  // Determine total date range (min 16 weeks = 112 days)
  const allDates = tasks.flatMap((t) => [parseISO(t.startDate), parseISO(t.endDate)]);
  const minStart = allDates.length
    ? allDates.reduce((a, b) => (isBefore(a, b) ? a : b))
    : today;
  const maxEnd = allDates.length
    ? allDates.reduce((a, b) => (isAfter(a, b) ? a : b))
    : addDays(today, 112);

  const rangeStart = startOfWeek(minStart, { weekStartsOn: 1 });
  const minEnd = addDays(rangeStart, 112);
  const rangeEnd = isAfter(maxEnd, minEnd) ? addDays(maxEnd, 7) : minEnd;
  const totalDays = differenceInDays(rangeEnd, rangeStart) || 1;

  const weeks = eachWeekOfInterval(
    { start: rangeStart, end: rangeEnd },
    { weekStartsOn: 1 }
  );

  const pct = (date: Date) =>
    Math.max(0, Math.min(100, (differenceInDays(date, rangeStart) / totalDays) * 100));

  const todayPct = pct(today);

  // ─── Task actions ────────────────────────────────────────────────────────────

  const handleBarClick = (task: ScheduleTask) => {
    if (expandedId === task.id) {
      setExpandedId(null);
      setEditDraft(null);
    } else {
      setExpandedId(task.id);
      setEditDraft({ ...task });
    }
  };

  const handleSave = () => {
    if (!editDraft) return;

    const start = parseISO(editDraft.startDate);
    const end = parseISO(editDraft.endDate);
    if (isAfter(start, end)) {
      toast.error("Start date must be before end date");
      return;
    }

    const duration = differenceInDays(end, start) + 1;
    const updated = tasks.map((t) =>
      t.id === editDraft.id ? { ...editDraft, durationDays: duration } : t
    );
    saveTasks(updated);
    setExpandedId(null);
    setEditDraft(null);
    toast.success("Task updated");
  };

  const handleDelete = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    saveTasks(updated);
    setExpandedId(null);
    setEditDraft(null);
    toast.success("Task removed");
  };

  const handleAddTask = () => {
    const last = tasks[tasks.length - 1];
    const startDate = last
      ? format(addDays(parseISO(last.endDate), 1), "yyyy-MM-dd")
      : format(today, "yyyy-MM-dd");
    const endDate = format(addDays(parseISO(startDate), 4), "yyyy-MM-dd");

    const newTask: ScheduleTask = {
      id: crypto.randomUUID(),
      name: "New Task",
      trade: "",
      color: "#64748B",
      startDate,
      endDate,
      durationDays: 5,
      progress: 0,
      notes: "",
    };

    const updated = [...tasks, newTask];
    saveTasks(updated);
    setExpandedId(newTask.id);
    setEditDraft({ ...newTask });
  };

  const handleReset = () => {
    const projectsRaw = localStorage.getItem(getUserStorageKey("local_projects"));
    const projects: any[] = projectsRaw ? JSON.parse(projectsRaw) : [];
    const project = projects.find((p: any) => p.id === projectId);
    const estimateItems: any[] = project?.estimate_items || [];
    const generated = generateFromEstimate(estimateItems);
    saveTasks(generated);
    setExpandedId(null);
    setEditDraft(null);
    toast.success("Schedule reset from estimate");
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400">
        Loading schedule…
      </div>
    );
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .gantt-no-print { display: none !important; }
          .gantt-edit-panel { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gantt-no-print">
          <h2 className="text-lg font-semibold text-white">Project Schedule</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleReset} className="gap-1 text-slate-300 border-slate-600 hover:bg-slate-700">
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1 text-slate-300 border-slate-600 hover:bg-slate-700">
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
            <Button size="sm" onClick={handleAddTask} className="gap-1 bg-cyan-600 hover:bg-cyan-700">
              <Plus className="w-3.5 h-3.5" />
              Add Task
            </Button>
          </div>
        </div>

        {/* Gantt container */}
        <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-900">
          <div className="flex">
            {/* Left fixed column */}
            <div className="flex-shrink-0 w-52 border-r border-slate-700 bg-slate-800">
              {/* Header spacer */}
              <div className="h-10 border-b border-slate-700 flex items-center px-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Task</span>
              </div>
              {tasks.map((task) => (
                <div key={task.id}>
                  <div className="h-12 border-b border-slate-700 px-3 flex flex-col justify-center">
                    <span className="text-sm font-semibold text-white truncate leading-tight">{task.name}</span>
                    {task.trade && task.trade !== task.name && (
                      <span className="text-xs text-slate-400 truncate leading-tight">{task.trade}</span>
                    )}
                    <span className="text-[10px] text-slate-500 leading-tight">
                      {format(parseISO(task.startDate), "dd MMM")} – {format(parseISO(task.endDate), "dd MMM")}
                    </span>
                  </div>
                  {expandedId === task.id && (
                    <div className="gantt-edit-panel border-b border-slate-700 bg-slate-850 px-3 py-2" />
                  )}
                </div>
              ))}
            </div>

            {/* Right scrollable area */}
            <div className="flex-1 overflow-x-auto" ref={scrollRef}>
              <div style={{ minWidth: `${weeks.length * 80}px` }} className="relative">
                {/* Week headers */}
                <div className="flex h-10 border-b border-slate-700 bg-slate-800">
                  {weeks.map((weekStart, i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 border-r border-slate-700/50 flex items-center justify-center"
                      style={{ width: 80 }}
                    >
                      <span className="text-[10px] text-slate-400 font-medium">
                        {format(weekStart, "dd MMM")}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Task rows */}
                {tasks.map((task) => {
                  const barLeft = pct(parseISO(task.startDate));
                  const barRight = pct(addDays(parseISO(task.endDate), 1));
                  const barWidth = Math.max(0.5, barRight - barLeft);

                  return (
                    <div key={task.id}>
                      {/* Bar row */}
                      <div
                        className="h-12 border-b border-slate-700 relative flex items-center"
                        style={{ minWidth: `${weeks.length * 80}px` }}
                      >
                        {/* Week grid lines */}
                        {weeks.map((_, i) => (
                          <div
                            key={i}
                            className="absolute top-0 bottom-0 border-r border-slate-700/20"
                            style={{ left: `${(i / weeks.length) * 100}%` }}
                          />
                        ))}

                        {/* Today line */}
                        {todayPct >= 0 && todayPct <= 100 && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
                            style={{ left: `${todayPct}%` }}
                          />
                        )}

                        {/* Task bar */}
                        <div
                          className="absolute h-7 rounded cursor-pointer select-none transition-opacity hover:opacity-90 flex items-center overflow-hidden"
                          style={{
                            left: `${barLeft}%`,
                            width: `${barWidth}%`,
                            backgroundColor: task.color,
                          }}
                          onClick={() => handleBarClick(task)}
                          title={`${task.name} — click to edit`}
                        >
                          {/* Progress overlay */}
                          {task.progress > 0 && (
                            <div
                              className="absolute left-0 top-0 bottom-0 opacity-40 rounded-l"
                              style={{
                                width: `${task.progress}%`,
                                backgroundColor: "#000",
                              }}
                            />
                          )}
                          <span className="relative z-10 text-[10px] text-white font-medium px-2 truncate">
                            {task.name}
                          </span>
                          {task.progress > 0 && (
                            <span className="relative z-10 text-[10px] text-white/80 ml-auto pr-1 flex-shrink-0">
                              {task.progress}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Inline edit panel */}
                      {expandedId === task.id && editDraft && editDraft.id === task.id && (
                        <div
                          className="gantt-edit-panel border-b border-slate-600 bg-slate-800 px-4 py-3"
                          style={{ minWidth: `${weeks.length * 80}px` }}
                        >
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <div>
                              <Label className="text-xs text-slate-400 mb-1 block">Task Name</Label>
                              <Input
                                value={editDraft.name}
                                onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                                className="h-7 text-sm bg-slate-700 border-slate-600 text-white"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-slate-400 mb-1 block">Start Date</Label>
                              <Input
                                type="date"
                                value={editDraft.startDate}
                                onChange={(e) => setEditDraft({ ...editDraft, startDate: e.target.value })}
                                className="h-7 text-sm bg-slate-700 border-slate-600 text-white"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-slate-400 mb-1 block">End Date</Label>
                              <Input
                                type="date"
                                value={editDraft.endDate}
                                onChange={(e) => setEditDraft({ ...editDraft, endDate: e.target.value })}
                                className="h-7 text-sm bg-slate-700 border-slate-600 text-white"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-slate-400 mb-1 block">Progress (%)</Label>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={editDraft.progress}
                                onChange={(e) =>
                                  setEditDraft({
                                    ...editDraft,
                                    progress: Math.min(100, Math.max(0, Number(e.target.value))),
                                  })
                                }
                                className="h-7 text-sm bg-slate-700 border-slate-600 text-white"
                              />
                            </div>
                          </div>
                          <div className="mb-3">
                            <Label className="text-xs text-slate-400 mb-1 block">Notes</Label>
                            <Input
                              value={editDraft.notes}
                              onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                              placeholder="Optional notes…"
                              className="h-7 text-sm bg-slate-700 border-slate-600 text-white"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSave} className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700">
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setExpandedId(null);
                                setEditDraft(null);
                              }}
                              className="h-7 text-xs text-slate-400 hover:text-white"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(task.id)}
                              className="h-7 text-xs text-red-400 hover:text-red-300 ml-auto"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 gantt-no-print">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span className="text-xs text-slate-400">Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-3 rounded-sm bg-cyan-600 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-black/40" />
            </div>
            <span className="text-xs text-slate-400">Progress overlay</span>
          </div>
          <span className="text-xs text-slate-500 ml-auto">Click any bar to edit</span>
        </div>
      </div>
    </>
  );
}
