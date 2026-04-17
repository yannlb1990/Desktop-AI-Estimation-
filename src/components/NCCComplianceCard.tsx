import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle,
  MinusCircle, FileText, RotateCcw, Building2, Zap, Droplets,
  Flame, Wind, Accessibility, ArrowUpDown, Thermometer, ShieldCheck,
  BookOpen, Search, Copy, ClipboardList,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus = "unchecked" | "pass" | "fail" | "na";

interface CheckItem {
  id: string;
  requirement: string;
  detail: string;
  reference: string;
  applicableZones?: number[];    // climate zones where this applies
  applicableClasses?: string[];  // building classes where this applies
  notes?: string;
}

interface CheckState {
  status: CheckStatus;
  notes: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  items: CheckItem[];
}

// ── NCC Data ──────────────────────────────────────────────────────────────────

const CLIMATE_ZONES = [
  { value: "1", label: "Zone 1 — High humidity summer, warm winter (Darwin, Cairns)" },
  { value: "2", label: "Zone 2 — Warm humid summer, mild winter (Brisbane north coast)" },
  { value: "3", label: "Zone 3 — Hot dry summer, warm winter (Alice Springs, Broken Hill)" },
  { value: "4", label: "Zone 4 — Hot dry summer, cool winter (Adelaide, Canberra inland)" },
  { value: "5", label: "Zone 5 — Warm temperate (Sydney, Brisbane, Perth)" },
  { value: "6", label: "Zone 6 — Mild temperate (Melbourne, Adelaide, ACT)" },
  { value: "7", label: "Zone 7 — Cool temperate (Hobart, alpine areas)" },
  { value: "8", label: "Zone 8 — Alpine (high altitude areas)" },
];

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"];

const BUILDING_CLASSES = [
  { value: "1a", label: "Class 1a — Single detached dwelling / townhouse" },
  { value: "1b", label: "Class 1b — Guest house / bed & breakfast (≤12 guests)" },
  { value: "2", label: "Class 2 — Apartment building (sole-occupancy units)" },
  { value: "3", label: "Class 3 — Residential building (hotel, hostel, boarding house)" },
  { value: "10a", label: "Class 10a — Non-habitable (shed, carport, garage)" },
  { value: "10b", label: "Class 10b — Structure (fence, mast, retaining wall)" },
];

// R-value minimums per climate zone (NCC 2022 Part 3.12)
const R_VALUES: Record<string, { ceiling: string; wall: string; floor: string }> = {
  "1": { ceiling: "R2.7", wall: "R1.4", floor: "N/A" },
  "2": { ceiling: "R2.7", wall: "R1.4", floor: "N/A" },
  "3": { ceiling: "R3.8", wall: "R1.4", floor: "R1.0" },
  "4": { ceiling: "R3.8", wall: "R2.0", floor: "R1.5" },
  "5": { ceiling: "R3.8", wall: "R2.0", floor: "R1.5" },
  "6": { ceiling: "R3.8", wall: "R2.8", floor: "R2.0" },
  "7": { ceiling: "R5.1", wall: "R2.8", floor: "R2.5" },
  "8": { ceiling: "R6.3", wall: "R3.8", floor: "R4.0" },
};

