# Buildamax AI Tender - Feature Summary

## Overview
Advanced construction estimation platform with market-differentiating features designed to reduce estimation time and improve pricing accuracy for Australian builders and tradies.

---

## Phase 1: Core Features (Completed)

### 1. Smart Project Templates System
**File:** `src/data/projectTemplates.ts`

Pre-built templates for common Australian construction jobs:
- Bathroom Renovation (full & budget)
- Kitchen Renovation
- Granny Flat 60m²
- Timber Deck (various sizes)
- Switchboard Upgrade
- Laundry Renovation

**Features:**
- Line items with NCC codes
- Typical budget ranges
- Common variations
- Required vs optional items

**UI Component:** `src/components/features/ProjectTemplateSelector.tsx`

---

### 2. Quote Confidence & Margin Calculator
**File:** `src/lib/quoteAnalyzer.ts`

**Features:**
- Quote confidence scoring (0-100)
- Margin analysis with industry benchmarks
- Pricing anomaly detection
- Risk assessment (low/medium/high)
- Completeness checking
- Missing item suggestions

**Industry Margins Included:**
- Bathroom renovation: 20-30%
- Kitchen renovation: 22-32%
- Decks: 25-35%
- Painting: 35-50%
- General building: 20-30%

**UI Component:** `src/components/features/QuoteAnalyzerPanel.tsx`

---

### 3. Enhanced NCC Compliance Checker
**File:** `src/lib/nccComplianceChecker.ts`

**Features:**
- Auto-detects work types from line items
- Checks against NCC 2022 requirements
- Generates missing item suggestions
- Compliance score calculation
- Mandatory vs recommended requirements

**Work Types Covered:**
- Bathroom (AS3740 waterproofing, ventilation)
- Shower (waterproofing, outlets, fixtures)
- Laundry (waterproofing, drainage, ventilation)
- Deck (balustrade compliance, structural)
- Electrical (RCD protection, smoke alarms)
- Plumbing (backflow, TMVs, pressure limiting)
- Insulation (R-values by climate zone)
- Glazing (safety glass, energy rating)
- Fire (smoke alarms, extinguishers)
- Access (ramps, grab rails, door widths)

**UI Component:** `src/components/features/NCCCompliancePanel.tsx`

---

## Phase 2: Time-Saving Features (Completed)

### 4. Live Material Price Feeds
**File:** `src/lib/materialPricing.ts`

**Features:**
- Real-time material price tracking
- Supplier comparison
- Price change alerts
- Price trend analysis
- In-stock status tracking

**Sample Categories:**
- Timber (structural, decking)
- Plasterboard
- Roofing
- Insulation
- Concrete
- Electrical
- Plumbing
- Tiles

---

### 5. Subcontractor Price Book
**File:** `src/lib/subbieRates.ts`

**Features:**
- Subcontractor management
- Rate tracking with history
- Rate change percentage tracking
- Best rate finder
- Trend analysis

**Default Rates by Trade:**
- Plumber (hourly, rough-in, fit-off, HWS)
- Electrician (hourly, GPO, lights, switchboard)
- Tiler (floor, wall, with/without materials)
- Waterproofer (shower, floor, certificate)
- Painter (interior, exterior, doors)
- Carpenter (hourly, door hang, deck)
- Plasterer (install, set, cornice)
- Concreter (slab, footpath, piers)
- Demolition (bathroom/kitchen stripout, skip bins)

---

### 6. Revision Tracker with Diff View
**File:** `src/lib/revisionTracker.ts`

**Features:**
- Compare estimate revisions
- Field-level change tracking
- Variation notice generation
- Australian-format documents
- Revision history timeline
- Cumulative change tracking

**UI Component:** `src/components/features/RevisionDiffViewer.tsx`

---

### 7. One-Click Supplier RFQ
**File:** `src/lib/api/supplierApi.ts`

**Features:**
- Supplier database management
- Quote request creation
- Email template generation
- Quote tracking (sent/received/accepted)
- Multi-item RFQs
- Delivery scheduling

---

## Phase 3: Advanced Features (Planned)

### 8. AI Symbol Recognition (Foundation)
- Plan/drawing symbol detection
- Common construction symbols library
- Integration points prepared

### 9. Photo-to-Estimate Module
- Site photo analysis
- Measurement extraction
- Material identification

