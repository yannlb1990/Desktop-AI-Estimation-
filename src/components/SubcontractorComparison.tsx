import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "@/integrations/supabase/client"
import { getUserStorageKey } from "@/lib/localAuth"
import { syncProjectToSupabase } from "@/lib/db/projects"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { normaliseTrade, sortTrades } from "@/lib/trades"
import { SupplierQuoteDialog } from "@/components/SupplierQuoteDialog"
import { estimateLinesAsCostItems } from "@/lib/estimate/fromCostItem"
import { resolveProjectPricing } from "@/lib/pricing/estimatePricing"
import { readUserPricingDefaults } from "@/lib/pricing/userPricingDefaults"
import { tradeCost, applySubbieQuote } from "@/lib/estimate/subbieAward"
import { setTradeBudget } from "@/lib/jobCostBudgets"
import { cn } from "@/lib/utils"

export type SubbieStatus = "requested" | "received" | "declined" | "awarded"

export interface SubbieQuote {
  id: string
  trade: string
  company: string
  contact?: string
  phone?: string
  email?: string
  /** their price, ex GST; 0 while waiting for it */
  amount: number
  notes?: string
  submittedAt: string
  usedInEstimate?: boolean
  /** a quote entered by hand, before this existed, is 'received' */
  status?: SubbieStatus
  requestedAt?: string
}

const STORAGE_KEY = (pid: string) => `subcontractor_quotes_${pid}`
const statusOf = (q: SubbieQuote): SubbieStatus => q.status ?? "received"

const loadQuotes = (pid: string): SubbieQuote[] => {
  try {
    const direct = localStorage.getItem(getUserStorageKey(STORAGE_KEY(pid)))
    if (direct !== null) return JSON.parse(direct)
    // Fallback: quotes embedded in project record (recovered from Supabase)
    const projects = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]")
    return projects.find((p: any) => p.id === pid)?.subcontractor_quotes ?? []
  } catch { return [] }
}

const saveQuotes = (pid: string, quotes: SubbieQuote[]) => {
  localStorage.setItem(getUserStorageKey(STORAGE_KEY(pid)), JSON.stringify(quotes))
  // Embed in project record so Supabase sync picks it up (with status, email and dates)
  try {
    const projects = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]")
    const idx = projects.findIndex((p: any) => p.id === pid)
    if (idx !== -1) {
      projects[idx].subcontractor_quotes = quotes
      localStorage.setItem(getUserStorageKey("local_projects"), JSON.stringify(projects))
      syncProjectToSupabase(projects[idx])
    }
  } catch { /* localStorage read error: standalone key still saved */ }
}

const readProject = (pid: string): any => {
  try { return JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]").find((p: any) => p.id === pid) ?? null }
  catch { return null }
}

const aud = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n)
const dateText = (iso?: string) => iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : ""
const STATUS_TEXT: Record<SubbieStatus, string> = { requested: "Waiting for price", received: "Price received", declined: "Declined", awarded: "Awarded" }

const EMPTY_FORM = { company: "", contact: "", phone: "", email: "", amount: "", notes: "" }

/**
 * Quotes from subcontractors, trade by trade: request them by email straight from the
 * estimate's lines, see who has replied, compare against your own estimate, and award one.
 * Awarding brings the trade's estimate lines to that price (before the client approves)
 * and sets the trade's Job Cost budget.
 */