function buildSections(climateZone: string, buildingClass: string): Section[] {
  const rVal = R_VALUES[climateZone] || R_VALUES["5"];
  const zone = parseInt(climateZone);
  const isColdZone = zone >= 6;
  const isHotZone = zone <= 3;
  const isClass1 = buildingClass.startsWith("1");

  return [
    // ── SECTION 1: Site & Footings ─────────────────────────────────────────
    {
      id: "site",
      title: "Site & Footings",
      icon: <Building2 className="h-4 w-4" />,
      color: "amber",
      items: [
        {
          id: "site-1",
          requirement: "Site drainage — 50mm fall in first 1m, 1:100 to drain, no ponding",
          detail: "Finished ground level must fall away from the building at minimum 50mm over the first 1m from the building face. Beyond that, grade must achieve 1:100 minimum to a stormwater pit or site drain. No ponding permitted within 1m of footings at any time. Check all sides of the building including downpipe discharge points.",
          reference: "NCC Vol 2 — Part 3.2.1",
        },
        {
          id: "site-2",
          requirement: "DPC — min 75mm above FGL, full wall width, AS 2904 compliant material",
          detail: "Damp-proof course (DPC) must be installed at minimum 75mm above finished ground level (FGL) and extend the full width of the wall. Compliant materials per AS 2904 include: polyethylene sheet ≥0.5mm thick, flexible PVC, fibre cement sheet, aluminium foil laminate, or bituminous compound. Must prevent capillary rise of moisture into framing or masonry.",
          reference: "NCC Vol 2 — Part 3.3.4, AS 2904",
        },
        {
          id: "site-3",
          requirement: "Termite management AS 3660.1 — physical or chemical, full perimeter, documented",
          detail: "Physical barriers: stainless steel mesh (aperture ≤1mm), crushed granite (6–10mm particle size), or proprietary systems (HomGuard, Termimesh). Chemical barriers: soil treatment with registered pesticide (chlorpyrifos-free post-2015). Must cover full perimeter including all penetrations (pipes, conduits). Type, brand, warranty period, and licensed installer details to be documented on the building file. Inspect prior to slab pour.",
          reference: "NCC Vol 2 — Part 3.1.3, AS 3660.1:2014",
        },
        {
          id: "site-4",
          requirement: "Footing class per AS 2870 — A/S/M/H1/H2/E/P site classes, each triggers different footing",
          detail: "Site classification must be obtained from a geotechnical assessment: Class A (stable, non-reactive) — standard strip/slab; Class S (slightly reactive, <20mm movement) — stiffened raft; Class M (moderately reactive, 20–40mm) — stiffened raft with deeper beams; Class H1 (highly reactive, 40–60mm) and H2 (60–75mm) — heavily reinforced slab with engineer input; Class E (extremely reactive, >75mm) — engineer design mandatory; Class P (problem site — fill, soft spots, erosion) — geotechnical report and engineer design. Fill sites require compaction test to 95% standard compaction.",
          reference: "NCC Vol 2 — Part 3.2.2, AS 2870:2011",
        },
        {
          id: "site-5",
          requirement: "Wind classification AS 4055/AS 1170.2 — N1–N6 non-cyclonic, C1–C4 cyclonic",
          detail: "Determine wind region from postcode: Region A (non-cyclonic) = N1–N6 classifications; Regions B, C, D (cyclonic — Qld/WA/NT coasts) = C1–C4. Terrain category (1–4) and shielding category also required. Wind classification affects tie-down connection capacity, bracing unit requirements, and cladding fixing specifications. Document classification on drawings and specify on engineer's certificate.",
          reference: "NCC Vol 2 — Part 3.10.1, AS 4055:2012, AS 1170.2:2021",
        },
        {
          id: "site-6",
          requirement: "Slab edge — 300mm below FGL (reactive sites), 200mm deep edge beam (non-reactive)",
          detail: "For reactive sites (Class M, H1, H2, E): slab edge beam must extend minimum 300mm below finished ground level to prevent seasonal moisture variation at slab perimeter. Non-reactive sites (Class A, S): minimum 200mm deep edge beam. Rebated slabs: edge beam depth measured from top of rebate. Check setout drawings show correct depths at all sides including stepped footings on sloping sites.",
          reference: "NCC Vol 2 — Part 3.2.2, AS 2870:2011",
        },
        {
          id: "site-7",
          requirement: "Service clearances — 300mm from sewer, 150mm water main, 600mm electrical conduit",
          detail: "Footing excavations must maintain minimum clearances from existing services: 300mm horizontal from any sewer pipe; 150mm from potable water mains; 600mm from underground electrical conduit or cable. Where clearances cannot be met, protective sleeving, bridging beams, or relocation of services is required. Dial Before You Dig search mandatory before excavation.",
          reference: "NCC Vol 2 — Part 3.2.1, local authority requirements",
        },
        {
          id: "site-8",
          requirement: "BAL assessment — BAL-12.5 to BAL-FZ for all Class 1 in bushfire prone land",
          detail: "All Class 1 and Class 10 buildings within designated bushfire prone areas require a BAL assessment from a qualified practitioner. BAL levels: 12.5 (low), 19 (medium), 29 (high), 40 (very high), FZ (flame zone). Each level triggers additional construction requirements under AS 3959: BAL-12.5 requires basic ember protection; BAL-40 requires ember-proof vents, toughened glazing, non-combustible cladding; BAL-FZ requires full fire engineering. Council maps and state fire authority maps to be checked.",
          reference: "NCC Vol 2 — Part 3.7.4, AS 3959:2018",
          applicableClasses: ["1a", "1b"],
        },
      ],
    },

    // ── SECTION 2: Structural Framing — Timber ─────────────────────────────
    {
      id: "framing-timber",
      title: "Structural Framing — Timber",
      icon: <Building2 className="h-4 w-4" />,
      color: "orange",
      items: [
        {
          id: "frt-1",
          requirement: "Timber species/grade — MGP10 min framing, MGP12 rafters >3.6m, F8 hardwood, LVL beams",
          detail: "Minimum stress grade MGP10 for wall studs, top/bottom plates, ceiling joists, and rafters ≤3.6m span. MGP12 required for rafters >3.6m and floor joists with heavy loads. F8 hardwood is an acceptable alternative for structural framing. LVL (Laminated Veneer Lumber) required for all lintels and beams exceeding span table limits for sawn timber. Always verify species, stress grade, and treatment class on the delivery docket — do not use unmarked timber in structural locations.",
          reference: "NCC Vol 2 — Part 3.4, AS 1684.2:2021, AS 1720.2",
        },
        {
          id: "frt-2",
          requirement: "Stud sizing — 90×35 MGP10 at 600mm ctrs ≤2.7m, 90×45 at 600mm ctrs ≤3.0m, or per wind class",
          detail: "Wall stud sizes determined by wall height, spacing, load, and wind classification: 90×35 MGP10 at 600mm centres is minimum for walls ≤2.7m high in N1–N2 areas; 90×45 MGP10 at 600mm centres for walls up to 3.0m; 70×35 at 450mm centres for walls ≤2.4m in low-wind; higher wind classifications (N3–N6, C1–C4) require larger studs or closer spacing per AS 1684.2 span tables. Always confirm from tables using actual wall height, wind classification, and load width.",
          reference: "NCC Vol 2 — Part 3.4.2, AS 1684.2:2021 Table sets",
        },
        {
          id: "frt-3",
          requirement: "Top plate — single where studs align, DOUBLE where offset >1/6 spacing, lapped 600mm at corners",
          detail: "Single top plate (90mm deep) acceptable where roof/floor framing members bear directly over studs (offset ≤1/6 of stud spacing). Double top plate (two 90mm plates) required where framing members are offset more than 1/6 of stud spacing — the upper plate spans between studs and transfers loads. Corner laps: minimum 600mm from corner at every joint. Nail double top plates together at 300mm centres with 75mm nails.",
          reference: "NCC Vol 2 — Part 3.4.2, AS 1684.2:2021",
        },
        {
          id: "frt-4",
          requirement: "Bottom plate — min 35mm thick, DPC/isolation in wet areas, M12 bolts at max 1800mm ctrs",
          detail: "Bottom plate minimum 35mm thickness (matching stud width). In wet areas and where plate bears on concrete slab: install DPC or moisture-isolating tape under plate to prevent moisture transfer. Bolting to concrete: M12 bolts at maximum 1800mm centres and within 300mm of each end of every plate length. In N3+ wind areas, bolt spacing reduces — check AS 1684 Section 9 for specific requirements. Plate to slab adhesive is NOT a substitute for bolting.",
          reference: "NCC Vol 2 — Part 3.4.2, AS 1684.2:2021 Section 9",
        },
        {
          id: "frt-5",
          requirement: "Noggins — 35×35 min (35×70 recommended), max 1350mm vertical spacing, bracing noggins at 900mm ctrs",
          detail: "Horizontal noggins provide stud lateral restraint and wall backing for fixtures. Minimum section 35×35mm; 35×70mm recommended for improved wall stiffness. Maximum vertical spacing 1350mm between noggins (or from plate to first noggin). In bracing walls: noggins at 900mm centres maximum to transfer bracing forces. All utility noggins (for shelves, TV brackets, grab rails) should be 90×35 minimum.",
          reference: "NCC Vol 2 — Part 3.4.2, AS 1684.2:2021",
        },
        {
          id: "frt-6",
          requirement: "Lintels — 2/90×45 LVL or 3-ply 90×35 MGP10 up to 1800mm; LVL from tables up to 3600mm; engineer >3600mm",
          detail: "Lintel minimum bearing 45mm each end on trimmer studs or wall plate. For openings up to 1800mm: 2/90×45 LVL F17 or 3-ply 90×35 MGP10 is typical (verify from tables for load width and span). For 1800–3600mm openings: LVL beam size from manufacturer span tables accounting for load width, floor/roof loads, and wind classification. For openings >3600mm or where above tables don't apply: engineer design required. Lintel size must be documented on plans.",
          reference: "NCC Vol 2 — Part 3.4.2, AS 1684.2:2021 Part 2",
        },
        {
          id: "frt-7",
          requirement: "Rafters — verify pitch, species, grade, spacing from AS 1684 Part 3 tables; birdsmouth max 1/3 depth",
          detail: "Rafter sizing determined by: span (mm), spacing (450/600/900mm centres), roof pitch, species/stress grade, and wind classification. Refer to AS 1684 Part 3 tables for specific values. Birdsmouth cut (notch at wall plate): maximum depth 1/3 of rafter depth — deeper cuts critically weaken the rafter at the point of maximum stress. Provide rafter tie or ceiling joist to resist outward thrust. Verify rafter is not undersized for snow loads in alpine areas (Zone 8).",
          reference: "NCC Vol 2 — Part 3.4.3, AS 1684.3:2021",
        },
        {
          id: "frt-8",
          requirement: "Ceiling joists — max 4.8m span 90×35 MGP10 at 600mm; LVL or engineer beyond; ties at 1800mm ctrs",
          detail: "90×35 MGP10 ceiling joists at 600mm centres can span up to 4.8m (verify against tables for actual species and load). Spans beyond this require LVL or engineer-designed beams. Ceiling tie (strap or joist connecting opposite rafters at ceiling level) at maximum 1800mm centres to prevent rafter spread. Ensure ceiling joists are continuous over at least one support or lapped minimum 150mm over a wall plate.",
          reference: "NCC Vol 2 — Part 3.4.3, AS 1684.2:2021",
        },
        {
          id: "frt-9",
          requirement: "Tie-down — rafter/truss to plate, stud to plate, plate to slab M12 bolt; capacity from AS 1684 Appendix",
          detail: "Complete load path from roof to foundation: every rafter/truss connected to wall plate with approved strap or nail pattern resisting design uplift; every stud connected to both top and bottom plate (Hurricane/Cyclone strap in N3+); bottom plate connected to slab via M12 bolts. Connector capacity (kN) must equal or exceed design uplift loads from AS 1684 Appendix D tables or manufacturer load tables. Document connection schedule on drawings.",
          reference: "NCC Vol 2 — Part 3.4, AS 1684.2:2021 Appendix D",
        },
        {
          id: "frt-10",
          requirement: "Wall bracing — bracing units calculated per wind class, distributed both axes",
          detail: "Total bracing units (BUs) required are determined from wind classification, wall height, and roof area. Distribution required in both longitudinal and transverse directions; no individual wall panel to exceed 4m without bracing element. Bracing types: sheet bracing (plywood/fibre cement), steel diagonal strap, proprietary panel systems. Ensure bracing panel lengths and nailing/fixing patterns match manufacturer requirements exactly.",
          reference: "NCC Vol 2 — Part 3.4.3, AS 1684.2:2021 Section 8",
        },
        {
          id: "frt-11",
          requirement: "Subfloor ventilation — 3500mm² per lineal metre of external wall, cross-ventilation path clear",
          detail: "Suspended timber floors require subfloor cross-ventilation to prevent moisture accumulation and timber decay. Minimum 3500mm²/m of external wall as free ventilation area on at least two opposite sides. Vent openings must be at opposite sides of the building for cross-flow. No vents to be blocked by garden beds, cladding or insulation. Minimum 150mm clearance between underside of floor framing and ground. Maintain minimum 50mm per AS 3660 for access.",
          reference: "NCC Vol 2 — Part 3.4.1, AS 1684.2:2021",
        },
      ],
    },

    // ── SECTION 3: Structural Framing — Steel (Light Gauge) ────────────────
    {
      id: "framing-steel",
      title: "Structural Framing — Steel (Light Gauge)",
      icon: <Building2 className="h-4 w-4" />,
      color: "orange",
      items: [
        {
          id: "frs-1",
          requirement: "Stud gauge — 0.75mm BMT internal non-loadbearing, 1.15mm BMT external, 1.6mm BMT load-bearing",
          detail: "C-section cold-formed steel studs must be selected from manufacturer load/span tables, not guessed: 0.75mm Base Metal Thickness (BMT) is minimum for internal non-loadbearing partitions; 1.15mm BMT for external walls with wind and cladding loads; 1.6mm BMT for load-bearing walls or walls with imposed floor/roof loads. Always verify load tables from the steel framing manufacturer (Rondo, Knauf, Studco, etc.) using actual wall height, stud spacing, and design wind pressure.",
          reference: "NCC Vol 2 — Part 3.4, AS 4600:2018, NASH Standard Part 1",
        },
        {
          id: "frs-2",
          requirement: "Track — same gauge as stud, fix at 300mm from ends, 600mm max ctrs, shim on uneven slab",
          detail: "Top and bottom tracks (U-channel) must be same gauge as the stud they support. Fix track to slab/substrate at maximum 600mm centres and within 300mm of each end. On uneven concrete slabs, use timber or steel shim packs to level the track before fixing — do not bend track to fit the floor. Tracks must be continuous over corners — mitre or overlap minimum 150mm at internal corners.",
          reference: "NCC Vol 2 — Part 3.4, NASH Standard Part 1:2014",
        },
        {
          id: "frs-3",
          requirement: "Fasteners — No.10-16×16mm self-drill for 0.75mm; No.12-14 for ≥1.15mm; 2 screws per connection min",
          detail: "Self-drilling screws must match the steel thickness: No.10-16 (16mm long) for 0.75mm BMT connections; No.12-14 for 1.15mm and above. All stud-to-track connections: minimum 2 screws per connection point (one each side of web or through flanges). Never use standard wood screws or drywall screws in structural steel framing connections — use approved SD screws only. Screws must be installed flush, not over-driven.",
          reference: "NCC Vol 2 — Part 3.4, AS 4600:2018, NASH Standard Part 1",
        },
        {
          id: "frs-4",
          requirement: "Bracing — AS 4600 or manufacturer tables; diagonal strap ≤30° from vertical; pre-tension strap",
          detail: "Steel stud wall bracing achieved by: diagonal flat strap (minimum 0.75mm BMT, 30mm wide) at ≤30° to vertical — steeper angles are ineffective; or proprietary K-brace systems per manufacturer testing. Flat strap must be pre-tensioned before final fixing to prevent buckling under load. Bracing connection at stud and track must be able to transfer the design axial load (tension). Document bracing layout on structural drawings.",
          reference: "NCC Vol 2 — Part 3.4, AS 4600:2018",
        },
        {
          id: "frs-5",
          requirement: "Corrosion — C3 environment (≤1km from ocean): G550 Z600 min; C4 marine: stainless fixings",
          detail: "Steel framing corrosion protection must match exposure environment per AS 4312: C1/C2 (inland, low humidity) — standard Z275 galvanising (zinc coating 275g/m²) acceptable; C3 (within 1km of beach or industrial area) — minimum G550 Z600 (600g/m² zinc) for all steel members; C4 (within 200m of breaking surf or heavy industrial) — hot-dipped galvanised G550 plus stainless steel Type 316 fasteners; C5 (marine splash zones) — stainless construction throughout. Paint systems for exposed steel per AS 2312.",
          reference: "NCC Vol 2 — Part 3.4, AS 4312:2008, NASH Standard Part 1",
        },
        {
          id: "frs-6",
          requirement: "Fire rating — intumescent paint or tested board system per AS 1530.4 for load-bearing walls",
          detail: "Load-bearing steel stud walls forming part of a fire-rated assembly (e.g., party wall, floor/ceiling assembly) must achieve the required FRL through a tested system. Options: intumescent paint applied to manufacturer's specified DFT (dry film thickness) — system test certificate required; or proprietary board lining system (Fyrchek, Gyprock Firestop, etc.) per manufacturer's tested system. The tested system must specifically cover the steel gauge, stud depth, and lining thickness used.",
          reference: "NCC Vol 2 — Part 3.7.3, AS 1530.4:2014",
        },
      ],
    },

    // ── SECTION 4: Energy Efficiency ──────────────────────────────────────
    {
      id: "energy",
      title: "Energy Efficiency (6-Star)",
      icon: <Zap className="h-4 w-4" />,
      color: "yellow",
      items: [
        {
          id: "ee-1",
          requirement: `Ceiling insulation — ${rVal.ceiling} min (Zone ${climateZone}), no gaps >2%, compression ≤10%`,
          detail: `Minimum ceiling R-value for Climate Zone ${climateZone} is ${rVal.ceiling} (total system R-value). NatHERS-compliant batts or rigid board. Installation quality is critical: gaps >2% of total ceiling area can reduce effective R-value by 30%+. Batts must not be compressed more than 10% of their nominal thickness — compression in eave spaces is a common defect. Butt all edges; cut batts to fit around obstructions. Insulate over top plates at perimeter. Downlight penetrations must be either IC-rated (covered) or have insulation barrier per AS/NZS 3000.`,
          reference: "NCC Vol 2 — Part 3.12.1, H6D3, AS/NZS 4859.1",
        },
        {
          id: "ee-2",
          requirement: `Wall insulation — ${rVal.wall} min (Zone ${climateZone}), fill full cavity, staple every 300mm`,
          detail: `Minimum wall R-value for Climate Zone ${climateZone} is ${rVal.wall}. Batts must fully fill the stud cavity without gaps or compression. Staple batts to studs at 300mm centres in walls to prevent sagging. Install vapour-permeable sarking behind cladding on external walls (foil or non-foil depending on zone). All electrical boxes, plumbing penetrations, and cable runs must be worked around — not left as insulation-free voids. Rigid foam board is an alternative on the warm face for continuous insulation.`,
          reference: "NCC Vol 2 — Part 3.12.1, H6D3, AS/NZS 4859.1",
        },
        {
          id: "ee-3",
          requirement: `Floor insulation — ${rVal.floor} min (Zone ${climateZone}), retained by wire hangers or rigid support`,
          detail: rVal.floor === "N/A"
            ? `Not required for Climate Zone ${climateZone} (Zones 1–2 have no minimum floor insulation requirement). However, consider acoustic insulation under timber floors where applicable.`
            : `Minimum floor R-value for Climate Zone ${climateZone} is ${rVal.floor}. Install under suspended timber or steel floor frames. Batts must be mechanically retained — wire hangers (mesh/chicken wire) or rigid Z-clips at maximum 450mm centres. Batts laid on the ground under a concrete slab require separation from earth by DPC. Rigid PIR/EPS board under slab edge is an alternative. Ensure no gaps at perimeter where slab meets wall framing.`,
          reference: "NCC Vol 2 — Part 3.12.1, H6D3",
        },
        {
          id: "ee-4",
          requirement: `Window U-value + SHGC — Zone ${climateZone}: ${zone <= 2 ? "U≤6.0 SHGC≤0.4" : zone === 3 ? "U≤5.5 SHGC≤0.4" : zone === 4 ? "U≤3.4 SHGC 0.4–0.6" : zone <= 6 ? "U≤3.0 SHGC 0.4–0.6" : "U≤2.0 SHGC≥0.5"}`,
          detail: `Window energy performance must be specified and documented. Zone 1–2: U-value ≤6.0, SHGC ≤0.4 (cooling dominated — limit heat gain); Zone 3: U≤5.5, SHGC≤0.4; Zone 4: U≤3.4, SHGC between 0.4 and 0.6; Zone 5–6: U≤3.0, SHGC 0.4–0.6 (mixed climate); Zone 7–8: U≤2.0, SHGC≥0.5 (heating dominated — maximise solar gain). Frame material significantly affects U-value: aluminium without thermal break is typically U=5–7, aluminium with break U=2.5–4, uPVC U=2–3, timber U=2–3. WERS rating label required from supplier.`,
          reference: "NCC Vol 2 — Part 3.12.1, H6D4",
        },
        {
          id: "ee-5",
          requirement: "NatHERS rating ≥6 stars — AccuRate Heritage v2.5+ or FirstRate5 v6+; ABSA/BDAV assessor certificate",
          detail: "Minimum 6-star NatHERS (Nationwide House Energy Rating Scheme) for all new Class 1 and Class 2 dwellings. Modelling must use approved software: AccuRate Heritage v2.5 or later, or FirstRate5 v6 or later. Certificate must be issued by an accredited assessor (ABSA — Association of Building Sustainability Assessors, or BDAV). The certificate must match the final design — any change to wall type, glazing, insulation, or orientation after certification requires a new assessment. Keep certificate with building file for inspection.",
          reference: "NCC Vol 2 — H6V2, H6V3",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "ee-6",
          requirement: "Roof sarking — reflective adds R0.5–R1.0; shiny side down; 150mm lap; taped; turn down at eaves",
          detail: "Reflective sarking installed under roof tiles or metal sheeting provides additional thermal resistance: shiny-side down towards attic space adds R0.5–R1.0 to the ceiling thermal system depending on air gap. Install with shiny side facing down (toward the air gap), not up. All sheets lapped minimum 150mm horizontally and 100mm vertically; all joints taped with compatible foil tape. At eaves: turn sarking down into the gutter or soffit void to prevent moisture from tracking back up under tiles. Puncture-resistant grade required for trafficable roofs.",
          reference: "NCC Vol 2 — H6D3, Part 3.5.1, AS/NZS 4200.2",
        },
        {
          id: "ee-7",
          requirement: "Air sealing — all pipe/cable/flue penetrations sealed; draught-stop at top/bottom plates; door gap <3mm",
          detail: "Air leakage can negate insulation benefit. Seal all penetrations through the building envelope: pipe penetrations — flexible sealant compatible with pipe material; electrical cables — foam backer rod plus sealant; flue penetrations — intumescent or rated collar; downlights — use IC-rated fixtures or seal with purpose-made covers. Top and bottom plates abutting ceiling and slab: install draught-stop foam tape or sealant. External door threshold gap must be <3mm — use compression seal or brush seal. Window and door frame-to-wall junctions: backer rod + sealant all perimeter.",
          reference: "NCC Vol 2 — H6D5",
        },
        {
          id: "ee-8",
          requirement: "Whole-of-home energy budget — sum all fixed appliances ≤ max kWh/day; heat pump HWS recommended",
          detail: "NCC 2022 introduces Whole-of-home energy budget: the sum of annual energy use from all fixed appliances (hot water, space heating/cooling, lighting, pool/spa pump if fixed) must not exceed the maximum allowed for the climate zone and dwelling size. Hot water contributes the largest share — heat pump HWS uses ~65% less energy than electric resistance and is the most effective way to meet the budget. Gas HWS is permitted but increases the budget use. LED lighting throughout is essentially mandatory to meet the budget. Solar PV can offset the calculated budget.",
          reference: "NCC 2022 — H6V4 Whole-of-home",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "ee-9",
          requirement: "Fixed lighting — all luminaires energy efficient LED min; max 5W/m² general areas",
          detail: "All fixed luminaires must be energy efficient — LED is the practical standard meeting the requirement. Maximum installed lighting power density: 5W/m² for general living areas, bedrooms, and corridors. Higher allowances apply to bathrooms (up to 10W/m²) and kitchens (up to 8W/m²) due to task lighting needs. Decorative incandescent or halogen downlights are not compliant. Document fitting wattage on electrical schedule and confirm on NatHERS assessment.",
          reference: "NCC Vol 2 — H6D7, AS/NZS 3000:2018",
        },
        ...(isColdZone ? [{
          id: "ee-10",
          requirement: "Vapour retarder — Zones 6–8 walls/ceiling; warm side of insulation; no foil in wall cavities Z6–8",
          detail: "Climate Zones 6–8 are at risk of interstitial condensation where warm moist air diffuses through insulation and condenses on cold surfaces. Vapour permeable sarking (not foil) must be used on the warm (internal) side of insulation in walls. Foil-faced insulation batts in wall cavities of Zones 6–8 trap moisture and are not recommended. In ceilings: vapour permeable membrane or standard polyethylene (if no ventilated air gap above). Dew point analysis recommended for unusual construction systems.",
          reference: "NCC 2022 — H6D6 Condensation management",
          applicableZones: [6, 7, 8],
        }] : []),
      ],
    },

    // ── SECTION 5: Waterproofing — Internal (AS 3740:2021) ─────────────────
    {
      id: "waterproofing",
      title: "Waterproofing & Wet Areas",
      icon: <Droplets className="h-4 w-4" />,
      color: "blue",
      items: [
        {
          id: "wp-1",
          requirement: "Shower walls — 1800mm AFF or 50mm above rose (higher wins); fibreglass mat at corners; licensed waterproofer",
          detail: "Membrane applied to all shower recess walls to minimum 1800mm above finished floor level (AFF), OR 50mm above the highest fixed point of the shower rose — whichever is higher. All walls within 1500mm of the shower head must be waterproofed. Bond breaker (flexible sealant bead) applied at all internal corners before membrane. Fibreglass mat or polyester tape embedded in membrane at all wall-to-wall and wall-to-floor junctions for reinforcement. Waterproofer must hold current licence in relevant state. Written certificate referencing AS 3740:2021 must be provided before tiling commences.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
        },
        {
          id: "wp-2",
          requirement: "Shower floor — full membrane including hob; 50mm up wall beyond hob; fall 1:60 min (17mm/m); hob ≥25mm high",
          detail: "Full floor membrane across entire shower floor area including the hob/kerb. Membrane must extend minimum 50mm up the wall on the external face of the hob (wet side). Minimum fall to floor waste: 1:60 = 17mm per metre — measured from furthest point to waste. Hob/kerb minimum height 25mm above finished floor level of shower. Waste set in membrane with a proprietary collar or membrane turned into waste fitting. All corners between floor and walls must have fibreglass or polyester tape reinforcement.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
        },
        {
          id: "wp-3",
          requirement: "Shower membrane certificate — licensed waterproofer, AS 3740:2021 certificate, inspect before tiling",
          detail: "Written waterproofing certificate required from a licensed waterproofer (building licence category varies by state — e.g., waterproofing licence in VIC, plumber or builder in QLD). Certificate must reference AS 3740:2021 and describe the membrane system used (product name, number of coats, thickness). Building inspector or private certifier must inspect and approve membrane before tiles are laid — do not tile over without inspection sign-off. Tiler must not damage membrane with fixings or abrasion.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
        },
        {
          id: "wp-4",
          requirement: "Bathroom floor (no shower) — full floor membrane; 150mm upstand at wall junctions; fall 1:80 to waste",
          detail: "Bathroom floors without a shower recess still require full floor membrane where there is a floor waste or where water is likely to contact the floor (e.g., from a bath or adjacent shower spray). 150mm upstand at all wall-floor junctions, including under wall tiles. Bond breaker at all internal angles before membrane. Minimum fall to floor waste 1:80. Where no floor waste: full membrane still required if floor tiles are installed in a wet area bathroom.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
        },
        {
          id: "wp-5",
          requirement: "Ensuite/toilet — full floor membrane where floor waste present; skirting tiles set in membrane",
          detail: "Where ensuite or toilet has a floor waste or is adjacent to a shower with a shared floor, full floor membrane applies. 150mm upstand at all junctions. Skirting tiles must be set in the membrane — not just against it — by turning the membrane up the wall and bedding skirting tiles into the membrane before applying wall tiles above. Penetrations for pipe pedestals sealed with flexible sealant into membrane collar.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
        },
        {
          id: "wp-6",
          requirement: "Laundry — full floor membrane; 75mm upstand at walls; area under trough/WM; waterproof tap penetrations",
          detail: "Full floor membrane in laundry area. Upstand minimum 75mm at all wall-floor junctions. Membrane must cover the area under the trough, washing machine, and any floor drain. Tap/mixer penetrations through the wall must be sealed with flexible sealant into the membrane. Install floor waste and ensure positive fall (1:80 minimum) to waste. Where laundry is on a suspended floor, use a liquid-applied membrane system suitable for timber substrate.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
        },
        {
          id: "wp-7",
          requirement: "Balcony/deck — continuous membrane to AS 4654.2; 150mm upstand; transition under door sill; 1:100 fall to outlet",
          detail: "Above-ground balcony and deck waterproofing must comply with AS 4654.2. Continuous membrane across the full deck area. Minimum 150mm upstand at all walls and where deck meets the building structure. Transition membrane and flashing under door sill/threshold to prevent water ingress at the most vulnerable junction. Outlet must be through a purpose-made membrane collar. Minimum positive fall 1:100 (10mm per metre) to the outlet — check at all corners of the deck. Verify membrane system is classified for the expected foot traffic and UV exposure.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 4654.2:2012",
        },
        {
          id: "wp-8",
          requirement: "Roof flashing — lead/copper at ridges, penetrations, valleys; step, apron, and counter flashings",
          detail: "Flashing required at all roof penetrations (pipes, vents, chimneys, skylights), junctions (roof-to-wall, valley gutters), and at ridge and hip tiles. Materials: lead (min 1.8kg/m²), copper, zinc, or aluminium compatible with roof and wall materials. Step flashing at wall junctions: 100mm turn-up behind cladding, 100mm on roof surface. Apron flashing at protrusions: 75mm on roof, 150mm over protrusion. Counter flashing over step flashing: minimum 65mm overlap. All flashing laps sealed with compatible sealant.",
          reference: "NCC Vol 2 — Part 3.5.4",
        },
        {
          id: "wp-9",
          requirement: "Tiles are finish only — membrane must exist under all wet-area tiles; grout is not waterproof",
          detail: "Ceramic and porcelain tiles and grout are NOT waterproof and must never be relied upon as the sole waterproofing layer. Grout is porous and cracks with building movement, allowing water into substrate. The waterproof membrane (liquid-applied, sheet, or tile-over system) must be installed beneath tiles in all wet areas, and must be fully cured and inspected before any tiles are laid. This is one of the most commonly failed inspection items — document with photos.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
        },
      ],
    },

    // ── SECTION 6: Fire Safety ─────────────────────────────────────────────
    {
      id: "fire",
      title: "Fire Safety",
      icon: <Flame className="h-4 w-4" />,
      color: "red",
      items: [
        {
          id: "fs-1",
          requirement: "Smoke alarms — photoelectric type only (NCC 2022); 240V hard-wired + 10yr battery backup; interconnected",
          detail: "NCC 2022 mandates photoelectric type smoke alarms only — ionisation type alarms are NOT compliant in new work. Power supply: 240V hard-wired to a dedicated circuit (or any final subcircuit) with a 10-year lithium battery backup, OR a 10-year sealed lithium battery alarm in dwellings where hard-wiring is impractical. All alarms in the same dwelling must be interconnected — when one activates, all sound. Interconnection can be by hard-wiring or wireless radio frequency. Comply with AS 3786:2014+A1:2015.",
          reference: "NCC Vol 2 — Part 3.7.2, AS 3786:2014+A1:2015",
        },
        {
          id: "fs-2",
          requirement: "Alarm placement — every storey; each bedroom; between bedrooms and rest of dwelling; ≥300mm from walls; ≥400mm from corners",
          detail: "Mandatory locations: (1) every storey of the dwelling; (2) in each bedroom; (3) in the hallway or space between bedrooms and the rest of the dwelling. Ceiling mounting: minimum 300mm from any wall; minimum 400mm from any corner. Must NOT be placed: in dead-air space at ceiling apex; within 300mm of a light fitting, exhaust fan, or air conditioning outlet (airflow disrupts sensing); within 300mm of a cooking appliance. Not permitted on sloped ceilings within 600mm of the apex — mount on flat section.",
          reference: "NCC Vol 2 — Part 3.7.2",
        },
        {
          id: "fs-3",
          requirement: "Garage separation — FRL 60/60/60 wall; FD30 self-closing self-latching door; garage floor ≤ dwelling floor",
          detail: "Attached garage or carport that shares a wall, floor, or ceiling with habitable spaces must have: wall with Fire Resistance Level (FRL) of 60/60/60 (structural adequacy/integrity/insulation in minutes); self-closing, self-latching fire door rated FD30 (30 minute fire door) with intumescent strip; garage floor must be equal to or LOWER than dwelling floor — step down into garage prevents fuel spill flowing into dwelling. No unrated openings, windows, or vents between garage and habitable areas. All penetrations (pipes, cables) through the rated wall must be fire-stopped.",
          reference: "NCC Vol 2 — Part 3.7.3",
          applicableClasses: ["1a", "1b"],
        },
        ...(buildingClass !== "1a" ? [{
          id: "fs-4",
          requirement: "Party wall — FRL 60/60/60 min; full height to underside of roof covering; fire-stop all penetrations",
          detail: "Party walls between Class 1b, Class 2, and Class 3 buildings or sole-occupancy units must achieve FRL 60/60/60. Wall must extend to the full height of the building to the underside of the roof covering — not just to ceiling level. The wall must effectively seal the roof space between units to prevent fire spread. No unrated penetrations: all pipe, cable, and duct penetrations must be fire-stopped with a system tested and certified to the wall's FRL. Fire-stopping products must be installed exactly per tested system certificate (see Spec C3.15 for commercial).",
          reference: "NCC Vol 2 — Part 3.7.3",
        }] : []),
        {
          id: "fs-5",
          requirement: "Fire stopping at penetrations — intumescent collar for plastic pipes ≥DN50; graphite sealant for cables; dampers for HVAC",
          detail: "Every penetration through a fire-rated wall or floor must be fire-stopped: plastic pipes DN50 and larger — intumescent collar (expands and closes the pipe as it melts); metal pipes — fire-rated wrap system; cable bundles — intumescent sealant or graphite-based pillows filling to full wall thickness; HVAC ducts — motorised fire damper rated to the assembly's FRL, actuated by smoke detector in duct; combustible liners in ducts passing through rated elements — replace with steel. All systems must be tested per AS 1530.4 and installed per the certificate of conformity.",
          reference: "NCC Vol 2 — Part 3.7.3, NCC Vol 1 — Spec C3.15",
        },
        {
          id: "fs-6",
          requirement: "Ember protection — 2mm corrosion-resistant steel mesh on all subfloor, eave, and roof ventilation (BAL areas)",
          detail: "In BAL-rated construction, all ventilation openings that could allow ember entry must be protected with 2mm aperture corrosion-resistant steel mesh (stainless steel preferred; aluminium or galvanised acceptable at lower BAL levels). This applies to: subfloor ventilation bricks and grilles; soffit and eave ventilation panels; ridge ventilation systems; any gap >3mm in fascia, soffit, or external wall in BAL-29 and above. At BAL-40 and BAL-FZ, roof valley gutters and downpipes must also be protected. Check AS 3959 Table for each BAL level's specific requirements.",
          reference: "NCC Vol 2 — Part 3.7.4, AS 3959:2018",
        },
        {
          id: "fs-7",
          requirement: "Bedroom egress — direct access outside OR corridor ≤6m from exit; window min 450×450mm clear opening",
          detail: "Each bedroom must have a viable means of escape: direct door to outside or to an internal corridor/hallway not more than 6m from an exit door. If escape is via a window: minimum clear opening 450mm wide × 450mm high, with sill height no more than 1000mm above floor level to allow unassisted egress. This is particularly important for habitable rooms above ground level. Windows with restricted openings (security locks) must still allow the 450mm clear opening — check lock overrides.",
          reference: "NCC Vol 2 — Part 3.7.1",
        },
      ],
    },

    // ── SECTION 7: Plumbing & Drainage (AS/NZS 3500) ──────────────────────
    {
      id: "plumbing",
      title: "Plumbing & Drainage",
      icon: <Droplets className="h-4 w-4" />,
      color: "cyan",
      items: [
        {
          id: "pl-1",
          requirement: "Hot water — ≥60°C storage, tempering valve to ≤50°C at bathrooms, pipework insulated 12mm wall",
          detail: "Storage temperature minimum 60°C at the vessel to prevent Legionella bacteria growth (AS/NZS 3500.4). Thermostatic mixing valve (tempering valve) must limit delivery temperature to maximum 50°C at all bathroom, ensuite, and laundry outlets. Tempering valve to be tested and labelled with delivery temperature. Hot water pipework must be insulated with minimum 12mm wall thickness foam insulation (or equivalent R-value) for all accessible pipes to reduce heat loss. Solar and heat pump systems preferred for energy compliance.",
          reference: "NCC Vol 3 — AS/NZS 3500.4:2018",
        },
        {
          id: "pl-2",
          requirement: "Drain grade — DN50 at 1:40; DN80 at 1:60; DN100 sewer at 1:60 (1.65%); access points every change >45°",
          detail: "Sanitary drainage minimum grades: DN50 (50mm diameter) at 1:40 = 25mm fall per metre; DN80 at 1:60 = 16.7mm/m; DN100 (main sewer drain) at 1:60 = 16.7mm/m. Never install a drain with reverse fall — check with spirit level. Trap seal minimum 50mm water depth to prevent sewer gas ingress. Access openings (inspection openings or cleanouts) required at every change of direction >45°, at every junction, and at maximum 15m centres in straight runs. All fixtures must have a P-trap or deep-seal trap minimum DN40.",
          reference: "NCC Vol 3 — AS/NZS 3500.2:2021",
        },
        {
          id: "pl-3",
          requirement: "Fixture units and pipe sizing — basin DN32; shower DN40; bath DN40; WC DN100; washing machine DN40",
          detail: "Minimum drain sizes per fixture: hand basin pedestal — DN32; shower recess — DN40; bath — DN40; WC — DN100; washing machine — DN40; kitchen sink — DN40 (single bowl). Collector (branch) drain sizing from fixture unit tables in AS/NZS 3500.2: total fixture units from connected fixtures determine the collector pipe size and grade. A DN100 collector drain can serve most typical residential bathrooms — verify for multiple bathrooms discharging to a single branch.",
          reference: "NCC Vol 3 — AS/NZS 3500.2:2021",
        },
        {
          id: "pl-4",
          requirement: "Backflow prevention — containment device at point of supply; type matches hazard rating",
          detail: "Potable water supply must be protected from backflow contamination. For Class 1 residential: containment backflow prevention device at the meter or point of entry. Hazard rating determines device type: low hazard (single dwelling) — dual check valve or pressure vacuum breaker; medium hazard (irrigation, solar HWS with anti-freeze) — reduced pressure zone device (RPZ); high hazard (commercial/industrial processes) — RPZ or air gap. All backflow prevention devices to be tested annually by a licensed tester.",
          reference: "NCC Vol 3 — AS/NZS 3500.1:2021",
        },
        {
          id: "pl-5",
          requirement: "Overflow relief gully (ORG) — 75mm below lowest fixture; free-draining; no lockable lid; accessible",
          detail: "The overflow relief gully (ORG) is the safety relief point for the sewer system — it discharges to surface before the sewer backs up into the building. Gully surround must be 75mm below the lowest connected plumbing fixture (typically the shower waste). The gully grate must be free-draining — no sealed lid or lockable cover. Gully must be accessible for inspection and clearing — do not bury or build over. Must be visible from the building and located outside, not under paving.",
          reference: "NCC Vol 3 — AS/NZS 3500.2:2021",
        },
        {
          id: "pl-6",
          requirement: "Stormwater — separate from sewer; gutter sizing per AS/NZS 3500.3; ≥0.5% fall; DN75 downpipe up to 47m²",
          detail: "Stormwater (roof drainage) must be completely separated from the sanitary sewer system — cross connections are illegal. Gutter sizing per AS/NZS 3500.3: based on roof catchment area (m²) × rainfall intensity (mm/hr from BOM data for location). Gutters must have minimum 0.5% fall (5mm per metre) towards downpipes — check with string line. Minimum downpipe size DN75 for up to 47m² roof catchment; DN90 for 47–75m²; DN100 for 75–130m². Stormwater to connect to council stormwater drain or approved soakage pit.",
          reference: "NCC Vol 3 — AS/NZS 3500.3:2018",
        },
        {
          id: "pl-7",
          requirement: "Gas — AS/NZS 5601.1; yellow PE or copper pipe; pressure test 1.5× working pressure; 1.5m from ignition source",
          detail: "All gas work by licensed gasfitter only. Supply pipe: yellow polyethylene (for buried), copper (internal), or stainless steel flexible connector (appliance final connection). Pressure test at 1.5 times working pressure (typically 1.1 kPa test for low pressure) and hold for 30 minutes — zero drop acceptable. Gas meter must be located minimum 1.5m from any ignition source, operable window, or openable door. Flue clearances for gas appliances: minimum 500mm from any opening, 1.5m from any operating corner. Ventilation required for all gas appliances in enclosed spaces.",
          reference: "NCC Vol 3, AS/NZS 5601.1:2013",
        },
        {
          id: "pl-8",
          requirement: "Water pressure — 150 kPa min at highest outlet; regulator if >500 kPa; lead <0.25% in all fittings",
          detail: "Minimum water pressure 150 kPa at the highest outlet in the building under simultaneous use. Maximum allowable pressure 500 kPa — pressure limiting valve (PLV) required where mains pressure exceeds this. Flow rate minimum 0.1 L/s at any outlet. All fixtures, fittings, and components in contact with drinking water must be WaterMark certified with lead content <0.25% per AS 4020. Keep WaterMark certificates on file — inspector may request. Do not use non-certified products (including some imported tapware).",
          reference: "NCC Vol 3 — AS/NZS 3500.1:2021, AS 4020",
        },
      ],
    },

    // ── SECTION 8: Livable Housing (NCC 2022 H9) ──────────────────────────
    {
      id: "livable",
      title: "Livable Housing (Accessibility)",
      icon: <Accessibility className="h-4 w-4" />,
      color: "green",
      items: [
        {
          id: "lh-1",
          requirement: "Step-free entry pathway — gradient preferred 1:20; max 1:14 over 15m; 1:8 max 1500mm; width ≥1000mm clear; R10 slip",
          detail: "Continuous accessible pathway from the street boundary or designated car park to the principal entry door. Preferred gradient 1:20 (5%); acceptable maximum 1:14 (7%) over segments up to 15m; short ramps up to 1:8 (12.5%) must be no longer than 1500mm. Pathway must be minimum 1000mm clear width (measured between any edge constraints). Surface must achieve minimum Pendulum Test Value (PTV) 36 wet (equivalent to R10 slip resistance) per AS 4586. Include passing space (1800mm×1800mm) on paths >15m.",
          reference: "NCC 2022 — H9D3, AS 1428.1:2009",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-2",
          requirement: "Step-free threshold — max 5mm lip; flush transition or ramped profile",
          detail: "Principal entrance door must have a step-free threshold — maximum 5mm vertical lip. Where a weather check or threshold detail is required, use a ramped profile transitioning gradually across the 5mm height. This applies to the primary entry door of each dwelling. Internal doors on the ground floor also should not have raised thresholds. Sliding doors often have an inherent track raised profile — verify final height after track and weatherstrip installation.",
          reference: "NCC 2022 — H9D3",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-3",
          requirement: "Internal doors — 820mm clear opening min on ground floor for all habitable rooms; lever hardware",
          detail: "All doors on the entry level giving access to habitable rooms must have minimum 820mm clear opening width (this requires a nominal 870mm door leaf in a standard rebated frame). Clear width is measured from the door stop face to the door face when fully open. Applies to: entry door, living, dining, kitchen, bedroom, bathroom, and toilet on the entry level. Door furniture must be lever-type (D-pull acceptable) — round knobs are not compliant. Hinges must allow full 90° opening without obstruction.",
          reference: "NCC 2022 — H9D4, AS 1428.1:2009",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-4",
          requirement: "Corridor/hallway — min 1000mm clear between walls from front door to first habitable room",
          detail: "The primary pathway through the dwelling from the entry door to the first habitable room (typically living or dining) must be minimum 1000mm clear between walls, built-in joinery, or any other obstruction. This applies even where the hallway is short. Where a corner turn is required, ensure 1000mm clear is maintained around the turn — check by drawing turning circle.",
          reference: "NCC 2022 — H9D4",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-5",
          requirement: "Toilet/bathroom — 900×1200mm clear floor space beside WC; outward or sliding door",
          detail: "Ground floor toilet/bathroom must have 900mm × 1200mm clear floor space beside the WC to allow side transfer access. This space must not be obstructed by door swing — use either an outward-opening door, offset pivot, or sliding/barn door. Alternatively, a positive direction inswing is acceptable if the 900×1200mm clear floor space is maintained when the door is open. The WC must be positioned with at least one side accessible (not built into a corner).",
          reference: "NCC 2022 — H9D5",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-6",
          requirement: "Grab rail reinforcement — nogging at 600–900mm AFF; 1.1 kN point load capacity for future rail",
          detail: "Walls around shower, toilet, and bath in the ground floor bathroom must be reinforced for future grab rail installation. Install horizontal nogging (blocking) at 600mm to 900mm AFF — minimum 35×90mm timber for timber framing or equivalent blocking in steel stud walls. The fixing substrate must be capable of resisting a 1.1 kN point load in any direction (test per AS 1428.1). Document nogging locations on as-built drawings. Do not tile over the nogging locations without marking them on a tile layout.",
          reference: "NCC 2022 — H9D5, AS 1428.1:2009",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-7",
          requirement: "Accessible parking — if provided, 1 space min 3200mm wide (800mm access zone); head clearance 2200mm",
          detail: "Where a dedicated car space is provided with the dwelling, at least one space must be 3200mm wide (2400mm vehicle bay + 800mm access zone on one side, or two spaces sharing an 800mm central zone). Head clearance minimum 2200mm for accessible parking bays. The access zone must connect to the accessible pathway to the dwelling entry. Garage door must allow 2200mm vertical clearance. Parking bay surface must be level (max 1:80 cross-fall) and non-slip.",
          reference: "NCC 2022 — H9D3, AS 2890.6",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-8",
          requirement: "Switches and GPOs — 600mm to 1200mm AFF; lever door handles; contrast with wall background",
          detail: "All switched general purpose outlets (GPOs), light switches, and other frequently used controls must be located between 600mm and 1200mm above finished floor level. This single height range applies to both the minimum and maximum heights, enabling use from seated position. Provide tonal contrast between switch/outlet face plate and wall background for low-vision users. All door handles throughout the dwelling must be lever type (not round knob). Kitchen and bathroom tapware should be lever or sensor type.",
          reference: "NCC 2022 — H9D4, AS 1428.1:2009",
          applicableClasses: ["1a", "1b", "2"],
        },
      ],
    },

    // ── SECTION 9: Stairways & Balustrades ────────────────────────────────
    {
      id: "stairs",
      title: "Stairways & Balustrades",
      icon: <ArrowUpDown className="h-4 w-4" />,
      color: "purple",
      items: [
        {
          id: "st-1",
          requirement: "Riser ≤190mm; going ≥240mm; 2R+G = 550–700mm; max ±5mm variation between risers in same flight",
          detail: "Residential stair dimensions: maximum riser 190mm; minimum going 240mm measured horizontally from nosing to nosing. The sum formula 2×Riser + Going must fall between 550mm and 700mm for comfortable stride. Consistency is critical for safety — maximum permissible variation between any two risers in the same flight is 5mm. Measure all risers during framing and after finishing (floor finish adds to bottom riser height). Open risers are only permitted where children under 125mm sphere test cannot pass through.",
          reference: "NCC Vol 2 — Part 3.9.1.1",
        },
        {
          id: "st-2",
          requirement: "Open risers — prohibited where 125mm sphere passes through; ≤100mm gap if open risers permitted",
          detail: "Open risers (no vertical face between treads) are prohibited in any location where children (under 5 years) could be expected to use the stair, unless the gap between the bottom of one tread and the top of the tread below is ≤100mm (sphere test: 125mm sphere must not pass through any part of the stair). For dwellings, the safest approach is no open risers. If open-riser design is desired, confirm client's circumstances and check jurisdictional requirements — some states require closed risers in all Class 1 dwellings.",
          reference: "NCC Vol 2 — Part 3.9.1.1",
        },
        {
          id: "st-3",
          requirement: "Stair width — ≥1000mm clear; handrail projection ≤100mm into required width",
          detail: "Minimum 1000mm clear width between any enclosing walls, balustrades, or stringers. Any handrail projection into the required stair width must be ≤100mm from each side — meaning on a 1000mm stair with handrails both sides, each handrail can project no more than 100mm. Where a stair also serves as an accessible path of travel, minimum width increases — check AS 1428.2 for accessible design. Width measured at tread nosing level.",
          reference: "NCC Vol 2 — Part 3.9.1",
        },
        {
          id: "st-4",
          requirement: "Landing — min 900×900mm clear at top and bottom; 750mm min if door swings onto landing",
          detail: "Level landing required at the top and bottom of every stair flight, minimum 900mm × 900mm clear of any door swing, handrail, or obstruction. Where a door opens onto the landing, the clear landing depth in the direction of travel must be minimum 750mm clear of the door swing plus the required 900mm width. Mid-flight landings required every 18 risers maximum. Landing gradient maximum 1:80 to prevent pooling.",
          reference: "NCC Vol 2 — Part 3.9.1",
        },
        {
          id: "st-5",
          requirement: "Handrail — 865–1000mm above nosing; 32–50mm circular diameter or grip equivalent; extends 300mm past top nosing",
          detail: "Handrail height measured vertically from the stair nosing line (the plane of all nosings) to the top of the handrail: minimum 865mm, maximum 1000mm. Profile must be graspable: circular section 32–50mm diameter or elliptical/shaped sections with equivalent 32–50mm grip dimension. Handrail must be continuous along the full stair flight and extend horizontally 300mm beyond the top nosing. At the bottom: extend beyond the bottom nosing for a distance equal to the tread going. Handrail ends must return to the wall or post to prevent snagging.",
          reference: "NCC Vol 2 — Part 3.9.2",
        },
        {
          id: "st-6",
          requirement: "Balustrade height — ≥1000mm where drop ≥1m; ≥865mm for stair flights; non-climbable; no horizontal rails",
          detail: "Balustrade height minimum 1000mm above the floor or deck where any drop is 1m or greater. On stair flights: minimum 865mm measured vertically from the nosing line. The balustrade must be designed to be non-climbable — no horizontal rails, decorative ledges, or openings that could serve as footholds. The 125mm sphere test applies: no opening in the balustrade (vertical, horizontal, or diagonal) must allow a 125mm sphere to pass through. Glass balustrades: minimum 10mm toughened or 6.38mm laminated (verify from AS 1288 Table 6.1 for wind load).",
          reference: "NCC Vol 2 — Part 3.9.2, AS 1170.1",
        },
        {
          id: "st-7",
          requirement: "Balustrade structural load — 0.6 kN/m horizontal; fixings and posts engineer-checked for spans >2m",
          detail: "Balustrade top rail and posts must resist horizontal load of 0.6 kN per metre of balustrade length (AS 1170.1 Table 3.4 for residential). This is the governing load for most balustrade designs — not just serviceability. Post fixings to concrete, timber, or steel must be designed for this load and the resulting overturning moment at the base. Glass panels: structural interlayer and patch or channel fixing to be specified by glazier. For spans >2m between posts, or for balustrades over 1.5m high, engineer design is recommended.",
          reference: "NCC Vol 2 — Part 3.9.2, AS 1170.1:2002",
        },
        {
          id: "st-8",
          requirement: "Stair treads — R10 slip resistance min; contrasting nosing strip; nosing ≤25mm overhang",
          detail: "Tread surfaces minimum slip resistance R10 (Pendulum Test wet value ≥36) per AS 4586. Contrasting (in colour or luminance) nosing strip minimum 50mm wide on each tread to assist low-vision users in identifying the tread edge. Nosing overhang maximum 25mm beyond the riser face — larger overhangs are a trip hazard. Nosing profile must not be a square sharp edge — rounded or bevelled leading edge required (maximum 5mm square edge, or 10mm bevel minimum).",
          reference: "NCC Vol 2 — Part 3.9.1, AS 4586:2013",
        },
      ],
    },

    // ── SECTION 10: Condensation & Ventilation ────────────────────────────
    {
      id: "condensation",
      title: "Condensation & Ventilation",
      icon: <Wind className="h-4 w-4" />,
      color: "teal",
      items: [
        {
          id: "cv-1",
          requirement: "Bathroom exhaust — 25 L/s continuous OR 50 L/s intermittent; auto-timer; ducted externally",
          detail: "Bathroom exhaust ventilation must achieve minimum 25 L/s when operating continuously, or 50 L/s if operating intermittently (timer-controlled). Fan must be ducted externally — NOT into ceiling cavity, roof space, or wall cavity. Discharge outside via external grille or roof cowl with backdraft damper. Timer switch recommended: set to run minimum 15 minutes after shower use to fully remove moisture. Fan rating (L/s) must be verified from manufacturer spec sheet at the actual duct length and configuration (longer ducts reduce actual flow).",
          reference: "NCC Vol 2 — Part 3.8.5",
        },
        {
          id: "cv-2",
          requirement: "Kitchen exhaust — ducted externally preferred; recirculating allowed with carbon + grease filter; duct DN150; <7 m/s",
          detail: "Kitchen exhaust: ducted externally is preferred. If recirculating rangehood used, must have both grease filter (mechanical) and activated carbon filter. External duct minimum DN150 (150mm diameter) rigid duct — avoid flexible duct for kitchens as grease accumulates in corrugations. Duct velocity should not exceed 7 m/s to minimise noise — check at actual duct size. Backdraft damper at wall penetration to prevent cold air ingress. External cowl must resist 25 Pa wind pressure.",
          reference: "NCC Vol 2 — Part 3.8.5",
        },
        {
          id: "cv-3",
          requirement: "Roof space ventilation — 0.2% of ceiling area each side as free area; cross-ventilation path",
          detail: "Roof space must be cross-ventilated to remove heat and moisture. Minimum free ventilation area: 0.2% of ceiling area on at least two opposite sides (e.g., 100m² ceiling requires 0.2m² = 2000cm² each side). Soffit/eave vents on opposite elevations provide cross-flow. Ensure vents are not blocked by insulation at eaves — maintain minimum 50mm air path over insulation at all eaves. In bushfire prone areas: all vents must be protected with 2mm mesh.",
          reference: "NCC Vol 2 — Part 3.8.4",
        },
        {
          id: "cv-4",
          requirement: "Natural ventilation — habitable rooms openable area ≥5% of floor area; OR 10 L/s mechanical",
          detail: "Each habitable room must have openable ventilation area of at least 5% of the room's floor area (e.g., 15m² room = 0.75m² openable area). Cross-ventilation is preferred and especially important in Zones 1–3. Alternatively, mechanical ventilation at minimum 10 L/s per person (not less than 10 L/s per room) from an external source. Openable area measured as the clear opening — not the frame size. Windows with security stays that limit opening to <100mm do not satisfy this requirement.",
          reference: "NCC Vol 2 — Part 3.8.4",
        },
        {
          id: "cv-5",
          requirement: "Subfloor ventilation — 3500mm²/m of external wall; no blocked vents; min 150mm floor to ground clearance",
          detail: "Suspended timber floors require subfloor ventilation to prevent moisture accumulation and timber decay. Minimum 3500mm² per lineal metre of external wall as free ventilation area distributed on at least two opposite sides. Vents must never be blocked — check that garden beds, cladding finishes, and insulation do not obstruct vents. Minimum 150mm clearance between the underside of the floor framing and the ground. Earth in the subfloor space must be graded to drain away from the building.",
          reference: "NCC Vol 2 — Part 3.4.1",
        },
        ...(isColdZone ? [
          {
            id: "cv-6",
            requirement: "Condensation risk — Zones 6–8: vapour permeable sarking in walls; no foil in wall cavities; dew point check",
            detail: "In Climate Zones 6–8, interstitial condensation is a significant risk. Warm moist internal air diffuses through wall insulation and can condense on the cold external face of insulation or sheathing. Use vapour permeable (breathable) sarking behind external wall cladding — not foil-faced products. Foil in wall cavities acts as a vapour barrier on the wrong side and traps moisture. For unusual or high-insulation wall systems, a dew point analysis or hygrothermal simulation (e.g., WUFI software) is recommended. Ensure continuous drainage plane from sarking to weep holes.",
            reference: "NCC 2022 — H6D6, Zone 6–8",
            applicableZones: [6, 7, 8],
          },
          {
            id: "cv-7",
            requirement: "Vapour permeable roof sarking — Zones 6–8; installed before battens; lap 150mm down slope; drainage at eaves",
            detail: "In Zones 6–8, roof sarking under tiles or metal roofing must be vapour permeable (breathable type, not standard foil) to allow any moisture in the roof space to escape. Install shiny side down before battens are fixed. All horizontal laps minimum 150mm in the direction of water flow (down slope); vertical laps minimum 100mm over a batten. At eaves: turn sarking down into the fascia or gutter cavity to direct any condensation drainage to the outside rather than allowing it to drip onto ceiling insulation.",
            reference: "NCC 2022 — H6D6, Part 3.5.1",
            applicableZones: [6, 7, 8],
          },
        ] : []),
      ],
    },

    // ── SECTION 11: Electrical (AS/NZS 3000:2018) ─────────────────────────
    {
      id: "electrical",
      title: "Electrical & Safety",
      icon: <Zap className="h-4 w-4" />,
      color: "amber",
      items: [
        {
          id: "el-1",
          requirement: "RCD (safety switch) — Type I on all circuits; 30mA trip; max trip time 300ms; monthly test",
          detail: "Type I Residual Current Devices (RCDs/safety switches) mandatory on all final subcircuits including power and lighting. Trip current 30mA; maximum disconnection time 300ms at rated trip current (most devices trip much faster — <30ms). Monthly test using the test button is recommended for occupants. RCDs must be individually labelled at the switchboard. At least one RCD must be accessible from outside the switchboard (or the test button accessible) for monthly testing. Since AS/NZS 3000:2018, all circuits require RCD protection — no exemptions for hardwired appliances.",
          reference: "AS/NZS 3000:2018 — 2.6.3.2",
        },
        {
          id: "el-2",
          requirement: "Circuit loading — max 20A subcircuit; ≤20 socket outlets per circuit; separate circuits for fixed appliances >1kW",
          detail: "Maximum 20A for any final subcircuit. Standard socket outlet circuits: no more than 20 socket outlets per circuit as common practice (not a hard rule but industry standard). Dedicated circuits required for: electric oven/cooktop (dedicated 20A or 32A 3-phase circuit); hot water system (dedicated 20A circuit); air conditioning (dedicated circuit per unit); dishwasher and washing machine on dedicated circuits if built-in. Never connect a microwave, dishwasher, or refrigerator to the same circuit as cooking appliances.",
          reference: "AS/NZS 3000:2018 — Part 4",
        },
        {
          id: "el-3",
          requirement: "GPO clearances in wet areas — no GPO within 300mm of water source; bathroom GPOs min 3m from shower/bath",
          detail: "Zone 0 (inside bath/shower): no electrical except SELV. Zone 1 (0–200mm above bath rim/shower base): no GPOs, only IP45-rated fixed equipment. Zone 2 (200–2250mm AFF): no GPOs within 600mm of bath/shower edge (AS/NZS 3000 Figure 6.2). In bathrooms: no general power outlet within 3m of the shower or bath measured as the shortest distance (horizontal or diagonal). Above cooking surfaces: no GPO without protection shield; minimum 150mm from any gas appliance. Shaving supply units with isolation transformer are the exception (may be closer to water).",
          reference: "AS/NZS 3000:2018 — 4.4.2, Figure 6.2",
        },
        {
          id: "el-4",
          requirement: "Safety switches (RCD) — Type I on all circuits; AFDD arc-fault protection recommended; 20% spare capacity in switchboard",
          detail: "Main switchboard: minimum IP2X ingress protection rating (finger-proof enclosures). All circuits labelled clearly and permanently. Arc Fault Detection Devices (AFDD) are recommended per AS/NZS 3000:2018 — provide additional protection against electrical fires from arc faults (loose connections, damaged cable insulation). Type II SPD (surge protection device) in the main switchboard to protect against transient overvoltage. Minimum 20% spare capacity (spare circuit breaker ways) to allow for future additional circuits. RCDs on separate poles so one trip does not disable all power.",
          reference: "AS/NZS 3000:2018 — 2.10.6, 4.3",
        },
        {
          id: "el-5",
          requirement: "Underground cables — 500mm depth in garden, 300mm in concrete; conduit for protection",
          detail: "Direct-buried underground cables: minimum 500mm depth in garden beds and soft landscaped areas; minimum 300mm depth under concrete slabs or paved areas. Cables at less than 500mm depth must be protected by conduit or armoured cable. Where cables cross under paving or driveways, place in conduit with 100mm clearance above and below the pipe. Mark cable routes on as-built drawings. Install marking tape 150mm above the cable during backfill. All underground cable joints must be in accessible enclosures — no buried joints.",
          reference: "AS/NZS 3000:2018 — 3.12",
        },
        {
          id: "el-6",
          requirement: "EV readiness — 20A dedicated circuit to lockable enclosure near parking space; conduit from switchboard",
          detail: "NCC 2022 recommends (and some states mandate) EV charging readiness for new dwellings with a garage or dedicated car space. Install: 20A dedicated circuit from switchboard terminated in a lockable enclosure adjacent to the parking space; 32mm conduit from main switchboard to the enclosure for future cable upgrades; ensure the switchboard has capacity for a future 7.4kW (32A) EV charger circuit. In VIC: mandatory EV readiness for new Class 1 buildings from 2024. Label the circuit 'EV Charging'.",
          reference: "NCC 2022 — Advisory H6, state regulations (VIC, ACT)",
        },
        {
          id: "el-7",
          requirement: "Surge protection — Type II SPD at main switchboard; protects against transient overvoltage",
          detail: "Type II Surge Protection Device (SPD) at the main switchboard as per AS/NZS 3000:2018 recommendation. Protects all downstream equipment from transient overvoltage caused by lightning or grid switching. SPD must be installed in a dedicated circuit breaker way or as a plug-in type. Let-through voltage (Up) ≤1.5 kV for Type II devices. SPD has a finite service life — must be replaced after a major surge event (indicator lamp should show status). Document installation in the switchboard schedule.",
          reference: "AS/NZS 3000:2018 — 2.10.6",
        },
      ],
    },

    // ── SECTION 12: Thermal Comfort & Glazing ─────────────────────────────
    {
      id: "thermal",
      title: "Thermal Comfort & Glazing",
      icon: <Thermometer className="h-4 w-4" />,
      color: "rose",
      items: [
        {
          id: "th-1",
          requirement: `Total glazing area ≤ ${isHotZone ? "25%" : "40%"} of floor area; oversized areas need NatHERS justification`,
          detail: `Excessive glazing significantly increases both heating and cooling loads. Typical maximum without NatHERS justification: ${isHotZone ? "25% of floor area in Zones 1–3 (cooling-dominated)" : "40% of floor area"}. Areas beyond this threshold must be demonstrated compliant through NatHERS modelling with compensating insulation, shading, or performance glazing. West-facing glazing is the most thermally problematic in all zones — minimise and shade. Large north-facing areas acceptable in Zones 6–8 with appropriate shading design.`,
          reference: "NCC Vol 2 — Part 3.12, H6D4",
        },
        {
          id: "th-2",
          requirement: `${isHotZone ? "North glazing shaded — eaves sized for summer shade, winter sun entry" : "North glazing maximised for passive solar — 60–70% of total glazing north-facing"}`,
          detail: isHotZone
            ? "Zones 1–3: north-facing glazing shaded by eaves or pergola. Eave depth calculation: divide eave horizontal projection by the window height to get the shade factor — aim for sun exclusion between 10am and 3pm on the summer solstice while allowing winter sun. Fixed eaves recommended over adjustable shading for low maintenance. East and west glazing minimised — these are the hardest elevations to shade."
            : "Zones 5–8: maximise north-facing glazing for passive solar gain — ideally 60–70% of total glazing area on the north facade. Eave overhang sized to block high summer sun (≥70° altitude) while admitting low winter sun (≤40° altitude). Rule of thumb: eave projection ≈ window head height × 0.5 for Melbourne latitude. Thermal mass (concrete, masonry) on north-facing interior walls to absorb and re-radiate solar heat.",
          reference: "NCC Vol 2 — H6D4",
        },
        {
          id: "th-3",
          requirement: "Safety glazing — AS 1288 required in all doors, sidelights to 1500mm AFF, and stairwells",
          detail: "Safety glazing (toughened or laminated) required by AS 1288 in: all glass doors and panels adjacent to doors; sidelights with any part below 1500mm AFF; glass in or adjacent to stairways; glass where impact is foreseeable (shower screens — toughened only; floor-to-ceiling panels). Toughened glass must be marked with the AS/NZS 4667 kite mark. Laminated glass is also acceptable. Wired glass is NOT acceptable as safety glazing in residential applications. Glazier must provide a certificate of compliance.",
          reference: "NCC Vol 2 — Part 3.6.4, AS 1288:2006",
        },
        {
          id: "th-4",
          requirement: "External wall thermal mass — lightweight preferred Zones 1–3 for night purge; heavyweight Zones 5–8 for heat storage",
          detail: isHotZone
            ? "Zones 1–3: lightweight construction (timber frame with lightweight cladding) allows building to cool rapidly overnight by ventilation (night purge strategy). Heavy masonry walls in hot climates absorb heat during the day and re-radiate it at night, increasing cooling loads. If masonry is used, ensure night ventilation can purge the stored heat."
            : "Zones 5–8: thermal mass (concrete slab, masonry walls) on north-facing interior surfaces absorbs solar energy during the day and releases it at night, reducing heating demand. Minimum 75mm concrete or 110mm brick/block. Mass must be on the inside face of insulation — insulated on the outside (reverse brick veneer) performs poorly.",
          reference: "NCC Vol 2 — H6D3",
        },
        {
          id: "th-5",
          requirement: "Window installation — WERS rating label; flashing all sides; backer rod + sealant at frame perimeter",
          detail: "Windows must have Window Energy Rating Scheme (WERS) label matching the specified U-value and SHGC. Installation: jamb, head, and sill flashing to manufacturer's specification — 80% of water ingress in buildings occurs at window and door openings. Head flashing: concealed under cladding with upturned legs; sill flashing: sloped to drain forward; jamb flashing: wrap into rough opening. Frame-to-wall junction: flexible foam backer rod at perimeter gap, then paintable sealant. Check flashing before wall wrap or cladding installation.",
          reference: "NCC Vol 2 — Part 3.6, AS 2047:2014",
        },
      ],
    },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CheckStatus, { label: string; color: string; icon: React.ReactNode }> = {
  unchecked: { label: "Not Checked", color: "bg-slate-100 text-slate-600 border-slate-200", icon: <MinusCircle className="h-3.5 w-3.5" /> },
  pass:      { label: "Pass ✓",      color: "bg-green-100 text-green-700 border-green-200",  icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  fail:      { label: "Fail ✗",      color: "bg-red-100 text-red-700 border-red-200",        icon: <XCircle className="h-3.5 w-3.5" /> },
  na:        { label: "N/A",         color: "bg-blue-50 text-blue-600 border-blue-200",      icon: <MinusCircle className="h-3.5 w-3.5" /> },
};

const STATUS_CYCLE: CheckStatus[] = ["unchecked", "pass", "fail", "na"];

function nextStatus(current: CheckStatus): CheckStatus {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

const SECTION_COLOR_MAP: Record<string, string> = {
  amber: "bg-amber-50 border-amber-200",
  orange: "bg-orange-50 border-orange-200",
  yellow: "bg-yellow-50 border-yellow-200",
  blue: "bg-blue-50 border-blue-200",
  red: "bg-red-50 border-red-200",
  cyan: "bg-cyan-50 border-cyan-200",
  green: "bg-green-50 border-green-200",
  purple: "bg-purple-50 border-purple-200",
  teal: "bg-teal-50 border-teal-200",
  rose: "bg-rose-50 border-rose-200",
};

// ── Rules & AS Lookup Databases ───────────────────────────────────────────────

interface RuleEntry {
  id: string;
  buildingType: "residential" | "commercial" | "both";
  category: string;
  rule: string;
  requirement: string;
  nccRef: string;
  asRef: string;
  asTitle: string;
  notes: string;
}

interface ASEntry {
  id: string;
  asNumber: string;
  title: string;
  scope: string;
  keywords: string[];
  buildingType: "residential" | "commercial" | "both";
  category: string;
  nccLink: string;
  practicalNote: string;
}

const RULE_CATEGORIES = [
  "All","Structural","Electrical","Plumbing","Fire Safety",
  "Waterproofing","Energy Efficiency","Accessibility","Glazing & Windows",
  "Roofing","Mechanical & Ventilation","Gas","Hydraulic","Thermal",
];

const RULES_DB: RuleEntry[] = [
  // ── RESIDENTIAL ──────────────────────────────────────────────────────────
  { id:"r1",  buildingType:"residential", category:"Structural",      rule:"Timber framing — non-cyclonic",        requirement:"All timber framing must comply with span tables, species, grade and fixing requirements",   nccRef:"NCC Vol 2 — Part 3.4",      asRef:"AS 1684.2:2021",       asTitle:"Residential timber-framed construction (non-cyclonic)",               notes:"Use span tables for floor joists, rafters, ceiling joists and beams. Verify species and stress grade on timber delivery." },
  { id:"r2",  buildingType:"residential", category:"Structural",      rule:"Timber framing — cyclonic areas",      requirement:"Cyclonic regions require enhanced tie-down, bracing and connection details",                  nccRef:"NCC Vol 2 — Part 3.4",      asRef:"AS 1684.3:2021",       asTitle:"Residential timber-framed construction (cyclonic areas)",             notes:"Required in Qld/WA/NT coastal areas — additional strapping, connections and wind classifications C1–C4 apply." },
  { id:"r3",  buildingType:"residential", category:"Structural",      rule:"Steel light gauge framing",            requirement:"Cold-formed steel framing for residential must comply with design and connection rules",       nccRef:"NCC Vol 2 — Part 3.4",      asRef:"AS 4600:2018",         asTitle:"Cold-formed steel structures",                                        notes:"Used for steel stud walls and trusses — connection screws, track and stud sizes must match design." },
  { id:"r4",  buildingType:"residential", category:"Structural",      rule:"Residential footings & slabs",         requirement:"Site classification (A/S/M/H/E/P) determines footing type and dimensions",                    nccRef:"NCC Vol 2 — Part 3.2.2",    asRef:"AS 2870:2011",         asTitle:"Residential slabs and footings — design and construction",            notes:"Get a site classification report before designing footings. Class H and E require engineer input." },
  { id:"r5",  buildingType:"residential", category:"Structural",      rule:"Wind loads for housing",               requirement:"Wind region and terrain category determine design actions on structure and cladding",          nccRef:"NCC Vol 2 — Part 3.10.1",   asRef:"AS 4055:2012",         asTitle:"Wind loads for housing",                                              notes:"Wind classification N1–N6 (non-cyclonic) and C1–C4 (cyclonic). Higher classifications need stronger fixings." },
  { id:"r6",  buildingType:"residential", category:"Structural",      rule:"Masonry walls",                        requirement:"Brick/block walls must meet stability, bond, coursing and control joint requirements",         nccRef:"NCC Vol 2 — Part 3.3",      asRef:"AS 3700:2018",         asTitle:"Masonry structures",                                                  notes:"Unreinforced masonry limited in height/length — control joints at max 6m. Mortar mix ratios matter." },
  { id:"r7",  buildingType:"residential", category:"Structural",      rule:"Termite management",                   requirement:"Physical or chemical termite barrier required in all new Class 1 buildings",                  nccRef:"NCC Vol 2 — Part 3.1.3",    asRef:"AS 3660.1:2014",       asTitle:"Termite management — new building work",                              notes:"Install barrier before slab pour or at base of wall framing. Inspector must sign off on installation." },
  { id:"r8",  buildingType:"residential", category:"Waterproofing",   rule:"Wet area waterproofing",               requirement:"Shower, bath, laundry floor and adjacent walls fully waterproofed to AS 3740",               nccRef:"NCC Vol 2 — Part 3.8.1",    asRef:"AS 3740:2021",         asTitle:"Waterproofing of domestic wet areas",                                 notes:"Shower walls: 1800mm min height. Floor: full membrane with 50mm upstand. Apply, cure, inspect before tiling." },
  { id:"r9",  buildingType:"residential", category:"Waterproofing",   rule:"Above-ground deck membranes",          requirement:"Balconies and decks over habitable space need continuous waterproof membrane system",           nccRef:"NCC Vol 2 — Part 3.8.1",    asRef:"AS 4654.2:2012",       asTitle:"Waterproofing membranes for external above-ground use — design",     notes:"150mm upstand at walls, positive fall to drain, compatible membrane and primer required." },
  { id:"r10", buildingType:"residential", category:"Roofing",         rule:"Metal roofing and wall cladding",      requirement:"Metal sheeting must be installed with correct laps, fixings and fastener spacing",              nccRef:"NCC Vol 2 — Part 3.5",      asRef:"AS 1562.1:2018",       asTitle:"Design and installation of sheet roof and wall cladding — metal",    notes:"Fastener pull-out must meet wind classification. Lap sealing at ridge, hips and valleys critical." },
  { id:"r11", buildingType:"residential", category:"Roofing",         rule:"Roof tiles",                           requirement:"Concrete and terracotta tiles must be bedded, pointed and fixed to manufacturer's details",  nccRef:"NCC Vol 2 — Part 3.5",      asRef:"AS 2049:2018",         asTitle:"Roof tiles — selection and installation",                             notes:"Ridge and hip tiles: mechanically fix every tile in cyclonic areas. Batten size from AS 1684." },
  { id:"r12", buildingType:"residential", category:"Fire Safety",     rule:"Smoke alarms",                         requirement:"Interconnected mains-powered smoke alarms on every storey and in/near every bedroom",         nccRef:"NCC Vol 2 — Part 3.7.2",    asRef:"AS 3786:2014",         asTitle:"Smoke alarms using scattered light, transmitted light or ionization", notes:"240V hardwired or 10-year lithium battery. Position on ceiling ≥300mm from walls, away from vents." },
  { id:"r13", buildingType:"residential", category:"Fire Safety",     rule:"Bushfire construction",                requirement:"Construction details depend on BAL rating (12.5, 19, 29, 40, FZ) assessed for site",          nccRef:"NCC Vol 2 — Part 3.7.4",    asRef:"AS 3959:2018",         asTitle:"Construction of buildings in bushfire-prone areas",                   notes:"BAL assessment needed before design. Higher BAL = ember-proof vents, toughened glass, non-combustible cladding." },
  { id:"r14", buildingType:"residential", category:"Electrical",      rule:"Electrical wiring rules",              requirement:"All fixed electrical wiring and equipment in dwellings must comply with the wiring rules",    nccRef:"NCC Vol 2 — Part 3.11",     asRef:"AS/NZS 3000:2018",     asTitle:"Wiring rules — electrical installations",                             notes:"RCDs required on all circuits. Separation of circuits for high-load appliances. Licensed electrician only." },
  { id:"r15", buildingType:"residential", category:"Electrical",      rule:"Cable selection",                      requirement:"Correct cable type, size and installation method for each circuit application",              nccRef:"NCC Vol 2 — Part 3.11",     asRef:"AS/NZS 3008.1.1:2017", asTitle:"Electrical installations — selection of cables (low voltage AC)",     notes:"Cable rating depends on installation method (in roof, wall, conduit). Derating factors apply in conduit." },
  { id:"r16", buildingType:"residential", category:"Plumbing",        rule:"Water supply services",                requirement:"Cold and hot water supply to comply with pressure, material and installation requirements",    nccRef:"NCC Vol 3 — AS/NZS 3500.1", asRef:"AS/NZS 3500.1:2021",   asTitle:"Plumbing and drainage — water services",                              notes:"Min 150 kPa at highest outlet, max 500 kPa (regulator required if higher). Copper, CPVC or PEX pipe types." },
  { id:"r17", buildingType:"residential", category:"Plumbing",        rule:"Sanitary plumbing & drainage",         requirement:"Drainage fall, trap depths, vent sizing and inspection opening placement requirements",         nccRef:"NCC Vol 3 — AS/NZS 3500.2", asRef:"AS/NZS 3500.2:2021",   asTitle:"Plumbing and drainage — sanitary plumbing and drainage",              notes:"Minimum fall 1:40 (40mm/m). Every trap needs vent or air admittance valve. DN100 main drain." },
  { id:"r18", buildingType:"residential", category:"Plumbing",        rule:"Stormwater drainage",                  requirement:"Roof runoff discharged to stormwater — no connection to sewer system permitted",             nccRef:"NCC Vol 3 — AS/NZS 3500.3", asRef:"AS/NZS 3500.3:2018",   asTitle:"Plumbing and drainage — stormwater drainage",                         notes:"Pits and pipes sized for local rainfall intensity (BOM data). No cross-connections ever." },
  { id:"r19", buildingType:"residential", category:"Plumbing",        rule:"Heated water services",                requirement:"Storage at ≥60°C, delivered at ≤50°C to bathrooms via tempering valve",                     nccRef:"NCC Vol 3 — AS/NZS 3500.4", asRef:"AS/NZS 3500.4:2018",   asTitle:"Plumbing and drainage — heated water services",                       notes:"Solar, gas and electric HWS all require tempering valve at point of installation. Label all valves." },
  { id:"r20", buildingType:"residential", category:"Gas",             rule:"Gas installations",                    requirement:"All gas appliance connections, pipe sizing, testing and ventilation requirements",            nccRef:"NCC Vol 3",                 asRef:"AS/NZS 5601.1:2013",   asTitle:"Gas installations — Part 1: General installations",                  notes:"Gas leak test at 1.5× working pressure. Ventilation required for all gas appliances. Licensed gasfitter only." },
  { id:"r21", buildingType:"residential", category:"Energy Efficiency",rule:"Thermal insulation",                  requirement:"Insulation products must meet labelling, R-value and installation standard requirements",       nccRef:"NCC Vol 2 — H6D3",          asRef:"AS/NZS 4859.1:2018",   asTitle:"Materials for the thermal insulation of buildings — general criteria", notes:"Check R-value label matches spec. Install without gaps or compression. Critical at eaves junctions." },
  { id:"r22", buildingType:"residential", category:"Glazing & Windows",rule:"Glass in buildings",                  requirement:"Glass type, thickness and location must meet human impact and wind load requirements",        nccRef:"NCC Vol 2 — Part 3.6",      asRef:"AS 1288:2006",         asTitle:"Glass in buildings — selection and installation",                     notes:"Safety glass required: doors, sidelights to 1500mm AFF, stairwell glazing. Toughened or laminated." },
  { id:"r23", buildingType:"residential", category:"Glazing & Windows",rule:"Windows & external doors",            requirement:"Windows must meet performance requirements for structural, water and air infiltration",       nccRef:"NCC Vol 2 — Part 3.6",      asRef:"AS 2047:2014",         asTitle:"Windows in buildings — selection and installation",                   notes:"Window WERS rating for energy performance. Flashing installation critical — 80% of water ingress is at windows." },
  { id:"r24", buildingType:"residential", category:"Accessibility",   rule:"Design for access",                   requirement:"Access and mobility requirements for door widths, circulation, ramps and fittings",           nccRef:"NCC 2022 — H9",             asRef:"AS 1428.1:2009",       asTitle:"Design for access and mobility — general requirements for new building work", notes:"820mm clear door opening, 1000mm circulation space, ≤5mm threshold. Applies to livable housing provisions." },
  { id:"r25", buildingType:"residential", category:"Structural",      rule:"Permanent & imposed loads",            requirement:"Structural elements designed for dead loads + live loads as per the standard",               nccRef:"NCC Vol 2 — Part 3.4",      asRef:"AS 1170.1:2002",       asTitle:"Structural design actions — permanent, imposed and other actions",    notes:"Floor live load: 1.5 kPa residential, 3.0 kPa balconies. Roof: 0.25 kPa + concentrated 1.1 kN." },
  { id:"r26", buildingType:"residential", category:"Structural",      rule:"Slip resistance — floors",             requirement:"Floor surfaces in wet areas must achieve minimum slip resistance classification",              nccRef:"NCC Vol 2 — Part 3.8",      asRef:"AS 4586:2013",         asTitle:"Slip resistance classification of new pedestrian surface materials",  notes:"Wet area floors: Class C minimum (R10+ pendulum). External paths: Class D/E. Get test certificate from tile supplier." },
  { id:"r27", buildingType:"residential", category:"Mechanical & Ventilation", rule:"Natural ventilation — habitable rooms", requirement:"Each habitable room must have openable area ≥5% of floor area for natural ventilation", nccRef:"NCC Vol 2 — Part 3.8.4",    asRef:"NCC Vol 2 Part 3.8.4", asTitle:"NCC Volume 2 — Ventilation of buildings",                            notes:"Alternatively, mechanical ventilation at 10 L/s per person. Cross-ventilation preferred in hot climates." },

  // ── COMMERCIAL ───────────────────────────────────────────────────────────
  { id:"c1",  buildingType:"commercial",  category:"Structural",      rule:"Concrete structures",                  requirement:"Design of all reinforced and prestressed concrete elements including slabs, beams, columns",  nccRef:"NCC Vol 1 — B1",            asRef:"AS 3600:2018",         asTitle:"Concrete structures",                                                 notes:"Reinforcement cover, bar spacing and lap lengths must be documented on structural drawings. Certifier inspects." },
  { id:"c2",  buildingType:"commercial",  category:"Structural",      rule:"Steel structures",                     requirement:"Structural steel design including connections, welds and bolted joints",                     nccRef:"NCC Vol 1 — B1",            asRef:"AS 4100:2020",         asTitle:"Steel structures",                                                    notes:"ITP required for fabrication and erection. Welder qualifications to AS 2980. NDT for critical welds." },
  { id:"c3",  buildingType:"commercial",  category:"Structural",      rule:"Composite steel-concrete",             requirement:"Design of composite beams, slabs and columns in multi-storey construction",                   nccRef:"NCC Vol 1 — B1",            asRef:"AS 2327:2017",         asTitle:"Composite structures",                                                notes:"Shear connectors critical — spacing and weld size from design. Propping requirements during pour." },
  { id:"c4",  buildingType:"commercial",  category:"Structural",      rule:"Timber structures",                    requirement:"Structural timber elements in commercial buildings — glulam, LVL, solid timber",             nccRef:"NCC Vol 1 — B1",            asRef:"AS 1720.1:2010",       asTitle:"Timber structures — design methods",                                  notes:"Mass timber increasingly common in commercial. Connection design critical — engineer required." },
  { id:"c5",  buildingType:"commercial",  category:"Structural",      rule:"Wind actions — commercial",            requirement:"Wind pressure on facades, roof and structural elements of all commercial buildings",          nccRef:"NCC Vol 1 — B1",            asRef:"AS 1170.2:2021",       asTitle:"Structural design actions — wind actions",                            notes:"Regional wind speed × terrain × shielding factors. Façade and cladding pressures often govern design." },
  { id:"c6",  buildingType:"commercial",  category:"Structural",      rule:"Seismic actions",                      requirement:"Earthquake design for commercial buildings depending on building importance level",           nccRef:"NCC Vol 1 — B1",            asRef:"AS 1170.4:2007",       asTitle:"Structural design actions — earthquake actions in Australia",         notes:"Most of Aus is low seismicity. Importance Level 3 and 4 buildings (hospitals, emergency) have stricter requirements." },
  { id:"c7",  buildingType:"commercial",  category:"Fire Safety",     rule:"Automatic sprinkler systems",          requirement:"Class 2–9 buildings often require automatic sprinkler systems depending on rise and area",    nccRef:"NCC Vol 1 — E1",            asRef:"AS 2118.1:2017",       asTitle:"Automatic fire sprinkler systems — standard systems",                 notes:"Sprinkler heads: spacing, obstruction clearance and hydraulic design. Full hydraulic calculations required." },
  { id:"c8",  buildingType:"commercial",  category:"Fire Safety",     rule:"Fire detection & warning",             requirement:"Addressable fire detection system with detectors, sounders, MCP and FACP required",          nccRef:"NCC Vol 1 — E1",            asRef:"AS 1670.1:2018",       asTitle:"Fire detection, warning, control and intercom — system design",      notes:"Zone layout, detector spacing and cable type on BAS drawings. Annual commissioning certification." },
  { id:"c9",  buildingType:"commercial",  category:"Fire Safety",     rule:"Smoke control & fire control",         requirement:"Smoke exhaust and pressurisation systems for high-rise, atrium and carpark buildings",        nccRef:"NCC Vol 1 — E2",            asRef:"AS 1668.1:2015",       asTitle:"The use of ventilation and airconditioning in buildings — fire and smoke control", notes:"System must be tested and certified at practical completion. Mode matrix critical for BAS integration." },
  { id:"c10", buildingType:"commercial",  category:"Fire Safety",     rule:"Portable fire equipment",              requirement:"Fire extinguishers and hose reels at required locations, type matched to fire class",          nccRef:"NCC Vol 1 — E1",            asRef:"AS 2444:2001",         asTitle:"Portable fire extinguishers and fire blankets — selection and location", notes:"Max 30m travel to extinguisher (15m hose reel). Annual service tag required. Signage mandatory." },
  { id:"c11", buildingType:"commercial",  category:"Fire Safety",     rule:"Emergency lighting",                   requirement:"Emergency and exit lighting must operate for ≥90 minutes on battery backup",                  nccRef:"NCC Vol 1 — E4",            asRef:"AS 2293.1:2018",       asTitle:"Emergency escape lighting and exit signs — system design, installation and operation", notes:"Annual test + 90-min discharge test every 3 years. Self-contained or central battery system." },
  { id:"c12", buildingType:"commercial",  category:"Fire Safety",     rule:"Fire-resistant doorsets",              requirement:"Fire doors must be tested, labelled, self-closing and not held open except by approved device",nccRef:"NCC Vol 1 — C3",            asRef:"AS 1905.1:2005",       asTitle:"Components for the protection of openings in fire-resistant walls — fire-resistant doorsets", notes:"Never wedge open fire doors. Inspect seals and closers monthly. Certification label must be visible." },
  { id:"c13", buildingType:"commercial",  category:"Fire Safety",     rule:"Fire dampers",                         requirement:"Fire dampers in ducts penetrating fire-rated walls and floors — access required for testing", nccRef:"NCC Vol 1 — C3",            asRef:"AS 4428.1:2017",       asTitle:"Fire dampers",                                                        notes:"Access panels within 300mm of damper. Tested on installation, then annually. Inspection record kept." },
  { id:"c14", buildingType:"commercial",  category:"Mechanical & Ventilation", rule:"Mechanical ventilation",       requirement:"Supply air rates, exhaust rates and filtration for occupant comfort and air quality",        nccRef:"NCC Vol 1 — F4",            asRef:"AS 1668.2:2012",       asTitle:"The use of ventilation and airconditioning — ventilation design for indoor air contaminant control", notes:"Min 10 L/s/person fresh air. CO2 sensors for demand-controlled ventilation (DCV)." },
  { id:"c15", buildingType:"commercial",  category:"Electrical",      rule:"Commercial wiring rules",              requirement:"All fixed electrical wiring in commercial buildings must comply with the wiring rules",      nccRef:"NCC Vol 1 — F3",            asRef:"AS/NZS 3000:2018",     asTitle:"Wiring rules — electrical installations",                             notes:"Separation of ELV, LV and HV circuits. Cable management system documented on services drawings." },
  { id:"c16", buildingType:"commercial",  category:"Electrical",      rule:"Switchgear assemblies",                requirement:"Main switchboards and distribution boards must comply with the switchgear standard",         nccRef:"NCC Vol 1 — F3",            asRef:"AS/NZS 61439:2016",    asTitle:"Low-voltage switchgear and controlgear assemblies",                   notes:"Type testing or verification required. IP rating appropriate for installation environment." },
  { id:"c17", buildingType:"commercial",  category:"Electrical",      rule:"Lightning protection",                 requirement:"Tall and isolated structures may require external lightning protection system",             nccRef:"NCC Vol 1 — F3",            asRef:"AS 1768:2007",         asTitle:"Lightning protection",                                                notes:"Risk assessment determines if required. Air termination, down conductors and earth termination network." },
  { id:"c18", buildingType:"commercial",  category:"Accessibility",   rule:"Access for people with disability",    requirement:"All Class 2–9 buildings must provide accessible path of travel to all areas open to public",  nccRef:"NCC Vol 1 — D3",            asRef:"AS 1428.1:2009",       asTitle:"Design for access and mobility — general requirements",               notes:"Continuous accessible path: 1000mm min clear, ≤1:20 grade, passing bays. Compliance certificate required." },
  { id:"c19", buildingType:"commercial",  category:"Accessibility",   rule:"Enhanced access provisions",           requirement:"Sanitary facilities, signage, hearing augmentation and wayfinding requirements",             nccRef:"NCC Vol 1 — F2, D3",        asRef:"AS 1428.2:1992",       asTitle:"Design for access and mobility — enhanced and additional requirements", notes:"Applies to Class 3, 5, 6, 7, 8, 9 buildings. Includes tactile paths, hearing loops and Braille signage." },
  { id:"c20", buildingType:"commercial",  category:"Accessibility",   rule:"Tactile ground surface indicators",    requirement:"Tactile hazard and directional indicators at stairs, ramps, crossings and platforms",        nccRef:"NCC Vol 1 — D3",            asRef:"AS 1428.4.1:2009",     asTitle:"Design for access and mobility — means to assist the orientation of people with vision impairment", notes:"Colour contrast 30% LRV difference. Install before practical completion — inspected by access consultant." },
  { id:"c21", buildingType:"commercial",  category:"Hydraulic",       rule:"Hydraulic services — commercial",      requirement:"Water supply, drainage and hot water for commercial buildings",                            nccRef:"NCC Vol 3",                 asRef:"AS/NZS 3500.1:2021",   asTitle:"Plumbing and drainage — water services",                              notes:"Back-flow prevention critical in commercial. Legionella management plan required for cooling towers." },
  { id:"c22", buildingType:"commercial",  category:"Energy Efficiency",rule:"Commercial energy efficiency",        requirement:"Building fabric, HVAC, lighting and hot water must meet Section J energy budget",          nccRef:"NCC Vol 1 — J",             asRef:"NCC Section J",        asTitle:"NCC Volume 1 — Section J Energy Efficiency",                         notes:"JV3 modelling or JV2 elemental provisions. NABERS commitment agreement increasingly required by councils." },
  { id:"c23", buildingType:"commercial",  category:"Roofing",         rule:"Metal roof cladding — commercial",     requirement:"Profiled metal sheeting on commercial roofs — laps, fixings, sealing and drainage",         nccRef:"NCC Vol 1 — F1",            asRef:"AS 1562.1:2018",       asTitle:"Design and installation of sheet roof and wall cladding — metal",    notes:"Fastener spacing from manufacturer's pull-out test data matched to wind classification." },
  { id:"c24", buildingType:"commercial",  category:"Structural",      rule:"Snow and ice loads",                   requirement:"Alpine and sub-alpine buildings must account for snow and ice loads",                      nccRef:"NCC Vol 1 — B1",            asRef:"AS 1170.3:2003",       asTitle:"Structural design actions — snow and ice actions",                    notes:"Applies above ~1200m in VIC/NSW/ACT/TAS. Roof slope and drainage critical for snow shed." },
  { id:"c25", buildingType:"both",        category:"Glazing & Windows",rule:"Safety glazing — impact zones",       requirement:"Safety glass in all human impact zones regardless of building type",                       nccRef:"NCC Vol 1&2",               asRef:"AS 1288:2006",         asTitle:"Glass in buildings — selection and installation",                     notes:"Toughened or laminated safety glass at doors, sidelights, low windows and stairs. Mark with permanent etching." },
];

const AS_LOOKUP: ASEntry[] = [
  { id:"as1",  asNumber:"AS 1684.2:2021",       title:"Residential timber-framed construction (non-cyclonic)",          scope:"Prescriptive standard for the design and construction of timber-framed residential buildings in non-cyclonic areas. Covers span tables, stress grades, connections and bracing.", keywords:["timber","framing","stud","joist","rafter","bearer","wall frame","roof frame","residential","bracing","tie-down"], buildingType:"residential", category:"Structural",      nccLink:"NCC Vol 2 — Part 3.4",      practicalNote:"Use span tables directly — confirm species and stress grade stamped on timber before use." },
  { id:"as2",  asNumber:"AS 1684.3:2021",       title:"Residential timber-framed construction (cyclonic areas)",        scope:"As per AS 1684.2 but with enhanced requirements for wind regions C and D — cyclonic areas of Australia. Mandatory in coastal QLD, WA and NT above certain wind classifications.", keywords:["timber","cyclone","cyclonic","wind region C","wind region D","framing","tropical","queensland","northern territory","western australia"], buildingType:"residential", category:"Structural", nccLink:"NCC Vol 2 — Part 3.4", practicalNote:"Check wind classification first — C1 to C4 triggers AS 1684.3 requirements." },
  { id:"as3",  asNumber:"AS 2870:2011",         title:"Residential slabs and footings — design and construction",       scope:"Site classification system (A, S, M, H1, H2, E, P) and footing design rules for reactive soils. Includes reinforced concrete slabs, strip footings and stump footings.", keywords:["slab","footing","foundation","reactive","soil","site classification","concrete","strip","ground","subsoil","pad"], buildingType:"residential", category:"Structural", nccLink:"NCC Vol 2 — Part 3.2.2", practicalNote:"Always get a soil report and site classification before selecting footing type." },
  { id:"as4",  asNumber:"AS 4055:2012",         title:"Wind loads for housing",                                         scope:"Simplified method for determining wind classification (N1–N6, C1–C4) for housing, and the resultant design pressures for structural components and cladding.", keywords:["wind","housing","N1","N2","N3","N4","N5","N6","C1","C2","C3","C4","classification","pressure","cladding"], buildingType:"residential", category:"Structural", nccLink:"NCC Vol 2 — Part 3.10.1", practicalNote:"Confirm wind classification with local council or use AS 4055 tables for terrain, shielding and region." },
  { id:"as5",  asNumber:"AS 3660.1:2014",       title:"Termite management — new building work",                         scope:"Requirements for physical and chemical termite management systems in new construction. Covers perimeter chemical treatment, physical barriers, steel mesh, graded granite and plastic sheeting.", keywords:["termite","white ant","barrier","chemical","physical","pest","infestation","protection"], buildingType:"residential", category:"Structural", nccLink:"NCC Vol 2 — Part 3.1.3", practicalNote:"Install before slab pour for best protection. Issue compliance certificate and lodge with council." },
  { id:"as6",  asNumber:"AS 3740:2021",         title:"Waterproofing of domestic wet areas",                            scope:"Requirements for waterproofing in showers, bathrooms, ensuites, laundries and balconies. Specifies membrane types, heights, falls and substrate preparation.", keywords:["waterproofing","wet area","shower","bathroom","membrane","tanking","grout","tiles","laundry","ensuite","balcony"], buildingType:"residential", category:"Waterproofing", nccLink:"NCC Vol 2 — Part 3.8.1", practicalNote:"Apply membrane on dry substrate. Cure before tiling. Inspector must sign off before tile installation." },
  { id:"as7",  asNumber:"AS 4654.2:2012",       title:"Waterproofing membranes for external above-ground use — design", scope:"Selection and design of waterproof membranes for external above-ground applications including balconies, decks, planter boxes and rooftop areas.", keywords:["membrane","balcony","deck","external","above ground","roof","planter","terrace","waterproof"], buildingType:"both", category:"Waterproofing", nccLink:"NCC Vol 2 — Part 3.8.1", practicalNote:"Match membrane to substrate. Upstand 150mm min at walls. Fall to outlet min 1:80." },
  { id:"as8",  asNumber:"AS 3786:2014",         title:"Smoke alarms using scattered light, transmitted light or ionization", scope:"Performance requirements for smoke alarms. Specifies sensing technology, alarm characteristics, power supply and interconnection. Referenced by NCC for mandatory smoke alarm installation.", keywords:["smoke alarm","detector","fire","interconnected","hardwired","battery","bedroom","escape"], buildingType:"both", category:"Fire Safety", nccLink:"NCC Vol 2 — Part 3.7.2", practicalNote:"Test monthly. Replace unit every 10 years. Check interconnection works — one alarm triggers all." },
  { id:"as9",  asNumber:"AS 3959:2018",         title:"Construction of buildings in bushfire-prone areas",              scope:"Construction requirements for buildings on sites with a determined Bushfire Attack Level (BAL). Covers materials, glazing, vents, decks, gutters and attachment details.", keywords:["bushfire","BAL","ember","attack level","fire zone","bush","defensible space","cladding","vent","gutter"], buildingType:"residential", category:"Fire Safety", nccLink:"NCC Vol 2 — Part 3.7.4", practicalNote:"Higher BAL requires progressively more ember protection, glazing upgrade and non-combustible cladding." },
  { id:"as10", asNumber:"AS/NZS 3000:2018",     title:"Wiring rules — electrical installations",                        scope:"The fundamental standard for all electrical wiring work in Australia and New Zealand. Covers design, materials, installation methods, testing and inspection for low voltage installations.", keywords:["electrical","wiring","circuit","switchboard","RCD","safety switch","power point","GPO","lighting","cable","conduit","earthing"], buildingType:"both", category:"Electrical", nccLink:"NCC Vol 2 — Part 3.11 / Vol 1 — F3", practicalNote:"Licensed electrician only. All work tested and certified. Certificate of electrical safety (CES) issued." },
  { id:"as11", asNumber:"AS/NZS 3500.1:2021",   title:"Plumbing and drainage — water services",                         scope:"Requirements for the design and installation of water supply systems including pipework, fittings, valves, pressure limiting and backflow prevention.", keywords:["water","supply","pipe","pressure","plumbing","cold water","hot water","backflow","copper","PEX","CPVC"], buildingType:"both", category:"Plumbing", nccLink:"NCC Vol 3", practicalNote:"Pressure test at 1.5× working pressure before covering. All fittings WaterMark certified." },
  { id:"as12", asNumber:"AS/NZS 3500.2:2021",   title:"Plumbing and drainage — sanitary plumbing and drainage",        scope:"Installation requirements for sanitary drainage including pipe sizing, gradients, trap depths, vent pipe sizing and inspection opening locations.", keywords:["drainage","sewer","sanitary","trap","vent","fall","gradient","drain","toilet","basin","bath","shower waste"], buildingType:"both", category:"Plumbing", nccLink:"NCC Vol 3", practicalNote:"Min 1:40 fall. Vent every trap or use AAV in concealed locations. CCTV inspection before backfill." },
  { id:"as13", asNumber:"AS/NZS 3500.3:2018",   title:"Plumbing and drainage — stormwater drainage",                   scope:"Requirements for stormwater drainage systems including pit sizing, pipe sizing, discharge points and connection to legal points of discharge.", keywords:["stormwater","rainwater","roof","gutter","downpipe","pit","drainage","overflow","runoff","rain"], buildingType:"both", category:"Plumbing", nccLink:"NCC Vol 3", practicalNote:"Size system to local rainfall intensity (ARI 20-year for residential). Separate from sewer always." },
  { id:"as14", asNumber:"AS/NZS 3500.4:2018",   title:"Plumbing and drainage — heated water services",                 scope:"Requirements for hot water systems including storage temperature, tempering valves, solar and heat pump systems, relief valves and pressure management.", keywords:["hot water","HWS","tempering valve","solar","heat pump","storage","temperature","legionella","relief valve"], buildingType:"both", category:"Plumbing", nccLink:"NCC Vol 3", practicalNote:"Store at 60°C min. Temper to 50°C max at outlets. TPR valve to drain externally." },
  { id:"as15", asNumber:"AS/NZS 5601.1:2013",   title:"Gas installations — general installations",                      scope:"Requirements for the design, installation, commissioning and testing of natural gas and LPG installations in domestic and commercial premises.", keywords:["gas","LPG","natural gas","appliance","burner","cooktop","heater","boiler","regulator","pipe","meter"], buildingType:"both", category:"Gas", nccLink:"NCC Vol 3", practicalNote:"Pressure test at 1.5 kPa. Ventilation mandatory for all gas appliances. Licensed gasfitter only." },
  { id:"as16", asNumber:"AS/NZS 4859.1:2018",   title:"Materials for the thermal insulation of buildings",              scope:"Performance and labelling requirements for insulation products including bulk and reflective insulation. Defines how to calculate and declare R-values.", keywords:["insulation","R-value","thermal","batts","blanket","reflective","bulk","ceiling","wall","floor","energy","NatHERS"], buildingType:"both", category:"Energy Efficiency", nccLink:"NCC Vol 2 — H6D3", practicalNote:"Check R-value label before installation. Gaps > 2% of area can halve effectiveness — install carefully." },
  { id:"as17", asNumber:"AS 1288:2006",         title:"Glass in buildings — selection and installation",                scope:"Selection, installation and glazing requirements for glass in buildings. Covers human impact safety, wind loads, and installation of different glass types.", keywords:["glass","glazing","window","safety glass","toughened","laminated","impact","door","sidelight","shower screen"], buildingType:"both", category:"Glazing & Windows", nccLink:"NCC Vol 2 — Part 3.6", practicalNote:"Safety glass required at human impact zones. Permanent etch or sticker marking mandatory." },
  { id:"as18", asNumber:"AS 2047:2014",         title:"Windows in buildings — selection and installation",              scope:"Performance classification and installation requirements for windows and external glazed doors. Covers structural, water and air infiltration performance levels.", keywords:["window","door","frame","aluminium","timber","uPVC","flashing","sill","head","jamb","weather","draught"], buildingType:"both", category:"Glazing & Windows", nccLink:"NCC Vol 2 — Part 3.6", practicalNote:"Flash windows correctly — most water ingress occurs at window/wall junction. WERS label for energy rating." },
  { id:"as19", asNumber:"AS 4586:2013",         title:"Slip resistance classification of new pedestrian surface materials", scope:"Test methods and classification of slip resistance for floor and stair surfaces. Classes P1–P5 for pedestrian areas, R9–R13 for industrial.", keywords:["slip","resistance","tiles","floor","wet","bathroom","ramp","stairs","external","path","pendulum test"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 2 — Part 3.8", practicalNote:"Get slip resistance classification from tile supplier. Wet residential: Class C (P4). External paths: Class D/E." },
  { id:"as20", asNumber:"AS 1428.1:2009",       title:"Design for access and mobility — general requirements",          scope:"Requirements for accessible building design including ramps, doorways, passages, parking, toilets and fittings for people with disabilities.", keywords:["accessibility","access","disability","wheelchair","ramp","door width","DDA","toilet","accessible","mobility","lever handle"], buildingType:"both", category:"Accessibility", nccLink:"NCC Vol 2 — H9 / Vol 1 — D3", practicalNote:"820mm clear door opening minimum. 1000mm unobstructed path. Accessible toilets require turning circle." },
  { id:"as21", asNumber:"AS 3700:2018",         title:"Masonry structures",                                             scope:"Design and construction of unreinforced, reinforced and prestressed masonry including brick, block and stone. Covers bond, mortar, control joints and structural stability.", keywords:["masonry","brick","block","mortar","bond","wall","retaining","veneer","cavity","control joint","besser","column"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 2 — Part 3.3 / Vol 1 — B1", practicalNote:"Control joints at max 6m. Mortar type M3 or M4 for exposure. Ties at 600×900mm spacing." },
  { id:"as22", asNumber:"AS 3600:2018",         title:"Concrete structures",                                            scope:"Design standard for reinforced and prestressed concrete structures. Covers strength, serviceability, durability, fire resistance and construction requirements.", keywords:["concrete","reinforced","reo","rebar","slab","beam","column","footing","structural","formwork","cover","strength"], buildingType:"commercial", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Cover to reinforcement: 25mm internal, 40mm external, 65mm slab-on-ground. Concrete strength to drawings." },
  { id:"as23", asNumber:"AS 4100:2020",         title:"Steel structures",                                              scope:"Design of structural steel members and connections. Covers beams, columns, bracing, bolted and welded connections, and stability requirements.", keywords:["steel","structural steel","beam","column","connection","weld","bolt","bracing","portal frame","gusset","rhs","ub","uc"], buildingType:"commercial", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Connection design critical — specify bolt grade (8.8), weld category and electrode type. ITP for fabrication." },
  { id:"as24", asNumber:"AS 1170.2:2021",       title:"Structural design actions — wind actions",                       scope:"Determination of design wind speeds and wind pressures for structural design of buildings and structures. Supersedes the previous 2011 edition.", keywords:["wind","pressure","structural","facade","cladding","roof","commercial","actions","region","terrain","shielding"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Wind region maps changed in 2021 — check latest version applies to your project." },
  { id:"as25", asNumber:"AS 1170.4:2007",       title:"Structural design actions — earthquake actions in Australia",    scope:"Seismic hazard assessment and structural design requirements for buildings subject to earthquake actions. Provides hazard factor Z and design spectra.", keywords:["earthquake","seismic","zone","hazard","structural","ductility","importance","foundation","dynamic"], buildingType:"commercial", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Most Australian buildings low seismicity. Importance Level 3/4 (hospitals, emergency) apply stricter ductility." },
  { id:"as26", asNumber:"AS 2118.1:2017",       title:"Automatic fire sprinkler systems — standard systems",            scope:"Design, installation, commissioning and maintenance of automatic fire sprinkler systems in Class 2–9 buildings.", keywords:["sprinkler","fire suppression","wet pipe","dry pipe","heads","hydraulic","pump","tank","riser","commercial"], buildingType:"commercial", category:"Fire Safety", nccLink:"NCC Vol 1 — E1", practicalNote:"Hydraulic calculations by licensed hydraulic engineer. Commissioning test with certifier present." },
  { id:"as27", asNumber:"AS 1670.1:2018",       title:"Fire detection, warning, control and intercom — system design",  scope:"Design requirements for automatic fire detection and alarm systems including detector selection, zone layout, FACP requirements and cabling.", keywords:["fire alarm","detector","smoke","heat","FACP","panel","zone","sounder","strobe","detection","warning","commercial"], buildingType:"commercial", category:"Fire Safety", nccLink:"NCC Vol 1 — E1", practicalNote:"System integrated with BAS and mechanical for smoke mode operation. Annual service certification required." },
  { id:"as28", asNumber:"AS 2293.1:2018",       title:"Emergency escape lighting and exit signs",                       scope:"Requirements for emergency lighting systems providing illumination for safe evacuation. Covers design, installation, testing and documentation.", keywords:["emergency lighting","exit sign","egress","evacuation","escape","battery","lux","maintained","non-maintained"], buildingType:"commercial", category:"Electrical", nccLink:"NCC Vol 1 — E4", practicalNote:"Maintained or non-maintained type per NCC. 90-minute duration test every 3 years. Monthly function test." },
  { id:"as29", asNumber:"AS 1668.2:2012",       title:"Ventilation and airconditioning — ventilation design for indoor air contaminant control", scope:"Minimum ventilation rates and design requirements for HVAC systems to control indoor air quality in commercial buildings.", keywords:["ventilation","HVAC","fresh air","exhaust","supply","air quality","carbon dioxide","CO2","mechanical","airconditioning"], buildingType:"commercial", category:"Mechanical & Ventilation", nccLink:"NCC Vol 1 — F4", practicalNote:"Min 10 L/s/person fresh air. CO2 setpoint typically 800–1000 ppm for DCV control." },
  { id:"as30", asNumber:"AS 1562.1:2018",       title:"Design and installation of sheet roof and wall cladding — metal", scope:"Requirements for the design and installation of profiled metal sheet cladding on roofs and walls. Covers fixings, laps, sealing, drainage and flashings.", keywords:["metal roof","colorbond","sheet","cladding","fastener","lap","flashing","corrugated","profiled","purlin","gutter"], buildingType:"both", category:"Roofing", nccLink:"NCC Vol 2 — Part 3.5", practicalNote:"Fastener pull-out capacity must exceed calculated wind uplift. Use manufacturer-tested fixing spacing." },
  { id:"as31", asNumber:"AS 1905.1:2005",       title:"Components for the protection of openings in fire-resistant walls — fire-resistant doorsets", scope:"Performance requirements for fire-resistant door assemblies. Covers testing, marking, installation and maintenance of fire doors.", keywords:["fire door","FRL","fire resistant","doorset","self-closing","smoke seal","intumescent","hinges","rated"], buildingType:"both", category:"Fire Safety", nccLink:"NCC Vol 1 — C3 / Vol 2 — 3.7", practicalNote:"Never wedge open. Self-closer must function. Smoke seals intact. Label must be visible and legible." },
  { id:"as32", asNumber:"AS 1720.1:2010",       title:"Timber structures — design methods",                             scope:"Design methods for structural timber members and connections in commercial and industrial buildings. Used for glulam, LVL and solid timber structures.", keywords:["timber structure","glulam","LVL","laminated","structural timber","commercial","mass timber","CLT","connection"], buildingType:"commercial", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Mass timber increasingly used in commercial — engineer design required for all connections and systems." },
  { id:"as33", asNumber:"AS 1768:2007",         title:"Lightning protection",                                           scope:"Risk assessment and design requirements for external lightning protection systems for structures. Covers air termination, down conductors and earth termination networks.", keywords:["lightning","surge","protection","earthing","conductor","rod","mesh","tall","isolated","structure"], buildingType:"commercial", category:"Electrical", nccLink:"NCC Vol 1 — F3", practicalNote:"Risk assessment determines if system required. Bond all metallic services to same earth reference." },
  { id:"as34", asNumber:"AS 1428.4.1:2009",     title:"Design for access and mobility — tactile ground surface indicators", scope:"Requirements for tactile hazard indicators and directional indicators used to assist people with vision impairment navigate built environments.", keywords:["tactile","TGSI","vision impairment","blind","indicator","path","hazard","directional","strip","dome"], buildingType:"commercial", category:"Accessibility", nccLink:"NCC Vol 1 — D3", practicalNote:"30% LRV contrast from surrounding surface. Install at stairs, ramps, platform edges and crossings." },
  { id:"as35", asNumber:"AS 2049:2018",         title:"Roof tiles — selection and installation",                        scope:"Requirements for the selection and installation of concrete and terracotta roof tiles. Covers battens, bedding, pointing, ridge and hip tile fixing.", keywords:["roof tile","terracotta","concrete tile","batten","bedding","pointing","ridge","hip","mortar","tile"], buildingType:"residential", category:"Roofing", nccLink:"NCC Vol 2 — Part 3.5", practicalNote:"In cyclonic areas, mechanically fix every tile. Ridge and hip mortar must be polymer-modified." },
  { id:"as36", asNumber:"AS/NZS 3012:2019",     title:"Electrical installations — construction and demolition sites",   scope:"Requirements for temporary electrical installations on construction and demolition sites including RCD protection, inspections and isolation.", keywords:["construction site","temporary","electrical","RCD","leads","tools","site","power","builder"], buildingType:"both", category:"Electrical", nccLink:"AS/NZS 3000:2018", practicalNote:"All portable tools and leads on site need RCD protection. Inspect before use daily. Leads max 25m." },
  { id:"as37", asNumber:"AS/NZS 61439:2016",    title:"Low-voltage switchgear and controlgear assemblies",              scope:"Requirements for the design, testing and verification of LV switchboards and distribution boards used in electrical installations.", keywords:["switchboard","distribution board","MDB","DB","panel","main switch","meter","commercial","electrical"], buildingType:"commercial", category:"Electrical", nccLink:"NCC Vol 1 — F3", practicalNote:"Type test certificates from manufacturer required. As-built drawings inside every switchboard." },
  { id:"as38", asNumber:"AS 1170.1:2002",       title:"Structural design actions — permanent, imposed and other actions", scope:"Loading requirements for structural design including dead loads, live loads, roof loads, balustrade loads and construction loads.", keywords:["load","dead load","live load","imposed","structural","balustrade","floor","roof","loading","action"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 1 — B1 / Vol 2 — Part 3.4", practicalNote:"Floor: 1.5 kPa residential, 3.0 kPa commercial. Balustrade: 0.6 kN/m horizontal." },
  { id:"as39", asNumber:"AS 4600:2018",         title:"Cold-formed steel structures",                                   scope:"Design of structural members fabricated from cold-formed steel strip including light gauge framing, purlins, girts and sheeting rails.", keywords:["light gauge","steel stud","steel framing","cold formed","purlin","girt","rhs","cee","zee","residential steel"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 2 — Part 3.4 / Vol 1 — B1", practicalNote:"Connection screw size and spacing critical. Check corrosion class for coastal or wet environments." },
  { id:"as40", asNumber:"AS 1170.3:2003",       title:"Structural design actions — snow and ice actions",              scope:"Requirements for determining snow and ice loads on roofs and structures in alpine and sub-alpine areas of Australia.", keywords:["snow","ice","alpine","load","mountain","roof","structure","high altitude"], buildingType:"commercial", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Applies above ~1200m AHD. Roof slope and drainage critical. Drift loading at parapets and steps." },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface NCCComplianceCardProps {
  projectId: string;
}

export const NCCComplianceCard = ({ projectId }: NCCComplianceCardProps) => {
  const storageKey = `ncc_compliance_${projectId}`;

  const [climateZone, setClimateZone] = useState("5");
  const [state, setState] = useState("NSW");
  const [buildingClass, setBuildingClass] = useState("1a");
  const [checkStates, setCheckStates] = useState<Record<string, CheckState>>({});
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["site", "waterproofing", "fire"]));
  const [showNotes, setShowNotes] = useState<string | null>(null);

  // Rules Browser + AS Lookup state
  const [activeMainTab, setActiveMainTab] = useState("checklist");
  const [rulesBuildingType, setRulesBuildingType] = useState<"residential" | "commercial">("residential");
  const [rulesCategory, setRulesCategory] = useState("All");
  const [rulesSearch, setRulesSearch] = useState("");
  const [lookupSearch, setLookupSearch] = useState("");

  // Load saved state
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (saved.climateZone) setClimateZone(saved.climateZone);
      if (saved.state) setState(saved.state);
      if (saved.buildingClass) setBuildingClass(saved.buildingClass);
      if (saved.checkStates) setCheckStates(saved.checkStates);
    } catch { /* ignore */ }
  }, [storageKey]);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ climateZone, state, buildingClass, checkStates }));
  }, [climateZone, state, buildingClass, checkStates, storageKey]);

  const sections = useMemo(() => buildSections(climateZone, buildingClass), [climateZone, buildingClass]);

  const allItems = useMemo(() => sections.flatMap(s => s.items), [sections]);

  // Stats
  const stats = useMemo(() => {
    let pass = 0, fail = 0, na = 0, unchecked = 0;
    allItems.forEach(item => {
      const s = checkStates[item.id]?.status || "unchecked";
      if (s === "pass") pass++;
      else if (s === "fail") fail++;
      else if (s === "na") na++;
      else unchecked++;
    });
    const checked = pass + fail + na;
    const total = allItems.length;
    const score = checked > 0 ? Math.round((pass / (pass + fail)) * 100) : 0;
    return { pass, fail, na, unchecked, checked, total, score };
  }, [allItems, checkStates]);

  const cycleStatus = (itemId: string) => {
    setCheckStates(prev => {
      const current = prev[itemId]?.status || "unchecked";
      return { ...prev, [itemId]: { ...prev[itemId], status: nextStatus(current), notes: prev[itemId]?.notes || "" } };
    });
  };

  const updateNotes = (itemId: string, notes: string) => {
    setCheckStates(prev => ({
      ...prev,
      [itemId]: { status: prev[itemId]?.status || "unchecked", notes },
    }));
  };

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const resetAll = () => {
    setCheckStates({});
    toast.success("All checks reset");
  };

  const exportReport = () => {
    const today = new Date().toLocaleDateString("en-AU");
    const zoneLabel = CLIMATE_ZONES.find(z => z.value === climateZone)?.label || climateZone;
    const classLabel = BUILDING_CLASSES.find(c => c.value === buildingClass)?.label || buildingClass;

    const lines: string[] = [
      "══════════════════════════════════════════════════════════",
      "       NCC 2022 COMPLIANCE CHECKLIST REPORT",
      "══════════════════════════════════════════════════════════",
      `Generated:        ${today}`,
      `State/Territory:  ${state}`,
      `Climate Zone:     ${zoneLabel}`,
      `Building Class:   ${classLabel}`,
      `Project ID:       ${projectId}`,
      "",
      `SUMMARY: ${stats.pass} Pass | ${stats.fail} Fail | ${stats.na} N/A | ${stats.unchecked} Not Checked`,
      `Compliance Score: ${stats.score}% of checked items passed`,
      "",
    ];

    sections.forEach(section => {
      lines.push(`── ${section.title.toUpperCase()} ──────────────────────────────`);
      section.items.forEach(item => {
        const cs = checkStates[item.id];
        const status = cs?.status || "unchecked";
        const statusLabel = STATUS_CONFIG[status].label;
        lines.push(`  [${statusLabel.padEnd(12)}] ${item.requirement}`);
        lines.push(`               Ref: ${item.reference}`);
        if (cs?.notes) lines.push(`               Note: ${cs.notes}`);
      });
      lines.push("");
    });

    lines.push("══════════════════════════════════════════════════════════");
    lines.push("DISCLAIMER: This checklist is a guide only. Always verify");
    lines.push("requirements with your building surveyor/certifier and the");
    lines.push("applicable State/Territory adoption of the NCC.");
    lines.push("══════════════════════════════════════════════════════════");

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NCC_Compliance_${state}_Zone${climateZone}_${today.replace(/\//g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Compliance report downloaded");
  };

  // Filtered rules
  const filteredRules = RULES_DB.filter(r => {
    const matchType = r.buildingType === rulesBuildingType || r.buildingType === "both";
    const matchCat = rulesCategory === "All" || r.category === rulesCategory;
    const q = rulesSearch.toLowerCase();
    const matchSearch = !q || r.rule.toLowerCase().includes(q) || r.requirement.toLowerCase().includes(q) || r.asRef.toLowerCase().includes(q) || r.notes.toLowerCase().includes(q);
    return matchType && matchCat && matchSearch;
  });

  // Filtered AS standards
  const filteredAS = AS_LOOKUP.filter(a => {
    const q = lookupSearch.toLowerCase();
    if (!q) return true;
    return a.asNumber.toLowerCase().includes(q) || a.title.toLowerCase().includes(q) || a.scope.toLowerCase().includes(q) || a.keywords.some(k => k.toLowerCase().includes(q)) || a.practicalNote.toLowerCase().includes(q);
  });

  return (
    <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="checklist" className="gap-2">
          <ClipboardList className="h-4 w-4" />Compliance Checklist
        </TabsTrigger>
        <TabsTrigger value="rules" className="gap-2">
          <BookOpen className="h-4 w-4" />Rules Browser
        </TabsTrigger>
        <TabsTrigger value="aslookup" className="gap-2">
          <Search className="h-4 w-4" />AS Lookup
        </TabsTrigger>
      </TabsList>

      {/* ══ TAB 1: CHECKLIST ══ */}
      <TabsContent value="checklist">
    <div className="space-y-6">

      {/* ── Project Setup ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle>NCC 2022 Compliance Checklist</CardTitle>
          </div>
          <CardDescription>
            Set your project parameters — the checklist updates automatically for your climate zone and building class.
            <span className="block mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1 mt-2">
              ⚠️ NCC 2022 Amendment 2 is current (effective July 2025). NSW & QLD adopt NCC 2025 from 1 May 2027. Always confirm with your local building surveyor.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-medium mb-1 block">State / Territory</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Climate Zone</Label>
              <Select value={climateZone} onValueChange={setClimateZone}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>{CLIMATE_ZONES.map(z => <SelectItem key={z.value} value={z.value} className="text-xs">{z.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Building Class</Label>
              <Select value={buildingClass} onValueChange={setBuildingClass}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{BUILDING_CLASSES.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* R-value quick reference */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Insulation Minimums for Zone {climateZone} (NCC 2022)</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              {[
                { label: "Ceiling", val: R_VALUES[climateZone]?.ceiling },
                { label: "Wall", val: R_VALUES[climateZone]?.wall },
                { label: "Floor", val: R_VALUES[climateZone]?.floor },
              ].map(({ label, val }) => (
                <div key={label} className="text-center p-2 bg-background rounded border">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="font-bold text-primary font-mono">{val}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Progress Summary ── */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {[
              { label: "Total Items", val: stats.total, color: "text-foreground" },
              { label: "Pass", val: stats.pass, color: "text-green-600" },
              { label: "Fail", val: stats.fail, color: "text-red-600" },
              { label: "N/A", val: stats.na, color: "text-blue-600" },
              { label: "Not Checked", val: stats.unchecked, color: "text-muted-foreground" },
            ].map(({ label, val, color }) => (
              <div key={label} className="text-center p-3 bg-muted/40 rounded-lg">
                <div className={`text-2xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Compliance score ({stats.checked} of {stats.total} checked)</span>
              <span className={stats.score >= 90 ? "text-green-600 font-semibold" : stats.score >= 70 ? "text-amber-600 font-semibold" : "text-red-600 font-semibold"}>
                {stats.checked > 0 ? `${stats.score}%` : "—"}
              </span>
            </div>
            <Progress value={stats.checked > 0 ? stats.score : 0} className="h-2" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Click any requirement to cycle: <strong>Not Checked → Pass → Fail → N/A</strong>. Use the pencil to add notes.
          </p>
        </CardContent>
      </Card>

      {/* ── Sections ── */}
      {sections.map(section => {
        const sectionItems = section.items;
        const sPass = sectionItems.filter(i => (checkStates[i.id]?.status || "unchecked") === "pass").length;
        const sFail = sectionItems.filter(i => (checkStates[i.id]?.status || "unchecked") === "fail").length;
        const isOpen = openSections.has(section.id);

        return (
          <Card key={section.id} className={`border ${SECTION_COLOR_MAP[section.color] || ""}`}>
            <Collapsible open={isOpen} onOpenChange={() => toggleSection(section.id)}>
              <CollapsibleTrigger asChild>
                <button className="w-full text-left">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {section.icon}
                        <CardTitle className="text-base">{section.title}</CardTitle>
                        <span className="text-xs text-muted-foreground">({sectionItems.length} items)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {sFail > 0 && <Badge variant="destructive" className="text-xs h-5">{sFail} Fail</Badge>}
                        {sPass > 0 && <Badge className="text-xs h-5 bg-green-600">{sPass} Pass</Badge>}
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </CardHeader>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-2">
                  {sectionItems.map(item => {
                    const cs = checkStates[item.id];
                    const status = cs?.status || "unchecked";
                    const cfg = STATUS_CONFIG[status];
                    const isShowingNotes = showNotes === item.id;

                    return (
                      <div key={item.id} className={`rounded-lg border p-3 transition-colors ${status === "fail" ? "bg-red-50/60 border-red-200" : status === "pass" ? "bg-green-50/40 border-green-200" : "bg-white border-border"}`}>
                        <div className="flex items-start gap-3">
                          {/* Status cycle button */}
                          <button
                            onClick={() => cycleStatus(item.id)}
                            className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-colors ${cfg.color}`}
                            title="Click to change status"
                          >
                            {cfg.icon}
                            <span className="hidden sm:inline">{cfg.label}</span>
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold leading-snug">{item.requirement}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</div>
                            <div className="text-[11px] text-primary/70 mt-1 font-mono">{item.reference}</div>
                            {cs?.notes && !isShowingNotes && (
                              <div className="text-xs text-muted-foreground mt-1 italic bg-muted/50 rounded px-2 py-0.5">📝 {cs.notes}</div>
                            )}
                            {isShowingNotes && (
                              <Textarea
                                className="mt-2 text-xs min-h-[60px]"
                                placeholder="Add site notes, measurements, deviations…"
                                value={cs?.notes || ""}
                                onChange={e => updateNotes(item.id, e.target.value)}
                                autoFocus
                              />
                            )}
                          </div>

                          <button
                            onClick={() => setShowNotes(isShowingNotes ? null : item.id)}
                            className="flex-shrink-0 text-muted-foreground hover:text-foreground p-1"
                            title="Add note"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* ── Actions ── */}
      <div className="flex gap-3 justify-between">
        <Button variant="outline" onClick={resetAll} className="gap-2">
          <RotateCcw className="h-4 w-4" />Reset All
        </Button>
        <Button onClick={exportReport} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <FileText className="h-4 w-4" />Export Compliance Report
        </Button>
      </div>

    </div>
      </TabsContent>

      {/* ══ TAB 2: RULES BROWSER ══ */}
      <TabsContent value="rules">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <CardTitle>NCC Rules Browser</CardTitle>
              </div>
              <CardDescription>
                Browse all NCC 2022 rules by building type and category. Each rule references the applicable Australian Standard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Building type toggle */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={rulesBuildingType === "residential" ? "default" : "outline"}
                  onClick={() => setRulesBuildingType("residential")}
                  className="gap-2"
                >
                  <Building2 className="h-4 w-4" />Residential
                </Button>
                <Button
                  size="sm"
                  variant={rulesBuildingType === "commercial" ? "default" : "outline"}
                  onClick={() => setRulesBuildingType("commercial")}
                  className="gap-2"
                >
                  <Building2 className="h-4 w-4" />Commercial
                </Button>
              </div>

              {/* Category filter */}
              <div className="flex flex-wrap gap-1.5">
                {RULE_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setRulesCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      rulesCategory === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-9"
                  placeholder="Search rules, requirements, standards…"
                  value={rulesSearch}
                  onChange={e => setRulesSearch(e.target.value)}
                />
              </div>

              <p className="text-xs text-muted-foreground">{filteredRules.length} rule{filteredRules.length !== 1 ? "s" : ""} found</p>
            </CardContent>
          </Card>

          {/* Rule cards */}
          <div className="space-y-3">
            {filteredRules.length === 0 ? (
              <Card><CardContent className="pt-6 text-center text-muted-foreground">No rules match your search.</CardContent></Card>
            ) : filteredRules.map(rule => (
              <Card key={rule.id} className="border-l-4" style={{ borderLeftColor: rule.buildingType === "commercial" ? "#6366f1" : "#10b981" }}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {rule.category}
                        </Badge>
                        <Badge
                          className={`text-[10px] h-4 px-1.5 ${rule.buildingType === "commercial" ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}
                          variant="outline"
                        >
                          {rule.buildingType === "both" ? "Res + Comm" : rule.buildingType === "commercial" ? "Commercial" : "Residential"}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold">{rule.rule}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rule.requirement}</p>

                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="text-xs bg-muted/40 rounded px-2 py-1">
                          <span className="font-semibold text-primary">NCC Ref: </span>
                          <span className="font-mono">{rule.nccRef}</span>
                        </div>
                        <div className="text-xs bg-blue-50 border border-blue-100 rounded px-2 py-1">
                          <span className="font-semibold text-blue-700">AS: </span>
                          <span className="font-mono text-blue-800">{rule.asRef}</span>
                          {rule.asTitle && <span className="text-blue-600"> — {rule.asTitle}</span>}
                        </div>
                      </div>

                      {rule.notes && (
                        <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                          <span className="font-semibold">Practical note: </span>{rule.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </TabsContent>

      {/* ══ TAB 3: AS LOOKUP ══ */}
      <TabsContent value="aslookup">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <CardTitle>Australian Standard Lookup</CardTitle>
              </div>
              <CardDescription>
                Search by scope of work or keywords to find the correct Australian Standard for your trade. Includes practical notes for site application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-10"
                  placeholder="e.g. waterproofing, smoke alarm, timber framing, drainage…"
                  value={lookupSearch}
                  onChange={e => setLookupSearch(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{filteredAS.length} standard{filteredAS.length !== 1 ? "s" : ""} found — click <Copy className="inline h-3 w-3" /> to copy standard number</p>
            </CardContent>
          </Card>

          {lookupSearch === "" && (
            <Card className="border-blue-100 bg-blue-50/50">
              <CardContent className="pt-4 pb-4 text-center text-sm text-blue-700">
                Type a keyword above to find the right Australian Standard for your scope of work.
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  {["waterproof","timber frame","smoke alarm","drainage","electrical","insulation","balustrade","fire door"].map(kw => (
                    <button
                      key={kw}
                      onClick={() => setLookupSearch(kw)}
                      className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full text-xs border border-blue-200 transition-colors"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {filteredAS.length === 0 && lookupSearch !== "" ? (
              <Card><CardContent className="pt-6 text-center text-muted-foreground">No standards match "{lookupSearch}". Try broader keywords.</CardContent></Card>
            ) : filteredAS.map(as => (
              <Card key={as.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-sm font-mono text-primary">{as.asNumber}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">{as.category}</Badge>
                        <Badge
                          className={`text-[10px] h-4 px-1.5 ${as.buildingType === "commercial" ? "bg-indigo-100 text-indigo-700 border-indigo-200" : as.buildingType === "residential" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}
                          variant="outline"
                        >
                          {as.buildingType === "both" ? "Res + Comm" : as.buildingType === "commercial" ? "Commercial" : "Residential"}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold leading-snug">{as.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{as.scope}</p>

                      <div className="mt-2 text-xs bg-muted/40 rounded px-2 py-1">
                        <span className="font-semibold">NCC reference: </span>
                        <span className="font-mono">{as.nccLink}</span>
                      </div>

                      {as.practicalNote && (
                        <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                          <span className="font-semibold">On-site: </span>{as.practicalNote}
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap gap-1">
                        {as.keywords.slice(0, 8).map(kw => (
                          <button
                            key={kw}
                            onClick={() => setLookupSearch(kw)}
                            className="px-1.5 py-0.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded text-[10px] border border-border transition-colors"
                          >
                            {kw}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(as.asNumber);
                        toast.success(`Copied ${as.asNumber}`);
                      }}
                      className="flex-shrink-0 p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title={`Copy ${as.asNumber}`}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </TabsContent>

    </Tabs>
  );
};
