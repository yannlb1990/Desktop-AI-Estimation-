# Metricore Product Backlog
_Generated 2026-06-09 — items deferred from audit report_

---

## Next Sprint (1–2 weeks)

### Content
- [ ] **Pricing page copy** — remove "Updated fortnightly" if rate data isn't actually refreshed on that cadence; replace with "regularly updated" or the real schedule
- [ ] **Hero subtitle** — A/B test "No guesswork, no spreadsheets" vs a benefit-led alternative ("Win more tenders with estimates that take minutes, not days")
- [ ] **Social proof** — replace "Trusted by subcontractors & builders" with real numbers or named testimonials once available; current copy is unsupported
- [ ] **Index.tsx** — add a dedicated Testimonials/Social Proof section between Features and Pricing

### UX / Design
- [ ] **Dashboard stats cards** — hide the four stat cards (Active Projects, Pipeline Value, Target Margin, Win Rate) when `projects.length === 0`; show onboarding prompt instead
- [ ] **Empty dashboard** — add a checklist-style "Getting started" guide (3 steps: create project → upload plan → take first measurement) instead of just the "No projects yet" card
- [ ] **Pricing page** — add a comparison table row for "Supported file types" (currently PDF only) and "Max pages per project" so buyers know the limits upfront
- [ ] **Mobile responsiveness** — audit dashboard project table on small screens; the 7-column grid collapses poorly below 768 px

### Accessibility
- [ ] **Colour-alone status** — the Stage badge still uses colour only (dot + text); add a short text label or shape inside the dot so it works on a greyscale display
- [ ] **Skip-to-content link** — add a visually hidden `<a href="#main">Skip to main content</a>` as the first element in Navigation for keyboard users
- [ ] **Tooltip keyboard access** — audit all Radix Tooltip instances; confirm they trigger on focus (not only hover) so keyboard-only users can read measurement labels

---

## Quarter (4–8 weeks)

### Features
- [ ] **Client portal (read-only share link)** — let builders share a project estimate link with their client; client can view but not edit; no login required
- [ ] **Export to Excel (.xlsx)** — fully formatted BOQ with trade groupings, quantities, unit rates, and totals; currently only PDF
- [ ] **DWG / CAD import** — the Features card says "PDF plans" now; when DWG support ships update the copy and add a badge "Now supports DWG"
- [ ] **Revision history** — show a timeline of measurement edits per project so users can see what changed before sending a revised tender
- [ ] **Bulk measurement operations** — select multiple measurements → assign trade, delete, or duplicate in one action
- [ ] **Scale calibration wizard** — step-by-step guided flow for first-time users with a known-dimension example (replaces the current single tooltip)

### UX / Design
- [ ] **Onboarding tour auto-start** — auto-trigger the product tour for new accounts on first dashboard load (currently the tour requires the user to find the button)
- [ ] **Keyboard shortcuts overlay** — `?` key opens a modal listing all canvas shortcuts (same as VS Code / Figma pattern)
- [ ] **Measurement label overflow** — long room names truncate inside the canvas panel; add a tooltip on hover showing the full label
- [ ] **Dark / light mode toggle** — currently forced dark; add a toggle in Settings and persist preference to localStorage

### SEO / Growth
- [ ] **Sitemap.xml** — generate and deploy `/sitemap.xml` referencing all public routes (/pricing, /about, /support, /privacy, /terms); submit to Google Search Console
- [ ] **OG image PNG** — export `metricore-construction-estimation-australia.svg` to PNG (1200×630) and save as same filename `.png`; Twitter card requires PNG, not SVG
- [ ] **Blog / Resources section** — even 3 articles ("How to read a construction plan", "NCC compliance for residential builds", "How to price a slab") will capture long-tail search traffic
- [ ] **Google Analytics / Plausible** — add privacy-friendly analytics to track which features and pages drive conversions; needed before running any paid acquisition

---

## Roadmap (quarter+)

### Major Features
- [ ] **AI auto-measure** — computer vision pass that detects rooms, walls, and openings from the uploaded PDF and pre-draws measurements for the user to review and confirm
- [ ] **Team / multi-seat plans** — invite team members to a project with role-based access (viewer, editor, admin); required before targeting mid-size contractors
- [ ] **Stripe billing self-service portal** — let users upgrade, downgrade, and access invoices without emailing support; Stripe customer portal is one integration call
- [ ] **IFC / BIM import** — import structured building model data from Revit/ArchiCAD exports for automatic quantity extraction
- [ ] **Subcontractor quote comparison** — send a scope of work to multiple subs, collect their quotes, and compare in a single view

### Platform
- [ ] **Native mobile app (iOS / Android)** — site visit capture: photo → AI measurement prompt → add to project; useful for variations and as-built documentation
- [ ] **Webhook / API** — let users push estimate data into their own accounting or project management tools (Xero, Procore, BuildXact)
- [ ] **White-label / reseller tier** — quantity surveyors or industry bodies can offer Metricore under their own brand

### Accessibility (WCAG 2.1 AA full compliance)
- [ ] **Screen reader audit** — run a full axe-core scan and fix all violations; target WCAG 2.1 AA for the dashboard and canvas views
- [ ] **Canvas keyboard navigation** — allow measurement selection and deletion using keyboard alone (Tab to cycle, Delete to remove, Enter to open edit panel)
- [ ] **High-contrast mode** — honour `prefers-contrast: more` media query; increase border and text contrast ratios in the canvas and measurement panel
