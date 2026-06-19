import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { getUserStorageKey } from "@/lib/localAuth";
import { loadJobCostsMerged, lsSaveJobCosts, syncJobCostsToSupabase } from "@/lib/db/jobCosts";
import { syncProjectToSupabase } from "@/lib/db/projects";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Percent, Pencil } from "lucide-react";
import { TRADE_OPTIONS } from "@/lib/takeoff/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type CostType = "invoice" | "labour" | "material" | "subcontract" | "other";

interface CostEntry {
  id: string;
  date: string;
  trade: string;
  supplier: string;
  description: string;
  amount: number;
  type: CostType;
}

interface JobCostTrackerProps {
  projectId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const aud = (v: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);

function computeItemPrice(item: any): number {
  if (item.total_price) return parseFloat(item.total_price) || 0;
  if (item.subtotal) return parseFloat(item.subtotal) || 0;
  const unitPrice = parseFloat(item.unit_price || item.unitCost || 0);
  const qty = parseFloat(item.quantity || 0);
  return unitPrice * qty;
}

const COST_TYPES: CostType[] = ["invoice", "labour", "material", "subcontract", "other"];

const typeColors: Record<CostType, string> = {
  invoice: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  labour: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  material: "bg-green-500/20 text-green-300 border-green-500/30",
  subcontract: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  other: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const BUDGET_LS_KEY = (pid: string) => `job_cost_budgets_${pid}`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function JobCostTracker({ projectId }: JobCostTrackerProps) {
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [estimateItems, setEstimateItems] = useState<any[]>([]);
  const [manualBudgets, setManualBudgets] = useState<Record<string, number>>({});

  // Inline budget editing
  const [editingTrade, setEditingTrade] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  // Monitor trade form
  const [showMonitorForm, setShowMonitorForm] = useState(false);
  const [monitorTrade, setMonitorTrade] = useState("");
  const [monitorBudget, setMonitorBudget] = useState("");

  // Add cost form
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formTrade, setFormTrade] = useState("");
  const [formSupplier, setFormSupplier] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formType, setFormType] = useState<CostType>("invoice");
  const formRef = useRef<HTMLDivElement>(null);

  // ─── Load ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const projectsRaw = localStorage.getItem(getUserStorageKey("local_projects"));
    const projects: any[] = projectsRaw ? JSON.parse(projectsRaw) : [];
    const project = projects.find((p: any) => p.id === projectId);
    const items = project?.estimate_items || [];
    setEstimateItems(items);

    const saved = localStorage.getItem(getUserStorageKey(BUDGET_LS_KEY(projectId)));
    if (saved) {
      setManualBudgets(JSON.parse(saved));
    } else if (project?.trade_budgets && Object.keys(project.trade_budgets).length > 0) {
      // Restored from Supabase — write back to standalone key for future fast reads
      setManualBudgets(project.trade_budgets);
      localStorage.setItem(getUserStorageKey(BUDGET_LS_KEY(projectId)), JSON.stringify(project.trade_budgets));
    } else if (items.length > 0) {
      // Pre-fill from estimate items on first open
      const init: Record<string, number> = {};
      items.forEach((item: any) => {
        if (item.trade) init[item.trade] = (init[item.trade] || 0) + computeItemPrice(item);
      });
      setManualBudgets(init);
    }

