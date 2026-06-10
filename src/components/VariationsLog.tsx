import { useState, useEffect, useCallback, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { getUserStorageKey } from "@/lib/localAuth";
import { loadVariationsMerged, lsSaveVariations, syncVariationsToSupabase } from "@/lib/db/variations";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  Edit2,
  ClipboardCheck,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type VariationStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "disputed";

type UnitType = "m" | "m²" | "m³" | "lm" | "ea" | "hr" | "ls" | "kg";

interface VariationItem {
  id: string;
  description: string;
  qty: number;
  unit: UnitType;
  rate: number;
  amount: number;
}

interface Variation {
  id: string;
  number: number;
  title: string;
  description: string;
  reason: string;
  status: VariationStatus;
  items: VariationItem[];
  notes: string;
  totalAmount: number;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
}

interface VariationsLogProps {
  projectId: string;
  projectName: string;
  clientEmail?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REASONS = [
  "Client-requested change",
  "Design change",
  "Site condition",
  "Unforeseen works",
  "Scope clarification",
  "Authority requirement",
  "Weather delay",
  "Other",
];

const UNITS: UnitType[] = ["m", "m²", "m³", "lm", "ea", "hr", "ls", "kg"];

const aud = (v: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);

function padVO(n: number) {
  return `VO-${String(n).padStart(3, "0")}`;
}

const STATUS_CONFIG: Record<
  VariationStatus,
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "bg-slate-600 text-slate-200" },
  pending_approval: {
    label: "Pending Approval",
    className: "bg-amber-600/80 text-amber-100 border border-amber-500/50",
  },
  approved: { label: "Approved", className: "bg-green-600/80 text-green-100" },
  rejected: { label: "Rejected", className: "bg-red-600/80 text-red-100" },
  disputed: {
    label: "Disputed",
    className: "bg-orange-600/80 text-orange-100",
  },
};