export const SubcontractorComparison = ({ projectId }: { projectId: string }) => {
  const [quotes, setQuotes] = useState<SubbieQuote[]>(() => loadQuotes(projectId))
  const [project, setProject] = useState<any>(() => readProject(projectId))
  const [rfqTrade, setRfqTrade] = useState<string | null>(null)
  const [addFor, setAddFor] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({})
  const [awarding, setAwarding] = useState<SubbieQuote | null>(null)
  const [award, setAward] = useState({ updateEstimate: true, setBudget: true })
  const suppressSave = useRef(false)

  // The estimate changes elsewhere (lines added, client approval): keep this screen current
  useEffect(() => {
    const refresh = (e: Event) => { if ((e as CustomEvent).detail?.projectId === projectId) setProject(readProject(projectId)) }
    const onFocus = () => setProject(readProject(projectId))
    window.addEventListener("estimate-updated", refresh)
    window.addEventListener("contract-changed", refresh)
    window.addEventListener("focus", onFocus)
    return () => { window.removeEventListener("estimate-updated", refresh); window.removeEventListener("contract-changed", refresh); window.removeEventListener("focus", onFocus) }
  }, [projectId])

  // ── Supabase: load quotes on mount / projectId change ────────────────────────
  useEffect(() => {
    let cancelled = false
    suppressSave.current = true
    async function loadCloud() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || cancelled) { suppressSave.current = false; return }
        const { data } = await supabase
          .from('subcontractor_quotes')
          .select('id, trade, company, contact, phone, amount, notes, submitted_at, used_in_estimate')
          .eq('project_id', projectId)
          .eq('user_id', session.user.id)
          .order('submitted_at', { ascending: true })
        if (cancelled) return
        if (data && data.length > 0) {
          // the table has no status or email: keep what this device or the project record knows
          const local = new Map(loadQuotes(projectId).map(q => [q.id, q]))
          const cloud: SubbieQuote[] = data.map((r: any) => ({
            ...local.get(r.id),
            id: r.id, trade: r.trade, company: r.company,
            contact: r.contact ?? undefined, phone: r.phone ?? undefined,
            amount: Number(r.amount), notes: r.notes ?? undefined,
            submittedAt: r.submitted_at, usedInEstimate: r.used_in_estimate ?? false,
          }))
          setQuotes(cloud)
          localStorage.setItem(getUserStorageKey(STORAGE_KEY(projectId)), JSON.stringify(cloud))
        }
      } catch { /* offline: local copy stands */ }
      if (!cancelled) suppressSave.current = false
    }
    loadCloud()
    return () => { cancelled = true; suppressSave.current = false }
  }, [projectId])

  // ── Supabase: debounced save quotes ─────────────────────────────────────────
  useEffect(() => {
    if (suppressSave.current) return
    const timer = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        await supabase.from('subcontractor_quotes').delete()
          .eq('project_id', projectId).eq('user_id', session.user.id)
        if (quotes.length > 0) {
          await supabase.from('subcontractor_quotes').insert(
            quotes.map(q => ({
              id: q.id, project_id: projectId, user_id: session.user.id,
              trade: q.trade, company: q.company, contact: q.contact ?? null,
              phone: q.phone ?? null, amount: q.amount, notes: q.notes ?? null,
              submitted_at: q.submittedAt, used_in_estimate: statusOf(q) === "awarded",
            } as any))
          )
        }
      } catch { /* retried on the next change */ }
    }, 1500)
    return () => clearTimeout(timer)
  }, [quotes, projectId])

  const persist = (updated: SubbieQuote[]) => {
    setQuotes(updated)
    saveQuotes(projectId, updated)
  }

  // ── What the estimate says, per trade ───────────────────────────────────────
  const pricing = useMemo(() => project ? resolveProjectPricing(project, readUserPricingDefaults(project)) : null, [project])
  const approved = !!project?.approved_quote
  const estimateItems: any[] = project?.estimate_items ?? []
  const costFor = (trade: string) => pricing ? tradeCost(estimateItems, trade, pricing.config, pricing.labourRates) : 0
  const linesFor = (trade: string) => estimateItems.filter(i => normaliseTrade(i.trade) === normaliseTrade(trade))

  const trades = useMemo(() => sortTrades(new Set([
    ...estimateItems.map(i => normaliseTrade(i.trade)).filter(Boolean),
    ...quotes.map(q => normaliseTrade(q.trade)),
  ])), [estimateItems, quotes])

  const rfqItems = useMemo(() => {
    if (!rfqTrade || !project) return []
    return estimateLinesAsCostItems(project).filter((ci: any) => normaliseTrade(ci.trade || ci.category) === normaliseTrade(rfqTrade))
  }, [rfqTrade, project])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const onRequestsSent = (trade: string, sent: { supplier: { name: string; email: string; phone?: string }; sentAt: string }[]) => {
    let updated = [...quotes]
    for (const { supplier, sentAt } of sent) {
      const open = updated.find(q => normaliseTrade(q.trade) === trade && q.email === supplier.email && statusOf(q) === "requested")
      if (open) { updated = updated.map(q => q === open ? { ...q, requestedAt: sentAt } : q); continue }
      updated.push({
        id: crypto.randomUUID(), trade, company: supplier.name, email: supplier.email, phone: supplier.phone,
        amount: 0, submittedAt: sentAt, requestedAt: sentAt, status: "requested",
      })
    }
    persist(updated)
  }

  const addManual = () => {
    if (!addFor) return
    if (!form.company.trim()) { toast.error("Company name is required"); return }
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount < 0) { toast.error("Enter their price"); return }
    persist([...quotes, {
      id: crypto.randomUUID(), trade: addFor, company: form.company.trim(),
      contact: form.contact.trim() || undefined, phone: form.phone.trim() || undefined, email: form.email.trim() || undefined,
      amount, notes: form.notes.trim() || undefined, submittedAt: new Date().toISOString(), status: "received",
    }])
    setAddFor(null)
    setForm(EMPTY_FORM)
  }

  const enterPrice = (q: SubbieQuote) => {
    const amount = parseFloat(priceDraft[q.id] ?? "")
    if (isNaN(amount) || amount <= 0) { toast.error("Enter their price, ex GST"); return }
    persist(quotes.map(x => x.id === q.id ? { ...x, amount, status: "received", submittedAt: new Date().toISOString() } : x))
    setPriceDraft(d => { const n = { ...d }; delete n[q.id]; return n })
  }

  const setStatus = (q: SubbieQuote, status: SubbieStatus) => persist(quotes.map(x => x.id === q.id ? { ...x, status } : x))

  const startAward = (q: SubbieQuote) => {
    setAward({ updateEstimate: !approved, setBudget: true })
    setAwarding(q)
  }

  const confirmAward = () => {
    const q = awarding
    if (!q) return
    const trade = normaliseTrade(q.trade)
    if (award.updateEstimate && !approved && pricing) {
      const projects: any[] = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]")
      const idx = projects.findIndex(p => p.id === projectId)
      if (idx !== -1) {
        projects[idx].estimate_items = applySubbieQuote(projects[idx].estimate_items || [], trade, q.amount, q.company, pricing.config, pricing.labourRates)
        localStorage.setItem(getUserStorageKey("local_projects"), JSON.stringify(projects))
        syncProjectToSupabase(projects[idx])
        window.dispatchEvent(new CustomEvent("estimate-updated", { detail: { projectId } }))
        setProject(projects[idx])
      }
    }
    if (award.setBudget) setTradeBudget(projectId, trade, q.amount)
    // one subbie per trade: an earlier award in this trade goes back to a received price
    persist(quotes.map(x => x.id === q.id ? { ...x, status: "awarded" } :
      normaliseTrade(x.trade) === trade && statusOf(x) === "awarded" ? { ...x, status: "received" } : x))
    setAwarding(null)
    toast.success(`${trade} awarded to ${q.company}`)
  }

  const awardCost = awarding ? costFor(awarding.trade) : 0
  const awardDiff = awarding ? awarding.amount - awardCost : 0

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold">Subcontractor quotes</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Trade by trade: email the estimate's lines to your subbies, enter their prices as they come back, compare them with your estimate and award one.
        </p>
      </div>

      {trades.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Add lines to the estimate first: each trade on it shows here, ready to ask your subbies for a price.
        </Card>
      ) : trades.map(trade => {
        const list = quotes.filter(q => normaliseTrade(q.trade) === trade)
          .sort((a, b) => (statusOf(a) === "requested" ? 1 : 0) - (statusOf(b) === "requested" ? 1 : 0) || a.amount - b.amount)
        const priced = list.filter(q => ["received", "awarded"].includes(statusOf(q)))
        const lowest = priced.length ? Math.min(...priced.map(q => q.amount)) : null
        const waiting = list.filter(q => statusOf(q) === "requested").length
        const awarded = list.find(q => statusOf(q) === "awarded")
        const cost = costFor(trade)
        const lineCount = linesFor(trade).length
        return (
          <Card key={trade} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <span className="font-semibold">{trade}</span>
              <span className="text-sm text-muted-foreground">
                Your estimate: <span className="font-mono text-foreground">{aud(cost)}</span> cost{lineCount ? `, ${lineCount} line${lineCount !== 1 ? "s" : ""}` : ""}
              </span>
              <span className="text-sm text-muted-foreground">
                {awarded ? <>Awarded to <span className="text-[#D4A045]">{awarded.company}</span> at <span className="font-mono">{aud(awarded.amount)}</span></>
                  : [priced.length ? `${priced.length} priced, lowest ${aud(lowest!)}` : "", waiting ? `${waiting} waiting` : ""].filter(Boolean).join(", ") || "No quotes yet"}
              </span>
              <span className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" disabled={!lineCount} title={lineCount ? undefined : "No estimate lines for this trade to send"} onClick={() => setRfqTrade(trade)}>Request quotes</Button>
                <Button size="sm" variant="ghost" onClick={() => { setForm(EMPTY_FORM); setAddFor(trade) }}>Add a price</Button>
              </span>
            </div>
            {list.length > 0 && (
              <div className="border-t border-border text-sm">
                {list.map(q => {
                  const st = statusOf(q)
                  const diff = q.amount - cost
                  return (
                    <div key={q.id} className={cn("grid grid-cols-1 gap-2 border-b border-border/50 px-5 py-2 last:border-0 sm:grid-cols-[1fr_9rem_10rem_auto] sm:items-center", st === "declined" && "opacity-50", st === "awarded" && "bg-[#D4A045]/5")}>
                      <div className="min-w-0">
                        <span className="font-medium">{q.company}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[q.contact, q.email, q.phone].filter(Boolean).join(" · ")}{q.notes ? ` · ${q.notes}` : ""}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className={cn(st === "awarded" ? "text-[#D4A045]" : st === "requested" ? "text-amber-400" : "text-muted-foreground")}>{STATUS_TEXT[st]}</span>
                        <span className="block text-muted-foreground">{st === "requested" ? `asked ${dateText(q.requestedAt)}` : dateText(q.submittedAt)}</span>
                      </div>
                      <div className="sm:text-right">
                        {st === "requested" ? (
                          <span className="flex gap-1">
                            <Input className="h-8 font-mono" inputMode="decimal" placeholder="Their price ex GST" value={priceDraft[q.id] ?? ""}
                              onChange={e => setPriceDraft(d => ({ ...d, [q.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter") enterPrice(q) }} />
                            <Button size="sm" variant="outline" className="h-8" onClick={() => enterPrice(q)}>Save</Button>
                          </span>
                        ) : st !== "declined" && (
                          <>
                            <span className="font-mono font-semibold">{aud(q.amount)}</span>
                            {cost > 0 && <span className={cn("block text-xs", diff > 0 ? "text-red-400" : "text-emerald-400")}>{diff > 0 ? "+" : ""}{aud(diff)} on your estimate</span>}
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {st === "received" && <Button size="sm" className="h-7" onClick={() => startAward(q)}>Award</Button>}
                        {st === "requested" && <Button size="sm" variant="ghost" className="h-7" onClick={() => setStatus(q, "declined")}>Declined</Button>}
                        {st === "declined" && <Button size="sm" variant="ghost" className="h-7" onClick={() => setStatus(q, "requested")}>Undo</Button>}
                        <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => persist(quotes.filter(x => x.id !== q.id))}>Remove</Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )
      })}

      <SupplierQuoteDialog
        open={rfqTrade !== null}
        onClose={() => setRfqTrade(null)}
        items={rfqItems}
        projectName={project?.name}
        siteAddress={project?.site_address || project?.address}
        onSent={sent => rfqTrade && onRequestsSent(rfqTrade, sent)}
      />

      {/* A price that came back by phone, text or email */}
      <Dialog open={addFor !== null} onOpenChange={o => { if (!o) setAddFor(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add a price for {addFor}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-1 sm:grid-cols-2">
            <label className="block space-y-1 sm:col-span-2"><span className="text-xs text-muted-foreground">Company</span>
              <Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Smith Tiling Pty Ltd" /></label>
            <label className="block space-y-1"><span className="text-xs text-muted-foreground">Contact</span>
              <Input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></label>
            <label className="block space-y-1"><span className="text-xs text-muted-foreground">Phone</span>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="block space-y-1 sm:col-span-2"><span className="text-xs text-muted-foreground">Email</span>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
            <label className="block space-y-1 sm:col-span-2"><span className="text-xs text-muted-foreground">Their price, ex GST</span>
              <Input className="font-mono" inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
            <label className="block space-y-1 sm:col-span-2"><span className="text-xs text-muted-foreground">Notes (inclusions, exclusions, lead time)</span>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFor(null)}>Cancel</Button>
            <Button onClick={addManual}>Add price</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award: shows the difference first, then changes the estimate and budget */}
      <Dialog open={awarding !== null} onOpenChange={o => { if (!o) setAwarding(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Award {awarding && normaliseTrade(awarding.trade)} to {awarding?.company}?</DialogTitle></DialogHeader>
          {awarding && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg border border-border px-3 py-2">
                <span className="text-muted-foreground">{awarding.company}</span><span className="text-right font-mono">{aud(awarding.amount)}</span>
                <span className="text-muted-foreground">Your estimate (cost before markup)</span><span className="text-right font-mono">{aud(awardCost)}</span>
                <span className="font-medium">Difference</span>
                <span className={cn("text-right font-mono font-medium", awardDiff > 0 ? "text-red-400" : "text-emerald-400")}>{awardDiff > 0 ? "+" : ""}{aud(awardDiff)}</span>
              </div>
              {approved ? (
                <p className="text-muted-foreground">The client has approved the quote, so the estimate and the contract stay as they are. {awardDiff > 0 ? "If the client asked for extra work, add a variation." : ""}</p>
              ) : (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={award.updateEstimate} onChange={e => setAward({ ...award, updateEstimate: e.target.checked })} />
                  <span>Update the estimate: the {linesFor(awarding.trade).length || "new"} {normaliseTrade(awarding.trade)} line{linesFor(awarding.trade).length === 1 ? "" : "s"} come to this price, keeping rooms, quantities and your markup. The quote follows when you next generate it.</span>
                </label>
              )}
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={award.setBudget} onChange={e => setAward({ ...award, setBudget: e.target.checked })} />
                <span>Set the {normaliseTrade(awarding.trade)} budget in Job Cost to {aud(awarding.amount)}</span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwarding(null)}>Cancel</Button>
            <Button onClick={confirmAward}>Award</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
