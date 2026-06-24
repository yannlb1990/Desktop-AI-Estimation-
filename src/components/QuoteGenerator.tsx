import { useState, useRef, useEffect } from "react"
import { getUserStorageKey } from "@/lib/localAuth"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { FileText, Printer, X, Plus, Trash2, ChevronRight, Upload, RefreshCw, GripVertical, Pencil, Check, History, RotateCcw, BookmarkPlus } from "lucide-react"
import { toast } from "sonner"
import { saveQuoteToLibrary } from "@/components/DocumentLibrary"

interface QuoteGeneratorProps {
  project: any
  estimate?: any
}

interface QuoteLine {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
  included: boolean
  fromEstimate: boolean
  trade?: string
  isEditing?: boolean
}

const DEFAULT_INCLUSIONS = [
  "All labour and materials as specified in this quotation",
  "Site protection, cleanup and waste removal upon completion",
  "All applicable permits and council approvals",
  "Workmanship warranty — 7 years structural, 2 years general",
  "Public liability insurance coverage during works",
]

const DEFAULT_EXCLUSIONS = [
  "Variations outside the agreed scope of works",
  "Asbestos, mould or hazardous material removal",
  "Landscaping and external works unless explicitly stated",
  "Electrical, plumbing and gas works unless specified",
  "Furniture, fittings and equipment (FF&E) unless stated",
]

const DEFAULT_TERMS = `1. ACCEPTANCE: This quotation is valid for the period stated. Acceptance must be in writing (email sufficient). Work commences upon receipt of deposit and signed acceptance.

2. VARIATIONS: Any changes to the agreed scope must be approved in writing prior to commencement. All variations will be charged at applicable rates and may affect the project timeline.

3. PAYMENT: Invoices are due within 7 days of issue. Overdue amounts attract interest at 10% per annum. Contractor reserves the right to suspend works for non-payment.

4. SITE CONDITIONS: This quotation is based on site conditions as observed. Unforeseen conditions (rock, contamination, structural issues) will be subject to variation.

5. INSURANCE: The contractor holds current Public Liability Insurance ($20M), Workers Compensation and Contract Works insurance. Certificates available on request.

6. WARRANTY: Defects arising from workmanship within the warranty period will be rectified at no charge. Warranty does not cover damage from misuse, modifications or natural events.

7. DISPUTE RESOLUTION: Any disputes shall first be referred to mediation before legal proceedings. This agreement is governed by the laws of the applicable Australian State.

8. AUSTRALIAN CONSUMER LAW: Our services come with guarantees that cannot be excluded under the Australian Consumer Law. Nothing in this quotation limits those rights.

9. GST: All prices include GST unless otherwise stated. The contractor is registered for GST under the A New Tax System (Goods and Services Tax) Act 1999.

10. INTELLECTUAL PROPERTY: All designs, plans and documents prepared by the contractor remain the intellectual property of the contractor until full payment is received.`

const LOAD_BRAND = () => {
  try { return JSON.parse(localStorage.getItem(getUserStorageKey("quote_brand")) || "{}") } catch { return {} }
}

