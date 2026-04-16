import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  AlertTriangle, TrendingUp, CheckCircle2, XCircle, AlertCircle,
  DollarSign, Layers, ShieldAlert, ClipboardList, Target, Flame,
} from "lucide-react";

interface EstimateItem {
  id: string;
  trade: string;
  scope_of_work: string;
  material_type: string;
  quantity: number;
  unit: string;
  unit_price: number;
  labour_hours: number;
  labour_rate: number;
  material_wastage_pct: number;
  labour_wastage_pct: number;
  markup_pct: number;
  notes: string;
  [key: string]: any;
}

interface ProjectInsightsTabProps {
  projectId: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function loadItems(projectId: string): EstimateItem[] {
  try {
    const projects = JSON.parse(localStorage.getItem("local_projects") || "[]");
    const project = projects.find((p: any) => p.id === projectId);
    return project?.estimate_items || [];
  } catch {
    return [];
  }
}

function calcLine(item: EstimateItem) {
  const qty = Number(item.quantity) || 0;
  const unitPrice = Number(item.unit_price) || 0;
  const labHours = Number(item.labour_hours) || 0;
  const labRate = Number(item.labour_rate) || 65;
  const matWaste = (Number(item.material_wastage_pct) || 0) / 100;
  const labWaste = (Number(item.labour_wastage_pct) || 0) / 100;
  const markup = (Number(item.markup_pct) || 0) / 100;

  const matBase = qty * unitPrice;
  const matWasteCost = matBase * matWaste;
  const materialTotal = matBase + matWasteCost;

  const labBase = labHours * labRate;
  const labWasteCost = labBase * labWaste;
  const labourTotal = labBase + labWasteCost;

  const subtotal = materialTotal + labourTotal;
  const markupAmount = subtotal * markup;
  const lineTotal = subtotal + markupAmount;

  return { matBase, matWasteCost, materialTotal, labBase, labWasteCost, labourTotal, subtotal, markupAmount, lineTotal };
}

const TRADE_COLORS: Record<string, string> = {
  Carpenter: "#3b82f6", Plumber: "#06b6d4", Electrician: "#f59e0b",
  Bricklayer: "#ef4444", Plasterer: "#8b5cf6", Painter: "#10b981",
  Tiler: "#f97316", Concreter: "#6b7280", Roofer: "#ec4899", Landscaper: "#84cc16",
};
const tradeColor = (t: string) => TRADE_COLORS[t] || "#94a3b8";
const au$ = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

// ── Health Score ─────────────────────────────────────────────────────────────

function useHealthScore(items: EstimateItem[]) {
  return useMemo(() => {
    if (items.length === 0) return { score: 0, issues: [], grade: "N/A" };
    const issues: { text: string; severity: "high" | "medium" | "low" }[] = [];
    let deductions = 0;

    const zeroPrice = items.filter(i => !i.unit_price || Number(i.unit_price) === 0);
    if (zeroPrice.length) {
      deductions += Math.min(zeroPrice.length * 8, 30);
      issues.push({ text: `${zeroPrice.length} item${zeroPrice.length > 1 ? "s" : ""} with $0 unit price`, severity: "high" });
    }
    const zeroMarkup = items.filter(i => !i.markup_pct || Number(i.markup_pct) === 0);
    if (zeroMarkup.length) {
      deductions += Math.min(zeroMarkup.length * 5, 20);
      issues.push({ text: `${zeroMarkup.length} item${zeroMarkup.length > 1 ? "s" : ""} with 0% markup — no profit margin applied`, severity: "high" });
    }
    const noLabour = items.filter(i => !i.labour_hours || Number(i.labour_hours) === 0);
    if (noLabour.length > items.length * 0.5) {
      deductions += 15;
      issues.push({ text: `${noLabour.length} items missing labour hours — labour cost excluded`, severity: "medium" });
    }
    const noDesc = items.filter(i => !i.scope_of_work && !i.material_type);
    if (noDesc.length) {
      deductions += Math.min(noDesc.length * 3, 10);
      issues.push({ text: `${noDesc.length} item${noDesc.length > 1 ? "s" : ""} missing description`, severity: "low" });
    }
    const highWaste = items.filter(i => Number(i.material_wastage_pct) > 20);
    if (highWaste.length) {
      deductions += Math.min(highWaste.length * 3, 10);
      issues.push({ text: `${highWaste.length} item${highWaste.length > 1 ? "s" : ""} with material waste >20%`, severity: "low" });
    }

    const score = Math.max(0, 100 - deductions);
    const grade = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Poor";
    return { score, issues, grade };
  }, [items]);
}

// ── Main Component ────────────────────────────────────────────────────────────

export const ProjectInsightsTab = ({ projectId }: ProjectInsightsTabProps) => {
  const items = useMemo(() => loadItems(projectId), [projectId]);
  const health = useHealthScore(items);
  const lines = useMemo(() => items.map(item => ({ item, ...calcLine(item) })), [items]);

  // Cost composition
  const split = useMemo(() => {
    let matBase = 0, matWaste = 0, labBase = 0, labWaste = 0, markup = 0;
    lines.forEach(l => { matBase += l.matBase; matWaste += l.matWasteCost; labBase += l.labBase; labWaste += l.labWasteCost; markup += l.markupAmount; });
    const grand = matBase + matWaste + labBase + labWaste + markup;
    return [
      { name: "Materials", value: Math.round(matBase), color: "#3b82f6" },
      { name: "Material Waste", value: Math.round(matWaste), color: "#93c5fd" },
      { name: "Labour", value: Math.round(labBase), color: "#10b981" },
      { name: "Labour Waste", value: Math.round(labWaste), color: "#6ee7b7" },
      { name: "Markup", value: Math.round(markup), color: "#f59e0b" },
    ].filter(d => d.value > 0).map(d => ({ ...d, pct: grand > 0 ? ((d.value / grand) * 100).toFixed(1) : "0" }));
  }, [lines]);

  const grandTotal = useMemo(() => lines.reduce((s, l) => s + l.lineTotal, 0), [lines]);

  // Markup by trade
  const markupByTrade = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    items.forEach(item => {
      const t = item.trade || "Unknown";
      if (!map[t]) map[t] = { total: 0, count: 0 };
      map[t].total += Number(item.markup_pct) || 0;
      map[t].count += 1;
    });
    return Object.entries(map)
      .map(([trade, { total, count }]) => ({ trade, avgMarkup: Math.round((total / count) * 10) / 10 }))
      .sort((a, b) => b.avgMarkup - a.avgMarkup);
  }, [items]);

  // Waste exposure
  const wasteExposure = useMemo(() =>
    lines.map(l => ({
      label: [l.item.scope_of_work, l.item.material_type].filter(Boolean).join(" / ") || l.item.trade || "Item",
      matWaste: Math.round(l.matWasteCost),
      labWaste: Math.round(l.labWasteCost),
      total: Math.round(l.matWasteCost + l.labWasteCost),
    })).filter(w => w.total > 0).sort((a, b) => b.total - a.total).slice(0, 8),
  [lines]);

  const totalWaste = useMemo(() => wasteExposure.reduce((s, w) => s + w.total, 0), [wasteExposure]);

  // Completeness by trade
  const completeness = useMemo(() => {
    const map: Record<string, { total: number; hasPrice: number; hasLabour: number; hasQty: number }> = {};
    items.forEach(item => {
      const t = item.trade || "Unknown";
      if (!map[t]) map[t] = { total: 0, hasPrice: 0, hasLabour: 0, hasQty: 0 };
      map[t].total += 1;
      if (Number(item.unit_price) > 0) map[t].hasPrice += 1;
      if (Number(item.labour_hours) > 0) map[t].hasLabour += 1;
      if (Number(item.quantity) > 0) map[t].hasQty += 1;
    });
    return Object.entries(map).map(([trade, d]) => ({
      trade,
      pricePct: Math.round((d.hasPrice / d.total) * 100),
      labourPct: Math.round((d.hasLabour / d.total) * 100),
      qtyPct: Math.round((d.hasQty / d.total) * 100),
      overallPct: Math.round(((d.hasPrice + d.hasLabour + d.hasQty) / (d.total * 3)) * 100),
      count: d.total,
    }));
  }, [items]);

  // Top 5 drivers
  const topDrivers = useMemo(() =>
    [...lines].sort((a, b) => b.lineTotal - a.lineTotal).slice(0, 5).map((l, i) => ({
      rank: i + 1,
      label: [l.item.scope_of_work, l.item.material_type].filter(Boolean).join(" — ") || l.item.trade || "Item",
      trade: l.item.trade,
      total: l.lineTotal,
      pct: grandTotal > 0 ? (l.lineTotal / grandTotal) * 100 : 0,
    })),
  [lines, grandTotal]);

  // Risk flags
  const riskFlags = useMemo(() => {
    const flags: { severity: "high" | "medium" | "low"; message: string }[] = [];
    items.forEach(item => {
      const label = [item.scope_of_work, item.material_type].filter(Boolean).join(" / ") || item.trade || "Item";
      if (!item.unit_price || Number(item.unit_price) === 0)
        flags.push({ severity: "high", message: `"${label}" — $0 unit price, line total will be zero` });
      if (!item.markup_pct || Number(item.markup_pct) === 0)
        flags.push({ severity: "high", message: `"${label}" — 0% markup, no profit on this line` });
      if (Number(item.labour_hours) > 0 && (!item.labour_rate || Number(item.labour_rate) === 0))
        flags.push({ severity: "medium", message: `"${label}" — has labour hours but $0/hr rate` });
      if (Number(item.material_wastage_pct) > 25)
        flags.push({ severity: "medium", message: `"${label}" — material waste at ${item.material_wastage_pct}% (unusually high)` });
      if (Number(item.labour_wastage_pct) > 20)
        flags.push({ severity: "low", message: `"${label}" — labour waste at ${item.labour_wastage_pct}%` });
    });
    const scopeCount: Record<string, number> = {};
    items.forEach(item => {
      const key = `${item.trade}::${item.scope_of_work}`;
      scopeCount[key] = (scopeCount[key] || 0) + 1;
    });
    Object.entries(scopeCount).forEach(([key, count]) => {
      if (count > 1) {
        const [trade, scope] = key.split("::");
        flags.push({ severity: "low", message: `"${scope || trade}" appears ${count} times under ${trade} — possible duplicate` });
      }
    });
    return flags.sort((a, b) => (a.severity === "high" ? -1 : a.severity === "medium" ? 0 : 1) - (b.severity === "high" ? -1 : b.severity === "medium" ? 0 : 1));
  }, [items]);

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <Card className="p-12 text-center">
        <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold text-lg mb-2">No estimate items yet</h3>
        <p className="text-muted-foreground text-sm">Add items in the Estimate tab — insights will populate automatically.</p>
      </Card>
    );
  }

  const scoreColor = health.score >= 85 ? "text-green-600" : health.score >= 70 ? "text-amber-500" : "text-red-500";
  const scoreRing = health.score >= 85 ? "border-green-500" : health.score >= 70 ? "border-amber-400" : "border-red-400";

  return (
    <div className="space-y-6">

      {/* ── 1. Health Score ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Estimate Health Score</CardTitle>
          </div>
          <CardDescription>Quality check across all {items.length} line items — fix these before you send</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-8">
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className={`w-28 h-28 rounded-full border-8 ${scoreRing} flex flex-col items-center justify-center`}>
                <span className={`text-3xl font-bold ${scoreColor}`}>{health.score}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
              <Badge variant={health.score >= 85 ? "default" : health.score >= 70 ? "secondary" : "destructive"} className="text-xs">
                {health.grade}
              </Badge>
            </div>
            <div className="flex-1 space-y-2">
              {health.issues.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">No issues found — estimate looks complete</span>
                </div>
              ) : health.issues.map((issue, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${
                  issue.severity === "high" ? "bg-red-50 border border-red-100 text-red-800" :
                  issue.severity === "medium" ? "bg-amber-50 border border-amber-100 text-amber-800" :
                  "bg-blue-50 border border-blue-100 text-blue-800"
                }`}>
                  {issue.severity === "high" ? <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> :
                   issue.severity === "medium" ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /> :
                   <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                  {issue.text}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Cost Composition ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <CardTitle>Cost Composition</CardTitle>
          </div>
          <CardDescription>How your total of {au$(grandTotal)} breaks down by cost type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6 items-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={split} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55}>
                  {split.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => au$(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {split.map(s => (
                <div key={s.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <span className="font-mono font-semibold">{au$(s.value)} <span className="text-muted-foreground font-normal text-xs">({s.pct}%)</span></span>
                  </div>
                  <Progress value={parseFloat(s.pct)} className="h-1.5" />
                </div>
              ))}
              <div className="pt-2 border-t text-sm font-semibold flex justify-between">
                <span>Grand Total (ex GST)</span>
                <span className="font-mono">{au$(grandTotal)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Markup Consistency ── */}
      {markupByTrade.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>Markup by Trade</CardTitle>
            </div>
            <CardDescription>Average markup % applied per trade — dashed line = 15% target</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={markupByTrade} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="trade" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="4 2" label={{ value: "Target 15%", position: "right", fontSize: 10, fill: "#ef4444" }} />
                <Bar dataKey="avgMarkup" name="Avg Markup %" radius={[4, 4, 0, 0]}>
                  {markupByTrade.map((entry, i) => (
                    <Cell key={i} fill={entry.avgMarkup < 15 ? "#ef4444" : entry.avgMarkup < 20 ? "#f59e0b" : "#10b981"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Below 15%</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> 15–20%</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Above 20%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 4. Waste Exposure ── */}
      {wasteExposure.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle>Waste Cost Exposure</CardTitle>
            </div>
            <CardDescription>
              Total waste built into estimate: <strong>{au$(totalWaste)}</strong> — review if any seem excessive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(180, wasteExposure.length * 36)}>
              <BarChart data={wasteExposure} layout="vertical" margin={{ left: 8, right: 50, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => au$(v)} />
                <Legend />
                <Bar dataKey="matWaste" name="Material Waste" stackId="a" fill="#93c5fd" />
                <Bar dataKey="labWaste" name="Labour Waste" stackId="a" fill="#6ee7b7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── 5. Quote Completeness ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle>Quote Completeness</CardTitle>
          </div>
          <CardDescription>How complete each trade's pricing data is before sending</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {completeness.map(t => (
              <div key={t.trade}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{t.trade}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t.count} item{t.count > 1 ? "s" : ""}</span>
                    <Badge variant={t.overallPct >= 80 ? "default" : t.overallPct >= 50 ? "secondary" : "destructive"} className="text-[10px] h-4 px-1.5">
                      {t.overallPct}% complete
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Quantity", pct: t.qtyPct },
                    { label: "Unit Price", pct: t.pricePct },
                    { label: "Labour Hours", pct: t.labourPct },
                  ].map(({ label, pct }) => (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span>{label}</span><span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 6. Top Cost Drivers ── */}
      {topDrivers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" />
              <CardTitle>Top Cost Drivers</CardTitle>
            </div>
            <CardDescription>Biggest line items — focus negotiation and value-engineering here first</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topDrivers.map(d => (
                <div key={d.rank} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white" style={{ background: tradeColor(d.trade) }}>
                    {d.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.label}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={d.pct} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground shrink-0">{d.pct.toFixed(1)}% of total</span>
                    </div>
                  </div>
                  <div className="text-sm font-mono font-semibold shrink-0">{au$(d.total)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 7. Risk Flags ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <CardTitle>Risk Flags</CardTitle>
          </div>
          <CardDescription>
            {riskFlags.length === 0
              ? "No risks detected — estimate looks clean"
              : `${riskFlags.length} issue${riskFlags.length > 1 ? "s" : ""} detected across your line items`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {riskFlags.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600 py-2">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">All clear — no pricing risks found</span>
            </div>
          ) : (
            <div className="space-y-2">
              {riskFlags.map((flag, i) => (
                <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg text-sm ${
                  flag.severity === "high" ? "bg-red-50 border border-red-100 text-red-800" :
                  flag.severity === "medium" ? "bg-amber-50 border border-amber-100 text-amber-800" :
                  "bg-slate-50 border border-slate-200 text-slate-700"
                }`}>
                  {flag.severity === "high" ? <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> :
                   flag.severity === "medium" ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /> :
                   <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                  <span className="flex-1">{flag.message}</span>
                  <Badge variant="outline" className={`ml-auto shrink-0 text-[10px] h-4 px-1.5 ${
                    flag.severity === "high" ? "border-red-300 text-red-700" :
                    flag.severity === "medium" ? "border-amber-300 text-amber-700" :
                    "border-slate-300 text-slate-600"
                  }`}>{flag.severity}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};