    loadJobCostsMerged(projectId).then(setEntries);
  }, [projectId]);

  // ─── Persist ─────────────────────────────────────────────────────────────

  const saveBudgets = useCallback((updated: Record<string, number>) => {
    setManualBudgets(updated);
    localStorage.setItem(getUserStorageKey(BUDGET_LS_KEY(projectId)), JSON.stringify(updated));
    // Embed in project record so Supabase sync picks it up
    try {
      const projects = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]");
      const idx = projects.findIndex((p: any) => p.id === projectId);
      if (idx !== -1) {
        projects[idx].trade_budgets = updated;
        localStorage.setItem(getUserStorageKey("local_projects"), JSON.stringify(projects));
        syncProjectToSupabase(projects[idx]);
      }
    } catch { /* localStorage read error — standalone key still saved */ }
  }, [projectId]);

  const saveEntries = useCallback((updated: CostEntry[]) => {
    setEntries(updated);
    lsSaveJobCosts(projectId, updated);
    syncJobCostsToSupabase(projectId, updated);
  }, [projectId]);

  // ─── Derived values ───────────────────────────────────────────────────────

  // Active trades = those with a manual budget OR with cost entries
  const activeTrades = useMemo(() => {
    const withBudget = new Set(Object.keys(manualBudgets));
    const withSpend = new Set(entries.map(e => e.trade));
    const all = new Set([...withBudget, ...withSpend]);
    return [
      ...TRADE_OPTIONS.filter(t => all.has(t)),
      ...Array.from(all).filter(t => !TRADE_OPTIONS.includes(t as any)).sort(),
    ];
  }, [manualBudgets, entries]);

  const availableTrades = useMemo(
    () => TRADE_OPTIONS.filter(t => !activeTrades.includes(t)),
    [activeTrades]
  );

  const tradeBreakdown = useMemo(() => activeTrades.map(trade => {
    const budget = manualBudgets[trade] ?? 0;
    const spent = entries.filter(e => e.trade === trade).reduce((s, e) => s + e.amount, 0);
    const remaining = budget - spent;
    const pctUsed = budget > 0 ? (spent / budget) * 100 : spent > 0 ? 100 : 0;
    return { trade, budget, spent, remaining, pctUsed };
  }), [activeTrades, manualBudgets, entries]);

  const budgetTotal = useMemo(() => Object.values(manualBudgets).reduce((s, v) => s + v, 0), [manualBudgets]);
  const estimateTotal = useMemo(() => estimateItems.reduce((s, i) => s + computeItemPrice(i), 0), [estimateItems]);
  const effectiveBudgetTotal = budgetTotal > 0 ? budgetTotal : estimateTotal;
  const actualTotal = useMemo(() => entries.reduce((s, e) => s + e.amount, 0), [entries]);
  const variance = effectiveBudgetTotal - actualTotal;
  const pctComplete = effectiveBudgetTotal > 0 ? (actualTotal / effectiveBudgetTotal) * 100 : 0;
  const totalSavings = useMemo(
    () => tradeBreakdown.filter(r => r.budget > 0 && r.remaining > 0).reduce((s, r) => s + r.remaining, 0),
    [tradeBreakdown]
  );

  const allTradesForDropdown = useMemo(() => {
    const extra = new Set<string>();
    entries.forEach(e => { if (e.trade && !TRADE_OPTIONS.includes(e.trade as any)) extra.add(e.trade); });
    return [...TRADE_OPTIONS, ...Array.from(extra).sort()];
  }, [entries]);

  // ─── Inline budget editing ────────────────────────────────────────────────

  const commitBudget = () => {
    if (!editingTrade) return;
    saveBudgets({ ...manualBudgets, [editingTrade]: parseFloat(editingValue) || 0 });
    setEditingTrade(null);
  };

  const commitAndMoveNext = (currentTrade: string) => {
    const val = parseFloat(editingValue) || 0;
    const updated = { ...manualBudgets, [currentTrade]: val };
    saveBudgets(updated);
    const idx = activeTrades.indexOf(currentTrade);
    const next = activeTrades[idx + 1];
    if (next) {
      setEditingTrade(next);
      setEditingValue(String(updated[next] ?? 0));
    } else {
      setEditingTrade(null);
    }
  };

  // ─── Monitor trade ────────────────────────────────────────────────────────

  const handleAddMonitor = () => {
    if (!monitorTrade) { toast.error("Select a trade"); return; }
    saveBudgets({ ...manualBudgets, [monitorTrade]: parseFloat(monitorBudget) || 0 });
    setMonitorTrade("");
    setMonitorBudget("");
    setShowMonitorForm(false);
  };

  // ─── Cost form ────────────────────────────────────────────────────────────

  const openFormForTrade = (trade: string) => {
    setFormTrade(trade);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  };

  const handleAddCost = () => {
    const amount = parseFloat(formAmount);
    if (!formDescription.trim()) { toast.error("Description is required"); return; }
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount greater than 0"); return; }
    if (!formTrade) { toast.error("Select a trade"); return; }

    saveEntries([
      { id: crypto.randomUUID(), date: formDate, trade: formTrade, supplier: formSupplier, description: formDescription, amount, type: formType },
      ...entries,
    ]);
    toast.success("Cost entry added");
    setFormDescription(""); setFormSupplier(""); setFormAmount(""); setFormTrade("");
    setFormType("invoice"); setFormDate(format(new Date(), "yyyy-MM-dd"));
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    saveEntries(entries.filter(e => e.id !== id));
    toast.success("Entry deleted");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Job Cost Tracker</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1 bg-cyan-600 hover:bg-cyan-700">
          <Plus className="w-3.5 h-3.5" /> Add Cost
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Total Budget</p>
                <p className="text-xl font-bold text-white">{aud(effectiveBudgetTotal)}</p>
              </div>
              <DollarSign className="w-5 h-5 text-slate-500 mt-0.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Actual to Date</p>
                <p className="text-xl font-bold text-white">{aud(actualTotal)}</p>
              </div>
              <DollarSign className="w-5 h-5 text-cyan-500 mt-0.5" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${variance >= 0 ? "bg-green-900/20 border-green-700/40" : "bg-red-900/20 border-red-700/40"}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Variance</p>
                <p className={`text-xl font-bold ${variance >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {variance >= 0 ? "+" : ""}{aud(variance)}
                </p>
              </div>
              {variance >= 0
                ? <TrendingDown className="w-5 h-5 text-green-500 mt-0.5" />
                : <TrendingUp className="w-5 h-5 text-red-500 mt-0.5" />}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">% Spent</p>
                <p className="text-xl font-bold text-white">{pctComplete.toFixed(1)}%</p>
              </div>
              <Percent className="w-5 h-5 text-slate-500 mt-0.5" />
            </div>
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pctComplete >= 100 ? "bg-red-500" : pctComplete >= 80 ? "bg-amber-500" : "bg-cyan-500"}`}
                style={{ width: `${Math.min(100, pctComplete)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add cost form */}
      {showForm && (
        <div ref={formRef}>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">New Cost Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <Label className="text-xs text-slate-400 mb-1 block">Date</Label>
                  <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className="h-8 text-sm bg-slate-700 border-slate-600 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1 block">Trade *</Label>
                  <Select value={formTrade} onValueChange={setFormTrade}>
                    <SelectTrigger className="h-8 text-sm bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Select trade…" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {allTradesForDropdown.map(t => (
                        <SelectItem key={t} value={t} className="text-white hover:bg-slate-700">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1 block">Type</Label>
                  <Select value={formType} onValueChange={v => setFormType(v as CostType)}>
                    <SelectTrigger className="h-8 text-sm bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {COST_TYPES.map(t => (
                        <SelectItem key={t} value={t} className="text-white hover:bg-slate-700 capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1 block">Supplier</Label>
                  <Input value={formSupplier} onChange={e => setFormSupplier(e.target.value)}
                    placeholder="Supplier name…" className="h-8 text-sm bg-slate-700 border-slate-600 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1 block">Description *</Label>
                  <Input value={formDescription} onChange={e => setFormDescription(e.target.value)}
                    placeholder="Description…" className="h-8 text-sm bg-slate-700 border-slate-600 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1 block">Amount *</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <Input type="number" min={0} step={0.01} value={formAmount}
                      onChange={e => setFormAmount(e.target.value)} placeholder="0.00"
                      className="h-8 text-sm bg-slate-700 border-slate-600 text-white pl-6" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddCost} className="bg-cyan-600 hover:bg-cyan-700">Add Cost</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trade Budget Control */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-white">Trade Budget Control</CardTitle>
            <p className="text-xs text-slate-500">Click any budget to edit · Tab to move between rows</p>
          </div>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          {activeTrades.length === 0 ? (
            <div className="px-4 py-8">
              {!showMonitorForm ? (
                <div className="text-center">
                  <DollarSign className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm font-medium">No trades monitored yet</p>
                  <p className="text-slate-500 text-xs mt-1 mb-4">Add a trade budget to start tracking costs vs budget</p>
                  <Button size="sm" variant="outline" onClick={() => { setShowMonitorForm(true); setMonitorTrade(availableTrades[0] || ""); }}
                    className="border-slate-600 text-slate-300 hover:text-white">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Monitor first trade
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3 items-end flex-wrap">
                  <div>
                    <Label className="text-xs text-slate-400 mb-1 block">Trade</Label>
                    <Select value={monitorTrade} onValueChange={setMonitorTrade}>
                      <SelectTrigger className="h-8 text-sm bg-slate-700 border-slate-600 text-white w-52">
                        <SelectValue placeholder="Select trade…" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {availableTrades.map(t => (
                          <SelectItem key={t} value={t} className="text-white hover:bg-slate-700">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400 mb-1 block">Budget (optional)</Label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <Input
                        type="number" min={0} value={monitorBudget}
                        onChange={e => setMonitorBudget(e.target.value)}
                        placeholder="0" className="h-8 text-sm bg-slate-700 border-slate-600 text-white pl-6 w-36"
                        onKeyDown={e => e.key === "Enter" && handleAddMonitor()}
                      />
                    </div>
                  </div>
                  <Button size="sm" onClick={handleAddMonitor} className="bg-cyan-600 hover:bg-cyan-700">Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowMonitorForm(false)} className="text-slate-400">Cancel</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Trade</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Budget</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Spent</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Remaining</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide w-36">Progress</th>
                    <th className="px-2 py-2.5 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {tradeBreakdown.map(row => (
                    <tr key={row.trade} className="group border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">

                      {/* Trade name */}
                      <td className="px-4 py-3 text-white font-medium">{row.trade}</td>

                      {/* Budget — click to edit inline */}
                      <td className="px-4 py-3 text-right">
                        {editingTrade === row.trade ? (
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            step={100}
                            className="w-28 text-right bg-slate-700 border border-cyan-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={commitBudget}
                            onKeyDown={e => {
                              if (e.key === "Enter") commitBudget();
                              if (e.key === "Escape") setEditingTrade(null);
                              if (e.key === "Tab") { e.preventDefault(); commitAndMoveNext(row.trade); }
                            }}
                          />
                        ) : (
                          <button
                            onClick={() => { setEditingTrade(row.trade); setEditingValue(String(row.budget)); }}
                            className="group/btn flex items-center gap-1.5 ml-auto text-slate-300 hover:text-white transition-colors"
                            title="Click to set budget"
                          >
                            {row.budget > 0
                              ? <span className="font-mono">{aud(row.budget)}</span>
                              : <span className="text-slate-500 text-xs italic">set budget</span>}
                            <Pencil className="w-3 h-3 opacity-0 group-hover/btn:opacity-50 transition-opacity" />
                          </button>
                        )}
                      </td>

                      {/* Spent */}
                      <td className="px-4 py-3 text-right font-mono text-slate-300">{aud(row.spent)}</td>

                      {/* Remaining + saving/over label */}
                      <td className="px-4 py-3 text-right">
                        {row.budget > 0 ? (
                          <div>
                            <span className={`font-mono font-semibold ${row.remaining < 0 ? "text-red-400" : "text-green-400"}`}>
                              {aud(Math.abs(row.remaining))}
                            </span>
                            <div className={`text-xs mt-0.5 ${row.remaining >= 0 ? "text-green-500/70" : "text-red-500/70"}`}>
                              {row.remaining >= 0 ? "saving" : "over budget"}
                            </div>
                          </div>
                        ) : row.spent > 0 ? (
                          <span className="text-slate-500 text-xs italic">no budget set</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Progress bar */}
                      <td className="px-4 py-3">
                        {row.budget > 0 ? (
                          <div className="space-y-1">
                            <span className="text-xs text-slate-500">{row.pctUsed.toFixed(0)}%</span>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${row.pctUsed >= 100 ? "bg-red-500" : row.pctUsed >= 80 ? "bg-amber-500" : "bg-cyan-500"}`}
                                style={{ width: `${Math.min(100, row.pctUsed)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Quick log cost */}
                      <td className="px-2 py-3">
                        <button
                          onClick={() => openFormForTrade(row.trade)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 whitespace-nowrap"
                        >
                          <Plus className="w-3 h-3" /> Log cost
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {/* Totals row */}
                  <tr className="border-t-2 border-slate-600 bg-slate-900/40">
                    <td className="px-4 py-3 text-white font-semibold">Total</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-white">{aud(effectiveBudgetTotal)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-white">{aud(actualTotal)}</td>
                    <td className="px-4 py-3 text-right">
                      {totalSavings > 0 && (
                        <div>
                          <span className="font-mono font-bold text-green-400">{aud(totalSavings)}</span>
                          <div className="text-xs text-green-500/70 mt-0.5">total savings</div>
                        </div>
                      )}
                      {variance < 0 && (
                        <div>
                          <span className="font-mono font-bold text-red-400">{aud(Math.abs(variance))}</span>
                          <div className="text-xs text-red-500/70 mt-0.5">over budget</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {effectiveBudgetTotal > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs text-slate-400">{pctComplete.toFixed(0)}%</span>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pctComplete >= 100 ? "bg-red-500" : pctComplete >= 80 ? "bg-amber-500" : "bg-cyan-500"}`}
                              style={{ width: `${Math.min(100, pctComplete)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td />
                  </tr>

                  {/* Monitor trade inline form */}
                  {showMonitorForm ? (
                    <tr className="border-t border-slate-700 bg-slate-800/60">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex gap-3 items-end flex-wrap">
                          <div>
                            <Label className="text-xs text-slate-400 mb-1 block">Trade</Label>
                            <Select value={monitorTrade} onValueChange={setMonitorTrade}>
                              <SelectTrigger className="h-8 text-sm bg-slate-700 border-slate-600 text-white w-52">
                                <SelectValue placeholder="Select trade…" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-600">
                                {availableTrades.map(t => (
                                  <SelectItem key={t} value={t} className="text-white hover:bg-slate-700">{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-400 mb-1 block">Budget (optional)</Label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                              <Input
                                type="number" min={0} value={monitorBudget}
                                onChange={e => setMonitorBudget(e.target.value)}
                                placeholder="0" className="h-8 text-sm bg-slate-700 border-slate-600 text-white pl-6 w-36"
                                onKeyDown={e => e.key === "Enter" && handleAddMonitor()}
                              />
                            </div>
                          </div>
                          <Button size="sm" onClick={handleAddMonitor} className="bg-cyan-600 hover:bg-cyan-700">Add</Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowMonitorForm(false)} className="text-slate-400">Cancel</Button>
                        </div>
                      </td>
                    </tr>
                  ) : availableTrades.length > 0 ? (
                    <tr className="border-t border-slate-700/40">
                      <td colSpan={6} className="px-4 py-2.5">
                        <button
                          onClick={() => { setShowMonitorForm(true); setMonitorTrade(availableTrades[0]); }}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Monitor another trade
                        </button>
                      </td>
                    </tr>
                  ) : null}
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost log */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white">Cost Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <DollarSign className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No cost entries yet.</p>
              <p className="text-slate-500 text-xs mt-1">Click "Add Cost" to record your first actual cost.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Trade</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Description</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Supplier</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Type</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Amount</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                        {format(parseISO(entry.date), "dd MMM yyyy")}
                      </td>
                      <td className="px-4 py-2.5 text-white">{entry.trade}</td>
                      <td className="px-4 py-2.5 text-slate-300 max-w-[200px] truncate">{entry.description}</td>
                      <td className="px-4 py-2.5 text-slate-400">{entry.supplier || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium border capitalize ${typeColors[entry.type]}`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-white font-medium whitespace-nowrap">{aud(entry.amount)}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => handleDelete(entry.id)}
                          className="text-slate-600 hover:text-red-400 transition-colors" aria-label="Delete entry">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
