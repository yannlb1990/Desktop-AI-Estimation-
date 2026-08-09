# Metricore

AI-powered PDF takeoff and cost estimation for Australian builders and construction professionals.

**Live**: https://www.metricore.com.au

---

## What it does

Metricore lets you upload architectural plans as PDFs, measure areas and quantities directly on the plan, run AI analysis to generate trade estimates automatically, and export professional BOQs and SOWs — all in one workflow.

### Core features

- **PDF Takeoff** — Interactive canvas (Fabric.js) for measuring areas, lengths, counts, and walls directly on PDF plans
- **AI Plan Analyser** — Claude Sonnet reads the plans and generates 35+ trade estimates in ~45-60 seconds via 3 parallel passes
- **Cost Estimator** — Editable cost table with SOW rate database, state multipliers, margin, GST
- **Gantt Schedule** — Critical path method (CPM) with phase-sequential backward pass, red/amber visual accents
- **BOQ Export** — Professional QS format (AIQS standard), CSV and Excel
- **SOW PDF** — Scope of Works document in Watermark Constructions format
- **Progress Claims** — SOPA-compliant PDFs with per-state act names
- **Client Approval Portal** — Digital approve/reject via signed token link
- **NCC Compliance** — BCA Volume 1/2 compliance checklist built into estimating workflow
- **Market Insights** — SOW rates, labour rates, and supplier database for all 8 AU states

---

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Canvas**: Fabric.js (pinned at `^6.7.1`)
- **PDF**: pdf.js
- **Backend**: Supabase (Auth, Edge Functions, Storage)
- **Email**: Resend via `send-email` edge function
- **Billing**: Stripe
- **AI**: Claude claude-sonnet-4-6 via `analyse-plan` edge function
- **Deployment**: Vercel

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://dwimfbkwaebehxdavryg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

### 3. Run dev server

```bash
npm run dev
# Runs on http://localhost:3002
```

### 4. Deploy

```bash
npm run build && npx tsc --noEmit && vercel --prod
```

---

## Supabase Edge Functions

| Function | Purpose |
|----------|---------|
| `analyse-plan` | AI plan analysis (Claude claude-sonnet-4-6 vision, 3-pass parallel) |
| `send-email` | Transactional email via Resend |
| `stripe-create-checkout` | Stripe checkout session creation |
| `stripe-webhook` | Stripe event handling + admin notifications |

Deploy a function:
```bash
supabase functions deploy <function-name> --project-ref dwimfbkwaebehxdavryg
```

---

## Critical constraints

| Rule | Detail |
|------|--------|
| Fabric.js pinned `^6.7.1` | Never upgrade to v7 — breaks `canvas.getPointer` and all drawing tools |
| Dev port: 3002 | Set in `vite.config.ts` — do not change |
| `labourHours` spelling | British spelling throughout — mismatch causes silent $0 subtotals |
| No `window.location.reload()` | Kills client-side auth session |
| Resend FROM address | `noreply@risen-up.com` — `metricore.com.au` not verified on Resend free plan |

---

## Project structure

```
src/
├── components/
│   ├── takeoff/       # PDFTakeoff, InteractiveCanvas, CostEstimator, AI panels, Gantt
│   └── ui/            # shadcn/ui components
├── data/              # SOW rates database, trade options
├── hooks/             # useTakeoffState, useAIPlanAnalysis, etc.
├── lib/
│   ├── takeoff/       # types, export, sowGenerator, rateResolver, pdfService
│   └── subscription.ts
├── pages/             # ProjectDetail, MarketInsights, etc.
supabase/
├── functions/         # analyse-plan, send-email, stripe-*
└── migrations/        # DB schema
```

---

## Subscription tiers

| Tier | Features |
|------|---------|
| Starter | Takeoff + manual estimation only |
| Pro | + AI plan analyser, all exports (BOQ CSV, Excel, SOW PDF, Annotated PDF) |
| Business | Pro + team seats |

---

## License

Private — Watermark Constructions / Metricore
