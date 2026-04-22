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
  BookOpen, Search, Copy, ClipboardList, PlusCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus = "unchecked" | "pass" | "fail" | "na";

interface CheckItem {
  id: string;
  requirement: string;
  detail: string;
  reference: string;
  asInfo?: string;               // plain-English explanation of the referenced AS / NCC Part
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
          asInfo: "NCC Vol 2 Part 3.2.1 sets minimum site drainage requirements to prevent subfloor and footing damage from water pooling. Poor drainage is the leading cause of slab heave on reactive sites and timber decay in suspended floors. Always check ALL four sides of the building — drainage problems often occur at the rear where earthworks are incomplete.",
        },
        {
          id: "site-2",
          requirement: "DPC — min 75mm above FGL, full wall width, AS 2904 compliant material",
          detail: "Damp-proof course (DPC) must be installed at minimum 75mm above finished ground level (FGL) and extend the full width of the wall. Compliant materials per AS 2904 include: polyethylene sheet ≥0.5mm thick, flexible PVC, fibre cement sheet, aluminium foil laminate, or bituminous compound. Must prevent capillary rise of moisture into framing or masonry.",
          reference: "NCC Vol 2 — Part 3.3.4, AS 2904",
          asInfo: "AS 2904 specifies acceptable materials and installation methods for damp-proof courses and membranes. The DPC breaks capillary moisture rise from the ground into wall framing and masonry — without it, timber rots and masonry salt-damp develops within years. The 75mm minimum above FGL ensures that landscaping or path raises cannot bridge the DPC and defeat its purpose.",
        },
        {
          id: "site-3",
          requirement: "Termite management AS 3660.1 — physical or chemical, full perimeter, documented",
          detail: "Physical barriers: stainless steel mesh (aperture ≤1mm), crushed granite (6–10mm particle size), or proprietary systems (HomGuard, Termimesh). Chemical barriers: soil treatment with registered pesticide (chlorpyrifos-free post-2015). Must cover full perimeter including all penetrations (pipes, conduits). Type, brand, warranty period, and licensed installer details to be documented on the building file. Inspect prior to slab pour.",
          reference: "NCC Vol 2 — Part 3.1.3, AS 3660.1:2014",
          asInfo: "AS 3660.1 covers termite management systems for new buildings, including physical barriers and chemical soil treatments. Termite damage is Australia's most costly uninspected building defect — an unprotected slab perimeter can be breached within 3–5 years in high-risk zones. The system must be inspected before the slab is poured and documented with licensed installer details and warranty period.",
        },
        {
          id: "site-4",
          requirement: "Footing class per AS 2870 — A/S/M/H1/H2/E/P site classes, each triggers different footing",
          detail: "Site classification must be obtained from a geotechnical assessment: Class A (stable, non-reactive) — standard strip/slab; Class S (slightly reactive, <20mm movement) — stiffened raft; Class M (moderately reactive, 20–40mm) — stiffened raft with deeper beams; Class H1 (highly reactive, 40–60mm) and H2 (60–75mm) — heavily reinforced slab with engineer input; Class E (extremely reactive, >75mm) — engineer design mandatory; Class P (problem site — fill, soft spots, erosion) — geotechnical report and engineer design. Fill sites require compaction test to 95% standard compaction.",
          reference: "NCC Vol 2 — Part 3.2.2, AS 2870:2011",
          asInfo: "AS 2870 is the definitive Australian standard for residential slabs and footings. It classifies soil reactivity from A (stable) through to P (problem sites), and each class triggers a minimum footing design with increasing reinforcement and beam depth. Getting the site class wrong is the most common cause of long-term slab cracking — always rely on a geotechnical assessment, not visual inspection alone.",
        },
        {
          id: "site-5",
          requirement: "Wind classification AS 4055/AS 1170.2 — N1–N6 non-cyclonic, C1–C4 cyclonic",
          detail: "Determine wind region from postcode: Region A (non-cyclonic) = N1–N6 classifications; Regions B, C, D (cyclonic — Qld/WA/NT coasts) = C1–C4. Terrain category (1–4) and shielding category also required. Wind classification affects tie-down connection capacity, bracing unit requirements, and cladding fixing specifications. Document classification on drawings and specify on engineer's certificate.",
          reference: "NCC Vol 2 — Part 3.10.1, AS 4055:2012, AS 1170.2:2021",
          asInfo: "AS 4055 provides simplified wind classifications (N1–N6, C1–C4) for residential buildings based on postcode, terrain, and shielding. AS 1170.2 is the parent structural wind loading standard used for engineered designs. Wind classification directly controls tie-down strap capacity, bracing wall lengths, and cladding fixing specs — using the wrong classification is a significant structural liability that voids insurance cover.",
        },
        {
          id: "site-6",
          requirement: "Slab edge — 300mm below FGL (reactive sites), 200mm deep edge beam (non-reactive)",
          detail: "For reactive sites (Class M, H1, H2, E): slab edge beam must extend minimum 300mm below finished ground level to prevent seasonal moisture variation at slab perimeter. Non-reactive sites (Class A, S): minimum 200mm deep edge beam. Rebated slabs: edge beam depth measured from top of rebate. Check setout drawings show correct depths at all sides including stepped footings on sloping sites.",
          reference: "NCC Vol 2 — Part 3.2.2, AS 2870:2011",
          asInfo: "AS 2870 edge beam depth requirements prevent seasonal soil moisture variation from affecting the underside of slabs on reactive soils. Shallow edge beams on H-class sites are the number-one cause of cracked corner tiles and sticking doors — the soil shrinks/expands at the perimeter where the edge beam is too shallow to stay in the stable moisture zone below seasonal drying depth.",
        },
        {
          id: "site-7",
          requirement: "Service clearances — 300mm from sewer, 150mm water main, 600mm electrical conduit",
          detail: "Footing excavations must maintain minimum clearances from existing services: 300mm horizontal from any sewer pipe; 150mm from potable water mains; 600mm from underground electrical conduit or cable. Where clearances cannot be met, protective sleeving, bridging beams, or relocation of services is required. Dial Before You Dig search mandatory before excavation.",
          reference: "NCC Vol 2 — Part 3.2.1, local authority requirements",
          asInfo: "Service clearance requirements protect existing infrastructure from footing loads and prevent point-load cracking in water and sewer pipes. A footing edge bearing over a sewer can crack the pipe over time — leading to long-term ground softening and footing subsidence. Always complete a Dial Before You Dig search; hand-dig the last 300mm near services. Damaging a sewer under a footing requires council involvement and can cost $10,000+ to repair.",
        },
        {
          id: "site-8",
          requirement: "BAL assessment — BAL-12.5 to BAL-FZ for all Class 1 in bushfire prone land",
          detail: "All Class 1 and Class 10 buildings within designated bushfire prone areas require a BAL assessment from a qualified practitioner. BAL levels: 12.5 (low), 19 (medium), 29 (high), 40 (very high), FZ (flame zone). Each level triggers additional construction requirements under AS 3959: BAL-12.5 requires basic ember protection; BAL-40 requires ember-proof vents, toughened glazing, non-combustible cladding; BAL-FZ requires full fire engineering. Council maps and state fire authority maps to be checked.",
          reference: "NCC Vol 2 — Part 3.7.4, AS 3959:2018",
          asInfo: "AS 3959 Construction of Buildings in Bushfire-Prone Areas specifies material and detail requirements for each BAL level. A BAL-FZ building requires non-combustible construction on all external surfaces — standard aluminium windows, vinyl weatherboards, and timber decks are NOT compliant. The BAL assessment method is prescribed by the standard and must be performed by an accredited assessor using the mapped FDI (Fire Danger Index) data.",
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
          asInfo: "AS 1684.2 Residential Timber-Framed Construction (Non-Cyclonic) is the primary span table standard for Class 1 and 10 buildings. It covers every framing member — joists, rafters, studs, lintels, beams — with tables based on species group, stress grade, spacing, load, and wind class. AS 1720.2 covers proof grading methods. Grade stamps on timber are the only legal evidence of compliance — never accept unmarked timber for structural use.",
        },
        {
          id: "frt-2",
          requirement: "Stud sizing — 90×35 MGP10 at 600mm ctrs ≤2.7m, 90×45 at 600mm ctrs ≤3.0m, or per wind class",
          detail: "Wall stud sizes determined by wall height, spacing, load, and wind classification: 90×35 MGP10 at 600mm centres is minimum for walls ≤2.7m high in N1–N2 areas; 90×45 MGP10 at 600mm centres for walls up to 3.0m; 70×35 at 450mm centres for walls ≤2.4m in low-wind; higher wind classifications (N3–N6, C1–C4) require larger studs or closer spacing per AS 1684.2 span tables. Always confirm from tables using actual wall height, wind classification, and load width.",
          reference: "NCC Vol 2 — Part 3.4.2, AS 1684.2:2021 Table sets",
          asInfo: "AS 1684.2 stud tables account for combined axial (gravity) load and lateral (wind) pressure. A stud undersized for its wind class will not fail under normal conditions but can buckle suddenly in a storm event. In N3+ zones, the lateral load on studs increases by 30–50% over N1 — upgrading from 90×35 to 90×45 or reducing centres to 450mm is often required without a change in visible wall height.",
        },
        {
          id: "frt-3",
          requirement: "Top plate — single where studs align, DOUBLE where offset >1/6 spacing, lapped 600mm at corners",
          detail: "Single top plate (90mm deep) acceptable where roof/floor framing members bear directly over studs (offset ≤1/6 of stud spacing). Double top plate (two 90mm plates) required where framing members are offset more than 1/6 of stud spacing — the upper plate spans between studs and transfers loads. Corner laps: minimum 600mm from corner at every joint. Nail double top plates together at 300mm centres with 75mm nails.",
          reference: "NCC Vol 2 — Part 3.4.2, AS 1684.2:2021",
          asInfo: "AS 1684.2 top plate rules ensure concentrated loads from roof framing transfer into studs without overstressing the plate as a beam. A single plate acting as a beam over a 600mm gap between misaligned studs deflects under load, cracking plasterboard at the wall/ceiling junction. Corner lapping creates a continuous tension ring that resists racking — the laps should never fall over a window or door opening.",
        },
        {
          id: "frt-4",
          requirement: "Bottom plate — min 35mm thick, DPC/isolation in wet areas, M12 bolts at max 1800mm ctrs",
          detail: "Bottom plate minimum 35mm thickness (matching stud width). In wet areas and where plate bears on concrete slab: install DPC or moisture-isolating tape under plate to prevent moisture transfer. Bolting to concrete: M12 bolts at maximum 1800mm centres and within 300mm of each end of every plate length. In N3+ wind areas, bolt spacing reduces — check AS 1684 Section 9 for specific requirements. Plate to slab adhesive is NOT a substitute for bolting.",
          reference: "NCC Vol 2 — Part 3.4.2, AS 1684.2:2021 Section 9",
          asInfo: "AS 1684.2 Section 9 specifies bottom plate fixing to concrete slabs for all wind classifications. The bolted connection is the base of the continuous load path from roof to footing — if this connection fails in high wind, the entire wall frame can be peeled off the slab. In cyclonic regions (C1–C4), bolt spacing can reduce to 600mm and holding-down bolts must be chemically anchored, not just cast-in coach bolts.",
        },
        {
          id: "frt-5",
          requirement: "Noggins — 35×35 min (35×70 recommended), max 1350mm vertical spacing, bracing noggins at 900mm ctrs",
          detail: "Horizontal noggins provide stud lateral restraint and wall backing for fixtures. Minimum section 35×35mm; 35×70mm recommended for improved wall stiffness. Maximum vertical spacing 1350mm between noggins (or from plate to first noggin). In bracing walls: noggins at 900mm centres maximum to transfer bracing forces. All utility noggins (for shelves, TV brackets, grab rails) should be 90×35 minimum.",
          reference: "NCC Vol 2 — Part 3.4.2, AS 1684.2:2021",
          asInfo: "AS 1684.2 noggin requirements serve three purposes: prevent stud buckling under axial load, provide backing for wall fittings, and act as blocking for bracing force transfer. The 1350mm maximum vertical spacing is a stud buckling limit — without noggins, studs under combined axial and lateral load can buckle sideways in severe wind events. Always install backing noggins behind planned grab rail and TV wall bracket locations before lining.",
        },
        {
          id: "frt-6",
          requirement: "Lintels — 2/90×45 LVL or 3-ply 90×35 MGP10 up to 1800mm; LVL from tables up to 3600mm; engineer >3600mm",
          detail: "Lintel minimum bearing 45mm each end on trimmer studs or wall plate. For openings up to 1800mm: 2/90×45 LVL F17 or 3-ply 90×35 MGP10 is typical (verify from tables for load width and span). For 1800–3600mm openings: LVL beam size from manufacturer span tables accounting for load width, floor/roof loads, and wind classification. For openings >3600mm or where above tables don't apply: engineer design required. Lintel size must be documented on plans.",
          reference: "NCC Vol 2 — Part 3.4.2, AS 1684.2:2021 Part 2",
          asInfo: "AS 1684.2 lintel tables account for opening width, load width (how much roof area bears above), span, and wind class. Undersized lintels deflect over time, transferring load to window/door frames and causing racking and sticking. LVL lintels are the modern standard — they are stronger, straighter, and more consistent than sawn timber. Always check the LOAD WIDTH (the tributary area feeding into the lintel), not just the opening width.",
        },
        {
          id: "frt-7",
          requirement: "Rafters — verify pitch, species, grade, spacing from AS 1684 Part 3 tables; birdsmouth max 1/3 depth",
          detail: "Rafter sizing determined by: span (mm), spacing (450/600/900mm centres), roof pitch, species/stress grade, and wind classification. Refer to AS 1684 Part 3 tables for specific values. Birdsmouth cut (notch at wall plate): maximum depth 1/3 of rafter depth — deeper cuts critically weaken the rafter at the point of maximum stress. Provide rafter tie or ceiling joist to resist outward thrust. Verify rafter is not undersized for snow loads in alpine areas (Zone 8).",
          reference: "NCC Vol 2 — Part 3.4.3, AS 1684.3:2021",
          asInfo: "AS 1684.3 covers cyclonic region framing; Part 2 covers non-cyclonic. Rafter span tables are critically dependent on roof pitch — a low pitch increases effective horizontal span and changes the wind load direction. The birdsmouth cut limit of 1/3 rafter depth is a stress concentration limit: a deeper cut at the plate bearing point reduces the rafter's residual net section to below what can carry the design load.",
        },
        {
          id: "frt-8",
          requirement: "Ceiling joists — max 4.8m span 90×35 MGP10 at 600mm; LVL or engineer beyond; ties at 1800mm ctrs",
          detail: "90×35 MGP10 ceiling joists at 600mm centres can span up to 4.8m (verify against tables for actual species and load). Spans beyond this require LVL or engineer-designed beams. Ceiling tie (strap or joist connecting opposite rafters at ceiling level) at maximum 1800mm centres to prevent rafter spread. Ensure ceiling joists are continuous over at least one support or lapped minimum 150mm over a wall plate.",
          reference: "NCC Vol 2 — Part 3.4.3, AS 1684.2:2021",
          asInfo: "Ceiling joist span limits in AS 1684.2 prevent ceiling sag and cracking of plasterboard. Rafter spread (walls pushing outward under roof load) is resisted entirely by the ceiling tie system — in rooms without ceiling joists (cathedral ceilings), a structural ridge beam or a tie rod is mandatory. Without adequate ceiling ties, ridge sag and wall racking occur progressively over years, often misdiagnosed as footing subsidence.",
        },
        {
          id: "frt-9",
          requirement: "Tie-down — rafter/truss to plate, stud to plate, plate to slab M12 bolt; capacity from AS 1684 Appendix",
          detail: "Complete load path from roof to foundation: every rafter/truss connected to wall plate with approved strap or nail pattern resisting design uplift; every stud connected to both top and bottom plate (Hurricane/Cyclone strap in N3+); bottom plate connected to slab via M12 bolts. Connector capacity (kN) must equal or exceed design uplift loads from AS 1684 Appendix D tables or manufacturer load tables. Document connection schedule on drawings.",
          reference: "NCC Vol 2 — Part 3.4, AS 1684.2:2021 Appendix D",
          asInfo: "AS 1684.2 Appendix D tie-down tables give required connection capacities for every wind classification. The load path is a chain — the weakest link determines total capacity. A missing single rafter strap has caused complete roof loss in cyclones where all other connections were correct. In N3+ zones, use H2.5 or higher rated hurricane straps (Pryda, MiTek or equivalent) verified by a current load certificate from the manufacturer.",
        },
        {
          id: "frt-10",
          requirement: "Wall bracing — bracing units calculated per wind class, distributed both axes",
          detail: "Total bracing units (BUs) required are determined from wind classification, wall height, and roof area. Distribution required in both longitudinal and transverse directions; no individual wall panel to exceed 4m without bracing element. Bracing types: sheet bracing (plywood/fibre cement), steel diagonal strap, proprietary panel systems. Ensure bracing panel lengths and nailing/fixing patterns match manufacturer requirements exactly.",
          reference: "NCC Vol 2 — Part 3.4.3, AS 1684.2:2021 Section 8",
          asInfo: "AS 1684.2 Section 8 bracing provisions resist lateral racking from wind loads. Bracing must be balanced — concentrating all bracing on one side creates a rotational eccentricity that can cause the building to twist in a storm. Sheet-braced walls (plywood/FC) are the most reliable because they transfer load in shear across the full panel; diagonal strap bracing only works in tension and must be pre-tensioned. Always check fixing patterns match the bracing schedule exactly — under-nailed panels can lose 50% of rated capacity.",
        },
        {
          id: "frt-11",
          requirement: "Subfloor ventilation — 3500mm² per lineal metre of external wall, cross-ventilation path clear",
          detail: "Suspended timber floors require subfloor cross-ventilation to prevent moisture accumulation and timber decay. Minimum 3500mm²/m of external wall as free ventilation area on at least two opposite sides. Vent openings must be at opposite sides of the building for cross-flow. No vents to be blocked by garden beds, cladding or insulation. Minimum 150mm clearance between underside of floor framing and ground. Maintain minimum 50mm per AS 3660 for access.",
          reference: "NCC Vol 2 — Part 3.4.1, AS 1684.2:2021",
          asInfo: "The 3500mm²/m ventilation rate was established from research on subfloor decay rates in high-humidity climates. The cross-ventilation path requirement ensures air actually moves through the space — parallel vents on the same wall create dead air pockets. Blocked soffit vents from overcrowded insulation and landscape soil build-up against the building are the two most common causes of bearer and joist rot that is invisible until the floor bounces.",
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
          asInfo: "AS 4600 governs cold-formed steel structures and is the basis for all light gauge steel framing design in Australia. BMT (Base Metal Thickness) is measured BEFORE galvanising — a 0.75mm BMT stud has a total thickness of approximately 0.87mm including coating. Using 0.75mm sections in a load-bearing wall is a structural defect not visible once lined. Always obtain load tables from the specific manufacturer — cross-brand section substitution requires re-verification.",
        },
        {
          id: "frs-2",
          requirement: "Track — same gauge as stud, fix at 300mm from ends, 600mm max ctrs, shim on uneven slab",
          detail: "Top and bottom tracks (U-channel) must be same gauge as the stud they support. Fix track to slab/substrate at maximum 600mm centres and within 300mm of each end. On uneven concrete slabs, use timber or steel shim packs to level the track before fixing — do not bend track to fit the floor. Tracks must be continuous over corners — mitre or overlap minimum 150mm at internal corners.",
          reference: "NCC Vol 2 — Part 3.4, NASH Standard Part 1:2014",
          asInfo: "The NASH Standard (National Association of Steel-Framed Housing) Part 1 provides prescriptive rules for light gauge steel residential construction, similar to AS 1684 for timber. Track fixing transfers all gravity and lateral loads from the wall frame to the slab and roof structure. Fixing at 300mm from ends is critical because shear transfer is highest at track ends — under-fixed track ends have been associated with wall racking failures in severe wind events.",
        },
        {
          id: "frs-3",
          requirement: "Fasteners — No.10-16×16mm self-drill for 0.75mm; No.12-14 for ≥1.15mm; 2 screws per connection min",
          detail: "Self-drilling screws must match the steel thickness: No.10-16 (16mm long) for 0.75mm BMT connections; No.12-14 for 1.15mm and above. All stud-to-track connections: minimum 2 screws per connection point (one each side of web or through flanges). Never use standard wood screws or drywall screws in structural steel framing connections — use approved SD screws only. Screws must be installed flush, not over-driven.",
          reference: "NCC Vol 2 — Part 3.4, AS 4600:2018, NASH Standard Part 1",
          asInfo: "AS 3566 covers self-drilling screws including corrosion resistance classes. Class 3 screws are required for external steel framing; Class 4 for coastal environments. Using an incorrect screw size in thicker steel leaves an incomplete drill point and thread engagement — the screw appears correct but pulls out at a fraction of rated load. Over-driven screws strip the thread in thin material and provide zero shear resistance.",
        },
        {
          id: "frs-4",
          requirement: "Bracing — AS 4600 or manufacturer tables; diagonal strap ≤30° from vertical; pre-tension strap",
          detail: "Steel stud wall bracing achieved by: diagonal flat strap (minimum 0.75mm BMT, 30mm wide) at ≤30° to vertical — steeper angles are ineffective; or proprietary K-brace systems per manufacturer testing. Flat strap must be pre-tensioned before final fixing to prevent buckling under load. Bracing connection at stud and track must be able to transfer the design axial load (tension). Document bracing layout on structural drawings.",
          reference: "NCC Vol 2 — Part 3.4, AS 4600:2018",
          asInfo: "AS 4600 bracing design requires diagonal strap tension bracing to be pre-tensioned — a slack strap provides zero resistance until it is taut, meaning the frame racks before the brace activates. Proprietary shear wall systems (CSR Rmax, Knauf, etc.) use tested assemblies that include specific lining thickness and fixing patterns — substituting the board type or fixing pattern invalidates the tested capacity and rating.",
        },
        {
          id: "frs-5",
          requirement: "Corrosion — C3 environment (≤1km from ocean): G550 Z600 min; C4 marine: stainless fixings",
          detail: "Steel framing corrosion protection must match exposure environment per AS 4312: C1/C2 (inland, low humidity) — standard Z275 galvanising (zinc coating 275g/m²) acceptable; C3 (within 1km of beach or industrial area) — minimum G550 Z600 (600g/m² zinc) for all steel members; C4 (within 200m of breaking surf or heavy industrial) — hot-dipped galvanised G550 plus stainless steel Type 316 fasteners; C5 (marine splash zones) — stainless construction throughout. Paint systems for exposed steel per AS 2312.",
          reference: "NCC Vol 2 — Part 3.4, AS 4312:2008, NASH Standard Part 1",
          asInfo: "AS 4312 classifies atmospheric corrosivity based on salinity, humidity and pollution. G600 galvanising provides approximately 85 microns of zinc coating and 15–25 years protection in C3 environments. Using C2-rated sections in a coastal project will show visible corrosion within 3–5 years, with structural section loss within 10 years. Galvanic corrosion between steel and aluminium requires isolation — never allow direct metal-to-metal contact between dissimilar metals.",
        },
        {
          id: "frs-6",
          requirement: "Fire rating — intumescent paint or tested board system per AS 1530.4 for load-bearing walls",
          detail: "Load-bearing steel stud walls forming part of a fire-rated assembly (e.g., party wall, floor/ceiling assembly) must achieve the required FRL through a tested system. Options: intumescent paint applied to manufacturer's specified DFT (dry film thickness) — system test certificate required; or proprietary board lining system (Fyrchek, Gyprock Firestop, etc.) per manufacturer's tested system. The tested system must specifically cover the steel gauge, stud depth, and lining thickness used.",
          reference: "NCC Vol 2 — Part 3.7.3, AS 1530.4:2014",
          asInfo: "AS 1530.4 is the fire resistance test standard for building elements. FRL is expressed as three numbers (structural adequacy / integrity / insulation), each in minutes. A 60/60/60 FRL means the element retains structural function, prevents passage of flames and hot gases, AND limits temperature rise on the unexposed face for 60 minutes each. The system is the full assembly — changing any component (stud gauge, board type, joint compound) requires re-testing or engineer certification.",
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
          asInfo: "NCC 2022 Section H6 Energy Efficiency specifies minimum R-values for each climate zone. R-value is the insulation's thermal resistance — higher means less heat flow. AS/NZS 4859.1 covers materials for thermal insulation including minimum R-value labelling requirements. Gaps as small as 2% of total ceiling area can reduce effective R-value by up to 30% — the most common installation defect is insulation pushed away from eaves by roof battens, leaving a cold strip around the entire ceiling perimeter.",
        },
        {
          id: "ee-2",
          requirement: `Wall insulation — ${rVal.wall} min (Zone ${climateZone}), fill full cavity, staple every 300mm`,
          detail: `Minimum wall R-value for Climate Zone ${climateZone} is ${rVal.wall}. Batts must fully fill the stud cavity without gaps or compression. Staple batts to studs at 300mm centres in walls to prevent sagging. Install vapour-permeable sarking behind cladding on external walls (foil or non-foil depending on zone). All electrical boxes, plumbing penetrations, and cable runs must be worked around — not left as insulation-free voids. Rigid foam board is an alternative on the warm face for continuous insulation.`,
          reference: "NCC Vol 2 — Part 3.12.1, H6D3, AS/NZS 4859.1",
          asInfo: "Wall insulation R-values in the NCC apply to the insulation product only, not the total wall assembly. Electrical boxes, cable runs, and pipe penetrations punched through batts create thermal bridges — every hole in insulation loses disproportionate heat. Verify product R-value on the delivery label; some cheaper batts have inconsistent density and deliver 10–15% less R-value than stated. Rigid foam board on the warm face provides continuous insulation with no thermal bridging through studs.",
        },
        {
          id: "ee-3",
          requirement: `Floor insulation — ${rVal.floor} min (Zone ${climateZone}), retained by wire hangers or rigid support`,
          detail: rVal.floor === "N/A"
            ? `Not required for Climate Zone ${climateZone} (Zones 1–2 have no minimum floor insulation requirement). However, consider acoustic insulation under timber floors where applicable.`
            : `Minimum floor R-value for Climate Zone ${climateZone} is ${rVal.floor}. Install under suspended timber or steel floor frames. Batts must be mechanically retained — wire hangers (mesh/chicken wire) or rigid Z-clips at maximum 450mm centres. Batts laid on the ground under a concrete slab require separation from earth by DPC. Rigid PIR/EPS board under slab edge is an alternative. Ensure no gaps at perimeter where slab meets wall framing.`,
          reference: "NCC Vol 2 — Part 3.12.1, H6D3",
          asInfo: "Floor insulation for suspended floors is the element most often installed incorrectly. Wire hanger systems must keep batts in full contact with the floor deck — sagging batts lose convective and radiative resistance and can reduce effective R-value by 30–50%. In Zones 3–5, underfloor insulation is frequently omitted or poorly installed, yet it contributes significantly to heating comfort in winter. In coastal areas, use insulation with moisture-resistant facing to resist condensation from cool ground air.",
        },
        {
          id: "ee-4",
          requirement: `Window U-value + SHGC — Zone ${climateZone}: ${zone <= 2 ? "U≤6.0 SHGC≤0.4" : zone === 3 ? "U≤5.5 SHGC≤0.4" : zone === 4 ? "U≤3.4 SHGC 0.4–0.6" : zone <= 6 ? "U≤3.0 SHGC 0.4–0.6" : "U≤2.0 SHGC≥0.5"}`,
          detail: `Window energy performance must be specified and documented. Zone 1–2: U-value ≤6.0, SHGC ≤0.4 (cooling dominated — limit heat gain); Zone 3: U≤5.5, SHGC≤0.4; Zone 4: U≤3.4, SHGC between 0.4 and 0.6; Zone 5–6: U≤3.0, SHGC 0.4–0.6 (mixed climate); Zone 7–8: U≤2.0, SHGC≥0.5 (heating dominated — maximise solar gain). Frame material significantly affects U-value: aluminium without thermal break is typically U=5–7, aluminium with break U=2.5–4, uPVC U=2–3, timber U=2–3. WERS rating label required from supplier.`,
          reference: "NCC Vol 2 — Part 3.12.1, H6D4",
          asInfo: "NCC H6D4 glazing performance must be specified and verified against the WERS (Window Energy Rating Scheme) label. U-value controls winter heat loss through the glass; SHGC (Solar Heat Gain Coefficient) controls summer solar gain. Double-glazed low-E units typically achieve U ≈ 2.0–3.5. Aluminium frames without thermal break typically achieve U=5–7 — significantly worse than required in Zones 6–8. Frame material contributes 20–30% of the total window U-value and must be included in WERS calculations.",
        },
        {
          id: "ee-5",
          requirement: "NatHERS rating ≥6 stars — AccuRate Heritage v2.5+ or FirstRate5 v6+; ABSA/BDAV assessor certificate",
          detail: "Minimum 6-star NatHERS (Nationwide House Energy Rating Scheme) for all new Class 1 and Class 2 dwellings. Modelling must use approved software: AccuRate Heritage v2.5 or later, or FirstRate5 v6 or later. Certificate must be issued by an accredited assessor (ABSA — Association of Building Sustainability Assessors, or BDAV). The certificate must match the final design — any change to wall type, glazing, insulation, or orientation after certification requires a new assessment. Keep certificate with building file for inspection.",
          reference: "NCC Vol 2 — H6V2, H6V3",
          asInfo: "NatHERS (Nationwide House Energy Rating Scheme) simulates 24/7 thermal performance across a full year using hourly climate data. The 6-star minimum (NCC 2022) requires a significant improvement over pre-2022 5-star designs — typically achieved by combining better insulation, double-glazed windows, and draught sealing. The certificate must match the FINAL construction documents — any post-assessment changes to wall type, glazing, insulation, or roofing require a revised assessment before permit is issued.",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "ee-6",
          requirement: "Roof sarking — reflective adds R0.5–R1.0; shiny side down; 150mm lap; taped; turn down at eaves",
          detail: "Reflective sarking installed under roof tiles or metal sheeting provides additional thermal resistance: shiny-side down towards attic space adds R0.5–R1.0 to the ceiling thermal system depending on air gap. Install with shiny side facing down (toward the air gap), not up. All sheets lapped minimum 150mm horizontally and 100mm vertically; all joints taped with compatible foil tape. At eaves: turn sarking down into the gutter or soffit void to prevent moisture from tracking back up under tiles. Puncture-resistant grade required for trafficable roofs.",
          reference: "NCC Vol 2 — H6D3, Part 3.5.1, AS/NZS 4200.2",
          asInfo: "AS/NZS 4200 covers pliable building membranes (sarking and wall wrap). Reflective sarking under tiles works by reducing radiant heat gain into the roof space — it must have an air gap on the reflective side to function. Without an air gap (e.g., if insulation is pushed directly against foil), the R-value contribution is essentially zero. At eaves, turning sarking down prevents moisture wicking back under tiles by capillary action, which is a common source of unexplained ceiling staining.",
        },
        {
          id: "ee-7",
          requirement: "Air sealing — all pipe/cable/flue penetrations sealed; draught-stop at top/bottom plates; door gap <3mm",
          detail: "Air leakage can negate insulation benefit. Seal all penetrations through the building envelope: pipe penetrations — flexible sealant compatible with pipe material; electrical cables — foam backer rod plus sealant; flue penetrations — intumescent or rated collar; downlights — use IC-rated fixtures or seal with purpose-made covers. Top and bottom plates abutting ceiling and slab: install draught-stop foam tape or sealant. External door threshold gap must be <3mm — use compression seal or brush seal. Window and door frame-to-wall junctions: backer rod + sealant all perimeter.",
          reference: "NCC Vol 2 — H6D5",
          asInfo: "Air leakage accounts for 15–25% of heating and cooling energy loss in typical Australian homes. NCC H6D5 sealing requirements address all openings through the thermal envelope. The three worst offenders are: (1) recessed downlights — each creates an uninsulated 100–150mm hole; use IC-rated covers or airtight LED fittings; (2) exhaust fan openings — install gravity-operated backdraft dampers; (3) top plate gaps at wall-ceiling junction — foam tape or bead sealant costs under $50 per room and saves $200+ per year in energy.",
        },
        {
          id: "ee-8",
          requirement: "Whole-of-home energy budget — sum all fixed appliances ≤ max kWh/day; heat pump HWS recommended",
          detail: "NCC 2022 introduces Whole-of-home energy budget: the sum of annual energy use from all fixed appliances (hot water, space heating/cooling, lighting, pool/spa pump if fixed) must not exceed the maximum allowed for the climate zone and dwelling size. Hot water contributes the largest share — heat pump HWS uses ~65% less energy than electric resistance and is the most effective way to meet the budget. Gas HWS is permitted but increases the budget use. LED lighting throughout is essentially mandatory to meet the budget. Solar PV can offset the calculated budget.",
          reference: "NCC 2022 — H6V4 Whole-of-home",
          asInfo: "The NCC 2022 Whole-of-home energy budget is a new requirement on top of the NatHERS 6-star shell rating. It calculates annual energy use from all regulated fixed appliances and compares to a maximum budget for the climate zone and floor area. Heat pump hot water heaters (COP 3–4) are the most effective single change — they use 65–75% less energy than electric resistance HWS. Gas systems are permitted but may still push the budget over limit in cold climates where gas heating energy is significant.",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "ee-9",
          requirement: "Fixed lighting — all luminaires energy efficient LED min; max 5W/m² general areas",
          detail: "All fixed luminaires must be energy efficient — LED is the practical standard meeting the requirement. Maximum installed lighting power density: 5W/m² for general living areas, bedrooms, and corridors. Higher allowances apply to bathrooms (up to 10W/m²) and kitchens (up to 8W/m²) due to task lighting needs. Decorative incandescent or halogen downlights are not compliant. Document fitting wattage on electrical schedule and confirm on NatHERS assessment.",
          reference: "NCC Vol 2 — H6D7, AS/NZS 3000:2018",
          asInfo: "LED lighting is the practical standard for NCC 2022 compliance — compact fluorescent and halogen are technically permitted but difficult to keep within the 5W/m² density limit. The installed wattage must be documented on the electrical schedule submitted with the NatHERS assessment, as lighting contributes to the whole-of-home budget. Decorative pendant fittings with Edison globe incandescent bulbs in prominent living areas are a common source of budget overrun — specify LED-compatible fittings from the start.",
        },
        ...(isColdZone ? [{
          id: "ee-10",
          requirement: "Vapour retarder — Zones 6–8 walls/ceiling; warm side of insulation; no foil in wall cavities Z6–8",
          detail: "Climate Zones 6–8 are at risk of interstitial condensation where warm moist air diffuses through insulation and condenses on cold surfaces. Vapour permeable sarking (not foil) must be used on the warm (internal) side of insulation in walls. Foil-faced insulation batts in wall cavities of Zones 6–8 trap moisture and are not recommended. In ceilings: vapour permeable membrane or standard polyethylene (if no ventilated air gap above). Dew point analysis recommended for unusual construction systems.",
          reference: "NCC 2022 — H6D6 Condensation management",
          asInfo: "NCC 2022 H6D6 Condensation Management is a new section addressing interstitial condensation — moisture that forms INSIDE the wall or ceiling assembly when warm internal air migrates into the cold zone. In Zones 6–8, foil-faced batt insulation in wall cavities creates a vapour barrier on the WRONG (cold) side, trapping moisture. Vapour permeable membranes (permeance >170g/m²/day) allow the wall to dry outward in summer while limiting inward vapour drive in winter. Dew point calculations are required for any unconventional assembly.",
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
          asInfo: "AS 3740:2021 Waterproofing of Domestic Wet Areas is the mandatory standard for all shower recesses, bathrooms, and wet areas in residential buildings. The 2021 revision introduced mandatory bond breakers at internal corners — without a flexible bond breaker bead, rigid membrane cracks at corner junctions due to differential movement between planes. The corner crack is the most common waterproofing failure — water enters the structural substrate and causes mould, timber rot, and extensive damage over 2–5 years before it becomes visible.",
        },
        {
          id: "wp-2",
          requirement: "Shower floor — full membrane including hob; 50mm up wall beyond hob; fall 1:60 min (17mm/m); hob ≥25mm high",
          detail: "Full floor membrane across entire shower floor area including the hob/kerb. Membrane must extend minimum 50mm up the wall on the external face of the hob (wet side). Minimum fall to floor waste: 1:60 = 17mm per metre — measured from furthest point to waste. Hob/kerb minimum height 25mm above finished floor level of shower. Waste set in membrane with a proprietary collar or membrane turned into waste fitting. All corners between floor and walls must have fibreglass or polyester tape reinforcement.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
          asInfo: "The 1:60 minimum floor fall (17mm per metre) prevents standing water on the membrane surface — prolonged water contact accelerates membrane degradation and allows algae growth that breaks down liquid-applied membranes over time. Falls must be established in the substrate BEFORE membrane application — it is not achievable by adjusting tile bed thickness alone after the membrane is down. Check the fall with a spirit level and measuring tape before waterproofing, not after.",
        },
        {
          id: "wp-3",
          requirement: "Shower membrane certificate — licensed waterproofer, AS 3740:2021 certificate, inspect before tiling",
          detail: "Written waterproofing certificate required from a licensed waterproofer (building licence category varies by state — e.g., waterproofing licence in VIC, plumber or builder in QLD). Certificate must reference AS 3740:2021 and describe the membrane system used (product name, number of coats, thickness). Building inspector or private certifier must inspect and approve membrane before tiles are laid — do not tile over without inspection sign-off. Tiler must not damage membrane with fixings or abrasion.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
          asInfo: "The AS 3740 certificate is a legally required document in most states that transfers liability to the licensed waterproofer. Without a certificate, the building owner and builder share responsibility for any subsequent leaks. The inspection before tiling is critical — once tiles are laid, a failed membrane cannot be tested or inspected. Take date-stamped photos of all finished membrane surfaces before tiling commences as evidence for the building file.",
        },
        {
          id: "wp-4",
          requirement: "Bathroom floor (no shower) — full floor membrane; 150mm upstand at wall junctions; fall 1:80 to waste",
          detail: "Bathroom floors without a shower recess still require full floor membrane where there is a floor waste or where water is likely to contact the floor (e.g., from a bath or adjacent shower spray). 150mm upstand at all wall-floor junctions, including under wall tiles. Bond breaker at all internal angles before membrane. Minimum fall to floor waste 1:80. Where no floor waste: full membrane still required if floor tiles are installed in a wet area bathroom.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
          asInfo: "The 150mm wall upstand requirement prevents water that collects at floor level from infiltrating behind skirting tiles. A common defect is the waterproofer stopping the membrane at the base of the skirting tile course — water then pools behind the skirting and enters the wall structure. On suspended timber floors, membrane failure is especially serious: water saturates the joist and bearer system below, causing fungal decay that can cost $15,000–30,000 to remediate once the floor must be removed.",
        },
        {
          id: "wp-5",
          requirement: "Ensuite/toilet — full floor membrane where floor waste present; skirting tiles set in membrane",
          detail: "Where ensuite or toilet has a floor waste or is adjacent to a shower with a shared floor, full floor membrane applies. 150mm upstand at all junctions. Skirting tiles must be set in the membrane — not just against it — by turning the membrane up the wall and bedding skirting tiles into the membrane before applying wall tiles above. Penetrations for pipe pedestals sealed with flexible sealant into membrane collar.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
          asInfo: "Waterproofing failure at ensuite/toilet floors is the most common insurance claim in new residential construction in Australia. The critical detail is continuity between the shower membrane and the surrounding floor membrane — these must be the same product, applied in the same session, with no cold joint between them. Pipe penetrations through the membrane (WC pedestals, waste pipes) must be sealed with a pipe collar rated for the membrane system, not just silicone sealant over the top.",
        },
        {
          id: "wp-6",
          requirement: "Laundry — full floor membrane; 75mm upstand at walls; area under trough/WM; waterproof tap penetrations",
          detail: "Full floor membrane in laundry area. Upstand minimum 75mm at all wall-floor junctions. Membrane must cover the area under the trough, washing machine, and any floor drain. Tap/mixer penetrations through the wall must be sealed with flexible sealant into the membrane. Install floor waste and ensure positive fall (1:80 minimum) to waste. Where laundry is on a suspended floor, use a liquid-applied membrane system suitable for timber substrate.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
          asInfo: "Laundry waterproofing is often installed to a lower standard than bathrooms, yet washing machine hose failures and trough overflow events are among the most common domestic water damage claims. Washing machine supply hoses fail without warning — the floor membrane and drain are the last line of defence. The waste must be set so the grate sits flush with the finished floor, not recessed 10–15mm where water must pool before draining (a common tiler error that negates the fall).",
        },
        {
          id: "wp-7",
          requirement: "Balcony/deck — continuous membrane to AS 4654.2; 150mm upstand; transition under door sill; 1:100 fall to outlet",
          detail: "Above-ground balcony and deck waterproofing must comply with AS 4654.2. Continuous membrane across the full deck area. Minimum 150mm upstand at all walls and where deck meets the building structure. Transition membrane and flashing under door sill/threshold to prevent water ingress at the most vulnerable junction. Outlet must be through a purpose-made membrane collar. Minimum positive fall 1:100 (10mm per metre) to the outlet — check at all corners of the deck. Verify membrane system is classified for the expected foot traffic and UV exposure.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 4654.2:2012",
          asInfo: "AS 4654.2 covers waterproof membrane systems for external above-ground areas. Balcony waterproofing failure is particularly costly because water saturates the structural concrete or timber deck framing invisibly — the damage is not apparent until severe. The door sill junction is the number-one failure point: the membrane must transition UNDER the door frame threshold sill, not just up to it. A 10mm gap at the door sill allows litres of water per rain event to enter the building structure.",
        },
        {
          id: "wp-8",
          requirement: "Roof flashing — lead/copper at ridges, penetrations, valleys; step, apron, and counter flashings",
          detail: "Flashing required at all roof penetrations (pipes, vents, chimneys, skylights), junctions (roof-to-wall, valley gutters), and at ridge and hip tiles. Materials: lead (min 1.8kg/m²), copper, zinc, or aluminium compatible with roof and wall materials. Step flashing at wall junctions: 100mm turn-up behind cladding, 100mm on roof surface. Apron flashing at protrusions: 75mm on roof, 150mm over protrusion. Counter flashing over step flashing: minimum 65mm overlap. All flashing laps sealed with compatible sealant.",
          reference: "NCC Vol 2 — Part 3.5.4",
          asInfo: "Roof flashings are the most common source of roof leaks, accounting for over 60% of all roofing warranty claims. The most vulnerable locations are: chimneys and skylights (differential movement causes sealant cracking), valley gutters (debris blockage causes overflow), and roof-to-wall junctions (step flashing laps too short or missing counter flashing). Lead and copper must not be used where runoff enters rainwater tanks — use zinc or aluminium in those situations.",
        },
        {
          id: "wp-9",
          requirement: "Tiles are finish only — membrane must exist under all wet-area tiles; grout is not waterproof",
          detail: "Ceramic and porcelain tiles and grout are NOT waterproof and must never be relied upon as the sole waterproofing layer. Grout is porous and cracks with building movement, allowing water into substrate. The waterproof membrane (liquid-applied, sheet, or tile-over system) must be installed beneath tiles in all wet areas, and must be fully cured and inspected before any tiles are laid. This is one of the most commonly failed inspection items — document with photos.",
          reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021",
          asInfo: "AS 3740:2021 explicitly states tiles and grout joints are NOT a waterproofing system. This is a persistent trade misconception — tilers are sometimes asked to apply an extra coat of grout sealer as a 'waterproof layer', which is not compliant. Grout becomes porous within 1–3 years of thermal cycling and cleaning. The membrane must be fully cured to the manufacturer's specified time (typically 24–48 hours minimum) before any adhesive or tile is applied on top.",
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
          asInfo: "AS 3786:2014+A1:2015 specifies photoelectric smoke alarms — they detect large visible combustion particles from smouldering fires (e.g., upholstery, bedding) far faster than ionisation types. Ionisation alarms detect flaming fires but respond slowly to smouldering fires, which are the leading cause of domestic fire deaths due to smoke inhalation during sleep. Interconnection ensures that an alarm in a remote room activates every alarm in the dwelling — critical when occupants are sleeping with doors closed.",
        },
        {
          id: "fs-2",
          requirement: "Alarm placement — every storey; each bedroom; between bedrooms and rest of dwelling; ≥300mm from walls; ≥400mm from corners",
          detail: "Mandatory locations: (1) every storey of the dwelling; (2) in each bedroom; (3) in the hallway or space between bedrooms and the rest of the dwelling. Ceiling mounting: minimum 300mm from any wall; minimum 400mm from any corner. Must NOT be placed: in dead-air space at ceiling apex; within 300mm of a light fitting, exhaust fan, or air conditioning outlet (airflow disrupts sensing); within 300mm of a cooking appliance. Not permitted on sloped ceilings within 600mm of the apex — mount on flat section.",
          reference: "NCC Vol 2 — Part 3.7.2",
          asInfo: "The 300mm wall clearance and 400mm corner clearance rules address 'dead air' zones — areas where stratified, slow-moving air near walls and corners means smoke reaches the alarm significantly later than at the ceiling centre. CFD (computational fluid dynamics) fire studies show that wall-mounted alarms can take 2–3 times longer to activate than ceiling-centre mounted alarms in identical fire scenarios. Proximity to exhaust fans creates a reverse air current that can carry smoke away from the alarm.",
        },
        {
          id: "fs-3",
          requirement: "Garage separation — FRL 60/60/60 wall; FD30 self-closing self-latching door; garage floor ≤ dwelling floor",
          detail: "Attached garage or carport that shares a wall, floor, or ceiling with habitable spaces must have: wall with Fire Resistance Level (FRL) of 60/60/60 (structural adequacy/integrity/insulation in minutes); self-closing, self-latching fire door rated FD30 (30 minute fire door) with intumescent strip; garage floor must be equal to or LOWER than dwelling floor — step down into garage prevents fuel spill flowing into dwelling. No unrated openings, windows, or vents between garage and habitable areas. All penetrations (pipes, cables) through the rated wall must be fire-stopped.",
          reference: "NCC Vol 2 — Part 3.7.3",
          asInfo: "A garage fire develops very rapidly — a car fire can reach flashover in under 5 minutes. The FRL 60/60/60 wall gives occupants 60 minutes to escape; the FD30 door gives an additional 30-minute barrier at the only opening. The step-down into the garage prevents flammable liquid (petrol, brake fluid) from flowing under the door into the dwelling — a 25mm step is sufficient. The door self-closer must be functional — wedging it open with a doorstop is a common safety violation.",
          applicableClasses: ["1a", "1b"],
        },
        ...(buildingClass !== "1a" ? [{
          id: "fs-4",
          requirement: "Party wall — FRL 60/60/60 min; full height to underside of roof covering; fire-stop all penetrations",
          detail: "Party walls between Class 1b, Class 2, and Class 3 buildings or sole-occupancy units must achieve FRL 60/60/60. Wall must extend to the full height of the building to the underside of the roof covering — not just to ceiling level. The wall must effectively seal the roof space between units to prevent fire spread. No unrated penetrations: all pipe, cable, and duct penetrations must be fire-stopped with a system tested and certified to the wall's FRL. Fire-stopping products must be installed exactly per tested system certificate (see Spec C3.15 for commercial).",
          reference: "NCC Vol 2 — Part 3.7.3",
          asInfo: "AS 1530.4 testing demonstrates that a fire-rated wall stopping at ceiling level is defeated — fire reaches the shared roof space above the ceiling within minutes. Party walls must extend continuously to the underside of the roof cladding (or a fire-rated roof) to create a true barrier between dwellings. Any unrated penetration through this wall — including cable TV conduit, plumbing, or even a recessed light fitting — creates a path for smoke and fire that negates the wall's entire FRL.",
        }] : []),
        {
          id: "fs-5",
          requirement: "Fire stopping at penetrations — intumescent collar for plastic pipes ≥DN50; graphite sealant for cables; dampers for HVAC",
          detail: "Every penetration through a fire-rated wall or floor must be fire-stopped: plastic pipes DN50 and larger — intumescent collar (expands and closes the pipe as it melts); metal pipes — fire-rated wrap system; cable bundles — intumescent sealant or graphite-based pillows filling to full wall thickness; HVAC ducts — motorised fire damper rated to the assembly's FRL, actuated by smoke detector in duct; combustible liners in ducts passing through rated elements — replace with steel. All systems must be tested per AS 1530.4 and installed per the certificate of conformity.",
          reference: "NCC Vol 2 — Part 3.7.3, NCC Vol 1 — Spec C3.15",
          asInfo: "Fire stopping systems must be from a certified product system (Hilti, Rockwool, Promat, etc.) tested to AS 1530.4 for the specific wall or floor assembly being penetrated. An intumescent collar works by expanding 10–15 times its volume when heated, filling the void left by a melting PVC pipe. The most common site non-compliance is unprotected PVC pipe penetrations — plastic pipe melts at ~70°C, leaving a fully open hole in what was a fire-rated wall. This failure has caused multiple multi-storey fire events in Australia.",
        },
        {
          id: "fs-6",
          requirement: "Ember protection — 2mm corrosion-resistant steel mesh on all subfloor, eave, and roof ventilation (BAL areas)",
          detail: "In BAL-rated construction, all ventilation openings that could allow ember entry must be protected with 2mm aperture corrosion-resistant steel mesh (stainless steel preferred; aluminium or galvanised acceptable at lower BAL levels). This applies to: subfloor ventilation bricks and grilles; soffit and eave ventilation panels; ridge ventilation systems; any gap >3mm in fascia, soffit, or external wall in BAL-29 and above. At BAL-40 and BAL-FZ, roof valley gutters and downpipes must also be protected. Check AS 3959 Table for each BAL level's specific requirements.",
          reference: "NCC Vol 2 — Part 3.7.4, AS 3959:2018",
          asInfo: "AS 3959 ember protection requirements address the primary ignition pathway in Australian bushfires — airborne ember attack. Embers travel kilometres ahead of a fire front and enter buildings through unprotected vents, starting internal ignitions while the main fire is still distant. The 2mm aperture is the threshold below which most burning embers cannot pass. Aluminium mesh melts at ~660°C during direct flame contact and is not appropriate for BAL-40 or FZ — use stainless steel Grade 316 at those levels.",
        },
        {
          id: "fs-7",
          requirement: "Bedroom egress — direct access outside OR corridor ≤6m from exit; window min 450×450mm clear opening",
          detail: "Each bedroom must have a viable means of escape: direct door to outside or to an internal corridor/hallway not more than 6m from an exit door. If escape is via a window: minimum clear opening 450mm wide × 450mm high, with sill height no more than 1000mm above floor level to allow unassisted egress. This is particularly important for habitable rooms above ground level. Windows with restricted openings (security locks) must still allow the 450mm clear opening — check lock overrides.",
          reference: "NCC Vol 2 — Part 3.7.1",
          asInfo: "The 450×450mm clear window opening is based on the minimum body dimension for an average adult to exit through a window opening without tools. Child safety window restrictors are compliant if they can be released without tools from inside in an emergency — a fixed restrictor that cannot be released is a fire safety violation. On upper floors, escape via window requires additional assessment for fall risk — ladder provision or fire brigade ladder access should be considered.",
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
          asInfo: "AS/NZS 3500.4 Hot Water Supply requires 60°C storage because Legionella pneumophila (cause of Legionnaires' disease) is killed within 2 minutes at 60°C but survives for months at 35–45°C. The tempering valve at 50°C prevents scalding — water at 60°C causes full-thickness burns in 5 seconds; at 50°C it takes 5 minutes, allowing reaction time. The valve must be tested with a calibrated thermometer on commissioning and the set temperature recorded on the label.",
        },
        {
          id: "pl-2",
          requirement: "Drain grade — DN50 at 1:40; DN80 at 1:60; DN100 sewer at 1:60 (1.65%); access points every change >45°",
          detail: "Sanitary drainage minimum grades: DN50 (50mm diameter) at 1:40 = 25mm fall per metre; DN80 at 1:60 = 16.7mm/m; DN100 (main sewer drain) at 1:60 = 16.7mm/m. Never install a drain with reverse fall — check with spirit level. Trap seal minimum 50mm water depth to prevent sewer gas ingress. Access openings (inspection openings or cleanouts) required at every change of direction >45°, at every junction, and at maximum 15m centres in straight runs. All fixtures must have a P-trap or deep-seal trap minimum DN40.",
          reference: "NCC Vol 3 — AS/NZS 3500.2:2021",
          asInfo: "AS/NZS 3500.2 Sanitary Plumbing and Drainage covers all drain sizing and installation. Drain grade provides self-cleansing velocity — the water must move fast enough to carry solids in suspension (0.7 m/s minimum). Below minimum grade, solids settle and accumulate, causing blockages. Above maximum grade (1:20 for DN100), the water flows faster than the solids, leaving them behind — the same result. Traps must retain 50mm water seal minimum — evaporation in unused fixtures allows sewer gases (H₂S, methane) to enter the building.",
        },
        {
          id: "pl-3",
          requirement: "Fixture units and pipe sizing — basin DN32; shower DN40; bath DN40; WC DN100; washing machine DN40",
          detail: "Minimum drain sizes per fixture: hand basin pedestal — DN32; shower recess — DN40; bath — DN40; WC — DN100; washing machine — DN40; kitchen sink — DN40 (single bowl). Collector (branch) drain sizing from fixture unit tables in AS/NZS 3500.2: total fixture units from connected fixtures determine the collector pipe size and grade. A DN100 collector drain can serve most typical residential bathrooms — verify for multiple bathrooms discharging to a single branch.",
          reference: "NCC Vol 3 — AS/NZS 3500.2:2021",
          asInfo: "Fixture units in AS/NZS 3500.2 are a standardised measure of drain discharge demand that accounts for peak simultaneous use probability. A WC has 4 fixture units, a shower 2, a basin 1. The collector pipe serving all bathroom fixtures must be sized for the total fixture unit count — an undersized collector pipe backs up during peak use (multiple simultaneous flushes and showers in multi-bathroom homes). This is the most common cause of slow drainage that appears after handover.",
        },
        {
          id: "pl-4",
          requirement: "Backflow prevention — containment device at point of supply; type matches hazard rating",
          detail: "Potable water supply must be protected from backflow contamination. For Class 1 residential: containment backflow prevention device at the meter or point of entry. Hazard rating determines device type: low hazard (single dwelling) — dual check valve or pressure vacuum breaker; medium hazard (irrigation, solar HWS with anti-freeze) — reduced pressure zone device (RPZ); high hazard (commercial/industrial processes) — RPZ or air gap. All backflow prevention devices to be tested annually by a licensed tester.",
          reference: "NCC Vol 3 — AS/NZS 3500.1:2021",
          asInfo: "AS/NZS 3500.1 Water Services covers backflow prevention. Backflow occurs when a drop in mains pressure (during firefighting operations or main repair) causes contaminated water to siphon back into the potable supply. Solar hot water systems with anti-freeze fluid are a medium-hazard contamination risk — the glycol solution can siphon into the cold water supply without an RPZ valve. A dual check valve alone is not sufficient for medium-hazard applications.",
        },
        {
          id: "pl-5",
          requirement: "Overflow relief gully (ORG) — 75mm below lowest fixture; free-draining; no lockable lid; accessible",
          detail: "The overflow relief gully (ORG) is the safety relief point for the sewer system — it discharges to surface before the sewer backs up into the building. Gully surround must be 75mm below the lowest connected plumbing fixture (typically the shower waste). The gully grate must be free-draining — no sealed lid or lockable cover. Gully must be accessible for inspection and clearing — do not bury or build over. Must be visible from the building and located outside, not under paving.",
          reference: "NCC Vol 3 — AS/NZS 3500.2:2021",
          asInfo: "The ORG is the plumbing system's pressure relief valve — when the sewer main blocks, sewage rises in the building drainage system and exits via the ORG to the surface rather than backing up into showers and toilets. If the ORG is buried under paving or fitted with a lockable cap, this protection is defeated and sewage floods the building interior. Installing a sealed paving surface over an ORG is one of the most common and costly plumbing violations found during building inspections.",
        },
        {
          id: "pl-6",
          requirement: "Stormwater — separate from sewer; gutter sizing per AS/NZS 3500.3; ≥0.5% fall; DN75 downpipe up to 47m²",
          detail: "Stormwater (roof drainage) must be completely separated from the sanitary sewer system — cross connections are illegal. Gutter sizing per AS/NZS 3500.3: based on roof catchment area (m²) × rainfall intensity (mm/hr from BOM data for location). Gutters must have minimum 0.5% fall (5mm per metre) towards downpipes — check with string line. Minimum downpipe size DN75 for up to 47m² roof catchment; DN90 for 47–75m²; DN100 for 75–130m². Stormwater to connect to council stormwater drain or approved soakage pit.",
          reference: "NCC Vol 3 — AS/NZS 3500.3:2018",
          asInfo: "AS/NZS 3500.3 Stormwater Drainage uses BOM rainfall intensity data (in mm/hr for a 1-in-20 year storm event at the location) to size gutters and downpipes. Brisbane's 1-in-20yr rainfall intensity is approximately 166mm/hr; Melbourne's is approximately 100mm/hr — a Brisbane house needs proportionally larger gutters. Level gutters (zero fall) pool water, accelerate corrosion of steel gutters, and overflow laterally — check fall with a string line from both downpipe ends across the full gutter length.",
        },
        {
          id: "pl-7",
          requirement: "Gas — AS/NZS 5601.1; yellow PE or copper pipe; pressure test 1.5× working pressure; 1.5m from ignition source",
          detail: "All gas work by licensed gasfitter only. Supply pipe: yellow polyethylene (for buried), copper (internal), or stainless steel flexible connector (appliance final connection). Pressure test at 1.5 times working pressure (typically 1.1 kPa test for low pressure) and hold for 30 minutes — zero drop acceptable. Gas meter must be located minimum 1.5m from any ignition source, operable window, or openable door. Flue clearances for gas appliances: minimum 500mm from any opening, 1.5m from any operating corner. Ventilation required for all gas appliances in enclosed spaces.",
          reference: "NCC Vol 3, AS/NZS 5601.1:2013",
          asInfo: "AS/NZS 5601.1 Gas Installations is the comprehensive standard for all natural gas and LPG installations. The 30-minute zero-drop pressure test is mandatory before concealing any gas pipework in walls or under slabs — a leaking gas pipe in a wall cavity is an explosion risk that may not manifest for years. The gasfitter's Certificate of Compliance (CoC) must be kept permanently in the building file — without it, insurance claims related to gas incidents may be denied. Natural gas is lighter than air (disperses upward); LPG is heavier than air (accumulates in pits and low areas — different safety requirements apply).",
        },
        {
          id: "pl-8",
          requirement: "Water pressure — 150 kPa min at highest outlet; regulator if >500 kPa; lead <0.25% in all fittings",
          detail: "Minimum water pressure 150 kPa at the highest outlet in the building under simultaneous use. Maximum allowable pressure 500 kPa — pressure limiting valve (PLV) required where mains pressure exceeds this. Flow rate minimum 0.1 L/s at any outlet. All fixtures, fittings, and components in contact with drinking water must be WaterMark certified with lead content <0.25% per AS 4020. Keep WaterMark certificates on file — inspector may request. Do not use non-certified products (including some imported tapware).",
          reference: "NCC Vol 3 — AS/NZS 3500.1:2021, AS 4020",
          asInfo: "AS 4020 Testing of products for use in contact with drinking water specifies the maximum lead content (0.25%) for all tapware, fittings, and valves. Lead leaches into drinking water from brass components — imported tapware from some manufacturers exceeds this limit significantly. WaterMark certification is the mandatory evidence of compliance — products without the WaterMark logo are not legally permitted in Australian plumbing systems. Pressure above 500 kPa causes premature failure of flexible hoses and valves, which are the leading cause of home flooding.",
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
          asInfo: "NCC 2022 H9 Livable Housing Design provisions apply to all new Class 1a, 1b, and 2 dwellings from 1 October 2023 (earlier in some states). AS 1428.1 Design for Access and Mobility is the technical standard underpinning these requirements. The step-free pathway provision reflects that 1-in-5 Australians live with disability, and most prefer to remain in their own home as they age. A step-free approach path adds essentially zero cost during construction but costs $5,000–15,000 to retrofit after handover.",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-2",
          requirement: "Step-free threshold — max 5mm lip; flush transition or ramped profile",
          detail: "Principal entrance door must have a step-free threshold — maximum 5mm vertical lip. Where a weather check or threshold detail is required, use a ramped profile transitioning gradually across the 5mm height. This applies to the primary entry door of each dwelling. Internal doors on the ground floor also should not have raised thresholds. Sliding doors often have an inherent track raised profile — verify final height after track and weatherstrip installation.",
          reference: "NCC 2022 — H9D3",
          asInfo: "The 5mm maximum threshold lip is based on the maximum wheel step height for a manual wheelchair. A standard commercial-grade aluminium door threshold creates a 12–15mm height change — this must be reduced with a ramped threshold profile or by recessing the threshold. The most common failure point is the sliding door track, which raises the floor level by 15–25mm — proprietary flush-track systems are available that achieve near-flush installation while maintaining weather resistance.",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-3",
          requirement: "Internal doors — 820mm clear opening min on ground floor for all habitable rooms; lever hardware",
          detail: "All doors on the entry level giving access to habitable rooms must have minimum 820mm clear opening width (this requires a nominal 870mm door leaf in a standard rebated frame). Clear width is measured from the door stop face to the door face when fully open. Applies to: entry door, living, dining, kitchen, bedroom, bathroom, and toilet on the entry level. Door furniture must be lever-type (D-pull acceptable) — round knobs are not compliant. Hinges must allow full 90° opening without obstruction.",
          reference: "NCC 2022 — H9D4, AS 1428.1:2009",
          asInfo: "AS 1428.1 specifies 820mm clear opening as the minimum for a manual wheelchair user. The difference between a nominal 820mm door and an actual 820mm clear opening is critical — a 820mm door leaf in a standard rebated frame provides only about 780mm clear (the rebate and open door thickness consume the rest). You need an 870mm nominal door leaf to achieve 820mm clear. This is one of the most commonly non-compliant items found during livable housing inspections — specify by clear opening, not door size.",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-4",
          requirement: "Corridor/hallway — min 1000mm clear between walls from front door to first habitable room",
          detail: "The primary pathway through the dwelling from the entry door to the first habitable room (typically living or dining) must be minimum 1000mm clear between walls, built-in joinery, or any other obstruction. This applies even where the hallway is short. Where a corner turn is required, ensure 1000mm clear is maintained around the turn — check by drawing turning circle.",
          reference: "NCC 2022 — H9D4",
          asInfo: "NCC H9 corridor width requirements ensure mobility aids can navigate between rooms without assistance. A standard rollator walking frame is 640mm wide and needs 1000mm clear corridor to turn without striking walls. Corridor widths are frequently compromised by late-stage decisions to add built-in joinery or to shift walls after the slab is poured — confirm corridor widths on the slab set-out drawing before concrete is placed, not after framing.",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-5",
          requirement: "Toilet/bathroom — 900×1200mm clear floor space beside WC; outward or sliding door",
          detail: "Ground floor toilet/bathroom must have 900mm × 1200mm clear floor space beside the WC to allow side transfer access. This space must not be obstructed by door swing — use either an outward-opening door, offset pivot, or sliding/barn door. Alternatively, a positive direction inswing is acceptable if the 900×1200mm clear floor space is maintained when the door is open. The WC must be positioned with at least one side accessible (not built into a corner).",
          reference: "NCC 2022 — H9D5",
          asInfo: "NCC H9D5 toilet clear floor space mirrors the configuration used in every hospital and aged care facility worldwide — 900mm beside the WC allows a carer to stand beside and assist transfer from a wheelchair. An inswing bathroom door can comply if the full 900×1200mm space is clear when the door is at 90°, but this requires careful door placement and is often impractical — a sliding or outward door is the reliable solution. Never design a WC built tight into a corner on both sides.",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-6",
          requirement: "Grab rail reinforcement — nogging at 600–900mm AFF; 1.1 kN point load capacity for future rail",
          detail: "Walls around shower, toilet, and bath in the ground floor bathroom must be reinforced for future grab rail installation. Install horizontal nogging (blocking) at 600mm to 900mm AFF — minimum 35×90mm timber for timber framing or equivalent blocking in steel stud walls. The fixing substrate must be capable of resisting a 1.1 kN point load in any direction (test per AS 1428.1). Document nogging locations on as-built drawings. Do not tile over the nogging locations without marking them on a tile layout.",
          reference: "NCC 2022 — H9D5, AS 1428.1:2009",
          asInfo: "Grab rail backing (nogging) is the single most cost-effective livable housing feature — it costs under $50 in materials during framing and allows grab rails to be installed at any time during the life of the building without structural demolition. A standard plasterboard wall can sustain approximately 0.2 kN pull-out before failure — a person using a grab rail for balance recovery applies 1.1 kN. Without backing, a grab rail installation requires opening the wall, adding plywood, re-plastering, and re-painting — typically $800–1500 per rail location.",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-7",
          requirement: "Accessible parking — if provided, 1 space min 3200mm wide (800mm access zone); head clearance 2200mm",
          detail: "Where a dedicated car space is provided with the dwelling, at least one space must be 3200mm wide (2400mm vehicle bay + 800mm access zone on one side, or two spaces sharing an 800mm central zone). Head clearance minimum 2200mm for accessible parking bays. The access zone must connect to the accessible pathway to the dwelling entry. Garage door must allow 2200mm vertical clearance. Parking bay surface must be level (max 1:80 cross-fall) and non-slip.",
          reference: "NCC 2022 — H9D3, AS 2890.6",
          asInfo: "AS 2890.6 covers off-street parking for people with disabilities. The 3200mm total width (2400mm vehicle + 800mm access zone) is based on a full door-open position of a standard vehicle and the clearance needed for a wheelchair beside the open door. The access zone must be connected to the step-free path to the dwelling entry — a parking space that meets the width requirement but discharges onto a step or garden is non-compliant. The 2200mm head clearance accommodates vehicles with rooftop wheelchair carriers.",
          applicableClasses: ["1a", "1b", "2"],
        },
        {
          id: "lh-8",
          requirement: "Switches and GPOs — 600mm to 1200mm AFF; lever door handles; contrast with wall background",
          detail: "All switched general purpose outlets (GPOs), light switches, and other frequently used controls must be located between 600mm and 1200mm above finished floor level. This single height range applies to both the minimum and maximum heights, enabling use from seated position. Provide tonal contrast between switch/outlet face plate and wall background for low-vision users. All door handles throughout the dwelling must be lever type (not round knob). Kitchen and bathroom tapware should be lever or sensor type.",
          reference: "NCC 2022 — H9D4, AS 1428.1:2009",
          asInfo: "NCC H9 switch and GPO height range (600–1200mm AFF) places controls within reach of both seated wheelchair users (minimum 600mm) and standing users without awkward bending (maximum 1200mm). This range also benefits children and short adults. Lever door handles are required because round knobs require wrist rotation — a person with arthritis, a stroke survivor, or someone carrying items cannot operate a round knob. Specifying lever hardware from the start is free; retrofitting is $50–150 per door.",
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
          asInfo: "The 2R+G formula (two risers plus one going = 550–700mm) is an ergonomic formula derived from the average adult stride length on an inclined surface. Stairs outside this range feel wrong — too steep (high riser, short going) causes forward lean and knee strain; too shallow (low riser, long going) breaks the walking rhythm. The 5mm maximum riser variation is a critical safety limit — the human nervous system subconsciously adapts to a consistent riser height after the first two steps, and any variation disrupts gait and causes trips.",
        },
        {
          id: "st-2",
          requirement: "Open risers — prohibited where 125mm sphere passes through; ≤100mm gap if open risers permitted",
          detail: "Open risers (no vertical face between treads) are prohibited in any location where children (under 5 years) could be expected to use the stair, unless the gap between the bottom of one tread and the top of the tread below is ≤100mm (sphere test: 125mm sphere must not pass through any part of the stair). For dwellings, the safest approach is no open risers. If open-riser design is desired, confirm client's circumstances and check jurisdictional requirements — some states require closed risers in all Class 1 dwellings.",
          reference: "NCC Vol 2 — Part 3.9.1.1",
          asInfo: "The 125mm sphere test is based on the head circumference of a child under 5 years — if the head can enter a gap, the child can become neck-trapped and strangle. This rule applies to all orientations of gaps in stairs and balustrades, not just vertical gaps between balusters. Open-riser timber stairs with large gaps are a persistent residential design feature that fails this test — solid risers, close-spaced balusters, or glass panels are the compliant alternatives.",
        },
        {
          id: "st-3",
          requirement: "Stair width — ≥1000mm clear; handrail projection ≤100mm into required width",
          detail: "Minimum 1000mm clear width between any enclosing walls, balustrades, or stringers. Any handrail projection into the required stair width must be ≤100mm from each side — meaning on a 1000mm stair with handrails both sides, each handrail can project no more than 100mm. Where a stair also serves as an accessible path of travel, minimum width increases — check AS 1428.2 for accessible design. Width measured at tread nosing level.",
          reference: "NCC Vol 2 — Part 3.9.1",
          asInfo: "The 1000mm minimum stair width is the minimum for furniture removal, emergency service access, and general use — it is not an accessibility standard (wheelchair access requires 1200mm minimum). The 100mm handrail projection limit is frequently exceeded when large-profile handrails are installed on both sides of a 1000mm stair, reducing the usable width to under 800mm — which then creates a safety issue for larger users and impedes emergency evacuation.",
        },
        {
          id: "st-4",
          requirement: "Landing — min 900×900mm clear at top and bottom; 750mm min if door swings onto landing",
          detail: "Level landing required at the top and bottom of every stair flight, minimum 900mm × 900mm clear of any door swing, handrail, or obstruction. Where a door opens onto the landing, the clear landing depth in the direction of travel must be minimum 750mm clear of the door swing plus the required 900mm width. Mid-flight landings required every 18 risers maximum. Landing gradient maximum 1:80 to prevent pooling.",
          reference: "NCC Vol 2 — Part 3.9.1",
          asInfo: "NCC landing requirements provide a stable platform to pause, adjust balance, and change direction at the top and bottom of stairs — the most common locations for stair falls. A door that swings directly onto a step (with no landing) creates an acute fall hazard where a person opening the door steps back onto a lower tread while distracted. The 18-riser maximum between landings limits the fall height in a single flight, and mid-flight landings also provide rest points for people with limited mobility.",
        },
        {
          id: "st-5",
          requirement: "Handrail — 865–1000mm above nosing; 32–50mm circular diameter or grip equivalent; extends 300mm past top nosing",
          detail: "Handrail height measured vertically from the stair nosing line (the plane of all nosings) to the top of the handrail: minimum 865mm, maximum 1000mm. Profile must be graspable: circular section 32–50mm diameter or elliptical/shaped sections with equivalent 32–50mm grip dimension. Handrail must be continuous along the full stair flight and extend horizontally 300mm beyond the top nosing. At the bottom: extend beyond the bottom nosing for a distance equal to the tread going. Handrail ends must return to the wall or post to prevent snagging.",
          reference: "NCC Vol 2 — Part 3.9.2",
          asInfo: "Handrail graspability requirements (32–50mm diameter) are from ergonomic research on power grip — a circular section within this range allows a full wrap-around grip that provides maximum stability force. A flat-top handrail (such as a 90×35 timber rail) cannot be power-gripped and provides minimal stability in a fall. Handrail extensions past the top nosing are critical — they allow a user to maintain grip while transitioning from the top tread onto the landing level, which is the transition point where most stair falls occur.",
        },
        {
          id: "st-6",
          requirement: "Balustrade height — ≥1000mm where drop ≥1m; ≥865mm for stair flights; non-climbable; no horizontal rails",
          detail: "Balustrade height minimum 1000mm above the floor or deck where any drop is 1m or greater. On stair flights: minimum 865mm measured vertically from the nosing line. The balustrade must be designed to be non-climbable — no horizontal rails, decorative ledges, or openings that could serve as footholds. The 125mm sphere test applies: no opening in the balustrade (vertical, horizontal, or diagonal) must allow a 125mm sphere to pass through. Glass balustrades: minimum 10mm toughened or 6.38mm laminated (verify from AS 1288 Table 6.1 for wind load).",
          reference: "NCC Vol 2 — Part 3.9.2, AS 1170.1",
          asInfo: "The non-climbable balustrade requirement is based on child safety research showing that horizontal rails act as a ladder — children aged 1–5 can climb a horizontal-rail balustrade in seconds. The 1000mm height was derived from the centre-of-gravity height of an adult leaning against a barrier — below 1000mm, the upper body mass is above the barrier and a stumble can result in toppling over. Glass balustrades with frameless patch fittings must be verified from AS 1288 Table 6.1 for each glass panel's span and wind zone.",
        },
        {
          id: "st-7",
          requirement: "Balustrade structural load — 0.6 kN/m horizontal; fixings and posts engineer-checked for spans >2m",
          detail: "Balustrade top rail and posts must resist horizontal load of 0.6 kN per metre of balustrade length (AS 1170.1 Table 3.4 for residential). This is the governing load for most balustrade designs — not just serviceability. Post fixings to concrete, timber, or steel must be designed for this load and the resulting overturning moment at the base. Glass panels: structural interlayer and patch or channel fixing to be specified by glazier. For spans >2m between posts, or for balustrades over 1.5m high, engineer design is recommended.",
          reference: "NCC Vol 2 — Part 3.9.2, AS 1170.1:2002",
          asInfo: "AS 1170.1 specifies 0.6 kN/m (60 kg per metre) horizontal load on balustrades — equivalent to a crowd leaning against a guardrail. Timber balustrades with standard 90×35 top rails and 45mm dowel balusters socketed into the rail frequently fail structural testing at this load. The post base fixing creates an overturning moment — a 1000mm high post with 0.6 kN horizontal load at the top generates 0.6 kN·m at the base. This requires substantial bolted or epoxy-anchored connections, not just 2 coach screws into decking.",
        },
        {
          id: "st-8",
          requirement: "Stair treads — R10 slip resistance min; contrasting nosing strip; nosing ≤25mm overhang",
          detail: "Tread surfaces minimum slip resistance R10 (Pendulum Test wet value ≥36) per AS 4586. Contrasting (in colour or luminance) nosing strip minimum 50mm wide on each tread to assist low-vision users in identifying the tread edge. Nosing overhang maximum 25mm beyond the riser face — larger overhangs are a trip hazard. Nosing profile must not be a square sharp edge — rounded or bevelled leading edge required (maximum 5mm square edge, or 10mm bevel minimum).",
          reference: "NCC Vol 2 — Part 3.9.1, AS 4586:2013",
          asInfo: "AS 4586 Slip Resistance Classification of New Pedestrian Surface Materials specifies the R-rating (oil-wet ramp test) and PTV (pendulum test) for surfaces. R10 is the minimum acceptable for stair treads — polished timber, smooth tiles, and sealed concrete typically achieve only R9 or less when wet. Nosing contrast strips assist people with low vision to identify tread edges, which are the primary location for stair falls. A flush nosing (no overhang) is the safest profile — overhangs catch the toe of shoes when ascending.",
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
          asInfo: "AS 1668.2 Mechanical ventilation for acceptable indoor air quality sets the 25 L/s continuous / 50 L/s intermittent rates for wet areas. Bathrooms without adequate exhaust are Australia's most common source of black mould — a single 10-minute shower introduces 150–200g of moisture. Common failure modes: fan ducted into ceiling cavity (NCC non-compliant and a mould guarantee), undersized fan that meets spec at zero static pressure but delivers only 12 L/s through 5m of flexible duct, and backdraft dampers that stick open allowing cold air in during winter.",
        },
        {
          id: "cv-2",
          requirement: "Kitchen exhaust — ducted externally preferred; recirculating allowed with carbon + grease filter; duct DN150; <7 m/s",
          detail: "Kitchen exhaust: ducted externally is preferred. If recirculating rangehood used, must have both grease filter (mechanical) and activated carbon filter. External duct minimum DN150 (150mm diameter) rigid duct — avoid flexible duct for kitchens as grease accumulates in corrugations. Duct velocity should not exceed 7 m/s to minimise noise — check at actual duct size. Backdraft damper at wall penetration to prevent cold air ingress. External cowl must resist 25 Pa wind pressure.",
          reference: "NCC Vol 2 — Part 3.8.5",
          asInfo: "AS 1668.2 also covers kitchen ventilation. Grease accumulation in duct systems is a significant fire hazard — the 2019 Sutherland Shire restaurant fire was traced to a grease-blocked kitchen exhaust duct. Residential rangehood ducts should be cleaned annually. Recirculating (filterless) rangehoods are NCC non-compliant for new dwellings — they only filter smoke particles, not steam, and return warm moist air directly into the kitchen, increasing condensation loads on windows and cabinetry.",
        },
        {
          id: "cv-3",
          requirement: "Roof space ventilation — 0.2% of ceiling area each side as free area; cross-ventilation path",
          detail: "Roof space must be cross-ventilated to remove heat and moisture. Minimum free ventilation area: 0.2% of ceiling area on at least two opposite sides (e.g., 100m² ceiling requires 0.2m² = 2000cm² each side). Soffit/eave vents on opposite elevations provide cross-flow. Ensure vents are not blocked by insulation at eaves — maintain minimum 50mm air path over insulation at all eaves. In bushfire prone areas: all vents must be protected with 2mm mesh.",
          reference: "NCC Vol 2 — Part 3.8.4",
          asInfo: "Roof spaces can reach 70°C on a summer day, dramatically increasing air conditioning loads through the ceiling. The 0.2% free area rule is a minimum — high-performance homes often use 0.5% or more. Insulation at eaves blocking the vent path is the most common defect: a fully insulated eave with no airway turns a ventilated roof into an unventilated one. Inspect from inside the roof space with a torch — you should see daylight through the soffit vents at each corner.",
        },
        {
          id: "cv-4",
          requirement: "Natural ventilation — habitable rooms openable area ≥5% of floor area; OR 10 L/s mechanical",
          detail: "Each habitable room must have openable ventilation area of at least 5% of the room's floor area (e.g., 15m² room = 0.75m² openable area). Cross-ventilation is preferred and especially important in Zones 1–3. Alternatively, mechanical ventilation at minimum 10 L/s per person (not less than 10 L/s per room) from an external source. Openable area measured as the clear opening — not the frame size. Windows with security stays that limit opening to <100mm do not satisfy this requirement.",
          reference: "NCC Vol 2 — Part 3.8.4",
          asInfo: "AS 1668.2 defines acceptable indoor air quality. The 5% openable area rule ensures adequate cross-ventilation in habitable rooms — critical in Climate Zones 1–3 where passive cooling through night purge ventilation is the primary energy strategy. Security window stays that limit windows to 100mm opening in bedrooms are a common compliance fail — they prevent fire egress AND natural ventilation. Always verify the opening is the free area (e.g., louvres have only 60–70% free area relative to frame size).",
        },
        {
          id: "cv-5",
          requirement: "Subfloor ventilation — 3500mm²/m of external wall; no blocked vents; min 150mm floor to ground clearance",
          detail: "Suspended timber floors require subfloor ventilation to prevent moisture accumulation and timber decay. Minimum 3500mm² per lineal metre of external wall as free ventilation area distributed on at least two opposite sides. Vents must never be blocked — check that garden beds, cladding finishes, and insulation do not obstruct vents. Minimum 150mm clearance between the underside of the floor framing and the ground. Earth in the subfloor space must be graded to drain away from the building.",
          reference: "NCC Vol 2 — Part 3.4.1",
          asInfo: "Poor subfloor ventilation is the leading cause of timber floor failure in Australia. Unventilated subfloors allow ground moisture to saturate timber joists and bearers — once moisture content exceeds 20% fungal decay begins. The 3500mm²/m rule must be applied to actual free area (mesh-covered vents have only 50–70% free area). Garden beds built up against the house are a major defect — they block vents and raise ground level, reducing the 150mm clearance. Subfloor spaces should be inspected every 5 years for signs of moisture, timber staining, or decay.",
        },
        ...(isColdZone ? [
          {
            id: "cv-6",
            requirement: "Condensation risk — Zones 6–8: vapour permeable sarking in walls; no foil in wall cavities; dew point check",
            detail: "In Climate Zones 6–8, interstitial condensation is a significant risk. Warm moist internal air diffuses through wall insulation and can condense on the cold external face of insulation or sheathing. Use vapour permeable (breathable) sarking behind external wall cladding — not foil-faced products. Foil in wall cavities acts as a vapour barrier on the wrong side and traps moisture. For unusual or high-insulation wall systems, a dew point analysis or hygrothermal simulation (e.g., WUFI software) is recommended. Ensure continuous drainage plane from sarking to weep holes.",
            reference: "NCC 2022 — H6D6, Zone 6–8",
            asInfo: "Interstitial condensation occurs when warm moist indoor air migrates through wall insulation and encounters a cold surface — typically the back of the external cladding or the face of sarking. In Melbourne (Zone 6) this can happen on any night below ~10°C. Using foil-backed sarking in wall cavities creates a vapour barrier trap: moisture condenses on the foil and has nowhere to go, saturating the insulation and promoting mould in wall framing within 2–3 years. Breathable sarking (e.g., Enviroseal, Bradford Vapour Permeable) allows vapour to pass through to the outside while blocking liquid water ingress.",
            applicableZones: [6, 7, 8],
          },
          {
            id: "cv-7",
            requirement: "Vapour permeable roof sarking — Zones 6–8; installed before battens; lap 150mm down slope; drainage at eaves",
            detail: "In Zones 6–8, roof sarking under tiles or metal roofing must be vapour permeable (breathable type, not standard foil) to allow any moisture in the roof space to escape. Install shiny side down before battens are fixed. All horizontal laps minimum 150mm in the direction of water flow (down slope); vertical laps minimum 100mm over a batten. At eaves: turn sarking down into the fascia or gutter cavity to direct any condensation drainage to the outside rather than allowing it to drip onto ceiling insulation.",
            reference: "NCC 2022 — H6D6, Part 3.5.1",
            asInfo: "Breathable roof sarking under tiles is mandatory in Zones 6–8 (NCC 2022 H6D6). The lapping rule (150mm down-slope) is critical — condensation that forms on the underside of sarking runs down to the lap and if the lap is insufficient, drips onto ceiling insulation. A common installation defect is sarking installed with the wrong side up (non-shiny side down) — most breathable sarkings have the membrane on the top face and must be installed shiny side down to shed any condensation onto the batten above. Check the manufacturer's orientation arrow before fixing.",
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
          asInfo: "AS/NZS 3000:2018 (the Wiring Rules) mandates RCDs on all final subcircuits in new dwellings. RCDs save lives by detecting current leakage as small as 30mA — a current that causes cardiac fibrillation above 50–100mA within seconds. Pre-2009 homes often have RCDs on power circuits only, leaving lighting circuits unprotected — a deficiency in older homes. The monthly test button check is important: RCDs can fail in the tripped position (won't reset after a fault) or fail in the closed position (won't trip when there is a fault). Annual electrical safety inspections are recommended for homes over 25 years old.",
        },
        {
          id: "el-2",
          requirement: "Circuit loading — max 20A subcircuit; ≤20 socket outlets per circuit; separate circuits for fixed appliances >1kW",
          detail: "Maximum 20A for any final subcircuit. Standard socket outlet circuits: no more than 20 socket outlets per circuit as common practice (not a hard rule but industry standard). Dedicated circuits required for: electric oven/cooktop (dedicated 20A or 32A 3-phase circuit); hot water system (dedicated 20A circuit); air conditioning (dedicated circuit per unit); dishwasher and washing machine on dedicated circuits if built-in. Never connect a microwave, dishwasher, or refrigerator to the same circuit as cooking appliances.",
          reference: "AS/NZS 3000:2018 — Part 4",
          asInfo: "Circuit loading rules in AS/NZS 3000 prevent overheating of conductors. Overloaded circuits are one of the leading causes of residential electrical fires. The 20-outlet-per-circuit guideline reflects the practical maximum before the circuit breaker trips under normal use. Fixed high-draw appliances (oven, hot water, AC) on shared circuits create repeated thermal stress on conductors and connections, degrading insulation over time. A dedicated 32A three-phase circuit for a 7.2kW induction cooktop is now industry best practice even where not mandated.",
        },
        {
          id: "el-3",
          requirement: "GPO clearances in wet areas — no GPO within 300mm of water source; bathroom GPOs min 3m from shower/bath",
          detail: "Zone 0 (inside bath/shower): no electrical except SELV. Zone 1 (0–200mm above bath rim/shower base): no GPOs, only IP45-rated fixed equipment. Zone 2 (200–2250mm AFF): no GPOs within 600mm of bath/shower edge (AS/NZS 3000 Figure 6.2). In bathrooms: no general power outlet within 3m of the shower or bath measured as the shortest distance (horizontal or diagonal). Above cooking surfaces: no GPO without protection shield; minimum 150mm from any gas appliance. Shaving supply units with isolation transformer are the exception (may be closer to water).",
          reference: "AS/NZS 3000:2018 — 4.4.2, Figure 6.2",
          asInfo: "The wet area zone system in AS/NZS 3000 reflects the conductivity risk of water — a person standing in a wet shower is in direct electrical contact with earth through their feet, reducing the resistance of any shock path. Zone 0 (inside the fitting) is the highest risk — even SELV (Safe Extra Low Voltage) at 12V DC can be fatal at this zone if the person is immersed. Zone 2 restrictions (no GPO within 600mm of shower) are frequently violated during renovations when owners add shaving points or towel rail switches without checking zone diagrams. Always draw up the bathroom zone diagram before placing outlets.",
        },
        {
          id: "el-4",
          requirement: "Safety switches (RCD) — Type I on all circuits; AFDD arc-fault protection recommended; 20% spare capacity in switchboard",
          detail: "Main switchboard: minimum IP2X ingress protection rating (finger-proof enclosures). All circuits labelled clearly and permanently. Arc Fault Detection Devices (AFDD) are recommended per AS/NZS 3000:2018 — provide additional protection against electrical fires from arc faults (loose connections, damaged cable insulation). Type II SPD (surge protection device) in the main switchboard to protect against transient overvoltage. Minimum 20% spare capacity (spare circuit breaker ways) to allow for future additional circuits. RCDs on separate poles so one trip does not disable all power.",
          reference: "AS/NZS 3000:2018 — 2.10.6, 4.3",
          asInfo: "Arc Fault Detection Devices (AFDDs) detect the specific waveform signatures of arc faults — loose connections or damaged cables sparking intermittently — before they start fires. Series arc faults (a break in the active conductor) are not detected by standard RCDs or MCBs. AFDDs are already mandatory in Germany, US (AFCI required since 1999), and recommended in AS/NZS 3000:2018. Surge Protection Devices (SPDs) protect sensitive electronics — a single nearby lightning strike can generate 1–10 kV transients. SPDs clamp transients to a safe level and are consumed in the process; they should be inspected after any severe storm.",
        },
        {
          id: "el-5",
          requirement: "Underground cables — 500mm depth in garden, 300mm in concrete; conduit for protection",
          detail: "Direct-buried underground cables: minimum 500mm depth in garden beds and soft landscaped areas; minimum 300mm depth under concrete slabs or paved areas. Cables at less than 500mm depth must be protected by conduit or armoured cable. Where cables cross under paving or driveways, place in conduit with 100mm clearance above and below the pipe. Mark cable routes on as-built drawings. Install marking tape 150mm above the cable during backfill. All underground cable joints must be in accessible enclosures — no buried joints.",
          reference: "AS/NZS 3000:2018 — 3.12",
          asInfo: "Underground cable burial depth requirements in AS/NZS 3000 protect cables from physical damage during future excavation. Shallower cables in hard paving (300mm) rely on concrete protection rather than soil depth alone. The most common cause of underground cable damage is garden works — spades and rotary hoes regularly penetrate 300–400mm. Cable marking tape at 150mm above the cable warns future excavators. Marking routes on as-built drawings is essential — after 10 years, no homeowner remembers where the underground power to the shed runs.",
        },
        {
          id: "el-6",
          requirement: "EV readiness — 20A dedicated circuit to lockable enclosure near parking space; conduit from switchboard",
          detail: "NCC 2022 recommends (and some states mandate) EV charging readiness for new dwellings with a garage or dedicated car space. Install: 20A dedicated circuit from switchboard terminated in a lockable enclosure adjacent to the parking space; 32mm conduit from main switchboard to the enclosure for future cable upgrades; ensure the switchboard has capacity for a future 7.4kW (32A) EV charger circuit. In VIC: mandatory EV readiness for new Class 1 buildings from 2024. Label the circuit 'EV Charging'.",
          reference: "NCC 2022 — Advisory H6, state regulations (VIC, ACT)",
          asInfo: "EV charger readiness future-proofs the dwelling for the rapid growth in electric vehicle adoption — Australian EV sales doubled in 2023. A 7.4 kW (32A single-phase) home charger adds 30–40 km of range per hour, sufficient to fully charge a typical EV overnight. The most expensive part of EV charging installation is cable routing from the switchboard to the parking space — a conduit installed during construction costs ~$200; retrofitting cable through finished walls and ceilings can cost $1,500–$3,000. VIC Building Regulations 2018 (Amendment 2024) mandates EV readiness in all new dwellings with garages.",
        },
        {
          id: "el-7",
          requirement: "Surge protection — Type II SPD at main switchboard; protects against transient overvoltage",
          detail: "Type II Surge Protection Device (SPD) at the main switchboard as per AS/NZS 3000:2018 recommendation. Protects all downstream equipment from transient overvoltage caused by lightning or grid switching. SPD must be installed in a dedicated circuit breaker way or as a plug-in type. Let-through voltage (Up) ≤1.5 kV for Type II devices. SPD has a finite service life — must be replaced after a major surge event (indicator lamp should show status). Document installation in the switchboard schedule.",
          reference: "AS/NZS 3000:2018 — 2.10.6",
          asInfo: "Type II SPDs (also called Class C in some older standards) are designed to clamp switching transients and nearby lightning-induced surges. They are NOT designed to take a direct lightning strike — that requires a lightning protection system (AS/NZS 1768). An SPD has a finite energy absorption capacity measured in kJ — after absorbing a large surge, the MOV (metal oxide varistor) element degrades and the SPD must be replaced. SPDs with visual indicators (green/red window) allow easy status checking. Modern homes with solar inverters, EV chargers, and home automation systems have substantial electronics to protect — SPDs are increasingly cost-effective.",
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
          asInfo: "NatHERS (Nationwide House Energy Rating Scheme) uses ACCURATE, FirstRate5, or BERSPro software to model the thermal performance of the home across 8 760 hours of a typical meteorological year. Glazing area is the single biggest variable in the model — each extra square metre of unshaded west-facing glass can add 0.5–1.0 star to the required insulation rating. NatHERS modelling is required if you exceed the deemed-to-satisfy glazing limits or want to trade off insulation against high-performance glazing. A NatHERS assessor must use climate data for the nearest weather station to the project site.",
        },
        {
          id: "th-2",
          requirement: `${isHotZone ? "North glazing shaded — eaves sized for summer shade, winter sun entry" : "North glazing maximised for passive solar — 60–70% of total glazing north-facing"}`,
          detail: isHotZone
            ? "Zones 1–3: north-facing glazing shaded by eaves or pergola. Eave depth calculation: divide eave horizontal projection by the window height to get the shade factor — aim for sun exclusion between 10am and 3pm on the summer solstice while allowing winter sun. Fixed eaves recommended over adjustable shading for low maintenance. East and west glazing minimised — these are the hardest elevations to shade."
            : "Zones 5–8: maximise north-facing glazing for passive solar gain — ideally 60–70% of total glazing area on the north facade. Eave overhang sized to block high summer sun (≥70° altitude) while admitting low winter sun (≤40° altitude). Rule of thumb: eave projection ≈ window head height × 0.5 for Melbourne latitude. Thermal mass (concrete, masonry) on north-facing interior walls to absorb and re-radiate solar heat.",
          reference: "NCC Vol 2 — H6D4",
          asInfo: "Passive solar design principles (maximise north glazing in cold zones, shade in hot zones) have been understood since the 1970s but are still frequently ignored. A north-facing room in Melbourne with appropriate glazing and eaves can reduce heating bills by 30–50% compared to an equivalent room with no solar access. The critical number is the 'cut-off angle' — the sun altitude at noon on the summer solstice (in Melbourne: ~73°) vs winter solstice (~29°). An eave overhang designed to exclude the 73° summer sun will automatically admit the 29° winter sun — the geometry is self-solving if you calculate the projection correctly.",
        },
        {
          id: "th-3",
          requirement: "Safety glazing — AS 1288 required in all doors, sidelights to 1500mm AFF, and stairwells",
          detail: "Safety glazing (toughened or laminated) required by AS 1288 in: all glass doors and panels adjacent to doors; sidelights with any part below 1500mm AFF; glass in or adjacent to stairways; glass where impact is foreseeable (shower screens — toughened only; floor-to-ceiling panels). Toughened glass must be marked with the AS/NZS 4667 kite mark. Laminated glass is also acceptable. Wired glass is NOT acceptable as safety glazing in residential applications. Glazier must provide a certificate of compliance.",
          reference: "NCC Vol 2 — Part 3.6.4, AS 1288:2006",
          asInfo: "AS 1288 Glass in Buildings — Selection and Installation is the primary standard for glazing safety. Impact injuries from glass occur at the rate of approximately 20 000 hospitalisations per year in Australia — most involving clear glass in doors and low sidelights that is visually indistinguishable from an opening. Toughened glass breaks into small cubes rather than large shards, dramatically reducing laceration severity. The kite mark (AS/NZS 4667 quality mark etched into the corner of the glass) is the only site-verifiable proof of compliance — always check for it during inspection before frames are installed.",
        },
        {
          id: "th-4",
          requirement: "External wall thermal mass — lightweight preferred Zones 1–3 for night purge; heavyweight Zones 5–8 for heat storage",
          detail: isHotZone
            ? "Zones 1–3: lightweight construction (timber frame with lightweight cladding) allows building to cool rapidly overnight by ventilation (night purge strategy). Heavy masonry walls in hot climates absorb heat during the day and re-radiate it at night, increasing cooling loads. If masonry is used, ensure night ventilation can purge the stored heat."
            : "Zones 5–8: thermal mass (concrete slab, masonry walls) on north-facing interior surfaces absorbs solar energy during the day and releases it at night, reducing heating demand. Minimum 75mm concrete or 110mm brick/block. Mass must be on the inside face of insulation — insulated on the outside (reverse brick veneer) performs poorly.",
          reference: "NCC Vol 2 — H6D3",
          asInfo: "Thermal mass works by absorbing heat energy during periods of warmth (day or solar gain) and releasing it slowly at night. Effective thermal mass must be: (1) in direct sunlight or in an air-circulated zone from the solar room, (2) inside the insulation layer — not outside. Reverse brick veneer (insulation outside the brick) actually works better than standard brick veneer (insulation inside the cavity, brick on the outside) because the brick is inside and stores heat. Concrete slabs on the ground are the most cost-effective thermal mass — they are already required by AS 2870 and cost nothing extra to exploit for thermal performance.",
        },
        {
          id: "th-5",
          requirement: "Window installation — WERS rating label; flashing all sides; backer rod + sealant at frame perimeter",
          detail: "Windows must have Window Energy Rating Scheme (WERS) label matching the specified U-value and SHGC. Installation: jamb, head, and sill flashing to manufacturer's specification — 80% of water ingress in buildings occurs at window and door openings. Head flashing: concealed under cladding with upturned legs; sill flashing: sloped to drain forward; jamb flashing: wrap into rough opening. Frame-to-wall junction: flexible foam backer rod at perimeter gap, then paintable sealant. Check flashing before wall wrap or cladding installation.",
          reference: "NCC Vol 2 — Part 3.6, AS 2047:2014",
          asInfo: "AS 2047 Windows in Buildings covers performance requirements and installation. WERS (Window Energy Rating Scheme) uses star ratings (1–10 stars) for heating and cooling performance, based on U-value (heat loss rate) and SHGC (solar heat gain coefficient). For Melbourne (Zone 6): high U-value (>2.5) windows lose significant heating; choose double-glazed with U ≤ 2.0. For Brisbane (Zone 2): low SHGC (<0.4) windows block solar heat; choose tinted or low-e glazing. Window-to-wall junction is the single most common source of water ingress in buildings — the ABCB estimates 80% of all building defect claims involve water ingress at penetrations. Head flashing is the most critical element: it must be tucked under the wall wrap and slope toward the outside.",
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
  details?: string[];
}

const RULE_CATEGORIES = [
  "All","Structural","Electrical","Plumbing","Fire Safety",
  "Waterproofing","Energy Efficiency","Accessibility","Glazing & Windows",
  "Roofing","Mechanical & Ventilation","Gas","Hydraulic","Thermal",
];

const RULES_DB: RuleEntry[] = [
  // ── RESIDENTIAL ──────────────────────────────────────────────────────────
  { id:"r1",  buildingType:"residential", category:"Structural",      rule:"Timber framing — non-cyclonic",        requirement:"All timber framing must comply with span tables, species, grade and fixing requirements",   nccRef:"NCC Vol 2 — Part 3.4",      asRef:"AS 1684.2:2021",       asTitle:"Residential timber-framed construction (non-cyclonic)",               notes:"Stud sizing: 90×35 MGP10 at 600mm ctrs (walls ≤2.7m, N1/N2); 90×45 MGP10 at 600mm ctrs (≤3.0m, N1/N2); reduce to 450mm ctrs OR upgrade to 90×45 for N3/N4; engineer or manufacturer tables for N5/N6. Lintels: 2/90×45 LVL F17 for openings ≤1.8m; size from tables 1.8–3.6m; engineer beyond 3.6m. Noggins: 35×70mm at max 1350mm vert spacing. All timber must carry stress grade stamp on delivery — reject unmarked timber." },
  { id:"r2",  buildingType:"residential", category:"Structural",      rule:"Timber framing — cyclonic areas",      requirement:"Cyclonic regions require enhanced tie-down, bracing and connection details",                  nccRef:"NCC Vol 2 — Part 3.4",      asRef:"AS 1684.3:2021",       asTitle:"Residential timber-framed construction (cyclonic areas)",             notes:"Required in Qld/WA/NT coastal areas — additional strapping, connections and wind classifications C1–C4 apply." },
  { id:"r3",  buildingType:"residential", category:"Structural",      rule:"Steel light gauge framing",            requirement:"Cold-formed steel framing for residential must comply with design and connection rules",       nccRef:"NCC Vol 2 — Part 3.4",      asRef:"AS 4600:2018",         asTitle:"Cold-formed steel structures",                                        notes:"Used for steel stud walls and trusses — connection screws, track and stud sizes must match design." },
  { id:"r4",  buildingType:"residential", category:"Structural",      rule:"Residential footings & slabs",         requirement:"Site classification (A/S/M/H/E/P) determines footing type and dimensions",                    nccRef:"NCC Vol 2 — Part 3.2.2",    asRef:"AS 2870:2011",         asTitle:"Residential slabs and footings — design and construction",            notes:"Site class → minimum footing: Class A/S = standard 100mm slab with 200mm edge beam; Class M = stiffened raft per AS 2870 Table 4.1 (300mm edge beams, 200–250mm internal beams at 4m ctrs); Class H1/H2 = heavily reinforced raft (400mm edge beams, engineer design); Class E = engineer design mandatory; Class P (fill) = geotechnical report + engineer. Edge beam depth: 200mm non-reactive, 300mm reactive sites. Always obtain a geotech report — never classify visually." },
  { id:"r5",  buildingType:"residential", category:"Structural",      rule:"Wind loads for housing",               requirement:"Wind region and terrain category determine design actions on structure and cladding",          nccRef:"NCC Vol 2 — Part 3.10.1",   asRef:"AS 4055:2012",         asTitle:"Wind loads for housing",                                              notes:"Wind class implications for timber framing: N1 (design wind 34 m/s) — standard span tables, 90×35 studs; N2 (40 m/s) — standard span tables; N3 (50 m/s) — 450mm stud ctrs or 90×45, increased tie-down; N4 (61 m/s) — significant upgrade, engineer tie-down; N5/N6 — full engineer design. Cyclonic: C1 = N3 equivalent, C2 = N4, C3 = N5, C4 — full engineer. Classification from postcode + terrain + shielding per AS 4055. Document classification on drawings — incorrect class voids insurance." },
  { id:"r6",  buildingType:"residential", category:"Structural",      rule:"Masonry walls",                        requirement:"Brick/block walls must meet stability, bond, coursing and control joint requirements",         nccRef:"NCC Vol 2 — Part 3.3",      asRef:"AS 3700:2018",         asTitle:"Masonry structures",                                                  notes:"Unreinforced brick veneer: max wall height 3.0m unsupported, max panel length 6m between control joints. Cavity brick: min 50mm cavity, wall ties at 600mm vert × 900mm horiz (or 600mm horiz in N3+ zones). Mortar: M3 (1:1:6 cement:lime:sand) internal; M4 (1:0.5:4.5) external and below DPC. Lintel bearing min 100mm each end on masonry. Control joints at max 6m (movement joint with compressible filler and sealant — never fill with mortar). Height-to-thickness ratio ≤18:1 for unreinforced walls." },
  { id:"r7",  buildingType:"residential", category:"Structural",      rule:"Termite management",                   requirement:"Physical or chemical termite barrier required in all new Class 1 buildings",                  nccRef:"NCC Vol 2 — Part 3.1.3",    asRef:"AS 3660.1:2014",       asTitle:"Termite management — new building work",                              notes:"Install barrier before slab pour or at base of wall framing. Inspector must sign off on installation." },
  { id:"r8",  buildingType:"residential", category:"Waterproofing",   rule:"Wet area waterproofing",               requirement:"Shower, bath, laundry floor and adjacent walls fully waterproofed to AS 3740",               nccRef:"NCC Vol 2 — Part 3.8.1",    asRef:"AS 3740:2021",         asTitle:"Waterproofing of domestic wet areas",                                 notes:"Shower walls: membrane height 1800mm AFF or 50mm above rose (higher applies). Floor fall: min 1:60 (17mm/m) to waste. Hob height: min 25mm. Bathroom floor without shower: 150mm upstand at all walls, fall 1:80. Balcony/deck: AS 4654.2, 150mm upstand, 1:80 fall. Membrane thickness: liquid-applied min 1.0mm DFT (2-coat system); sheet membrane per manufacturer. Cure time before tiling: typically 24–48h per coat. Certifier inspection MUST occur before tiling — photograph completed membrane before tiles go down." },
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
  { id:"r24", buildingType:"residential", category:"Accessibility",   rule:"Design for access",                   requirement:"Access and mobility requirements for door widths, circulation, ramps and fittings",           nccRef:"NCC 2022 — H9",             asRef:"AS 1428.1:2009",       asTitle:"Design for access and mobility — general requirements for new building work", notes:"Class 1a/1b (NCC 2022 H9 Livable Housing from Oct 2023): 870mm nominal door → 820mm clear opening (the rebate reduces a standard 820mm door to ~780mm clear — use 870mm door leaf); all entry-level habitable rooms; corridor min 1000mm clear; step-free threshold ≤5mm lip; grab rail backing noggins 600–900mm AFF in bathroom walls; GPO/switches at 600–1200mm AFF; parking bay min 3200mm wide (2400 + 800mm access zone). Class 2: as above + 1500mm turning circle in accessible toilet. Class 3–9 (commercial): full AS 1428.1 compliance — 850mm clear door, passing bays every 20m, accessible toilet with 1800mm turning circle." },
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
  { id:"as1",  asNumber:"AS 1684.2:2021",       title:"Residential timber-framed construction (non-cyclonic)",          scope:"Prescriptive standard for the design and construction of timber-framed residential buildings in non-cyclonic areas. Covers span tables, stress grades, connections and bracing.", keywords:["timber","framing","stud","joist","rafter","bearer","wall frame","roof frame","residential","bracing","tie-down"], buildingType:"residential", category:"Structural",      nccLink:"NCC Vol 2 — Part 3.4",      practicalNote:"Use span tables directly — confirm species and stress grade stamped on timber before use.", details:["Span tables in AS 1684.2 cover every member type — studs, bearers, joists, rafters, lintels, ceiling joists and bracing walls — based on species group, stress grade, spacing and load width.","Minimum stress grade for wall studs is MGP10; rafters spanning more than 3.6m require MGP12 or LVL.","Birdsmouth cuts in rafters must not exceed 1/3 of the rafter depth — a deeper cut at the plate bearing point critically reduces the net section capacity.","All timber must carry a legible stress grade stamp (e.g. MGP10) on delivery — never accept or use unmarked timber in any structural position.","Bracing units must be calculated for wind classification, wall height and roof area, then distributed equally in both longitudinal and transverse wall directions with no single unbraced run exceeding 4m."] },
  { id:"as2",  asNumber:"AS 1684.3:2021",       title:"Residential timber-framed construction (cyclonic areas)",        scope:"As per AS 1684.2 but with enhanced requirements for wind regions C and D — cyclonic areas of Australia. Mandatory in coastal QLD, WA and NT above certain wind classifications.", keywords:["timber","cyclone","cyclonic","wind region C","wind region D","framing","tropical","queensland","northern territory","western australia"], buildingType:"residential", category:"Structural", nccLink:"NCC Vol 2 — Part 3.4", practicalNote:"Check wind classification first — C1 to C4 triggers AS 1684.3 requirements.", details:["Applies to wind Regions C and D — coastal QLD north of Bundaberg, WA Pilbara/Kimberley, NT Darwin and surrounding areas classified C1 to C4.","Tie-down requirements are significantly higher than non-cyclonic — hurricane straps (H2.5 minimum rating) are required at every rafter/truss-to-wall plate connection.","Fixing schedules for wall bracing, bottom plates and cladding all use reduced spacings compared to non-cyclonic AS 1684.2 equivalents.","Every connector must have a current load certificate from the manufacturer confirming rated capacity equals or exceeds the design uplift for the specific wind classification.","Engineer review is mandatory for all custom frame configurations, openings exceeding span table limits, and any element where the standard tables cannot be directly applied."] },
  { id:"as3",  asNumber:"AS 2870:2011",         title:"Residential slabs and footings — design and construction",       scope:"Site classification system (A, S, M, H1, H2, E, P) and footing design rules for reactive soils. Includes reinforced concrete slabs, strip footings and stump footings.", keywords:["slab","footing","foundation","reactive","soil","site classification","concrete","strip","ground","subsoil","pad"], buildingType:"residential", category:"Structural", nccLink:"NCC Vol 2 — Part 3.2.2", practicalNote:"Always get a soil report and site classification before selecting footing type.", details:["Site classification determines footing design: Class A and S use standard slabs; Class M and H1 require stiffened raft slabs with deeper perimeter beams; Class H2, E and P require engineer-designed solutions.","The site classification must be based on a geotechnical assessment — visual inspection of soil type is not acceptable for classifying reactive sites.","Edge beam depth requirements prevent seasonal soil moisture variation from reaching the underside of the slab — too shallow an edge beam on reactive soil is the primary cause of corner cracking and door frame distortion.","Fill sites (Class P) require compaction testing to 95% standard compaction before footing construction — uncompacted fill will settle differentially under load.","Subsoil drainage systems may be required on sloping or high-water-table sites to reduce soil suction variability beneath the slab."] },
  { id:"as4",  asNumber:"AS 4055:2012",         title:"Wind loads for housing",                                         scope:"Simplified method for determining wind classification (N1–N6, C1–C4) for housing, and the resultant design pressures for structural components and cladding.", keywords:["wind","housing","N1","N2","N3","N4","N5","N6","C1","C2","C3","C4","classification","pressure","cladding"], buildingType:"residential", category:"Structural", nccLink:"NCC Vol 2 — Part 3.10.1", practicalNote:"Confirm wind classification with local council or use AS 4055 tables for terrain, shielding and region.", details:["Wind classification is determined by wind region (from postcode), terrain category (1 = open sea, 4 = dense urban), shielding category, and topographic factors for hill/ridge/escarpment exposure.","Non-cyclonic classifications N1 through N6 cover most of Australia inland and southern states; cyclonic C1 through C4 apply to identified coastal regions.","Wind classification directly controls the required fixing capacity for tie-down straps, bracing walls, roof cladding fasteners, and window/door frames.","Using a lower wind classification than is required for the site is a serious structural defect that voids home warranty insurance and can result in structural failure.","In windy coastal or elevated sites, the shielding category can be the most sensitive variable — loss of a single large upwind building can increase design wind speed significantly."] },
  { id:"as5",  asNumber:"AS 3660.1:2014",       title:"Termite management — new building work",                         scope:"Requirements for physical and chemical termite management systems in new construction. Covers perimeter chemical treatment, physical barriers, steel mesh, graded granite and plastic sheeting.", keywords:["termite","white ant","barrier","chemical","physical","pest","infestation","protection"], buildingType:"residential", category:"Structural", nccLink:"NCC Vol 2 — Part 3.1.3", practicalNote:"Install before slab pour for best protection. Issue compliance certificate and lodge with council.", details:["Physical barriers (stainless steel mesh with aperture ≤1mm, graded crushed granite 6–10mm particle size, or proprietary composite systems) must cover the complete building perimeter including all pipe, conduit and structural penetrations.","Chemical soil treatment uses registered pesticides applied by a licensed operator; certificates of installation and treatment records must be lodged with the building authority and retained in the building file.","Inspect the termite management system before concrete is poured for the slab — once covered, the barrier cannot be verified without destructive investigation.","Physical barriers come with a manufacturer warranty (typically 25–50 years) that is voided if any part of the perimeter is breached by unlicensed modifications.","Annual inspections by a licensed timber pest inspector are recommended even when a compliant barrier is installed, as termites can exploit construction damage or settlement cracks."] },
  { id:"as6",  asNumber:"AS 3740:2021",         title:"Waterproofing of domestic wet areas",                            scope:"Requirements for waterproofing in showers, bathrooms, ensuites, laundries and balconies. Specifies membrane types, heights, falls and substrate preparation.", keywords:["waterproofing","wet area","shower","bathroom","membrane","tanking","grout","tiles","laundry","ensuite","balcony"], buildingType:"residential", category:"Waterproofing", nccLink:"NCC Vol 2 — Part 3.8.1", practicalNote:"Apply membrane on dry substrate. Cure before tiling. Inspector must sign off before tile installation.", details:["Shower floors must slope to the waste outlet at minimum 1:60 fall; the membrane must extend a minimum 150mm up all walls from the floor and 1500mm up the shower wall above hob level (or full height if no hob).","The substrate must be dry, dust-free and fully cured before membrane application — any moisture trapped beneath a membrane causes blistering, adhesion failure and eventual water ingress.","All junctions between walls, between wall and floor, and around penetrations (pipes, waste outlets) are the highest-risk locations and must be reinforced with bond-breaker and fabric tape before the membrane coat.","The membrane must achieve the AS 3740 water test (plug and fill to 25mm depth for 24 hours) before any tiles are installed — this test is the waterproofer's guarantee of a watertight system.","Grout joints in wet area tiling do not provide waterproofing — the membrane beneath is the sole waterproofing element; cracked grout allows water through but the membrane below should prevent substrate saturation."] },
  { id:"as7",  asNumber:"AS 4654.2:2012",       title:"Waterproofing membranes for external above-ground use — design", scope:"Selection and design of waterproof membranes for external above-ground applications including balconies, decks, planter boxes and rooftop areas.", keywords:["membrane","balcony","deck","external","above ground","roof","planter","terrace","waterproof"], buildingType:"both", category:"Waterproofing", nccLink:"NCC Vol 2 — Part 3.8.1", practicalNote:"Match membrane to substrate. Upstand 150mm min at walls. Fall to outlet min 1:80.", details:["Membrane selection must consider substrate movement — flexible polyurethane or modified bitumen membranes are required for balconies and decks where thermal expansion creates large cyclical deflections.","Upstands at walls, columns and penetrations must be a minimum 150mm above the finished waterproof surface to prevent water from tracking behind or over the membrane under ponding or splash conditions.","The minimum drainage fall for external waterproofed surfaces is 1:80 to outlets; steeper falls (1:60) are preferred for large balconies and rooftop areas where outlet blockage is a risk.","All screws and fasteners penetrating the waterproof substrate must be sealed with compatible liquid membrane or plugged with a compatible sealant rated for the expected movement.","Membranes on trafficable surfaces (balconies, rooftop terraces) require a protection course (screed, pavers on pedestals, or membrane-specific tiles) to prevent mechanical damage from furniture, foot traffic and UV degradation."] },
  { id:"as8",  asNumber:"AS 3786:2014",         title:"Smoke alarms using scattered light, transmitted light or ionization", scope:"Performance requirements for smoke alarms. Specifies sensing technology, alarm characteristics, power supply and interconnection. Referenced by NCC for mandatory smoke alarm installation.", keywords:["smoke alarm","detector","fire","interconnected","hardwired","battery","bedroom","escape"], buildingType:"both", category:"Fire Safety", nccLink:"NCC Vol 2 — Part 3.7.2", practicalNote:"Test monthly. Replace unit every 10 years. Check interconnection works — one alarm triggers all.", details:["Smoke alarms must be installed in every bedroom, in hallways between bedrooms and living areas, and on each storey of a multi-storey dwelling — requirements vary slightly by state so always check local legislation as well as NCC.","Interconnected smoke alarms are mandatory in new Class 1 buildings — when any alarm activates, all alarms in the dwelling sound simultaneously to give occupants maximum warning time.","Hardwired alarms with battery backup are required in new construction and major renovations; battery-only alarms are limited to additions and alterations in many states.","Ionisation and photoelectric technologies respond differently to slow-burning versus flaming fires — photoelectric (optical scatter) type is preferred and mandated in several states for better performance on smouldering fires.","Smoke alarms have a 10-year service life from manufacture date (not installation date) — check the manufacture date on the unit and replace the entire unit at end of service life, not just the battery."] },
  { id:"as9",  asNumber:"AS 3959:2018",         title:"Construction of buildings in bushfire-prone areas",              scope:"Construction requirements for buildings on sites with a determined Bushfire Attack Level (BAL). Covers materials, glazing, vents, decks, gutters and attachment details.", keywords:["bushfire","BAL","ember","attack level","fire zone","bush","defensible space","cladding","vent","gutter"], buildingType:"residential", category:"Fire Safety", nccLink:"NCC Vol 2 — Part 3.7.4", practicalNote:"Higher BAL requires progressively more ember protection, glazing upgrade and non-combustible cladding.", details:["BAL level is determined by a site-specific assessment accounting for vegetation type, slope, distance from vegetation, and the local Fire Danger Index — it must be performed by an accredited assessor.","BAL-12.5 requires basic ember protection to vents and sub-floor openings; BAL-29 adds requirements for non-combustible eaves lining and ember-resistant windows; BAL-40 requires fully ember-proof vents, toughened glazing and non-combustible cladding on all external faces.","BAL-FZ (Flame Zone) requires full fire engineering — standard compliant construction is not sufficient and a fire engineer must demonstrate the building can withstand direct flame impingement.","Decks and verandahs at BAL-29 and above must use non-combustible materials or be constructed from hardwood species with sufficient fire resistance — standard treated pine decking fails at BAL-29.","Gutters must be metal and screened with ember guards at BAL-12.5 and above — leaf-filled plastic gutters are a primary ignition source in ember attacks."] },
  { id:"as10", asNumber:"AS/NZS 3000:2018",     title:"Wiring rules — electrical installations",                        scope:"The fundamental standard for all electrical wiring work in Australia and New Zealand. Covers design, materials, installation methods, testing and inspection for low voltage installations.", keywords:["electrical","wiring","circuit","switchboard","RCD","safety switch","power point","GPO","lighting","cable","conduit","earthing"], buildingType:"both", category:"Electrical", nccLink:"NCC Vol 2 — Part 3.11 / Vol 1 — F3", practicalNote:"Licensed electrician only. All work tested and certified. Certificate of electrical safety (CES) issued.", details:["All electrical work must be performed by a licensed electrician — in Australia, even low-voltage work such as replacing a power outlet requires a licensed person to do the work and issue a Certificate of Electrical Safety (CES).","Residual Current Devices (RCDs / safety switches) must protect all power outlet circuits and lighting circuits in new residential construction — a minimum of two RCDs in the switchboard is required.","Each circuit must be correctly rated — cable sizes, circuit breaker ratings and RCD ratings must be matched to the calculated load and cable run length, not just a generic standard.","All wiring must be installed in a manner that avoids mechanical damage risk — cables in walls must be in conduit or behind a protective zone, and cables penetrating fire-rated walls must be firestopped.","Final testing and commissioning includes insulation resistance testing, polarity verification, RCD trip time testing and loop impedance measurement — these results must be recorded on the Certificate of Electrical Safety."] },
  { id:"as11", asNumber:"AS/NZS 3500.1:2021",   title:"Plumbing and drainage — water services",                         scope:"Requirements for the design and installation of water supply systems including pipework, fittings, valves, pressure limiting and backflow prevention.", keywords:["water","supply","pipe","pressure","plumbing","cold water","hot water","backflow","copper","PEX","CPVC"], buildingType:"both", category:"Plumbing", nccLink:"NCC Vol 3", practicalNote:"Pressure test at 1.5× working pressure before covering. All fittings WaterMark certified.", details:["All tapware, valves, pipes and fittings used in water supply installations must carry the WaterMark certification mark — uncertified components cannot legally be installed and are not covered by warranty.","Pressure limiting valves (PLVs) set to 500 kPa maximum must be installed where water pressure exceeds that limit — high pressure causes premature failure of appliances and is a leading cause of water hammer damage.","Backflow prevention devices are required wherever there is a risk of contaminated water being drawn back into the potable supply — at irrigation systems, hot water systems, and any dual-supply connection.","Copper, CPVC and PEX-A pipes are the most common approved materials; all joints and transitions must use compatible fittings rated for the pipe material and operating pressure.","A hydrostatic pressure test at 1.5 times the design working pressure for a minimum 30 minutes is required before any pipework is concealed in walls, floors or ceilings."] },
  { id:"as12", asNumber:"AS/NZS 3500.2:2021",   title:"Plumbing and drainage — sanitary plumbing and drainage",        scope:"Installation requirements for sanitary drainage including pipe sizing, gradients, trap depths, vent pipe sizing and inspection opening locations.", keywords:["drainage","sewer","sanitary","trap","vent","fall","gradient","drain","toilet","basin","bath","shower waste"], buildingType:"both", category:"Plumbing", nccLink:"NCC Vol 3", practicalNote:"Min 1:40 fall. Vent every trap or use AAV in concealed locations. CCTV inspection before backfill.", details:["Minimum pipe fall for sanitary drains is 1:40 (25mm per metre) for 100mm diameter pipe — steeper falls are acceptable and self-cleansing, shallower falls cause solids to settle and block the drain.","Every plumbing fixture must be fitted with a trap (minimum 75mm water seal depth) to prevent sewer gases entering the building — the trap seal must be maintained at all times.","Vent pipes prevent trap siphonage by equalising air pressure — every trap must be vented either by a direct vent pipe or an approved air admittance valve (AAV) in concealed locations.","Inspection openings (IOs) must be installed at every change of direction greater than 45°, at intervals not exceeding 12m in straight runs, and at the junction of every branch connection to allow future cleaning access.","CCTV camera inspection of the drain run from building to boundary before backfilling is increasingly required by councils and is strongly recommended practice — it verifies correct fall, no deflected joints and no root intrusion at junctions."] },
  { id:"as13", asNumber:"AS/NZS 3500.3:2018",   title:"Plumbing and drainage — stormwater drainage",                   scope:"Requirements for stormwater drainage systems including pit sizing, pipe sizing, discharge points and connection to legal points of discharge.", keywords:["stormwater","rainwater","roof","gutter","downpipe","pit","drainage","overflow","runoff","rain"], buildingType:"both", category:"Plumbing", nccLink:"NCC Vol 3", practicalNote:"Size system to local rainfall intensity (ARI 20-year for residential). Separate from sewer always.", details:["Stormwater systems must be sized using the local rainfall intensity data for the applicable average recurrence interval (ARI) — residential: typically 20-year ARI; commercial: 100-year ARI depending on council requirements.","Stormwater must never be connected to the sanitary sewer — cross-connections are illegal, can overload treatment plants, and in reverse-flow conditions can cause sewage back-up into the building.","Roof drainage capacity must account for the full catchment area at the design rainfall intensity — undersized gutters and downpipes cause roof overflow and water ingress into walls and sub-floor areas.","Detention basins or rainwater tanks may be required by council to manage increased runoff from impervious surfaces — check engineering requirements at DA stage before finalising site layout.","All underground stormwater pipes must be bedded in clean gravel or sand, not fill containing rubble or organic matter, to prevent point loads causing deflection and joint separation over time."] },
  { id:"as14", asNumber:"AS/NZS 3500.4:2018",   title:"Plumbing and drainage — heated water services",                 scope:"Requirements for hot water systems including storage temperature, tempering valves, solar and heat pump systems, relief valves and pressure management.", keywords:["hot water","HWS","tempering valve","solar","heat pump","storage","temperature","legionella","relief valve"], buildingType:"both", category:"Plumbing", nccLink:"NCC Vol 3", practicalNote:"Store at 60°C min. Temper to 50°C max at outlets. TPR valve to drain externally.", details:["Hot water storage systems must maintain stored water at a minimum of 60°C to prevent Legionella bacteria growth — thermostats set lower than 60°C to save energy create a public health risk.","Tempering valves (thermostatic mixing valves) must be installed to deliver mixed hot water at 50°C maximum at all outlets in residential bathrooms — 45°C maximum for aged care and early childhood facilities.","Temperature and Pressure Relief (TPR) valves are mandatory on all hot water storage systems and must discharge to a tundish or drain visible to the occupant — never cap a TPR valve.","Solar and heat pump hot water systems must still be capable of reaching 60°C boost temperature during the boost cycle — check controller settings have not been set to 'eco' mode that bypasses this requirement.","Heat pump hot water systems must have adequate ventilation around the unit and must not be installed in frost-prone locations without a frost protection kit — operating outside design ambient temperature ranges causes compressor failure."] },
  { id:"as15", asNumber:"AS/NZS 5601.1:2013",   title:"Gas installations — general installations",                      scope:"Requirements for the design, installation, commissioning and testing of natural gas and LPG installations in domestic and commercial premises.", keywords:["gas","LPG","natural gas","appliance","burner","cooktop","heater","boiler","regulator","pipe","meter"], buildingType:"both", category:"Gas", nccLink:"NCC Vol 3", practicalNote:"Pressure test at 1.5 kPa. Ventilation mandatory for all gas appliances. Licensed gasfitter only.", details:["All gas installation work must be performed by a licensed gasfitter — the work must be tested and a Certificate of Compliance (state-specific name) issued and provided to the owner before connection to the gas supply.","Every gas appliance requires adequate ventilation — natural gas combustion consumes oxygen and produces carbon dioxide and water vapour; room volume and vent opening area must meet the standard's ventilation requirements.","Pressure testing at 1.5 kPa above normal operating pressure using a calibrated manometer is required on all new gas installations — the test must be held for a minimum period to confirm no pressure drop indicating a leak.","Flexible gas connectors (pigtails) at appliance connections must be rated for the appliance gas type, must not be kinked, and must be replaced every 10 years or at appliance replacement — old braided metal connectors can develop invisible stress cracking.","LPG cylinders and regulators must be positioned in accordance with AS/NZS 1596 — minimum distances from ignition sources, windows, doors and drains must be maintained, and cylinders must not be stored in enclosed spaces."] },
  { id:"as16", asNumber:"AS/NZS 4859.1:2018",   title:"Materials for the thermal insulation of buildings",              scope:"Performance and labelling requirements for insulation products including bulk and reflective insulation. Defines how to calculate and declare R-values.", keywords:["insulation","R-value","thermal","batts","blanket","reflective","bulk","ceiling","wall","floor","energy","NatHERS"], buildingType:"both", category:"Energy Efficiency", nccLink:"NCC Vol 2 — H6D3", practicalNote:"Check R-value label before installation. Gaps > 2% of area can halve effectiveness — install carefully.", details:["The R-value marked on an insulation product is the minimum total thermal resistance of the product as installed — gaps, compression and damage during installation reduce the effective R-value, sometimes by 50% or more.","Ceiling insulation must fill the full rafter depth without compression; batts that are too thick and compressed against the ceiling membrane perform significantly worse than their marked R-value.","Reflective insulation (foil) adds R-value only when there is a still air gap of at least 25mm between the reflective surface and the adjacent material — foil pressed against framing or glass wool adds no reflective benefit.","All insulation products must carry the Australasian Energy Rating (AER) or equivalent accreditation and the marked R-value must be independently tested and certified per AS/NZS 4859.1.","Wall insulation batts must exactly match the stud spacing width and stud depth — batts that are too narrow leave thermal bridges at stud locations, and batts too thin for the stud depth leave an air gap that reduces effectiveness."] },
  { id:"as17", asNumber:"AS 1288:2006",         title:"Glass in buildings — selection and installation",                scope:"Selection, installation and glazing requirements for glass in buildings. Covers human impact safety, wind loads, and installation of different glass types.", keywords:["glass","glazing","window","safety glass","toughened","laminated","impact","door","sidelight","shower screen"], buildingType:"both", category:"Glazing & Windows", nccLink:"NCC Vol 2 — Part 3.6", practicalNote:"Safety glass required at human impact zones. Permanent etch or sticker marking mandatory.", details:["Human impact safety glass (toughened or laminated) is required in all critical locations: fully glazed doors, sidelights within 300mm of a door edge, glazing within 500mm of the floor, shower screens, bath screens and balustrades.","Toughened safety glass must be marked with a permanent mark (etching or ceramic-fired label) from the manufacturer — surface stick-on labels are not acceptable and may indicate non-compliant glass.","Wind load design for glazing must be verified for the actual panel size, aspect ratio, glass type and thickness — manufacturers provide tables or software to check compliance for any given site wind speed.","Wired glass is NOT safety glass — it is a fire-resistant product only and is NOT compliant for human impact safety locations despite its appearance of strength.","Glass installed in balustrades must be designed as a structural element to resist the horizontal balustrade load of 0.6 kN/m (1.5 kN/m for public areas) — standard window glass panels are NOT suitable for balustrade use without engineering certification."] },
  { id:"as18", asNumber:"AS 2047:2014",         title:"Windows in buildings — selection and installation",              scope:"Performance classification and installation requirements for windows and external glazed doors. Covers structural, water and air infiltration performance levels.", keywords:["window","door","frame","aluminium","timber","uPVC","flashing","sill","head","jamb","weather","draught"], buildingType:"both", category:"Glazing & Windows", nccLink:"NCC Vol 2 — Part 3.6", practicalNote:"Flash windows correctly — most water ingress occurs at window/wall junction. WERS label for energy rating.", details:["Windows must be selected with a performance classification (structural P1–P5, water W1–W4, air infiltration A1–A3) matching the wind speed and exposure of the building — coastal and elevated sites often require P4 or P5 structural rating.","The correct flashing sequence at the window head is critical — the head flashing must be installed over the outer face of the frame before cladding is fixed; reversing this order traps water behind the flashing.","Sill flashing must be installed at the bottom of every window opening with an upward kick and end dams to direct any penetrating water to the outside face of the wall — a flat sill allows water to track back into the wall cavity.","Window frames must be fixed to the building structure, not just to cladding or sheeting — all manufacturers specify minimum frame fixing requirements that must be followed for the wind classification at the site.","The WERS (Window Energy Rating Scheme) label on a window indicates its thermal performance (heating star rating and cooling star rating) — NCC energy efficiency requirements specify minimum SHGC (solar heat gain coefficient) and U-value for each climate zone."] },
  { id:"as19", asNumber:"AS 4586:2013",         title:"Slip resistance classification of new pedestrian surface materials", scope:"Test methods and classification of slip resistance for floor and stair surfaces. Classes P1–P5 for pedestrian areas, R9–R13 for industrial.", keywords:["slip","resistance","tiles","floor","wet","bathroom","ramp","stairs","external","path","pendulum test"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 2 — Part 3.8", practicalNote:"Get slip resistance classification from tile supplier. Wet residential: Class C (P4). External paths: Class D/E.", details:["Slip resistance is classified using the wet pendulum test (Classes A–D for pedestrian areas) and the oil-wet inclometer test (Classes R9–R13 for industrial); residential wet areas require a minimum of Class C (P4 wet pendulum).","External paths, pool surrounds and step nosings exposed to rain or wet footwear require Class D or Class E — standard smooth tiles or polished concrete do not meet this requirement when wet.","Slip resistance classification is the responsibility of the tile or flooring supplier — always request the test certificate showing the specific product's classification before specifying or ordering.","Surface texture and grout joint pattern both contribute to slip resistance — a fine-grained surface texture with tight grout joints may test lower than the same tile with wider sanded joints.","Ongoing maintenance affects slip resistance — coatings, waxes and cleaning residues can significantly reduce the friction coefficient of a previously compliant surface; specify only maintenance products compatible with the surface's slip resistance requirements."] },
  { id:"as20", asNumber:"AS 1428.1:2009",       title:"Design for access and mobility — general requirements",          scope:"Requirements for accessible building design including ramps, doorways, passages, parking, toilets and fittings for people with disabilities.", keywords:["accessibility","access","disability","wheelchair","ramp","door width","DDA","toilet","accessible","mobility","lever handle"], buildingType:"both", category:"Accessibility", nccLink:"NCC Vol 2 — H9 / Vol 1 — D3", practicalNote:"820mm clear door opening minimum. 1000mm unobstructed path. Accessible toilets require turning circle.", details:["A minimum clear door opening width of 820mm is required for accessible doorways — this is the clear width between the door stop and the face of the open door, not the nominal door width.","Continuous accessible paths of travel must maintain a minimum unobstructed width of 1000mm — where paths pass through gateways, alongside furniture or below stair soffits, the 1000mm clearance must be maintained.","Accessible toilets require a 1800mm diameter turning circle clear of all fixtures and fittings to allow a wheelchair user to manoeuvre and transfer — this drives the minimum room size for compliant accessible toilets.","Ramp gradients for accessible paths are limited to 1:14 maximum (1:20 preferred) with a maximum rise of 3.3m between landings; steeper ramps require handrails and edge protection.","Lever-type or electronically operated door hardware is required on accessible routes — round knobs and twist handles are not accessible to people with limited hand function and cannot be specified on accessible paths."] },
  { id:"as21", asNumber:"AS 3700:2018",         title:"Masonry structures",                                             scope:"Design and construction of unreinforced, reinforced and prestressed masonry including brick, block and stone. Covers bond, mortar, control joints and structural stability.", keywords:["masonry","brick","block","mortar","bond","wall","retaining","veneer","cavity","control joint","besser","column"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 2 — Part 3.3 / Vol 1 — B1", practicalNote:"Control joints at max 6m. Mortar type M3 or M4 for exposure. Ties at 600×900mm spacing.", details:["Mortar mix type must match the exposure environment: M3 general purpose mortar for sheltered internal masonry; M4 for external exposed masonry; special mixes required for retaining walls, marine environments and sulphate-bearing soils.","Vertical control joints must be provided at maximum 6m centres in unreinforced masonry and at all major changes of section — omitting control joints results in cracking from thermal expansion and moisture movement, not structural failure.","Wall ties connecting brick veneer to a structural backing frame must be installed at maximum 600mm horizontal and 900mm vertical centres — increasing these spacings reduces the tie density below the minimum needed to resist lateral wind pressure.","The mortar bed must be full and flush — unfilled joints and pocket-point mortar are not compliant; incomplete bed joints reduce the compressive and shear capacity of the wall and allow water penetration.","Masonry veneer construction requires a cavity between the brick skin and the backing frame; this cavity must be kept clear of mortar droppings (snot) that bridge the cavity and create damp pathways from the outer skin to the inner frame."] },
  { id:"as22", asNumber:"AS 3600:2018",         title:"Concrete structures",                                            scope:"Design standard for reinforced and prestressed concrete structures. Covers strength, serviceability, durability, fire resistance and construction requirements.", keywords:["concrete","reinforced","reo","rebar","slab","beam","column","footing","structural","formwork","cover","strength"], buildingType:"commercial", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Cover to reinforcement: 25mm internal, 40mm external, 65mm slab-on-ground. Concrete strength to drawings.", details:["Concrete cover to reinforcement must be specified on drawings and enforced on site — minimum 25mm for internal protected elements, 40mm for external exposed surfaces, and 65mm for slabs-on-ground or buried elements.","Concrete compressive strength (f'c in MPa) must be specified by the structural engineer for each element — using a lower strength concrete than specified reduces the load capacity and durability of the element.","Reinforcement placement must be checked before concrete is poured — bar size, spacing, lapping length (typically 40 bar diameters), cover blocks and ties must all comply with the structural drawings.","Concrete must be placed and compacted in lifts not exceeding 600mm to avoid honeycombing — internal vibration must cover the full depth of each lift and reach into the previous lift.","Curing is critical for concrete strength development — freshly placed concrete must be kept moist and protected from direct sun and wind for a minimum of 7 days; inadequate curing reduces surface hardness and long-term durability."] },
  { id:"as23", asNumber:"AS 4100:2020",         title:"Steel structures",                                              scope:"Design of structural steel members and connections. Covers beams, columns, bracing, bolted and welded connections, and stability requirements.", keywords:["steel","structural steel","beam","column","connection","weld","bolt","bracing","portal frame","gusset","rhs","ub","uc"], buildingType:"commercial", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Connection design critical — specify bolt grade (8.8), weld category and electrode type. ITP for fabrication.", details:["Structural steel connections (bolted or welded) must be designed by a structural engineer and detailed on shop drawings that are approved before fabrication begins — connection design is often the critical load path element.","Bolts in structural connections must be the specified grade (typically Grade 8.8 for structural connections) and must be installed and tensioned to the specified method — snug-tight versus fully tensioned pretension have very different performance.","Welding must be performed by certified welders using specified electrode types and weld categories — weld quality must be verified by non-destructive testing (visual, ultrasonic or radiographic) per the project specification.","Steel sections must be protected from corrosion — minimum protection class is C2 for internal protected environments and C4 or C5 for coastal and industrial exposures; the protection system must be specified by the engineer.","Steel framing must be braced during erection against buckling and lateral instability before permanent connections and bracing are complete — temporary erection bracing is a safety and structural integrity requirement during construction."] },
  { id:"as24", asNumber:"AS 1170.2:2021",       title:"Structural design actions — wind actions",                       scope:"Determination of design wind speeds and wind pressures for structural design of buildings and structures. Supersedes the previous 2011 edition.", keywords:["wind","pressure","structural","facade","cladding","roof","commercial","actions","region","terrain","shielding"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Wind region maps changed in 2021 — check latest version applies to your project.", details:["Design wind speed is determined from the region wind speed map (Region A through D), modified by terrain category, shielding and topographic factors — all four factors must be correctly evaluated for each building face.","Wind pressure varies over the building surface — roof uplifts are highest at corners and ridges; wall suctions are highest at the leeward face; these must be calculated separately for each structural element.","The 2021 edition updated the wind region maps — sites near the boundary between regions (particularly near tropical cyclone boundaries) may have changed classification from earlier editions; verify the current applicable region.","Cladding design wind pressures (local pressures) are significantly higher than the overall structural pressures and must be used when designing the fixings for individual cladding panels, flashings and roof sheeting.","Dynamic effects (buffeting, vortex shedding, flutter) become significant for slender or flexible structures and may require specialist wind engineering analysis beyond the scope of the code's static pressure method."] },
  { id:"as25", asNumber:"AS 1170.4:2007",       title:"Structural design actions — earthquake actions in Australia",    scope:"Seismic hazard assessment and structural design requirements for buildings subject to earthquake actions. Provides hazard factor Z and design spectra.", keywords:["earthquake","seismic","zone","hazard","structural","ductility","importance","foundation","dynamic"], buildingType:"commercial", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Most Australian buildings low seismicity. Importance Level 3/4 (hospitals, emergency) apply stricter ductility.", details:["Australia's seismic hazard is generally low by world standards, but moderate seismic hazard zones exist in areas of SA, WA, and parts of Victoria — check the hazard factor Z map for the specific site location.","Buildings classified as Importance Level 3 or 4 (hospitals, schools, emergency services, large public assembly) require more stringent seismic design even in low-hazard zones.","For most Class 1 residential buildings in low-hazard zones, earthquake design is automatically satisfied by compliance with wind bracing requirements — formal seismic analysis is not required.","Foundation soils greatly affect seismic response — soft soils amplify ground motion; a geotechnical assessment of the site subsoil class (Ae to Ee) is required for engineered structures in moderate hazard zones.","Masonry structures, unreinforced concrete and brittle materials are particularly vulnerable in earthquake events — reinforced masonry and reinforced concrete with ductile detailing are preferred for structures in seismic regions."] },
  { id:"as26", asNumber:"AS 2118.1:2017",       title:"Automatic fire sprinkler systems — standard systems",            scope:"Design, installation, commissioning and maintenance of automatic fire sprinkler systems in Class 2–9 buildings.", keywords:["sprinkler","fire suppression","wet pipe","dry pipe","heads","hydraulic","pump","tank","riser","commercial"], buildingType:"commercial", category:"Fire Safety", nccLink:"NCC Vol 1 — E1", practicalNote:"Hydraulic calculations by licensed hydraulic engineer. Commissioning test with certifier present.", details:["Hydraulic design of the sprinkler system must be performed by a licensed hydraulic engineer using the pressure and flow data for the site's water supply — undersized supply pressure is the most common cause of installation delays.","Sprinkler head selection must account for ceiling height, occupancy hazard, and obstructions — incorrect head selection (upright vs pendant vs sidewall) or incorrect K-factor can result in a non-functional system.","All sprinkler pipework, heads and components must be installed in strict accordance with the approved hydraulic drawings — any deviation requires a variation and re-calculation before proceeding.","Commissioning includes a full water flow test at design pressure, inspector's test valve verification, and alarm check — a representative of the fire authority or accredited certifier must be present.","Annual maintenance and 5-yearly flow tests are mandatory under AS 1851 — the property owner or body corporate is responsible for ongoing maintenance costs after installation."] },
  { id:"as27", asNumber:"AS 1670.1:2018",       title:"Fire detection, warning, control and intercom — system design",  scope:"Design requirements for automatic fire detection and alarm systems including detector selection, zone layout, FACP requirements and cabling.", keywords:["fire alarm","detector","smoke","heat","FACP","panel","zone","sounder","strobe","detection","warning","commercial"], buildingType:"commercial", category:"Fire Safety", nccLink:"NCC Vol 1 — E1", practicalNote:"System integrated with BAS and mechanical for smoke mode operation. Annual service certification required.", details:["Fire detector type selection must be matched to the hazard: ionisation or photoelectric smoke detectors for general areas; heat detectors for kitchens and areas with steam or dust; beam detectors for large open spaces.","Zone layout must ensure that each detector zone can be isolated separately for testing and maintenance without disabling a large area of the building's fire detection coverage.","The FACP (Fire Alarm Control Panel) must be located in an accessible position, typically near the main entrance, with a clear zone plan displayed — emergency services must be able to rapidly identify the zone of alarm.","All cabling in fire detection systems must be fire-rated (typically FP200 or equivalent) to maintain system operability during a fire event — standard PVC cables are not acceptable for life safety systems.","Integration with mechanical building services (smoke control, HVAC shutdown, lift recall) must be tested under simulated fire conditions before the certificate of occupancy is issued."] },
  { id:"as28", asNumber:"AS 2293.1:2018",       title:"Emergency escape lighting and exit signs",                       scope:"Requirements for emergency lighting systems providing illumination for safe evacuation. Covers design, installation, testing and documentation.", keywords:["emergency lighting","exit sign","egress","evacuation","escape","battery","lux","maintained","non-maintained"], buildingType:"commercial", category:"Electrical", nccLink:"NCC Vol 1 — E4", practicalNote:"Maintained or non-maintained type per NCC. 90-minute duration test every 3 years. Monthly function test.", details:["Emergency lighting must provide a minimum illuminance of 1 lux at floor level along the full length of the escape path — this is a minimum; higher illuminance is required at changes of direction and hazardous locations.","Maintained emergency luminaires are always illuminated (functioning as normal light fittings) and switch to battery power on mains failure; non-maintained types only activate on mains failure — NCC specifies which type applies to each area.","Exit signs must be visible from any point along the path of travel they serve — signs must be internally illuminated or have integral emergency power and must be legible from a minimum of 25m distance.","The battery backup system must sustain full illumination for a minimum 90 minutes — this is tested every 3 years by a full discharge test under load; monthly function tests are also required.","All emergency lighting and exit signage must be recorded in a system log with details of monthly and annual tests, any faults found, and remediation — this log must be available for inspection at all times."] },
  { id:"as29", asNumber:"AS 1668.2:2012",       title:"Ventilation and airconditioning — ventilation design for indoor air contaminant control", scope:"Minimum ventilation rates and design requirements for HVAC systems to control indoor air quality in commercial buildings.", keywords:["ventilation","HVAC","fresh air","exhaust","supply","air quality","carbon dioxide","CO2","mechanical","airconditioning"], buildingType:"commercial", category:"Mechanical & Ventilation", nccLink:"NCC Vol 1 — F4", practicalNote:"Min 10 L/s/person fresh air. CO2 setpoint typically 800–1000 ppm for DCV control.", details:["Minimum outdoor air supply rates are 10 litres per second per person for occupied spaces and must be maintained under all operating modes including energy recovery — reducing outdoor air to save energy is not compliant unless demand-controlled ventilation (DCV) with CO2 sensing is used.","Supply air must be distributed throughout the occupied zone without creating draughts — a maximum supply air velocity of 0.25 m/s at 1.1m above floor in the occupied zone is the comfort criterion.","Exhaust rates in wet areas, kitchens and carparks must meet the higher of the odour/contamination control rates and the minimum ventilation rates — kitchen exhaust systems must capture grease and must not discharge into the base building return air.","Mechanical ventilation systems must be balanced — supply and return/exhaust flows must be within 10% of design to prevent positive or negative building pressure that causes door operation problems and uncontrolled air infiltration.","Systems must be commissioned and an air balance report issued before occupation — commissioning verifies that all air quantities, temperatures and pressures are within design tolerances at the specified design conditions."] },
  { id:"as30", asNumber:"AS 1562.1:2018",       title:"Design and installation of sheet roof and wall cladding — metal", scope:"Requirements for the design and installation of profiled metal sheet cladding on roofs and walls. Covers fixings, laps, sealing, drainage and flashings.", keywords:["metal roof","colorbond","sheet","cladding","fastener","lap","flashing","corrugated","profiled","purlin","gutter"], buildingType:"both", category:"Roofing", nccLink:"NCC Vol 2 — Part 3.5", practicalNote:"Fastener pull-out capacity must exceed calculated wind uplift. Use manufacturer-tested fixing spacing.", details:["Fastener pull-out capacity must exceed the calculated wind uplift force per fastener — spacing is determined by manufacturer-tested values for the specific sheet profile, fastener type and substrate material (purlin or batten).","End laps in roof sheeting must be a minimum of 150mm (one corrugation depth) with sealant tape between the sheets to prevent capillary water ingress — too short a lap allows wind-driven rain to enter at the overlap.","Flashing details at ridges, hips, valleys, penetrations and wall abutments must be specifically designed for the sheet profile being used — generic flashings from the hardware store are not always compatible with proprietary profiles.","Anti-condensation blanket or vapour control layer must be installed under metal roofing in occupied buildings to prevent condensation forming on the underside of the sheeting and dripping as 'internal rain' on ceilings.","In coastal environments (within 1km of breaking surf or salt-spray areas), all metal components including fasteners, clips and flashings must be of a corrosion-resistant grade — standard zinc-coated steel fastenings corrode rapidly in marine environments."] },
  { id:"as31", asNumber:"AS 1905.1:2005",       title:"Components for the protection of openings in fire-resistant walls — fire-resistant doorsets", scope:"Performance requirements for fire-resistant door assemblies. Covers testing, marking, installation and maintenance of fire doors.", keywords:["fire door","FRL","fire resistant","doorset","self-closing","smoke seal","intumescent","hinges","rated"], buildingType:"both", category:"Fire Safety", nccLink:"NCC Vol 1 — C3 / Vol 2 — 3.7", practicalNote:"Never wedge open. Self-closer must function. Smoke seals intact. Label must be visible and legible.", details:["Fire doors must be installed exactly as tested — door leaf, frame, hardware and seals must all match the certification documentation; substituting any component with an untested alternative invalidates the fire rating.","Self-closing mechanisms must be calibrated to ensure the door closes fully and latches from any open position — a door that closes but does not latch provides no fire or smoke containment.","Intumescent seals around the door perimeter expand when heated to seal the gap between door leaf and frame — damaged or missing intumescent seals allow smoke and heat to pass through well before the door fails structurally.","Fire door hardware including hinges, latches and closers must be certified for use in fire doors — standard residential hardware does not have the temperature resistance required and will fail in fire conditions.","Fire doors must never be wedged open, have their closers disabled, or have any modification made that prevents full closure — this is a life safety violation and can result in prosecution of the building owner or body corporate."] },
  { id:"as32", asNumber:"AS 1720.1:2010",       title:"Timber structures — design methods",                             scope:"Design methods for structural timber members and connections in commercial and industrial buildings. Used for glulam, LVL and solid timber structures.", keywords:["timber structure","glulam","LVL","laminated","structural timber","commercial","mass timber","CLT","connection"], buildingType:"commercial", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Mass timber increasingly used in commercial — engineer design required for all connections and systems.", details:["Structural timber design for commercial applications requires a registered engineer — span tables from residential standards (AS 1684) are not applicable to commercial structures with higher imposed loads or longer spans.","LVL, glulam and cross-laminated timber (CLT) are all covered under AS 1720.1 and its referenced standards — connection design for mass timber is critical and must account for creep, moisture effects and splitting at fixings.","All structural timber in commercial buildings must be assessed for fire resistance using the charring rate method or by using proprietary fire-tested systems — mass timber can achieve required fire ratings through sacrificial char depth.","Durability must be considered when specifying timber species and treatment for external exposure — H2 treatment for in-ground protected, H3 for exposed above-ground, H4 or H5 for ground contact; the treatment must match the hazard class.","Connections in mass timber structures must accommodate moisture movement — timber shrinks and swells with moisture content changes, and rigid connections that restrain this movement cause splitting; slotted holes and proprietary connectors are commonly required."] },
  { id:"as33", asNumber:"AS 1768:2007",         title:"Lightning protection",                                           scope:"Risk assessment and design requirements for external lightning protection systems for structures. Covers air termination, down conductors and earth termination networks.", keywords:["lightning","surge","protection","earthing","conductor","rod","mesh","tall","isolated","structure"], buildingType:"commercial", category:"Electrical", nccLink:"NCC Vol 1 — F3", practicalNote:"Risk assessment determines if system required. Bond all metallic services to same earth reference.", details:["A risk assessment to AS 1768 determines whether a lightning protection system is required — factors include building height, occupancy type, location, frequency of thunderstorm activity (keraunic level) and value of contents.","The air termination network (copper or aluminium rods or mesh) must cover all high points of the structure and must be capable of capturing a direct strike from any angle — omitting a ridge or parapet point creates an unprotected zone.","Down conductors must provide the shortest possible path from the air termination to the earth termination network — conductors must not be looped or coiled, and must not pass through metallic conduit that could create a counter-EMF.","The earth termination network must achieve a resistance to earth of less than 10 ohms — multiple earth electrodes may be required in high-resistivity soils to achieve this value.","All metallic services entering the building (water, gas, electrical) must be bonded to the lightning protection earth at the point of entry to prevent dangerous potential differences during a lightning strike."] },
  { id:"as34", asNumber:"AS 1428.4.1:2009",     title:"Design for access and mobility — tactile ground surface indicators", scope:"Requirements for tactile hazard indicators and directional indicators used to assist people with vision impairment navigate built environments.", keywords:["tactile","TGSI","vision impairment","blind","indicator","path","hazard","directional","strip","dome"], buildingType:"commercial", category:"Accessibility", nccLink:"NCC Vol 1 — D3", practicalNote:"30% LRV contrast from surrounding surface. Install at stairs, ramps, platform edges and crossings.", details:["Tactile hazard indicators (truncated domes in a square grid pattern) must be installed at the top of stairs, at ramp heads, at platform edges and at any change in level — they warn a person with vision impairment of an approaching hazard.","Tactile directional indicators (parallel bars in the direction of travel) guide a person with vision impairment along a safe path of travel — they are installed in areas of complex navigation such as large open concourses and interchanges.","A minimum 30% Luminance Reflectance Value (LRV) contrast must exist between the tactile indicator surface and the surrounding floor surface — high contrast makes indicators visible to people with low vision even in poor lighting.","Tactile indicators must be fixed firmly and flush with the surrounding surface — proud-standing or loose indicators create a trip hazard and must be replaced immediately on detection of movement.","In heritage buildings, alternative compliance solutions may be permitted where installation of standard tactile indicators would damage significant fabric — consult the heritage authority before specifying non-standard tactile systems."] },
  { id:"as35", asNumber:"AS 2049:2018",         title:"Roof tiles — selection and installation",                        scope:"Requirements for the selection and installation of concrete and terracotta roof tiles. Covers battens, bedding, pointing, ridge and hip tile fixing.", keywords:["roof tile","terracotta","concrete tile","batten","bedding","pointing","ridge","hip","mortar","tile"], buildingType:"residential", category:"Roofing", nccLink:"NCC Vol 2 — Part 3.5", practicalNote:"In cyclonic areas, mechanically fix every tile. Ridge and hip mortar must be polymer-modified.", details:["Roof battens must be sized per the batten span table in AS 2049 for the tile weight, batten spacing and wind classification — standard 38x38mm battens are only suitable for light concrete tiles in low-wind areas; heavier tiles or higher wind classes require larger battens.","Bed mortar at ridges and hips must be a polymer-modified mortar mix to resist drying shrinkage cracking — standard sand-cement mortar without polymer additive cracks rapidly and allows water ingress at ridge points.","In cyclonic regions (C1–C4), every individual roof tile must be mechanically fixed to the batten with a clip or screw — mortar bedding alone is not sufficient to resist design uplift pressures at C1 and above.","Valley tiles must be correctly lapped and sealed; the minimum head lap for interlocking tiles is determined by roof pitch — below the minimum pitch, water can back up under tiles during heavy rain, particularly in low-slope sections near parapets.","All ridge and hip mortar must be pointed (finished flush) with a flexible pointing compound over the full length — unpointed or cracked mortar is the most common cause of roof leak callbacks in tiled roofs."] },
  { id:"as36", asNumber:"AS/NZS 3012:2019",     title:"Electrical installations — construction and demolition sites",   scope:"Requirements for temporary electrical installations on construction and demolition sites including RCD protection, inspections and isolation.", keywords:["construction site","temporary","electrical","RCD","leads","tools","site","power","builder"], buildingType:"both", category:"Electrical", nccLink:"AS/NZS 3000:2018", practicalNote:"All portable tools and leads on site need RCD protection. Inspect before use daily. Leads max 25m.", details:["All portable electrical equipment and extension leads used on construction sites must be protected by a Residual Current Device (RCD) with a trip current of 30 mA or less — either a plug-in portable RCD or a switchboard-mounted RCD is acceptable.","Extension leads must be inspected before each use — cuts to the outer sheath, damaged plugs, kinks and joins are immediate rejection criteria; leads must also be tagged and tested per AS/NZS 3760 at regular intervals.","Generators on site must be earthed and protected with an RCD — floating (unearthed) generators create a shock risk in wet conditions; all generator outputs must be individually RCD-protected.","Overhead power lines on or adjacent to the site must be identified and clearance distances maintained — AS 4020 safe work distances require 3m minimum clearance from low-voltage overhead lines without a network operator's written approval.","Temporary site electrical installations must be inspected and tested by a licensed electrician at initial installation and after any modification — the test report is part of the site safety management documentation."] },
  { id:"as37", asNumber:"AS/NZS 61439:2016",    title:"Low-voltage switchgear and controlgear assemblies",              scope:"Requirements for the design, testing and verification of LV switchboards and distribution boards used in electrical installations.", keywords:["switchboard","distribution board","MDB","DB","panel","main switch","meter","commercial","electrical"], buildingType:"commercial", category:"Electrical", nccLink:"NCC Vol 1 — F3", practicalNote:"Type test certificates from manufacturer required. As-built drawings inside every switchboard.", details:["Every low-voltage switchboard must be designed, manufactured and verified to AS/NZS 61439 — the manufacturer must provide a Declaration of Conformity listing the design verification method used (type test, calculation or assessment).","The switchboard must be rated for the prospective short-circuit current (PSCC) at the point of installation — using a board with insufficient fault rating risks catastrophic failure and fire during a short-circuit event.","All circuit breakers, RCDs, fuses and busbars must be rated for the system voltage and maximum fault current and must be from manufacturers whose products comply with the relevant product standards.","Cable entries into switchboards must be sealed to prevent entry of vermin, dust and moisture — particularly important in switchboards mounted externally or in plant rooms with water services.","As-built single-line diagrams showing all circuits, ratings, cable sizes and protective device settings must be mounted inside every switchboard — the diagrams must be updated whenever the switchboard is modified."] },
  { id:"as38", asNumber:"AS 1170.1:2002",       title:"Structural design actions — permanent, imposed and other actions", scope:"Loading requirements for structural design including dead loads, live loads, roof loads, balustrade loads and construction loads.", keywords:["load","dead load","live load","imposed","structural","balustrade","floor","roof","loading","action"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 1 — B1 / Vol 2 — Part 3.4", practicalNote:"Floor: 1.5 kPa residential, 3.0 kPa commercial. Balustrade: 0.6 kN/m horizontal.", details:["Dead loads (permanent actions) include the self-weight of all structural and non-structural elements — accurately calculating dead load is essential for foundation and structural member design.","Imposed loads (live loads) for residential floors are 1.5 kPa minimum; for commercial office floors 3.0 kPa; for public assembly areas 4.0–5.0 kPa depending on the specific use — always verify the correct occupancy category.","Balustrade design loads of 0.6 kN/m horizontal and 1.5 kPa vertical must be applied to the top rail — for public areas, the horizontal load increases to 1.5 kN/m; these are point of application loads, not averaged over the height.","Construction loads during building (formwork, concrete placement, equipment) often exceed the permanent design loads and must be considered in the temporary works design, particularly for suspended slab formwork.","Roof loads include the dead weight of the roof assembly, ceiling and services, plus imposed maintenance loads of 1.4 kPa horizontal projection — the maintenance load can be reduced for steep roofs where workers cannot safely stand."] },
  { id:"as39", asNumber:"AS 4600:2018",         title:"Cold-formed steel structures",                                   scope:"Design of structural members fabricated from cold-formed steel strip including light gauge framing, purlins, girts and sheeting rails.", keywords:["light gauge","steel stud","steel framing","cold formed","purlin","girt","rhs","cee","zee","residential steel"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 2 — Part 3.4 / Vol 1 — B1", practicalNote:"Connection screw size and spacing critical. Check corrosion class for coastal or wet environments.", details:["Cold-formed steel stud sizing must be verified using manufacturer-published span tables or AS 4600 design calculations — the section properties of each manufacturer's profile vary and must match the product used on site.","Screw fastener selection is critical — the screw must be the correct diameter, length and coating class for both the steel thickness being fastened and the exposure environment; incorrect screws corrode rapidly in wet or coastal locations.","Cold-formed steel framing in coastal environments requires corrosion protection — G300/Z350 zinc-coated steel is typically required within 1km of breaking surf; standard G250/Z275 coatings corrode within years in marine environments.","Bracing elements in cold-formed steel framing (strap bracing, sheet bracing, proprietary panels) must be fixed with the specified number and size of screws — under-fixed bracing panels lose rated capacity and can peel away under lateral load.","Thermal bridging through cold-formed steel studs significantly reduces the effective R-value of insulated wall panels — the rated insulation R-value must be corrected for steel framing using the correction factors in NCC energy provisions."] },
  { id:"as40", asNumber:"AS 1170.3:2003",       title:"Structural design actions — snow and ice actions",              scope:"Requirements for determining snow and ice loads on roofs and structures in alpine and sub-alpine areas of Australia.", keywords:["snow","ice","alpine","load","mountain","roof","structure","high altitude"], buildingType:"commercial", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Applies above ~1200m AHD. Roof slope and drainage critical. Drift loading at parapets and steps.", details:["Snow loads apply primarily to structures above approximately 1200m AHD in the Australian Alps and Snowy Mountains region — check the snow hazard map for the specific site elevation and location before applying this standard.","Roof slope is the primary determinant of the balanced snow load — flat and near-flat roofs accumulate the greatest depth; steeply pitched roofs shed snow but require avalanche guards to prevent dangerous sliding loads on lower roofs and people below.","Drift loading occurs where snow blows off a higher roof surface and accumulates against a parapet, wall or step-down in roof level — drift loads are concentrated and can be several times the balanced roof snow load, requiring local structural reinforcement.","Roof drainage must be designed to handle snowmelt — internal drains with heated electric trace cables are required in cold climates where external drainage would freeze; overflow scuppers must also be frost-protected.","Structures in snow regions must accommodate both load cases — full snow plus wind, and partial snow loading (drift on one side only) — the unbalanced case often controls lateral load on frames and trusses."] },

  // ── CONCRETE ─────────────────────────────────────────────────────────────────
  { id:"as41", asNumber:"AS 1379:2007",         title:"Specification and supply of concrete",                           scope:"Requirements for specifying, ordering and supplying concrete including mix design, workability, compressive strength, sampling and testing at point of delivery.", keywords:["concrete","mix design","MPa","compressive strength","slump","admixture","batch","ready-mix","water-cement","exposure classification"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 1 — B1 / Vol 2 — Part 3.3", practicalNote:"Specify exposure classification AND f'c AND slump. Reject any truck adding water on site. Slump test every truck on critical pours.", details:["Concrete must be ordered and accepted using AS 1379 nominated properties: minimum 28-day compressive strength (f'c in MPa), maximum water-cement ratio, minimum cement content, maximum aggregate size, and target slump in mm — specifying only MPa strength is insufficient and does not cover durability requirements.","Exposure classifications from AS 3600 determine minimum cement content and maximum water-cement ratio: Class A1 (interior above ground) requires f'c 20 MPa; Class B2 (marine spray, industrial chemical) requires f'c 40 MPa minimum with blended cement; Class C1/C2 (marine immersion, severe chemical) requires f'c 50 MPa and special mix design.","Water must never be added to a concrete truck on site to improve workability — adding water increases the water-cement ratio, directly reducing both compressive strength and durability; any load with site-added water must be rejected; use plasticiser or superplasticiser admixtures instead.","Slump tests and concrete temperature checks must be performed at point of discharge from every delivery on critical elements — reject any load where slump exceeds the specified maximum by more than 25mm, or where concrete temperature exceeds 35°C in hot weather.","Concrete must be placed within 90 minutes of water addition during batching — trucks arriving beyond this time must be rejected regardless of apparent workability; in hot weather, concrete may need ice or chilled water in the batch water to extend the working life.","Concrete compression test cylinders (minimum 2 per 50 m³ or per truck on critical elements) must be cast, cured under standard conditions, and tested at 7 and 28 days by a NATA-accredited laboratory — the 28-day result is the compliance test; a low 7-day result is an early warning to investigate mix quality.","Statistical sampling is mandatory: for large pours, results must be plotted against the characteristic strength to ensure the statistical minimum is met — even individual truck tests passing 25 MPa does not guarantee the population meets f'c = 25 MPa at the required 95th percentile."] },

  { id:"as42", asNumber:"AS 3610:2018",         title:"Formwork for concrete",                                          scope:"Design, construction, performance, inspection and stripping of formwork and falsework for concrete structures including shoring, reshoring, and load-out procedures.", keywords:["formwork","falsework","shoring","reshoring","stripping","propping","plywood","concrete pressure","suspended slab","column formwork"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 1 — B1 / Vol 2 — Part 3.3", practicalNote:"Never strip without engineer sign-off on suspended slabs. Maintain reshoring until 28-day strength achieved. Formwork pressure calculation mandatory for walls >2m pour height.", details:["Formwork must be designed to resist the full hydrostatic pressure of fresh concrete — for walls and columns, wet concrete behaves as a fluid and formwork pressure equals concrete unit weight (approximately 24 kN/m³) multiplied by pour height at slow pour rates; higher pour rates increase pressure toward full hydrostatic, which can cause formwork blowout if not accounted for.","Stripping times are governed by the concrete achieving a minimum compressive strength before support removal — for suspended slabs, stripping is not permitted until concrete reaches at least 70% of the specified 28-day strength (confirmed by test cylinder results or maturity monitoring); stripping too early is the primary cause of mid-span deflection and long-term slab sagging.","Reshoring (propping fresh slabs to transfer loads to lower levels) is mandatory when casting upper-level slabs before the structure below has achieved full design strength — the load path through the fresh slab to reshorned slabs below must be verified by an engineer; removing reshoring prematurely causes partial collapse of fresh slabs under wet concrete loads.","Plywood formwork faces must be assessed for reuse condition before each use — surface breakdown causes concrete surface defects (honeycombing, bug holes) and loss of flatness; concrete cover to reinforcement is compromised if plywood deflects more than span/270 under the wet concrete weight.","All formwork and falsework must be designed and inspected before and during concrete placement — the most common formwork failures occur when: concrete is placed eccentrically (creating overturning), lateral bracing is omitted, or floor jacks are not plumb; a competent person must inspect the entire formwork installation before placement begins.","Embedded inserts, conduits, and blockouts cast into the concrete must be shown on the formwork drawings and must be positionally tied to prevent displacement during concrete vibration — displaced conduits and blockouts are extremely expensive to rectify after the slab has set.","Strike-off (initial levelling) and floating of suspended slabs must occur before initial set — if the concrete stiffens before floating, surface shrinkage cracks cannot be closed; proper timing requires knowledge of the expected concrete set time based on mix design, temperature, and slump."] },

  { id:"as43", asNumber:"AS 3735:2001",         title:"Concrete structures for retaining liquids",                     scope:"Design requirements for reinforced and prestressed concrete structures retaining water or liquids, covering crack control, impermeability, construction joints, and testing.", keywords:["water tank","concrete tank","pool","liquid retaining","wastewater","pit","crack control","waterstop","construction joint","permeability"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"Crack width limit 0.1mm (not 0.3mm standard). Min cover 50mm water face. Waterstops at ALL construction joints. Flood test for 7 days before handover.", details:["Crack width control is the primary design criterion — the maximum allowable design crack width in water-retaining concrete is 0.1mm (compared to 0.3mm for normal structural concrete); achieving this limit requires substantially more reinforcement, closer bar spacings, and larger bar diameters than would be used in a typical structural slab or wall.","Concrete mix design must achieve low permeability: maximum water-cement ratio 0.45, minimum cement content 320 kg/m³, and use of supplementary cementitious materials (ground granulated blast furnace slag or fly ash) at 30–40% replacement is recommended to further reduce permeability and heat of hydration.","All construction joints (day joints, pour joints) are critical leak paths — each joint must be sealed with a PVC, hydrophilic or steel waterstop embedded at the joint centreline, and the joint face must be cleaned of laitance (weak surface layer) by water blasting or sand blasting before the adjacent concrete pour.","Concrete cover to reinforcement on the water-retaining face must be minimum 50mm — this exceeds the standard exposure classification cover to protect against chloride penetration that causes reinforcement corrosion, which would crack the concrete from inside and rapidly destroy the structure's water-retaining function.","A full hydraulic test (flood test) is mandatory before the structure is accepted and put into service — the structure is filled to the design maximum water level and monitored: an acceptable result is less than 1/500 of the water depth drop (e.g. less than 2mm for a 1m deep structure) in the first 24 hours after stabilisation; visible leaks must be pressure-grouted and the structure retested.","Temperature effects on crack control are significant — concrete placed in hot weather has higher thermal shrinkage on cooling, which opens cracks; shading, wet hessian curing for a minimum 7 days, and pour scheduling to avoid high ambient temperatures are practical measures to reduce early thermal cracking.","Compatibility of any coatings, liners or sealants applied to the concrete surface with the stored liquid must be verified — not all concrete sealants are suitable for potable water contact; products must comply with AS/NZS 4020 testing requirements for contact with drinking water where applicable."] },

  // ── WATERPROOFING ─────────────────────────────────────────────────────────────
  { id:"as44", asNumber:"AS/NZS 4858:2004",     title:"Wet area membranes",                                            scope:"Performance classification and testing requirements for wet area waterproofing membranes used in bathrooms, laundries, showers, and balconies, covering Type A (external/immersion) and Type B (internal wet areas).", keywords:["waterproofing","membrane","wet area","bathroom","laundry","shower","tanking","liquid membrane","cementitious","flood test","bandage","primer"], buildingType:"both", category:"Waterproofing", nccLink:"NCC Vol 2 — Part 3.8.1 / Vol 1 — F1", practicalNote:"Prime all substrates before membrane. Reinforce all internal corners with bandage tape. 25mm turn-up minimum onto walls. Flood test 24 hours minimum before tiling.", details:["AS/NZS 4858 classifies wet area membranes as Type A (external, immersion, and below-ground applications — pools, basement tanking, planter boxes) or Type B (internal wet areas — bathrooms, laundries, showers); the wrong type in the wrong location leads to premature failure within months.","All substrates must be primed with the membrane manufacturer's specified primer before applying liquid membranes — primers seal porous surfaces (concrete, fibre cement, masonry), promote adhesion, and prevent substrate moisture from causing bubbling and delamination of the membrane during application.","Internal corner reinforcement is the most critical detail — membrane material alone is too thin and weak at a 90° internal corner to resist the differential movement between floor and wall; a fibreglass bandage tape or proprietary corner strip must be embedded in the first membrane coat at all floor-to-wall junctions, wall-to-wall internal corners, and penetration surrounds.","The membrane must be applied to the full floor area and turned up walls a minimum 25mm above finished tile height in wet areas (and 150mm at shower enclosures above the shower threshold) — membrane height must be verified before tiling commences; inadequate wall turn-up is the most common defect in wet area waterproofing.","A flood test (ponding test) must be performed on every wet area before tiling — the floor waste is plugged, the area is filled with water to the height of the wall turn-up, and allowed to stand for a minimum 24 hours; water level must not drop by more than 5mm during the test period; any leak must be located, repaired with compatible material, and retested before tiling proceeds.","Membrane compatibility with the tile adhesive is mandatory — not all tile adhesives bond to all membrane types; the membrane manufacturer's approved adhesive products list must be checked before specifying; some liquid membranes require a scratch coat or skim coat before adhesive application.","Minimum dry film thickness (DFT) of the cured membrane is typically 1.0–1.5mm — this is achieved by multiple coats (usually 2 or 3) with adequate drying time between coats; a wet film gauge must be used during application to verify the wet thickness; a single thin coat is not compliant even if the specified number of coats is applied."] },

  { id:"as45", asNumber:"AS 3958.1:2007",       title:"Ceramic tiles — guide to installation",                         scope:"Guide to the selection, preparation and installation of ceramic and porcelain tiles on floors and walls including substrate preparation, adhesive type, grout joints, movement joints, and wet area requirements.", keywords:["ceramic tile","porcelain","tile adhesive","grout","floor tile","wall tile","wet area","bedding","lippage","movement joint","substrate","coverage"], buildingType:"both", category:"Waterproofing", nccLink:"NCC Vol 2 — Part 3.8.1", practicalNote:"95% adhesive coverage mandatory under floor tiles in wet areas — lift a random tile within 10 min to check. Compressible movement joints at all internal corners. Never use cement grout as a movement joint filler.", details:["Minimum adhesive coverage of 95% of the tile back face area is required for all floor tiles in wet and trafficked areas — tiles with insufficient coverage have air voids behind them that collect water, cause hollow-sounding tiles, and lead to waterproofing membrane failure from hydrostatic pressure; check coverage by lifting a freshly-laid tile within 10 minutes of bedding before the adhesive skins over.","Porcelain tiles have near-zero water absorption and require polymer-modified adhesives (Type 2 per AS ISO 13007.1) — standard cement-based Type 1 adhesives do not achieve adequate bond strength to porcelain because the tile doesn't absorb water from the adhesive to promote cement hydration; non-polymer adhesive under porcelain tiles will delaminate within 1–2 years.","Substrate flatness tolerance must be achieved before tiling commences — floors must not deviate more than 3mm under a 1.8m straight edge (or 6mm under 3m for large-format tiles); out-of-flat substrates cause lippage (height difference between adjacent tile edges) which is a trip hazard and an aesthetic defect that cannot be remediated without full tile removal.","Movement joints must be installed at all internal corners, changes of plane, and at maximum 4.5m centres in the field area — movement joints use a compressible backing rod plus flexible polyurethane or silicone sealant (NOT cement grout); thermal movement and structural deflection will crack any rigid material placed in a movement joint, leading to grout cracking and tile debonding across the entire field.","Large-format tiles (600mm or larger in either dimension) require back-buttering (applying adhesive to the back of the tile as well as the substrate) to achieve the required coverage — this is because the trowel ridges in the substrate adhesive do not fully collapse to achieve 95% coverage under stiff large tiles without double-spreading.","Grout joint width must match the tile rectification tolerance — rectified porcelain tiles can be installed with 2–3mm joints; non-rectified tiles require minimum 5–6mm joints to accommodate size variation; forcing non-rectified tiles into too-small joints causes tiles to push each other and creates lippage and cracking.","Waterproofing membrane must be applied and fully cured before any tiling commences — the membrane manufacturer's minimum cure time (typically 24–48 hours for liquid membranes, 3–7 days for cementitious) must be strictly observed; tiling over uncured membrane can trap moisture and prevent full cure, leading to adhesive failure."] },

  // ── STRUCTURAL FRAMING ───────────────────────────────────────────────────────
  { id:"as46", asNumber:"AS 1684.4:2010",       title:"Residential timber-framed construction — simplified — cyclonic areas", scope:"Prescriptive design and construction requirements for timber-framed Class 1 and Class 10 buildings in cyclonic regions of Australia (Regions B, C, and D).", keywords:["cyclonic","timber framing","cyclone","tie-down","C1","C2","C3","C4","hurricane strap","Region B","North Queensland","WA coast","NT"], buildingType:"residential", category:"Structural", nccLink:"NCC Vol 2 — Part 3.4", practicalNote:"Applies to Regions B, C, D — North Queensland coast, NT, WA coast. Every rafter/truss needs H2.5 strap minimum. All fixings cyclone-rated. Verify wind region from postcode before selecting standard.", details:["AS 1684.4 applies specifically to Class 1 and Class 10 timber-framed buildings in cyclonic wind regions (ASNZS 1170.2 Regions B, C, and D) — these are coastal Queensland north of about Bundaberg, the NT coastline, and the WA coast north of about Geraldton; using AS 1684.2 (non-cyclonic) in these regions is a critical non-compliance.","Every rafter-to-wall plate and truss-to-wall plate connection in cyclonic areas requires a rated metal strap tie (minimum H2.5 hurricane strap capacity) — the strap count and fixing pattern must match the uplift load calculated for the wind classification; standard skew nailing or framing clips used in non-cyclonic areas are not adequate uplift connections.","Stud-to-plate connections, plate-to-slab connections, and roof-to-wall connections must form a complete and continuous load path from roof covering to footing — AS 1684.4 provides specific connection details and nail patterns for each level of the structure; any break in the load path is the failure point in cyclone events.","Bottom plates must be bolted to the slab with chemically anchored bolts (not cast-in coach bolts) at reduced spacing from AS 1684.2 requirements — cyclonic uplift loads are several times non-cyclonic uplift, and the bolt embedment and chemical anchor must be designed for the increased loads; standard 150mm cast-in bolts at 1800mm centres are grossly insufficient in C2+ areas.","Roof cladding and all roofing components (ridge capping, barge flashings, gutters, downpipes) must be fixed with cyclone-rated fasteners at the manufacturer's cyclone-specification fixing pattern — most metal roofing manufacturers publish separate fixing tables for cyclonic areas with reduced fastener spacing and higher-capacity fasteners.","Bracing requirements in cyclonic areas are substantially increased — the lateral load from wind on a building in Region C is 2–3 times higher than Region A; bracing wall lengths, nailing patterns, and holddown connections must all be recalculated from AS 1684.4 cyclonic tables rather than the non-cyclonic AS 1684.2 tables.","All external windows and doors in cyclonic areas (C2 and above) must be debris-impact tested or protected by shutters — ordinary residential windows will not withstand impact from wind-driven debris in a Category 4 or 5 tropical cyclone; AS 1170.2 debris-impact rated windows or cyclone shutters must be specified."] },

  { id:"as47", asNumber:"AS 4440:2004",         title:"Installation of nailplated timber roof trusses",                scope:"Requirements for the handling, storage, installation and bracing of prefabricated nailplated timber roof trusses on residential and light commercial buildings.", keywords:["roof truss","nailplate","nail plate","installation","temporary bracing","girder truss","hip","truss spacing","binder","bottom chord"], buildingType:"residential", category:"Structural", nccLink:"NCC Vol 2 — Part 3.5", practicalNote:"Never cut or notch trusses on site. Temporary bracing mandatory — trusses can topple before permanent bracing installed. Confirm girder truss bearing on trimmer stud, not just plate.", details:["Roof trusses must never be cut, notched, drilled, or modified on site without written approval and a revised design from the truss manufacturer's engineer — any site modification changes member geometry, moves nail plate positions, and voids the entire engineer's design certificate; holes for services must be pre-designed as part of the truss order.","Temporary bracing is the most critical safety requirement during truss installation — unbraced trusses standing on wall frames can topple like dominoes under their own weight or in light wind; AS 4440 specifies an installation sequence starting with anchor trusses at each end, followed by binders along the top chord before releasing the crane; this sequence must be followed without exception.","Girder trusses (heavy trusses that carry the hip frame and jack trusses at the end of a hip roof) transfer large point loads to the wall below — the girder end bearing must sit on a trimmer stud (or multiple trimmer studs) directly below the point of load application, not simply on the wall top plate; missing or under-designed trimmer studs cause top plate splitting and wall deformation.","Permanent bracing elements — bottom chord binders (longitudinal restraints), diagonal web braces, and top chord lateral restraints — must be installed exactly as specified in the truss designer's documentation before the temporary installation bracing is removed; the permanent bracing resists both lateral load and the tendency of trusses to buckle sideways under vertical loads.","Truss-to-wall plate connections must match the wind tie-down requirements specified in AS 1684.2 (or AS 1684.4 for cyclonic areas) — in N3 and above wind areas, H2.5 or stronger metal strap ties must be used at every truss to plate connection; the truss design documentation and tie-down design must both be followed and may specify additional connections at hips and girders.","Trusses must be stored and handled correctly before installation — trusses stored flat on the ground will sag and permanently deform; they must be stored upright (vertical) in a rack or in small stacks no higher than they would be in service; damaged or bowed trusses must be reported to the supplier and not installed.","Truss span, pitch, ceiling type, and roof loads used in the truss design must exactly match the actual building design — if any dimension changes after the truss order is placed (ceiling height change, span variation, roof load change), a revised truss design is required; installing trusses designed for different conditions is a structural deficiency."] },

  // ── STRUCTURAL STEEL ─────────────────────────────────────────────────────────
  { id:"as48", asNumber:"AS 1554.1:2014",       title:"Structural steel welding — welding of steel structures",         scope:"Requirements for welding structural steel in buildings and structures including weld categories (SP and GP), pre-qualification, inspection, testing and acceptance criteria.", keywords:["welding","weld","structural steel","fillet weld","butt weld","NDT","ultrasonic","welder qualification","category SP","heat affected zone","preheating"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 1 — B1", practicalNote:"All structural welds must be SP category. Inspect fillet weld size with gauge — undersized is most common defect. NDT mandatory for full-penetration butt welds in primary members.", details:["All welds in structural steel connections must be Structural Purpose (SP) category — SP welds have more stringent quality requirements (lower defect acceptance limits) than General Purpose (GP) welds; GP welds are only acceptable for non-structural connections and secondary members such as handrails and minor bracing; mixing up categories in structural joints is a serious deficiency.","Fillet weld leg size is the primary specified and inspected dimension — the weld leg must not be less than the design minimum anywhere along its length; the most common fabrication defect is undersized fillet welds in high-volume fabrication shops; a weld size gauge must be used on-site to verify leg size, and undersized welds must be built up with an additional pass before any protective coating is applied.","Full-penetration butt welds in primary structural members must be tested by non-destructive testing (NDT) — ultrasonic testing (UT) is the preferred method for steel thicker than 8mm; radiographic testing (RT) is used where visual access is limited; visual inspection alone cannot detect internal fusion defects, porosity, or lamellar tears that are the failure origins in fatigue-loaded connections.","Welder qualification is mandatory for the specific weld position and process — a welder qualified in the flat position (1G/1F) is not automatically qualified to weld in vertical (3G/3V) or overhead (4G/4F) positions; qualification records (WPS and welder test certificates) must be available on site for inspection by the certifier.","Preheat must be applied before welding any plate with a carbon equivalent value (CEV) above 0.43 or where the plate thickness exceeds 36mm — failure to preheat high-strength or thick steel causes hydrogen-assisted cold cracking (HACC) in the heat-affected zone; HACC may be invisible immediately after welding but causes brittle fracture under service loads.","Weld inspection must occur before any protective coating is applied — coating applied over non-compliant welds prevents remediation and hides defects from subsequent inspection; a hold point in the inspection and test plan (ITP) must require weld inspection sign-off before painting commences.","Welding procedure specifications (WPS) must be pre-qualified or procedure-qualified for the steel grade, thickness, position, and process used — using an unqualified WPS (e.g. welding Grade 350 steel with a WPS qualified only for Grade 250) voids the weld's compliance; pre-qualification to AS 2980 or a full qualification test program to AS 2205 series is required."] },

  { id:"as49", asNumber:"AS 2159:2009",         title:"Piling — design and installation",                              scope:"Design and installation requirements for all types of pile foundations including bored, driven, and screw piles, pile testing programs, and inspection and documentation requirements.", keywords:["piling","pile","bored pile","driven pile","screw pile","geotechnical","capacity","load testing","dynamic","static","set","blow count"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 1 — B1 / Vol 2 — Part 3.2", practicalNote:"Geotechnical engineer design mandatory. Design Basis Report required before first pile. Dynamic or static load testing as per DBR. Document every pile installation with installation records.", details:["Pile design must be based on a site-specific geotechnical investigation — the investigation must characterise all soil layers to a depth below the pile tip and report the geotechnical parameters for both end bearing capacity and shaft friction; design using published regional geotechnical assumptions without site-specific data is not acceptable for engineered structures.","A Design Basis Report (DBR) must be prepared and approved by the geotechnical engineer before pile installation commences — the DBR specifies pile type, geometry, minimum founding criteria, installation method, inspection requirements, acceptance criteria (set, torque, founding stratum), and the load testing program.","Bored pile holes must be inspected at the base before concrete placement — a qualified person must inspect the base to confirm nominal founding stratum has been reached, no loose debris or slurry is at the base (soft toe), and water ingress is within acceptable limits; cleaning tools or air-lift flushing must be used if debris is present.","Load testing is required to verify pile capacity — dynamic load testing (high-strain dynamic analysis using a Pile Driving Analyser) is required for driven piles and is commonly used for screw piles; static load testing (ML and CRP methods) is required where HSDA results are inconclusive or for high-risk/high-load piles; the DBR specifies the minimum number and type of tests.","Complete installation records must be maintained for every pile — for driven piles: blow count vs depth, final set per 10 blows, hammer type, energy and drop height; for bored piles: drilling time per 0.5m, torque readings, depth to each soil change, water strikes, and concrete volume poured vs theoretical; for screw piles: torque vs depth installation graph and final installation torque; these records are the primary QA evidence.","Concrete for bored piles must be tremie-placed in water-bearing ground — concrete must never be dropped through water in a wet bore as the concrete segregates and washes out cement, creating a pile with severely reduced capacity; tremie pipe must be maintained at least 1.5m into the concrete at all times during placement.","Pile cap construction must transfer loads to the pile in the correct manner — each pile must be embedded minimum 75mm into the pile cap (or as specified), and the main bars of the pile must be embedded into the cap by the full development length; short or unsupported bars protruding from a pile head are the most common pile cap reinforcement defect."] },

  // ── FIRE SAFETY ──────────────────────────────────────────────────────────────
  { id:"as50", asNumber:"AS 1851:2012",         title:"Maintenance of fire protection systems and equipment",           scope:"Minimum inspection, testing and maintenance requirements for all fire protection systems after installation, covering sprinklers, detection, suppression, hose reels, extinguishers, and emergency lighting.", keywords:["maintenance","fire","sprinkler","alarm","hose reel","extinguisher","inspection","testing","annual","quarterly","log book","impairment"], buildingType:"commercial", category:"Fire Safety", nccLink:"Post-occupancy — referenced by NCC building consent conditions", practicalNote:"Annual certifier inspection required. Maintain fire system log book on site at all times. Impairment notification to fire authority mandatory when system offline. Critical defects: notify within 24 hours.", details:["All fire protection systems must be maintained under a current service agreement with a provider competent in the applicable systems — AS 1851 specifies mandatory inspection frequencies by system type: automatic fire sprinkler systems require monthly visual inspections, quarterly alarm tests, and full annual flow tests; detection systems require annual inspections with all detector tests; emergency lighting requires monthly function tests and 3-yearly full-discharge tests.","A fire system log book must be kept on-site, updated after every service visit, and made available to fire authorities on request — the log book records: date and nature of service, technician name and licence number, system status after service, and any defects found with their rectification status; failure to maintain a log book is a fire safety offence.","Impairment procedures must be activated whenever a fire protection system is taken offline for planned maintenance — the building owner, fire authority, tenants, and site security must be notified before the system is isolated; a fire watch patrol (physical check of the building at defined intervals) may be required; impairments must not exceed the duration limits in AS 1851.","Defects identified during inspection are classified as Critical (the system cannot operate as intended — requires immediate rectification and potential notification to fire authority) or Non-critical (does not immediately impair system function — must be rectified within 30 days); critical defects include failed sprinkler main control valves, non-functional FACP zones, and extinguisher discharge.","Sprinkler system annual flow test must be performed by opening the inspector's test valve (ITV) and measuring flow and pressure at the most hydraulically unfavourable point — results must be compared to design hydraulic calculations to verify the system still meets minimum flow and pressure requirements; any shortfall requires investigation of mains pressure changes or system blockages.","5-year inspection programs under AS 1851 require more comprehensive testing including full internal inspection of underground pipes, actuator replacements on fire dampers, and verification of fire pump performance curves — these enhanced inspections are often missed by building owners who rely only on annual inspections.","Automatic fire sprinkler heads must be inspected visually at every service for: corrosion, paint overspray, foreign material on deflectors, heat collector covers, and proximity to stored goods; painted, corroded, or obstructed heads will not activate at their design temperature and will not distribute water correctly if they do activate."] },

  { id:"as51", asNumber:"AS 2441:2005",         title:"Installation of fire hose reels",                              scope:"Requirements for the location, design, installation, testing and commissioning of fire hose reels in buildings, including flow rates, water pressure, coverage, and access.", keywords:["hose reel","fire hose","fire fighting","installation","water pressure","coverage","commissioning","exit","range","reel cabinet"], buildingType:"both", category:"Fire Safety", nccLink:"NCC Vol 1 — E1 / Vol 2 — Part 3.7", practicalNote:"Hose must reach all parts of floor within 4m tip throw. Static pressure minimum 210 kPa at inlet. Reel adjacent to exit door where practicable. Test every reel at commissioning.", details:["Fire hose reels must be positioned so that every part of the floor area is reachable with the hose tip — the maximum range is the hose length (typically 36m) plus 4m throw, and reel positions must account for walls, partitions, and other obstacles; in large commercial floor plates, multiple reels are required and their coverage arcs must be verified on the floor plan.","Minimum static water pressure at each hose reel inlet must be 210 kPa — where mains supply pressure is insufficient, a booster pump complying with AS 2941 must be installed; low pressure is the most common cause of fire hose reel systems being classified as non-functional during fire authority inspections.","Fire hose reels must be located adjacent to exit doors wherever practicable — this positioning allows occupants to use the hose while maintaining access to an escape route; reels located in dead-end corridors or areas requiring occupants to move toward the fire rather than toward exits are non-compliant layout.","The hose reel swinging arm must allow the hose to be pulled in any direction required to service the coverage area — the mounting position and arm length must allow full 270° arc of swing; in recessed cabinet installations, the cabinet door must not restrict the hose arc and must stay open without a door stop fitting being required.","Commissioning tests for every hose reel must include: static pressure measurement at the inlet, dynamic flow test with the hose fully extended and flowing at design pressure, operating valve opening/closing without leakage, and verification of the swinging arm range of movement; all results must be recorded on a commissioning certificate.","Annual maintenance under AS 1851 requires hose reel inspection including: hose condition (no kinks, cuts, perishing), nozzle operation, valve operation, swinging arm movement, and flow test at the most hydraulically unfavourable reel — a hose that cannot be fully extended or a nozzle that seizes are critical defects requiring immediate replacement.","Hose reel cabinets must be clearly identified with a 'Fire Hose Reel' sign in the correct colour (red background, white text) and size per Australian Standards signage requirements — unlabelled or incorrectly labelled cabinets are a non-conformance and reduce effectiveness in an emergency when occupants cannot locate fire fighting equipment."] },

  { id:"as52", asNumber:"AS 1530.4:2014",       title:"Methods for fire tests on building materials — fire-resistance", scope:"Methods for determining the fire-resistance level (FRL) of building elements including walls, floors, beams, columns and doors, using full-scale furnace testing to ISO 834 temperature-time curve.", keywords:["fire resistance","FRL","fire test","furnace test","wall","floor","structural adequacy","integrity","insulation","fire rating","hour"], buildingType:"both", category:"Fire Safety", nccLink:"NCC Vol 1 — C1 / NCC Vol 2 — Part 3.7", practicalNote:"FRL expressed as 3 numbers e.g. 60/60/60 (structural adequacy/integrity/insulation in minutes). Tested systems cannot be modified without re-testing. Verify FRL certificates match actual installed product.", details:["Fire-resistance level (FRL) is expressed as three numbers in minutes: structural adequacy/integrity/insulation (e.g. 90/90/90) — structural adequacy is how long the element supports its load, integrity is how long it prevents passage of flames and hot gases, and insulation is how long before the unexposed face temperature rises to unacceptable levels; a dash (—) indicates the criterion is not applicable.","Fire-resistance testing is performed in a furnace following the standard temperature-time curve defined in ISO 834 — the curve rises to approximately 820°C at 30 minutes and 945°C at 60 minutes; the tested assembly must achieve the required performance for the specified duration; no extrapolation to longer durations is permitted from shorter test results without engineering analysis.","Fire-rated assemblies must be installed exactly as described in the fire test certificate — including wall framing species and grade, lining product, screw type and spacing, insulation type and thickness, joint tape type, and penetration sealing; any substitution of a component with a product not listed in the certificate voids the fire rating.","Where no tested system exists for the required FRL, a system may be designed using the Rational Fire Engineering approach — this requires a Fire Safety Engineer to prepare calculations demonstrating FRL compliance using material properties, thermal modelling, and structural fire analysis; the calculated approach must be approved by the certifier.","Critical FRL documentation must be provided to the building certifier before the certificate of occupancy — this includes: fire test certificates for all rated assemblies, penetration sealing certificates, fire door certificates, and a fire-rated construction register showing the FRL of every wall, floor, and ceiling in the building; incomplete documentation prevents occupation certificate issue.","Penetrations through fire-rated elements (pipes, cables, ducts, structural steel) must be sealed with a tested fire-stopping system achieving at least the FRL of the element it penetrates — AS 4072.1 covers service penetrations; unsealed penetrations completely negate the fire rating of the element and are the most common fire-rated construction deficiency found during building inspections.","Upgrade of an existing building's fire resistance requires a Fire Safety Engineer assessment to identify all fire-rated elements, confirm their current FRL, and design upgrades where the existing construction doesn't meet current NCC requirements or the new use requires higher FRL; piecemeal upgrades without an overall fire engineering assessment frequently result in incomplete protection."] },

  { id:"as53", asNumber:"AS 4072.1:2005",       title:"Components for the protection of openings in fire-resistant walls — service penetrations and control joints", scope:"Requirements for materials and systems used to seal penetrations through fire-rated walls and floors for services (pipes, cables, ducts) and to protect control joints in fire-rated construction.", keywords:["penetration","firestopping","fire stopping","pipe penetration","cable","conduit","duct","fire collar","intumescent","service penetration","control joint","fire rated"], buildingType:"both", category:"Fire Safety", nccLink:"NCC Vol 1 — C3", practicalNote:"Every penetration through a fire-rated wall or floor must be sealed with a tested system. Never seal with ordinary mortar or foam. Document all penetrations with certifier — create penetration register.", details:["Every penetration through a fire-rated wall or floor-ceiling assembly for services (pipes, cables, conduits, ducts) must be sealed with a fire-stopping system that has been tested and certified to achieve at least the FRL of the element it penetrates — bare penetrations with no sealing, or penetrations sealed with ordinary cement mortar or expanding PU foam, do not achieve any fire resistance.","Fire collar seals are required around plastic pipes (PVC, HDPE, PP) passing through fire-rated walls or floors — when a plastic pipe melts in a fire, it leaves an unsealed opening; the intumescent material in the fire collar expands when heated to close the opening and maintain the fire rating; the collar must be the correct diameter for the pipe and installed on the correct (typically fire-exposed) face.","Cable and conduit penetration seals must be selected for the number, size, and type of cables being installed — a seal certified for one 20mm conduit is not automatically certified for a 100mm conduit bundle; the seal system must be certified for the actual installation configuration and must fill the full penetration void.","Ductwork penetrating fire-rated walls and floors must have a fire damper installed at the wall or floor penetration, or the ductwork must itself be fire-rated for the required FRL using fire-rated duct, blanket wrap, or a shaft construction — unsealed or undamped ductwork is the most common fire spread path through rated construction in commercial buildings.","A penetration register (schedule of all penetrations through fire-rated elements) must be maintained as part of the building's fire safety documentation — the register records the location, penetrating service type and size, sealing system used, installer, and date; this register is required for building maintenance and future modifications to avoid inadvertently breaking sealed penetrations.","All fire-stopping products must be installed by personnel with product-specific training from the manufacturer — incorrect installation (wrong layer thickness, wrong number of intumescent layers, incorrect wrap technique) can result in a penetration that looks sealed but fails to achieve the rated FRL; manufacturers provide installation certificates that must be maintained as QA records.","Control joints in fire-rated walls (expansion and isolation joints) must be sealed with tested fire-rated backing and sealant systems — standard construction sealants have no fire-resistance properties; proprietary intumescent sealant or fire-rated mineral wool plus intumescent sealant is required to achieve the required FRL at all movement accommodation joints."] },

  // ── SAFETY / POOLS / RETAINING ───────────────────────────────────────────────
  { id:"as54", asNumber:"AS 1926.1:2012",       title:"Swimming pools — safety barriers for swimming pools",           scope:"Requirements for swimming pool safety barriers around domestic swimming pools and spas including barrier height, construction, gate design, latches, and the non-climbable zone.", keywords:["swimming pool","pool fence","barrier","gate","child safety","latch","non-climbable","isolation","pool compliance","spa","council inspection"], buildingType:"residential", category:"Structural", nccLink:"NCC Vol 2 — Part 3.9.3 / State legislation", practicalNote:"Pool must be isolated from house by barrier. Gate self-closing and self-latching from pool side. NCZ 900mm outside and 300mm inside fence. Council inspection required before filling.", details:["Pool safety barriers must be a minimum 1200mm high measured on the outside (approach side, away from the pool) — the measurement is taken at the lowest point of the barrier, including at posts where the fence panel may be lower; any ground-level gap under the barrier must not exceed 100mm.","A non-climbable zone (NCZ) of 900mm on the outside and 300mm on the inside of the fence must be maintained clear of any object that could provide a foothold — garden furniture, air conditioning units, pool equipment, retaining walls, planter boxes, and trees within the NCZ are non-compliant; the NCZ is the most frequently failed item in pool fence compliance inspections.","All pool barrier gates must be self-closing from any open position using spring-loaded hinges calibrated to close and latch the gate from 90° open position — gates that close but do not self-latch are non-compliant; the latch must be located on the pool side of the gate at minimum 1500mm above ground, or at any height in a child-resistant housing.","Where a wall of the dwelling forms part of the pool barrier, every door and window in that wall that opens into the pool area must have a compliant self-closing, self-latching device — a single unlatched window or door renders the entire barrier system non-compliant; this includes all windows, sliding doors, pet doors, and laundry doors; pet flaps must be a maximum of 120×180mm to prevent child access.","A council pool compliance inspection is required before the pool is filled with water — the inspection verifies the barrier complies with the standard and local council requirements; after passing, a pool registration certificate is issued and must be lodged with council; pools without registration face fines and invalidate property insurance for pool-related incidents.","Spas, wading pools, and hot tubs with a water depth exceeding 300mm are subject to the same barrier requirements as swimming pools — this surprises many homeowners who install portable spas without realising they trigger AS 1926.1 compliance requirements.","Pool barrier inspection must be repeated after any modification to the barrier, adjacent landscaping, or dwelling that could affect compliance — common post-construction compliance failures include: raised garden beds that reduce effective barrier height, new garden furniture placed in the NCZ, and new openings cut in the dwelling wall during renovation."] },

  { id:"as55", asNumber:"AS 4678:2002",         title:"Earth-retaining structures",                                   scope:"Design and construction requirements for all types of earth-retaining structures including masonry, concrete, timber, and proprietary retaining systems, covering loading, drainage, materials, and inspection.", keywords:["retaining wall","earth retaining","geotechnical","surcharge","drainage","footing","masonry","concrete cantilever","gravity wall","tieback","gabion","sleeper wall"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 1 — B1 / Vol 2 — Part 3.2", practicalNote:"Walls >1m retained height require engineering. Drainage behind wall is critical — without it hydrostatic pressure doubles or triples the design load. Surcharges from driveways and structures above must be included in design.", details:["Retaining walls with more than 1m of retained height require design by a structural or geotechnical engineer — walls up to 1m may follow prescriptive rules, but any surcharge loading (driveway within 2.5m, building or pool behind the wall, sloping backfill above) extends the engineering requirement to shorter walls; councils generally require a retaining wall permit for any wall exceeding 600mm or 1m (depending on jurisdiction).","Hydrostatic pressure from water build-up behind an undrained retaining wall can equal or exceed the earth pressure — a fully saturated 2m retained soil profile creates approximately 40 kPa of hydrostatic pressure at the base in addition to the earth pressure load; this can cause sudden and catastrophic wall overturning without visual warning; drainage is not optional.","A continuous drainage layer of free-draining gravel or aggregate (coarse washed river gravel, not crusher dust) of minimum 300mm thickness must be installed against the back of the retaining wall, with a perforated subsoil drain pipe at the base directing water to a free discharge point or stormwater connection above the footing.","Surcharge loads from vehicle driveways within 2.5m of the top of a retaining wall must be included in the design — this is commonly assumed as 5–10 kPa equivalent surcharge; a loaded ute or SUV parked on a gravel driveway behind a poorly drained masonry wall is sufficient to topple the wall; design must include this load.","Cantilevered concrete retaining walls must have the footing fully poured and achieve minimum specified strength before the wall is poured — concrete walls must not be backfilled until the concrete has achieved at least 70% of the 28-day design strength; early backfilling before strength gain allows the lateral soil load to crack or overturn the wall at the construction joint between footing and wall.","Proprietary retaining wall systems (Besser block, Allan block, Versa-lok, Keystone, gabion) have system-specific design tables and must be installed strictly per the manufacturer's engineering documentation — deviating from the specified batter angle, geogrid layer spacings, or block type invalidates the system's engineering certification.","Post-construction monitoring of retaining walls is recommended — particularly in the first wet season after construction; any wall movement, cracking, drainage blockage, or water seepage through weep holes must be investigated promptly; retaining wall failures occur suddenly and without warning; a wall that survived last year may fail this year if drainage has become blocked."] },

  // ── SOLAR & ENERGY ───────────────────────────────────────────────────────────
  { id:"as56", asNumber:"AS/NZS 4777.1:2016",  title:"Grid connection of energy systems via inverters — installation requirements", scope:"Requirements for the installation, connection, commissioning and documentation of energy systems connected to electricity networks via inverters, including solar PV, battery storage and wind.", keywords:["solar","PV","photovoltaic","inverter","grid connect","battery","energy storage","DNSP","network","anti-islanding","CEC","feed-in tariff"], buildingType:"both", category:"Electrical", nccLink:"NCC Vol 2 — Part 3.12 / Vol 1 — J / State metering requirements", practicalNote:"DNSP approval before connection. Inverter must be on CEC approved products list. Certificate of Electrical Safety required. Export limiting required where DNSP specifies.", details:["Before any grid-connected solar PV or battery system is connected to the network, written approval must be obtained from the local Distribution Network Service Provider (DNSP — e.g. Ausgrid, Endeavour Energy, AusNet, Western Power) — each DNSP has specific technical requirements for inverter type, maximum export power, protection settings, and anti-islanding relay parameters; proceeding without approval results in formal disconnection notices.","All inverters must be on the Clean Energy Council (CEC) Approved Products List (APL) — the APL is updated monthly and lists approved inverters by model and firmware version; older firmware versions are periodically delisted even for current hardware models; installers must verify the exact hardware and firmware version being installed matches the APL listing.","Export limiting is required in areas designated by the DNSP as having high solar penetration — a zero-export or specified maximum export limit (commonly 1.5 kW, 5 kW, or 10 kW per phase) must be implemented via inverter settings or a dedicated export limiting device; non-compliant systems cause over-voltage on the local feeder and result in disconnection.","DC wiring from the PV array to the inverter must comply with AS/NZS 5033 — specific UV-resistant, double-insulated solar cable (TUV or AS/NZS 5000.1 rated) must be used; DC cable runs must be labelled at each end and at maximum 1.8m intervals as 'DC Solar — Danger Live When Illuminated'; all DC connectors must be of the MC4 or compatible type.","Commissioning documentation required includes: a Certificate of Electrical Safety (CES) or Certificate of Compliance – Electrical Work (CCEW), a grid connection agreement with the DNSP, a system commissioning report with inverter output measurements, and a handover package to the building owner including operating instructions and warranty documentation; without these documents the system cannot be registered for government rebates or feed-in tariffs.","Battery storage systems connected to the grid must also comply with AS/NZS 4777.2 (inverter requirements) and must include appropriate protection against battery-to-grid power injection during grid outage — failure to comply with anti-islanding requirements creates a life safety risk for network workers maintaining lines during power outages.","After installation, the system must be tested at operating conditions to verify output power, inverter efficiency (spot check), and anti-islanding protection operation — the anti-islanding protection test is performed by simulating loss of mains supply and verifying the inverter ceases to export within the required disconnection time (typically 2 seconds)."] },

  { id:"as57", asNumber:"AS/NZS 5033:2021",    title:"Installation and safety requirements for photovoltaic (PV) arrays", scope:"Safety and installation requirements for the PV array (modules and DC wiring), separate from inverter and grid connection. Covers module mounting, DC wiring, earthing, protection, and maintenance.", keywords:["solar panel","PV array","photovoltaic","DC cable","mounting","module","string","combiner","earthing","rapid shutdown","roof mount","ground mount"], buildingType:"both", category:"Electrical", nccLink:"NCC Vol 2 — Part 3.12 / Vol 1 — J", practicalNote:"Solar cable must be UV-rated TUV-certified. Fusing required for multi-string parallel arrays. All metallic parts must be earthed. Lockable DC isolator at inverter — mandatory.", details:["All cable on the DC side of a PV array must be UV-resistant, double-insulated, and rated for the maximum open-circuit voltage of the string — standard PVC-insulated electrical cables are not rated for the UV exposure on a rooftop or the DC voltage of a PV string and must not be used; the cable must display the TUV certification mark or be listed to AS/NZS 5000.1 for solar duty.","PV module installation must follow the manufacturer's installation guide exactly — tilt angle range, inter-row spacing for ground arrays, mounting rail type and spacing, clamp type (mid-clamp and end-clamp), and fastener torque settings are all specified and define the wind load compliance of the roof mounting system; deviation from the manufacturer's certified installation method voids wind load compliance.","String-level overcurrent protection (fuses in a combiner box) is required whenever two or more strings are connected in parallel — without fusing, a fault in one string allows reverse current from the other strings to flow through the fault, potentially causing cable ignition; fuse ratings are calculated from the module's maximum reverse current rating and must not be exceeded.","All metallic parts of the array (module frames, mounting rails, racking, support structures) must be continuously bonded together and connected to the building's main earthing system — unearthed metallic structures in the DC array can develop dangerous potential differences relative to earth in fault conditions, creating a shock risk to maintenance personnel.","A lockable DC isolator (or array isolator) must be installed between the PV array and the inverter in an accessible, clearly labelled position — the isolator must interrupt both positive and negative DC conductors simultaneously (bipolar type) and be rated for the full DC open-circuit voltage and maximum short-circuit current of the array; this isolator is the primary means of emergency disconnection by fire services.","Roof penetrations for DC cabling must be waterproofed using a purpose-designed cable entry gland or flashing — sealing around cable penetrations with silicone or foam is not a weather-resistant long-term solution and will fail; water ingress via cable penetrations is the most common cause of ceiling damage from solar installations.","PV arrays must be assessed for maintenance access requirements — OSHA and state work health and safety regulations require that maintenance (module cleaning, inverter servicing) can be performed safely; roof-mounted systems require either permanently installed roof anchor points or specification of an alternative safe access method in the design documentation."] },

  // ── MECHANICAL & VENTILATION ─────────────────────────────────────────────────
  { id:"as58", asNumber:"AS 4254.2:2012",       title:"Ductwork for air handling and water systems in buildings — rigid ductwork", scope:"Construction and installation requirements for rigid metallic ductwork in commercial HVAC systems, covering material gauges, joints, sealing, pressure testing, support spacing, and fire damper integration.", keywords:["ductwork","HVAC","air handling","galvanised steel","duct","joint","sealing","leakage","fire damper","insulation","support","commercial"], buildingType:"commercial", category:"Mechanical & Ventilation", nccLink:"NCC Vol 1 — F4", practicalNote:"Ductwork pressure class determines gauge and seam type. Leakage test required at 1000 Pa for Class B and above. Fire dampers at every fire-rated boundary. Insulate all ducts outside conditioned space.", details:["Rigid ductwork must be constructed from the sheet gauge specified in AS 4254.2 for the applicable pressure class — Class A (low pressure, up to 500 Pa), Class B (medium pressure, up to 1000 Pa), and Class C (high pressure, up to 2000 Pa) each require increasing sheet thickness; using lighter gauge sheet in high-pressure systems causes deflection, noise, and joint failure.","All ductwork joints must be sealed with approved mastic compound (applied to both contact surfaces before assembly) or aluminium foil pressure-sensitive tape — untested or unsealed ductwork typically leaks 15–30% of the supply air volume into ceiling spaces, resulting in inadequate airflow at diffusers and HVAC systems that cannot achieve design conditions.","Leakage testing is mandatory for Class B and Class C ductwork — pressurising each section to 1000 Pa and measuring the total leakage rate must demonstrate compliance with the maximum allowable leakage rate for the duct surface area; sections that fail must have all joints re-sealed and retested; leakage test results must be recorded in the commissioning report.","Fire dampers complying with AS 1682.2 must be installed at every penetration of a fire-rated wall or floor — the damper must be installed in a fire-rated sleeve matching the fire-rated element's FRL, interlocked with the fire detection system to close on alarm, and accessible via an inspection cover in the ductwork or ceiling for resetting and maintenance.","All supply and return ductwork outside the conditioned envelope (in roof spaces, ceiling voids, plant rooms, or risers exposed to external temperature) must be insulated to the R-value specified in the NCC energy provisions — uninsulated supply ductwork in a roof space can lose 30–40% of cooling capacity through heat gain; the insulation must also include a vapour barrier on the warm side to prevent condensation.","Ductwork support must be installed at the maximum hanger spacing specified in AS 4254.2 for the duct dimension — for rectangular ductwork wider than 600mm, maximum hanger spacing is 1.2m; unsupported ductwork sags at joints, causing noise from rubbing, condensation pooling, and eventual joint failure.","Flexible ductwork connecting rigid duct to terminal units (diffusers, grilles, FCUs) must not exceed 1.5m in length and must be installed without kinks or tight bends — kinked or compressed flexible duct increases resistance and reduces airflow by 30–60%, causing terminal unit performance to fall short of design."] },

  { id:"as59", asNumber:"AS/NZS 1668.1:2015",  title:"Mechanical ventilation and air-conditioning — fire and smoke control", scope:"Requirements for mechanical HVAC systems to control smoke spread in building fires through pressurisation, smoke exhaust, HVAC shutdown, and fire mode operation.", keywords:["smoke control","HVAC","fire mode","pressurisation","smoke exhaust","stairwell","atrium","fire damper","emergency","mechanical ventilation"], buildingType:"commercial", category:"Fire Safety", nccLink:"NCC Vol 1 — E2", practicalNote:"All HVAC must go to fire mode on alarm. Stairwell pressurisation minimum 12.5 Pa differential. Full fire mode commissioning test with certifier present. Integration with BAS mandatory.", details:["All mechanical ventilation and HVAC systems in commercial buildings must be capable of operating in a defined fire mode when triggered by the fire detection and alarm system — fire mode typically involves: stopping supply air to occupied floors, reversing exhaust to maximise smoke extraction in the fire floor zone, and maintaining positive pressure in evacuation paths and stairwells.","Stairwell pressurisation systems must achieve a minimum 12.5 Pa positive pressure differential between the pressurised stairwell and the adjacent floor under the worst-case door open condition — the system is designed for a defined number of doors open simultaneously; insufficient pressurisation allows smoke to enter the evacuation stair, which is the primary cause of evacuation casualties in commercial high-rise fires.","Smoke exhaust systems for atriums, malls, shopping centres, and large open spaces must maintain a smoke-free layer at a specified height above the highest occupied floor level for the required evacuation time — the design uses computational fluid dynamics (CFD) or the prescriptive algebraic calculations in the standard, accounting for fire heat release rate, ceiling height, and atrium geometry.","All motorised fire dampers and smoke control dampers must be verified to fail-safe in the correct position on power loss — fire dampers typically fail closed to maintain compartmentation; pressurisation supply dampers may fail open to maintain stairwell pressure; smoke exhaust dampers may fail in either direction depending on design; fail-safe positions must be verified electrically and mechanically during commissioning.","A full fire mode simulation test is mandatory at commissioning, with the principal certifier and fire authority representative present — the test includes: activating the alarm system, verifying correct HVAC mode switching, measuring achieved pressure differentials at all pressurised zones, verifying smoke exhaust flow rates, and confirming all damper positions; results must be recorded in a commissioning report.","Integration with the Building Automation System (BAS) is essential — the BAS must receive fire alarm signals and override normal HVAC operation to fire mode; all interfaces between the fire alarm control panel (FACP) and the BAS must be tested to confirm the correct override occurs under all operating conditions including BAS system failure.","Ongoing maintenance of the fire mode HVAC functions requires annual testing in addition to the standard HVAC maintenance — fire mode dampers, fan speed changes, and pressure differential sensors must be exercised at each annual inspection; failure to test fire mode functions means that dampers corroded shut, or controls that have drifted out of calibration, will not be discovered until a real fire event."] },

  // ── CONSTRUCTION SAFETY ───────────────────────────────────────────────────────
  { id:"as60", asNumber:"AS 1576.1:2019",       title:"Scaffolding — general requirements",                            scope:"Requirements for the design, erection, alteration, use and dismantling of scaffolding used on construction and maintenance projects, including load capacities, ties, platforms, and edge protection.", keywords:["scaffold","scaffolding","working at height","platform","ties","tubes","couplers","erection","dismantling","HRWL","edge protection","guardrail"], buildingType:"both", category:"Structural", nccLink:"Work Health and Safety legislation / referenced by NCC Vol 2 construction requirements", practicalNote:"Scaffolding >4m requires licensed scaffolder (HRWL). Inspect before each shift. Scaffold register on site. Never load above design capacity. Edge protection mandatory at 2m+.", details:["Scaffolding exceeding 4m in height must be erected, altered, and dismantled by a scaffolder holding a current High Risk Work Licence (HRWL) in the correct scaffold class — this is a WHS Act legal requirement, not an AS 1576 recommendation; erecting scaffolding above 4m without a licensed scaffolder exposes the builder, principal contractor, and site safety officer to prosecution.","All scaffold ties to the building structure must be installed at the intervals specified in the scaffold design or AS 1576.3 prescriptive requirements — horizontal tie spacing is determined by the height of the scaffold and the wind exposure; missing ties allow the scaffold to overturn in wind, and their removal before the scaffold is being progressively dismantled is a common cause of scaffold collapse.","Working platforms must be fully planked with no gaps between adjacent boards exceeding 25mm — scaffold planks must span no more than 2.4m (or the span specified in the scaffold design for the plank cross-section), and must overlap the supporting transom by a minimum 150mm at each end to prevent tipping; underslide hooks or clips must be used where upward displacement is possible.","Edge protection (a top guardrail at 900–1100mm above platform level, an intermediate mid-rail, and a 150mm minimum height toeboard) must be installed on all open edges of every platform at 2m or more above the lower level — edge protection must be fully installed before the platform is used or loaded; it is not acceptable to use a platform without edge protection while guardrails are being installed.","A scaffold register must be maintained on site recording the scaffold design basis, maximum imposed load (typically 225 kg/m² for basic service, 450 kg/m² for medium duty), last inspection date, and signature of the competent person who conducted the inspection — inspection must occur before first use, after any modification, after any adverse weather event, and at intervals not exceeding 30 days.","Loads placed on scaffolding must not exceed the scaffold's design capacity — a single tonne pallet of bricks placed on a scaffold designed for 225 kg/m² light duty will cause immediate collapse; the maximum load and the maximum point load must be clearly displayed on the scaffold and communicated to all workers using the platform.","During dismantling, the sequence of removal is as important as the erection sequence — all ties must be maintained until the scaffold is dismantled to that level; removing ties prematurely to allow facade work below causes the upper scaffold to become unrestrained and can initiate collapse; the dismantling sequence must be specified in the scaffold design or the AS 1576.3 prescriptive dismantling procedure followed."] },

  { id:"as61", asNumber:"AS 2601:2001",         title:"Demolition of structures",                                      scope:"Requirements for the safe planning, supervision and execution of demolition of structures including hazardous material identification, structural assessment, demolition sequence, and environmental controls.", keywords:["demolition","asbestos","hazardous materials","structural","partial demolition","deconstruction","controlled","safety","environmental","HAZMAT"], buildingType:"both", category:"Structural", nccLink:"Work Health and Safety legislation / local authority consent", practicalNote:"HAZMAT survey mandatory before any invasive work. Asbestos Class A or B licence required. Demolition plan to engineer before work. SafeWork notification 5 days before start.", details:["A hazardous materials survey must be completed by an accredited assessor before any demolition or invasive work commences — the survey identifies asbestos-containing materials (ACMs), lead-based paint, synthetic mineral fibres (SMF), polychlorinated biphenyls (PCBs in old electrical equipment), and other hazardous substances that require specialist removal or management before bulk demolition.","A demolition plan must be prepared before work begins, identifying the demolition sequence, temporary structural support requirements for partial demolition, plant and equipment to be used, exclusion zones, dust and noise controls, and emergency procedures — the plan must be prepared by a competent person and must be available on site; for complex or high-risk demolitions, the plan must be prepared by a structural engineer.","Asbestos removal must be performed by a licensed asbestos removal contractor — friable (crumbling or powdery) asbestos requires a Class A Asbestos Removal Licence; bonded (non-friable) asbestos products (cement sheeting, vinyl floor tiles, textured coatings) require a Class B licence; removal without a licence carries heavy penalties and criminal liability for health impacts.","An independent licensed asbestos assessor (separate from the removal contractor) must issue a clearance certificate after asbestos removal, including clearance air monitoring results showing airborne asbestos fibre concentrations are below the clearance criteria — no re-occupation or continuation of other work may proceed until the clearance certificate is issued.","SafeWork (or WorkSafe in Victoria) must be notified at least 5 business days before demolition commences where: asbestos is present in the structure, the demolition value exceeds the threshold specified in the WHS Regulations ($250,000 in most states), or it is a notifiable hazardous work type; failure to notify is an offence with substantial penalties.","Propping and temporary works must be designed by a structural engineer for any partial demolition — removing a wall, floor level, roof section, or structural element from one part of a building without appropriate temporary support can cause progressive structural collapse of the remaining portions; propping design must address both the construction stage loads and the loading from adjacent structure.","Environmental controls during demolition must address dust suppression (water spray, containment screens), noise limits (working hours, equipment selection), protection of adjacent waterways and stormwater drains from demolition waste, and separation of recyclable materials (concrete, steel, timber) from general waste; local authority demolition consents typically impose specific conditions on each of these areas."] },

  { id:"as62", asNumber:"AS 1657:2018",         title:"Fixed platforms, walkways, stairways and ladders — design, construction and installation", scope:"Requirements for the design and construction of fixed access equipment including platforms, walkways, handrails, stairways, and fixed ladders used for access and maintenance in buildings and industrial facilities.", keywords:["stairway","ladder","walkway","platform","handrail","access","maintenance","industrial","rooftop","plant room","height","fixed ladder","cage"], buildingType:"both", category:"Structural", nccLink:"NCC Vol 1 — D2 / Work Health and Safety legislation", practicalNote:"Stairways preferred over ladders for regular access. Cage required on ladders >6m without rest platform. Handrail both sides on stairs >1000mm width. Non-slip treads mandatory.", details:["Fixed ladders exceeding 6m in height must be fitted with a safety cage (or hoop guards) OR a fall arrest system (ladder safety rail with a climber device) — unguarded ladders above 6m are non-compliant with AS 1657 and WHS regulations; many existing industrial buildings have non-compliant fixed ladders that must be upgraded when the facility is renovated or when a duty of care review is undertaken.","Stairways must be preferred over fixed ladders wherever the access is required more frequently than once per shift or where materials must be carried — a stairway provides a safer, less fatiguing means of access than a ladder; the decision between stairway and ladder must be documented as part of the facility design.","Handrails must be provided on both sides of stairways more than 1000mm wide, and must comply with the grip diameter (32–50mm round section), height (900–1100mm above nosing), and end termination (returned to the newel or wall) — handrails that end in a projecting horizontal or open end are a clothing and limb entanglement hazard.","All stairway treads, platform grating, and walkway surfaces must have a non-slip surface appropriate to the exposure — in wet or industrial environments, open bar grating, anti-slip aluminium sections, or applied abrasive coatings are used; smooth painted or smooth galvanised surfaces are non-compliant as stair treads in wet conditions.","Loading on platforms and walkways must be designed for the intended use: maintenance platforms typically 2.5 kPa, equipment platforms per equipment weight plus 2.5 kPa live load, and all platforms must support the concentrated load of a 135 kg person at any point; platforms undersized for their intended equipment loading are a frequently identified deficiency in industrial building upgrades.","All fixed platforms, walkways, and stairways must be maintained in a condition that does not create a hazard — corroded grating, loose handrail connections, damaged anti-slip nosings, and unlocked gates to fall hazard areas are all maintenance non-compliances that carry liability for the building owner; a regular inspection and maintenance program must be established at building handover.","Roof access for HVAC maintenance must be designed with permanent anchor points for fall arrest equipment where safe access cannot be provided by other means — these anchor points must be designed by a structural engineer for the rated single-person or multi-person loading, installed with the correct embedment or fixing to the structure, and tested after installation per manufacturer requirements."] },

  // ── PLUMBING ─────────────────────────────────────────────────────────────────
  { id:"as63", asNumber:"AS/NZS 3500.5:2000",  title:"Plumbing and drainage — domestic installations",               scope:"Requirements for domestic plumbing and drainage installations in houses and low-rise residential buildings, covering pipe sizing, fixture connections, drainage venting, overflow relief, and hot water temperature.", keywords:["plumbing","drainage","domestic","pipe sizing","hot water","trap","vent","overflow relief","ORG","dishwasher","trap seal","residential plumbing"], buildingType:"residential", category:"Plumbing", nccLink:"NCC Vol 2 — Part 3.9.2", practicalNote:"ORG required on every property. 60°C hot water storage, 50°C max at outlet. Minimum 25mm trap seal on all fixtures. All traps must be accessible without demolition.", details:["An overflow relief gully (ORG) must be installed on every residential property's external drainage system — the ORG is positioned outside the building at a grate level below all internal floor wastes but above the sewer main invert; when a downstream blockage causes sewer surcharge, the pressure relief comes up through the ORG grate outside rather than through internal floor wastes, toilets, and showers inside the dwelling.","All drainage fixtures must be connected through water seal traps with a minimum 25mm seal depth — the water seal prevents sewer gases (hydrogen sulfide, methane, carbon dioxide) from entering the building; traps must remain accessible for clearing without requiring the removal of tiles, wall panels, or structural elements; hidden non-accessible traps are a licence compliance violation.","Drainage venting is required when the developed length from the fixture trap to the first vent connection exceeds the permitted unvented drain length (typically 1.8m for 32mm pipe, 3m for 40mm, 6m for 50mm) — without adequate venting, water momentum in a full-bore drain causes siphonage of the trap seal; once the trap is emptied, sewer gas enters the building continuously until the trap is re-primed.","Hot water systems must store water at a minimum temperature of 60°C throughout the storage vessel to prevent Legionella pneumophila bacteria growth — Legionella multiplies rapidly in warm water between 20°C and 45°C; however, a thermostatic mixing valve (TMV) or tempering valve must be installed to mix the 60°C stored water with cold water to maximum 50°C at the outlet of the storage system to prevent scalding risk.","Cold water supply pipe sizing must account for simultaneous use of multiple fixtures — the loading units method in AS/NZS 3500.1 assigns demand units to each fixture type and uses a conversion graph to determine peak probable flow; undersized cold water pipes are a common deficiency in residential additions and cause inadequate flow pressure when the kitchen and two bathrooms are used simultaneously.","The fall (gradient) of all gravity drainage pipes must not be less than 1:60 (approximately 17mm per metre) for pipes 80mm and larger; smaller diameter pipes require steeper falls per the tables in AS/NZS 3500.2 — insufficient fall allows solids to settle in the pipe, causing repeated blockages; excessively steep fall (above 1:5) causes water to rush ahead of solids in the pipe, also causing blockages.","All PVC drainage pipes underground must be the correct grade for the application — PVC-U Class SN4 or SN8 (stiffness class) is required for underground drainage; standard PVC pressure pipe is not rated for burial under traffic or building loads and will crush; deep burial or installation under a driveway requires the higher-rated SN8 class or reinforced concrete pipe."] },

  { id:"as64", asNumber:"AS/NZS 4020:2018",    title:"Testing of products for use in contact with drinking water",    scope:"Requirements for testing and assessment of products (pipes, fittings, coatings, sealants, lubricants) that contact potable water to ensure they do not contaminate water quality.", keywords:["drinking water","potable water","pipe","fittings","coating","sealant","contamination","copper","PVC","PE","brass","plumbing products"], buildingType:"both", category:"Plumbing", nccLink:"NCC Vol 2 — Part 3.9.2 / NCC Vol 1 — F2", practicalNote:"All products in contact with drinking water must be AS/NZS 4020 tested and certified. Watermark certification is the standard Australian evidence of compliance. Do not use unwatersmarked fittings in potable systems.", details:["Every product in contact with potable drinking water must be tested to AS/NZS 4020 — this includes pipes, fittings, valves, taps, meters, tanks, sealants, lubricants, and coatings that contact the water; the testing assesses whether the product imparts taste, odour, or toxic substances (heavy metals including lead, copper, zinc, cadmium) to the water at levels exceeding WHO guidelines.","The WaterMark certification scheme is the Australian mandatory certification program for plumbing and drainage products — WaterMarked products have been tested to AS/NZS 4020 and bear the WaterMark licence number; non-WaterMarked products must not be used in potable water systems regardless of how good they appear; using non-WaterMarked products is a licence violation for a licensed plumber.","Lead in brass fittings is a historic concern now addressed by low-lead brass requirements — older brass fittings (pre-2014) contained up to 3–4% lead by weight; modern WaterMark-certified brass fittings must comply with the low-lead (maximum 0.25% lead) requirements to prevent lead leaching into potable water, particularly in low-flow or stagnant conditions such as at bedside taps in schools and hospitals.","Sealants and thread compounds used on potable water piping joints must be AS/NZS 4020 compliant — ordinary plumber's thread tape (PTFE) is generally compliant, but silicone sealants, jointing compounds, and flux pastes used in copper tube soldering vary widely; only products specifically listed as potable water compliant should be used; soldering flux must be food-grade quality for drinking water copper tube joints.","Tanks, cisterns, and water storage vessels in contact with drinking water must be manufactured from AS/NZS 4020 compliant materials — polyethylene tanks must be manufactured from UV-stabilised food-grade PE (not industrial-grade, which may contain recycled material with contaminants); concrete tanks must have internal coatings or linings verified as potable water compliant.","Chlorine resistance testing is included in AS/NZS 4020 — treated town water contains 0.2–0.5 mg/L free chlorine for disinfection; products must demonstrate they do not degrade or leach additional contaminants when in continuous contact with chlorinated water; this is particularly relevant for plastic pipes, rubber gaskets, and adhesive joints.","Documentation of AS/NZS 4020 compliance should be retained on the project file — WaterMark licence numbers for all installed products, batch numbers for large projects, and any alternative compliance certificates; this documentation is required if water quality complaints arise after building completion, and for building handover packages to commercial and institutional clients."] },

  // ── ACCESSIBILITY ─────────────────────────────────────────────────────────────
  { id:"as65", asNumber:"AS 1428.2:1992",       title:"Design for access and mobility — enhanced and additional requirements", scope:"Enhanced accessibility requirements for buildings with higher proportions of users with disabilities, covering larger wheelchair turning circles, reach ranges, service counter heights, and specialist accessible facilities.", keywords:["wheelchair","disability","accessible","mobility","aged care","healthcare","turning circle","counter height","reach range","handrail","accessible toilet","transport"], buildingType:"commercial", category:"Accessibility", nccLink:"NCC Vol 1 — D3", practicalNote:"Mandatory for healthcare, aged care, transport terminals. Accessible toilet: 2200×2200mm clear space. Counter section: 820–870mm height for 900mm minimum. Coordinate with AS 1428.1.", details:["AS 1428.2 provides enhanced accessibility requirements beyond AS 1428.1 for building types serving a higher proportion of people with severe mobility impairment — it is mandatorily referenced in the NCC for healthcare facilities, aged care facilities, transport interchanges, and court buildings; in these settings, AS 1428.2 requirements apply in addition to (not instead of) AS 1428.1.","Accessible toilet compartments under AS 1428.2 require a minimum 2200mm × 2200mm clear floor space (significantly larger than the 1540×1500mm minimum of AS 1428.1) — this additional space accommodates forward-transfer wheelchair users who transfer from the front of the wheelchair, rather than side-transfer only; the space must be completely clear of door swings, sanitary fixtures, and dispensers.","Service counters, reception desks, check-in counters, and ATM terminals must include a section at 820–870mm height for a minimum 900mm continuous length — this height allows a person in a standard wheelchair to interact with the counter without needing to reach up; most standard counters at 900mm or 1050mm height are inaccessible to wheelchair users without counter lowering.","Handrails on accessible ramps and stairways must comply with both AS 1428.1 and the enhanced AS 1428.2 requirements — handrails must be continuous along the full length of the ramp or stair including across all landings (no gaps at intermediate posts), with a grip section diameter of 32–50mm for round sections, finished ends turned down or returned to the wall to prevent clothing entanglement.","Accessible car parking spaces under AS 1428.2 must be 3200mm wide (versus 2400mm standard) to accommodate vehicles with side ramps or rear-loading wheelchair lifts — where two accessible spaces are paired, a shared 2400mm central access aisle is required; the total combined width is 3200+2400+3200=8800mm; accessible spaces must be on the flattest area of the car park with maximum 1:40 gradient.","Signage for accessible facilities must meet the enhanced requirements of AS 1428.2 and AS 1428.4.1 — tactile and braille signage is required for accessible toilet doors, emergency exits, and key wayfinding points; the International Symbol of Access must be displayed at accessible car spaces, entries, toilets, and lifts at the height and position specified in AS 1428.2.","Lifts serving persons with disabilities must comply with AS 1735.12 — the lift car must be a minimum 1100mm wide and 1400mm deep (for AS 1428.1 compliance) or 2000mm deep for forward-entry-forward-exit operation without turning (for AS 1428.2 enhanced lift); the control panel must be within the reach range of a wheelchair user, and voice announcement of floors is required."] },
];

// ── Estimator Price Notes per AS entry ───────────────────────────────────────
const AS_ESTIMATOR_NOTES: Record<string, string[]> = {
  // ── Structural — Timber Framing ──────────────────────────────────────────────
  "as1": [
    "Wall framing supply & erect: $40–$80/m² of wall area (N1/N2, 90×35 MGP10 at 600mm ctrs). N3–N4 winds: add 15–20% for 450mm stud spacing or 90×45 upgrade. Measure gross wall area, deduct large openings >1.8m only.",
    "Lintels are frequently underestimated: 2/90×45 LVL for openings up to 1.8m ($60–$120 supplied); 3.0–3.6m openings need 240 or 300 LVL F17 ($120–$250/lm supplied). Always get actual span from architectural drawings before pricing.",
    "Waste factor: allow 15–18% on all framing timber for cuts, offcuts, double-ups, blocking, and re-orders. Non-standard ceiling heights (>2.7m) push waste over 20% and require non-standard stud lengths — check availability.",
    "Bracing is a common scope gap: calculate Bracing Units (BUs) from wind class, roof area, and wall height per AS 1684.2 Section 8. Sheet bracing (6mm ply/FC) $20–$45/BU supplied & nailed. Steel strap $8–$20/BU but holddown bolts add cost. Allow $1,500–$4,000 for typical Class 1a.",
    "Tie-down straps: N1/N2 standard pack $2,000–$5,000 for typical house. N3+ requires H2.5 hurricane straps ($15–$30 each installed) at every rafter/truss — count members before pricing. N5/N6 or cyclonic: budget $8,000–$18,000 for tie-down system alone.",
    "Engineer's frame certificate: $500–$1,500 typical. Certifier framing inspection hold point: allow 1–2 days delay in programme if not pre-booked. Both costs are often missed in preliminaries.",
    "Temporary bracing and propping during frame erection: often included in framing rate but confirm with subcontractor — on multi-level or complex roof projects allow $500–$2,000 for dedicated temporary bracing materials.",
  ],
  "as2": [
    "Cyclonic framing (AS 1684.3) premium over non-cyclonic: add 25–40% to wall framing rate for increased connection requirements, hurricane straps at every member, closer stud spacing, and chemically anchored bottom plate bolts.",
    "Hurricane tie-down straps at every rafter/truss: cost $15–$30 each installed. Count every rafter and multiply — a 200m² house with 600mm rafter spacing has ~65 rafters per side = 130+ straps just for rafters.",
    "Chemically anchored bottom plate bolts (cyclonic requirement) add $8–$15 per bolt vs cast-in bolts; spacing reduces from 1800mm to 600–900mm — nearly triples bolt count and cost. Include drilling allowance.",
    "Cyclonic window and door specifications drive major cost: debris-impact rated glazing is $300–$800/m² vs $150–$400/m² for standard; cyclone shutters add $200–$600/m² of opening on top. Do not miss this in your façade allowances.",
    "Certifier and engineer costs in cyclonic regions are higher — structural engineer cyclone certification: $1,500–$4,000 for Class 1a. Cyclone-rated tie-down inspection is a mandatory hold point.",
    "Allow a 5–10% contingency on structural framing in cyclonic areas — non-standard details, substitutions when specified straps are unavailable, and re-work from structural engineer RFIs are common cost sources.",
  ],
  "as3": [
    "Geotechnical investigation (site classification): $800–$2,500 for Class 1a residential. Always include — do not price footings without knowing site class. Budget higher ($2,000–$5,000) if site history suggests fill, contamination, or nearby excavation.",
    "Site class cost impact: Class A/S slab $100–$160/m²; Class M add $30–$60/m²; Class H1 add $60–$100/m²; Class H2 add $100–$180/m²; Class E/P: engineer design required, budget $250–$450/m² and allow for construction delays. Always establish class before tendering.",
    "Edge beam depth drives concrete and formwork cost: 200mm edge (Class A/S) vs 300mm edge (reactive sites) adds ~25% to edge beam concrete volume. On large slab perimeters (50–60lm) this is a meaningful cost difference.",
    "Internal stiffening beams (Class M+): typically 400–600mm deep × 300mm wide at 3–4m centres. Measure total beam length from structural drawings, not just floor area — a 200m² slab may have 120lm of internal beams.",
    "Compaction testing (Class P fill sites): $300–$800 per test by NATA lab; 1 test per 200m² compacted layer is typical. Multi-layer fill requires multiple test rounds — allow $2,000–$5,000 for full documentation program.",
    "Post-tensioned slabs (H2 or multi-storey): $220–$380/m² all-in. Requires PT contractor (specialist subcontractor, 2–4 week lead time), stressing equipment, and engineer ITP. Do not include in standard slab rates.",
  ],
  "as4": [
    "DPC supply only: $2–$5/lm for PE sheet, $4–$8/lm for aluminium foil laminate. Labour to install: $3–$7/lm. On a Class 1a house with 80–100lm of external wall, DPC cost is $400–$1,200 — often missed as a separate item.",
    "DPC bridges from landscaping or path raises are a latent defect risk: if the client raises garden beds after handover and covers the DPC, the builder may face defect liability. Note this risk in your handover documentation.",
    "Wet area DPC under bottom plates: allow $8–$15/lm for DPC tape plus labour in bathrooms, laundries, and all tiled areas. Often forgotten in wet area scope.",
    "Compliance check cost: DPC inspection by certifier is typically included in frame stage inspection — no separate fee. However, failed DPC installation (too low, bridged by mortar) requires rectification before frame inspection passes.",
  ],
  "as5": [
    "Physical termite barrier full perimeter: $80–$150/lm external perimeter (stainless mesh or Termimesh). Typical Class 1a with 50lm perimeter = $4,000–$7,500. Include all internal wall penetrations: add $60–$120 per pipe/conduit penetration.",
    "Chemical soil treatment alternative: $1,500–$3,500 for Class 1a, depending on slab area and chemical system. Re-treatment at 5–8 years adds ongoing owner cost — confirm chemical system warranty period in tender.",
    "Compliance documentation: licensed installer certificate + product warranty document required. Obtain at completion of treatment — no extra cost but allow time to collect before certifier inspection.",
    "Annual inspection (owner's obligation post-handover): $200–$400/year from licensed inspector. Note this as an owner responsibility in handover documents — not a builder cost but often raised in defect claims.",
    "Pipe and conduit penetrations through the barrier are the most common defect — allow a provisional sum of $500–$1,500 for additional penetration sealing once services layout is finalised.",
  ],
  "as6": [
    "Wind classification affects virtually every structural trade rate — confirm wind class from postcode and site exposure before tendering. Upgrading from N2 to N3 adds 15–25% to framing, 20–30% to roofing fasteners, and can require larger wall bracing — it is a project-wide cost driver.",
    "AS 4055 wind classification assessment: included in engineer's structural certificate cost. For complex sites (coastal, elevated, unusual terrain), a specialist wind engineer's assessment may be required: $800–$2,500.",
    "Cyclonic classification (C1–C4) triggers: debris-rated windows (budget $500–$900/m² supply), cyclone shutters, hurricane tie-downs, and cyclone-rated roof cladding — these are significant line items requiring explicit scope inclusions.",
    "Cladding and fastener cost differences by wind class: N1/N2 standard profile metal roof fastener spacing 900mm; N3/N4 typically 600mm or less. Fastener count increase adds $1,500–$4,000 on a typical residential roof. Confirm manufacturer's cyclone fix table before pricing.",
    "Wind speed data for commercial engineering: AS 1170.2 site wind speed calculation by engineer adds $500–$1,500 to structural engineering fee. Required for all commercial buildings and N4+ residential.",
  ],
  "as7": [
    "BAL assessment: $800–$2,000 from accredited BAL assessor. Mandatory for all Class 1 buildings in bushfire prone areas — include in preliminary costs always. Some councils include this in the DA process; others require a separate engagement.",
    "BAL construction cost premiums over standard construction: BAL-12.5 adds $3,000–$8,000; BAL-19 adds $8,000–$18,000; BAL-29 adds $18,000–$35,000; BAL-40 adds $35,000–$70,000; BAL-FZ adds $70,000–$150,000+ for full non-combustible envelope.",
    "Key BAL cost drivers: ember-proof vents ($150–$300 each vs $30–$80 standard), toughened or BAL-rated glazing ($250–$600/m² vs $150–$300/m²), non-combustible or BAL-rated cladding ($120–$300/m² vs $60–$150/m² for standard fibre cement), and BAL-rated roof coverings.",
    "BAL-40 and FZ require non-combustible timber soffits — replace standard painted FC sheet soffit ($25–$45/m²) with compressed FC or intumescent-coated soffit ($60–$120/m²). Measure all eave and soffit areas.",
    "Decks and pergolas in BAL zones: combustible materials (pine decking, treated pine posts) may not be permitted — specify hardwood or non-combustible materials. Hardwood decking adds $80–$160/m² over pine pricing.",
    "BAL certification letter from assessor required for building permit — allow $200–$400 for certification document if not included in assessment fee. Council may require re-assessment if site conditions change during construction.",
  ],
  // ── Structural — Concrete ────────────────────────────────────────────────────
  "as8": [
    "Suspended concrete slab all-in rate (post-tensioned): $220–$380/m² of slab area including formwork, PT tendons, reinforcement, concrete, pump, and finishing. Engineer-designed — provide structural drawings to subcontractor for accurate quotation.",
    "Shoring for suspended slabs: $20–$50/m² of slab area for hire and erection of propping system. Reshoring on lower floors: same rate, applied to each level below that requires reshoring. Multi-level projects: shoring cost can approach 15–20% of concrete subcontract value.",
    "Concrete pump: $800–$2,500 per pour day depending on pump size and accessibility. Always allow a separate pump line item for elevated or inaccessible pours — included in slab rates only if explicitly confirmed by subcontractor.",
    "Concrete wastage allowance: 5–8% on formed elements (beams, columns); 3–5% on flat slabs. Over-ordering prevents short pours that require costly re-mobilisation of pump and crew.",
    "NATA lab testing: $300–$600 per pour element (cylinders, slump, temperature). Allow 2 tests per 50m³ minimum. Do not include in concrete rate — specify separately in preliminaries or provisional sum.",
    "Certifier inspection hold point: $300–$600 for structural engineer reinforcement inspection (before pour). Add engineer's ITP preparation: $500–$1,500. Both are mandatory on engineer-designed elements.",
  ],
  "as9": [
    "Masonry construction (AS 3700): brick veneer wall supply & lay $150–$250/m² (face brickwork, standard bond, N1/N2). Double brick adds $70–$120/m² over brick veneer. Control joints and weep holes are included in a properly scoped masonry rate — confirm with subcontractor.",
    "Lintel supply for masonry openings: $80–$250/lm for steel angle or concrete lintel depending on span and load. Bearing pads: $15–$30 per end. Measure every opening and confirm lintel specification from structural engineer.",
    "Mortar and wall tie costs are typically included in masonry rate. N3+ areas require increased wall tie density — confirm with subcontractor as this adds $3–$8/m² to the masonry rate.",
    "Scaffolding for masonry: $80–$150/week for perimeter scaffold on single-storey, $150–$250/week double-storey. Scaffold must be in place before masonry commences — include in preliminaries from frame stage.",
    "Pointing and cleaning: $15–$30/m² if not included in masonry rate. Acid washing: $8–$15/m². Confirm inclusions in subcontractor price — often excluded from supply & lay rates.",
  ],
  "as10": [
    "Roof coverings (AS 2049 tiles, AS 1562.1 metal): supply & install price range: concrete tiles $60–$100/m²; terracotta tiles $100–$160/m²; Colorbond corrugated $65–$100/m²; standing seam $120–$200/m². All measured on roof plan area, not slope area.",
    "Flashings and ridge/hip/valley: allow 15–25% premium on top of basic roof cover rate for flashings, ridge capping, hip ends, valleys, and soakers. On complex roofs (many hips, dormers, penetrations) this can reach 35%.",
    "Sarking: $8–$15/m² supply & install. Mandatory under all metal roofing in occupied buildings (anti-condensation). Often missed as a separate line item — confirm inclusion in roofing rate.",
    "Gutters and downpipes: not typically included in roofing rate. Budget $50–$90/lm for fascia gutter and downpipe supply & install. Measure total gutter length plus downpipe quantity × average height.",
    "Cyclonic roof fastener requirements (AS 2049): every tile mechanically fixed — add $8–$15/m² to standard tile rate for cyclone clips. Metal roofing in C1+: reduced fastener spacing adds $5–$12/m² over standard pricing.",
  ],
  "as11": [
    "Timber floor framing (bearers/joists/stumps): $90–$150/m² of floor area supply & erect. Add $15–$25/m² for subfloor ventilation brickwork and vents. Suspended timber floors are more expensive than slab but provide under-floor access.",
    "Stumps/piers (concrete): $150–$350 each for 300mm diameter concrete stump, 600mm embedment. Count stumps from structural plan — a 200m² suspended floor may have 60–80 stumps.",
    "Bearer and joist sizes from AS 1684.2 tables — get span and spacing from structural drawings before pricing. Non-standard spans (>3.6m) push into LVL territory: $120–$200/lm vs $40–$70/lm for sawn timber.",
    "Subfloor access hatch: $300–$600 supply & install if required by council. External ventilation brickwork: $80–$140/m² — measure all external wall area below floor level.",
    "Ant capping on all stumps: $10–$20 each. Often missed from scope but required by AS 3660.1 to complete termite barrier continuity.",
  ],
  "as12": [
    "Timber floor sheeting (structural): 19mm T&G particleboard $35–$55/m² supply & fix; 19mm structural plywood $55–$80/m²; hardwood strip flooring $120–$250/m² supply & lay. Measure net floor area — deduct all wet areas and voids.",
    "Moisture barrier under particleboard on concrete slab: $8–$15/m² for 0.2mm PE film. Essential on slab-on-ground — missed moisture barrier leads to swelling and cupping of particleboard.",
    "Adhesive for T&G joints: $15–$35/tube, typically 1 tube per 10–15m² of sheeting. Include adhesive cost in material rate or as a separate item.",
    "Floor levelling compound (if required): $15–$30/m² for 6–10mm self-levelling compound over slab. Requires assessment of slab flatness — get a floor flatness survey ($500–$1,200) before pricing if slab source is unknown.",
  ],
  "as13": [
    "Steel structure fabrication and erection: $600–$1,200/tonne for structural steel supply, fabricate, and erect (simple portal frames). Complex connections, crane lifts, and remote locations increase cost. Always get a tonnage estimate from structural drawings.",
    "Steel connections and bolting: $15,000–$40,000 for connection hardware on a typical light commercial building. Bolted connections are $20–$40% cheaper than welded on site — design for bolted connections where possible.",
    "Protective coating: $20–$50/m² for zinc primer + 2-coat enamel on structural steel. Fire-resistant intumescent coating: $80–$180/m² for 90-minute rating (commercial buildings). Measure total steel surface area from structural drawings.",
    "Hot-dip galvanising instead of painting: $4–$8/kg for HDG. Cost-effective for external or exposed coastal steelwork. Lead time 5–10 working days — include in programme.",
    "Structural engineering certification: $2,000–$6,000 for typical Class 5–6 commercial building. Includes design, connection details, and construction certificate. Complex structures or unusual loading add significantly.",
    "Crane hire for steel erection: $1,500–$4,000/day depending on crane size and lift capacity. Crane access and road occupation permits: $500–$2,000 in urban areas. Always include crane cost explicitly — not in steel erection rate.",
  ],
  "as14": [
    "Glass supply (AS 1288): standard 6mm float $60–$100/m² supply only. Toughened 6mm $90–$140/m²; toughened laminated 6.38mm $120–$180/m²; double glazed unit (DGU) $180–$350/m² depending on gap and glass spec. Always get actual areas from window schedule.",
    "Glazing labour: $30–$60/m² for standard commercial glazing. Complex shapes, high-level access, or curtain wall add significantly.",
    "Safety glazing audit: any glass in a critical location (shower screens, sidelights within 300mm of door, glass in doors, panels below 750mm) must be toughened or laminated — audit the window schedule and mark up any locations requiring safety glass. Non-compliant glazing replacements cost $200–$600 per panel as a defect.",
    "Structural glass (balustrades, frameless glass): $400–$900/lm for frameless glass balustrade supply & install. Engineer's certificate required. Never include at standard glazing rates.",
    "Glass breakage allowance: 2–3% of glazing contract value for damage during construction. More on high-rise or exposed sites.",
  ],
  "as15": [
    "Window supply (AS 2047): aluminium windows (standard residential grade) $250–$500/m² of window opening supply only. Double-glazed aluminium $450–$750/m². Thermally broken double-glazed $700–$1,200/m². Timber windows $600–$1,200/m². Measure all window openings from elevation drawings.",
    "Window installation labour: $80–$180/window including sill flashing, foam seal, and head flashing. Head flashings are often excluded from window supply price — confirm inclusions.",
    "Window energy rating: NatHERS software will specify minimum WERS rating for each window by orientation. Higher-rated windows cost more — identify which windows drive the energy score before value-engineering glazing.",
    "Cyclone-rated windows (C1+): add $200–$500/m² over standard aluminium for impact-rated frames and glass. Cyclone shutters add a further $200–$400/m² of opening. Significant cost in cyclonic regions.",
    "Window flashings: head flashings $15–$30/lm, sill flashings $20–$35/lm. Often missed as a separate item — confirm inclusion with window installer or allow separately.",
  ],
  // ── Structural — Footings & Concrete ────────────────────────────────────────
  "as16": [
    "Formwork supply (AS 3610): $25–$50/m² of formed surface area for hire and erect of basic slab edge formwork. Suspended slab formwork (table or shoring): $40–$80/m² hire. Complex shapes, cantilevers, and multiple reuses: quote case by case.",
    "Formwork labour is typically the largest cost component — roughly equal to or greater than formwork hire. Total in-place cost including hire + labour: $60–$120/m² for standard slabs.",
    "Formwork stripping hold point: concrete must reach minimum 70% of 28-day strength before stripping suspended slabs. In cold or wet weather, curing is slower — allow 5–14 days extra for slab strength gain before stripping compared to standard 7-day target. Programme this — it affects the whole construction sequence.",
    "Reshoring: budget $20–$40/m² of floor area for each level requiring reshoring (typically 2 levels below active pour level on multi-storey). Often excluded from concrete subcontract — clarify scope.",
    "Engineer's shoring design (multi-storey): $1,500–$4,000. Mandatory where sequential loading through multiple floors is involved. Include in preliminaries.",
  ],
  "as17": [
    "Concrete specification and supply cost premium: high-performance mixes (40+ MPa, low w/c, blended cement) cost $15–$40/m³ more than standard 25 MPa general mix. Exposure Class C2 marine mix: $180–$240/m³ vs $130–$160/m³ for Class A1. Always specify exposure class on the concrete order.",
    "Concrete pump hire: $800–$2,500/day; minimum call-out charge $600–$1,200. Boom pump hire more expensive than line pump but faster for large pours — specify which pump type in rate.",
    "Concrete testing: $300–$600 per pour event for standard test cylinders (set of 2 × 28-day breaks) by NATA lab. High-value or high-risk pours: add 7-day breaks ($150–$300 extra per event). Programme lab pickup and testing — results available at 28 days minimum.",
    "Over-ordering concrete: allow 5–8% over calculated volume — running out mid-pour on a flat slab causes a cold joint, which is a structural defect requiring core testing and potential engineer sign-off at $2,000–$5,000.",
    "Hot-weather concrete surcharge: chilled water or ice batching adds $10–$25/m³ to concrete cost in summer. Required when ambient temperature exceeds 32°C — include a provisional sum in warm-weather projects.",
  ],
  "as18": [
    "Steel reinforcement supply and fix: $1,600–$2,400/tonne for cut-and-bend supply and fix including bar chairs. Mesh supply and fix: $18–$30/m² for SL82 (3mm sheet). Measure reinforcement from structural drawings — take off every element separately.",
    "Reinforcement fabrication (cut-and-bend): 2–3 week lead time from steel supplier. Order early — delays hold up concrete pours. Include delivery allowance ($200–$500) for remote sites.",
    "Bar chairs (concrete cover): $0.80–$2.50 each. At 800mm spacing on a 200m² slab: approx 300 chairs. Often missed as a separate material item — include in reinforcement rate or provisional sum.",
    "Reinforcement inspection hold point: certifier or structural engineer inspect all reo before pour. $300–$600 inspection fee. Must be signed off before concrete can be ordered — include in programme as a 1-day hold.",
    "Reo splicing and mechanical couplers: $15–$40 per coupler for mechanical lap splices where long laps are impractical. High-rise columns may use dozens of couplers — measure from structural engineer's splice schedule.",
  ],
  "as19": [
    "Strip footing supply and construct: $180–$350/lm for 600mm wide × 300mm deep reinforced strip. Depth varies with site class — H-class sites may require 450–600mm deep strips. Measure total footing length from structural plan.",
    "Pad footings (isolated): $400–$1,200 each depending on size and depth. Commercial columns may need 1.5m × 1.5m × 600mm deep pad footings: $900–$2,500 each. Get sizes from structural drawings.",
    "Excavation for strip footings: $30–$70/lm depending on soil type. Rock excavation: $200–$600/lm — always include a rock contingency in unknown ground conditions.",
    "Reinforcement for strip footings: typically 2–3 × N16 bottom bars with R10 ligatures at 200–300mm centres. Add to concrete price separately — $20–$40/lm for reo in standard strip footing.",
    "Certifier inspection hold point before concrete: $300–$500. Must be booked in advance — allow 2 days in programme. Failed inspection (wrong depth, reo missing) requires re-booking: add 2–3 day delay.",
  ],
  "as20": [
    "Concrete stairs cast in-situ: $3,500–$8,000 per straight flight (12–15 risers) including formwork, reo, pour, and stripping. Allow 15–20% premium for complex shapes (winder stairs, landings, return flights).",
    "Stair formwork is labour-intensive — allow 1.5–2 days of labour per flight for soffit form, riser boards, and side form. Plywood is typically purpose-made and cannot be reused — include full cost.",
    "Balustrade to stairs: $200–$600/lm for stainless steel or powder-coated aluminium. Glass balustrade: $400–$900/lm. Measure raking length plus all landings. Engineer's cert for glass.",
    "Non-slip nosings to concrete stairs: $40–$80/lm supply & install. Required by NCC on all common-use stairways in Class 2+ buildings. Often missed from finishes schedules.",
    "Concrete stair structural engineer design: included in overall structural package usually. Where provided as a separate fee: $500–$1,200 per stair configuration.",
  ],
  // ── Waterproofing ────────────────────────────────────────────────────────────
  "as21": [
    "Wet area waterproofing (AS 3740 + AS/NZS 4858): liquid membrane $30–$60/m² supply & apply. Two coats required — allow labour for two separate application visits with drying time. Do not apply tiles same day as final membrane coat.",
    "Flood testing: minimal direct cost ($0–$50 for plugging and monitoring) but requires scheduling — 24-hour minimum ponding means the area cannot be tiled for at least 48–72 hours after membrane application. Programme this gap.",
    "Shower recesses: $400–$900 each for full waterproofing including floor, walls to 1800mm, floor waste flashing, and penetration seals. Measure count from drawings — each shower is a separate pricing unit.",
    "Balcony and podium waterproofing (Type A exposure): $80–$150/m² for two-component cementitious or sheet membrane with protection board. Add $20–$40/m² for drainage cell and geofabric.",
    "Waterproofing subcontractor: a specialist is strongly recommended over general tiler doing their own membrane — compliance issues with membrane application are the single most common cause of water ingress defects and latent liability claims. Get a separate waterproofing certificate from the subcontractor.",
    "Warranty documentation: waterproofing product warranty (5–10 years typical) and applicator certificate must be obtained at practical completion. Missing warranty documents are a common settlement item in defect disputes — chase these at completion.",
  ],
  "as22": [
    "External waterproofing membrane (AS 4654.2 — roof/deck type): torch-on bitumen $45–$75/m²; self-adhesive modified bitumen $55–$85/m²; single-ply (TPO/PVC) $90–$140/m². Measure all flat and low-slope roof areas separately from pitched roof.",
    "Flashings at penetrations, upstands, and perimeter edge are labour-intensive: allow $180–$350 per penetration (pipe, conduit) and $60–$120/lm for perimeter upstand detailing.",
    "Protection board over membrane (trafficable decks): $15–$30/m² for 25mm polystyrene protection board. Prevents membrane damage during paving or tiling. Often missed in budget.",
    "Drainage and overflow: deck drain outlets $200–$500 each; overflow scuppers $150–$350 each. Size and count from hydraulic drawings. Allow for setting drains to correct fall before membrane — a 1:80 fall check by string line takes 1–2 hours but prevents expensive re-work.",
    "Inspection hold point: waterproofing inspections by certifier ($300–$500) and flood test. Allow 3–5 days minimum for membrane cure + flood test before protection board and paving can proceed.",
  ],
  "as23": [
    "Smoke alarm supply & install (AS 3786): hardwired interconnected smoke alarms $80–$180 each fully installed (electrician). Battery-only alarms not compliant in new construction. Count number of detectors from NCC requirements — typically 1 per bedroom, 1 per level, interconnected.",
    "Interconnection wiring: often missed in electrical preliminaries — allow $15–$30/lm of additional cable run for alarm interconnection. Complex multi-level homes: $200–$600 extra for interconnection wiring.",
    "Alarm testing and commissioning: included in electrician's rate for new installations. Request test certificate from electrician.",
    "Heat alarms in kitchens and garages (where smoke alarms are not suitable): $90–$200 each installed. Confirm locations with NCC Part 3.7.2.",
  ],
  "as24": [
    "Emergency and exit lighting (AS 2293): supply & install $250–$450 per combined exit/emergency luminaire (commercial). Separate exit signs $150–$300 each; emergency battens $180–$350 each. Count from lighting plan — typically 1 per 20m of egress path.",
    "90-minute battery backup requirement: verified at commissioning by 90-minute discharge test. Ensure correct battery capacity is specified and that the product on the approved list matches the specified runtime.",
    "Monthly test switch and annual test facility: allow $50–$120 per luminaire for addressable monitoring systems in larger commercial projects. Manually-tested systems require a test switch accessible from floor level.",
    "3-yearly full discharge test (owner's obligation post-handover): $500–$2,000 per building. Note this as an ongoing owner maintenance cost in the O&M manual.",
  ],
  // ── Electrical ───────────────────────────────────────────────────────────────
  "as25": [
    "Electrical installation (AS/NZS 3000): rough-in and fit-off typically $10,000–$20,000 for standard Class 1a house (sub-board, 10–15 circuits, GPOs, lights, ranges, hot water). Get detailed quote from electrician — rates vary significantly by state and market.",
    "Sub-board and main switchboard: $2,500–$6,000 for standard residential MEN board. Commercial MDB (main distribution board): $5,000–$25,000+ depending on fault rating, number of ways, and monitoring. Always specify fault level (kA rating) from supply authority data.",
    "Underground service from boundary to sub-board: $80–$150/lm for underground cable in conduit. Measure cable route length accurately — often under-estimated on large allotments.",
    "Earthing system: included in wiring rules compliance. Verify earth rod installation by electrician — often missed from rough-in scope.",
    "Test and tag, compliance testing, and Certificate of Electrical Safety: $200–$600. Must be completed before occupation certificate. Electrician provides — confirm inclusions.",
  ],
  "as26": [
    "Fire sprinkler system (AS 2118.1): all-in supply, install, and commission costs for commercial buildings: $25–$55/m² of floor area (wet pipe standard system). High-bay warehouses, cold stores, special hazard systems: $60–$150/m².",
    "Hydraulic design by licensed hydraulic engineer: $3,000–$8,000 for typical commercial building. Included in sprinkler subcontract or separate engagement — clarify early. Design must be approved by fire authority before installation.",
    "Water supply infrastructure (pump sets, tanks, boosters): $15,000–$80,000+ depending on system demand and site water supply. Pump set alone: $12,000–$40,000. Often missed from building budget — check hydraulic design for required supply.",
    "Fire authority inspection and commissioning: $1,500–$4,000 for witness test. Annual maintenance (AS 1851): $2,000–$8,000/year — note this is an ongoing owner cost.",
    "Sprinkler head zone count: a typical 1,000m² floor plate has 80–150 sprinkler heads. Heads $20–$80 each depending on type (upright, pendant, sidewall, concealed). Concealed heads add $40–$80 per head — costly on large floor plates.",
    "Flow switch, alarm valve set, and isolation valves: $2,000–$8,000 per zone/floor. Don't omit this from your scope — it's separate from the pipe and head cost.",
  ],
  "as27": [
    "Fire detection and alarm system (AS 1670.1): all-in design, supply, install, and commission: $8,000–$20,000 for a 500–1,000m² commercial building. Larger buildings: $15–$40/m² of floor area.",
    "FACP (fire alarm control panel): $3,000–$12,000 depending on size (number of zones, addressable vs conventional). Addressable systems (individually identified detector) preferred for buildings >1,000m².",
    "Integration with BAS (building automation system): $2,000–$8,000 for HVAC integration (fire mode shut-down/changeover). Often missed from both fire detection and mechanical budgets.",
    "Annual service certification: $1,500–$4,000/year ongoing (owner cost). Note in O&M manual.",
    "Fire detection cabling must be FP200 or equivalent fire-rated cable: $3–$8/lm compared to $1–$2/lm for standard cable. Entire detection system cabling must be fire-rated — allow for the premium in your electrical allowances.",
  ],
  "as28": [
    "Emergency and exit lighting (commercial, AS 2293.1): $250–$450 per luminaire fully installed. For a 1,000m² commercial floor: typically 20–40 luminaires = $5,000–$18,000 supply and install.",
    "Exit signs with emergency battery: $180–$350 each. Count all required signs — NCC requires exit signs visible from any point on an egress path, which means corner signs, door signs, and directional signs must all be counted.",
    "Monthly test and 3-yearly discharge test (ongoing owner cost): $800–$3,000/year for large buildings. Flag in O&M and defects liability period handover.",
    "Centralised battery systems vs self-contained luminaires: centralised battery reduces per-luminaire cost but adds $8,000–$20,000 for central plant; justified for buildings with 100+ luminaires.",
  ],
  "as29": [
    "Mechanical ventilation (AS 1668.2): air handling unit (AHU) supply and install: $8,000–$30,000 depending on capacity (1,000–10,000 L/s). Smaller FCU-based systems: $1,500–$5,000 per FCU. Get schedule of equipment from mechanical engineer.",
    "Ductwork supply and install: $80–$180/lm for rectangular galvanised ductwork (including fittings). Flexible duct: $30–$60/lm. Insulation on supply ductwork: $15–$35/m² of duct surface area — measure separately.",
    "Commissioning and air balancing: $3,000–$10,000 for a medium commercial project. Mandatory — without an air balance report the occupancy certificate will not issue. Do not skip.",
    "Energy recovery units: $5,000–$15,000 for a 2,000 L/s heat wheel or plate exchanger. Required by NCC energy provisions in many building types — confirm with mechanical engineer.",
    "CO₂ demand control ventilation (DCV): $2,000–$5,000 for sensors and controls upgrade per zone. Often specified but budgets miss the controller programming and BAS integration cost.",
    "Annual service and filter replacement: $2,000–$8,000/year per AHU (owner ongoing cost). Note in O&M manual.",
  ],
  // ── Accessibility ─────────────────────────────────────────────────────────────
  "as30": [
    "Accessible ramps (AS 1428.1): $1,500–$4,500 per ramp (concrete or steel, standard rise). Include handrails on both sides, tactile TGSI at top and bottom, and non-slip surface. Often missed from landscape and civil scopes.",
    "Accessible toilet fitout: $8,000–$18,000 for a compliant single unisex accessible toilet (sanitary ware, grabrails, circulation space, privacy, signage). Larger dual-access toilets: $18,000–$35,000. Never price at standard toilet fitout rates.",
    "Tactile TGSI (AS 1428.4.1): $100–$250/lm for stainless steel embedded TGSIs. Count at all stairs, ramps, and hazard locations from accessibility report.",
    "Accessible parking spaces: $2,000–$5,000 each for line marking, signs, and kerb cuts. 3,200mm wide minimum — costs an extra car space in the layout.",
    "DDA access report by access consultant: $2,000–$6,000. Required for all public-access commercial buildings — engage early as report identifies compliance requirements that drive scope and cost.",
    "Accessibility consultant review of documentation: $1,500–$4,000 during design. Catching non-compliance during design is dramatically cheaper than rectification after construction.",
  ],
  "as31": [
    "Thermal insulation (AS/NZS 4859.1): ceiling batts $8–$20/m² supply & install depending on R-value. Wall batts $10–$25/m². Floor underlay $8–$18/m². Bulk insulation R-values specified per NCC climate zone — confirm required R-values before pricing.",
    "Rigid insulation boards (EPS/XPS): $15–$40/m² for 50–100mm boards. Used in energy-efficient walls, inverted roofs, and under-slab for Zone 7/8. Higher cost than batts but allows thinner wall construction.",
    "Vapour barrier: $5–$12/m² supply & install. Mandatory in cooling-dominated climates on the warm side of insulation. Often missed from insulation scope.",
    "Air sealing: $3–$8/m² for draught sealing tapes, foam sealant, and junction sealing. Increasingly important for NatHERS compliance — poorly air-sealed buildings fail energy compliance even with correct R-values.",
    "NatHERS certificate: $800–$1,500. Required for building permit. Cost increases with complexity — split-level houses, non-standard glazing ratios, or client-specified over-glazed designs require multiple simulation iterations.",
  ],
  // ── Gas ──────────────────────────────────────────────────────────────────────
  "as32": [
    "Gas installation (AS/NZS 5601.1): rough-in and fit-off for standard residential with 2–3 gas appliances: $3,000–$7,000. Commercial kitchen: $5,000–$15,000 depending on appliance count and gas load.",
    "Gas meter and service connection: $500–$2,500 depending on distance from main and required capacity. Apply to gas distributor (Jemena, AGN, Atco) 6–8 weeks before required — do not leave this late.",
    "Gas pressure test: required by certifier before connection. Included in gasfitter's scope. Certificate of compliance must be obtained.",
    "Flexible connectors to appliances: $40–$120 each. Every gas appliance needs a flexible connector — count appliances and include.",
    "LPG systems (where mains gas unavailable): LPG cylinder manifold $800–$2,500 plus cylinder hire/purchase. Regulator, excess flow valve, and first and second stage regulation must be included.",
  ],
  // ── Fire Safety (original entries) ────────────────────────────────────────────
  "as33": [
    "Fire-resistant wall construction: standard 90/90/90 FRL on light steel stud with 2 layers 13mm fireboard each side: $80–$130/m² supply & fix. Masonry fire wall: $150–$250/m². Always confirm FRL from fire engineer's design — never assume standard construction achieves required rating.",
    "Fire-rated doorsets (AS 1905.1): $1,200–$2,500 for 60-minute FD60 standard door; $1,800–$4,000 for FD90; custom sizes and fire-rated glazing add $500–$2,000 per door. Count all fire doors from the fire compartment plan.",
    "Fire door frames: $300–$700 each — often omitted from door schedule pricing. Steel frames required for many fire door assemblies. Confirm frame type from door schedule.",
    "Intumescent seals to fire doors: $80–$200 per door set (top, sides, bottom). Often excluded from door supply price — confirm inclusions.",
    "Fire door hardware (closers, latches): $150–$400 per door — must be certified for fire door use; standard door hardware is NOT compliant. Allow separately from standard hardware schedule.",
  ],
  "as34": [
    "TGSI supply and install: stainless steel bar TGSIs $80–$150/lm embedded; adhesive-applied TGSIs $40–$80/lm. Count lineal metres at all stair heads, ramp tops, hazard locations. Often missed from tiling/paving scope.",
    "LRV (Luminance Reflectance Value) contrast assessment: $800–$2,000 by access consultant. Required to verify TGSIs and tactile areas achieve 30% LRV difference from surroundings before finishes are locked in.",
    "Replacement of non-compliant TGSIs post-installation: $300–$800 per location — include LRV check during design to avoid costly rectification.",
    "Directional TGSIs in large concourses: allow $150–$300/lm for bar-type directional indicators. Count runs from accessibility report.",
  ],
  "as35": [
    "Roof tiles supply & lay: concrete tiles $60–$100/m² (plan area); terracotta tiles $100–$160/m². Measure on roof plan area — add 10–15% for hips, valleys, and cutting waste on complex roof forms.",
    "Polymer-modified ridge and hip pointing: $30–$60/lm for bed and point supply & labour. Measure all ridge and hip lengths. Under-specification of mortar mix (no polymer) is a latent defect — insist on polymer-modified mortar.",
    "Cyclone mechanical fixings (every tile): add $8–$15/m² to standard tile rate in C1+ areas.",
    "Valley flashing: $40–$80/lm for stepped metal valley. Measure all valley lengths separately.",
    "Tile battens: $10–$20/m² supply & fix. Included in most roof tiling quotes but confirm — batten size varies by tile weight and wind class.",
    "Sarking/roof underlay: $8–$15/m² supply & install. Mandatory under tiled roofs in most climate zones — often excluded from tiler's scope and needs a separate allowance.",
  ],
  "as36": [
    "Temporary site electrical (AS 3012): site power connection $800–$2,500 network provider fee + $500–$1,500 internal distribution board. Total site power setup $1,500–$4,500 for Class 1a. Allow $300–$800/month for energy consumption.",
    "RCD-protected leads and tools: electrician to provide and maintain. If using your own plant, budget $20–$50 per RCD (portable) per set. Daily inspection is an on-costs labour item — include in preliminaries at $0.25–$0.50/hr per tradesperson.",
    "Generator hire (if mains power unavailable): $150–$400/day for a 10–20 kVA diesel generator. Fuel allowance: $50–$120/day depending on load. Include in preliminaries for remote sites.",
    "Tag and test of all leads and tools: $5–$15 per item. Required at 3-monthly intervals on active construction sites. Budget this as a periodic cost in preliminaries.",
  ],
  "as37": [
    "Main switchboard (MDB) commercial (AS/NZS 61439): $6,000–$25,000 depending on incoming supply capacity (kA fault level), number of circuits, and monitoring requirements. Obtain fault level data from supply authority before pricing — higher fault rating = higher board cost.",
    "Sub-distribution boards (SDB): $1,500–$6,000 each depending on size and type testing category. Large buildings: multiple SDBs, one per floor or per tenancy.",
    "As-built switchboard drawings (inside each board): $300–$800 per board for a competent draftsperson to produce after installation. Mandatory — include in electrical preliminaries.",
    "BMS/BAS interface wiring and programming: $2,000–$8,000 per switchboard for integration with building automation. Often missed from electrical and BAS budgets separately.",
    "Metering for NCC Section J energy monitoring: $500–$2,000 per sub-meter. Count sub-meters from energy monitoring strategy.",
  ],
  "as38": [
    "Structural engineer's loading report/calculations: $1,500–$5,000 for a standard commercial building structural design package. Always required — do not design structures without a licensed structural engineer confirming compliance with AS 1170.1.",
    "Balustrade design loads (0.6 kN/m at residential, 1.5 kN/m at public areas): balustrade prices vary significantly between residential and public-use applications. Post-fixed balustrades for public areas: $600–$1,200/lm vs $300–$600/lm residential.",
    "Construction load allowances on suspended slabs: if concrete is placed during construction before the structure below has achieved design strength, a temporary propping analysis is required — $800–$2,000 engineering cost, plus shoring supply.",
    "Deflection limits: commercial floors often require stiffer design for partition walls and brittle finishes. Engineering to achieve L/500 deflection (vs standard L/300) may increase structural steel or concrete quantities by 10–20%.",
  ],
  // ── New Concrete Entries ───────────────────────────────────────────────────────
  "as41": [
    "Ready-mix concrete unit rates (2024 market): standard 25 MPa Class A/S slab mix $130–$165/m³; 32 MPa Class M $150–$185/m³; 40 MPa exposure Class B2 $175–$220/m³; 50 MPa Class C1/C2 marine mix $200–$260/m³. Always confirm current batch plant prices — concrete is volatile with cement cost movements.",
    "Concrete pump hire (on top of concrete cost): 28m boom pump $900–$1,500/day (up to 80m³/hr); 36m boom pump $1,200–$2,200/day; line pump $600–$1,000/day. Always include separately — rarely included in concrete rate.",
    "NATA testing programme: allow $400–$700 per pour event (2 cylinders at 7-day + 2 at 28-day, slump, air, temp). On large projects with multiple pour events: $3,000–$8,000 total testing budget.",
    "Concrete wastage and over-order allowance: 5–8% over the calculated volume. A short delivery (running out of concrete mid-pour) creates a cold joint — remediation cost $2,000–$10,000 depending on element. Always over-order slightly.",
    "Hot or cold weather concrete surcharges: ice/chilled water batching in summer adds $10–$25/m³; accelerating admixtures in winter add $8–$18/m³. Include a provisional sum of $2,000–$5,000 for weather adjustments on large pours.",
    "Exposure classification upgrade cost: if soil or water testing reveals sulfates or chlorides on site, the mix design must be upgraded — this can add $30–$60/m³ to concrete cost and may require a specialist mix design by a concrete technologist ($1,500–$3,000 fee).",
  ],
  "as42": [
    "Formwork for suspended slabs: $80–$160/m² of slab area (total all-in including hire, erect, strip, and clean). Table forms are more cost-effective for large repetitive floor plates — specialist formwork subcontractor required.",
    "Slab edge formwork only: $25–$50/lm for standard slab edge. Rebated edges, architectural reveals, or chamfers: $40–$80/lm. Measure all edge perimeters from plans.",
    "Reshoring to lower levels: allow $20–$40/m² of floor area for each reshored floor. On a 4-storey building, level 4 pours require reshoring on levels 1, 2, and 3 simultaneously — this is a significant temporary works cost often missed.",
    "Formwork for columns and walls: $150–$300/m² of formed face (both faces included). Architectural concrete requiring face quality: $250–$450/m² with higher-quality ply and more careful placement.",
    "Stripping delay cost: if concrete gains strength slower than expected (cold weather, low-early-strength mix), stripping is delayed — this ties up formwork hire equipment, adds cost, and delays the programme. Include a 5% contingency on formwork cost for weather delays.",
    "Engineer's formwork design (multi-storey or complex): $1,500–$4,000. Mandatory for sequential loading calculations. Include in structural engineering fee.",
  ],
  "as43": [
    "Liquid-retaining concrete structures: premium over standard construction ranges from 25–60% depending on crack width requirements — extra reinforcement, more rigid formwork tolerances, waterstops at joints, and extended curing all add cost.",
    "Waterstops at construction joints: $25–$60/lm for PVC waterstop (50mm or 75mm wide) supply and install. Measure all construction joints in tanks, basement walls, and pits — commonly 2–4 joints per wall element.",
    "Hydrophilic waterstop (swelling type): $20–$40/lm — cheaper to install than PVC strip type but must be protected from pre-wetting before concrete pour; use in less critical joints.",
    "Internal coating or lining (for water quality): $15–$50/m² for food-grade epoxy or cementitious coating to internal faces of tanks. Measure all wet faces. Required for potable water tanks under AS/NZS 4020.",
    "Flood test (hydraulic test): $500–$1,500 for set-up, monitoring over 7 days, and documentation by hydraulic engineer. Must be allowed in programme — 7–14 days for filling, stabilisation, and monitoring before structure is accepted.",
    "Specialist waterproof concrete subcontractor: premium of 15–25% over standard concrete subcontract. Specialist knowledge of crack control, curing, and construction joints is justified — do not let a general concreter price this without experience in liquid-retaining structures.",
  ],
  // ── Waterproofing ─────────────────────────────────────────────────────────────
  "as44": [
    "Wet area membrane supply & apply: liquid waterproofing (polyurethane or cementitious) $30–$60/m² for two coats. Sheet membrane (self-adhesive bitumen or HDPE) $60–$100/m² including laps and sealing. Measure net floor area plus 25mm × wall perimeter for upstands.",
    "Shower enclosure waterproofing (all-in per shower): $350–$700 for floor + walls to 1800mm + floor waste + penetrations. Most expensive per m² item in waterproofing — get shower count from drawings and price each as a unit.",
    "Flood test requirement: no separate fee but requires scheduling — 24 hours ponding before tiler returns. Programme a minimum 48–72 hour break between membrane application and tiling start. Any rework requires full re-test.",
    "Balcony and external deck waterproofing: $80–$150/m² for traffic-bearing membrane system (including protection board). Drainage cell and geofabric add $15–$30/m². Measure separately from internal wet areas.",
    "Waterproofing certification from applicator: obtain a compliance certificate and product warranty document at practical completion. Missing these documents regularly become defect claim items — build the requirement into subcontract scope.",
    "Rectification risk: water ingress is the most common construction defect in residential buildings. A $500 saving on waterproofing can result in a $20,000–$80,000 defect rectification claim. Do not value-engineer membrane quality — specify to the standard and inspect.",
  ],
  "as45": [
    "Ceramic/porcelain tile supply & lay: floor tiles (standard 600×600) $80–$140/m² supply & lay; wall tiles (300×600) $70–$120/m². Large format (900×900+): add $20–$40/m² for increased handling and adhesive cost. Measure net areas — add 10% for cuts and waste.",
    "Tile adhesive (Type 2 polymer-modified for porcelain): $3–$7/m² material cost. Using cheaper Type 1 adhesive under porcelain is a latent defect — delamination within 2 years is common. Specify adhesive type in subcontract scope.",
    "Grout (standard non-sanded): $2–$4/m² for material. Epoxy grout (wet areas or commercial kitchens): $8–$18/m² — labour also increases significantly for epoxy. Specify grout type clearly.",
    "Movement joints (compressible filler + sealant): $15–$25/lm at all internal corners and field joints. A 30m² bathroom may have 20–30lm of movement joints — this is a real cost that is often missed.",
    "Waterproofing membrane beneath tiles (supplied by waterproofing contractor): tiler's scope starts at tiling — confirm clearly who supplies and applies the waterproofing. A grey area in many subcontracts leads to disputes.",
    "Tiling rectification cost: hollow tiles (loose adhesive bond) identified in defects period — $80–$180/m² to remove, re-waterproof where membrane is damaged, and re-tile. Prevention (correct adhesive, 95% coverage) is vastly cheaper than cure.",
  ],
  // ── Structural Framing (new) ──────────────────────────────────────────────────
  "as46": [
    "Cyclonic framing premium (AS 1684.4): add 30–50% to non-cyclonic frame cost. The premium comes from: hurricane straps at every rafter ($15–$30 each), chemically anchored bottom plate bolts at 600mm centres (nearly triple non-cyclonic bolt count), and thicker studs or closer spacing for wind classification.",
    "Hurricane strap count: every rafter and every truss requires a strap. Count: roof area ÷ rafter/truss spacing. A 200m² hip roof at 900mm truss spacing has ~90 trusses × 2 sides = ~180 straps at $20–$30 each installed = $3,600–$5,400 for straps alone.",
    "Debris-impact rated windows and doors in cyclonic areas: $400–$800/m² supply for tested glazing vs $150–$350/m² for standard. On a 200m² house with 40m² of openings, the window upgrade alone is $10,000–$18,000 premium.",
    "Engineer's cyclone certification: $1,500–$4,000 for Class 1a (more complex than non-cyclonic certificate). Include in preliminaries.",
    "Cyclone shutters (alternative to impact-rated glazing): $180–$400/m² of opening area for aluminium roller shutters. Cheaper than impact glass upfront but add maintenance obligations and may affect resale value.",
  ],
  "as47": [
    "Prefabricated roof trusses: $50–$90/m² of roof plan area supply and deliver. Crane to set trusses: $800–$2,500 (typically half a day). Erect and brace trusses (carpenter): $15–$30/m² of roof area. Total install cost: $75–$120/m².",
    "Girder truss: $200–$600 each depending on span. A hip roof typically requires 2–4 girder trusses. They are heavier than standard trusses and may require a 2-man lift or tag lines — include additional handling allowance.",
    "Truss lead time: 3–5 weeks from order to delivery. Order immediately upon DA approval — late truss orders are the most common programme delay on residential projects.",
    "Permanent bracing (bottom chord binders, diagonal braces): $1,000–$3,500 for Class 1a, depending on roof complexity. Specified by truss designer — include as a separate scope item, as it is often missed from rough carpentry rates.",
    "Tie-down strap count (truss to plate): same as rafter count in AS 1684 method. In N3+ areas, H2.5 straps required. Confirm strap specification from truss designer's connection schedule — not all standard hardware is compliant.",
    "Modification to trusses on site (cutting for services): requires engineer's approval and a modified truss or patch design — budget $500–$2,000 for engineer fees when service penetrations through trusses are required.",
  ],
  // ── Structural Steel (new) ───────────────────────────────────────────────────
  "as48": [
    "Structural steel fabrication and erection all-in: $600–$1,200/tonne for simple portal frames; $900–$1,600/tonne for complex multi-storey with moment connections. Always get a structural drawing take-off for tonnage — rule-of-thumb estimates are inaccurate for commercial steel.",
    "Steel connection design and documentation: $2,000–$6,000 as part of engineer's fee, or $50–$120 per connection detail. Complex connections (moment connections, large end plates) take longer to design — allow in engineer's fee estimate.",
    "NDT testing (ultrasonic testing of butt welds): $150–$400 per weld for UT. A large project may have 50–200 testable welds — include a testing provisional sum of $5,000–$20,000. Results required before protective coating.",
    "Hold point for weld inspection before painting: allow 1–2 days per inspection event. Failed welds require grinding back and re-welding — budget a 3–5% rectification allowance on weld inspection events.",
    "Protective coating: zinc primer + 2-coat enamel $20–$50/m² of steel surface. Intumescent fire-resistant coating: $80–$200/m² for 60–90 minute FRL. Measure steel surface area from fabrication drawings (not weight).",
    "Hot-dip galvanising as alternative to painting: $4–$8/kg. 5–10 working day lead time. Cost-effective for external steel, balustrades, and coastal applications. Confirm weld quality before galvanising — weld spatter and porosity causes galvanising defects.",
  ],
  "as49": [
    "Piling: screw pile supply and install $400–$900 each (200–300mm diameter, 3–6m depth). Bored concrete pile $600–$1,800 each (300mm dia, 6m deep). Driven precast concrete pile $300–$700/lm. Always get geotechnical report first — founding depth is unknown until the soil profile is characterised.",
    "Geotechnical investigation for piling: $3,000–$10,000 depending on number of boreholes/CPTs. Budget this as a pre-contract investigation cost — it defines the pile type, length, and capacity.",
    "Design Basis Report (DBR) by geotechnical engineer: $2,000–$5,000. Required before first pile. Also covers load testing program specification — factor this into the testing budget.",
    "Dynamic load testing (HSDA/PDA) per pile: $1,500–$3,000 including Capwap analysis. Typically 5–10% of installed piles tested. On a 50-pile project: $7,500–$15,000 testing budget.",
    "Static load test: $8,000–$20,000 per test (mobilise reaction frame, instrument pile, load to 200% design). Required for high-value piles, unusual ground conditions, or where dynamic testing is inconclusive.",
    "Pile cap construction: $800–$2,500 per cap (excavate, form, reo, pour) for a standard 800mm sq cap on a single pile. Group caps are larger and more expensive. Measure pile cap count and sizes from structural drawings.",
  ],
  // ── Fire Safety (new) ─────────────────────────────────────────────────────────
  "as50": [
    "Annual fire system maintenance contract (AS 1851): $2,000–$6,000/year for a 1,000–2,000m² commercial building with sprinklers, detection, hose reels, and extinguishers. Budget this as a building running cost in the ownership model — it is mandatory.",
    "Five-yearly enhanced maintenance (sprinklers, underground pipe inspection): $3,000–$10,000 additional over annual contract. Often ignored in owner budgets — note in O&M manual with indicative cost.",
    "Log book supply and initial setup: $300–$600. Ongoing maintenance record-keeping is owner responsibility — include in building management cost model.",
    "Critical defect rectification provisional sum: allow $2,000–$5,000/year in building budget for unexpected fire system component replacements (failed sprinkler heads, aged smoke detectors, discharged extinguishers).",
    "Fire authority inspection fees: $500–$2,000 for fire authority witness inspections at commissioning and at major maintenance events. Include in commissioning budget.",
  ],
  "as51": [
    "Fire hose reel supply and install: $800–$1,600 each fully installed (hose reel, 36m hose, cabinet, pipework to 3m from riser). Count number of reels from hydraulic drawings — required on each floor of commercial buildings, at maximum 36m hose throw.",
    "Booster pump (if mains pressure insufficient): $8,000–$20,000 for fire pump set (diesel and jockey pump). Required where static pressure at any reel is below 210 kPa. Confirm mains pressure from water authority data before pricing.",
    "Annual maintenance per reel: $80–$180 each per year (hose inspection, nozzle test, valve). Include in building running cost estimate.",
    "Hose reel cabinet (recessed vs surface mounted): surface-mounted cabinet $200–$400; recessed cabinet (requires nib wall or bulkhead): $400–$800 plus builder's work for niche. Confirm with architect early — recessed cabinets affect wall construction details.",
    "Commissioning test documentation: included in hydraulic subcontract scope. Confirm this is in scope and that test certificates are handed to the certifier — missing test documentation is a common certificate of occupancy delay.",
  ],
  "as52": [
    "Fire rating system cost by FRL type: 90/90/90 light steel stud + 2 × 13mm fireboard each side $80–$130/m²; 120/120/120 add 10–15%; masonry 90/90/90 $150–$250/m². Confirm FRL from fire engineer before pricing — FRL drives material and labour cost.",
    "FRL testing certificates for specified systems: supplied by manufacturer at no extra cost, but installer must be trained. Non-certified installers cannot provide compliance documentation — verify subcontractor is manufacturer-trained.",
    "Fire engineer's design package: $4,000–$15,000 for a medium commercial building (IFC documentation, FRL schedule, penetration design). This is a non-negotiable cost — include in preliminaries.",
    "Penetration sealing programme: typically 10–20% of fire rating subcontract value for the penetration sealing component. It is labour-intensive work — measure and count all penetrations through rated elements.",
    "Certificate of occupancy documentation: fire rating subcontractor to supply an FRL register and installation certificates. Cost: $500–$1,500 to prepare. Include in subcontract scope — missed at certificate of occupancy stage, it causes significant delays.",
  ],
  "as53": [
    "Fire-stopping products (collars, intumescent sealant, mineral wool): $80–$250 per penetration depending on pipe/duct size. On a large commercial project with 200–500 penetrations, total cost: $20,000–$80,000 including labour.",
    "Fire collar cost by pipe size: 50mm plastic pipe $40–$80 each; 100mm $80–$150; 150mm $150–$280. Labour to install: $40–$100 each depending on access. Count all penetrations through rated walls and floors from services coordination drawings.",
    "Fire-rated duct wrap (alternative to fire dampers): $30–$60/m² of duct surface (mineral fibre wrap system). More expensive than a damper for short runs but justified where damper access is impractical.",
    "Penetration register documentation: $500–$1,500 to prepare as-built penetration schedule. Required for BCA compliance documentation and ongoing building management. Include in scope.",
    "Fire-stopping inspection and certification: independent inspection by certifier $1,000–$3,000. Staged inspection is more efficient than final inspection — inspect each floor as penetrations are completed before ceilings close in.",
  ],
  // ── Safety ────────────────────────────────────────────────────────────────────
  "as54": [
    "Pool safety barrier supply and install: aluminium glass-and-post fence $300–$600/lm; glass panel frameless $500–$900/lm; pool mesh fence $60–$120/lm (cheapest option, most compliant for cost). Measure total fence perimeter on plan.",
    "Self-closing, self-latching gate: $400–$1,200 each (included in fence rate or separate item — confirm). Do not use standard hinges — spring-loaded gate hinges add $80–$180 to a standard gate.",
    "Council pool inspection fee: $300–$800. Mandatory before pool fills. Book well in advance — pool inspectors have long wait times in peak season. Delays to pool fill are a programme risk.",
    "Pool compliance certificate (lodge with council): included in inspection fee. Required before trading or occupying the property with an unregistered pool — $500–$2,000 per year fine for non-registration in most states.",
    "Pool equipment (not barrier compliance but often in scope): pump $1,500–$4,000; filter $1,000–$3,000; heater $2,000–$6,000; salt chlorinator $800–$2,000. Confirm pool equipment scope with builder and hydraulic engineer.",
  ],
  "as55": [
    "Retaining walls: sleeper wall (hardwood sleepers, 1m height) $350–$600/lm; concrete block (Besser/modular) $400–$800/lm for 1m; engineered concrete cantilever $800–$2,000/lm for 2m height. Height dramatically increases cost — price per linear metre at the required height.",
    "Drainage behind retaining wall: $30–$60/lm for slotted subsoil drain + washed gravel backfill. Measure total drainage run. Missing drainage behind retaining walls is both a common defect and a latent structural risk — include explicitly in scope.",
    "Geotechnical and structural engineering for walls >1m: $1,500–$4,000 for design of typical residential retaining. More for complex surcharges or tiered walls. Must be engaged before pricing — the engineer defines material, footing, and drainage requirements.",
    "Tiebacks or rock anchors (for deep excavation retaining): $500–$1,500 per tieback including drilling, grouting, and testing. Count from engineer's drawings. Specialist subcontractor required.",
    "Excavation and backfill: $30–$80/m³ of excavation; imported free-draining backfill $60–$120/m³ placed. Measure volume behind wall (wall height × thickness of drainage zone × length). Spoil disposal: $80–$150/tonne to tip.",
  ],
  // ── Solar ─────────────────────────────────────────────────────────────────────
  "as56": [
    "Residential solar PV system all-in (AS/NZS 4777.1 compliant): 6.6 kWp system (20 × 330W panels + 5 kW inverter) $5,500–$8,500 fully installed. 10 kWp $8,000–$12,000. Government rebate (STC) reduces upfront cost by $1,500–$3,500 depending on location and system size.",
    "Commercial solar (>100 kWp): $0.80–$1.20/Wp supply and install. A 200 kWp rooftop system: $160,000–$240,000. Structural engineering for roof loading: $2,000–$5,000 additional.",
    "DNSP application and connection fee: $200–$800 residential; $500–$3,000 commercial. Some DNSPs require network augmentation for large systems — allow provisional sum $3,000–$15,000 if system is >100 kWp.",
    "Battery storage (add-on): 10 kWh battery $8,000–$14,000 installed (including hybrid inverter upgrade if required). 20 kWh $14,000–$22,000. Battery cost per kWh is falling rapidly — get current pricing at tender.",
    "Certificate of Electrical Safety + CEC compliance paperwork: $200–$500. Must be provided to owner before system activation. Missing paperwork prevents STCs from being redeemed.",
  ],
  "as57": [
    "Residential PV array cost breakdown: panels ($0.25–$0.40/Wp), mounting system ($0.08–$0.15/Wp), DC cabling and connectors ($0.05–$0.10/Wp), DC isolator ($0.02–$0.05/Wp). Labour for roof installation: $800–$2,500 for residential array up to 30 panels.",
    "Roof penetrations (entry conduit and cabling): $150–$400 for waterproof cable entry. The most common long-term maintenance issue with solar installations — use purpose-designed flashing, not DIY silicone sealing.",
    "String combiner boxes (for large arrays with parallel strings): $500–$2,000 each depending on number of string inputs and fuse rating. Required for arrays with more than 2 strings in parallel.",
    "DC cable runs: $3–$8/lm for twin-core solar cable in conduit. On large commercial systems with long runs from array to inverter room, cable cost can be significant — measure route length from roof to inverter location.",
    "Array earthing and bonding: included in electrical labour but budget $200–$500 for earth continuity conductors and clamps on large commercial systems.",
  ],
  // ── Mechanical ────────────────────────────────────────────────────────────────
  "as58": [
    "Rigid ductwork supply and install: $80–$180/lm for rectangular galvanised ductwork (including standard fittings at 20% of straight run cost). Measure total ductwork length from mechanical drawings — separate supply, return, and exhaust runs.",
    "Ductwork insulation: $15–$35/m² of duct surface area. Measure duct surface area = 2 × (width + height) × length for rectangular. All supply ducts outside conditioned space must be insulated — common scope gap on commercial projects.",
    "Flexible duct (last 600–1500mm to each diffuser): $25–$55/lm. Count number of diffusers × 1m average flex length. Flexible duct is quick to install but has higher resistance — do not exceed 1.5m length or allow kinking.",
    "Fire dampers at rated boundaries: $300–$800 each supply and install (includes sleeve and access panel). Count all fire-rated wall and floor penetrations from co-ordinated services drawings. Access panels: $150–$350 each — measure count separately.",
    "Leakage testing (Class B ductwork): $1,500–$4,000 per system for pressure test including test equipment hire and documentation. Allow one test per floor or zone. Failed sections require re-sealing — allow a 5% rectification contingency.",
    "Commissioning and air balance: $3,000–$10,000 for medium commercial. Without this, NCC compliance cannot be verified and the occupation certificate will not be issued. Do not omit from mechanical subcontract scope.",
  ],
  "as59": [
    "Fire/smoke HVAC controls package: $5,000–$18,000 depending on number of HVAC zones and BAS integration complexity. Often split between HVAC subcontractor (physical dampers and fans) and controls subcontractor (wiring and programming) — confirm scope boundaries early.",
    "Stairwell pressurisation system: $12,000–$35,000 per stairwell for supply fan, controls, and distribution ductwork. Required in all Class 2–9 buildings with more than 2 storeys above or below ground. Do not miss from fire engineering design.",
    "Smoke exhaust fans for atria and large open spaces: $5,000–$20,000 per exhaust point. High-temperature-rated fans (for smoke duty) are 2–3× the cost of standard exhaust fans — specify correctly.",
    "Fire mode commissioning test (witness test with certifier): $2,000–$5,000. Mandatory. Book well in advance — certifiers and fire authorities have tight schedules. Programme 4–6 weeks minimum before expected occupation certificate.",
    "Ongoing fire mode testing (annual): $1,500–$4,000/year. Owner obligation. Include in O&M manual.",
  ],
  // ── Construction Safety ───────────────────────────────────────────────────────
  "as60": [
    "Scaffold hire (perimeter, double-storey Class 1a): $150–$280/week supply and erect from licensed scaffolder. Typical build programme 20–30 weeks: $3,000–$8,400 total scaffold cost. Add $800–$2,000 for erect and dismantle.",
    "Scaffold for commercial high-rise: $30–$70/m² of building elevation area per month hire. For a 4-storey, 400m² elevation building: $12,000–$28,000/month. Programme-sensitive — scaffold mobilisation takes 1–2 weeks and must align with cladding and façade work.",
    "Mobile scaffold (single trades, internal): $80–$250/week hire from equipment supplier. Purchase option: $800–$2,500 for a standard 2m × 1m tower.",
    "SafeWork scaffold inspection at erection, alteration, and monthly: included in scaffolder's scope for licensed work. For self-erected scaffold (sub-4m), designate a competent person on site — there is no additional cost but must be documented.",
    "Scaffold register and safety inspection paperwork: no direct cost if managed internally. If using an external safety consultant: $500–$1,500 for initial site setup and register template.",
    "Scaffold tie-in to building structure: discuss with façade subcontractor — tie-in points must be confirmed before cladding commences to avoid removing and re-installing cladding panels to access tie points.",
  ],
  "as61": [
    "Pre-demolition HAZMAT survey: $1,500–$5,000 depending on building age, size, and complexity. Do not skip — discovering asbestos after demolition starts is extremely costly. Include as a pre-contract task.",
    "Asbestos removal (bonded/non-friable): $15–$40/m² for sheeting removal by Class B licenced contractor. Add clearance inspection by independent licenced assessor: $800–$2,000. Allow for disposal to approved landfill: $300–$800/tonne.",
    "Friable asbestos removal (pipe insulation, backing board, textured coatings): $80–$200/m² by Class A contractor. 3× more expensive than bonded — costs escalate rapidly when friable ACMs are found. Always allow a contingency when demolishing pre-1990 buildings.",
    "Demolition plan by structural engineer: $1,500–$4,000 for partial demolition of a Class 1 building. Full demolition of a commercial building: $3,000–$8,000. Required before work commences — certifier and council may require it as a condition of consent.",
    "SafeWork notification fee: $0 in most states (notification only). However, the cost of non-compliance (site shutdown, remediation) is unbounded — always notify regardless of whether the threshold applies.",
    "Demolition waste disposal: $80–$150/tonne to tip (general C&D waste). Separate concrete for recycling: $20–$50/tonne (crusher). Separate steel for scrap: recover $80–$200/tonne offset. Good sorting reduces net disposal cost.",
    "Temporary propping during partial demolition: $2,000–$8,000 engineering design + $1,000–$4,000 hire and erect. Required whenever a structural element is removed that supports other structure. Never start demolition without propping in place.",
  ],
  "as62": [
    "Fixed access stairs (AS 1657) supply and install: standard galvanised steel open riser stairs $800–$1,500/riser (all-in). 12-riser stair: $9,600–$18,000. Architectural or stainless: 2–3× these rates.",
    "Fixed ladders with cage or fall arrest rail: $400–$800/lm for caged ladder; $300–$600/lm plus $600–$1,200 for fall arrest rail system. Count ladder height from drawings and select cage vs rail based on access frequency.",
    "Platforms and walkways (maintenance access): $600–$1,200/m² of platform area for grating platform with handrails. Handrails only: $150–$350/lm. Stanchion post: $150–$350 each.",
    "Anti-slip grating: $80–$200/m² supply only. Installed $100–$250/m². Open bar grating is self-draining (preferred in wet/industrial) but more expensive than chequered plate.",
    "Roof anchor points for fall arrest: $800–$2,000 each supply and install (structural engineer design required). Count anchor points from WHS safe access plan — typically 1 per 30–50m² of roof maintenance area.",
    "Engineer's certification of platforms and ladders: $1,000–$2,500. Required for all platforms and ladders in commercial/industrial buildings. Include in structural package.",
  ],
  // ── Plumbing ─────────────────────────────────────────────────────────────────
  "as63": [
    "Residential plumbing rough-in and fit-off: $8,000–$18,000 for a standard 3–4 bedroom house (all fixtures, hot and cold water, drainage, roof drainage, gas connection point). Get detailed breakdown from plumber — rates vary by state and city.",
    "Hot water system: gas continuous flow (Rinnai, Bosch) $1,200–$2,500 supply and install; electric heat pump $2,500–$4,500; solar with gas boost $3,500–$6,500. Specify clearly — hot water system type affects gas sizing, electrical load, and energy compliance.",
    "Overflow relief gully (ORG): $300–$600 supply and install. Mandatory on every new dwelling — never omit. External drainage connection to legal point of discharge: $500–$2,500 depending on distance to stormwater or sewer.",
    "Backflow prevention device: $300–$800 each where required by water authority (commercial, irrigation, multi-unit). Count from hydraulic design. Annual testing: $150–$300/device/year (owner ongoing cost).",
    "Roof and stormwater drainage: $50–$120/lm for PVC downpipe supply and install. OSD (on-site detention) tank: $2,000–$8,000 supply and install. OSD design by hydraulic engineer: $1,500–$3,500. Required by most councils for new or extended impervious areas.",
    "Plumbing inspection certificate (Certificate of Compliance): included in plumber's scope but must be handed over at completion. Missing plumbing certificate is a regular practical completion dispute item.",
  ],
  "as64": [
    "WaterMark product premium: WaterMark certified fittings cost 15–40% more than uncertified equivalents. Do not substitute with non-WaterMark items to save money — it is a licensing offence for the plumber and creates liability for the builder.",
    "Low-lead brass fitting premium: low-lead brass (post-2014 compliant) costs $0.50–$3.00 more per fitting than pre-2014 equivalents. For a full house fit-off with 150–200 fittings, the premium is $100–$400 — worth it to avoid liability.",
    "Potable water testing (commercial projects): $500–$1,500 for water quality test at commissioning (lead, copper, bacteria). Required by health authorities for hospitals, schools, and large commercial kitchens. Include as a commissioning cost.",
    "Documentation: obtain and file product WaterMark licence numbers for all installed plumbing products. Good record-keeping takes 2–4 hours but prevents ongoing liability issues in commercial buildings where the building owner may face regulatory audit.",
    "Water main connection: $1,500–$5,000 for residential water main connection (depends on distance to main, metered or unmetered service, and authority fees). Water authority fees vary enormously by council/city — check before pricing.",
  ],
  // ── Accessibility (new) ───────────────────────────────────────────────────────
  "as65": [
    "DDA access compliance consultant: $2,500–$8,000 for a full access report and design review on a medium commercial project. Required early — access requirements discovered late in design are far more expensive to incorporate. Access consultant is one of the best-value investments in design.",
    "Accessible toilet (AS 1428.2 enhanced — 2200×2200mm): $12,000–$25,000 fitout (sanitary ware, grabrails, larger space coordination, signage, door hardware). Always price at 3–4× standard accessible toilet rate.",
    "Grabrails (slip-resistant, correctly positioned): $300–$600 each supply and install. Penthouse suites, aged care, and healthcare: all accessible toilets and shower recesses need multiple rails. Count rail quantity from access consultant's documentation.",
    "Tactile TGSI at stairs and hazard locations: $100–$250/lm embedded stainless; $60–$120/lm adhesive. Count lm from accessibility drawings — typically 5–10 locations per floor in a commercial building.",
    "Accessible ramps: $2,000–$6,000 each (concrete, with handrails, non-slip surface, TGSIs top and bottom). Measure count from access report — ramps are often required at building entry, car park, and between tenancy levels.",
    "Lift (to AS 1735.12): $45,000–$90,000 for a standard 2-stop passenger lift. 4-stop lift in 4-storey commercial: $90,000–$160,000. Lift shaft construction: $25,000–$60,000 additional depending on pit depth and overhead clearance.",
    "Access audit at practical completion: $800–$2,500 for access consultant to verify as-built compliance. Catching defects before the certifier's inspection avoids hold points and rework — include as a construction stage cost.",
  ],
};

// ── Scope of Works Database ───────────────────────────────────────────────────

interface SOWItem {
  id: string;
  trade: string;
  item: string;
  unit: string;
  buildingClasses: string[];  // which NCC classes this applies to
  condition?: string;          // conditional trigger (e.g. "Suspended floor only")
  estimateNote: string;        // what drives cost/quantity for estimating
}

const SOW_DB: SOWItem[] = [
  // ── PRELIMINARIES ──────────────────────────────────────────────────────────
  { id:"sw1",  trade:"Preliminaries",         item:"Site establishment — temp fencing, site shed, toilets, skip bins, signage", unit:"sum", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"Class 1a: allow $5,000–$15,000 depending on site access, council requirements, and duration. Multi-storey: add hoarding and crane base costs." },
  { id:"sw2",  trade:"Preliminaries",         item:"Council DA/BA fees, building permits, occupation certificate", unit:"sum", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"Typically 0.5–1.5% of works value for DA + BA. Add certifier fee ($3,000–$8,000 Class 1a), soil report ($500–$1,500), NatHERS certificate ($800–$1,500), BAL assessment if BPA ($800–$2,000)." },
  { id:"sw3",  trade:"Preliminaries",         item:"Site survey and set-out — registered surveyor, offset pegs, slab set-out", unit:"sum", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"$1,000–$2,500 for Class 1a survey. Budget for re-set-out after slab pour. Multi-storey buildings require additional floor-by-floor surveys." },
  { id:"sw4",  trade:"Preliminaries",         item:"Scaffolding — perimeter scaffold and/or mobile scaffold throughout works", unit:"wks", buildingClasses:["1a","1b","2","3"], estimateNote:"Perimeter scaffold double-storey: $150–$250/week. Single-storey: $80–$150/week. Allow for full framing, cladding, and painting duration plus 2-week clearance." },
  { id:"sw5",  trade:"Preliminaries",         item:"Waste removal — general construction waste, skip bin hire, tipping fees", unit:"sum", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"Budget $80–$150/tonne for disposal. Class 1a new build typically generates 15–25 tonnes. Asbestos removal is separate (licensed) — confirm pre-demolition audit." },
  { id:"sw6",  trade:"Preliminaries",         item:"Temporary power — site power connection, metering, distribution board", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"Endeavour/Ausgrid/AusNet/etc temporary supply: $800–$2,500 connection fee + monthly charge. Allow for full build duration." },

  // ── SITEWORKS & EARTHWORKS ─────────────────────────────────────────────────
  { id:"sw7",  trade:"Siteworks & Earthworks", item:"Demolition — existing structures, slab breaking, removal off-site", unit:"sum", buildingClasses:["1a","1b","2","3","10a"], condition:"Existing structures on site", estimateNote:"Class 1a house demolition: $8,000–$25,000 depending on size, material (brick vs timber), and access. Asbestos: add $3,000–$15,000 for licensed removal + clearance cert." },
  { id:"sw8",  trade:"Siteworks & Earthworks", item:"Bulk earthworks — cut, fill, trim to design levels; compaction to 95% Std", unit:"m³", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"$35–$80/m³ depending on material (clay, rock, fill). Rock excavation can double cost — budget contingency if site history unknown. Compaction test required for fill ≥300mm deep." },
  { id:"sw9",  trade:"Siteworks & Earthworks", item:"Imported fill — engineered fill for site level or footing support", unit:"m³", buildingClasses:["1a","1b","2","3","10a"], condition:"Fill site — Class P or low-lying site", estimateNote:"$60–$120/m³ placed and compacted including supply. Fill must be tested to AS 1289 — compaction certificates required before slab pour for Class P sites." },
  { id:"sw10", trade:"Siteworks & Earthworks", item:"Subsoil drainage — perforated pipe in aggregate, geofabric wrap to stormwater", unit:"lm", buildingClasses:["1a","1b","2","3"], condition:"Required on sloping sites or high water table", estimateNote:"$50–$120/lm for residential subsoil drain. Required on any site with surface water or groundwater ingress risk — often missed in estimates on flat-appearing sites." },
  { id:"sw11", trade:"Siteworks & Earthworks", item:"Site stormwater drainage — pits, pipes, OSD tank, connection to legal discharge", unit:"sum", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"Class 1a: $3,000–$10,000 for typical site drainage. On-site detention (OSD) required in most councils for new or enlarged impervious areas — adds $2,000–$8,000 for tank + overflow structure." },
  { id:"sw12", trade:"Siteworks & Earthworks", item:"Tree removal and stump grinding", unit:"ea", buildingClasses:["1a","1b","2","3","10a"], condition:"Trees on or near site", estimateNote:"$500–$5,000+ per tree depending on size. Council tree removal permits required for protected species. Allow for grinding + disposal of stumps and chips separately." },

  // ── CONCRETE & FOOTINGS ────────────────────────────────────────────────────
  { id:"sw13", trade:"Concrete & Footings",   item:"Termite management system — physical barrier full perimeter + penetrations (AS 3660.1)", unit:"lm", buildingClasses:["1a","1b","2","3"], estimateNote:"Physical mesh barrier: $80–$150/lm external perimeter. Chemical soil treatment: $1,500–$3,500 for Class 1a. Must be installed before slab pour and certified by licensed installer." },
  { id:"sw14", trade:"Concrete & Footings",   item:"Slab on ground — Class A/S site — 100mm slab, 200mm edge beam, SL82 mesh, N12 bars", unit:"m²", buildingClasses:["1a","1b","2","3","10a"], condition:"Class A or S soil — standard reactive site", estimateNote:"$100–$160/m² all-in for Class A/S slabs (formwork, reo, concrete, pump, power float). Includes DPC and 200mm perimeter edge beam." },
  { id:"sw15", trade:"Concrete & Footings",   item:"Slab on ground — Class M site — stiffened raft, 300mm edge beam, internal beams at 4m ctrs", unit:"m²", buildingClasses:["1a","1b","2","3"], condition:"Class M soil — moderately reactive", estimateNote:"$140–$220/m² for Class M stiffened raft. AS 2870 Table 4.1 governs beam depths and spacing. Engineer design may be required depending on slab dimensions." },
  { id:"sw16", trade:"Concrete & Footings",   item:"Slab on ground — Class H1/H2 site — engineered raft slab, deep beams", unit:"m²", buildingClasses:["1a","1b","2","3"], condition:"Class H1 or H2 soil — highly reactive", estimateNote:"$200–$350/m² for H-class engineer-designed slab. Requires geotechnical report, engineer design, and certifier sign-off on reinforcement before pour." },
  { id:"sw17", trade:"Concrete & Footings",   item:"Suspended ground floor slab — post-tensioned or reinforced over void former", unit:"m²", buildingClasses:["2","3"], condition:"Class 2/3 multi-storey or elevated ground floor", estimateNote:"$220–$380/m² for suspended slab with post-tensioning (void former over reactive soil). Shoring required during pour. Engineer design and ITP mandatory." },
  { id:"sw18", trade:"Concrete & Footings",   item:"Strip footings — concrete strip and pad footings for masonry/steel construction", unit:"lm", buildingClasses:["1a","1b","2","3"], condition:"Masonry or commercial construction", estimateNote:"$180–$350/lm for 600mm wide strip footing. Depth varies with site class. Include reo, formwork, and concrete — price per lineal metre of footing." },
  { id:"sw19", trade:"Concrete & Footings",   item:"Concrete stair — cast in-situ reinforced concrete stair with landing", unit:"flight", buildingClasses:["2","3"], condition:"Multi-storey concrete construction", estimateNote:"$3,500–$8,000 per straight flight (12–15 risers) cast in-situ. Include formwork (typically left-in plywood), reo, pour, and Finish. Engineer design required." },
  { id:"sw20", trade:"Concrete & Footings",   item:"Concrete driveway, paths, and aprons — 100mm reinforced, power-float finish", unit:"m²", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"$80–$140/m² for 100mm power-float driveway. Exposed aggregate add $30–$60/m². Coloured concrete add $20–$40/m². Include edge forming and reo mesh." },

  // ── STRUCTURAL FRAMING ─────────────────────────────────────────────────────
  { id:"sw21", trade:"Structural Framing",    item:"Timber wall framing — 90×35 or 90×45 MGP10 studs, plates, noggins (AS 1684.2)", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$40–$80/m² of wall area for supply & erect (timber + labour). Stud spacing: 600mm ctrs (N1/N2), 450mm ctrs (N3/N4) — confirm wind classification. Add 15–20% for openings, corners, and waste." },
  { id:"sw22", trade:"Structural Framing",    item:"Steel stud wall framing — 1.15mm BMT external, 0.75mm BMT internal partitions (NASH Standard)", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$55–$95/m² for light gauge steel framing supply & erect. External walls: 1.15mm BMT minimum. Load-bearing walls: 1.6mm BMT — verify with manufacturer tables. Screw pattern critical for structural connections." },
  { id:"sw23", trade:"Structural Framing",    item:"Floor framing — suspended timber floor, bearers, joists, and subfloor piers/stumps", unit:"m²", buildingClasses:["1a","1b","2","3"], condition:"Suspended timber ground floor", estimateNote:"$90–$150/m² for bearer/joist floor frame including posts and concrete stumps. Verify bearer and joist sizes from AS 1684.2 tables based on span and spacing. Allow subfloor ventilation (3500mm²/m of external wall)." },
  { id:"sw24", trade:"Structural Framing",    item:"Roof trusses — prefabricated engineered trusses, including delivery and crane", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$50–$90/m² of roof plan area for supply and install (trusses + crane + erect). Truss design by manufacturer's engineer — provide span, pitch, ceiling type (flat/cathedral/attic), and wind classification to supplier." },
  { id:"sw25", trade:"Structural Framing",    item:"Roof framing — conventional rafters, ridge beam, collar ties (AS 1684.2)", unit:"m²", buildingClasses:["1a","1b","2","3"], condition:"Conventional (non-trussed) roof frame", estimateNote:"$65–$110/m² for conventional rafter roof frame supply & erect. More labour-intensive than trusses. Specify rafter size from AS 1684.3 tables — birdsmouth ≤1/3 rafter depth. LVL ridge beam required for spans >2.4m." },
  { id:"sw26", trade:"Structural Framing",    item:"LVL beams and lintels — sized from manufacturer tables, installed with correct bearing", unit:"lm", buildingClasses:["1a","1b","2","3"], estimateNote:"LVL F17: $80–$180/lm supply & install depending on size. Minimum 45mm bearing each end on trimmer studs. Engineer design for openings >3.6m or where above tables don't apply." },
  { id:"sw27", trade:"Structural Framing",    item:"Bracing — sheet bracing (plywood or FC), diagonal strap, or proprietary panel system", unit:"BU", buildingClasses:["1a","1b","2","3"], estimateNote:"Calculate required bracing units from AS 1684.2 Section 8 based on wind classification, roof area, and wall height. Sheet bracing (6mm ply or 6mm FC): $20–$45/BU supply & fix. Nailing pattern MUST match rated system — under-nailed panels lose 50% capacity." },
  { id:"sw28", trade:"Structural Framing",    item:"Tie-down system — rafter/truss straps, stud straps, plate-to-slab bolts (AS 1684 Appendix D)", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"N1/N2: standard strap pack $2,000–$5,000 for Class 1a. N3+: hurricane/cyclone straps (H2.5+), chemically anchored slab bolts — $5,000–$15,000+. Connector capacity must equal or exceed design uplift loads from Appendix D tables." },

  // ── MASONRY ────────────────────────────────────────────────────────────────
  { id:"sw29", trade:"Masonry",               item:"Brick veneer external walls — clay brick + cavity + frame, wall ties at 600×900mm", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$150–$250/m² of wall area supply & lay (brick + mortar + ties). In N3+ zones, increase tie density to 600×600mm. Control joints at max 6m. Lintel bearing min 100mm. Window/door reveals add $80–$150 per opening." },
  { id:"sw30", trade:"Masonry",               item:"Double brick / cavity masonry walls — structural masonry both leaves", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$220–$350/m² supply & lay. More labour-intensive than brick veneer. Control joints every 6m — use compressible filler, never mortar. Weep holes at DPC level and above every lintels." },
  { id:"sw31", trade:"Masonry",               item:"Blockwork — concrete masonry units (besser blocks) for retaining walls and garden walls", unit:"m²", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"$120–$200/m² face area laid. Retaining walls >600mm height require engineer design in most states. Core-fill and reinforcement required per structural design." },

  // ── ROOFING ────────────────────────────────────────────────────────────────
  { id:"sw32", trade:"Roofing",               item:"Colorbond/Zincalume metal roofing — corrugated or Trimdek profile, with sarking", unit:"m²", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"$45–$90/m² of roof surface area supply & fix. Fastener spacing from manufacturer's pull-out test matched to wind classification. Include ridge cap, barge, fascia, and gutter. Sarking under metal roof is mandatory in most climate zones." },
  { id:"sw33", trade:"Roofing",               item:"Concrete roof tiles — supply, fix on battens, bed and point ridges and hips", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$60–$110/m² of roof surface supply & lay. Battens from AS 1684.2 tables based on tile weight and rafter spacing. In N3+ zones: mechanically fix ALL ridge/hip tiles (not just mortar bed). Sarking under tiles mandatory Zones 6–8." },
  { id:"sw34", trade:"Roofing",               item:"Terracotta roof tiles — supply, fix, bed and point ridges and hips", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$90–$160/m² of roof surface. Premium product — verify structural capacity (heavier than concrete tiles). Re-battening to AS 1684.2 required on older roof frames. Allow for 15% more for complex roofs with hips/valleys." },
  { id:"sw35", trade:"Roofing",               item:"Box gutter — folded metal box gutter, waterproof liner, overflow scupper", unit:"lm", buildingClasses:["1a","1b","2","3"], condition:"Flat roof sections, abutment gutters", estimateNote:"$250–$600/lm for formed box gutter with Lysaght or lead-free waterproof liner. Overflow scupper mandatory at 150mm above gutter base. Fall min 1:500 in any direction. Engineer involvement recommended for large roof areas." },
  { id:"sw36", trade:"Roofing",               item:"Gutters and downpipes — ogee, quad, or half-round gutter; DN90 downpipes", unit:"lm", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"$25–$60/lm for gutter supply & fix; $30–$80/lm for downpipes. Size from AS 3500.3 based on roof catchment area and local rainfall intensity (BOM data). Minimum one 90mm downpipe per 90m² of roof area." },

  // ── EXTERNAL CLADDING ──────────────────────────────────────────────────────
  { id:"sw37", trade:"External Cladding",     item:"Fibre cement sheet cladding (FC) — 6mm or 9mm sheets, vertical or horizontal jointing", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$80–$140/m² supply & fix including framing, packing, flashings, and primer. Joint sealant type critical — manufacturer-specified for joint system (batten, butt, or flush). BAL rating may require specific FC thickness." },
  { id:"sw38", trade:"External Cladding",     item:"Timber weatherboard — primed hardwood or pine, rebated or shiplap profile", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$120–$200/m² supply & fix (timber) or $90–$150/m² (fibre cement weatherboard). Expansion gaps per manufacturer. External painting or staining in estimate. Maintenance-intensive — factor into lifecycle cost advice." },
  { id:"sw39", trade:"External Cladding",     item:"Render / EIFS — acrylic render on FC or EPS foam base, painted finish", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$100–$200/m² supply & apply for two-coat acrylic render. EIFS (external insulation finish system): $150–$280/m² including foam board. Flashing at all penetrations and movement joints every 6m in render — critical to prevent cracking." },

  // ── WINDOWS & DOORS ────────────────────────────────────────────────────────
  { id:"sw40", trade:"Windows & Doors",       item:"Aluminium windows — double-glazed, WERS rated, including installation and flashings", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$600–$1,800/m² of glass area supply & install depending on frame type and glazing spec. WERS label required — specify U-value and SHGC for climate zone. Head flashing mandatory. Double-glazed low-E: U ≈ 2.0–3.5. Thermal break frames for Zones 6–8." },
  { id:"sw41", trade:"Windows & Doors",       item:"External hinged/sliding doors — solid core or glass panelled, with threshold and weatherstrip", unit:"ea", buildingClasses:["1a","1b","2","3"], estimateNote:"$1,200–$5,000/door supply & install (aluminium/timber sliding or hinged). H9 livable housing: 870mm nominal leaf → 820mm clear opening. 5mm max threshold lip. Security screen door where required by insurer — priced separately." },
  { id:"sw42", trade:"Windows & Doors",       item:"Garage door — panel lift or roller door, including motor and remote", unit:"ea", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"$1,500–$4,000 supply & install for single garage; $2,500–$6,000 double. BAL rating may require non-combustible door assembly. Confirm door frame size matches structural opening in slab/framing." },
  { id:"sw43", trade:"Windows & Doors",       item:"Internal doors — hollow core flush or moulded, incl. frame, hardware, and stops", unit:"ea", buildingClasses:["1a","1b","2","3"], estimateNote:"$300–$800/door supply & install hollow core. Solid core (acoustic/fire): $600–$1,500. H9 livable housing: 870mm leaf required for 820mm clear opening. Lever handles mandatory (H9). Fire doors (FD30S) for Class 2 separation walls." },

  // ── INSULATION ─────────────────────────────────────────────────────────────
  { id:"sw44", trade:"Insulation",            item:"Ceiling insulation batts — blown or batt insulation to NCC minimum R-value for zone", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$15–$35/m² supply & install batt insulation. Zone 5–6: R3.8 (Zone 6: R3.8 min, R4.1 recommended); Zone 7–8: R5.1–R6.3. Confirm R-value label matches spec — check for compression at eaves. Downlight fire covers required for recessed LED fittings." },
  { id:"sw45", trade:"Insulation",            item:"Wall insulation batts — full cavity fill, stapled at 300mm ctrs to studs", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$10–$22/m² of wall area supply & install. Zone 5: R2.0 min; Zone 6: R2.8; Zone 7–8: R2.8–R3.8. Vapour permeable sarking behind cladding required all zones. No foil in wall cavities Zones 6–8 (interstitial condensation risk)." },
  { id:"sw46", trade:"Insulation",            item:"Floor insulation — suspended timber floor, wire hangers or Z-clips at 450mm ctrs", unit:"m²", buildingClasses:["1a","1b","2","3"], condition:"Suspended timber floor only — not required on concrete slabs Zones 1–2", estimateNote:"$12–$28/m² supply & install. Zone 5: R1.5 min; Zone 6: R2.0; Zone 7–8: R2.5–R4.0. Hanger spacing ≤450mm — sagging batts lose 30–50% effective R-value. Moisture-resistant facing in coastal/humid climates." },
  { id:"sw47", trade:"Insulation",            item:"Roof sarking — reflective or breathable (Zone 6–8), under tiles or metal roofing", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$8–$20/m² supply & install. Reflective foil (shiny side down) adds R0.5–R1.0 to ceiling system. Breathable sarking mandatory Zones 6–8 for condensation management. All laps 150mm minimum; tape all joints; turn down at eaves to gutter." },

  // ── WATERPROOFING ──────────────────────────────────────────────────────────
  { id:"sw48", trade:"Waterproofing",         item:"Internal wet area waterproofing — shower, bathroom, laundry floors and walls (AS 3740:2021)", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$50–$120/m² for liquid-applied membrane (2 coats, 1.0mm DFT) supply & apply by licensed waterproofer. Shower walls: 1800mm AFF; floor fall 1:60 min; hob 25mm min. AS 3740 certificate required before tiling. Inspect and photograph before tiles go down." },
  { id:"sw49", trade:"Waterproofing",         item:"External balcony/deck membrane — AS 4654.2, 150mm upstand, 1:80 fall to outlet", unit:"m²", buildingClasses:["1a","1b","2","3"], condition:"Balcony or deck over habitable space", estimateNote:"$90–$180/m² for external membrane system (waterproof membrane + protection layer + screed). 150mm upstand at walls and doorways; 1:80 fall min; outlet flow rate to match roof area. Certifier inspection before topping screed." },
  { id:"sw50", trade:"Waterproofing",         item:"Window and door flashings — head, sill, jamb flashings, backer rod and sealant", unit:"ea", buildingClasses:["1a","1b","2","3"], estimateNote:"$80–$200 per window (material + labour). Head flashing must run under wall wrap; sill sloped to drain; jamb wraps into rough opening. 80% of water ingress in buildings occurs at window/wall junctions — flash before cladding installation, never after." },

  // ── INTERNAL LININGS ──────────────────────────────────────────────────────
  { id:"sw51", trade:"Internal Linings",      item:"Plasterboard — 10mm standard walls, 13mm ceilings, fire-rated where required", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$35–$65/m² supply & fix (supply, hang, tape, set, sand). Two-coat setting standard. Fire-rated systems (Class 2 separation walls, under-stair enclosures): Fyrchek or equivalent — verify system number matches wall gauge and stud spacing." },
  { id:"sw52", trade:"Internal Linings",      item:"Cornice and setting — standard 90mm cove cornice, 3-coat finish", unit:"lm", buildingClasses:["1a","1b","2","3"], estimateNote:"$15–$30/lm supply & fix standard cornice. Federation/ornate profiles: $40–$120/lm. Setting (taping & jointing) included in plasterboard rate above — price separately if lining supplier differs from set & sand contractor." },
  { id:"sw53", trade:"Internal Linings",      item:"Acoustic insulation — floor/ceiling assemblies between units or separate dwellings", unit:"m²", buildingClasses:["2","3"], condition:"Class 2 apartments — between sole-occupancy units", estimateNote:"$25–$55/m² for acoustic batt + resilient channel + extra board layer. Impact sound isolation (IIC ≥50) required between units. Full tested system required — cannot mix elements from different tested assemblies." },

  // ── TILING ────────────────────────────────────────────────────────────────
  { id:"sw54", trade:"Tiling",                item:"Floor tiles — ceramic/porcelain, adhesive bed, grout, sealer (wet areas: R10 slip min)", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$80–$200/m² supply & lay (standard range tiles + adhesive + grout). Wet area tiles: R10 slip min (PTV ≥36 wet). Large format tiles (>600×600): spot adhesive only — use full-bed adhesive. Add 10–15% waste for cuts and breakage." },
  { id:"sw55", trade:"Tiling",                item:"Wall tiles — ceramic/porcelain, adhesive bed, grout, silicone at junctions", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$70–$180/m² supply & lay. Silicone (not grout) at all internal corners and wall/floor junctions — essential joint that accommodates movement. Grout colour specification affects appearance and maintenance — light grouts show more staining." },
  { id:"sw56", trade:"Tiling",                item:"External paving — travertine, bluestone, porcelain, or concrete pavers on mortar bed", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$100–$300/m² supply & lay depending on material. External pavers: R11 slip min for pools and ramps, R10 for general paths. Fall min 1:80 to drain. Grouting with polymer-modified grout for external applications." },

  // ── JOINERY ───────────────────────────────────────────────────────────────
  { id:"sw57", trade:"Joinery",               item:"Kitchen cabinetry — base and overhead cabinets, benchtop, splashback, pantry", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"$15,000–$60,000+ supply & install depending on quality, lineal metres, and benchtop material. Stone benchtop: add $600–$1,500/lm. Allow for waterfall end panels, overhead cabinets to ceiling, and integrated rangehood. Builder's schedule of finishes determines quality tier." },
  { id:"sw58", trade:"Joinery",               item:"Bathroom vanity, mirror, towel rails, toilet roll holders — full fit-out", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"$2,000–$15,000+ per bathroom depending on vanity style, size, and fixture quality. Stone top vanity: premium range. H9 livable housing: lever tapware, GPO at 600–1200mm AFF." },
  { id:"sw59", trade:"Joinery",               item:"Laundry cabinetry, trough, bench, overhead cabinets", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"$3,000–$10,000 supply & install. Include trough, tap, mixer. Provide 220V/10A outlet for dryer and 15A for dryer if gas dryer. Space for front or top-load washer — confirm door swing clearance." },
  { id:"sw60", trade:"Joinery",               item:"Built-in wardrobes — sliding or hinged doors, internal fittings (rail, shelves, drawers)", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"$1,500–$6,000 per standard bedroom wardrobe (1800–2400mm wide). Walk-in robes: $3,000–$12,000 depending on size and fittings. Joinery supplier measures after framing — allow 4–6 week lead time for delivery." },
  { id:"sw61", trade:"Joinery",               item:"Staircase — timber treads and risers, balustrade, handrail (AS 1657)", unit:"flight", buildingClasses:["1a","1b","2","3"], estimateNote:"$8,000–$30,000+ per flight depending on material and balustrade type (timber spindles, cable, glass). Stair dimensions: riser ≤190mm, going ≥240mm, 2R+G = 550–700mm. Glass balustrade: minimum 10mm toughened per AS 1288. Balustrade height ≥1000mm where drop ≥1m." },

  // ── PAINTING ──────────────────────────────────────────────────────────────
  { id:"sw62", trade:"Painting",              item:"Internal painting — 2-coat system on walls, 2-coat on ceilings, semi-gloss trim", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$15–$30/m² of floor area (all-up rate) for standard 2-coat internal paint. Premium (3-coat) finishes and dark colours: 20% premium. Feature walls, two-tone schemes add complexity. Include door frames, architraves, and skirting boards." },
  { id:"sw63", trade:"Painting",              item:"External painting — 2-coat acrylic system on FC, weatherboard, or render", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"$20–$45/m² of external wall area. Surface prep critical — sand, fill, prime before topcoats. Allow 10-year repaint cycle for acrylic on FC and weatherboard. Render finishes: acrylic texture coat instead of paint (included in render rate)." },

  // ── ELECTRICAL ────────────────────────────────────────────────────────────
  { id:"sw64", trade:"Electrical",            item:"Electrical rough-in — cabling, conduit, earth bonding, switchboard wiring (AS/NZS 3000)", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"$8,000–$25,000 rough-in for Class 1a (3-bed house). Includes sub-mains to switchboard, circuit cabling (power, lighting, A/C, oven, cooktop, HWS), GPO rough-in, data conduit, and earthing. Licensed electrician only." },
  { id:"sw65", trade:"Electrical",            item:"Electrical fit-off — GPOs, switches, light points, switchboard, RCDs, CES certificate", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"$5,000–$15,000 fit-off for Class 1a. RCDs on ALL circuits (AS/NZS 3000:2018). SPD Type II at switchboard. EV charger conduit if required. Certificate of Electrical Safety (CES) issued on completion. H9: all GPOs and switches at 600–1200mm AFF." },
  { id:"sw66", trade:"Electrical",            item:"Solar PV system — rooftop panels, inverter, metering, grid connection", unit:"kW", buildingClasses:["1a","1b","2","3"], condition:"Optional / NatHERS whole-of-home budget offset", estimateNote:"$900–$1,400/kW installed for quality system (Tier 1 panels, reputable inverter). 6.6 kW system typical for Class 1a: $6,000–$10,000. NatHERS whole-of-home budget allows PV offset. Install during build avoids roof penetrations after waterproofing." },
  { id:"sw67", trade:"Electrical",            item:"Data, communications and AV rough-in — conduit, ethernet Cat6A, coax, speaker rough", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"$1,500–$5,000 for communications rough-in. Conduit to each data point allows future upgrades. NBN connection point: single outlet to network equipment location. In-wall speaker rough-in: 2-core 16/0.2 cable to each speaker location." },
  { id:"sw68", trade:"Electrical",            item:"Smoke alarms — interconnected 240V mains-powered with 9V battery backup (AS 3786)", unit:"ea", buildingClasses:["1a","1b","2","3"], estimateNote:"$120–$300/alarm supply & install. Mandatory on every level and in/near every bedroom. Interconnection required — all alarms sound when any one activates. State legislation governs additional requirements (QLD: photoelectric only). 10-year lithium battery units are compliant alternative to mains-powered in existing buildings." },

  // ── PLUMBING & DRAINAGE ────────────────────────────────────────────────────
  { id:"sw69", trade:"Plumbing & Drainage",   item:"Plumbing rough-in — water supply, drainage rough-in, vent stacks, waste points (AS/NZS 3500)", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"$8,000–$22,000 rough-in for Class 1a. Includes water supply (copper, CPVC, or PEX), sanitary drainage (PVC, min 1:40 fall), vent stacks, and waste penetrations through slab. Drainage plan required for slab pour — no post-pour changes." },
  { id:"sw70", trade:"Plumbing & Drainage",   item:"Plumbing fit-off — fixtures, tapware, WCs, shower screens, baths, basins", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"$8,000–$25,000+ fit-off for Class 1a depending on fixture quality. All fittings: WaterMark certification. Tempering valve at HWS (50°C max to bathrooms). Pressure limiting valve if supply pressure >500 kPa. H9: lever tapware throughout." },
  { id:"sw71", trade:"Plumbing & Drainage",   item:"Hot water system (HWS) — heat pump (preferred), solar, gas, or electric storage", unit:"ea", buildingClasses:["1a","1b","2","3"], estimateNote:"Heat pump HWS: $3,000–$6,000 supply & install (uses 65% less energy than electric resistance). Gas continuous flow: $1,500–$3,500. Electric storage: $800–$2,000 but increases whole-of-home energy budget. NCC 2022 whole-of-home budget strongly incentivises heat pump HWS." },
  { id:"sw72", trade:"Plumbing & Drainage",   item:"Sewer connection — connection to council sewer main, overflow relief gully, inspection point", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"$3,000–$8,000 for standard sewer connection (varies greatly with distance to main and ground conditions). ORG (overflow relief gully) required 75mm below lowest fixture — location must be accessible. CCTV inspection of drain before slab backfill in some councils." },

  // ── GAS ───────────────────────────────────────────────────────────────────
  { id:"sw73", trade:"Gas",                   item:"Gas rough-in — reticulation from meter to appliance points (AS/NZS 5601.1)", unit:"sum", buildingClasses:["1a","1b","2","3"], condition:"Gas available — natural gas or LPG", estimateNote:"$2,000–$6,000 rough-in for Class 1a. Pipe sizing from AS 5601.1 based on MJ/hr demand at each appliance. Pressure test at 1.5 kPa before lining. Licensed gasfitter only. LPG: include external regulator and cylinder compound." },
  { id:"sw74", trade:"Gas",                   item:"Gas fit-off — appliance connections, regulators, pressure test, gasfitter certificate", unit:"sum", buildingClasses:["1a","1b","2","3"], condition:"Gas appliances included in scope", estimateNote:"$1,500–$4,000 fit-off. All gas appliances require manufacturer-specified ventilation — check room volume and vent requirements before finalising layout. Certificate of compliance (SRGWP or state equivalent) required on completion." },

  // ── HVAC & VENTILATION ────────────────────────────────────────────────────
  { id:"sw75", trade:"HVAC & Ventilation",    item:"Split system air conditioning — supply, install, commissioning per room or open plan", unit:"ea", buildingClasses:["1a","1b","2","3"], estimateNote:"$1,800–$4,500/unit supply & install. Size from heat load calculation (rule of thumb: 0.12–0.15 kW/m² of floor area). Dedicated 20A circuit from switchboard per unit. Condensate drain to suitable point. Check NatHERS whole-of-home budget for star rating impact." },
  { id:"sw76", trade:"HVAC & Ventilation",    item:"Ducted refrigerative air conditioning — indoor unit, ductwork, outlets, commissioning", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"$8,000–$20,000+ for whole-home ducted system. Size from cooling/heating load calculation by HVAC engineer or software. Dedicate 32A circuit. Zone control recommended. NatHERS impact: high-star-rated unit reduces energy budget significantly." },
  { id:"sw77", trade:"HVAC & Ventilation",    item:"Exhaust fans — bathroom (25 L/s), kitchen rangehood (ducted externally, DN150 duct)", unit:"ea", buildingClasses:["1a","1b","2","3"], estimateNote:"$200–$600/fan supply & install. Bathroom: min 25 L/s continuous or 50 L/s intermittent — verify at actual duct length (longer ducts reduce flow rate). Ducted EXTERNALLY — never into ceiling cavity. Rangehood duct: DN150 rigid duct, max 7 m/s velocity." },

  // ── FIRE SERVICES ─────────────────────────────────────────────────────────
  { id:"sw78", trade:"Fire Services",         item:"Sprinkler system — AS 2118.1 residential or standard system, heads at required spacing", unit:"head", buildingClasses:["2","3"], condition:"Required for Class 2 buildings >3 storeys or as per NCC fire engineering", estimateNote:"$400–$800/head installed (hydraulic design by engineer). Pump, tank, and riser costs additional ($15,000–$50,000). Full hydraulic calculations required. Commissioning with certifier present at practical completion." },
  { id:"sw79", trade:"Fire Services",         item:"Fire detection and alarm system — addressable, with detectors, sounders, MCP, FACP", unit:"sum", buildingClasses:["2","3"], condition:"Class 3, 5, 6, 7, 8, 9 buildings", estimateNote:"$10,000–$60,000+ depending on building size and zone count. AS 1670.1 detector placement and zone layout. Integration with building services (BAS, mechanical smoke control mode). Annual maintenance contract required." },
  { id:"sw80", trade:"Fire Services",         item:"Fire-rated doorsets — self-closing, labelled, with intumescent seals (AS 1905.1)", unit:"ea", buildingClasses:["2","3"], condition:"Separation between sole-occupancy units in Class 2, or fire compartments in Class 3", estimateNote:"$1,500–$4,000/doorset supply & install. FRL 60/60/60 required for most residential separation applications. Never wedge open fire doors — magnetic hold-open devices are compliant. Compliance label must remain visible." },

  // ── EXTERNAL WORKS ────────────────────────────────────────────────────────
  { id:"sw81", trade:"External Works",        item:"Timber or composite decking — hardwood, treated pine, or composite, incl. subframe", unit:"m²", buildingClasses:["1a","1b","2","3"], estimateNote:"Hardwood decking: $180–$350/m² supply & lay. Composite: $220–$400/m². Subframe (bearers/joists): in above rate. Balustrade required where deck is ≥1m above ground (1000mm min height). BAL: check combustibility of decking material at BAL-19 and above." },
  { id:"sw82", trade:"External Works",        item:"Colorbond/timber fencing — pool fence, boundary fence, retaining walls", unit:"lm", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"Colorbond: $80–$150/lm supply & fix. Timber: $90–$160/lm. Pool fence: $250–$500/lm for glass/aluminium to AS 1926.1 — gate self-closing, non-climbable, 1200mm min height (1800mm in some states). Retaining walls >600mm: engineer design." },
  { id:"sw83", trade:"External Works",        item:"Driveway and paths — asphalt, exposed aggregate concrete, or pavers", unit:"m²", buildingClasses:["1a","1b","2","3","10a"], estimateNote:"Asphalt: $60–$100/m². Exposed aggregate: $100–$180/m². Concrete pavers: $100–$220/m². Driveway crossover typically council responsibility to kerb — confirm with council. Accessible parking bay requires 1:80 max cross-fall surface." },
  { id:"sw84", trade:"External Works",        item:"Landscaping — topsoil, turf, garden beds, irrigation, tree planting", unit:"sum", buildingClasses:["1a","1b","2","3"], estimateNote:"Allow $15,000–$60,000+ for comprehensive Class 1a landscaping. Hard to estimate without landscape design. Budget $50–$120/m² of soft landscape area. Council may require landscape bond on DA — confirm conditions of consent." },
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

  const [activeMainTab, setActiveMainTab] = useState("checklist");
  const [librarySearch, setLibrarySearch] = useState("");
  const [expandedAS, setExpandedAS] = useState<Set<string>>(new Set());
  const toggleAS = (id: string) => setExpandedAS(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const [libraryBuildingType, setLibraryBuildingType] = useState<"all" | "residential" | "commercial">("all");
  const [libraryCategory, setLibraryCategory] = useState("All");
  const [libraryView, setLibraryView] = useState<"all" | "rules" | "standards">("all");
  const [sowSearch, setSowSearch] = useState("");
  const [sowTradeFilter, setSowTradeFilter] = useState("All");

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

  // Unified library filters
  const filteredRules = RULES_DB.filter(r => {
    if (libraryView === "standards") return false;
    const matchType = libraryBuildingType === "all" || r.buildingType === libraryBuildingType || r.buildingType === "both";
    const matchCat = libraryCategory === "All" || r.category === libraryCategory;
    const q = librarySearch.toLowerCase();
    const matchSearch = !q || r.rule.toLowerCase().includes(q) || r.requirement.toLowerCase().includes(q) || r.asRef.toLowerCase().includes(q) || r.notes.toLowerCase().includes(q);
    return matchType && matchCat && matchSearch;
  });

  const filteredAS = AS_LOOKUP.filter(a => {
    if (libraryView === "rules") return false;
    const matchType = libraryBuildingType === "all" || a.buildingType === libraryBuildingType || a.buildingType === "both";
    const matchCat = libraryCategory === "All" || a.category === libraryCategory;
    const q = librarySearch.toLowerCase();
    const matchSearch = !q || a.asNumber.toLowerCase().includes(q) || a.title.toLowerCase().includes(q) || a.scope.toLowerCase().includes(q) || a.keywords.some(k => k.toLowerCase().includes(q)) || a.practicalNote.toLowerCase().includes(q);
    return matchType && matchCat && matchSearch;
  });

  // Filtered SOW items
  const filteredSOW = useMemo(() => {
    const q = sowSearch.toLowerCase();
    let items = SOW_DB.filter(s => s.buildingClasses.includes(buildingClass));
    if (sowTradeFilter !== "All") items = items.filter(s => s.trade === sowTradeFilter);
    if (!q) return items;
    return items.filter(s =>
      s.item.toLowerCase().includes(q) ||
      s.trade.toLowerCase().includes(q) ||
      s.estimateNote.toLowerCase().includes(q) ||
      (s.condition?.toLowerCase().includes(q) ?? false)
    );
  }, [sowSearch, sowTradeFilter, buildingClass]);

  const sowTrades = useMemo(() => {
    const trades = [...new Set(filteredSOW.map(s => s.trade))];
    return trades;
  }, [filteredSOW]);

  const allSowTrades = useMemo(() => {
    const trades = [...new Set(SOW_DB.filter(s => s.buildingClasses.includes(buildingClass)).map(s => s.trade))];
    return ["All", ...trades];
  }, [buildingClass]);

  const addToEstimate = (s: SOWItem) => {
    const newEstimateItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      section_id: null,
      area: s.trade,
      trade: s.trade,
      scope_of_work: s.item,
      material_type: s.trade,
      quantity: 1,
      unit: s.unit,
      unit_price: 0,
      labour_hours: 0,
      labour_rate: 85,
      material_wastage_pct: 5,
      labour_wastage_pct: 5,
      markup_pct: 15,
      notes: s.estimateNote,
      expanded: false,
      item_number: "1",
      isEditing: false,
      relatedMaterials: [],
    };
    try {
      const projects = JSON.parse(localStorage.getItem("local_projects") || "[]");
      const idx = projects.findIndex((p: any) => p.id === projectId);
      if (idx !== -1) {
        const existing = projects[idx].estimate_items || [];
        newEstimateItem.item_number = String(existing.length + 1);
        projects[idx].estimate_items = [...existing, newEstimateItem];
        localStorage.setItem("local_projects", JSON.stringify(projects));
        toast.success(`"${s.item.slice(0, 50)}…" added to estimate`);
      } else {
        toast.error("Project not found — open Estimate tab first");
      }
    } catch {
      toast.error("Could not save to estimate");
    }
  };

  return (
    <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="checklist" className="gap-2">
          <ClipboardList className="h-4 w-4" />Compliance Checklist
        </TabsTrigger>
        <TabsTrigger value="library" className="gap-2">
          <BookOpen className="h-4 w-4" />Standards & Rules
        </TabsTrigger>
        <TabsTrigger value="sow" className="gap-2">
          <FileText className="h-4 w-4" />Scope of Works
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
                            {item.asInfo && (
                              <div className="mt-2 flex items-start gap-1.5 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1.5 leading-relaxed">
                                <BookOpen className="h-3 w-3 mt-0.5 flex-shrink-0 text-blue-500" />
                                <span>{item.asInfo}</span>
                              </div>
                            )}
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

      {/* ══ TAB 2: STANDARDS & RULES LIBRARY ══ */}
      <TabsContent value="library">
        <div className="space-y-4">

          {/* ── Filter bar ── */}
          <Card>
            <CardContent className="pt-5 pb-4 space-y-4">

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-10 text-sm"
                  placeholder="Search rules, AS numbers, standards, keywords…"
                  value={librarySearch}
                  onChange={e => setLibrarySearch(e.target.value)}
                />
              </div>

              {/* View mode + Building type row */}
              <div className="flex flex-wrap gap-3 items-center justify-between">
                {/* View toggle */}
                <div className="flex gap-0.5 p-1 bg-muted rounded-lg">
                  {([ ["all","All Results"], ["rules","NCC Rules only"], ["standards","AS Standards only"] ] as [string,string][]).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setLibraryView(v as "all"|"rules"|"standards")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        libraryView === v
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Building type */}
                <div className="flex gap-0.5 p-1 bg-muted rounded-lg">
                  {([ ["all","All"], ["residential","Residential"], ["commercial","Commercial"] ] as [string,string][]).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setLibraryBuildingType(v as "all"|"residential"|"commercial")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        libraryBuildingType === v
                          ? v === "residential"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : v === "commercial"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category chips */}
              <div className="flex flex-wrap gap-1.5">
                {RULE_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setLibraryCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      libraryCategory === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Result count */}
              <p className="text-xs text-muted-foreground">
                {libraryView !== "standards" && <span><strong>{filteredRules.length}</strong> NCC rule{filteredRules.length !== 1 ? "s" : ""}</span>}
                {libraryView === "all" && <span className="mx-1.5 opacity-40">·</span>}
                {libraryView !== "rules" && <span><strong>{filteredAS.length}</strong> AS standard{filteredAS.length !== 1 ? "s" : ""}</span>}
                {librarySearch && <span className="ml-1 italic">matching &ldquo;{librarySearch}&rdquo;</span>}
              </p>
            </CardContent>
          </Card>

          {/* Quick-start chips */}
          {!librarySearch && (
            <div className="flex flex-wrap gap-2 px-1 items-center">
              <span className="text-xs text-muted-foreground">Quick search:</span>
              {["waterproofing","timber framing","smoke alarm","electrical","insulation","drainage","fire door","glazing","balustrade","termite"].map(kw => (
                <button
                  key={kw}
                  onClick={() => setLibrarySearch(kw)}
                  className="px-2.5 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-full text-xs border border-border transition-colors"
                >
                  {kw}
                </button>
              ))}
            </div>
          )}

          {/* ── NCC Rules ── */}
          {libraryView !== "standards" && filteredRules.length > 0 && (
            <div className="space-y-2">
              {libraryView === "all" && (
                <div className="flex items-center gap-2 px-1 mt-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2">NCC Rules</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              {filteredRules.map(rule => (
                <Card key={rule.id} className="hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: rule.buildingType === "commercial" ? "#6366f1" : "#10b981" }}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">NCC Rule</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">{rule.category}</Badge>
                          <Badge
                            className={`text-[10px] h-4 px-1.5 ${rule.buildingType === "commercial" ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}
                            variant="outline"
                          >
                            {rule.buildingType === "both" ? "Res + Comm" : rule.buildingType === "commercial" ? "Commercial" : "Residential"}
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold text-foreground leading-snug">{rule.rule}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rule.requirement}</p>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <div className="text-xs bg-muted/50 rounded px-2 py-1 flex gap-1">
                            <span className="font-semibold shrink-0">NCC:</span>
                            <span className="font-mono text-muted-foreground">{rule.nccRef}</span>
                          </div>
                          <div className="text-xs bg-blue-50 border border-blue-100 rounded px-2 py-1 flex gap-1 flex-wrap">
                            <span className="font-semibold text-blue-700 shrink-0">AS:</span>
                            <span className="font-mono text-blue-800">{rule.asRef}</span>
                            {rule.asTitle && <span className="text-blue-600 hidden sm:inline"> — {rule.asTitle}</span>}
                          </div>
                        </div>
                        {rule.notes && (
                          <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 leading-relaxed">
                            <span className="font-semibold">Site note: </span>{rule.notes}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(`${rule.nccRef} — ${rule.asRef}`); toast.success("References copied"); }}
                        className="flex-shrink-0 p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy NCC + AS references"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ── AS Standards ── */}
          {libraryView !== "rules" && filteredAS.length > 0 && (
            <div className="space-y-2">
              {libraryView === "all" && (
                <div className="flex items-center gap-2 px-1 mt-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2">Australian Standards</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              {filteredAS.map(as => {
                const isExpanded = expandedAS.has(as.id);
                return (
                <Card key={as.id} className={`transition-shadow border-l-4 border-l-blue-400 ${isExpanded ? "shadow-md" : "hover:shadow-sm"}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="font-bold text-sm font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">{as.asNumber}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">AS Standard</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">{as.category}</Badge>
                          <Badge
                            className={`text-[10px] h-4 px-1.5 ${as.buildingType === "commercial" ? "bg-indigo-100 text-indigo-700 border-indigo-200" : as.buildingType === "residential" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}
                            variant="outline"
                          >
                            {as.buildingType === "both" ? "Res + Comm" : as.buildingType === "commercial" ? "Commercial" : "Residential"}
                          </Badge>
                        </div>

                        {/* Title + scope */}
                        <p className="text-sm font-semibold leading-snug">{as.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{as.scope}</p>

                        {/* NCC reference */}
                        <div className="mt-2 text-xs bg-muted/40 rounded px-2 py-1 flex gap-1">
                          <span className="font-semibold shrink-0">NCC:</span>
                          <span className="font-mono text-muted-foreground">{as.nccLink}</span>
                        </div>

                        {/* Practical note (always visible) */}
                        {as.practicalNote && (
                          <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 leading-relaxed">
                            <span className="font-semibold">On-site: </span>{as.practicalNote}
                          </div>
                        )}

                        {/* Expand/collapse trigger row */}
                        {as.details && as.details.length > 0 && (
                          <button
                            onClick={() => toggleAS(as.id)}
                            className="mt-2.5 flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 transition-colors group"
                          >
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border border-blue-200 bg-blue-50 group-hover:bg-blue-100 transition-colors ${isExpanded ? "bg-blue-100" : ""}`}>
                              {isExpanded
                                ? <ChevronDown className="h-3 w-3" />
                                : <ChevronRight className="h-3 w-3" />}
                            </span>
                            {isExpanded
                              ? <span className="font-semibold">Hide details</span>
                              : <span className="font-semibold">{as.details.length} detailed reference points</span>}
                            {!isExpanded && (
                              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold border border-blue-200">
                                Expand
                              </span>
                            )}
                          </button>
                        )}

                        {/* Collapsible detail section */}
                        {isExpanded && as.details && as.details.length > 0 && (
                          <div className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded-md overflow-hidden">
                            <div className="px-3 py-2 bg-blue-100 border-b border-blue-200 flex items-center gap-1.5">
                              <BookOpen className="h-3 w-3 text-blue-700" />
                              <span className="font-bold text-blue-800 uppercase tracking-wide text-[10px]">
                                {as.asNumber} — Technical Reference
                              </span>
                            </div>
                            <div className="divide-y divide-blue-100">
                              {as.details.map((d, i) => (
                                <div key={i} className="flex gap-2.5 px-3 py-2.5 text-blue-950 hover:bg-blue-100/50 transition-colors">
                                  <span className="shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 font-bold text-[10px] flex items-center justify-center mt-0.5">
                                    {i + 1}
                                  </span>
                                  <span className="leading-relaxed">{d}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Estimator price notes */}
                        {isExpanded && AS_ESTIMATOR_NOTES[as.id] && AS_ESTIMATOR_NOTES[as.id].length > 0 && (
                          <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded-md overflow-hidden">
                            <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-center gap-1.5">
                              <ClipboardList className="h-3 w-3 text-amber-700" />
                              <span className="font-bold text-amber-800 uppercase tracking-wide text-[10px]">
                                Estimator — Price & Scope Notes
                              </span>
                            </div>
                            <div className="divide-y divide-amber-100">
                              {AS_ESTIMATOR_NOTES[as.id].map((n, i) => (
                                <div key={i} className="flex gap-2.5 px-3 py-2.5 text-amber-950 hover:bg-amber-100/50 transition-colors">
                                  <span className="shrink-0 font-bold text-amber-600 text-[11px] mt-0.5 select-none">$</span>
                                  <span className="leading-relaxed">{n}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Keywords */}
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {as.keywords.slice(0, 8).map(kw => (
                            <button
                              key={kw}
                              onClick={() => setLibrarySearch(kw)}
                              className="px-1.5 py-0.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded text-[10px] border border-border transition-colors"
                            >
                              {kw}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => toggleAS(as.id)}
                          className={`p-2 rounded transition-colors ${isExpanded ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                          title={isExpanded ? "Collapse details" : "Expand details"}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => { navigator.clipboard.writeText(as.asNumber); toast.success(`Copied ${as.asNumber}`); }}
                          className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title={`Copy ${as.asNumber}`}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {filteredRules.length === 0 && filteredAS.length === 0 && (
            <Card>
              <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No results found</p>
                <p className="text-xs mt-1">Try a different keyword, category or building type</p>
              </CardContent>
            </Card>
          )}

        </div>
      </TabsContent>

      {/* ══ TAB 4: SCOPE OF WORKS ══ */}
      <TabsContent value="sow">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle>Scope of Works — {BUILDING_CLASSES.find(c => c.value === buildingClass)?.label || buildingClass}</CardTitle>
              </div>
              <CardDescription>
                Typical SOW line items for the selected building class. Filtered from {SOW_DB.filter(s => s.buildingClasses.includes(buildingClass)).length} items. Change the <strong>Building Class</strong> selector in the Checklist tab to switch sets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search scope items, trades, estimate notes…"
                    value={sowSearch}
                    onChange={e => setSowSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                <Select value={sowTradeFilter} onValueChange={setSowTradeFilter}>
                  <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue placeholder="Filter by trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {allSowTrades.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const text = sowTrades.map(trade => {
                      const items = filteredSOW.filter(s => s.trade === trade);
                      return `${trade.toUpperCase()}\n${items.map(s => `  • ${s.item} (${s.unit})`).join("\n")}`;
                    }).join("\n\n");
                    navigator.clipboard.writeText(text);
                    toast.success("SOW copied to clipboard");
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy All
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                Showing <strong>{filteredSOW.length}</strong> items across <strong>{sowTrades.length}</strong> trades for <strong>{BUILDING_CLASSES.find(c => c.value === buildingClass)?.label?.split("—")[0].trim() || buildingClass}</strong>
              </div>

              {sowTrades.map(trade => {
                const items = filteredSOW.filter(s => s.trade === trade);
                return (
                  <div key={trade} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/60 px-4 py-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{trade}</span>
                      <Badge variant="outline" className="text-xs">{items.length} item{items.length !== 1 ? "s" : ""}</Badge>
                    </div>
                    <div className="divide-y divide-border">
                      {items.map(s => (
                        <div key={s.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium leading-snug">{s.item}</span>
                                <Badge variant="secondary" className="text-[10px] font-mono shrink-0">{s.unit}</Badge>
                                {s.condition && (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 shrink-0">
                                    {s.condition}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">{s.estimateNote}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 mt-0.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title="Copy item"
                                onClick={() => {
                                  navigator.clipboard.writeText(`${s.item} (${s.unit}) — ${s.estimateNote}`);
                                  toast.success("Item copied");
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                                title="Add to estimate"
                                onClick={() => addToEstimate(s)}
                              >
                                <PlusCircle className="h-3 w-3" />
                                ADD
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {filteredSOW.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No SOW items match your search.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

    </Tabs>
  );
};
