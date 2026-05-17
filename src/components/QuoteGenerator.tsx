import { useState, useRef, useEffect } from "react"
import { getUserStorageKey } from "@/lib/localAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { FileText, Printer, X, Plus, Trash2, ChevronRight, Upload, RefreshCw, GripVertical, Pencil, Check } from "lucide-react"
import { toast } from "sonner"

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
  try { return JSON.parse(localStorage.getItem("quote_brand") || "{}") } catch { return {} }
}

const au$ = (n: number) => "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const QuoteGenerator = ({ project, estimate }: QuoteGeneratorProps) => {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Auto-load estimate lines whenever the dialog opens
  useEffect(() => {
    if (open) autoLoadEstimateLines()
  }, [open])

  // Brand
  const brand = LOAD_BRAND()
  const [logoDataUrl, setLogoDataUrl] = useState<string>(brand.logo || "")
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

  // Quote details
  const [quoteNumber, setQuoteNumber] = useState(`QTE-${Date.now().toString().slice(-6)}`)
  const [validityDays, setValidityDays] = useState("30")
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
    return estimateItems.map((item: any) => {
      const qty = parseFloat(item.quantity) || 1
      const unitPrice = parseFloat(item.unit_price) || 0
      const labourHours = parseFloat(item.labour_hours) || 0
      const labourRate = parseFloat(item.labour_rate) || 65
      const matWaste = (item.material_wastage_pct ?? 5) / 100
      const labWaste = (item.labour_wastage_pct ?? 10) / 100
      const markup = (item.markup_pct ?? 0) / 100
      const matTotal = qty * unitPrice * (1 + matWaste)
      const labTotal = labourHours * labourRate * (1 + labWaste)
      const lineTotal = (matTotal + labTotal) * (1 + markup)
      const lineUnitPrice = lineTotal / Math.max(qty, 1)
      return {
        id: item.id || crypto.randomUUID(),
        description: [item.scope_of_work, item.material_type].filter(Boolean).join(" — ") || item.trade || "Item",
        qty,
        unit: item.unit || "m²",
        unitPrice: Math.round(lineUnitPrice * 100) / 100,
        included: true,
        fromEstimate: true,
      }
    })
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
      toast.info("No estimate items found — add items in the Estimate tab first")
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
    const data = { logo: logoDataUrl, primary: primaryColor, accent: accentColor, tagline: companyTagline, companyName, abn: companyABN, acn: companyACN, licence: builderLicence, phone: companyPhone, email: companyEmail, address: companyAddress, liability: liabilityInsurance }
    localStorage.setItem("quote_brand", JSON.stringify(data))
    toast.success("Branding saved for all future quotes")
  }

  const handlePrint = () => {
    window.print()
    toast.success("Print dialog opened — choose 'Save as PDF'")
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
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="brand" className="text-xs">Brand</TabsTrigger>
                  <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                  <TabsTrigger value="lines" className="text-xs">Lines</TabsTrigger>
                  <TabsTrigger value="scope" className="text-xs">Scope</TabsTrigger>
                  <TabsTrigger value="pricing" className="text-xs">Price</TabsTrigger>
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
                  {logoDataUrl && <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => setLogoDataUrl("")}>Remove Logo</Button>}

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
                      No lines yet — use the buttons above to get started.
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

                      <div className="space-y-1.5">
                        {quoteLines.map(line => (
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
                                    <span>{line.qty} {line.unit}</span>
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
                      {logoDataUrl && <img src={logoDataUrl} alt="Logo" className="h-16 w-auto object-contain bg-white/10 rounded-lg p-2" />}
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
                          {includedLines.map((line, i) => (
                            <tr key={line.id} className={i % 2 === 1 ? "bg-gray-50/60" : ""}>
                              <td className="py-2.5 px-3 text-gray-800 border-b border-gray-100">{line.description}</td>
                              <td className="py-2.5 px-3 text-right text-gray-600 border-b border-gray-100 font-mono text-xs">{line.qty}</td>
                              <td className="py-2.5 px-3 text-right text-gray-500 border-b border-gray-100 text-xs">{line.unit}</td>
                              <td className="py-2.5 px-3 text-right text-gray-600 border-b border-gray-100 font-mono text-xs">{au$(line.unitPrice)}</td>
                              <td className="py-2.5 px-3 text-right font-semibold border-b border-gray-100 font-mono text-xs" style={{ color: primaryColor }}>{au$(line.qty * line.unitPrice)}</td>
                            </tr>
                          ))}
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

                  {/* Payment schedule */}
                  {subtotalNum > 0 && (
                    <section>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-1 h-6 rounded-full" style={{ background: primaryColor }} />
                        <h2 className="text-lg font-bold text-gray-900">Payment Schedule</h2>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
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
                        <span>Licensed builder — Licence No. <strong>{builderLicence}</strong>. All works comply with National Construction Code (NCC) and applicable Australian Standards.</span>
                      </div>
                    )}
                  </section>

                  {/* Terms */}
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 rounded-full" style={{ background: primaryColor }} />
                      <h2 className="text-lg font-bold text-gray-900">Terms & Conditions</h2>
                    </div>
                    <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{terms}</div>
                  </section>

                  {/* Acceptance */}
                  <section className="border-2 rounded-xl p-6" style={{ borderColor: accentColor + "60" }}>
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

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-quote, #printable-quote * { visibility: visible !important; }
          #printable-quote { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </>
  )
}
