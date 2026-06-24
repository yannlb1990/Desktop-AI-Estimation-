import { useState, useEffect } from "react"
import { getUserStorageKey } from "@/lib/localAuth"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  FileText, FileImage, Download, Trash2, Search,
  FolderOpen, Clock, DollarSign, Printer, File,
} from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

export interface SavedQuoteSnapshot {
  id: string
  name: string
  savedAt: string
  quoteNumber: string
  totalIncGST: number
  subtotal: number
  itemCount: number
  // Full data for PDF re-generation
  lines: Array<{ id: string; description: string; qty: number; unit: string; unitPrice: number; included: boolean }>
  brand: Record<string, string>
  companyName: string
  companyABN: string
  companyPhone: string
  companyEmail: string
  companyAddress: string
  builderLicence: string
  liabilityInsurance: string
  primaryColor: string
  accentColor: string
  logoDataUrl: string
  inclusions: string[]
  exclusions: string[]
  terms: string
  scopeNotes: string
  depositPct: string
  progressPct: string
  finalPct: string
  validityDays: string
  projectName: string
  clientName: string
  siteAddress: string
}

export interface SavedPlanRecord {
  planId: string
  filename: string
  uploadedAt: string
  pageCount: number
}

interface DocumentLibraryProps {
  projectId: string
  projectName: string
  clientName?: string
  siteAddress?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const au$ = (n: number) => "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

function getProjectData(projectId: string) {
  try {
    const projects: any[] = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]")
    return projects.find(p => p.id === projectId) || null
  } catch { return null }
}

function updateProjectData(projectId: string, patch: Record<string, any>) {
  try {
    const projects: any[] = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]")
    const idx = projects.findIndex(p => p.id === projectId)
    if (idx === -1) return
    projects[idx] = { ...projects[idx], ...patch }
    localStorage.setItem(getUserStorageKey("local_projects"), JSON.stringify(projects))
  } catch { /* non-fatal */ }
}

// ── Print saved quote ─────────────────────────────────────────────────────────

