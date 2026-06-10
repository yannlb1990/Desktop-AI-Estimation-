# Metricore — Lessons Learned & Skills Acquired

> Built: PDF takeoff / cost estimation SaaS for Australian construction  
> Stack: React + TypeScript + Vite + Fabric.js v6.7.1 + pdf.js + Supabase  
> Production: metricore.com.au

Every entry traces to a real incident. Not guidelines — scars.

---

## Table of Contents

1. [Critical Rules — Read First](#1-critical-rules--read-first)
2. [Fabric.js & Canvas](#2-fabricjs--canvas)
3. [React & State Management](#3-react--state-management)
4. [Persistence & Data Layer](#4-persistence--data-layer)
5. [Auth & Security](#5-auth--security)
6. [PDF Rendering](#6-pdf-rendering)
7. [UI/UX & Component Patterns](#7-uiux--component-patterns)
8. [Architecture & Project Startup](#8-architecture--project-startup)
9. [Construction Domain Knowledge](#9-construction-domain-knowledge)
10. [Debugging Protocols](#10-debugging-protocols)

---

## 1. Critical Rules — Read First

These are the rules that would have saved the most rework if applied from day one.

| Rule | Where it hurt |
|------|--------------|
| **Fabric.js v6.7.1 — NEVER upgrade to v7** | Mistake 14: `getPointer` removed in v7, all drawing tools silently died |
| **React `key` must encode every identity dimension** | Mistake 7: switching plans didn't remount canvas, old plan measurements stayed |
| **Three-map delete: always clear objectsRef + mapRef + shapeToMeasurementIdRef atomically** | Mistake 17: erased measurements reappeared as ghosts |
| **Single persistent preview object, mutated in-place** | Mistake 15: create/remove/add per mousemove → starburst of stuck lines |
| **Every preview tool needs a tool-change sweep** | Mistake 16: switching tools left wall preview stuck on canvas |
| **Supabase auth on day one** | Mistake 6: localStorage auth required touching 15+ files to migrate |
| **Every localStorage key must use `getUserStorageKey()`** | Mistake 11: unscoped keys mixed data across users |
| **Divisor functions guard against zero at the function boundary** | Mistake 12: `Infinity`/`NaN` propagated through cost estimation before calibration |

---

## 2. Fabric.js & Canvas

### 2.1 Version Lock

**Fabric.js is pinned at `^6.7.1` — never upgrade to v7.**

- v7 removes `canvas.getPointer(e, ignoreZoom)` (replaced by `canvas.getViewportPoint` / `canvas.getScenePoint`)
- TypeScript won't catch it because `tsconfig.app.json` has `"skipLibCheck": true`
- The error is silent in production — the handler exits before drawing logic runs
- Symptom: nothing happens on click, no visible error
- Diagnosis: open DevTools, click canvas, look for `TypeError: canvas.getPointer is not a function`

### 2.2 Canvas Remounting — The `key` Invariant

Any component wrapping Fabric.js has internal state React does not control. Changing props is NOT enough to reset it — you must change `key` to force unmount+remount.

```tsx
// WRONG — remounts on page change only; plan change keeps old canvas objects
<InteractiveCanvas key={state.currentPageIndex} />

// RIGHT — remounts on page OR plan change
<InteractiveCanvas key={`${state.currentPageIndex}-${state.pdfFile?.planId ?? 'none'}`} />
```

Rule: the `key` must encode **every dimension of identity** that should produce a clean slate.

### 2.3 Single Persistent Preview Object

Never create/destroy canvas objects per mousemove. Create ONE object on first move, mutate it in-place with `.set({...})` + `.setCoords()`.

```typescript
if (previewShapeRef.current && (previewShapeRef.current as any)._isWallPreviewRect) {
  // UPDATE IN PLACE — no canvas.remove(), no canvas.add()
  previewShapeRef.current.set({ left: midX, top: midY, width: wallLength, angle: wallAngleDeg });
  previewShapeRef.current.setCoords();
  shape = previewShapeRef.current;
} else {
  // FIRST MOVE — create once
  shape = new Rect({ originX: 'center', originY: 'center', ... });
  (shape as any)._isWallPreviewRect = true;
  canvas.add(shape);
}
```

The create→remove→add cycle is racy. Fabric.js doesn't guarantee atomicity — intermediate renders accumulate objects.

### 2.4 Tool-Change Sweep Pattern

Every drawing preview tool needs cleanup in the `activeTool` useEffect. Pattern:

```typescript
// In the activeTool useEffect:
if (activeTool !== 'my-tool') {
  if (canvas) {
    const toRemove: any[] = [];
    canvas.getObjects().forEach((obj: any) => {
      if (obj._myPreviewMarker) toRemove.push(obj);
    });
    toRemove.forEach(obj => { try { canvas.remove(obj); } catch (_) {} });
    if (toRemove.length > 0) {
      previewLabelRef.current = null;
      canvas.requestRenderAll();
    }
  }
  if (previewShapeRef.current && (previewShapeRef.current as any)._myPreviewMarker) {
    previewShapeRef.current = null;
  }
}
```

Mark every preview object with a custom property (`_isWallPreviewRect`, `_wallPreviews`, etc.) so the sweep can identify them.

### 2.5 Three-Map Delete Invariant

The restore loop in `useEffect([measurements])` works as: "if ID is in measurements prop AND NOT in objectsRef → re-add to canvas." Any imperative delete that clears `objectsRef` but leaves the ID in `mapRef` creates a ghost restoration window.

**Always clear all three maps atomically before calling `onDeleteMeasurement`:**

```typescript
measurementObjectsRef.current.delete(id);
measurementMapRef.current.delete(id);          // ← never skip this
// shapeToMeasurementIdRef.current.delete(obj) for each canvas shape
onDeleteMeasurement?.(id);
```

### 2.6 Real-Time Label Positioning — Use `calcTransformMatrix()`

In `after:render` callbacks, NEVER read stored coordinates (worldPoints, cached metadata) to position labels during drag. Those values are only updated on `object:modified` (mouse-up). Use the live transform:

```typescript
const mat = shape.calcTransformMatrix();
const p1 = fabricUtil.transformPoint(new FabricPoint((shape as any).x1, (shape as any).y1), mat);
const p2 = fabricUtil.transformPoint(new FabricPoint((shape as any).x2, (shape as any).y2), mat);
```

`calcTransformMatrix()` reflects the current world position every render frame — including mid-drag.

### 2.7 Stale Closure Avoidance — Toolbar State via Refs

Fabric.js mouse event callbacks are registered once in `useEffect` and close over initial state. Sync every transient toolbar value to a `useRef`:

```typescript
const wallHatchTypeRef = useRef(wallHatchType ?? 'none');
useEffect(() => { wallHatchTypeRef.current = wallHatchType ?? 'none'; }, [wallHatchType]);

// In the mousedown handler — always reads current value:
const m: Measurement = {
  wallHatchType: wallHatchTypeRef.current as WallHatchType,
  color: drawColorRef.current,
};
```

### 2.8 Face-Specific Rendering — Wall-Local Transform

For face-lining materials (plasterboard, cladding, wet-area), render as thin strips on wall faces using wall-local coordinates:

```typescript
ctx.save();
ctx.translate(midX, midY);      // wall midpoint
ctx.rotate(wallAngle);          // align x-axis along wall
// Now: x = along wall, y = across wall (0 = center, -hwPx = l1 face, +hwPx = l2 face)
const stripH = Math.max(hwPx * 0.28, 2.5 * dpr);
ctx.beginPath();
ctx.rect(-halfLen, -hwPx, halfLen * 2, stripH);   // l1 face strip
ctx.clip();
// draw fill + hatching here
ctx.restore();
```

Face lining types: `new Set(['plasterboard', 'wet-area', 'cladding'])`. Masonry, insulation, glazing fill the full cross-section.

### 2.9 Object Caching

Set `objectCaching: false` on all background PDF images in Fabric.js. With caching on, Fabric re-rasterises from the internal cache at display resolution — defeating the high-res pre-render.

---

## 3. React & State Management

### 3.1 useCallback — Missing Dependencies = Stale Values

Every value read inside a `useCallback` that is NOT a ref or dispatch function MUST be in the dependency array:

```typescript
// WRONG — state.pdfFile?.planId is stale after plan change
const handleMeasurementComplete = useCallback(() => {
  stamp(planId: state.pdfFile?.planId)
}, [dispatch, isVerifyMode, modMode]);  // ← planId missing

// RIGHT
}, [dispatch, isVerifyMode, modMode, state.pdfFile?.planId]);
```

Enable ESLint `react-hooks/exhaustive-deps` and treat it as an error, not a warning.

### 3.2 Filter Pass-Through Anti-Pattern

Never write `!m.planId || !currentPlanId || m.planId === currentPlanId` as "backward compat". This silently passes all untagged data through. Handle old data at load time (migration/tagging in `loadPersisted`), keep the filter strict:

```typescript
// RIGHT — strict
if (state.pdfFile?.planId && m.planId !== state.pdfFile.planId) return false;
```

A strict filter makes migration failures visible immediately. A loose filter hides them.

### 3.3 Prop Changes Do Not Reset Imperative Libraries

Any component wrapping an imperative library (Fabric.js, Three.js, Chart.js, Leaflet) maintains its own internal state that React does not see. To reset it, you must change the `key` prop — not just pass different props.

Debugging order: read the consumer component first to understand its internal state model. Then check whether the producer is triggering a remount when it should.

---

## 4. Persistence & Data Layer

### 4.1 New Field Persistence Checklist

Adding a field to a TypeScript type does NOT persist it. Every new field on a persisted type requires updating four layers as a single atomic change:

- [ ] Add to the `PersistedState` interface
- [ ] Write in `savePersisted`
- [ ] Read in `loadPersisted` (apply migration / pre-tagging for old data)
- [ ] Restore in `buildInitialState`
- [ ] Update any `useCallback`/`useEffect` closures that read this field

Skipping any layer creates silent data loss on page refresh.

### 4.2 Coordinate Storage Convention

Store all measurement coordinates in PDF-point space at scale 1.0. Never bake the calibration scale into stored coordinates. Convert to real-world units at display time using the calibration factor.

This is essential because calibration can be recalculated, and different pages can have different scales.

### 4.3 Per-Page Calibration Storage

Plans often have different scales on different pages (A0 site plan 1:500, A1 floor plan 1:100). Calibration must be stored per-page, not per-document.

---

## 5. Auth & Security

### 5.1 Use Supabase Auth from Day One

Building a localStorage-based auth system and migrating later costs 10× more than starting correctly. Supabase auth gives email verification, password reset, session management, and bot protection for free. Setup takes ~20 minutes.

```typescript
// emailRedirectTo must work on any deployment:
await supabase.auth.signUp({
  email, password,
  options: { emailRedirectTo: window.location.origin + '/auth' }
});
```

### 5.2 Synchronous `isSignedIn()` via Direct localStorage Read

Supabase stores sessions at `sb-{projectRef}-auth-token`. Reading this synchronously avoids async cascading through 10+ components:

```typescript
export function isSignedIn(): boolean {
  try {
    const key = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (!key) return false;
    const parsed = JSON.parse(localStorage.getItem(key)!);
    if (parsed?.expires_at && Date.now() / 1000 > parsed.expires_at) return false;
    return !!(parsed?.user?.email_confirmed_at);  // unverified = signed-out
  } catch { return false; }
}
```

Check `email_confirmed_at` — unverified users with a session are treated as signed out.

### 5.3 localStorage Key Scoping

Every `localStorage.getItem/setItem/removeItem` in a user-authenticated SPA must use `getUserStorageKey(key)`. Unscoped keys mix data across users on shared devices.

Enforce with grep: `grep -r "localStorage\.\(getItem\|setItem\|removeItem\)(" src/` should return zero results without `getUserStorageKey` on the same line.

---

## 6. PDF Rendering

### 6.1 High-Resolution PDF in Fabric.js

Fabric.js renders the PDF at 1× then zooms via `setViewportTransform`. At high zoom, the bitmap upscales and blurs.

**Fix**: Pre-render at 3–6× resolution, compensate with `scaleX/scaleY`:

```typescript
const maxDim = Math.max(baseViewport.width, baseViewport.height);
const renderQuality = Math.max(3.0, Math.min(6.0, 12000 / maxDim));  // cap at ~12000px
const hiResViewport = page.getViewport({ scale: renderQuality });
// render to tempCanvas at hiResViewport size...
const img = await FabricImage.fromURL(dataUrl);
img.set({
  scaleX: 1 / renderQuality,   // visual size stays at 1.0 units
  scaleY: 1 / renderQuality,
  objectCaching: false,
});
fabricCanvas.backgroundImage = img;
```

Coordinate math stays at scale 1.0 throughout — the `scaleX/scaleY` affects only rendering.

The cap `12000 / maxDim` prevents exceeding browser canvas pixel limits (~16,384px) for large A0 plans.

### 6.2 DPR-Aware Rendering (Standard HTML Canvas)

For non-Fabric canvas rendering:

```typescript
const dpr = window.devicePixelRatio || 1;
const viewport = page.getViewport({ scale: finalScale * dpr });
canvas.width = viewport.width;
canvas.height = viewport.height;
canvas.style.width  = `${viewport.width  / dpr}px`;
canvas.style.height = `${viewport.height / dpr}px`;
```

Without DPR, a Retina display (DPR=2) renders a 1× bitmap displayed at 2× → blurry.

### 6.3 Identify the Correct Component Before Touching a PDF Bug

Two components render PDFs: `PDFAnalysisViewer.tsx` (normal view) and the fullscreen portal in `PDFTakeoff.tsx` using `InteractiveCanvas.tsx`. Screenshots tell you which one: look at which toolbar buttons are present and their positions. Fix the component the user is actually seeing.

---

## 7. UI/UX & Component Patterns

### 7.1 Z-Index Stack — Define Before Building Any Modal

Establish the full z-index stack before building fullscreen views or modals. Once a fullscreen portal is at z-9999, all Radix UI components inside it (Select, Sheet, Dialog, DropdownMenu, Popover, Tooltip) must be above it — they all render to `document.body` via their own portal.

**Convention established in this project:**

| Layer | z-index |
|-------|---------|
| Base content | 1–50 |
| Tooltips / dropdowns (normal mode) | 50 |
| Fullscreen portal | 9999 |
| Sheet/Dialog overlay (fullscreen) | 10000 |
| Select/Popover content (fullscreen) | 10001 |

Do this at component creation time. `SelectContent` uses `z-50` by default — override in `select.tsx`.

### 7.2 Contextual Toolbar Panels

Cramming tool-specific controls (thickness, fill type, face side) into the main toolbar row creates visual clutter and confusion. Use a second row that only renders when the relevant tool is active:

```tsx
{isWallTool && (
  <div className="bg-slate-800/70 border border-amber-900/40 rounded-lg p-2">
    {/* Wall Fill | Thickness | Face — three sections with dividers */}
  </div>
)}
```

For fill type buttons: card-style with a CSS gradient swatch (20px) + text label. `repeating-linear-gradient` works well for pattern swatches:

```typescript
preview: 'repeating-linear-gradient(45deg,#94a3b8 0,#94a3b8 1px,#1e293b 1px,#1e293b 5px)'
```

Auto-default the face selector when a fill type is chosen — most users never need to touch it manually.

### 7.3 Component Display Mode Verification

When a component has display modes (`inline`, `compact`, `full`), verify which mode has the features the user needs before using it. Never assume compact = same features, just smaller.

### 7.4 Feature Gate Before UI

Don't render UI for features that require infrastructure that isn't running. "Optional — offline" is not a valid user-facing state. Either wire the feature end-to-end or don't show it.

---

## 8. Architecture & Project Startup

### 8.1 Day-One Checklist

Before writing any application code:

- [ ] **Supabase auth** — set up with email verification enabled, `emailRedirectTo` set
- [ ] **z-index stack documented** — all layers defined before first modal or fullscreen
- [ ] **Single PDF rendering pipeline** — one component, not two independent rendering paths
- [ ] **`getUserStorageKey()` pattern established** — enforced for all localStorage access
- [ ] **Canvas component key strategy** — document what dimensions trigger remount

### 8.2 React Key Strategy for Imperative Libraries

Identify every library in the project that maintains internal state. For each, define the exact set of state dimensions that should trigger a full remount (`key` change). Document this explicitly — it will not be obvious to the next developer.

### 8.3 Calculation Function Boundary Guards

Any function that accepts a divisor parameter must guard at the function boundary:

```typescript
function calculateLinearWorld(p1, p2, unitsPerMetre: number) {
  if (unitsPerMetre <= 0) return { ...zeroResult };
  // ...
}
```

Don't rely on callers to validate — future callers won't know about the constraint.

---

## 9. Construction Domain Knowledge

### 9.1 BOQ Export Format

Professional QS format follows AIQS/Rawlinsons standard.

**Columns:** ITEM | DESCRIPTION | QTY | UNIT | LABOUR | MATERIALS | PLANT | MISC | SUBCONTRACTOR | RATE | TOTAL

**Item types:**
- Supply & install items: populate Labour + Materials columns
- Subcontractor items: populate Subcontractor column only (lump sum)

### 9.2 Trade Ordering

Always construction sequence — never alphabetical:

1. Preliminaries
2. Demolition
3. Concrete & Footings
4. Structural Steel / Framing
5. Roof & Cladding
6. External Walls
7. Windows & Doors
8. Internal Walls / Partitions
9. Insulation
10. Plasterboard / Linings
11. Joinery / Cabinetry
12. Tiling / Flooring
13. Painting
14. Plumbing
15. Electrical
16. HVAC / Mechanical

### 9.3 Australian State Cost Multipliers

| State | Multiplier |
|-------|-----------|
| QLD | 1.00 (base) |
| NSW | +8% |
| WA | +12% |
| NT | +15% |
| VIC | +5% |
| SA | -3% |
| TAS | -5% |

### 9.4 Wall Construction Types

**Full cross-section fill** (correct for): masonry, insulation, fire-rated, glazing  
**Face-lining strips** (correct for): plasterboard, cladding, wet-area

Plasterboard appears as thin lines on wall faces in professional construction drawings. Rendering it as a full fill looks wrong to tradespeople reading plans daily.

### 9.5 Scale Calibration

Per-page calibration is essential. Never bake the scale factor into stored coordinates. Always convert to real-world units at display time. Plans on the same PDF can have different scales.

---

## 10. Debugging Protocols

### 10.1 Drawing Tools Completely Dead (Nothing on Click)

1. Open browser DevTools → Console
2. Click the canvas — look for `TypeError: canvas.getPointer is not a function`
3. If found → check `package.json` — Fabric.js was upgraded to v7. Downgrade to `^6.7.1`.
4. If not → check if mouse event handlers are registered at all (add a `console.log` at handler entry)

### 10.2 Measurements from Wrong Plan Showing

1. Read `InteractiveCanvas.tsx` first — understand its internal state model
2. Check the `key` prop on `<InteractiveCanvas>` — does it change on PLAN change, not just page change?
3. Check filter logic — does it have `!m.planId` pass-throughs? Replace with strict filter
4. Check `loadPersisted` — is `planId` being read back and restored into the `pdfFile` object?

### 10.3 Ghost Measurements After Erasing

1. Find the imperative delete path (eraser handler, count-marker handler)
2. Check that it clears ALL THREE: `measurementObjectsRef`, `measurementMapRef`, `shapeToMeasurementIdRef`
3. The ghost appears because `useEffect([measurements])` restore loop re-adds any ID that's in the measurements prop but missing from `objectsRef`

### 10.4 Preview Objects Stuck After Tool Change

1. Find the `activeTool` useEffect
2. Check whether the relevant tool has a sweep block (`if (activeTool !== 'my-tool') { ... }`)
3. Add the sweep if missing — iterate `canvas.getObjects()`, remove any with the preview marker property
4. Call `canvas.requestRenderAll()` if anything was removed

### 10.5 Labels Drifting During Drag

1. Find the `after:render` callback
2. Check how label anchor positions are computed
3. If reading from `worldPoints` or other stored metadata → replace with `shape.calcTransformMatrix()` + `fabricUtil.transformPoint()`
4. `worldPoints` is only valid after `object:modified` (mouse-up), not during drag

### 10.6 Wrong Component Fixed (No Change in Production)

1. Look at the screenshot — which toolbar buttons are present?
2. `PDFAnalysisViewer.tsx` = normal view toolbar (no fullscreen button visible)
3. `InteractiveCanvas.tsx` inside `PDFTakeoff.tsx` = fullscreen view (fullscreen toggle visible, measurement tools in toolbar)
4. Read the component the user is seeing before touching any code

---

## Appendix — Key File Locations

| File | Purpose |
|------|---------|
| `src/components/takeoff/InteractiveCanvas.tsx` | All Fabric.js canvas logic, drawing tools, measurement rendering |
| `src/components/takeoff/PDFTakeoff.tsx` | Fullscreen portal, plan state, canvas orchestration |
| `src/components/takeoff/TakeoffTable.tsx` | BOQ table, measurement list, cost linking |
| `src/lib/takeoff/calculations.ts` | Geometry functions (area, length, count) |
| `src/lib/takeoff/profile.ts` | App profile / user preferences (must use `getUserStorageKey`) |
| `src/lib/auth.ts` (or equivalent) | Supabase auth wrapper + synchronous `isSignedIn()` |
| `src/lib/projectManager.ts` | Project CRUD (must use `getUserStorageKey`) |

---

*Last updated: 2026-06-08 — 17 mistakes documented, 8 techniques, 3 patterns, 9 construction domain entries.*
