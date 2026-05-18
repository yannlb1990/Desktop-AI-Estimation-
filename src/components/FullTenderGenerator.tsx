import { useState, useEffect } from "react"
import { getUserStorageKey } from "@/lib/localAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, Printer, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useSubscription } from "@/hooks/useSubscription"
import { UpgradeModal } from "@/components/UpgradeModal"

interface FullTenderProps { project: any; estimate?: any }

const LOAD_BRAND = () => { try { return JSON.parse(localStorage.getItem("quote_brand") || "{}") } catch { return {} } }

const DEFAULT_METHOD = `Our approach is built on three pillars:

1. PLANNING & COORDINATION — We begin with a detailed project program identifying all trades, lead times and critical path activities. A dedicated site supervisor is allocated from day one.

2. QUALITY ASSURANCE — All works are carried out in accordance with the National Construction Code (NCC), Australian Standards and relevant State regulations. Our internal QA checklist is completed at each stage prior to calling for inspections.

3. COMMUNICATION — Weekly site reports are issued to the client. All variations are documented and approved in writing before proceeding. We use digital project management tools for full transparency.`

const DEFAULT_WHY = `• Licensed and insured — fully compliant with all regulatory requirements
• Proven track record — completed over 150 commercial and residential projects
• Dedicated project management — one point of contact from start to finish
• Transparent pricing — no hidden costs, fully itemised quotations
• On-time delivery — 94% of projects completed on or before the agreed programme
• Post-completion support — responsive warranty service and client satisfaction follow-up`

const DEFAULT_COMPLIANCE = [
  { cert: "Builder's Licence", number: "", issuer: "State Licensing Authority", expiry: "" },
  { cert: "Public Liability Insurance", number: "", issuer: "Insurance Provider", expiry: "" },
  { cert: "Workers Compensation", number: "", issuer: "WorkCover", expiry: "" },
  { cert: "Contract Works Insurance", number: "", issuer: "Insurance Provider", expiry: "" },
  { cert: "Professional Indemnity Insurance", number: "", issuer: "Insurance Provider", expiry: "" },
  { cert: "WHS Management System", number: "ISO 45001", issuer: "Internal", expiry: "" },
  { cert: "Quality Management System", number: "ISO 9001", issuer: "Internal", expiry: "" },
]

const DEFAULT_MILESTONES = [
  { phase: "Mobilisation & Site Setup", duration: "Week 1" },
  { phase: "Demolition / Preparation Works", duration: "Weeks 1–2" },
  { phase: "Structural / Framing Works", duration: "Weeks 2–5" },
  { phase: "Lock-up Stage", duration: "Weeks 5–7" },
  { phase: "Fit-out & Finishes", duration: "Weeks 7–11" },
  { phase: "Practical Completion", duration: "Week 12" },
  { phase: "Defects Liability Period", duration: "3 months post-PC" },
]

const DEFAULT_INCLUSIONS = [
  "All labour, materials and plant as specified",
  "Site establishment, hoardings and temporary works",
  "All permits, inspections and council fees",
  "Structural engineer inspections and certificates",
  "Ongoing site cleaning and waste management",
  "Practical Completion inspection and handover",
  "Defects Liability Period support (3 months)",
  "As-built documentation upon completion",
]

const DEFAULT_EXCLUSIONS = [
  "Variations to the agreed scope (subject to formal VO process)",
  "Asbestos, mould, contamination or hazardous material removal",
  "Latent conditions not visible at time of tender",
  "Client-supplied materials unless otherwise stated",
  "Loose furniture, fittings and equipment (FF&E)",
  "Telecommunication, data, AV and security systems",
  "Landscaping, external works and civil works unless stated",
  "Escalation costs for materials beyond 12-month contract period",
]

const FULL_TERMS = `1. CONTRACT BASIS
This tender is submitted on the basis of the documents, drawings and specifications provided. The Contractor has prepared this tender in good faith based on information available at time of submission.

2. VARIATIONS
All changes to scope must be instructed in writing via a formal Variation Order (VO) signed by the Principal's Representative before work proceeds. Verbal instructions will not be accepted as authority to proceed. Variations will be valued at the Contractor's current rates or as agreed.

3. PAYMENT TERMS
Progress claims shall be submitted monthly or at agreed milestones. The Principal shall pay within 15 business days of a valid claim. Interest accrues on overdue amounts at the Reserve Bank cash rate plus 5% per annum. Security of Payment legislation applies.

4. SECURITY OF PAYMENT
This contract is subject to the applicable State Security of Payment Act. The Contractor reserves the right to issue a Payment Claim and pursue adjudication in accordance with the Act.

5. EXTENSIONS OF TIME (EOT)
The Contractor is entitled to claim an EOT for delays caused by: (a) Principal delays; (b) Variations; (c) Force Majeure events; (d) Inclement weather beyond seasonal norms; (e) Late instructions. EOT claims must be submitted within 10 business days of the delay event.

6. LIQUIDATED DAMAGES
If the Contractor fails to reach Practical Completion by the Date for Practical Completion (as may be extended), the Contractor shall pay Liquidated Damages at the rate stated on the cover of this tender per calendar day of delay, up to the maximum cap stated. Both parties agree that these amounts represent a genuine pre-estimate of the Principal's loss and are not a penalty.

7. DEFECTS LIABILITY PERIOD (DLP)
The DLP commences from the date of Practical Completion and runs for a period of three (3) calendar months, unless otherwise agreed. The Contractor shall rectify defects arising from workmanship within the DLP at no charge to the Principal.

8. LIMITATION OF LIABILITY
The total aggregate liability of the Contractor to the Principal under or in connection with this contract (whether in contract, tort, statute or otherwise) shall not exceed the Contract Sum. Neither party shall be liable for indirect, consequential, special or punitive loss or damage. Nothing in this clause limits liability for death, personal injury, or fraud.

9. LATENT CONDITIONS
If latent conditions are encountered that materially differ from those indicated in the contract documents, the Contractor shall promptly notify the Principal and is entitled to a variation for any additional cost and time resulting therefrom.

10. WORK HEALTH & SAFETY
The Contractor will maintain a Safe Work Method Statement (SWMS) for all high-risk activities in accordance with the Work Health and Safety Act and Regulations. All workers must hold current relevant licences and inductions.

11. INSURANCE OBLIGATIONS
The Contractor shall maintain throughout the works: (a) Public Liability Insurance — minimum $20,000,000 per occurrence; (b) Contract Works Insurance — full replacement value; (c) Workers Compensation — as required by law; (d) Professional Indemnity — where applicable.

12. TERMINATION FOR DEFAULT
Either party may terminate this contract if the other party commits a material breach and fails to remedy that breach within 14 days of written notice. On termination for contractor default, the Principal may engage others to complete the works and recover the reasonable additional cost from the Contractor.

13. TERMINATION FOR CONVENIENCE
The Principal may terminate this contract for convenience on 10 business days' written notice. Upon termination for convenience, the Contractor is entitled to payment for all work completed, materials reasonably ordered, and a reasonable allowance for loss of profit on the uncompleted works.

14. NOTICES
All notices under this contract must be in writing and delivered by email to the contact address specified in this tender. Notices are effective on the date of confirmed receipt.

15. DISPUTE RESOLUTION
Disputes shall be resolved through: (a) Good faith negotiation between senior representatives; (b) If unresolved within 14 days, referral to a mutually agreed mediator; (c) If mediation fails, adjudication or litigation in the applicable State jurisdiction. This clause survives termination of the contract.

16. INTELLECTUAL PROPERTY
All designs, shop drawings, specifications and documentation prepared by the Contractor remain the intellectual property of the Contractor until full payment is received.

17. PROPORTIONATE LIABILITY
To the extent permitted by law, the operation of proportionate liability legislation (including Part VIA of the Trade Practices Act 1974 and equivalent State Acts) is excluded from this contract.

18. AUSTRALIAN CONSUMER LAW
Our goods and services come with guarantees that cannot be excluded under the Australian Consumer Law. You are entitled to a replacement or refund for a major failure and compensation for other reasonably foreseeable loss or damage.

19. GST
All amounts are stated inclusive of GST unless otherwise noted. The Contractor is registered for GST under the A New Tax System (Goods and Services Tax) Act 1999 (Cth). Tax invoices will be issued in accordance with GST legislation.

20. CONFIDENTIALITY
This tender document is submitted in commercial confidence. The Contractor requests that pricing, methodology and proprietary information not be disclosed to third parties without prior written consent.

21. VALIDITY
This tender remains open for acceptance for the period stated on the cover. The Contractor reserves the right to withdraw or amend this tender prior to formal acceptance.`

