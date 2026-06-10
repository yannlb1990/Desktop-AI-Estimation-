import { useState, useEffect, useCallback, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { getUserStorageKey } from "@/lib/localAuth";
import { loadJobCostsMerged, lsSaveJobCosts, syncJobCostsToSupabase } from "@/lib/db/jobCosts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react";

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function JobCostTracker({ projectId }: JobCostTrackerProps) {
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [estimateItems, setEstimateItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formTrade, setFormTrade] = useState("");
  const [formSupplier, setFormSupplier] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formType, setFormType] = useState<CostType>("invoice");

  // Load data — estimate items from localStorage, cost entries merged from DB
  useEffect(() => {
    const projectsRaw = localStorage.getItem(getUserStorageKey("local_projects"));
    const projects: any[] = projectsRaw ? JSON.parse(projectsRaw) : [];
    const project = projects.find((p: any) => p.id === projectId);
    setEstimateItems(project?.estimate_items || []);

    loadJobCostsMerged(projectId).then(setEntries);
  }, [projectId]);

  const saveEntries = useCallback(
    (updated: CostEntry[]) => {
      setEntries(updated);
      lsSaveJobCosts(projectId, updated);
      syncJobCostsToSupabase(projectId, updated);
    },
    [projectId]
  );

  // ─── Derived values ───────────────────────────────────────────────────────

  const estimateTrades = useMemo(() => {
    const trades = new Set<string>();
    estimateItems.forEach((item) => {
      if (item.trade) trades.add(item.trade);
    });
    return Array.from(trades).sort();
  }, [estimateItems]);

  const entryTrades = useMemo(() => {
    const trades = new Set<string>();
    entries.forEach((e) => {
      if (e.trade) trades.add(e.trade);
    });
    return Array.from(trades).sort();
  }, [entries]);

  const allTrades = useMemo(() => {
    const combined = new Set([...estimateTrades, ...entryTrades]);
    return Array.from(combined).sort();
  }, [estimateTrades, entryTrades]);

  const estimateTotal = useMemo(
    () => estimateItems.reduce((sum, item) => sum + computeItemPrice(item), 0),
    [estimateItems]
  );

  const actualTotal = useMemo(
    () => entries.reduce((sum, e) => sum + e.amount, 0),
    [entries]
  );

  const variance = estimateTotal - actualTotal;
  const pctComplete = estimateTotal > 0 ? (actualTotal / estimateTotal) * 100 : 0;

  // Trade-level budget vs spent
  const tradeBreakdown = useMemo(() => {
    return allTrades.map((trade) => {
      const budget = estimateItems
        .filter((item) => item.trade === trade)
        .reduce((sum, item) => sum + computeItemPrice(item), 0);

      const spent = entries
        .filter((e) => e.trade === trade)
        .reduce((sum, e) => sum + e.amount, 0);

      const remaining = budget - spent;
      const pctUsed = budget > 0 ? (spent / budget) * 100 : spent > 0 ? 100 : 0;

      return { trade, budget, spent, remaining, pctUsed };
    });
  }, [allTrades, estimateItems, entries]);

  // ─── Form submit ──────────────────────────────────────────────────────────

  const handleAddCost = () => {
    const amount = parseFloat(formAmount);
    if (!formDescription.trim()) {
      toast.error("Description is required");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount greater than 0");
      return;
    }
    if (!formTrade) {
      toast.error("Select a trade");
      return;
    }

    const entry: CostEntry = {
      id: crypto.randomUUID(),
      date: formDate,
      trade: formTrade,
      supplier: formSupplier,
      description: formDescription,
      amount,
      type: formType,
    };

    saveEntries([entry, ...entries]);
    toast.success("Cost entry added");

    // Reset form
    setFormDescription("");
    setFormSupplier("");
    setFormAmount("");
    setFormType("invoice");
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    saveEntries(entries.filter((e) => e.id !== id));
    toast.success("Entry deleted");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Job Cost Tracker</h2>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="gap-1 bg-cyan-600 hover:bg-cyan-700"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Cost
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Estimate Total</p>
                <p className="text-xl font-bold text-white">{aud(estimateTotal)}</p>
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
              {variance >= 0 ? (
                <TrendingDown className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <TrendingUp className="w-5 h-5 text-red-500 mt-0.5" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">% Complete</p>
                <p className="text-xl font-bold text-white">{pctComplete.toFixed(1)}%</p>
              </div>
              <Percent className="w-5 h-5 text-slate-500 mt-0.5" />
            </div>
            {/* Progress bar */}
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
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white">New Cost Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Date</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="h-8 text-sm bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Trade *</Label>
                <Select value={formTrade} onValueChange={setFormTrade}>
                  <SelectTrigger className="h-8 text-sm bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select trade…" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {allTrades.map((t) => (
                      <SelectItem key={t} value={t} className="text-white hover:bg-slate-700">
                        {t}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other" className="text-white hover:bg-slate-700">
                      Other
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Type</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as CostType)}>
                  <SelectTrigger className="h-8 text-sm bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {COST_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-white hover:bg-slate-700 capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Supplier</Label>
                <Input
                  value={formSupplier}
                  onChange={(e) => setFormSupplier(e.target.value)}
                  placeholder="Supplier name…"
                  className="h-8 text-sm bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Description *</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Description…"
                  className="h-8 text-sm bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Amount *</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-sm bg-slate-700 border-slate-600 text-white pl-6"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddCost} className="bg-cyan-600 hover:bg-cyan-700">
                Add Cost
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trade breakdown table */}
      {allTrades.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white">Trade Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-850">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Trade</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Budget</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Spent</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Remaining</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">% Used</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeBreakdown.map((row) => (
                    <tr key={row.trade} className="border-b border-slate-700/50 hover:bg-slate-750/30">
                      <td className="px-4 py-2.5 text-white font-medium">{row.trade}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300">{aud(row.budget)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300">{aud(row.spent)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${row.remaining < 0 ? "text-red-400" : "text-green-400"}`}>
                        {aud(row.remaining)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                            row.pctUsed >= 100
                              ? "bg-red-500/20 text-red-300"
                              : row.pctUsed >= 80
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-green-500/20 text-green-300"
                          }`}
                        >
                          {row.pctUsed.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-600 bg-slate-750/40">
                    <td className="px-4 py-2.5 text-white font-semibold">Total</td>
                    <td className="px-4 py-2.5 text-right text-white font-semibold">{aud(estimateTotal)}</td>
                    <td className="px-4 py-2.5 text-right text-white font-semibold">{aud(actualTotal)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${variance < 0 ? "text-red-400" : "text-green-400"}`}>
                      {aud(variance)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300 text-xs">
                      {pctComplete.toFixed(0)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-700/50 hover:bg-slate-750/30">
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
                      <td className="px-4 py-2.5 text-right text-white font-medium whitespace-nowrap">
                        {aud(entry.amount)}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="text-slate-600 hover:text-red-400 transition-colors"
                          aria-label="Delete entry"
                        >
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
