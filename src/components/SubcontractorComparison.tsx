import { useState, useEffect, useRef } from "react"
import { supabase } from "@/integrations/supabase/client"
import { getUserStorageKey } from "@/lib/localAuth"
import { syncProjectToSupabase } from "@/lib/db/projects"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { Plus, Trash2, CheckCircle2, Users, Phone, ChevronDown, ChevronRight, Building2 } from "lucide-react"
import { TRADE_OPTIONS } from "@/lib/takeoff/types"

export interface SubbieQuote {
  id: string
  trade: string
  company: string
  contact?: string
  phone?: string
  amount: number
  notes?: string
  submittedAt: string
  usedInEstimate?: boolean
}

interface SubcontractorComparisonProps {
  projectId: string
  onUsePrice?: (trade: string, company: string, amount: number) => void
}

const STORAGE_KEY = (pid: string) => `subcontractor_quotes_${pid}`

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
  // Embed in project record so Supabase sync picks it up
  try {
    const projectsRaw = localStorage.getItem(getUserStorageKey("local_projects")) || "[]"
    const projects = JSON.parse(projectsRaw)
    const idx = projects.findIndex((p: any) => p.id === pid)
    if (idx !== -1) {
      projects[idx].subcontractor_quotes = quotes
      localStorage.setItem(getUserStorageKey("local_projects"), JSON.stringify(projects))
      syncProjectToSupabase(projects[idx])
    }
  } catch { /* localStorage read error — standalone key still saved */ }
}

const fmtAUD = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n)