export const FullTenderGenerator = ({ project, estimate }: FullTenderProps) => {
  const [open, setOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("company")
  const sub = useSubscription()

  const brand = LOAD_BRAND()
  const [logoDataUrl] = useState<string>(brand.logo || "")
  const [primaryColor] = useState<string>(brand.primary || "#0f4c81")
  const [accentColor] = useState<string>(brand.accent || "#f59e0b")

  // ── Company ──
  const [companyName, setCompanyName] = useState(brand.companyName || "Your Company Pty Ltd")
  const [companyABN, setCompanyABN] = useState(brand.abn || "")
  const [companyACN, setCompanyACN] = useState(brand.acn || "")
  const [builderLicence, setBuilderLicence] = useState(brand.licence || "")
  const [companyPhone, setCompanyPhone] = useState(brand.phone || "")
  const [companyEmail, setCompanyEmail] = useState(brand.email || "")
  const [companyAddress, setCompanyAddress] = useState(brand.address || "")
  const [companyTagline, setCompanyTagline] = useState(brand.tagline || "")
  const [yearsExp, setYearsExp] = useState("10+")
  const [projectsCompleted, setProjectsCompleted] = useState("150+")
  const [companyProfile, setCompanyProfile] = useState(`${brand.companyName || "Our company"} is a fully licensed and insured building contractor delivering high-quality construction solutions across residential, commercial and industrial sectors. Founded on the principles of integrity, quality and partnership, we work collaboratively with clients, designers and subcontractors to deliver projects that exceed expectations.\n\nOur experienced team brings together expertise across all trade disciplines, supported by robust project management systems and a commitment to workplace safety.`)
  const tenderSettings = (() => { try { return JSON.parse(localStorage.getItem(getUserStorageKey("quote_settings")) || "{}") } catch { return {} } })()
  const tenderPrefix = tenderSettings.prefix ? `${tenderSettings.prefix}T` : "TND"
  const [tenderNumber, setTenderNumber] = useState(`${tenderPrefix}-${Date.now().toString().slice(-6)}`)
  const [validityDays, setValidityDays] = useState(tenderSettings.validityDays || "60")
  const [contractType, setContractType] = useState("Lump Sum Fixed Price")
  const [deliveryMethod, setDeliveryMethod] = useState("Design & Construct")
  const [programWeeks, setProgramWeeks] = useState("12")
  const [siteVisitDate, setSiteVisitDate] = useState("")
  const [siteVisitBy, setSiteVisitBy] = useState("")
  const [addendaList, setAddendaList] = useState("Addendum 1 — [date], Addendum 2 — [date]")
  const [compliance, setCompliance] = useState(DEFAULT_COMPLIANCE)
  const [references, setReferences] = useState([
    { company: "ABC Developments Pty Ltd", contact: "John Smith", phone: "0400 000 001", project: "Commercial fitout, $2.4M" },
    { company: "XYZ Property Group", contact: "Jane Doe", phone: "0400 000 002", project: "Residential complex, $8.1M" },
  ])

  // ── Personnel ──
  const [keyPersonnel, setKeyPersonnel] = useState([
    { name: "", role: "Project Manager", licence: "", experience: "10+ years", projects: "" },
    { name: "", role: "Site Supervisor", licence: "", experience: "8+ years", projects: "" },
    { name: "", role: "Safety Officer", licence: "WHS Cert IV", experience: "5+ years", projects: "" },
    { name: "", role: "Contracts Administrator", licence: "", experience: "6+ years", projects: "" },
  ])
  const [ltifr, setLtifr] = useState("0.0")
  const [trifr, setTrifr] = useState("0.0")
  const [safetyYears, setSafetyYears] = useState("3")
  const [swmsList, setSwmsList] = useState([
    "Working at heights (scaffolding, roof work)",
    "Excavation and trenching",
    "Crane and lifting operations",
    "Electrical work",
    "Demolition works",
    "Confined space entry (if applicable)",
  ])

  // ── Scope ──
  const [methodology, setMethodology] = useState(DEFAULT_METHOD)
  const [whyUs, setWhyUs] = useState(DEFAULT_WHY)
  const [milestones, setMilestones] = useState(DEFAULT_MILESTONES)
  const [inclusions, setInclusions] = useState<string[]>(DEFAULT_INCLUSIONS)
  const [exclusions, setExclusions] = useState<string[]>(DEFAULT_EXCLUSIONS)
  const [qualifications, setQualifications] = useState([
    "Pricing based on architectural drawings Rev A. Any design changes will be subject to variation.",
    "Soil classification assumed as Class M. Class P or H2 will attract a variation.",
    "Site access assumed 7am–5pm Monday to Friday. Extended hours are excluded.",
    "All statutory fees and council contributions are included unless specifically excluded.",
    "Price is valid for the period stated. If contract not awarded within validity period, pricing is subject to review.",
  ])
  const [subcontractors, setSubcontractors] = useState([
    { trade: "Hydraulic Plumbing", company: "", abn: "" },
    { trade: "Electrical", company: "", abn: "" },
    { trade: "Concrete", company: "", abn: "" },
    { trade: "Structural Steel", company: "", abn: "" },
  ])
  const [terms, setTerms] = useState(FULL_TERMS)

  // ── Risk ──
  const [riskRegister, setRiskRegister] = useState([
    { risk: "Poor ground / latent conditions", probability: "Medium", impact: "High", mitigation: "Geotech report obtained. Contingency held. Latent conditions clause in contract." },
    { risk: "Wet weather program delays", probability: "Medium", impact: "Medium", mitigation: "Programme includes 5 days weather float. EOT claim rights preserved." },
    { risk: "Material supply delays (steel, timber)", probability: "Medium", impact: "High", mitigation: "Steel and timber orders placed within 2 weeks of award to secure supply." },
    { risk: "Subcontractor capacity", probability: "Low", impact: "Medium", mitigation: "Preferred subcontractors pre-qualified and provisionally committed." },
    { risk: "Scope change / client variations", probability: "High", impact: "Medium", mitigation: "Formal VO process. All changes in writing before proceeding." },
  ])
  const [lessonsLearnt, setLessonsLearnt] = useState(`On our recent comparable projects, key lessons incorporated into this programme include:

• PROCUREMENT LEAD TIMES: Structural steel and engineered timber currently carry 8–12 week lead times. Procurement milestones are built into the programme to ensure materials are on site before they are needed on the critical path.

• SERVICES COORDINATION: Poor coordination between hydraulic and electrical trades caused rework on previous projects. We now issue combined services drawings for review before any penetrations are made.

• VARIATION MANAGEMENT: All variations are issued as a formal VO with written scope and price before work proceeds, eliminating end-of-project disputes.

• WEATHER IMPACT: Based on BOM data for this region, realistic weather float is included in the programme.`)
  const [handoverItems, setHandoverItems] = useState([
    "As-built drawings (PDF + DWG) within 4 weeks of Practical Completion",
    "Operation & Maintenance manuals for all mechanical and electrical systems",
    "Warranty certificates: roofing (10yr), waterproofing (10yr), structural (6yr), general workmanship (1yr)",
    "Compliance certificates: Hydraulic, Electrical, Structural Engineer sign-off",
    "Certificate of Occupancy / Occupation Certificate",
    "Fire safety certificate and annual fire safety statement template",
    "Subcontractor contact list for ongoing maintenance",
    "Spare materials: floor tiles, paint (min. 1L per colour), touch-up hardware",
    "Building systems training for owner or facilities manager",
  ])
  const [empNotes, setEmpNotes] = useState("An Environmental Management Plan (EMP) will be prepared and submitted within 2 weeks of contract award. The EMP will address: erosion and sediment control, noise and vibration, waste management and recycling, and protection of adjacent properties and the public.")
  const [wasteTarget, setWasteTarget] = useState("80")

  // ── Pricing ──
  const [subtotal, setSubtotal] = useState("")
  const [depositPct, setDepositPct] = useState("5")
  const [progressPct, setProgressPct] = useState("80")
  const [retentionPct, setRetentionPct] = useState("5")
  const [finalPct, setFinalPct] = useState("10")
  const [ldRate, setLdRate] = useState("")
  const [ldCap, setLdCap] = useState("10")
  const [boqItems, setBoqItems] = useState([
    { trade: "Preliminaries", description: "Site establishment, supervision, insurance, temp services", qty: "1", unit: "Lump", rate: "", total: "" },
    { trade: "Demolition", description: "Strip out and demolition as per drawings", qty: "1", unit: "Lump", rate: "", total: "" },
    { trade: "Concrete", description: "Footings, slabs, columns as per structural drawings", qty: "", unit: "m³", rate: "", total: "" },
    { trade: "Framing", description: "Structural steel and timber framing", qty: "1", unit: "Lump", rate: "", total: "" },
    { trade: "Roofing", description: "Roof structure, sarking, cladding and flashings", qty: "", unit: "m²", rate: "", total: "" },
    { trade: "Hydraulic", description: "Cold water, hot water, sanitary drainage, fixtures", qty: "1", unit: "Lump", rate: "", total: "" },
    { trade: "Electrical", description: "Power, lighting, switchboard, data conduits", qty: "1", unit: "Lump", rate: "", total: "" },
    { trade: "Plastering", description: "Internal linings, plasterboard, set", qty: "", unit: "m²", rate: "", total: "" },
    { trade: "Tiling", description: "Floor and wall tiles as specified", qty: "", unit: "m²", rate: "", total: "" },
    { trade: "Painting", description: "Internal and external painting to all surfaces", qty: "1", unit: "Lump", rate: "", total: "" },
    { trade: "Joinery", description: "Kitchens, vanities, built-in robes", qty: "1", unit: "Lump", rate: "", total: "" },
    { trade: "PC / Provisional Sums", description: "Client selections and contingency allowances", qty: "1", unit: "Lump", rate: "", total: "" },
  ])
  const [dayworksRates, setDayworksRates] = useState([
    { category: "Leading Hand / Foreman", unit: "/hr", rate: "115" },
    { category: "Carpenter / Tradesperson", unit: "/hr", rate: "98" },
    { category: "Labourer", unit: "/hr", rate: "72" },
    { category: "Plant Operator", unit: "/hr", rate: "105" },
    { category: "Concrete Pump (small)", unit: "/hr", rate: "220" },
    { category: "Excavator (8t)", unit: "/hr", rate: "185" },
    { category: "Scissor Lift", unit: "/day", rate: "280" },
  ])
  const [veOptions, setVeOptions] = useState([
    { option: "Alternative A", description: "", saving: "" },
    { option: "Alternative B", description: "", saving: "" },
  ])

  // ── Load estimate items from localStorage when dialog opens ──
  const loadFromEstimate = () => {
    const projects: any[] = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]")
    const proj = projects.find((p: any) => p.id === project?.id)
    const estimateItems: any[] = proj?.estimate_items || estimate?.estimate_items || []
    if (estimateItems.length === 0) return

    const newBoqItems = estimateItems.map((item: any) => {
      const qty = parseFloat(item.quantity) || 1
      const unitPrice = parseFloat(item.unit_price) || 0
      const labourHours = parseFloat(item.labour_hours) || 0
      const labourRate = parseFloat(item.labour_rate) || 65
      const matWaste = (item.material_wastage_pct ?? 5) / 100
      const labWaste = (item.labour_wastage_pct ?? 10) / 100
      const markup = (item.markup_pct ?? 0) / 100
      const matTotal = qty * unitPrice * (1 + matWaste)
      const labTotal = labourHours * labourRate * (1 + labWaste)
      const lineTotal = Math.round((matTotal + labTotal) * (1 + markup) * 100) / 100
      return {
        trade: item.trade || "General",
        description: [item.scope_of_work, item.material_type].filter(Boolean).join(" — ") || "Item",
        qty: String(qty),
        unit: item.unit || "m²",
        rate: String(Math.round((lineTotal / Math.max(qty, 1)) * 100) / 100),
        total: String(lineTotal),
      }
    })

    const overheadFromStorage = proj?.overhead_total || 0
    const itemsTotal = newBoqItems.reduce((s, b) => s + parseFloat(b.total || "0"), 0)
    const exGstTotal = Math.round((itemsTotal + overheadFromStorage) * 100) / 100

    setBoqItems(newBoqItems)
    setSubtotal(String(exGstTotal))
  }

  useEffect(() => {
    if (open) loadFromEstimate()
  }, [open])

  // ── Derived ──
  const subtotalNum = parseFloat(subtotal) || 0
  const gstAmount = subtotalNum * 0.1
  const totalIncGst = subtotalNum + gstAmount
  const today = new Date()
  const validUntil = new Date(today.getTime() + parseInt(validityDays) * 86400000)
  const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
  const au$ = (n: number) => "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2 })
  const headerStyle = { background: `linear-gradient(135deg, ${primaryColor}f0 0%, ${primaryColor} 100%)` }

  const SH = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-5 mt-8">
      <div className="w-1 h-7 rounded-full" style={{ background: primaryColor }} />
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )

  const riskColor = (level: string) => {
    if (level === "High") return "bg-red-100 text-red-700"
    if (level === "Medium") return "bg-amber-100 text-amber-700"
    return "bg-green-100 text-green-700"
  }

  return (
    <>
      <Button
        onClick={() => {
          if (!sub.caps.tenderDoc) { setUpgradeOpen(true); return; }
          setOpen(true);
        }}
        className="bg-accent text-accent-foreground hover:bg-accent/90"
      >
        <Building2 className="mr-2 h-4 w-4" />
        Generate Tender
      </Button>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature="Full Tender Document"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-xl">Tender Document Generator</DialogTitle>
              <Button onClick={() => { window.print(); toast.success("Save as PDF from the print dialog") }} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Printer className="mr-2 h-4 w-4" />Print / Save PDF
              </Button>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* ── EDITOR PANEL ── */}
            <div className="w-[360px] flex-shrink-0 border-r overflow-y-auto bg-muted/30 p-4 no-print">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-5 w-full mb-4">
                  <TabsTrigger value="company" className="text-[10px]">Company</TabsTrigger>
                  <TabsTrigger value="personnel" className="text-[10px]">People</TabsTrigger>
                  <TabsTrigger value="scope" className="text-[10px]">Scope</TabsTrigger>
                  <TabsTrigger value="risk" className="text-[10px]">Risk</TabsTrigger>
                  <TabsTrigger value="pricing" className="text-[10px]">Pricing</TabsTrigger>
                </TabsList>

                {/* ── COMPANY TAB ── */}
                <TabsContent value="company" className="space-y-3 mt-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Company Details</p>
                  {[
                    ["Company Name", companyName, setCompanyName],
                    ["Tagline", companyTagline, setCompanyTagline],
                    ["ABN", companyABN, setCompanyABN],
                    ["ACN", companyACN, setCompanyACN],
                    ["Builder Licence No.", builderLicence, setBuilderLicence],
                    ["Phone", companyPhone, setCompanyPhone],
                    ["Email", companyEmail, setCompanyEmail],
                    ["Address", companyAddress, setCompanyAddress],
                    ["Years Experience", yearsExp, setYearsExp],
                    ["Projects Completed", projectsCompleted, setProjectsCompleted],
                  ].map(([l, v, s]: any) => (
                    <div key={l}><Label className="text-xs">{l}</Label><Input value={v} onChange={e => s(e.target.value)} className="h-8 text-sm" /></div>
                  ))}

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Company Profile</p>
                  <Textarea value={companyProfile} onChange={e => setCompanyProfile(e.target.value)} className="text-xs min-h-[90px]" />

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Tender Details</p>
                  {[
                    ["Tender Number", tenderNumber, setTenderNumber],
                    ["Valid for (days)", validityDays, setValidityDays],
                    ["Contract Type", contractType, setContractType],
                    ["Delivery Method", deliveryMethod, setDeliveryMethod],
                    ["Programme (weeks)", programWeeks, setProgramWeeks],
                    ["Site Visit Date", siteVisitDate, setSiteVisitDate],
                    ["Site Visit By", siteVisitBy, setSiteVisitBy],
                    ["Addenda Received", addendaList, setAddendaList],
                  ].map(([l, v, s]: any) => (
                    <div key={l}><Label className="text-xs">{l}</Label><Input value={v} onChange={e => s(e.target.value)} className="h-8 text-sm" /></div>
                  ))}

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Compliance Table</p>
                  {compliance.map((c, i) => (
                    <div key={i} className="bg-background border rounded p-2 space-y-1">
                      <div className="text-xs font-medium">{c.cert}</div>
                      <div className="grid grid-cols-2 gap-1">
                        <Input placeholder="Policy/Cert No." value={c.number} onChange={e => { const n = [...compliance]; n[i].number = e.target.value; setCompliance(n) }} className="h-7 text-xs" />
                        <Input placeholder="Expiry" value={c.expiry} onChange={e => { const n = [...compliance]; n[i].expiry = e.target.value; setCompliance(n) }} className="h-7 text-xs" />
                      </div>
                    </div>
                  ))}

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">References</p>
                  {references.map((r, i) => (
                    <div key={i} className="bg-background border rounded p-2 space-y-1">
                      {[["Company", "company"], ["Contact", "contact"], ["Phone", "phone"], ["Project", "project"]].map(([l, k]) => (
                        <Input key={k} placeholder={l} value={(r as any)[k]} onChange={e => { const n = [...references]; (n[i] as any)[k] = e.target.value; setReferences(n) }} className="h-7 text-xs" />
                      ))}
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => setReferences(references.filter((_, idx) => idx !== i))}>Remove</Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setReferences([...references, { company: "", contact: "", phone: "", project: "" }])}><Plus className="h-3 w-3 mr-1" />Add Reference</Button>
                </TabsContent>

                {/* ── PERSONNEL TAB ── */}
                <TabsContent value="personnel" className="space-y-3 mt-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Key Personnel</p>
                  {keyPersonnel.map((p, i) => (
                    <div key={i} className="bg-background border rounded p-2 space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">{p.role}</div>
                      {[["Full Name", "name"], ["Licence / Qualification", "licence"], ["Experience", "experience"], ["Notable Projects", "projects"]].map(([l, k]) => (
                        <Input key={k} placeholder={l as string} value={(p as any)[k]} onChange={e => { const n = [...keyPersonnel]; (n[i] as any)[k] = e.target.value; setKeyPersonnel(n) }} className="h-7 text-xs" />
                      ))}
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => setKeyPersonnel(keyPersonnel.filter((_, idx) => idx !== i))}>Remove</Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setKeyPersonnel([...keyPersonnel, { name: "", role: "Other", licence: "", experience: "", projects: "" }])}><Plus className="h-3 w-3 mr-1" />Add Person</Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-3">Safety Statistics (last {safetyYears} years)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-xs">Years</Label><Input value={safetyYears} onChange={e => setSafetyYears(e.target.value)} className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">LTIFR</Label><Input value={ltifr} onChange={e => setLtifr(e.target.value)} className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">TRIFR</Label><Input value={trifr} onChange={e => setTrifr(e.target.value)} className="h-8 text-sm" /></div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">LTIFR = Lost Time Injury Frequency Rate · TRIFR = Total Recordable Injury Frequency Rate (per million hours worked)</p>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">SWMS — High Risk Activities</p>
                  {swmsList.map((s, i) => (
                    <div key={i} className="flex gap-1">
                      <Input value={s} onChange={e => { const n = [...swmsList]; n[i] = e.target.value; setSwmsList(n) }} className="h-7 text-xs flex-1" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setSwmsList(swmsList.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setSwmsList([...swmsList, ""])}><Plus className="h-3 w-3 mr-1" />Add SWMS Item</Button>
                </TabsContent>

                {/* ── SCOPE TAB ── */}
                <TabsContent value="scope" className="space-y-3 mt-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Methodology</p>
                  <Textarea value={methodology} onChange={e => setMethodology(e.target.value)} className="text-xs min-h-[80px]" />

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Why Choose Us</p>
                  <Textarea value={whyUs} onChange={e => setWhyUs(e.target.value)} className="text-xs min-h-[70px]" />

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Programme Milestones</p>
                  {milestones.map((m, i) => (
                    <div key={i} className="flex gap-1">
                      <Input value={m.phase} onChange={e => { const n = [...milestones]; n[i].phase = e.target.value; setMilestones(n) }} className="h-7 text-xs flex-1" placeholder="Phase" />
                      <Input value={m.duration} onChange={e => { const n = [...milestones]; n[i].duration = e.target.value; setMilestones(n) }} className="h-7 text-xs w-28" placeholder="Duration" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setMilestones(milestones.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setMilestones([...milestones, { phase: "", duration: "" }])}><Plus className="h-3 w-3 mr-1" />Add Milestone</Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Inclusions</p>
                  {inclusions.map((item, i) => (
                    <div key={i} className="flex gap-1">
                      <Input value={item} onChange={e => { const n = [...inclusions]; n[i] = e.target.value; setInclusions(n) }} className="h-7 text-xs flex-1" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setInclusions(inclusions.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setInclusions([...inclusions, ""])}><Plus className="h-3 w-3 mr-1" />Add</Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Exclusions</p>
                  {exclusions.map((item, i) => (
                    <div key={i} className="flex gap-1">
                      <Input value={item} onChange={e => { const n = [...exclusions]; n[i] = e.target.value; setExclusions(n) }} className="h-7 text-xs flex-1" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setExclusions(exclusions.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setExclusions([...exclusions, ""])}><Plus className="h-3 w-3 mr-1" />Add</Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Tender Qualifications / Assumptions</p>
                  {qualifications.map((q, i) => (
                    <div key={i} className="flex gap-1">
                      <Input value={q} onChange={e => { const n = [...qualifications]; n[i] = e.target.value; setQualifications(n) }} className="h-7 text-xs flex-1" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setQualifications(qualifications.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setQualifications([...qualifications, ""])}><Plus className="h-3 w-3 mr-1" />Add Qualification</Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Nominated Subcontractors</p>
                  {subcontractors.map((s, i) => (
                    <div key={i} className="bg-background border rounded p-2 space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">{s.trade}</div>
                      <Input placeholder="Company name" value={s.company} onChange={e => { const n = [...subcontractors]; n[i].company = e.target.value; setSubcontractors(n) }} className="h-7 text-xs" />
                      <Input placeholder="ABN" value={s.abn} onChange={e => { const n = [...subcontractors]; n[i].abn = e.target.value; setSubcontractors(n) }} className="h-7 text-xs" />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setSubcontractors([...subcontractors, { trade: "", company: "", abn: "" }])}><Plus className="h-3 w-3 mr-1" />Add Subcontractor</Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Environmental Commitment</p>
                  <div className="flex gap-2 items-center">
                    <Label className="text-xs whitespace-nowrap">Waste Diversion Target %</Label>
                    <Input value={wasteTarget} onChange={e => setWasteTarget(e.target.value)} className="h-8 text-sm w-20" />
                  </div>
                  <Textarea value={empNotes} onChange={e => setEmpNotes(e.target.value)} className="text-xs min-h-[70px]" />

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Terms & Conditions</p>
                  <Textarea value={terms} onChange={e => setTerms(e.target.value)} className="text-xs min-h-[100px]" />
                </TabsContent>

                {/* ── RISK TAB ── */}
                <TabsContent value="risk" className="space-y-3 mt-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Risk Register</p>
                  {riskRegister.map((r, i) => (
                    <div key={i} className="bg-background border rounded p-2 space-y-1">
                      <Input placeholder="Risk description" value={r.risk} onChange={e => { const n = [...riskRegister]; n[i].risk = e.target.value; setRiskRegister(n) }} className="h-7 text-xs" />
                      <div className="grid grid-cols-2 gap-1">
                        <div>
                          <Label className="text-[10px]">Probability</Label>
                          <select value={r.probability} onChange={e => { const n = [...riskRegister]; n[i].probability = e.target.value; setRiskRegister(n) }} className="w-full h-7 text-xs border rounded px-2 bg-background">
                            <option>Low</option><option>Medium</option><option>High</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px]">Impact</Label>
                          <select value={r.impact} onChange={e => { const n = [...riskRegister]; n[i].impact = e.target.value; setRiskRegister(n) }} className="w-full h-7 text-xs border rounded px-2 bg-background">
                            <option>Low</option><option>Medium</option><option>High</option>
                          </select>
                        </div>
                      </div>
                      <Input placeholder="Mitigation strategy" value={r.mitigation} onChange={e => { const n = [...riskRegister]; n[i].mitigation = e.target.value; setRiskRegister(n) }} className="h-7 text-xs" />
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => setRiskRegister(riskRegister.filter((_, idx) => idx !== i))}>Remove</Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setRiskRegister([...riskRegister, { risk: "", probability: "Medium", impact: "Medium", mitigation: "" }])}><Plus className="h-3 w-3 mr-1" />Add Risk</Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-3">Lessons Learnt</p>
                  <Textarea value={lessonsLearnt} onChange={e => setLessonsLearnt(e.target.value)} className="text-xs min-h-[120px]" />

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Handover Package</p>
                  {handoverItems.map((item, i) => (
                    <div key={i} className="flex gap-1">
                      <Input value={item} onChange={e => { const n = [...handoverItems]; n[i] = e.target.value; setHandoverItems(n) }} className="h-7 text-xs flex-1" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setHandoverItems(handoverItems.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setHandoverItems([...handoverItems, ""])}><Plus className="h-3 w-3 mr-1" />Add Item</Button>
                </TabsContent>

                {/* ── PRICING TAB ── */}
                <TabsContent value="pricing" className="space-y-3 mt-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tender Sum</p>
                  {subtotalNum > 0 && (
                    <div className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded px-3 py-2">
                      <span className="text-xs text-accent font-medium">Auto-loaded from Estimate tab</span>
                      <button className="text-xs text-muted-foreground underline" onClick={loadFromEstimate}>Reload</button>
                    </div>
                  )}
                  <div><Label className="text-xs">Subtotal (ex GST) — $</Label>
                    <Input type="number" value={subtotal} onChange={e => setSubtotal(e.target.value)} placeholder="0.00" className="h-8 text-sm font-mono" /></div>
                  {subtotalNum > 0 && (
                    <div className="bg-background rounded-lg p-3 space-y-1 text-sm font-mono border">
                      <div className="flex justify-between text-muted-foreground"><span>Subtotal (ex GST)</span><span>{au$(subtotalNum)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>GST (10%)</span><span>{au$(gstAmount)}</span></div>
                      <div className="flex justify-between font-bold border-t pt-1 text-base"><span>TENDER SUM (inc GST)</span><span>{au$(totalIncGst)}</span></div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Liquidated Damages</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">LD Rate ($/day)</Label><Input value={ldRate} onChange={e => setLdRate(e.target.value)} placeholder="e.g. 500" className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">LD Cap (% of contract)</Label><Input value={ldCap} onChange={e => setLdCap(e.target.value)} placeholder="10" className="h-8 text-sm" /></div>
                  </div>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Payment Schedule %</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[["Deposit %", depositPct, setDepositPct], ["Progress %", progressPct, setProgressPct], ["Retention %", retentionPct, setRetentionPct], ["Final/DLP %", finalPct, setFinalPct]].map(([l, v, s]: any) => (
                      <div key={l}><Label className="text-xs">{l}</Label><Input type="number" value={v} onChange={e => s(e.target.value)} className="h-8 text-sm" /></div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Bill of Quantities</p>
                  {boqItems.map((item, i) => (
                    <div key={i} className="bg-background border rounded p-2 space-y-1">
                      <div className="grid grid-cols-2 gap-1">
                        <Input placeholder="Trade" value={item.trade} onChange={e => { const n = [...boqItems]; n[i].trade = e.target.value; setBoqItems(n) }} className="h-7 text-xs" />
                        <div className="flex gap-1">
                          <Input placeholder="Qty" value={item.qty} onChange={e => { const n = [...boqItems]; n[i].qty = e.target.value; setBoqItems(n) }} className="h-7 text-xs w-14" />
                          <Input placeholder="Unit" value={item.unit} onChange={e => { const n = [...boqItems]; n[i].unit = e.target.value; setBoqItems(n) }} className="h-7 text-xs w-14" />
                        </div>
                      </div>
                      <Input placeholder="Description" value={item.description} onChange={e => { const n = [...boqItems]; n[i].description = e.target.value; setBoqItems(n) }} className="h-7 text-xs" />
                      <div className="grid grid-cols-2 gap-1">
                        <Input placeholder="Rate $" value={item.rate} onChange={e => { const n = [...boqItems]; n[i].rate = e.target.value; setBoqItems(n) }} className="h-7 text-xs" />
                        <Input placeholder="Total $" value={item.total} onChange={e => { const n = [...boqItems]; n[i].total = e.target.value; setBoqItems(n) }} className="h-7 text-xs" />
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => setBoqItems(boqItems.filter((_, idx) => idx !== i))}>Remove</Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setBoqItems([...boqItems, { trade: "", description: "", qty: "", unit: "Lump", rate: "", total: "" }])}><Plus className="h-3 w-3 mr-1" />Add BoQ Item</Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Dayworks / Schedule of Rates</p>
                  {dayworksRates.map((d, i) => (
                    <div key={i} className="flex gap-1 items-center">
                      <Input value={d.category} onChange={e => { const n = [...dayworksRates]; n[i].category = e.target.value; setDayworksRates(n) }} className="h-7 text-xs flex-1" placeholder="Category" />
                      <Input value={d.unit} onChange={e => { const n = [...dayworksRates]; n[i].unit = e.target.value; setDayworksRates(n) }} className="h-7 text-xs w-14" placeholder="/hr" />
                      <Input value={d.rate} onChange={e => { const n = [...dayworksRates]; n[i].rate = e.target.value; setDayworksRates(n) }} className="h-7 text-xs w-16" placeholder="$" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setDayworksRates(dayworksRates.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setDayworksRates([...dayworksRates, { category: "", unit: "/hr", rate: "" }])}><Plus className="h-3 w-3 mr-1" />Add Rate</Button>

                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Value Engineering Alternatives</p>
                  {veOptions.map((v, i) => (
                    <div key={i} className="bg-background border rounded p-2 space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">{v.option}</div>
                      <Input placeholder="Description of alternative" value={v.description} onChange={e => { const n = [...veOptions]; n[i].description = e.target.value; setVeOptions(n) }} className="h-7 text-xs" />
                      <Input placeholder="Saving $ (e.g. -18,500)" value={v.saving} onChange={e => { const n = [...veOptions]; n[i].saving = e.target.value; setVeOptions(n) }} className="h-7 text-xs" />
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => setVeOptions(veOptions.filter((_, idx) => idx !== i))}>Remove</Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setVeOptions([...veOptions, { option: `Alternative ${String.fromCharCode(65 + veOptions.length)}`, description: "", saving: "" }])}><Plus className="h-3 w-3 mr-1" />Add Alternative</Button>
                </TabsContent>
              </Tabs>
            </div>

            {/* ── PREVIEW ── */}
            <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
              <div className="max-w-[800px] mx-auto bg-white shadow-xl" id="printable-tender">

                {/* Cover Page */}
                <div style={headerStyle} className="p-12 text-white min-h-[320px] flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      {logoDataUrl && <img src={logoDataUrl} alt="Logo" className="h-20 w-auto object-contain bg-white/10 rounded-xl p-3" />}
                      <div>
                        <div className="text-3xl font-bold">{companyName}</div>
                        {companyTagline && <div className="text-white/70 italic mt-1">{companyTagline}</div>}
                        {companyABN && <div className="text-white/50 text-sm mt-2">ABN: {companyABN}{companyACN ? ` · ACN: ${companyACN}` : ""}</div>}
                        {builderLicence && <div className="text-white/50 text-sm">Builder Licence: {builderLicence}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: accentColor }}>Tender Submission</div>
                      <div className="text-3xl font-bold" style={{ color: accentColor }}>{tenderNumber}</div>
                      {ldRate && <div className="text-xs text-white/50 mt-2">LD Rate: ${ldRate}/day · Cap: {ldCap}%</div>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest mb-2" style={{ color: accentColor }}>Submitted For</div>
                    <h1 className="text-4xl font-bold mb-2">{project?.name || "Project Name"}</h1>
                    {(project?.site_address || project?.address) && <div className="text-white/70">{project?.site_address || project?.address}</div>}
                    <div className="mt-4 grid grid-cols-3 gap-6 text-sm">
                      <div><div className="text-white/50 text-xs uppercase">Client</div><div className="font-medium">{project?.client_name || "—"}</div></div>
                      <div><div className="text-white/50 text-xs uppercase">Date Issued</div><div className="font-medium">{fmt(today)}</div></div>
                      <div><div className="text-white/50 text-xs uppercase">Valid Until</div><div className="font-medium">{fmt(validUntil)}</div></div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-6 text-sm">
                      <div><div className="text-white/50 text-xs uppercase">Contract Type</div><div className="font-medium">{contractType}</div></div>
                      <div><div className="text-white/50 text-xs uppercase">Delivery</div><div className="font-medium">{deliveryMethod}</div></div>
                      <div><div className="text-white/50 text-xs uppercase">Programme</div><div className="font-medium">{programWeeks} weeks</div></div>
                    </div>
                    {siteVisitDate && (
                      <div className="mt-3 text-xs text-white/50">Site visit conducted: {siteVisitDate}{siteVisitBy ? ` by ${siteVisitBy}` : ""} · Addenda received: {addendaList}</div>
                    )}
                  </div>
                </div>
                <div className="h-2" style={{ background: `linear-gradient(to right, ${accentColor}, ${primaryColor}, ${accentColor})` }} />

                {/* Table of Contents */}
                <div className="px-10 py-6 bg-gray-50 border-b">
                  <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">Contents</div>
                  <div className="grid grid-cols-2 gap-1 text-sm text-gray-600">
                    {[
                      "1. Company Overview", "2. Why Choose Us", "3. Methodology & Approach",
                      "4. Key Personnel", "5. Compliance & Certifications", "6. Scope of Works",
                      "7. Qualifications & Assumptions", "8. Nominated Subcontractors",
                      "9. Project Programme", "10. Tender Pricing & Bill of Quantities",
                      "11. Dayworks Schedule of Rates", "12. Payment Schedule",
                      "13. Value Engineering Alternatives", "14. Risk Register",
                      "15. Lessons Learnt", "16. Environmental Commitments",
                      "17. Handover Package", "18. References",
                      "19. Terms & Conditions", "20. Execution & Acceptance",
                    ].map(item => (
                      <div key={item} className="flex items-center gap-2"><span className="w-1 h-1 bg-gray-400 rounded-full flex-shrink-0" />{item}</div>
                    ))}
                  </div>
                </div>

                <div className="px-10 py-8 space-y-2">

                  {/* 1. Company Overview */}
                  <SH title="1. Company Overview" />
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      { label: "Years Experience", value: yearsExp },
                      { label: "Projects Completed", value: projectsCompleted },
                      { label: "Licence Status", value: builderLicence ? "Licensed ✓" : "Licensed" },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center p-4 rounded-xl border" style={{ borderColor: primaryColor + "30", background: primaryColor + "06" }}>
                        <div className="text-2xl font-bold" style={{ color: primaryColor }}>{value}</div>
                        <div className="text-xs text-gray-500 mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{companyProfile}</p>

                  {/* 2. Why Choose Us */}
                  <SH title="2. Why Choose Us" />
                  <div className="bg-gray-50 rounded-xl p-5 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{whyUs}</div>

                  {/* 3. Methodology */}
                  <SH title="3. Methodology & Approach" />
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{methodology}</p>

                  {/* 4. Key Personnel */}
                  {keyPersonnel.some(p => p.name) && (
                    <>
                      <SH title="4. Key Personnel" />
                      <div className="grid grid-cols-2 gap-4">
                        {keyPersonnel.filter(p => p.name || p.role).map((p, i) => (
                          <div key={i} className="border rounded-xl p-4" style={{ borderColor: primaryColor + "25", background: primaryColor + "04" }}>
                            <div className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: primaryColor }}>{p.role}</div>
                            <div className="font-semibold text-gray-800 text-sm">{p.name || "TBC"}</div>
                            {p.licence && <div className="text-xs text-gray-500 mt-1">{p.licence}</div>}
                            {p.experience && <div className="text-xs text-gray-500">{p.experience}</div>}
                            {p.projects && <div className="text-xs text-gray-400 mt-1 italic">{p.projects}</div>}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-4">
                        {[
                          { label: `LTIFR (last ${safetyYears} yrs)`, value: ltifr, sub: "per million hrs" },
                          { label: `TRIFR (last ${safetyYears} yrs)`, value: trifr, sub: "per million hrs" },
                          { label: "SWMS Prepared", value: `${swmsList.filter(Boolean).length}`, sub: "high-risk activities" },
                        ].map(({ label, value, sub }) => (
                          <div key={label} className="text-center p-3 rounded-xl bg-gray-50 border">
                            <div className="text-2xl font-bold text-gray-800">{value}</div>
                            <div className="text-xs font-medium text-gray-600 mt-0.5">{label}</div>
                            <div className="text-[10px] text-gray-400">{sub}</div>
                          </div>
                        ))}
                      </div>
                      {swmsList.filter(Boolean).length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-semibold text-gray-600 mb-2">High-Risk Construction Work — SWMS will be prepared for:</div>
                          <div className="flex flex-wrap gap-2">
                            {swmsList.filter(Boolean).map((s, i) => (
                              <span key={i} className="text-xs bg-gray-100 border rounded-full px-3 py-1 text-gray-600">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* 5. Compliance */}
                  <SH title="5. Compliance & Certifications" />
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left" style={{ background: primaryColor + "15" }}>
                        <th className="p-3 text-xs uppercase text-gray-600 font-semibold">Certificate / Insurance</th>
                        <th className="p-3 text-xs uppercase text-gray-600 font-semibold">Number / Policy</th>
                        <th className="p-3 text-xs uppercase text-gray-600 font-semibold">Issuer</th>
                        <th className="p-3 text-xs uppercase text-gray-600 font-semibold">Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compliance.map((c, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="p-3 font-medium text-gray-800">{c.cert}</td>
                          <td className="p-3 text-gray-600">{c.number || "—"}</td>
                          <td className="p-3 text-gray-600">{c.issuer}</td>
                          <td className="p-3 text-gray-600">{c.expiry || "Current"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-400 mt-2">Certificates of currency available upon request. All works comply with NCC, relevant Australian Standards, and applicable State regulations.</p>

                  {/* 6. Scope */}
                  <SH title="6. Scope of Works" />
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><span className="text-green-500 text-base">✓</span> Inclusions</h3>
                      <ul className="space-y-2">
                        {inclusions.filter(Boolean).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600 bg-green-50 rounded p-2">
                            <span className="text-green-500 font-bold mt-0.5 flex-shrink-0">✓</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><span className="text-red-400 text-base">✕</span> Exclusions</h3>
                      <ul className="space-y-2">
                        {exclusions.filter(Boolean).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600 bg-red-50 rounded p-2">
                            <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">✕</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 7. Qualifications */}
                  {qualifications.filter(Boolean).length > 0 && (
                    <>
                      <SH title="7. Qualifications & Assumptions" />
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">This tender is subject to the following qualifications and assumptions:</div>
                        <ol className="space-y-2">
                          {qualifications.filter(Boolean).map((q, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="font-bold text-amber-600 flex-shrink-0">{i + 1}.</span>{q}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </>
                  )}

                  {/* 8. Subcontractors */}
                  {subcontractors.some(s => s.company) && (
                    <>
                      <SH title="8. Nominated Subcontractors" />
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr style={{ background: primaryColor + "15" }}>
                            <th className="p-3 text-left text-xs uppercase text-gray-600 font-semibold">Trade</th>
                            <th className="p-3 text-left text-xs uppercase text-gray-600 font-semibold">Company</th>
                            <th className="p-3 text-left text-xs uppercase text-gray-600 font-semibold">ABN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subcontractors.map((s, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="p-3 font-medium text-gray-800">{s.trade}</td>
                              <td className="p-3 text-gray-600">{s.company || "TBC"}</td>
                              <td className="p-3 text-gray-500 font-mono text-xs">{s.abn || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-xs text-gray-400 mt-2">All subcontractors are licenced and insured. Back-to-back subcontract conditions apply. Final subcontractor selection subject to Principal approval.</p>
                    </>
                  )}

                  {/* 9. Programme */}
                  <SH title="9. Project Programme" />
                  <div className="space-y-2">
                    {milestones.filter(m => m.phase).map((m, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: primaryColor }}>{i + 1}</div>
                        <div className="flex-1 flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
                          <span className="text-sm font-medium text-gray-800">{m.phase}</span>
                          <span className="text-sm text-gray-500 font-mono">{m.duration}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">Programme is indicative and subject to site access, approvals and weather conditions. A detailed Gantt chart will be issued within 5 business days of contract award.</p>

                  {/* 10. Pricing + BoQ */}
                  <SH title="10. Tender Pricing & Bill of Quantities" />
                  {subtotalNum > 0 ? (
                    <>
                      <div className="rounded-xl border-2 p-6 mb-6" style={{ borderColor: primaryColor + "40", background: primaryColor + "06" }}>
                        <div className="text-center">
                          <div className="text-sm uppercase tracking-wide font-medium mb-1" style={{ color: primaryColor }}>Total Tender Sum</div>
                          <div className="text-5xl font-bold font-mono mb-1" style={{ color: primaryColor }}>{au$(totalIncGst)}</div>
                          <div className="text-sm text-gray-500">Inclusive of GST (10%)</div>
                          <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                            <div className="bg-white rounded p-3 text-gray-600"><div className="text-xs text-gray-400 mb-1">Subtotal (ex GST)</div>{au$(subtotalNum)}</div>
                            <div className="bg-white rounded p-3 text-gray-600"><div className="text-xs text-gray-400 mb-1">GST (10%)</div>{au$(gstAmount)}</div>
                          </div>
                          {ldRate && (
                            <div className="mt-3 text-xs text-gray-500 bg-white rounded p-2">
                              Liquidated Damages: <strong>${ldRate}/calendar day</strong> · Maximum cap: <strong>{ldCap}% of contract sum</strong>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">Lump sum price inclusive of all labour, materials, plant, preliminaries and overheads. Contractor is registered for GST (ABN: {companyABN || "XX XXX XXX XXX"}).</p>
                    </>
                  ) : (
                    <div className="border-2 border-dashed rounded-xl p-8 text-center text-gray-400 text-sm mb-4">Enter the tender sum in the Pricing tab to display here</div>
                  )}

                  {boqItems.some(b => b.trade) && (
                    <>
                      <div className="text-sm font-semibold text-gray-700 mb-2">Schedule of Works — Trade Breakdown</div>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr style={{ background: primaryColor + "12" }}>
                            <th className="p-2 text-left text-xs uppercase text-gray-600 font-semibold">Trade</th>
                            <th className="p-2 text-left text-xs uppercase text-gray-600 font-semibold">Description</th>
                            <th className="p-2 text-right text-xs uppercase text-gray-600 font-semibold">Qty</th>
                            <th className="p-2 text-right text-xs uppercase text-gray-600 font-semibold">Unit</th>
                            <th className="p-2 text-right text-xs uppercase text-gray-600 font-semibold">Rate</th>
                            <th className="p-2 text-right text-xs uppercase text-gray-600 font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {boqItems.filter(b => b.trade).map((b, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="p-2 font-medium text-gray-800 text-xs">{b.trade}</td>
                              <td className="p-2 text-gray-600 text-xs">{b.description}</td>
                              <td className="p-2 text-right text-gray-600 text-xs font-mono">{b.qty}</td>
                              <td className="p-2 text-right text-gray-500 text-xs">{b.unit}</td>
                              <td className="p-2 text-right text-gray-600 text-xs font-mono">{b.rate ? `$${b.rate}` : "—"}</td>
                              <td className="p-2 text-right font-semibold text-gray-800 text-xs font-mono">{b.total ? `$${b.total}` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                        {subtotalNum > 0 && (
                          <tfoot>
                            <tr className="border-t-2 border-gray-300" style={{ background: primaryColor + "08" }}>
                              <td colSpan={5} className="p-2 text-right font-bold text-xs text-gray-700">TOTAL TENDER SUM (inc GST)</td>
                              <td className="p-2 text-right font-bold text-sm font-mono" style={{ color: primaryColor }}>{au$(totalIncGst)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </>
                  )}

                  {/* 11. Dayworks */}
                  {dayworksRates.some(d => d.category) && (
                    <>
                      <SH title="11. Dayworks Schedule of Rates" />
                      <p className="text-xs text-gray-500 mb-3">The following rates apply to variations and additional works instructed on a Dayworks basis. All rates are exclusive of GST and include labour, tools and consumables only (materials charged at cost plus 15%).</p>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr style={{ background: primaryColor + "12" }}>
                            <th className="p-3 text-left text-xs uppercase text-gray-600 font-semibold">Labour Category / Plant</th>
                            <th className="p-3 text-right text-xs uppercase text-gray-600 font-semibold">Unit</th>
                            <th className="p-3 text-right text-xs uppercase text-gray-600 font-semibold">Rate (ex GST)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayworksRates.filter(d => d.category).map((d, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="p-3 font-medium text-gray-800">{d.category}</td>
                              <td className="p-3 text-right text-gray-500">{d.unit}</td>
                              <td className="p-3 text-right font-mono font-semibold text-gray-800">${d.rate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-xs text-gray-400 mt-2">Overtime, weekend and public holiday rates on application. Dayworks records must be signed by the Principal's Representative on the day of work.</p>
                    </>
                  )}

                  {/* 12. Payment Schedule */}
                  {subtotalNum > 0 && (
                    <>
                      <SH title="12. Payment Schedule" />
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr style={{ background: primaryColor + "15" }}>
                            <th className="p-3 text-left text-xs uppercase text-gray-600 font-semibold">Milestone</th>
                            <th className="p-3 text-left text-xs uppercase text-gray-600 font-semibold">%</th>
                            <th className="p-3 text-left text-xs uppercase text-gray-600 font-semibold">Amount (inc GST)</th>
                            <th className="p-3 text-left text-xs uppercase text-gray-600 font-semibold">Trigger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: "Deposit / Security", pct: depositPct, trigger: "Upon contract execution" },
                            { label: "Progress Claims", pct: progressPct, trigger: "Monthly, based on works completed" },
                            { label: "Retention (held)", pct: retentionPct, trigger: "Released after DLP" },
                            { label: "Final Payment", pct: finalPct, trigger: "Upon Practical Completion" },
                          ].map(({ label, pct, trigger }, i) => (
                            <tr key={label} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="p-3 font-medium text-gray-800">{label}</td>
                              <td className="p-3 text-gray-600">{pct}%</td>
                              <td className="p-3 font-mono text-gray-800">{au$(totalIncGst * parseFloat(pct) / 100)}</td>
                              <td className="p-3 text-gray-500 text-xs">{trigger}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-xs text-gray-400 mt-2">All claims subject to Superintendent assessment. Payment due within 15 business days of valid claim. Security of Payment Act applies.</p>
                    </>
                  )}

                  {/* 13. Value Engineering */}
                  {veOptions.some(v => v.description) && (
                    <>
                      <SH title="13. Value Engineering Alternatives" />
                      <p className="text-xs text-gray-500 mb-3">The following alternatives are offered to assist the Principal in meeting budget objectives without compromising quality or programme. All alternatives are optional and subject to Principal acceptance.</p>
                      <div className="space-y-3">
                        {veOptions.filter(v => v.description).map((v, i) => (
                          <div key={i} className="border rounded-xl p-4 flex items-start justify-between gap-4">
                            <div>
                              <div className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: primaryColor }}>{v.option}</div>
                              <div className="text-sm text-gray-700">{v.description}</div>
                            </div>
                            {v.saving && (
                              <div className="text-right flex-shrink-0">
                                <div className="text-xs text-gray-400">Saving</div>
                                <div className="font-bold text-green-600 font-mono">{v.saving.startsWith("-") ? v.saving : `-${v.saving}`}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* 14. Risk Register */}
                  {riskRegister.some(r => r.risk) && (
                    <>
                      <SH title="14. Risk Register" />
                      <p className="text-xs text-gray-500 mb-3">The following risks have been identified for this project. Mitigations are built into the programme and methodology.</p>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr style={{ background: primaryColor + "12" }}>
                            <th className="p-3 text-left text-xs uppercase text-gray-600 font-semibold">Risk</th>
                            <th className="p-3 text-xs uppercase text-gray-600 font-semibold">Prob.</th>
                            <th className="p-3 text-xs uppercase text-gray-600 font-semibold">Impact</th>
                            <th className="p-3 text-left text-xs uppercase text-gray-600 font-semibold">Mitigation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {riskRegister.filter(r => r.risk).map((r, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="p-3 font-medium text-gray-800 text-xs">{r.risk}</td>
                              <td className="p-3 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${riskColor(r.probability)}`}>{r.probability}</span></td>
                              <td className="p-3 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${riskColor(r.impact)}`}>{r.impact}</span></td>
                              <td className="p-3 text-gray-600 text-xs">{r.mitigation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* 15. Lessons Learnt */}
                  {lessonsLearnt && (
                    <>
                      <SH title="15. Lessons Learnt from Similar Projects" />
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{lessonsLearnt}</p>
                      </div>
                    </>
                  )}

                  {/* 16. Environmental */}
                  <SH title="16. Environmental Commitments" />
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {[
                      { label: "Waste Diversion Target", value: `${wasteTarget}%`, sub: "from landfill" },
                      { label: "EMP Delivery", value: "2 weeks", sub: "post contract award" },
                      { label: "NCC Compliance", value: "100%", sub: "all works" },
                    ].map(({ label, value, sub }) => (
                      <div key={label} className="text-center p-3 rounded-xl bg-green-50 border border-green-100">
                        <div className="text-xl font-bold text-green-700">{value}</div>
                        <div className="text-xs font-medium text-gray-600 mt-0.5">{label}</div>
                        <div className="text-[10px] text-gray-400">{sub}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{empNotes}</p>

                  {/* 17. Handover */}
                  {handoverItems.filter(Boolean).length > 0 && (
                    <>
                      <SH title="17. Handover Package" />
                      <p className="text-xs text-gray-500 mb-3">The following documentation and materials will be provided to the Principal at Practical Completion:</p>
                      <div className="space-y-2">
                        {handoverItems.filter(Boolean).map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-blue-500 font-bold mt-0.5 flex-shrink-0">✓</span>{item}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* 18. References */}
                  {references.some(r => r.company) && (
                    <>
                      <SH title="18. References" />
                      <div className="grid grid-cols-2 gap-4">
                        {references.filter(r => r.company).map((r, i) => (
                          <div key={i} className="border rounded-xl p-4 bg-gray-50">
                            <div className="font-semibold text-gray-800 mb-1">{r.company}</div>
                            <div className="text-sm text-gray-600">{r.contact}</div>
                            <div className="text-sm text-gray-500">{r.phone}</div>
                            <div className="text-xs text-gray-400 mt-2 italic">{r.project}</div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Additional references available upon request.</p>
                    </>
                  )}

                  {/* 19. Terms */}
                  <SH title="19. Terms & Conditions" />
                  <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-line bg-gray-50 rounded-xl p-5">{terms}</div>

                  {/* 20. Acceptance */}
                  <SH title="20. Execution & Acceptance" />
                  <p className="text-sm text-gray-500 mb-6">This tender, when accepted by the Principal, shall form the basis of a binding contract. Both parties confirm their authority to sign and enter into this agreement.</p>
                  <div className="grid grid-cols-2 gap-10">
                    <div className="border-2 rounded-xl p-5" style={{ borderColor: primaryColor + "40" }}>
                      <div className="text-xs uppercase tracking-wide text-gray-400 mb-4">For and on behalf of Contractor</div>
                      <div className="h-12 border-b-2 border-gray-300 mb-3" />
                      <div className="text-sm font-semibold text-gray-800">{companyName}</div>
                      {companyABN && <div className="text-xs text-gray-500">ABN: {companyABN}</div>}
                      {builderLicence && <div className="text-xs text-gray-500">Licence: {builderLicence}</div>}
                      <div className="mt-4 space-y-1 text-xs text-gray-400">
                        <div>Name: ____________________</div>
                        <div>Position: ____________________</div>
                        <div>Date: ____________________</div>
                      </div>
                    </div>
                    <div className="border-2 rounded-xl p-5" style={{ borderColor: accentColor + "60" }}>
                      <div className="text-xs uppercase tracking-wide text-gray-400 mb-4">For and on behalf of Principal</div>
                      <div className="h-12 border-b-2 border-gray-300 mb-3" />
                      <div className="text-sm font-semibold text-gray-800">{project?.client_name || "Client / Principal"}</div>
                      <div className="mt-4 space-y-1 text-xs text-gray-400">
                        <div>Name: ____________________</div>
                        <div>Position: ____________________</div>
                        <div>Date: ____________________</div>
                        <div>Company Seal (if applicable):</div>
                      </div>
                    </div>
                  </div>

                  {/* Document Footer */}
                  <div className="text-center text-xs text-gray-400 pt-6 border-t mt-8">
                    <div className="font-medium text-gray-600 mb-1">{companyName}</div>
                    {companyAddress && <div>{companyAddress}</div>}
                    <div className="flex justify-center gap-4 mt-1">
                      {companyPhone && <span>{companyPhone}</span>}
                      {companyEmail && <span>{companyEmail}</span>}
                    </div>
                    <div className="mt-1 space-x-3">
                      {companyABN && <span>ABN: {companyABN}</span>}
                      {companyACN && <span>ACN: {companyACN}</span>}
                    </div>
                    <div className="mt-2 text-gray-300">Tender {tenderNumber} · {companyName} · {fmt(today)} · CONFIDENTIAL</div>
                    <div className="text-gray-300">Generated with Metricore · This document is submitted in commercial confidence</div>
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
          #printable-tender, #printable-tender * { visibility: visible !important; }
          #printable-tender { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </>
  )
}