const au$ = (n: number) => "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const QuoteGenerator = ({ project, estimate }: QuoteGeneratorProps) => {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const logoInputRef = useRef<HTMLInputElement>(null)
  // Declared early so the useEffect dependency array can reference it without TDZ error
  const [absorbOverheads, setAbsorbOverheads] = useState(false)

  // Auto-load estimate lines whenever the dialog opens or pricing mode changes
  useEffect(() => {
    if (open) autoLoadEstimateLines()
  }, [open, absorbOverheads])

  // Brand
  const brand = LOAD_BRAND()
  const [logoDataUrl, setLogoDataUrl] = useState<string>(brand.logo || "")
  const [logoSize, setLogoSize] = useState<number>(brand.logoSize || 64)
  const [primaryColor, setPrimaryColor] = useState<string>(brand.primary || "#0f4c81")
  const [accentColor, setAccentColor] = useState<string>(brand.accent || "#f59e0b")
  const [companyTagline, setCompanyTagline] = useState<string>(brand.tagline || "")

  // Company
  const [companyName, setCompanyName] = useState(brand.companyName || "Your Company Pty Ltd")
  const [companyABN, setCompanyABN] = useState(brand.abn || "")
  const [companyACN, setCompanyACN] = useState(brand.acn || "")
  const [builderLicence, setBuilderLicence] = useState(brand.licence || "")
  const [companyPhone, setCompanyPhone] = useState(brand.phone || "")
  const [companyEmail, setCompanyEmail] = useState(brand.email || "")
  const [companyAddress, setCompanyAddress] = useState(brand.address || "")
  const [liabilityInsurance, setLiabilityInsurance] = useState(brand.liability || "$20,000,000")

  // Quote settings from Settings page
  const quoteSettings = (() => { try { return JSON.parse(localStorage.getItem(getUserStorageKey("quote_settings")) || "{}") } catch { return {} } })()
  const quotePrefix = quoteSettings.prefix || "QTE"
  const defaultValidity = quoteSettings.validityDays || "30"
  const pdfTemplate: "simple" | "detailed" = quoteSettings.pdfTemplate || "detailed"

  // Quote details
  const [quoteNumber, setQuoteNumber] = useState(`${quotePrefix}-${Date.now().toString().slice(-6)}`)
  const [validityDays, setValidityDays] = useState(defaultValidity)
  const [depositPct, setDepositPct] = useState("10")
  const [progressPct, setProgressPct] = useState("40")
  const [finalPct, setFinalPct] = useState("50")

  // Scope
  const [inclusions, setInclusions] = useState<string[]>(DEFAULT_INCLUSIONS)
  const [exclusions, setExclusions] = useState<string[]>(DEFAULT_EXCLUSIONS)
  const [scopeNotes, setScopeNotes] = useState("")
  const [terms, setTerms] = useState(DEFAULT_TERMS)

  // Quote lines (replaces single subtotal field)
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([])
  const [editingLineId, setEditingLineId] = useState<string | null>(null)

  // Build QuoteLine[] from localStorage estimate items for this project
  const buildLinesFromEstimate = (): QuoteLine[] => {
    const projects: any[] = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]")
    const proj = projects.find((p: any) => p.id === project?.id)
    const estimateItems: any[] = proj?.estimate_items || estimate?.estimate_items || []
    // Use current labour rates saved by EstimateTemplate (falls back to stored item rate)
    const cfgRates: Record<string, number> = proj?.estimate_config?.labourRates || {}
    const cfgDefaultRate: number = proj?.estimate_config?.defaultLabourRate || 65

    const lines: QuoteLine[] = []
    let itemsSubtotal = 0

    estimateItems.forEach((item: any) => {
      const qty = parseFloat(item.quantity) || 1
      const unitPrice = parseFloat(item.unit_price) || 0
      const labourHours = parseFloat(item.labour_hours) || 0
      const labourRate = cfgRates[item.trade] || cfgDefaultRate || parseFloat(item.labour_rate) || 65
      const matWaste = (item.material_wastage_pct ?? 5) / 100
      const labWaste = (item.labour_wastage_pct ?? 10) / 100
      const markup = (item.markup_pct ?? 0) / 100

      let matTotal = qty * unitPrice * (1 + matWaste)
      // Include confirmed related materials in this line's cost
      if (Array.isArray(item.relatedMaterials)) {
        item.relatedMaterials.forEach((rm: any) => {
          if (rm.confirmed) matTotal += (rm.quantity || 0) * (rm.unit_price || 0)
        })
      }

      const labTotal = labourHours * labourRate * (1 + labWaste)
      const lineTotal = (matTotal + labTotal) * (1 + markup)
      itemsSubtotal += lineTotal

      lines.push({
        id: item.id || crypto.randomUUID(),
        description: [item.scope_of_work, item.material_type].filter(Boolean).join(" — ") || item.trade || "Item",
        qty,
        unit: item.unit || "m²",
        unitPrice: Math.round((lineTotal / Math.max(qty, 1)) * 100) / 100,
        included: true,
        fromEstimate: true,
        trade: item.trade || "General",
      })
    })

    // Consumable lines
    const projConsumables: any[] = proj?.consumables || []
    let consumablesSubtotal = 0
    projConsumables.forEach((c: any) => {
      const lineTotal = (c.quantity || 0) * (c.unit_price || 0)
      if (lineTotal > 0) {
        consumablesSubtotal += lineTotal
        lines.push({
          id: c.id || crypto.randomUUID(),
          description: `Consumables — ${c.name}`,
          qty: parseFloat(c.quantity) || 1,
          unit: c.unit || "ea",
          unitPrice: Math.round((c.unit_price || 0) * 100) / 100,
          included: true,
          fromEstimate: true,
          trade: "Site Consumables",
        })
      }
    })

    const estimateTotals = proj?.estimate_totals
    const linesBaseTotal = itemsSubtotal + consumablesSubtotal

    if (absorbOverheads) {
      // ── Absorbed mode: scale every line price so sum = estimate_totals.taxable ──
      // Overheads/margin/supervision are baked into line prices — invisible to client
      if (estimateTotals?.taxable && linesBaseTotal > 0) {
        const scaleFactor = estimateTotals.taxable / linesBaseTotal
        return lines.map(l => ({
          ...l,
          unitPrice: Math.round(l.unitPrice * scaleFactor * 100) / 100,
        }))
      }
      return lines
    }

    // ── Default mode: show a separate "Overheads & Margin" line ──
    if (estimateTotals?.taxable) {
      const bridgeAmount = estimateTotals.taxable - linesBaseTotal
      if (bridgeAmount > 0.01) {
        lines.push({
          id: "overhead-margin-bridge",
          description: "Project Management, Site Overheads & Margin",
          qty: 1,
          unit: "item",
          unitPrice: Math.round(bridgeAmount * 100) / 100,
          included: true,
          fromEstimate: true,
          trade: "Project Costs",
        })
      }
    }

    return lines
  }

  // Silent auto-load on dialog open — preserve existing custom lines
  const autoLoadEstimateLines = () => {
    const imported = buildLinesFromEstimate()
    setQuoteLines(prev => {
      const custom = prev.filter(l => !l.fromEstimate)
      return [...imported, ...custom]
    })
  }

  // Manual refresh triggered by the user — shows toast feedback
  const refreshEstimateLines = () => {
    const imported = buildLinesFromEstimate()
    if (imported.length === 0) {
      toast.info("No estimate items yet. Add items in the Estimate tab first.")
      return
    }
    setQuoteLines(prev => {
      const custom = prev.filter(l => !l.fromEstimate)
      return [...imported, ...custom]
    })
    toast.success(`${imported.length} line${imported.length !== 1 ? "s" : ""} refreshed from Estimate`)
  }

  const addBlankLine = () => {
    const newLine: QuoteLine = {
      id: crypto.randomUUID(),
      description: "Custom line item",
      qty: 1,
      unit: "item",
      unitPrice: 0,
      included: true,
      fromEstimate: false,
      isEditing: true,
    }
    setQuoteLines(prev => [...prev, newLine])
    setEditingLineId(newLine.id)
  }

  const updateLine = (id: string, patch: Partial<QuoteLine>) => {
    setQuoteLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  const removeLine = (id: string) => {
    setQuoteLines(prev => prev.filter(l => l.id !== id))
  }

  const toggleLine = (id: string) => {
    setQuoteLines(prev => prev.map(l => l.id === id ? { ...l, included: !l.included } : l))
  }

  const toggleAll = (included: boolean) => {
    setQuoteLines(prev => prev.map(l => ({ ...l, included })))
  }

  // Totals derived from included lines
  const includedLines = quoteLines.filter(l => l.included)
  const subtotalNum = includedLines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
  const gstAmount = subtotalNum * 0.1
  const totalIncGst = subtotalNum + gstAmount
  const depositAmount = totalIncGst * (parseFloat(depositPct) / 100)
  const progressAmount = totalIncGst * (parseFloat(progressPct) / 100)
  const finalAmount = totalIncGst * (parseFloat(finalPct) / 100)

  const today = new Date()
  const validUntil = new Date(today.getTime() + parseInt(validityDays) * 86400000)
  const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })

  const addItem = (list: string[], fn: (v: string[]) => void) => fn([...list, ""])
  const updateItem = (list: string[], fn: (v: string[]) => void, i: number, v: string) => { const n = [...list]; n[i] = v; fn(n) }
  const removeItem = (list: string[], fn: (v: string[]) => void, i: number) => fn(list.filter((_, idx) => idx !== i))

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return }
    const reader = new FileReader()
    reader.onload = ev => setLogoDataUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const saveBrand = () => {
    const data = { logo: logoDataUrl, logoSize, primary: primaryColor, accent: accentColor, tagline: companyTagline, companyName, abn: companyABN, acn: companyACN, licence: builderLicence, phone: companyPhone, email: companyEmail, address: companyAddress, liability: liabilityInsurance }
    localStorage.setItem(getUserStorageKey("quote_brand"), JSON.stringify(data))
    toast.success("Branding saved for all future quotes")
  }

  const handlePrint = () => {
    const el = document.getElementById('printable-quote')
    if (!el) { toast.error("Content not found"); return }
    // Clone and force full-width inline styles so Tailwind's max-w-[780px] / mx-auto don't create side margins
    const clone = el.cloneNode(true) as HTMLElement
    clone.style.cssText = 'width:100%!important;max-width:none!important;margin:0!important;padding:0!important;box-shadow:none!important;border-radius:0!important;'
    const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((l) => `<link rel="stylesheet" href="${(l as HTMLLinkElement).href}">`)
      .join('\n')
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { toast.error("Pop-ups are blocked. Allow pop-ups for this site and try again."); return }
    const projectName = project?.name || 'Quote'
    const dateStr = today.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")
    const docTitle = `${quoteNumber} - ${companyName} - ${projectName} - ${dateStr}`
    const safeTitle = docTitle.replace(/'/g, "\\'")
    const html = `<!DOCTYPE html>
<html style="color-scheme:light"><head>
<meta charset="utf-8">
<title>${docTitle}</title>
${cssLinks}
<style>
@page{size:A4;margin:0}
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;word-wrap:break-word;overflow-wrap:break-word}
html{color-scheme:light!important}
body{margin:0!important;padding:0!important;width:210mm!important;background:#fff!important;color-scheme:light!important}
#printable-quote{width:100%!important;max-width:none!important;padding:0!important;margin:0!important;box-shadow:none!important;border-radius:0!important}
#printable-quote img{max-width:100%!important;height:auto}
#printable-quote table{width:100%!important;table-layout:fixed!important}
#printable-quote td,#printable-quote th{word-break:break-word!important}
#printable-quote section{break-inside:avoid}
#printable-quote tr{break-inside:avoid}
</style>
</head><body>
${clone.outerHTML}
<script>
(function(){
  var done=false;
  function doPrint(){
    if(done)return;
    done=true;
    document.title='${safeTitle}';
    window.print();
    window.addEventListener('afterprint',function(){window.close();},{once:true});
  }
  if(document.readyState==='complete'){
    setTimeout(doPrint,600);
  } else {
    window.addEventListener('load',function(){setTimeout(doPrint,600);},{once:true});
  }
})();
` + `</script>
</body></html>`
    win.document.write(html)
    win.document.close()
    toast.success("Print window opened. Choose 'Save as PDF'.")
  }

  const handleSaveToLibrary = () => {
    if (!project?.id) return
    if (includedLines.length === 0) {
      toast.error("Add at least one line before saving to library")
      return
    }
    saveQuoteToLibrary(project.id, {
      name: `Quote ${quoteNumber}`,
      quoteNumber,
      totalIncGST: totalIncGst,
      subtotal: subtotalNum,
      itemCount: includedLines.length,
      lines: quoteLines,
      brand: {},
      companyName,
      companyABN,
      companyPhone,
      companyEmail,
      companyAddress,
      builderLicence,
      liabilityInsurance,
      primaryColor,
      accentColor,
      logoDataUrl,
      inclusions,
      exclusions,
      terms,
      scopeNotes,
      depositPct,
      progressPct,
      finalPct,
      validityDays,
      projectName: project?.name || "",
      clientName: project?.client_name || "",
      siteAddress: project?.site_address || "",
    })
    toast.success(`Quote saved to Document Library (${au$(totalIncGst)})`)
  }

  // Version history
  const versionKey = project?.id ? getUserStorageKey(`quote_versions_${project.id}`) : null
  const [versions, setVersions] = useState<Array<{
    id: string; versionNumber: number; savedAt: string; quoteNumber: string; total: number; lines: QuoteLine[]
  }>>(() => {
    if (!versionKey) return []
    try { return JSON.parse(localStorage.getItem(versionKey) || '[]') } catch { return [] }
  })

  // ── Supabase: load versions on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!project?.id) return
    let cancelled = false
    async function loadCloudVersions() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || cancelled) return
        const { data } = await supabase
          .from('quote_versions')
          .select('id, version_number, saved_at, quote_number, total, lines')
          .eq('project_id', project.id)
          .eq('user_id', session.user.id)
          .order('version_number', { ascending: true })
        if (cancelled || !data || data.length === 0) return
        const cloud = data.map((r: any) => ({
          id: r.id, versionNumber: r.version_number, savedAt: r.saved_at,
          quoteNumber: r.quote_number, total: Number(r.total), lines: r.lines ?? [],
        }))
        setVersions(cloud)
        if (versionKey) localStorage.setItem(versionKey, JSON.stringify(cloud))
      } catch {}
    }
    loadCloudVersions()
    return () => { cancelled = true }
  }, [project?.id])

  const saveVersion = () => {
    if (!versionKey) return
    const next = {
      id: crypto.randomUUID(),
      versionNumber: versions.length + 1,
      savedAt: new Date().toISOString(),
      quoteNumber,
      total: totalIncGst,
      lines: quoteLines,
    }
    const updated = [...versions, next]
    localStorage.setItem(versionKey, JSON.stringify(updated))
    setVersions(updated)
    toast.success(`Version ${next.versionNumber} saved (${au$(totalIncGst)})`)
    // Cloud sync
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || !project?.id) return
      supabase.from('quote_versions').insert({
        id: next.id, project_id: project.id, user_id: session.user.id,
        version_number: next.versionNumber, saved_at: next.savedAt,
        quote_number: next.quoteNumber, total: next.total, lines: next.lines as any,
      }).then(({ error }) => { if (error) console.warn('[versions] Cloud save failed:', error.message) })
    })
  }

  const restoreVersion = (v: typeof versions[0]) => {
    setQuoteLines(v.lines)
    setQuoteNumber(v.quoteNumber)
    setActiveTab('lines')
    toast.success(`Version ${v.versionNumber} restored`)
  }

  const deleteVersion = (id: string) => {
    if (!versionKey) return
    const updated = versions.filter(v => v.id !== id)
    localStorage.setItem(versionKey, JSON.stringify(updated))
    setVersions(updated)
    supabase.from('quote_versions').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn('[versions] Cloud delete failed:', error.message)
    })
  }

  const headerGradient = `linear-gradient(135deg, ${primaryColor}ee 0%, ${primaryColor} 60%, ${primaryColor}cc 100%)`

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        <FileText className="mr-2 h-4 w-4" />
        Generate Quote
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-xl">Quote Generator</DialogTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={saveBrand} size="sm">Save Branding</Button>
                <Button variant="outline" size="sm" onClick={saveVersion} disabled={quoteLines.length === 0}>
                  <History className="mr-1.5 h-3.5 w-3.5" />Save Version
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveToLibrary} disabled={includedLines.length === 0}>
                  <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />Save to Library
                </Button>
                <Button onClick={handlePrint} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Printer className="mr-2 h-4 w-4" />Print / Save PDF
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* Left panel */}
            <div className="w-[360px] flex-shrink-0 border-r overflow-y-auto bg-muted/30 p-4 no-print">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid grid-cols-6 w-full">
                  <TabsTrigger value="brand" className="text-xs">Brand</TabsTrigger>
                  <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                  <TabsTrigger value="lines" className="text-xs">Lines</TabsTrigger>
                  <TabsTrigger value="scope" className="text-xs">Scope</TabsTrigger>
                  <TabsTrigger value="pricing" className="text-xs">Price</TabsTrigger>
                  <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
                </TabsList>

                {/* Brand tab */}
                <TabsContent value="brand" className="space-y-3 mt-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Company Logo</p>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => logoInputRef.current?.click()}>
                    {logoDataUrl
                      ? <img src={logoDataUrl} alt="Logo" className="max-h-16 mx-auto object-contain" />
                      : <><Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">Click to upload logo (PNG/JPG, max 2MB)</p></>
                    }
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
                  {logoDataUrl && (
                    <>
                      <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => setLogoDataUrl("")}>Remove Logo</Button>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs">Logo Size</Label>
                          <span className="text-xs text-muted-foreground font-mono">{logoSize}px</span>
                        </div>
                        <input
                          type="range"
                          min={32}
                          max={160}
                          value={logoSize}
                          onChange={e => setLogoSize(Number(e.target.value))}
                          className="w-full h-2 accent-primary cursor-pointer"
                        />
                      </div>
                    </>
                  )}

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Colour Scheme</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Primary (header)</Label>
                      <div className="flex gap-2 items-center mt-1">
                        <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-8 w-10 rounded cursor-pointer border" />
                        <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-8 text-xs font-mono" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Accent (highlights)</Label>
                      <div className="flex gap-2 items-center mt-1">
                        <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="h-8 w-10 rounded cursor-pointer border" />
                        <Input value={accentColor} onChange={e => setAccentColor(e.target.value)} className="h-8 text-xs font-mono" />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Company Tagline</p>
                  <Input value={companyTagline} onChange={e => setCompanyTagline(e.target.value)} placeholder="Building Excellence Since 2010" className="h-8 text-sm" />

                  <Button onClick={saveBrand} className="w-full mt-2" size="sm">Save Branding</Button>
                  <p className="text-xs text-muted-foreground text-center">Branding is saved and applied to all future quotes & tenders</p>
                </TabsContent>

                {/* Details tab */}
                <TabsContent value="details" className="space-y-3 mt-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Company</p>
                  <div className="space-y-2">
                    {[
                      ["Company Name", companyName, setCompanyName, "Your Company Pty Ltd"],
                      ["ABN", companyABN, setCompanyABN, "12 345 678 901"],
                      ["ACN", companyACN, setCompanyACN, "123 456 789"],
                      ["Builder Licence", builderLicence, setBuilderLicence, "BLD123456"],
                      ["Public Liability", liabilityInsurance, setLiabilityInsurance, "$20,000,000"],
                      ["Phone", companyPhone, setCompanyPhone, "0400 000 000"],
                      ["Email", companyEmail, setCompanyEmail, "info@company.com.au"],
                      ["Address", companyAddress, setCompanyAddress, "123 Builder St, Sydney NSW"],
                    ].map(([label, val, setter, ph]: any) => (
                      <div key={label}>
                        <Label className="text-xs">{label}</Label>
                        <Input value={val} onChange={e => setter(e.target.value)} placeholder={ph} className="h-8 text-sm" />
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Quote</p>
                  <div className="space-y-2">
                    <div><Label className="text-xs">Quote Number</Label><Input value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">Valid for (days)</Label><Input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} className="h-8 text-sm" /></div>
                  </div>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Payment Schedule</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[["Deposit %", depositPct, setDepositPct], ["Progress %", progressPct, setProgressPct], ["Final %", finalPct, setFinalPct]].map(([l, v, s]: any) => (
                      <div key={l}><Label className="text-xs">{l}</Label><Input type="number" value={v} onChange={e => s(e.target.value)} className="h-8 text-sm" /></div>
                    ))}
                  </div>
                  {parseInt(depositPct) + parseInt(progressPct) + parseInt(finalPct) !== 100 &&
                    <p className="text-xs text-destructive">Must total 100%</p>}
                </TabsContent>

                {/* Lines tab */}
                <TabsContent value="lines" className="space-y-3 mt-0">

                  {/* Pricing mode toggle */}
                  <div
                    className={`rounded-lg border p-3 cursor-pointer transition-colors select-none ${absorbOverheads ? "border-primary/60 bg-primary/5" : "border-border bg-muted/20"}`}
                    onClick={() => setAbsorbOverheads(v => !v)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {absorbOverheads ? "All-inclusive pricing" : "Itemised pricing"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {absorbOverheads
                            ? "Overheads & margin absorbed into each line price. Client sees clean trade rates."
                            : "Overheads & margin shown as a separate line for a transparent cost breakdown."}
                        </p>
                      </div>
                      {/* Toggle pill */}
                      <div className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${absorbOverheads ? "bg-primary" : "bg-muted-foreground/30"}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${absorbOverheads ? "translate-x-5" : "translate-x-0.5"}`} />
                      </div>
                    </div>
                  </div>

                  {/* Action buttons — always visible */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={refreshEstimateLines}
                      className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-colors py-3 px-2 text-center"
                    >
                      <RefreshCw className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-primary leading-tight">Auto-fill from<br/>Estimate</span>
                    </button>
                    <button
                      onClick={addBlankLine}
                      className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-accent/60 bg-accent/5 hover:bg-accent/10 hover:border-accent/80 transition-colors py-3 px-2 text-center"
                    >
                      <Plus className="h-4 w-4 text-accent-foreground" />
                      <span className="text-xs font-semibold text-accent-foreground leading-tight">+ Add Manual<br/>Line</span>
                    </button>
                  </div>

                  {quoteLines.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No lines yet. Use the buttons above to get started.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{includedLines.length}/{quoteLines.length} included</span>
                        <span>·</span>
                        <button className="underline hover:text-foreground" onClick={() => toggleAll(true)}>All on</button>
                        <span>·</span>
                        <button className="underline hover:text-foreground" onClick={() => toggleAll(false)}>All off</button>
                      </div>

                      <div className="space-y-3">
                        {(() => {
                          const tradeOrder: string[] = []
                          const tradeGroups: Record<string, QuoteLine[]> = {}
                          quoteLines.forEach(line => {
                            const t = line.trade || (line.fromEstimate ? "General" : "Manual")
                            if (!tradeGroups[t]) { tradeGroups[t] = []; tradeOrder.push(t) }
                            tradeGroups[t].push(line)
                          })
                          return tradeOrder.map(trade => (
                            <div key={`grp-${trade}`}>
                              <div className="px-2 py-1 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                {trade}
                              </div>
                              <div className="space-y-1.5">
                                {tradeGroups[trade].map(line => (
                          <div key={line.id} className={`rounded-lg border text-xs transition-colors ${line.included ? "bg-background" : "bg-muted/30 opacity-55"}`}>
                            {editingLineId === line.id ? (
                              /* ── EDIT MODE ── */
                              <div className="p-2.5 space-y-2">
                                <Input
                                  value={line.description}
                                  onChange={e => updateLine(line.id, { description: e.target.value })}
                                  className="h-7 text-xs font-medium"
                                  placeholder="Line description"
                                  autoFocus
                                />
                                <div className="grid grid-cols-4 gap-1.5">
                                  <div className="col-span-1">
                                    <div className="text-[10px] text-muted-foreground mb-0.5">Qty</div>
                                    <Input
                                      type="number"
                                      value={line.qty}
                                      onChange={e => updateLine(line.id, { qty: parseFloat(e.target.value) || 0 })}
                                      className="h-7 text-xs text-right"
                                    />
                                  </div>
                                  <div className="col-span-1">
                                    <div className="text-[10px] text-muted-foreground mb-0.5">Unit</div>
                                    <Input
                                      value={line.unit}
                                      onChange={e => updateLine(line.id, { unit: e.target.value })}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div className="col-span-2">
                                    <div className="text-[10px] text-muted-foreground mb-0.5">Unit Price $</div>
                                    <Input
                                      type="number"
                                      value={line.unitPrice}
                                      onChange={e => updateLine(line.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                                      className="h-7 text-xs text-right font-mono"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-0.5">
                                  <span className="text-muted-foreground">Total: <strong className="text-foreground font-mono">{au$(line.qty * line.unitPrice)}</strong></span>
                                  <Button size="sm" className="h-6 text-xs px-3" onClick={() => setEditingLineId(null)}>
                                    <Check className="h-3 w-3 mr-1" />Done
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              /* ── VIEW MODE ── */
                              <div className="flex items-center gap-2 px-2.5 py-2">
                                <Checkbox
                                  checked={line.included}
                                  onCheckedChange={() => toggleLine(line.id)}
                                  className="flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate leading-tight">{line.description}</div>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground text-[11px] font-mono flex-wrap">
                                    <span>{Number(line.qty).toFixed(1)} {line.unit}</span>
                                    <span>×</span>
                                    <span>{au$(line.unitPrice)}</span>
                                    <span>=</span>
                                    <span className="font-semibold text-foreground">{au$(line.qty * line.unitPrice)}</span>
                                    {line.fromEstimate && <span className="ml-1 text-[9px] bg-blue-50 text-blue-500 border border-blue-100 rounded px-1 font-sans">estimate</span>}
                                  </div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <button onClick={() => setEditingLineId(line.id)} className="text-muted-foreground hover:text-foreground p-0.5" title="Edit">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button onClick={() => removeLine(line.id)} className="text-muted-foreground hover:text-destructive p-0.5" title="Remove">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                                ))}
                              </div>
                            </div>
                          ))
                        })()}
                      </div>

                      <div className="pt-2 border-t space-y-1 text-xs font-mono">
                        <div className="flex justify-between text-muted-foreground"><span>Subtotal (ex GST)</span><span>{au$(subtotalNum)}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>GST (10%)</span><span>{au$(gstAmount)}</span></div>
                        <div className="flex justify-between font-bold text-sm border-t pt-1"><span>TOTAL (inc GST)</span><span>{au$(totalIncGst)}</span></div>
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* Scope tab */}
                <TabsContent value="scope" className="space-y-3 mt-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Inclusions</p>
                  {inclusions.map((item, i) => (
                    <div key={i} className="flex gap-1">
                      <Input value={item} onChange={e => updateItem(inclusions, setInclusions, i, e.target.value)} className="h-8 text-xs flex-1" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeItem(inclusions, setInclusions, i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => addItem(inclusions, setInclusions)}><Plus className="h-3 w-3 mr-1" />Add</Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Exclusions</p>
                  {exclusions.map((item, i) => (
                    <div key={i} className="flex gap-1">
                      <Input value={item} onChange={e => updateItem(exclusions, setExclusions, i, e.target.value)} className="h-8 text-xs flex-1" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeItem(exclusions, setExclusions, i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => addItem(exclusions, setExclusions)}><Plus className="h-3 w-3 mr-1" />Add</Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Additional Notes</p>
                  <Textarea value={scopeNotes} onChange={e => setScopeNotes(e.target.value)} placeholder="Any additional scope notes..." className="text-xs min-h-[60px]" />

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Terms & Conditions</p>
                  <Textarea value={terms} onChange={e => setTerms(e.target.value)} className="text-xs min-h-[120px]" />
                </TabsContent>

                {/* Pricing tab */}
                <TabsContent value="pricing" className="space-y-3 mt-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Summary</p>
                  {quoteLines.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Add lines in the Lines tab to calculate totals.</p>
                  ) : (
                    <div className="bg-background rounded-lg p-3 space-y-1 text-sm font-mono border">
                      <div className="flex justify-between text-muted-foreground"><span>Lines ({includedLines.length})</span><span>{au$(subtotalNum)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>GST (10%)</span><span>{au$(gstAmount)}</span></div>
                      <div className="flex justify-between font-bold border-t pt-1"><span>TOTAL (inc GST)</span><span>{au$(totalIncGst)}</span></div>
                    </div>
                  )}
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2">Payment schedule</p>
                    <div className="space-y-1.5 text-xs font-mono">
                      {[['Deposit', depositPct, depositAmount], ['Progress', progressPct, progressAmount], ['Final', finalPct, finalAmount]].map(([label, pct, amt]) => (
                        <div key={label as string} className="flex justify-between items-center bg-background border rounded p-2">
                          <span className="font-sans text-muted-foreground">{label} ({pct}%)</span>
                          <span className="font-bold">{au$(amt as number)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* History tab */}
                <TabsContent value="history" className="space-y-3 mt-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Version History</p>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={saveVersion} disabled={quoteLines.length === 0}>
                      <History className="h-3 w-3 mr-1" />Save Now
                    </Button>
                  </div>
                  {versions.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">No versions saved yet. Click "Save Version" to snapshot this quote.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[...versions].reverse().map(v => (
                        <div key={v.id} className="border border-border rounded-lg p-3 bg-background">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold">Version {v.versionNumber}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {new Date(v.savedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div className="text-xs text-muted-foreground">{v.quoteNumber} · {v.lines.length} lines</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-sm">{au$(v.total)}</div>
                              <div className="flex gap-1 mt-1.5">
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => restoreVersion(v)}>
                                  <RotateCcw className="h-2.5 w-2.5 mr-0.5" />Restore
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteVersion(v.id)}>
                                  <Trash2 className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Right panel — live preview */}
            <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
              <div className="max-w-[780px] mx-auto bg-white shadow-xl" id="printable-quote">

                {/* Header */}
                <div style={{ background: headerGradient }} className="p-10 text-white">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      {logoDataUrl && <img src={logoDataUrl} alt="Logo" style={{ height: logoSize + 'px' }} className="w-auto object-contain bg-white/10 rounded-lg p-2" />}
                      <div>
                        <div className="text-xs uppercase tracking-widest mb-1" style={{ color: accentColor }}>Quotation</div>
                        <h1 className="text-2xl font-bold">{companyName}</h1>
                        {companyTagline && <div className="text-white/70 text-sm italic mt-0.5">{companyTagline}</div>}
                        {companyABN && <div className="text-white/60 text-xs mt-1">ABN: {companyABN}{companyACN ? ` · ACN: ${companyACN}` : ""}</div>}
                        {builderLicence && <div className="text-white/60 text-xs">Licence No: {builderLicence}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold tracking-tight" style={{ color: accentColor }}>{quoteNumber}</div>
                      <div className="text-sm text-white/70 mt-1">Issued: {fmt(today)}</div>
                      <div className="text-sm text-white/70">Valid until: {fmt(validUntil)}</div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/20 grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: accentColor }}>Project</div>
                      <div className="text-xl font-semibold">{project?.name || "—"}</div>
                      {(project?.site_address || project?.address) &&
                        <div className="text-white/70 text-sm mt-1">{project?.site_address || project?.address}</div>}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: accentColor }}>Prepared For</div>
                      <div className="text-xl font-semibold">{project?.client_name || "Client"}</div>
                      <div className="text-white/70 text-sm mt-1 space-y-0.5">
                        {companyPhone && <div>{companyPhone}</div>}
                        {companyEmail && <div>{companyEmail}</div>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Accent bar */}
                <div className="h-1.5" style={{ background: `linear-gradient(to right, ${accentColor}, ${primaryColor})` }} />

                <div className="p-8 space-y-8">

                  {/* Price highlight */}
                  {subtotalNum > 0 && (
                    <div className="rounded-xl border-2 p-6 flex items-center justify-between" style={{ borderColor: primaryColor + "30", background: primaryColor + "08" }}>
                      <div>
                        <div className="text-sm font-medium uppercase tracking-wide mb-1" style={{ color: primaryColor }}>Total Quotation Value</div>
                        <div className="text-4xl font-bold font-mono" style={{ color: primaryColor }}>{au$(totalIncGst)}</div>
                        <div className="text-sm mt-1" style={{ color: primaryColor + "99" }}>Inclusive of GST</div>
                      </div>
                      <div className="text-right text-sm space-y-1" style={{ color: primaryColor + "bb" }}>
                        <div>Subtotal: {au$(subtotalNum)}</div>
                        <div>GST (10%): {au$(gstAmount)}</div>
                        <div className="text-xs text-gray-400 mt-2 max-w-[160px]">
                          Contractor is GST registered under A New Tax System (GST) Act 1999
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Line items breakdown */}
                  {includedLines.length > 0 && (
                    <section>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-1 h-6 rounded-full" style={{ background: primaryColor }} />
                        <h2 className="text-lg font-bold text-gray-900">Quotation Breakdown</h2>
                      </div>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr style={{ background: primaryColor + "12" }}>
                            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b" style={{ borderColor: primaryColor + "25" }}>Description</th>
                            <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b w-16" style={{ borderColor: primaryColor + "25" }}>Qty</th>
                            <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b w-16" style={{ borderColor: primaryColor + "25" }}>Unit</th>
                            <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b w-24" style={{ borderColor: primaryColor + "25" }}>Rate</th>
                            <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b w-28" style={{ borderColor: primaryColor + "25" }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const tradeOrder: string[] = []
                            const tradeGroups: Record<string, typeof includedLines> = {}
                            includedLines.forEach(line => {
                              const t = line.trade || "General"
                              if (!tradeGroups[t]) { tradeGroups[t] = []; tradeOrder.push(t) }
                              tradeGroups[t].push(line)
                            })
                            return tradeOrder.map((trade, sectionIdx) => {
                              const sectionLines = tradeGroups[trade]
                              const sectionSubtotal = sectionLines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
                              return (
                                <>
                                  <tr key={`sec-${trade}`}>
                                    <td colSpan={5} className="py-2 px-3 text-xs font-bold uppercase tracking-wide" style={{ background: primaryColor + "18", color: primaryColor }}>
                                      {trade}
                                    </td>
                                  </tr>
                                  {sectionLines.map((line, lineIdx) => (
                                    <tr key={line.id} className={lineIdx % 2 === 1 ? "bg-gray-50/60" : ""}>
                                      <td className="py-2.5 px-3 text-gray-800 border-b border-gray-100">
                                        <span className="font-mono text-[10px] text-gray-400 mr-2">{sectionIdx + 1}.{String(lineIdx + 1).padStart(2, "0")}</span>
                                        {line.description}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-gray-600 border-b border-gray-100 font-mono text-xs">{Number(line.qty).toFixed(1)}</td>
                                      <td className="py-2.5 px-3 text-right text-gray-500 border-b border-gray-100 text-xs">{line.unit}</td>
                                      <td className="py-2.5 px-3 text-right text-gray-600 border-b border-gray-100 font-mono text-xs">{au$(line.unitPrice)}</td>
                                      <td className="py-2.5 px-3 text-right font-semibold border-b border-gray-100 font-mono text-xs" style={{ color: primaryColor }}>{au$(line.qty * line.unitPrice)}</td>
                                    </tr>
                                  ))}
                                  <tr key={`sub-${trade}`}>
                                    <td colSpan={4} className="py-1.5 px-3 text-right text-xs font-medium text-gray-400 italic">{trade} subtotal</td>
                                    <td className="py-1.5 px-3 text-right font-mono text-xs font-semibold" style={{ color: primaryColor + "cc" }}>{au$(sectionSubtotal)}</td>
                                  </tr>
                                </>
                              )
                            })
                          })()}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={4} className="pt-3 pb-1 px-3 text-right text-sm text-gray-500">Subtotal (ex GST)</td>
                            <td className="pt-3 pb-1 px-3 text-right font-mono text-sm text-gray-700">{au$(subtotalNum)}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="pb-1 px-3 text-right text-sm text-gray-500">GST (10%)</td>
                            <td className="pb-1 px-3 text-right font-mono text-sm text-gray-700">{au$(gstAmount)}</td>
                          </tr>
                          <tr style={{ background: primaryColor + "10" }}>
                            <td colSpan={4} className="py-2.5 px-3 text-right font-bold text-gray-900">TOTAL (inc GST)</td>
                            <td className="py-2.5 px-3 text-right font-bold font-mono text-base" style={{ color: primaryColor }}>{au$(totalIncGst)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </section>
                  )}

                  {/* Scope */}
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 rounded-full" style={{ background: primaryColor }} />
                      <h2 className="text-lg font-bold text-gray-900">Scope of Works</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">✓ Inclusions</h3>
                        <ul className="space-y-1.5">
                          {inclusions.filter(Boolean).map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                              <ChevronRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-green-500" />{item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">✕ Exclusions</h3>
                        <ul className="space-y-1.5">
                          {exclusions.filter(Boolean).map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                              <X className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-red-400" />{item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {scopeNotes && <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-gray-700"><strong className="text-amber-700">Notes: </strong>{scopeNotes}</div>}
                  </section>

                  {/* Payment schedule — hidden on simple template */}
                  {pdfTemplate === "detailed" && subtotalNum > 0 && (
                    <section>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-1 h-6 rounded-full" style={{ background: primaryColor }} />
                        <h2 className="text-lg font-bold text-gray-900">Payment Schedule</h2>
                      </div>
                      <div className="payment-cards grid grid-cols-3 gap-4">
                        {[
                          { label: "Deposit", pct: depositPct, amount: depositAmount, note: "Due upon acceptance" },
                          { label: "Progress Payment", pct: progressPct, amount: progressAmount, note: "Due at practical completion stage" },
                          { label: "Final Payment", pct: finalPct, amount: finalAmount, note: "Due upon project handover" },
                        ].map(({ label, pct, amount, note }) => (
                          <div key={label} className="rounded-xl border p-4" style={{ borderColor: primaryColor + "30", background: primaryColor + "06" }}>
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</div>
                            <div className="text-2xl font-bold font-mono" style={{ color: primaryColor }}>{au$(amount)}</div>
                            <div className="text-xs font-medium text-gray-500">{pct}% of contract</div>
                            <div className="text-xs text-gray-400 mt-2">{note}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Insurance & Compliance */}
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 rounded-full" style={{ background: primaryColor }} />
                      <h2 className="text-lg font-bold text-gray-900">Insurance & Compliance</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Public Liability", value: liabilityInsurance },
                        { label: "Workers Compensation", value: "As required by law" },
                        { label: "Contract Works", value: "Full project value" },
                      ].map(({ label, value }) => (
                        <div key={label} className="p-3 bg-gray-50 rounded-lg border text-center">
                          <div className="text-xs text-gray-500 mb-1">{label}</div>
                          <div className="text-sm font-semibold text-gray-800">{value}</div>
                        </div>
                      ))}
                    </div>
                    {builderLicence && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-lg flex items-center gap-2 text-sm text-green-800">
                        <span>✓</span>
                        <span>Licensed builder · Licence No. <strong>{builderLicence}</strong>. All works comply with National Construction Code (NCC) and applicable Australian Standards.</span>
                      </div>
                    )}
                  </section>

                  {/* Terms — hidden on simple template */}
                  {pdfTemplate === "detailed" && <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 rounded-full" style={{ background: primaryColor }} />
                      <h2 className="text-lg font-bold text-gray-900">Terms & Conditions</h2>
                    </div>
                    <ol className="list-none p-0 m-0 space-y-2">
                      {terms.split(/\n(?=\d+\.)/).filter(Boolean).map((clause, i) => {
                        const match = clause.match(/^(\d+)\.\s*([^:]+):\s*([\s\S]+)/)
                        if (match) {
                          return (
                            <li key={i} className="flex gap-3 text-xs text-gray-600 leading-relaxed">
                              <span className="flex-shrink-0 font-bold text-gray-800 w-5">{match[1]}.</span>
                              <span><span className="font-semibold text-gray-800">{match[2]}:</span> {match[3].trim()}</span>
                            </li>
                          )
                        }
                        return <li key={i} className="text-xs text-gray-600 leading-relaxed">{clause.trim()}</li>
                      })}
                    </ol>
                  </section>}

                  {/* Acceptance */}
                  <section className="acceptance-section border-2 rounded-xl p-6" style={{ borderColor: accentColor + "60" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-1 h-6 rounded-full" style={{ background: accentColor }} />
                      <h2 className="text-lg font-bold text-gray-900">Acceptance</h2>
                    </div>
                    <p className="text-sm text-gray-500 mb-6">By signing below, both parties confirm acceptance of this quotation and the terms stated herein.</p>
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-6">Contractor</div>
                        <div className="border-b-2 border-gray-300 mb-2 h-10" />
                        <div className="text-xs text-gray-600 font-medium">{companyName}</div>
                        {builderLicence && <div className="text-xs text-gray-400">Licence: {builderLicence}</div>}
                        <div className="text-xs text-gray-400 mt-3">Date: ____________________</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-6">Client</div>
                        <div className="border-b-2 border-gray-300 mb-2 h-10" />
                        <div className="text-xs text-gray-600 font-medium">{project?.client_name || "Client Name"}</div>
                        <div className="text-xs text-gray-400">Print name: ____________________</div>
                        <div className="text-xs text-gray-400 mt-1">Date: ____________________</div>
                      </div>
                    </div>
                  </section>

                  {/* Footer */}
                  <div className="text-center text-xs text-gray-400 pt-4 border-t">
                    <div className="font-medium text-gray-500">{companyName}</div>
                    {companyAddress && <div>{companyAddress}</div>}
                    <div className="flex justify-center gap-4 mt-1">
                      {companyPhone && <span>{companyPhone}</span>}
                      {companyEmail && <span>{companyEmail}</span>}
                    </div>
                    <div className="mt-1 space-x-3">
                      {companyABN && <span>ABN: {companyABN}</span>}
                      {companyACN && <span>ACN: {companyACN}</span>}
                    </div>
                    <div className="mt-2 text-gray-300">Generated with Metricore · {fmt(today)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  )
}
