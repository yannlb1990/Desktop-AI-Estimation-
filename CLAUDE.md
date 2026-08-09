# Metricore — Project Context (auto-loaded every session)

## Identity
- **Product**: Metricore — AI-powered PDF takeoff & cost estimation SaaS for Australian construction
- **Company**: Watermark Constructions (Yann Le Borgne)
- **Live URL**: https://www.metricore.com.au
- **Deployment**: Vercel (project `estimationapp` in org `money-claim-ai`)
- **Supabase project ref**: `dwimfbkwaebehxdavryg`

## Stack
React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + jsPDF + pdf.js + Fabric.js + Supabase

## Dev Server
- Port: **3002** (`vite.config.ts` — NOT 3001 which is MindBridge, NOT 5173)
- Start: `npm run dev`

## CRITICAL CONSTRAINTS — read before touching any file

| Constraint | Rule |
|-----------|------|
| **Fabric.js version** | Pinned at `^6.7.1`. NEVER upgrade to v7 — breaks `canvas.getPointer`, destroys all drawing tools |
| **Port** | Dev server on 3002 — never change vite.config.ts port |
| **State spelling** | `labourHours` (British) — NOT `laborHours`. Mismatching types causes silent $0 subtotals |
| **Supabase project ref** | `dwimfbkwaebehxdavryg` |
| **ANTHROPIC_API_KEY** | Set via: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref dwimfbkwaebehxdavryg` |
| **AI model** | Edge function `analyse-plan` uses `claude-sonnet-4-6` |
| **No em-dashes** | Never use em-dashes in UI copy — restructure as sentences |
| **No credentials in chat** | Tell user to run `export TOKEN=... && command` themselves |
| **No browser automation** | Give URL + describe instead — automation corrupts localStorage/auth |
| **No window.location.reload()** | Never call on Metricore — kills client-side auth session |

## Design System

Source of truth: `src/index.css`. Never use the old navy/cyan palette — that was a prior design iteration.

| Token | Value | Usage |
|-------|-------|-------|
| `bg-background` | `#0B0704` | Page background |
| `bg-card` | `#1A110A` | Card surfaces |
| Foreground/cream | `#E1DCC9` | Body text, CTA fill |
| Amber accent | `#D4A045` | Metric values, highlights |
| Border/dark brown | `#412D15` | Card borders, dividers |
| Muted text | `#8a7060` | Subdued labels |

Fonts: Poppins (display/headings), Inter (body), Space Grotesk (mono)
Cards: `rounded-xl border border-border bg-card`, icons `h-4 w-4`

## Architecture Overview

### Data Persistence
- ALL project data in `localStorage` — key `local_projects`. Zero Supabase for local data.
- Separate keys: `overhead_items_<projectId>`, `user_labour_rates`, `user_custom_trades`
- Supabase: auth, Stripe billing, edge functions (AI, email, checkout)

### State Management
- Main takeoff state: `useTakeoffState` reducer in `src/hooks/useTakeoffState.ts`
- Deduplication: `ADD_COST_ITEM` deduplicates by `rateId` first, then `name+unit` fallback
- `LOAD_PERSISTED_STATE` deduplicates on hydration

### AI Plan Analyser — 3-pass parallel architecture
- Edge function: `supabase/functions/analyse-plan/index.ts` (Claude claude-sonnet-4-6 vision)
- **3 focused passes run concurrently via Promise.all**: base (foundations/framing/roof/envelope), interior (openings/finishes/wet areas), services (electrical/plumbing/HVAC/external)
- Wall-clock: ~45-60s. Client-side `mergePassResults()` deduplicates by rateId.
- Hook: `src/hooks/useAIPlanAnalysis.ts`
- Inline panel: `src/components/takeoff/AIPlanAnalysisPanel.tsx` (accordion + observations dropdown)
- Full-screen modal: `src/components/takeoff/PlanAnalyserModal.tsx`
- Analysis cached in `localStorage` as `planAnalysis_<projectId>`

### PDF & Canvas
- Canvas: Fabric.js (PINNED `^6.7.1`) in `src/components/takeoff/InteractiveCanvas.tsx`
- getCSSPointer pattern: never use `canvas.getPointer(e, true)` — scroll-drift bug. Use `getCSSPointer(canvas, e.e)` from InteractiveCanvas.tsx
- PDF rendering: pdf.js in `src/lib/pdfService.ts`

### Subscription / Billing
- Stripe checkout: `supabase/functions/stripe-create-checkout`
- Stripe webhook: `supabase/functions/stripe-webhook` (fires `admin_new_payment` admin email)
- Plan caps: `src/lib/subscription.ts` (`getSubscriptionStatus`, `caps.planAnalysis`)
- Trial: activates from first verified sign-in

### Email — send-email edge function
- File: `supabase/functions/send-email/index.ts`
- FROM: `Metricore <noreply@risen-up.com>` (metricore.com.au not verified on Resend free plan)
- Templates: welcome, trial_ending, trial_expired, payment_receipt, payment_failed, quote_sent, admin_new_trial, admin_new_payment
- Admin notifications: `user-onboard` → admin_new_trial; `stripe-webhook` → admin_new_payment
- Admin recipients: `yannlb1990@gmail.com` + `admin@metricore.com.au`
- Logo: hosted PNG `https://www.metricore.com.au/metricore-icon.png` via `<img>` tag

