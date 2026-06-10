# CLAUDE_LOG.md — Action Log for metricore.com.au

**Project:** Desktop AI Estimation → metricore.com.au  
**Stack:** React + TypeScript + Vite + Fabric.js v6 + pdf.js + Supabase + Vercel  
**Rule:** Updated by Claude after every task, build, deploy, or significant change.

---

## Format

```
### [DATE] — [ACTION TYPE]
**Task:** What was done
**Files changed:** List of files
**Outcome:** Result / status
**Notes:** Anything important to remember
```

---

## Log

---

### 2026-06-04 — FEATURE + DEPLOY (wall hatch side selector + toolbar visual redesign)
**Task:** Two combined improvements to wall hatch system:
1. **Face selector**: plasterboard/wet-area/cladding now render as thin strips on specific wall faces (l1/both/l2) rather than filling full wall width — matches real construction drawing conventions (plasterboard on both faces, cladding/wet-area on one face)
2. **Toolbar visual redesign**: wall configuration panel extracted into dedicated Row 2 that only appears when wall-line/arc-wall tool is active; card-style fill buttons with CSS gradient pattern previews and full labels; "Wall Fill | Thickness | Face" sections with dividers; dark amber theme  
**Files changed:**
- `src/lib/takeoff/types.ts`
  - Added `WallHatchSide` union type: `'l1' | 'both' | 'l2'`
  - Added `wallHatchSide?: WallHatchSide` field to `Measurement` interface
- `src/components/takeoff/InteractiveCanvas.tsx`
  - Added `wallHatchSide` prop and `wallHatchSideRef`
  - Refactored hatch rendering: face-lining types (plasterboard, wet-area, cladding) now use wall-local strip transform with nested canvas clip; `stripH = Math.max(hwPx * 0.28, 2.5 * dpr)`
  - `wallHatchSide: wallHatchSideRef.current` stored on measurement creation
- `src/components/takeoff/MeasurementToolbar.tsx`
  - Complete visual rewrite: wall config row extracted to dedicated Row 2
  - Card-style fill buttons (72px) with CSS gradient swatches + full labels
  - HATCH_FILLS array with `repeating-linear-gradient` previews per type
  - Face selector (l1/both/l2) only renders for face-lining types
  - Dark amber-themed panel: `bg-slate-800/70 border border-amber-900/40`
- `src/components/takeoff/PDFTakeoff.tsx`
  - Added `wallHatchSide` state (default `'both'`)
  - `handleWallHatchTypeChange` auto-defaults side: plasterboard→both, wet-area/cladding→l1
  - Both MeasurementToolbar + InteractiveCanvas instances wired to `wallHatchSide`

**Build:** ✅  
**Deploy:** ✅ `dpl_BXvuEhMaWegiQTatd3ZkWgedJgyv` → metricore.com.au  
**Behaviour:**
- Plasterboard: thin strips on both faces (or selected face), diagonal hatching within each strip
- Cladding: single strip on exterior face (l1 default), board lines parallel to wall
- Wet-area: single strip on interior face (l1 default), blue fill + diagonals
- Masonry / insulation / fire-rated / glazing: unchanged — fill full wall cross-section
- Toolbar: Row 2 (amber panel) appears only when wall-line/arc-wall active; card buttons show mini pattern previews; face buttons only visible for face-lining types

---

### 2026-06-02 — FEATURE + DEPLOY (wall hatch fills)
**Task:** Added 8 construction fill patterns for wall-line and arc-wall tools — masonry, plasterboard, fire-rated, insulation, cladding, wet-area, glazing, none  
**Files changed:**
- `src/lib/takeoff/types.ts`
  - Added `WallHatchType` union type export
  - Added `wallHatchType?: WallHatchType` field to `Measurement` interface
- `src/components/takeoff/InteractiveCanvas.tsx`
  - Added `wallHatchType` prop + `wallHatchTypeRef` (avoids stale closure)
  - Added first `after:render` pass (before label pass) — clips to wall polygon, draws hatch pattern per `measurement.wallHatchType`
  - Hatch patterns: masonry (brick bond, wall-local rotate), plasterboard (45° diagonals), fire-rated (dense diagonals + red tint), insulation (wavy lines, wall-local rotate), cladding (parallel lines along wall), wet-area (blue fill + diagonals), glazing (X cross pattern)
  - Both wall-line and arc-wall measurements include `wallHatchType: wallHatchTypeRef.current` on creation
  - Arc-wall: clipping uses quadratic bezier path matching the rendered shape
