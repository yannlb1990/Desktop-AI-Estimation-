'use client'
import { useState } from "react"
import { getUserStorageKey } from "@/lib/localAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Printer, X, Plus, Trash2, ChevronRight } from "lucide-react"
import { toast } from "sonner"

interface TenderGeneratorProps {
  project: any
  estimate?: any
}

const DEFAULT_INCLUSIONS = [
  "All labour and materials as specified",
  "Site cleanup and waste removal upon completion",
  "All permits and council approvals (if applicable)",
  "Workmanship warranty — 7 years structural, 2 years general",
]

const DEFAULT_EXCLUSIONS = [
  "Variations outside agreed scope of work",
  "Asbestos removal or hazardous material disposal",
  "Landscaping and external works unless specified",
  "Electrical, plumbing and gas works unless specified",
]

const DEFAULT_TERMS = `Payment is due within 7 days of each invoice. All variations must be approved in writing prior to work commencing. This proposal is valid for the period stated above. Work will commence subject to deposit receipt and material lead times. The contractor reserves the right to adjust pricing if site conditions differ materially from those assumed.`

export const TenderGenerator = ({ project, estimate }: TenderGeneratorProps) => {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("details")

  // Company info
  const [companyName, setCompanyName] = useState(
    () => JSON.parse(localStorage.getItem(getUserStorageKey("default_rates")) || "{}").companyName || "Your Company Pty Ltd"
  )
  const [companyABN, setCompanyABN] = useState("")
  const [companyPhone, setCompanyPhone] = useState("")
  const [companyEmail, setCompanyEmail] = useState("")
  const [companyAddress, setCompanyAddress] = useState("")
  const [builderLicence, setBuilderLicence] = useState("")

  // Tender details
  const [tenderNumber, setTenderNumber] = useState(`TDR-${Date.now().toString().slice(-6)}`)
  const [validityDays, setValidityDays] = useState("30")
  const [depositPct, setDepositPct] = useState("10")
  const [progressPct, setProgressPct] = useState("40")
  const [finalPct, setFinalPct] = useState("50")

  // Scope
  const [inclusions, setInclusions] = useState<string[]>(DEFAULT_INCLUSIONS)
  const [exclusions, setExclusions] = useState<string[]>(DEFAULT_EXCLUSIONS)
  const [scopeNotes, setScopeNotes] = useState("")
  const [terms, setTerms] = useState(DEFAULT_TERMS)

  // Pricing (can be overridden)
  const [subtotal, setSubtotal] = useState(
    estimate?.total_materials
      ? String(Number(estimate.total_materials) + Number(estimate.total_labour || 0))
      : ""
  )
  const [gstRate] = useState(10)

  const subtotalNum = parseFloat(subtotal) || 0
  const gstAmount = subtotalNum * (gstRate / 100)
  const totalIncGst = subtotalNum + gstAmount
  const depositAmount = totalIncGst * (parseFloat(depositPct) / 100)
  const progressAmount = totalIncGst * (parseFloat(progressPct) / 100)
  const finalAmount = totalIncGst * (parseFloat(finalPct) / 100)

  const today = new Date()
  const validUntil = new Date(today.getTime() + parseInt(validityDays) * 86400000)
  const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })

  const addItem = (list: string[], setList: (v: string[]) => void) =>
    setList([...list, ""])

  const updateItem = (list: string[], setList: (v: string[]) => void, i: number, val: string) => {
    const n = [...list]; n[i] = val; setList(n)
  }

  const removeItem = (list: string[], setList: (v: string[]) => void, i: number) =>
    setList(list.filter((_, idx) => idx !== i))

  const handlePrint = () => {
    window.print()
    toast.success("Opening print dialog — choose 'Save as PDF'")
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-accent text-accent-foreground hover:bg-accent/90"
      >
        <FileText className="mr-2 h-4 w-4" />
        Generate Tender PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-xl">Tender Generator</DialogTitle>
              <div className="flex gap-2">
                <Button onClick={handlePrint} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Printer className="mr-2 h-4 w-4" />
                  Print / Save PDF
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* Left panel — editor */}
            <div className="w-[340px] flex-shrink-0 border-r overflow-y-auto bg-muted/30 p-4 no-print">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                  <TabsTrigger value="scope" className="text-xs">Scope</TabsTrigger>
                  <TabsTrigger value="pricing" className="text-xs">Pricing</TabsTrigger>
                </TabsList>

                {/* Details tab */}
                <TabsContent value="details" className="space-y-3 mt-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Company</p>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Company Name</Label>
                      <Input value={companyName} onChange={e => setCompanyName(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">ABN</Label>
                      <Input value={companyABN} onChange={e => setCompanyABN(e.target.value)} placeholder="12 345 678 901" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Builder Licence</Label>
                      <Input value={builderLicence} onChange={e => setBuilderLicence(e.target.value)} placeholder="BLD123456" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Phone</Label>
                      <Input value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="0400 000 000" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} placeholder="info@company.com.au" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Business Address</Label>
                      <Input value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Tender</p>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Tender Number</Label>
                      <Input value={tenderNumber} onChange={e => setTenderNumber(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Valid for (days)</Label>
                      <Input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Payment Schedule</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Deposit %</Label>
                      <Input type="number" value={depositPct} onChange={e => setDepositPct(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Progress %</Label>
                      <Input type="number" value={progressPct} onChange={e => setProgressPct(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Final %</Label>
                      <Input type="number" value={finalPct} onChange={e => setFinalPct(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                  {parseInt(depositPct) + parseInt(progressPct) + parseInt(finalPct) !== 100 && (
                    <p className="text-xs text-destructive">Payment %s must add up to 100%</p>
                  )}
                </TabsContent>

                {/* Scope tab */}
                <TabsContent value="scope" className="space-y-3 mt-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Inclusions</p>
                  {inclusions.map((item, i) => (
                    <div key={i} className="flex gap-1">
                      <Input
                        value={item}
                        onChange={e => updateItem(inclusions, setInclusions, i, e.target.value)}
                        className="h-8 text-xs flex-1"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeItem(inclusions, setInclusions, i)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => addItem(inclusions, setInclusions)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Inclusion
                  </Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Exclusions</p>
                  {exclusions.map((item, i) => (
                    <div key={i} className="flex gap-1">
                      <Input
                        value={item}
                        onChange={e => updateItem(exclusions, setExclusions, i, e.target.value)}
                        className="h-8 text-xs flex-1"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeItem(exclusions, setExclusions, i)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => addItem(exclusions, setExclusions)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Exclusion
                  </Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Additional Notes</p>
                  <Textarea
                    value={scopeNotes}
                    onChange={e => setScopeNotes(e.target.value)}
                    placeholder="Any additional scope notes..."
                    className="text-xs min-h-[80px]"
                  />

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Terms & Conditions</p>
                  <Textarea
                    value={terms}
                    onChange={e => setTerms(e.target.value)}
                    className="text-xs min-h-[100px]"
                  />
                </TabsContent>

                {/* Pricing tab */}
                <TabsContent value="pricing" className="space-y-3 mt-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Contract Sum</p>
                  <div>
                    <Label className="text-xs">Subtotal (ex GST) — $</Label>
                    <Input
                      type="number"
                      value={subtotal}
                      onChange={e => setSubtotal(e.target.value)}
                      placeholder="0.00"
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                  <div className="bg-background rounded-lg p-3 space-y-1 text-sm font-mono border">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span><span>${subtotalNum.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST (10%)</span><span>${gstAmount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-1">
                      <span>TOTAL</span><span>${totalIncGst.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right panel — live preview */}
            <div className="flex-1 overflow-y-auto bg-gray-100 p-6" id="tender-preview">
              <div className="max-w-[780px] mx-auto bg-white shadow-xl" id="printable-tender">

                {/* Cover header */}
                <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f4c81 100%)" }} className="p-10 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-blue-300 mb-1">Construction Proposal</div>
                      <h1 className="text-3xl font-bold mb-1">{companyName}</h1>
                      {companyABN && <div className="text-blue-200 text-sm">ABN: {companyABN}</div>}
                      {builderLicence && <div className="text-blue-200 text-sm">Licence: {builderLicence}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold text-blue-300 tracking-tight">{tenderNumber}</div>
                      <div className="text-sm text-blue-200 mt-1">Date: {fmt(today)}</div>
                      <div className="text-sm text-blue-200">Valid until: {fmt(validUntil)}</div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/20 grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-blue-300 mb-2">Project</div>
                      <div className="text-xl font-semibold">{project?.name || "—"}</div>
                      {(project?.site_address || project?.address) && (
                        <div className="text-blue-200 text-sm mt-1">{project?.site_address || project?.address}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-blue-300 mb-2">Prepared For</div>
                      <div className="text-xl font-semibold">{project?.client_name || "Client"}</div>
                      <div className="text-blue-200 text-sm mt-1">
                        {companyPhone && <div>{companyPhone}</div>}
                        {companyEmail && <div>{companyEmail}</div>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Accent bar */}
                <div className="h-1.5" style={{ background: "linear-gradient(to right, #f59e0b, #ef4444, #8b5cf6)" }} />

                <div className="p-8 space-y-8">

                  {/* Contract sum highlight */}
                  {subtotalNum > 0 && (
                    <div className="rounded-xl border-2 border-blue-100 bg-blue-50 p-6 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-blue-600 font-medium uppercase tracking-wide mb-1">Total Contract Value</div>
                        <div className="text-4xl font-bold text-blue-900 font-mono">
                          ${totalIncGst.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-blue-500 mt-1">Inclusive of GST</div>
                      </div>
                      <div className="text-right text-sm text-blue-700 space-y-1">
                        <div>Subtotal: ${subtotalNum.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</div>
                        <div>GST (10%): ${gstAmount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  )}

                  {/* Scope of Works */}
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 rounded-full bg-blue-600" />
                      <h2 className="text-lg font-bold text-gray-900">Scope of Works</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                          <span className="text-green-500">✓</span> Inclusions
                        </h3>
                        <ul className="space-y-1.5">
                          {inclusions.filter(Boolean).map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                              <ChevronRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-green-500" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                          <span className="text-red-400">✕</span> Exclusions
                        </h3>
                        <ul className="space-y-1.5">
                          {exclusions.filter(Boolean).map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                              <X className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-red-400" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {scopeNotes && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-gray-700">
                        <strong className="text-amber-700">Notes: </strong>{scopeNotes}
                      </div>
                    )}
                  </section>

                  {/* Payment Schedule */}
                  {subtotalNum > 0 && (
                    <section>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-1 h-6 rounded-full bg-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">Payment Schedule</h2>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { label: "Deposit", pct: depositPct, amount: depositAmount, note: "Due upon acceptance", color: "bg-blue-50 border-blue-200" },
                          { label: "Progress Payment", pct: progressPct, amount: progressAmount, note: "Due at practical completion stage", color: "bg-violet-50 border-violet-200" },
                          { label: "Final Payment", pct: finalPct, amount: finalAmount, note: "Due upon project completion", color: "bg-green-50 border-green-200" },
                        ].map(({ label, pct, amount, note, color }) => (
                          <div key={label} className={`rounded-xl border p-4 ${color}`}>
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</div>
                            <div className="text-2xl font-bold font-mono text-gray-900">
                              ${amount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs font-medium text-gray-500">{pct}% of contract</div>
                            <div className="text-xs text-gray-400 mt-2">{note}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Terms */}
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 rounded-full bg-blue-600" />
                      <h2 className="text-lg font-bold text-gray-900">Terms & Conditions</h2>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{terms}</p>
                  </section>

                  {/* Acceptance / Signature */}
                  <section className="border-2 border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 rounded-full bg-amber-500" />
                      <h2 className="text-lg font-bold text-gray-900">Acceptance</h2>
                    </div>
                    <p className="text-sm text-gray-500 mb-6">
                      By signing below, you confirm acceptance of this proposal including all terms and conditions outlined above.
                    </p>
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-6">Contractor Signature</div>
                        <div className="border-b-2 border-gray-300 mb-2" />
                        <div className="text-xs text-gray-500">{companyName}</div>
                        <div className="text-xs text-gray-400 mt-4">Date: ____________________</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-6">Client Signature</div>
                        <div className="border-b-2 border-gray-300 mb-2" />
                        <div className="text-xs text-gray-500">{project?.client_name || "Client Name"}</div>
                        <div className="text-xs text-gray-400 mt-4">Date: ____________________</div>
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
                    {companyABN && <div className="mt-1">ABN: {companyABN}</div>}
                    <div className="mt-2 text-gray-300">Generated with Metricore • {fmt(today)}</div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-tender, #printable-tender * { visibility: visible !important; }
          #printable-tender { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </>
  )
}