## Key File Map

| File | Purpose |
|------|---------|
| `src/lib/takeoff/types.ts` | All TypeScript interfaces + `TRADE_OPTIONS` (26 trades) |
| `src/lib/takeoff/export.ts` | BOQ CSV export (professional QS format) |
| `src/lib/takeoff/sowGenerator.ts` | SOW PDF (jsPDF, Watermark format) |
| `src/lib/takeoff/rateResolver.ts` | `buildCostItemsFromTrades` — rate lookup + rateId pass-through |
| `src/data/scopeOfWorkRates.ts` | Rates DB — 60+ items, all Australian states |
| `src/hooks/useTakeoffState.ts` | Main reducer |
| `src/hooks/useAIPlanAnalysis.ts` | AI analysis hook + types |
| `src/components/takeoff/PDFTakeoff.tsx` | Main takeoff UI (upload/measure/costs tabs) |
| `src/components/takeoff/InteractiveCanvas.tsx` | Fabric.js canvas — ALL drawing tools |
| `src/components/takeoff/CostEstimator.tsx` | Cost items table + export buttons |
| `src/components/takeoff/AIPlanAnalysisPanel.tsx` | Inline AI panel (sidebar) |
| `src/components/takeoff/PlanAnalyserModal.tsx` | Full-screen AI modal |
| `src/components/takeoff/WallSetupDialog.tsx` | Wall config dialog + presets |
| `src/components/takeoff/GanttSchedule.tsx` | Gantt with critical path (CPM backward-pass) |
| `src/pages/ProjectDetail.tsx` | Main project page (tabs) |
| `src/lib/subscription.ts` | Plan caps + trial logic |
| `supabase/functions/analyse-plan/index.ts` | AI plan edge function |
| `supabase/functions/send-email/index.ts` | Transactional email via Resend |
| `supabase/functions/stripe-webhook/index.ts` | Stripe webhook + admin email |
| `supabase/functions/stripe-create-checkout/index.ts` | Stripe checkout session |

## Features Built (current as of 2026-08-09)

### Core Takeoff
- PDF upload, multi-page navigation, per-page scale storage
- Scale calibration: preset (A0/A1/A3/1:100/1:200) and manual
- Measurement tools: line, wall-line, arc-wall, rectangle, polygon, circle, count
- Wall setup dialog: batch spec (height, framing, lining, insulation), 5 presets
- Compact sidebar: single-row measurement cards, pinned totals, combine function

### Cost Estimator
- Editable cost items table (name, qty, unit, unit cost, labourHours, waste %, trade, subtotal)
- State selector (all 8 AU states) — multiplies rates
- Margin %, GST toggle, per-item waste/margin
- BOQ CSV export (AIQS standard) and Excel export (ExcelJS, 9 columns, logo, gap rows)
- SOW PDF generator (jsPDF, Watermark format)

### AI Plan Analyser (LIVE)
- 3-pass parallel architecture: base / interior / services (~45-60s)
- Accordion UI per trade: collapsed = name + qty + badge; expanded = materialSpec + nccRef + notes
- pendingItems section for unmatched rateIds

### Gantt Schedule
- Phase-sequential CPM backward-pass algorithm
- Critical (float=0): red left-edge accent + red dot
- Near-critical (float ≤7d): amber
- Float bar: dashed rgba extension
- Print, PDF, and Excel exports (all include critical path visuals)

### Client & Commercial
- Client Approval Portal (`/quote/:token`) — approve/reject, 30-day token
- Progress Claim PDF — SOPA-compliant, per-state act names
- Supplier Quote Email via Resend edge function
- Annotated PDF export

### Email Infrastructure
- 8 transactional templates via `send-email` edge function
- Admin notifications on every trial signup and payment
- Logo PNG served from `https://www.metricore.com.au/metricore-icon.png`

## Deployment Workflow
```bash
npm run build          # verify build passes
npx tsc --noEmit       # must be 0 errors before deploy
vercel --prod          # deploy to production
# OR: supabase functions deploy <fn-name> --project-ref dwimfbkwaebehxdavryg
```

## Supabase Infrastructure (current)
- `analyse-plan` — AI plan edge function ✅
- `stripe-create-checkout` — Stripe checkout ✅
- `stripe-webhook` — Stripe events + admin email ✅
- `send-email` — transactional email via Resend ✅
- `ANTHROPIC_API_KEY` set ✅
- Storage: `ffe-photos` + `plan-pdfs` buckets ✅
- Security: `assembly_trades` view uses `security_invoker = true` ✅

## Subscription Tiers
- **Starter**: no planAnalysis, no CSV/PDF/AnnotatedPDF/SOW exports (locked with PRO badge)
- **Pro**: planAnalysis enabled, all exports
- **Business**: same as Pro + team features

## Known Limitations
- Scanned/image-only PDFs return nothing from text extraction (pdf.js needs text layer)
- `AIExtractionPanel` requires Python backend — hidden from UI intentionally
- Mobile canvas unusable on phone (full desktop app)
- No Xero / MYOB accounting integration yet