- `src/components/takeoff/MeasurementToolbar.tsx`
  - Added `wallHatchType` + `onWallHatchTypeChange` props
  - Hatch selector row appears when wall-line or arc-wall tool is active, positioned after wall thickness selector
  - 8 color-coded pill buttons: `–` `Mas` `Plas` `Fire` `Ins` `Clad` `Wet` `Glaz`
- `src/components/takeoff/PDFTakeoff.tsx`
  - Added `wallHatchType` state (default `'none'`)
  - Wired to both MeasurementToolbar instances (fullscreen + main)
  - Wired to both InteractiveCanvas instances

**Build:** ✅  
**Deploy:** ✅ `dpl_BpFCnj8ben17gZ14gGqazLCE9k8Y` → metricore.com.au  
**Behaviour:**
- Select wall-line or arc-wall tool → "Fill:" selector row appears in toolbar
- Choose hatch type before drawing; it's stored on the measurement and renders in `after:render`
- Old measurements with no `wallHatchType` render as plain walls (backward compatible)
- Hatch renders inside the wall polygon (clipped), behind labels and endpoint squares

---

### 2026-06-02 — FEATURE + DEPLOY (midpoint snapping)
**Task:** Added midpoint snapping to all drawing tools — endpoints still have priority, midpoints fire when cursor is within 12 screen-px of any edge midpoint  
**Files changed:**
- `src/components/takeoff/InteractiveCanvas.tsx`
  - Added `getMidpointsForMeasurement()` module-level helper — computes edge midpoints for lines, rectangles (4 edge mids), polygons (all edges), wall-lines, arc-walls
  - Added `computeSnapPoint()` module-level helper — unified snap: endpoints first, midpoints second
  - Added `midpointSnapRef` — stores current midpoint being hovered for the visual indicator
  - `after:render` — draws yellow triangle (AutoCAD midpoint style) at snap point
  - `handleMouseDown` — applies snap to click position so placed points land exactly on endpoints/midpoints
  - `handleMouseMove` — replaced old endpoint-only loop with `computeSnapPoint()` call
  - `handleMouseUp` — clears `midpointSnapRef` on draw complete

**Build:** ✅  
**Deploy:** ✅ `dpl_CZ5CZ32wBxzq7fBNrtVZ83yWzGoF` → metricore.com.au  
**Behaviour:**
- Hover near any wall endpoint → cyan circle snaps (existing)
- Hover near midpoint of any line/wall/polygon edge → yellow triangle appears, cursor locks to midpoint
- Click while snapping → point placed exactly at midpoint (perfect for symmetric arc P1/P2)
- Works on: line, rectangle, polygon, wall-line, arc-wall, count tools
- Shift-snap (45° angle) still fires after the midpoint snap

---

### 2026-06-02 — BUG FIX + DEPLOY
**Task:** Restored all drawing tools (line, polygon, rectangle, count, eraser, arc-wall) that were broken on metricore.com.au  
**Root cause:** A previous session changed `"fabric": "^6.7.1"` → `"fabric": "^7.4.0"` in package.json. Fabric v7 removed `canvas.getPointer()` (a canvas instance method used throughout `InteractiveCanvas.tsx`). Every mouse-down handler threw `TypeError: canvas.getPointer is not a function` silently in production, killing the handler before any drawing logic ran.  
**Files changed:**
- `package.json` — reverted `fabric` from `^7.4.0` back to `^6.7.1`
- `package-lock.json` — updated by `npm install` (Fabric v6.9.1 installed)
- `src/components/takeoff/InteractiveCanvas.tsx` — reverted to last committed state (removed broken `e.viewportPoint` fix attempts from previous sessions)
- `src/components/takeoff/PDFTakeoff.tsx` — kept one improvement: auto-close measurement popup when tool changes (prevents backdrop blocking canvas)