function makeBlankItem(): VariationItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    qty: 1,
    unit: "ea",
    rate: 0,
    amount: 0,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VariationsLog({
  projectId,
  projectName,
  clientEmail,
}: VariationsLogProps) {
  const [variations, setVariations] = useState<Variation[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariation, setEditingVariation] = useState<Variation | null>(null);

  // Dialog form state
  const [formTitle, setFormTitle] = useState("");
  const [formReason, setFormReason] = useState(REASONS[0]);
  const [formDescription, setFormDescription] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<VariationItem[]>([makeBlankItem()]);

  // Load merged from DB + localStorage
  useEffect(() => {
    loadVariationsMerged(projectId).then(setVariations);
  }, [projectId]);

  const saveVariations = useCallback(
    (updated: Variation[]) => {
      setVariations(updated);
      lsSaveVariations(projectId, updated);
      syncVariationsToSupabase(projectId, updated);
    },
    [projectId]
  );

  // ─── Summary ────────────────────────────────────────────────────────────

  const approvedValue = useMemo(
    () =>
      variations
        .filter((v) => v.status === "approved")
        .reduce((s, v) => s + v.totalAmount, 0),
    [variations]
  );

  const pendingValue = useMemo(
    () =>
      variations
        .filter((v) => v.status === "pending_approval" || v.status === "disputed")
        .reduce((s, v) => s + v.totalAmount, 0),
    [variations]
  );

  // ─── Dialog helpers ──────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingVariation(null);
    setFormTitle("");
    setFormReason(REASONS[0]);
    setFormDescription("");
    setFormNotes("");
    setFormItems([makeBlankItem()]);
    setDialogOpen(true);
  };

  const openEditDialog = (variation: Variation) => {
    setEditingVariation(variation);
    setFormTitle(variation.title);
    setFormReason(variation.reason);
    setFormDescription(variation.description);
    setFormNotes(variation.notes);
    setFormItems(variation.items.length ? variation.items : [makeBlankItem()]);
    setDialogOpen(true);
  };

  const computeItems = (items: VariationItem[]): VariationItem[] =>
    items.map((item) => ({
      ...item,
      amount: item.qty * item.rate,
    }));

  const totalFromItems = (items: VariationItem[]) =>
    items.reduce((s, i) => s + i.qty * i.rate, 0);

  const handleSaveDialog = () => {
    if (!formTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    const finalItems = computeItems(formItems);
    const total = totalFromItems(formItems);

    if (editingVariation) {
      const updated = variations.map((v) =>
        v.id === editingVariation.id
          ? {
              ...v,
              title: formTitle.trim(),
              reason: formReason,
              description: formDescription.trim(),
              notes: formNotes.trim(),
              items: finalItems,
              totalAmount: total,
            }
          : v
      );
      saveVariations(updated);
      toast.success("Variation updated");
    } else {
      const nextNumber =
        variations.length > 0
          ? Math.max(...variations.map((v) => v.number)) + 1
          : 1;
      const newVariation: Variation = {
        id: crypto.randomUUID(),
        number: nextNumber,
        title: formTitle.trim(),
        description: formDescription.trim(),
        reason: formReason,
        status: "draft",
        items: finalItems,
        notes: formNotes.trim(),
        totalAmount: total,
        createdAt: new Date().toISOString(),
      };
      saveVariations([newVariation, ...variations]);
      toast.success("Variation created");
    }

    setDialogOpen(false);
  };

  // ─── Item row helpers ────────────────────────────────────────────────────

  const updateItem = (index: number, field: keyof VariationItem, value: string | number) => {
    setFormItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        updated.amount = updated.qty * updated.rate;
        return updated;
      })
    );
  };

  const addItemRow = () => setFormItems((prev) => [...prev, makeBlankItem()]);

  const removeItemRow = (index: number) =>
    setFormItems((prev) => prev.filter((_, i) => i !== index));

  // ─── Status transitions ──────────────────────────────────────────────────

  const updateStatus = (
    id: string,
    status: VariationStatus,
    extra?: Partial<Variation>
  ) => {
    const updated = variations.map((v) =>
      v.id === id ? { ...v, status, ...extra } : v
    );
    saveVariations(updated);
  };

  const sendForApproval = (variation: Variation) => {
    const total = variation.totalAmount;
    const gst = total * 0.1;
    const totalInc = total * 1.1;

    const itemLines = variation.items
      .map(
        (item) =>
          `  • ${item.description} — ${item.qty} ${item.unit} @ ${aud(item.rate)} = ${aud(item.amount)}`
      )
      .join("\n");

    const text = `Subject: Variation Order ${padVO(variation.number)} – ${projectName}

Dear ${clientEmail || "Client"},

Please review Variation Order ${padVO(variation.number)}: ${variation.title}

Description: ${variation.description || "N/A"}
Reason: ${variation.reason}

Items:
${itemLines}

Total (ex GST):  $${total.toFixed(2)}
GST (10%):       $${gst.toFixed(2)}
Total (inc GST): $${totalInc.toFixed(2)}

Please respond to approve or reject this variation.`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success("Email text copied to clipboard");
        updateStatus(variation.id, "pending_approval");
      })
      .catch(() => {
        toast.error("Clipboard access denied — status updated anyway");
        updateStatus(variation.id, "pending_approval");
      });
  };

  const deleteVariation = (id: string) => {
    saveVariations(variations.filter((v) => v.id !== id));
    toast.success("Variation deleted");
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Variations Log</h2>
        <Button
          size="sm"
          onClick={openCreateDialog}
          className="gap-1 bg-cyan-600 hover:bg-cyan-700"
        >
          <Plus className="w-3.5 h-3.5" />
          New Variation
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-400 mb-1">Total Variations</p>
            <p className="text-2xl font-bold text-white">{variations.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-900/20 border-green-700/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-400 mb-1">Approved Value</p>
            <p className="text-2xl font-bold text-green-400">{aud(approvedValue)}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-900/20 border-amber-700/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-400 mb-1">Pending Value</p>
            <p className="text-2xl font-bold text-amber-400">{aud(pendingValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {variations.length === 0 && (
        <div className="text-center py-12 border border-dashed border-slate-700 rounded-lg">
          <ClipboardCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No variations yet</p>
          <p className="text-slate-500 text-sm mt-1">
            Click "New Variation" to create a change order.
          </p>
        </div>
      )}

      {/* Variation cards */}
      {variations.map((v) => {
        const cfg = STATUS_CONFIG[v.status];
        const isExpanded = expandedIds.has(v.id);

        return (
          <Card key={v.id} className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono text-slate-500 font-semibold">
                      {padVO(v.number)}
                    </span>
                    <span className="text-white font-semibold truncate">{v.title}</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cfg.className}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  {v.description && (
                    <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">
                      {v.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                    <span>Reason: {v.reason}</span>
                    <span>Created: {format(parseISO(v.createdAt), "dd MMM yyyy")}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-lg font-bold text-white">{aud(v.totalAmount)}</p>
                  <p className="text-xs text-slate-500">ex GST</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {/* Items toggle */}
              <button
                onClick={() => toggleExpand(v.id)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-3 transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                {v.items.length} line item{v.items.length !== 1 ? "s" : ""}
              </button>

              {isExpanded && v.items.length > 0 && (
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-xs mb-2">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left pb-1.5 text-slate-400 font-semibold">Description</th>
                        <th className="text-right pb-1.5 text-slate-400 font-semibold">Qty</th>
                        <th className="text-right pb-1.5 text-slate-400 font-semibold">Unit</th>
                        <th className="text-right pb-1.5 text-slate-400 font-semibold">Rate</th>
                        <th className="text-right pb-1.5 text-slate-400 font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.items.map((item) => (
                        <tr key={item.id} className="border-b border-slate-700/40">
                          <td className="py-1.5 text-slate-300">{item.description}</td>
                          <td className="py-1.5 text-right text-slate-300">{item.qty}</td>
                          <td className="py-1.5 text-right text-slate-400">{item.unit}</td>
                          <td className="py-1.5 text-right text-slate-300">{aud(item.rate)}</td>
                          <td className="py-1.5 text-right text-white font-medium">{aud(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-600">
                        <td colSpan={4} className="pt-1.5 text-slate-400 font-semibold">Total (ex GST)</td>
                        <td className="pt-1.5 text-right text-white font-bold">{aud(v.totalAmount)}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="py-0.5 text-slate-400">GST (10%)</td>
                        <td className="py-0.5 text-right text-slate-300">{aud(v.totalAmount * 0.1)}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="pb-1.5 text-slate-400 font-semibold">Total (inc GST)</td>
                        <td className="pb-1.5 text-right text-white font-bold">{aud(v.totalAmount * 1.1)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {v.notes && isExpanded && (
                <p className="text-xs text-slate-400 mb-3 italic">Notes: {v.notes}</p>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {v.status === "draft" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendForApproval(v)}
                      className="h-7 text-xs gap-1 border-amber-600/50 text-amber-300 hover:bg-amber-900/30"
                    >
                      <Clipboard className="w-3 h-3" />
                      Send for Approval
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(v)}
                      className="h-7 text-xs gap-1 text-slate-400 hover:text-white"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteVariation(v.id)}
                      className="h-7 text-xs gap-1 text-red-400 hover:text-red-300 ml-auto"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  </>
                )}

                {v.status === "pending_approval" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateStatus(v.id, "approved", {
                          approvedAt: new Date().toISOString(),
                        })
                      }
                      className="h-7 text-xs gap-1 border-green-600/50 text-green-300 hover:bg-green-900/30"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Mark Approved
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateStatus(v.id, "rejected", {
                          rejectedAt: new Date().toISOString(),
                        })
                      }
                      className="h-7 text-xs gap-1 border-red-600/50 text-red-300 hover:bg-red-900/30"
                    >
                      <XCircle className="w-3 h-3" />
                      Mark Rejected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(v.id, "disputed")}
                      className="h-7 text-xs gap-1 border-orange-600/50 text-orange-300 hover:bg-orange-900/30"
                    >
                      <AlertCircle className="w-3 h-3" />
                      Mark Disputed
                    </Button>
                  </>
                )}

                {v.status === "approved" && (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approved{v.approvedAt ? ` ${format(parseISO(v.approvedAt), "dd MMM yyyy")}` : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateStatus(v.id, "draft")}
                      className="h-7 text-xs gap-1 text-slate-400 hover:text-white ml-2"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Revert to Draft
                    </Button>
                  </>
                )}

                {v.status === "rejected" && (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs text-red-400 font-medium">
                      <XCircle className="w-3.5 h-3.5" />
                      Rejected{v.rejectedAt ? ` ${format(parseISO(v.rejectedAt), "dd MMM yyyy")}` : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateStatus(v.id, "draft")}
                      className="h-7 text-xs gap-1 text-slate-400 hover:text-white ml-2"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Revert to Draft
                    </Button>
                  </>
                )}

                {v.status === "disputed" && (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs text-orange-400 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      In Dispute
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateStatus(v.id, "approved", {
                          approvedAt: new Date().toISOString(),
                        })
                      }
                      className="h-7 text-xs gap-1 border-green-600/50 text-green-300 hover:bg-green-900/30 ml-2"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Mark Approved
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateStatus(v.id, "rejected", {
                          rejectedAt: new Date().toISOString(),
                        })
                      }
                      className="h-7 text-xs gap-1 border-red-600/50 text-red-300 hover:bg-red-900/30"
                    >
                      <XCircle className="w-3 h-3" />
                      Mark Rejected
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingVariation ? `Edit ${padVO(editingVariation.number)}` : "New Variation"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <Label className="text-xs text-slate-400 mb-1 block">Title *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Additional retaining wall"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Reason</Label>
                <Select value={formReason} onValueChange={setFormReason}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r} className="text-white hover:bg-slate-700">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-400 mb-1 block">Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe the scope of this variation…"
                rows={3}
                className="bg-slate-800 border-slate-600 text-white resize-none"
              />
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-slate-400">Line Items</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={addItemRow}
                  className="h-6 text-xs gap-1 text-cyan-400 hover:text-cyan-300"
                >
                  <Plus className="w-3 h-3" />
                  Add Row
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left pb-1.5 text-slate-400 font-semibold min-w-[150px]">Description</th>
                      <th className="text-right pb-1.5 text-slate-400 font-semibold w-16">Qty</th>
                      <th className="text-right pb-1.5 text-slate-400 font-semibold w-16">Unit</th>
                      <th className="text-right pb-1.5 text-slate-400 font-semibold w-20">Rate</th>
                      <th className="text-right pb-1.5 text-slate-400 font-semibold w-20">Amount</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {formItems.map((item, index) => (
                      <tr key={item.id} className="border-b border-slate-700/40">
                        <td className="py-1">
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            placeholder="Description…"
                            className="h-7 text-xs bg-slate-700 border-slate-600 text-white"
                          />
                        </td>
                        <td className="py-1 pl-1">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.qty}
                            onChange={(e) => updateItem(index, "qty", parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs bg-slate-700 border-slate-600 text-white text-right"
                          />
                        </td>
                        <td className="py-1 pl-1">
                          <Select
                            value={item.unit}
                            onValueChange={(v) => updateItem(index, "unit", v)}
                          >
                            <SelectTrigger className="h-7 text-xs bg-slate-700 border-slate-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                              {UNITS.map((u) => (
                                <SelectItem key={u} value={u} className="text-white hover:bg-slate-700 text-xs">
                                  {u}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-1 pl-1">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.rate}
                            onChange={(e) => updateItem(index, "rate", parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs bg-slate-700 border-slate-600 text-white text-right"
                          />
                        </td>
                        <td className="py-1 pl-1 text-right text-slate-300 font-medium whitespace-nowrap">
                          {aud(item.qty * item.rate)}
                        </td>
                        <td className="py-1 pl-1">
                          {formItems.length > 1 && (
                            <button
                              onClick={() => removeItemRow(index)}
                              className="text-slate-600 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-600">
                      <td colSpan={4} className="pt-2 text-slate-400 font-semibold text-right pr-2">
                        Total (ex GST)
                      </td>
                      <td className="pt-2 text-right text-white font-bold whitespace-nowrap">
                        {aud(totalFromItems(formItems))}
                      </td>
                      <td />
                    </tr>
                    <tr>
                      <td colSpan={4} className="py-0.5 text-slate-400 text-right pr-2">GST (10%)</td>
                      <td className="py-0.5 text-right text-slate-300 whitespace-nowrap">
                        {aud(totalFromItems(formItems) * 0.1)}
                      </td>
                      <td />
                    </tr>
                    <tr>
                      <td colSpan={4} className="pb-2 text-slate-400 font-semibold text-right pr-2">
                        Total (inc GST)
                      </td>
                      <td className="pb-2 text-right text-white font-bold whitespace-nowrap">
                        {aud(totalFromItems(formItems) * 1.1)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-400 mb-1 block">Notes</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Internal notes…"
                rows={2}
                className="bg-slate-800 border-slate-600 text-white resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveDialog} className="bg-cyan-600 hover:bg-cyan-700">
              {editingVariation ? "Update" : "Save as Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