export const SubcontractorComparison = ({ projectId, onUsePrice }: SubcontractorComparisonProps) => {
  const [quotes, setQuotes] = useState<SubbieQuote[]>(() => loadQuotes(projectId))
  const [addOpen, setAddOpen] = useState(false)
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set())
  const suppressSave = useRef(false)

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
          const cloud: SubbieQuote[] = data.map((r: any) => ({
            id: r.id, trade: r.trade, company: r.company,
            contact: r.contact ?? undefined, phone: r.phone ?? undefined,
            amount: Number(r.amount), notes: r.notes ?? undefined,
            submittedAt: r.submitted_at, usedInEstimate: r.used_in_estimate ?? false,
          }))
          setQuotes(cloud)
          localStorage.setItem(getUserStorageKey(STORAGE_KEY(projectId)), JSON.stringify(cloud))
        }
      } catch {}
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
              submitted_at: q.submittedAt, used_in_estimate: q.usedInEstimate ?? false,
            } as any))
          )
        }
      } catch {}
    }, 1500)
    return () => clearTimeout(timer)
  }, [quotes, projectId])

  // New quote form state
  const [newTrade, setNewTrade] = useState<string>(TRADE_OPTIONS[0])
  const [newCompany, setNewCompany] = useState("")
  const [newContact, setNewContact] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newAmount, setNewAmount] = useState("")
  const [newNotes, setNewNotes] = useState("")

  const persist = (updated: SubbieQuote[]) => {
    setQuotes(updated)
    saveQuotes(projectId, updated)
  }

  const handleAdd = () => {
    if (!newCompany.trim()) { toast.error("Company name is required"); return }
    const amount = parseFloat(newAmount)
    if (isNaN(amount) || amount < 0) { toast.error("Enter a valid amount"); return }

    const entry: SubbieQuote = {
      id: crypto.randomUUID(),
      trade: newTrade,
      company: newCompany.trim(),
      contact: newContact.trim() || undefined,
      phone: newPhone.trim() || undefined,
      amount,
      notes: newNotes.trim() || undefined,
      submittedAt: new Date().toISOString(),
    }
    persist([...quotes, entry])
    setExpandedTrades(prev => new Set(prev).add(newTrade))
    setAddOpen(false)
    setNewCompany("")
    setNewContact("")
    setNewPhone("")
    setNewAmount("")
    setNewNotes("")
    toast.success(`Quote from ${entry.company} added`)
  }

  const handleDelete = (id: string) => {
    persist(quotes.filter(q => q.id !== id))
    toast.success("Quote removed")
  }

  const handleUsePrice = (q: SubbieQuote) => {
    if (!onUsePrice) return
    onUsePrice(q.trade, q.company, q.amount)
    // Mark quote as used in state + localStorage
    const updated = quotes.map(qq => qq.id === q.id ? { ...qq, usedInEstimate: true } : qq)
    persist(updated)
    toast.success(`${fmtAUD(q.amount)} from ${q.company} added to estimate`)
  }

  // Group by trade
  const byTrade = quotes.reduce((acc, q) => {
    if (!acc[q.trade]) acc[q.trade] = []
    acc[q.trade].push(q)
    return acc
  }, {} as Record<string, SubbieQuote[]>)

  const tradesWithQuotes = Object.keys(byTrade).sort()

  const toggleTrade = (trade: string) => {
    setExpandedTrades(prev => {
      const next = new Set(prev)
      if (next.has(trade)) next.delete(trade)
      else next.add(trade)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">Subcontractor Quotes</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Compare subbies for each trade and use the best price in your estimate
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Quote
        </Button>
      </div>

      {tradesWithQuotes.length === 0 ? (
        <Card className="p-10 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">No subcontractor quotes yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Add quotes from multiple subbies per trade to compare prices side-by-side
          </p>
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add First Quote
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {tradesWithQuotes.map(trade => {
            const tradeQuotes = byTrade[trade].sort((a, b) => a.amount - b.amount)
            const lowest = tradeQuotes[0]
            const expanded = expandedTrades.has(trade)

            return (
              <Card key={trade} className="overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => toggleTrade(trade)}
                >
                  <div className="flex items-center gap-3">
                    {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{trade}</span>
                    <Badge variant="outline" className="text-xs">{tradeQuotes.length} quote{tradeQuotes.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">Lowest:</span>
                    <span className="font-mono font-bold text-[#E1DCC9]/80">{fmtAUD(lowest.amount)}</span>
                    <span className="text-muted-foreground text-xs">— {lowest.company}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead>Company</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tradeQuotes.map((q, i) => (
                          <TableRow key={q.id} className={i === 0 ? "bg-muted/100/5" : ""}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {i === 0 && <CheckCircle2 className="h-3.5 w-3.5 text-[#E1DCC9]/80 shrink-0" />}
                                <span className="font-medium text-sm">{q.company}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {q.contact && <div>{q.contact}</div>}
                              {q.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {q.phone}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-mono font-bold text-sm ${i === 0 ? "text-[#E1DCC9]/80" : ""}`}>
                                {fmtAUD(q.amount)}
                              </span>
                              {i > 0 && (
                                <div className="text-xs text-red-400 text-right">
                                  +{fmtAUD(q.amount - tradeQuotes[0].amount)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                              {q.notes || "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(q.submittedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {q.usedInEstimate ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted/100/15 text-[#E1DCC9]/80 border border-[#E1DCC9]/20">
                                    <CheckCircle2 className="h-3 w-3" /> In estimate
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant={i === 0 ? "default" : "outline"}
                                    className={`h-7 text-xs ${i === 0 ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}`}
                                    onClick={() => handleUsePrice(q)}
                                  >
                                    Use this
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(q.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Quote Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Subcontractor Quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Trade</Label>
              <Select value={newTrade} onValueChange={setNewTrade}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRADE_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Company Name <span className="text-destructive">*</span></Label>
              <Input
                className="mt-1"
                placeholder="e.g. Smith Tiling Pty Ltd"
                value={newCompany}
                onChange={e => setNewCompany(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact Person</Label>
                <Input
                  className="mt-1"
                  placeholder="John Smith"
                  value={newContact}
                  onChange={e => setNewContact(e.target.value)}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  className="mt-1"
                  placeholder="0400 000 000"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Quote Amount (AUD, ex GST) <span className="text-destructive">*</span></Label>
              <Input
                className="mt-1 font-mono"
                type="number"
                placeholder="12500"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                className="mt-1"
                placeholder="Inclusions, conditions, lead time..."
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleAdd} className="flex-1">Add Quote</Button>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