**Build:** ✅ `npm run build` — clean, 0 errors  
**Deploy:** ✅ `vercel --prod` → metricore.com.au live  
**Vercel deployment ID:** `dpl_DG6YAaXaQgBrfXUzGe1qXmZyfSiN`  
**Notes:**
- Fabric.js is pinned at `^6.7.1` — **NEVER upgrade to v7**. The entire canvas codebase uses v6 APIs (`canvas.getPointer`, event structure, etc). Upgrading silently breaks all drawing tools with no TypeScript warning (`skipLibCheck: true` in tsconfig).
- 5 failed deployment attempts preceded this fix across 2 sessions (attempts tried: CSS pointer-events, popup dismiss, viewport checks, stale closure refs, e.viewportPoint swap). Root cause was the version mismatch, not any logic bug.
- Previous failed attempts also added `isDrawingRef`/`startPointRef` — these were correct improvements but irrelevant to the actual crash. They were removed by reverting to committed state.

---

### 2026-06-01 — FEATURE + DEPLOY (from session summary)
**Task:** Multiple infrastructure improvements  
**Files changed:**
- `src/lib/api/` — typed API contract layer (new directory), eliminates frontend/backend drift
- DXF Web Worker — DXF files now rendered in background thread
- Signed plan URLs — PDF plans stored in Supabase Storage with signed access
- All 17 Supabase edge functions redeployed  
**Build:** ✅  
**Deploy:** ✅ → metricore.com.au  
**Notes:** All edge functions deployed to project `dwimfbkwaebehxdavryg` (NOT `tpvhkhphufdgfnqofwxf` — old project ID that caused broken Stripe in a previous session)

---

### 2026-05-18 — BUG FIX + NEW FEATURE + DEPLOY
**Task:** Critical Stripe "Failed to fetch" fix + new invite-based onboarding flow  
**Root cause (Stripe):** Two separate issues:
1. `supabase/config.toml` had wrong project_id `tpvhkhphufdgfnqofwxf` → all Edge Function deploys went to wrong project
2. `VITE_SUPABASE_URL` in Vercel had a trailing space → invalid URL caused network TypeError  
**Files changed:**
- `supabase/config.toml` — fixed project_id to `dwimfbkwaebehxdavryg`
- `src/pages/Auth.tsx` — signup tab replaced with lead capture form
- `src/pages/SetupPassword.tsx` — new page: detects invite session, creates password, activates trial
- `supabase/functions/user-onboard/` — new edge function: `inviteUserByEmail`, stores in profiles table
- `src/App.tsx` — added `/setup-password` route  
**Build:** ✅  
**Deploy:** ✅ All 5 Edge Functions redeployed to correct project  
**Notes:** Trial clock now activates from first verified sign-in. `/setup-password` added to Supabase Auth redirect URLs manually by user.

---

### 2026-05-19 — SECURITY AUDIT + DEPLOY
**Task:** Full codebase security audit — 3 batches  
**Batch 1:** Headers, package CVEs, signOut race, cache scoping, random upload path  
**Batch 2:** Edge function hardening across all 17 functions  
**Batch 3:** User-scoped storage keys (6 components missing `getUserStorageKey()`), subscription grace period, calculation guards (division by zero)  
**Files changed:** ~20 files across `src/`, `supabase/functions/`  
**Build:** ✅  
**Deploy:** ✅  
**Notes:** All `localStorage` keys must use `getUserStorageKey(key)` — zero-tolerance rule. Division by zero guards added to all 4 geometry calculation functions in `lib/takeoff/calculations.ts`.

---

### Previous sessions (pre-2026-05-18) — SUMMARY
**Key features built and deployed:**
- PDF Takeoff canvas: line, polygon, rectangle, circle, count, arc-wall, wall-line tools
- World coordinate system (zoom-independent, PDF-point based)
- Scale calibration (preset + manual drag-to-calibrate)
- Undo/redo history
- Per-page scale storage
- High-res PDF rendering (Fabric.js background image at renderQuality × scale, scaleX/Y compensated)
- BOQ CSV export (AIQS/Rawlinsons format, 32 Wentford St Mackay reference)
- SOW PDF generator (jsPDF + jspdf-autotable, Watermark Constructions format)
- Rates database (60+ items, 7 Australian states)
- Window/door detection (pdfTextExtractor — pdf.js text layer)
- Materials Library page + MaterialPickerDialog
- FullTenderGenerator
- OverheadManager
- MarketInsights page
- DXF file support (renders to PNG for measurement canvas)
- Supabase Storage for plan PDFs (signed URLs, cross-session persistence)
- Invite-based onboarding (replaces self-signup)
- Stripe checkout (plan selection at signup, subscribe-on-invite)
- Trial enforcement (30-day from first verified sign-in)
- Per-user data isolation (getUserStorageKey pattern)