---

## Backend Infrastructure (Completed)

### API Layer
**Location:** `src/lib/api/`

**APIs Implemented:**
1. `estimateApi.ts` - Estimate CRUD, line items, revisions
2. `projectApi.ts` - Project management, status tracking
3. `supplierApi.ts` - Supplier management, RFQ system
4. `webhooks.ts` - Real-time event notifications
5. `marketInsightsApi.ts` - Labour rates, SOW rates, pricing

**Features:**
- Unified API response format
- Error handling with retry
- Batch operations support
- GST calculations
- Margin calculations

---

### Webhook System
**File:** `src/lib/api/webhooks.ts`

**Events Supported:**
- estimate.created/updated/sent/approved/rejected
- project.created/updated/won/lost
- quote_request.sent/received
- price.alert
- compliance.warning

**Features:**
- HMAC signature verification
- Exponential backoff retry
- Delivery history tracking
- Test endpoint

---

### Database Schema
**File:** `supabase/migrations/001_initial_schema.sql`

**Tables:**
- projects
- estimates
- estimate_line_items
- suppliers
- supplier_quote_requests
- subcontractors
- subcontractor_rates
- rate_history
- material_prices
- webhooks
- webhook_deliveries
- project_templates
- ncc_compliance_checks

**Features:**
- Row Level Security (RLS)
- Auto-updating timestamps
- Trigger-based total recalculation
- Rate change history tracking
- Full indexing for performance

---

## Market Insights Data (Completed)

### Labour Rates by State
**File:** `src/lib/api/marketInsightsApi.ts`

All 8 Australian states/territories:
- NSW, VIC, QLD, WA, SA, TAS, NT, ACT

Trades covered:
- Carpenter, Plumber, Electrician, Tiler
- Painter, Plasterer, Concreter, Labourer

### SOW Rates
Scope of work pricing for:
- Bathroom work (rough-in, fit-off, tiling)
- Electrical (GPO, lights, switchboard)
- Carpentry (door hang, deck work)
- Painting (interior/exterior)
- Plastering (install, set)
- Concrete (slabs, footpaths)

---

## UI Components

**Location:** `src/components/features/`

1. **ProjectTemplateSelector.tsx**
   - Template search and filter
   - Category selection
   - Line item selection
   - Preview with totals

2. **QuoteAnalyzerPanel.tsx**
   - Confidence score display
   - Margin analysis cards
   - Risk assessment alerts
   - Pricing anomaly warnings

3. **NCCCompliancePanel.tsx**
   - Compliance score gauge
   - Work type badges
   - Missing items list
   - Requirements accordion

4. **RevisionDiffViewer.tsx**
   - Side-by-side comparison
   - Change type highlighting
   - Variation notice generator
   - History timeline

---

## File Structure

```
src/
├── components/
│   └── features/
│       ├── index.ts
│       ├── ProjectTemplateSelector.tsx
│       ├── QuoteAnalyzerPanel.tsx
│       ├── NCCCompliancePanel.tsx
│       └── RevisionDiffViewer.tsx
├── data/
│   ├── projectTemplates.ts
│   ├── australianMaterials.ts
│   ├── marketLabourRates.ts
│   ├── nccReferences.ts
│   ├── scopeOfWorkRates.ts
│   └── supplierDatabase.ts
├── lib/
│   ├── api/
│   │   ├── index.ts
│   │   ├── estimateApi.ts
│   │   ├── projectApi.ts
│   │   ├── supplierApi.ts
│   │   ├── webhooks.ts
│   │   ├── marketInsights.ts
│   │   └── marketInsightsApi.ts
│   ├── quoteAnalyzer.ts
│   ├── nccComplianceChecker.ts
│   ├── nccLookup.ts
│   ├── materialPricing.ts
│   ├── subbieRates.ts
│   └── revisionTracker.ts
└── ...

supabase/
└── migrations/
    └── 001_initial_schema.sql
```

---

## Ready for Production

The codebase is ready for:
1. New GitHub repository push
2. Supabase database deployment
3. Further UI integration
4. Testing and QA

---

## Next Steps (When Ready)

1. Create new GitHub repository
2. Push code to new repo
3. Run Supabase migrations
4. Connect frontend to Supabase
5. Deploy to production hosting
6. Configure webhooks for integrations