function printSavedQuote(q: SavedQuoteSnapshot) {
  const today = new Date()
  const validUntil = new Date(today.getTime() + parseInt(q.validityDays || "30") * 86400000)
  const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
  const hdr = `linear-gradient(135deg, ${q.primaryColor}ee 0%, ${q.primaryColor} 60%, ${q.primaryColor}cc 100%)`
  const includedLines = q.lines.filter(l => l.included)
  const subtotal = includedLines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const gst = subtotal * 0.1
  const total = subtotal + gst
  const depAmt = total * (parseFloat(q.depositPct || "10") / 100)
  const progAmt = total * (parseFloat(q.progressPct || "40") / 100)
  const finalAmt = total * (parseFloat(q.finalPct || "50") / 100)

  const termsClauses = q.terms
    ? q.terms.split(/\n(?=\d+\.)/).filter(Boolean).map(c => {
        const m = c.match(/^(\d+)\.\s*([^:]+):\s*([\s\S]+)/)
        return m
          ? `<li style="display:flex;gap:10px;font-size:12px;color:#4b5563;line-height:1.6;margin-bottom:8px"><span style="flex-shrink:0;font-weight:700;color:#1f2937;width:18px">${m[1]}.</span><span><strong style="color:#1f2937">${m[2]}:</strong> ${m[3].trim()}</span></li>`
          : `<li style="font-size:12px;color:#4b5563;line-height:1.6;margin-bottom:8px">${c.trim()}</li>`
      }).join("")
    : ""

  const sectionHead = (title: string) =>
    `<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
       <div style="width:4px;height:22px;border-radius:2px;background:${q.primaryColor};flex-shrink:0"></div>
       <h2 style="margin:0;font-size:16px;font-weight:700;color:#111">${title}</h2>
     </div>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Quote ${q.quoteNumber} — ${q.projectName}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;margin:0;padding:0;background:#e5e7eb;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:800px;margin:0 auto;background:#fff}
  table{width:100%;border-collapse:collapse}
  @page{size:A4;margin:0}
  @media print{
    body{background:#fff}
    .no-print{display:none!important}
    .page{max-width:none;margin:0;box-shadow:none}
    .avoid-break{break-inside:avoid}
    tr{break-inside:avoid}
  }
</style></head><body>
<div class="no-print" style="text-align:center;padding:12px 16px;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;gap:12px">
  <span style="font-size:13px;color:#94a3b8">Quote ${q.quoteNumber} · ${q.projectName}</span>
  <button onclick="window.print()" style="padding:7px 20px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">Print / Save PDF</button>
  <button onclick="window.close()" style="padding:7px 14px;background:#334155;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Close</button>
</div>
<div class="page">

  <!-- Header -->
  <div style="background:${hdr};padding:40px;color:#fff">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="display:flex;align-items:center;gap:16px">
        ${q.logoDataUrl ? `<img src="${q.logoDataUrl}" style="height:56px;object-fit:contain;background:rgba(255,255,255,.12);border-radius:8px;padding:8px">` : ""}
        <div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:${q.accentColor};margin-bottom:4px">Quotation</div>
          <div style="font-size:22px;font-weight:700;line-height:1.2">${q.companyName}</div>
          ${q.companyABN ? `<div style="font-size:11px;opacity:.65;margin-top:3px">ABN: ${q.companyABN}${q.builderLicence ? ` &nbsp;·&nbsp; Licence: ${q.builderLicence}` : ""}</div>` : (q.builderLicence ? `<div style="font-size:11px;opacity:.65;margin-top:3px">Licence: ${q.builderLicence}</div>` : "")}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:28px;font-weight:700;color:${q.accentColor};letter-spacing:-.5px">${q.quoteNumber}</div>
        <div style="font-size:12px;opacity:.7;margin-top:6px">Issued: ${fmt(new Date(q.savedAt))}</div>
        <div style="font-size:12px;opacity:.7">Valid until: ${fmt(validUntil)}</div>
      </div>
    </div>
    <div style="margin-top:28px;padding-top:22px;border-top:1px solid rgba(255,255,255,.2);display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:${q.accentColor};margin-bottom:6px">Project</div>
        <div style="font-size:17px;font-weight:600">${q.projectName}</div>
        ${q.siteAddress ? `<div style="opacity:.65;font-size:12px;margin-top:3px">${q.siteAddress}</div>` : ""}
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:${q.accentColor};margin-bottom:6px">Prepared For</div>
        <div style="font-size:17px;font-weight:600">${q.clientName || "Client"}</div>
        ${q.companyPhone ? `<div style="opacity:.65;font-size:12px;margin-top:3px">${q.companyPhone}</div>` : ""}
        ${q.companyEmail ? `<div style="opacity:.65;font-size:12px">${q.companyEmail}</div>` : ""}
      </div>
    </div>
  </div>
  <div style="height:5px;background:linear-gradient(to right,${q.accentColor},${q.primaryColor})"></div>

  <div style="padding:36px">

    <!-- Total value -->
    ${subtotal > 0 ? `
    <div class="avoid-break" style="border-radius:12px;border:2px solid ${q.primaryColor}28;background:${q.primaryColor}07;padding:24px;display:flex;justify-content:space-between;align-items:center;margin-bottom:32px">
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${q.primaryColor};margin-bottom:4px">Total Quotation Value</div>
        <div style="font-size:38px;font-weight:800;font-family:ui-monospace,monospace;color:${q.primaryColor};line-height:1">${au$(total)}</div>
        <div style="font-size:12px;color:${q.primaryColor}88;margin-top:5px">Inclusive of GST</div>
      </div>
      <div style="text-align:right;font-size:13px;color:${q.primaryColor}99;line-height:1.8">
        <div>Subtotal: ${au$(subtotal)}</div>
        <div>GST (10%): ${au$(gst)}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:6px;max-width:150px">Contractor is GST registered under A New Tax System (GST) Act 1999</div>
      </div>
    </div>` : ""}

    <!-- Breakdown table -->
    ${includedLines.length > 0 ? `
    <div class="avoid-break" style="margin-bottom:32px">
      ${sectionHead("Quotation Breakdown")}
      <table style="font-size:13px">
        <thead>
          <tr style="background:${q.primaryColor}0f">
            <th style="text-align:left;padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid ${q.primaryColor}20">Description</th>
            <th style="text-align:right;padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid ${q.primaryColor}20;width:55px">Qty</th>
            <th style="text-align:right;padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid ${q.primaryColor}20;width:55px">Unit</th>
            <th style="text-align:right;padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid ${q.primaryColor}20;width:90px">Rate</th>
            <th style="text-align:right;padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid ${q.primaryColor}20;width:100px">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${includedLines.map((l, i) => `
          <tr style="${i % 2 === 1 ? `background:#f9fafb` : ""}">
            <td style="padding:10px 12px;color:#1f2937;border-bottom:1px solid #f1f5f9">${l.description}</td>
            <td style="padding:10px 12px;text-align:right;color:#6b7280;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:12px">${l.qty}</td>
            <td style="padding:10px 12px;text-align:right;color:#9ca3af;border-bottom:1px solid #f1f5f9;font-size:12px">${l.unit}</td>
            <td style="padding:10px 12px;text-align:right;color:#6b7280;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:12px">${au$(l.unitPrice)}</td>
            <td style="padding:10px 12px;text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:12px;color:${q.primaryColor}">${au$(l.qty * l.unitPrice)}</td>
          </tr>`).join("")}
        </tbody>
        <tfoot>
          <tr><td colspan="4" style="text-align:right;padding:8px 12px;color:#6b7280;font-size:12px">Subtotal (ex GST)</td><td style="text-align:right;padding:8px 12px;font-family:monospace;font-size:12px;color:#374151">${au$(subtotal)}</td></tr>
          <tr><td colspan="4" style="text-align:right;padding:4px 12px;color:#6b7280;font-size:12px">GST (10%)</td><td style="text-align:right;padding:4px 12px;font-family:monospace;font-size:12px;color:#374151">${au$(gst)}</td></tr>
          <tr style="background:${q.primaryColor}0d"><td colspan="4" style="text-align:right;padding:10px 12px;font-weight:700;font-size:13px;color:#111">TOTAL (inc GST)</td><td style="text-align:right;padding:10px 12px;font-weight:700;font-family:monospace;font-size:14px;color:${q.primaryColor}">${au$(total)}</td></tr>
        </tfoot>
      </table>
    </div>` : ""}

    <!-- Scope of Works -->
    ${q.inclusions.length > 0 || q.exclusions.length > 0 ? `
    <div class="avoid-break" style="margin-bottom:32px">
      ${sectionHead("Scope of Works")}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <div>
          <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:10px">✓ Inclusions</div>
          <ul style="padding:0;list-style:none;margin:0">${q.inclusions.filter(Boolean).map(i => `<li style="font-size:12px;color:#4b5563;margin-bottom:7px;display:flex;gap:8px;line-height:1.5"><span style="color:#16a34a;flex-shrink:0;margin-top:1px">›</span>${i}</li>`).join("")}</ul>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:10px">✕ Exclusions</div>
          <ul style="padding:0;list-style:none;margin:0">${q.exclusions.filter(Boolean).map(i => `<li style="font-size:12px;color:#4b5563;margin-bottom:7px;display:flex;gap:8px;line-height:1.5"><span style="color:#dc2626;flex-shrink:0;margin-top:1px">✕</span>${i}</li>`).join("")}</ul>
        </div>
      </div>
      ${q.scopeNotes ? `<div style="margin-top:14px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#374151"><strong style="color:#92400e">Notes: </strong>${q.scopeNotes}</div>` : ""}
    </div>` : ""}

    <!-- Payment Schedule -->
    ${subtotal > 0 ? `
    <div class="avoid-break" style="margin-bottom:32px">
      ${sectionHead("Payment Schedule")}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
        ${[
          { label: "Deposit", pct: q.depositPct || "10", amt: depAmt, note: "Due upon acceptance" },
          { label: "Progress Payment", pct: q.progressPct || "40", amt: progAmt, note: "Due at practical completion stage" },
          { label: "Final Payment", pct: q.finalPct || "50", amt: finalAmt, note: "Due upon project handover" },
        ].map(p => `
        <div style="border-radius:10px;border:1px solid ${q.primaryColor}25;background:${q.primaryColor}05;padding:16px">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:6px">${p.label}</div>
          <div style="font-size:22px;font-weight:700;font-family:monospace;color:${q.primaryColor};line-height:1">${au$(p.amt)}</div>
          <div style="font-size:11px;font-weight:600;color:#6b7280;margin-top:4px">${p.pct}% of contract</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:4px">${p.note}</div>
        </div>`).join("")}
      </div>
    </div>` : ""}

    <!-- Insurance & Compliance -->
    <div class="avoid-break" style="margin-bottom:32px">
      ${sectionHead("Insurance & Compliance")}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        ${[
          { label: "Public Liability", value: q.liabilityInsurance || "$20,000,000" },
          { label: "Workers Compensation", value: "As required by law" },
          { label: "Contract Works", value: "Full project value" },
        ].map(ins => `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:11px;color:#6b7280;margin-bottom:5px">${ins.label}</div>
          <div style="font-size:13px;font-weight:600;color:#1f2937">${ins.value}</div>
        </div>`).join("")}
      </div>
      ${q.builderLicence ? `<div style="margin-top:10px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;color:#166534;display:flex;gap:8px;align-items:center"><span>✓</span> Licensed builder — Licence No. <strong>${q.builderLicence}</strong>. All works comply with NCC and applicable Australian Standards.</div>` : ""}
    </div>

    <!-- Terms & Conditions -->
    ${termsClauses ? `
    <div class="avoid-break" style="margin-bottom:32px">
      ${sectionHead("Terms & Conditions")}
      <ol style="padding:0;list-style:none;margin:0">${termsClauses}</ol>
    </div>` : ""}

    <!-- Acceptance -->
    <div class="avoid-break" style="border:2px solid ${q.accentColor}55;border-radius:12px;padding:28px;margin-bottom:32px">
      ${sectionHead("Acceptance")}
      <p style="font-size:13px;color:#6b7280;margin:0 0 24px">By signing below, both parties confirm acceptance of this quotation and the terms stated herein.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px">
        <div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:28px">Contractor</div>
          <div style="border-bottom:2px solid #d1d5db;height:44px;margin-bottom:10px"></div>
          <div style="font-size:12px;font-weight:600;color:#374151">${q.companyName}</div>
          ${q.builderLicence ? `<div style="font-size:11px;color:#9ca3af">Licence: ${q.builderLicence}</div>` : ""}
          <div style="font-size:11px;color:#9ca3af;margin-top:10px">Date: ____________________</div>
        </div>
        <div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:28px">Client</div>
          <div style="border-bottom:2px solid #d1d5db;height:44px;margin-bottom:10px"></div>
          <div style="font-size:12px;font-weight:600;color:#374151">${q.clientName || "Client"}</div>
          <div style="font-size:11px;color:#9ca3af">Print name: ____________________</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:4px">Date: ____________________</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;font-size:11px;color:#9ca3af;padding-top:16px;border-top:1px solid #f1f5f9;line-height:1.8">
      <div style="font-weight:600;color:#6b7280;font-size:12px">${q.companyName}</div>
      ${q.companyAddress ? `<div>${q.companyAddress}</div>` : ""}
      <div style="display:flex;justify-content:center;gap:20px;margin-top:4px">
        ${q.companyPhone ? `<span>${q.companyPhone}</span>` : ""}
        ${q.companyEmail ? `<span>${q.companyEmail}</span>` : ""}
      </div>
      <div style="margin-top:4px">
        ${q.companyABN ? `<span>ABN: ${q.companyABN}</span>` : ""}
      </div>
      <div style="margin-top:8px;font-size:10px;color:#d1d5db">Generated with Metricore · ${fmtDate(q.savedAt)}</div>
    </div>

  </div>
</div>
</body></html>`

  const win = window.open("", "_blank")
  if (!win) { toast.error("Pop-ups are blocked. Allow pop-ups for this site."); return }
  win.document.write(html)
  win.document.close()
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DocumentLibrary = ({ projectId, projectName, clientName = "", siteAddress = "" }: DocumentLibraryProps) => {
  const [savedQuotes, setSavedQuotes] = useState<SavedQuoteSnapshot[]>([])
  const [savedPlans, setSavedPlans] = useState<SavedPlanRecord[]>([])
  const [search, setSearch] = useState("")
  const [activeSection, setActiveSection] = useState<"quotes" | "plans">("quotes")

  useEffect(() => {
    const proj = getProjectData(projectId)
    if (!proj) return
    setSavedQuotes(proj.saved_quotes || [])
    setSavedPlans(proj.saved_plans || [])
  }, [projectId])

  const deleteQuote = (id: string) => {
    const updated = savedQuotes.filter(q => q.id !== id)
    setSavedQuotes(updated)
    updateProjectData(projectId, { saved_quotes: updated })
    toast.success("Quote removed from library")
  }

  const deletePlan = (planId: string) => {
    const updated = savedPlans.filter(p => p.planId !== planId)
    setSavedPlans(updated)
    updateProjectData(projectId, { saved_plans: updated })
    toast.success("Plan record removed")
  }

  const filteredQuotes = savedQuotes.filter(q =>
    !search || q.name.toLowerCase().includes(search.toLowerCase()) ||
    q.quoteNumber.toLowerCase().includes(search.toLowerCase())
  )

  const filteredPlans = savedPlans.filter(p =>
    !search || p.filename.toLowerCase().includes(search.toLowerCase())
  )

  const totalQuoteValue = savedQuotes.reduce((s, q) => s + q.totalIncGST, 0)

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <FileText className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{savedQuotes.length}</div>
            <div className="text-xs text-muted-foreground">Saved Quotes</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono">{savedQuotes.length > 0 ? au$(totalQuoteValue / savedQuotes.length) : "—"}</div>
            <div className="text-xs text-muted-foreground">Avg Quote Value</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10">
            <FileImage className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{savedPlans.length}</div>
            <div className="text-xs text-muted-foreground">Uploaded Plans</div>
          </div>
        </Card>
      </div>

      {/* Section switcher + search */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border overflow-hidden">
          <button
            onClick={() => setActiveSection("quotes")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeSection === "quotes" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >
            <FileText className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            Quotes ({savedQuotes.length})
          </button>
          <button
            onClick={() => setActiveSection("plans")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeSection === "plans" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >
            <FileImage className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            Plans ({savedPlans.length})
          </button>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={activeSection === "quotes" ? "Search quotes…" : "Search plans…"}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Quotes section */}
      {activeSection === "quotes" && (
        <div className="space-y-3">
          {filteredQuotes.length === 0 ? (
            <Card className="p-12 text-center">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="font-medium text-muted-foreground">No saved quotes yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Generate a quote and click <strong>"Save to Library"</strong> to archive it here.
              </p>
            </Card>
          ) : (
            filteredQuotes.map(q => (
              <Card key={q.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-blue-500/10 flex-shrink-0 mt-0.5">
                      <FileText className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{q.name}</span>
                        <Badge variant="outline" className="text-xs font-mono flex-shrink-0">{q.quoteNumber}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtDateTime(q.savedAt)}
                        </span>
                        <span>{q.itemCount} line{q.itemCount !== 1 ? "s" : ""}</span>
                        <span className="font-mono font-semibold text-foreground">{au$(q.totalIncGST)}</span>
                        <span className="text-muted-foreground/60">inc GST</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => printSavedQuote(q)}
                    >
                      <Printer className="h-3.5 w-3.5 mr-1.5" />
                      Download PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteQuote(q.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Plans section */}
      {activeSection === "plans" && (
        <div className="space-y-3">
          {filteredPlans.length === 0 ? (
            <Card className="p-12 text-center">
              <File className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="font-medium text-muted-foreground">No plans recorded yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Plans are automatically recorded here when you upload them in the Takeoff tab.
              </p>
            </Card>
          ) : (
            filteredPlans.map(p => (
              <Card key={p.planId} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-violet-500/10 flex-shrink-0">
                      <FileImage className="h-5 w-5 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{p.filename}</div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtDateTime(p.uploadedAt)}
                        </span>
                        {p.pageCount > 1 && <span>{p.pageCount} pages</span>}
                        <Badge variant="secondary" className="text-xs">
                          {p.filename.split('.').pop()?.toUpperCase() || "PDF"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => deletePlan(p.planId)}
                    title="Remove from library"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Exported save helpers (called from QuoteGenerator + PDFUploadManager) ────

export function saveQuoteToLibrary(projectId: string, snapshot: Omit<SavedQuoteSnapshot, "id" | "savedAt">) {
  try {
    const projects: any[] = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]")
    const idx = projects.findIndex(p => p.id === projectId)
    if (idx === -1) return
    const existing: SavedQuoteSnapshot[] = projects[idx].saved_quotes || []
    const entry: SavedQuoteSnapshot = {
      ...snapshot,
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
    }
    projects[idx].saved_quotes = [...existing, entry]
    localStorage.setItem(getUserStorageKey("local_projects"), JSON.stringify(projects))
    return entry
  } catch { return null }
}

export function savePlanToLibrary(projectId: string, plan: SavedPlanRecord) {
  try {
    const projects: any[] = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]")
    const idx = projects.findIndex(p => p.id === projectId)
    if (idx === -1) return
    const existing: SavedPlanRecord[] = projects[idx].saved_plans || []
    // Avoid duplicate entries for the same planId
    if (existing.some(p => p.planId === plan.planId)) return
    projects[idx].saved_plans = [...existing, plan]
    localStorage.setItem(getUserStorageKey("local_projects"), JSON.stringify(projects))
  } catch { /* non-fatal */ }
}
