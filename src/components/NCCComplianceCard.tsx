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
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle,
  MinusCircle, FileText, RotateCcw, Building2, Zap, Droplets,
  Flame, Wind, Accessibility, ArrowUpDown, Thermometer, ShieldCheck,
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
    {
      id: "site",
      title: "Site & Footings",
      icon: <Building2 className="h-4 w-4" />,
      color: "amber",
      items: [
        { id: "site-1", requirement: "Site drainage prevents water ponding adjacent to building", detail: "Finished ground level graded away from building — minimum 50mm fall in first 1m", reference: "NCC Vol 2 — Part 3.2.1" },
        { id: "site-2", requirement: "Damp-proof course (DPC) installed at base of masonry walls", detail: "DPC minimum 75mm above finished ground level, extends full width of wall", reference: "NCC Vol 2 — Part 3.3.4" },
        { id: "site-3", requirement: "Termite management system installed", detail: "Physical or chemical barrier to AS 3660.1 or compliant alternative solution", reference: "NCC Vol 2 — Part 3.1.3" },
        { id: "site-4", requirement: "Footing design matches site classification (AS 2870)", detail: "Site classification (A, S, M, H, E, P) assessed — footing type selected accordingly", reference: "NCC Vol 2 — Part 3.2.2, AS 2870" },
        { id: "site-5", requirement: "Wind classification determined and documented", detail: "Wind region (A–D) and terrain category assessed — framing designed accordingly (AS 4055)", reference: "NCC Vol 2 — Part 3.10.1, AS 4055" },
        ...(isClass1 ? [{ id: "site-6", requirement: "Bushfire Attack Level (BAL) assessed if in bushfire prone area", detail: "BAL rating from 12.5 to FZ — construction requirements increase with BAL level", reference: "NCC Vol 2 — Part 3.7.4, AS 3959" }] : []),
      ],
    },
    {
      id: "framing",
      title: "Structural Framing",
      icon: <Building2 className="h-4 w-4" />,
      color: "orange",
      items: [
        { id: "frm-1", requirement: "Timber framing designed to AS 1684 (or steel to AS 4600)", detail: "Span tables used — species, grade and size verified for each application", reference: "NCC Vol 2 — Part 3.4, AS 1684" },
        { id: "frm-2", requirement: "Roof bracing system installed and documented", detail: "Bracing layout drawn — both longitudinal and transverse bracing provided", reference: "NCC Vol 2 — Part 3.4.3, AS 1684.2" },
        { id: "frm-3", requirement: "Wall bracing meets minimum bracing unit requirements", detail: "Bracing units calculated per wind classification — distribution across all walls", reference: "NCC Vol 2 — Part 3.4.3" },
        { id: "frm-4", requirement: "Tie-down connections from roof to footing provided", detail: "Uplift loads transferred through connectors, straps and anchors to foundation", reference: "NCC Vol 2 — Part 3.4, AS 1684" },
        { id: "frm-5", requirement: "Lintels sized correctly over all openings", detail: "Lintels specified for each opening width and load condition — no timber over 1.8m without engineer check", reference: "NCC Vol 2 — Part 3.4.2" },
        { id: "frm-6", requirement: "Subfloor ventilation provided for suspended floors", detail: "Cross-ventilation path clear — 3500mm² per lineal metre of external wall minimum", reference: "NCC Vol 2 — Part 3.4.1" },
      ],
    },
    {
      id: "energy",
      title: "Energy Efficiency (6-Star)",
      icon: <Zap className="h-4 w-4" />,
      color: "yellow",
      items: [
        { id: "ee-1", requirement: `Ceiling insulation minimum ${rVal.ceiling} (Climate Zone ${climateZone})`, detail: `NatHERS-compliant batts or equivalent — full coverage with no gaps at eaves`, reference: "NCC Vol 2 — Part 3.12.1, H6D3" },
        { id: "ee-2", requirement: `Wall insulation minimum ${rVal.wall} (Climate Zone ${climateZone})`, detail: "Batts fully fill stud cavities — vapour permeable sarking behind cladding", reference: "NCC Vol 2 — Part 3.12.1, H6D3" },
        { id: "ee-3", requirement: `Floor insulation minimum ${rVal.floor} (Climate Zone ${climateZone})`, detail: rVal.floor === "N/A" ? "Not required for this climate zone" : "Underfloor batts or rigid board — retained by wire hangers or rigid support", reference: "NCC Vol 2 — Part 3.12.1, H6D3" },
        { id: "ee-4", requirement: "Glazing meets SHGC and U-value requirements for climate zone", detail: `Zone ${zone <= 3 ? "1–3: SHGC ≤0.4 cooling dominated" : zone <= 5 ? "4–5: balanced SHGC 0.4–0.6" : "6–8: SHGC ≥0.4 heating dominated"} — frame type and glass spec documented`, reference: "NCC Vol 2 — Part 3.12.1, H6D4" },
        { id: "ee-5", requirement: "NatHERS energy rating ≥6 stars achieved", detail: "Compliant software (AccuRate/FirstRate5) used — certificate from accredited assessor", reference: "NCC Vol 2 — Part H6V2, H6V3" },
        { id: "ee-6", requirement: "Draught sealing at all penetrations and openings", detail: "Exhaust fans, downlights, wall penetrations, door thresholds — all sealed", reference: "NCC Vol 2 — H6D5" },
        { id: "ee-7", requirement: "Whole-of-home energy budget ≤ maximum daily average (kWh/day)", detail: "All fixed appliances rated — hot water, heating, cooling, lighting counted", reference: "NCC 2022 — H6V4 Whole-of-home" },
        ...(isColdZone ? [{ id: "ee-8", requirement: "Vapour barrier/retarder installed in walls and ceiling (Cold Zone)", detail: "Climate zones 6–8: vapour permeable membranes prevent interstitial condensation — position on warm side", reference: "NCC 2022 — H6D6 Condensation management" }] : []),
      ],
    },
    {
      id: "waterproofing",
      title: "Waterproofing & Wet Areas",
      icon: <Droplets className="h-4 w-4" />,
      color: "blue",
      items: [
        { id: "wp-1", requirement: "Shower area waterproofed to AS 3740:2021 — minimum 1800mm height", detail: "Membrane applied to all shower walls to 1800mm AFF (or 50mm above rose — whichever higher) — certificate required", reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021" },
        { id: "wp-2", requirement: "Shower floor fully waterproofed including hob / kerb transition", detail: "Floor waterproof membrane extends 50mm up wall — fall to floor waste minimum 1:60", reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021" },
        { id: "wp-3", requirement: "Bathroom floor waterproofed — minimum 150mm up walls", detail: "Full floor membrane in wet areas — 150mm upstand at wall junctions", reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021" },
        { id: "wp-4", requirement: "Laundry floor and trough area waterproofed", detail: "Membrane under trough and 75mm up adjacent walls — floor fall to drain", reference: "NCC Vol 2 — Part 3.8.1" },
        { id: "wp-5", requirement: "Balcony/deck waterproofing and drainage", detail: "Continuous membrane, 150mm upstand at walls/door threshold — positive drainage to outlet", reference: "NCC Vol 2 — Part 3.8.1, AS 4654.2" },
        { id: "wp-6", requirement: "Roof flashing at all penetrations, junctions and ridges", detail: "Lead, copper or compatible flashing — step, apron, valley and counter flashings installed", reference: "NCC Vol 2 — Part 3.5.4" },
        { id: "wp-7", requirement: "Tile and grout joints not used as sole waterproofing", detail: "Tiles are a finish only — membrane must be installed under tiles in wet areas", reference: "NCC Vol 2 — Part 3.8.1, AS 3740:2021" },
      ],
    },
    {
      id: "fire",
      title: "Fire Safety",
      icon: <Flame className="h-4 w-4" />,
      color: "red",
      items: [
        { id: "fs-1", requirement: "Smoke alarms installed to AS 3786 — interconnected and mains powered", detail: "Minimum: every storey, every bedroom, between bedrooms and rest of dwelling — 240V hard-wired or 10-year battery", reference: "NCC Vol 2 — Part 3.7.2, AS 3786" },
        { id: "fs-2", requirement: "Smoke alarm position: on ceiling ≥300mm from walls, ≥400mm from corner", detail: "Not in dead-air space — minimum clearance from light fittings, fans and AC outlets", reference: "NCC Vol 2 — Part 3.7.2" },
        ...(buildingClass !== "1a" ? [{ id: "fs-3", requirement: "Fire-resistant construction between separate dwellings (FRL 60/60/60 min)", detail: "Party walls, floors and ceilings between Class 1b, 2 and 3 — rated system to AS 1530.4", reference: "NCC Vol 2 — Part 3.7.3" }] : []),
        { id: "fs-4", requirement: "Penetrations through fire-rated elements sealed (fire-stopping)", detail: "Pipe, cable and duct penetrations — intumescent collars or rated sealant system", reference: "NCC Vol 1 — Spec C3.15 (if applicable)" },
        { id: "fs-5", requirement: "Garage/carport fire separation from dwelling (if attached)", detail: "Minimum 60/60/60 FRL wall and self-closing door between garage and habitable areas", reference: "NCC Vol 2 — Part 3.7.3" },
        { id: "fs-6", requirement: "Ember guards on underfloor, eave and roof ventilation openings (BAL areas)", detail: "2mm corrosion-resistant steel mesh on all vents where BAL rating applies", reference: "NCC Vol 2 — Part 3.7.4, AS 3959" },
      ],
    },
    {
      id: "plumbing",
      title: "Plumbing & Drainage",
      icon: <Droplets className="h-4 w-4" />,
      color: "cyan",
      items: [
        { id: "pl-1", requirement: "Hot water system ≥60°C at storage vessel (AS/NZS 3500.4)", detail: "Storage temperature kills Legionella — tempering valve to limit delivery to ≤50°C at outlets", reference: "NCC Vol 3 — AS/NZS 3500.4" },
        { id: "pl-2", requirement: "Tempering valve on all bathroom/laundry outlets — max 50°C delivered", detail: "Thermal/mixing valve mandatory on HWS delivery to bathrooms — tested and labelled", reference: "NCC Vol 3 — AS/NZS 3500.4" },
        { id: "pl-3", requirement: "Backflow prevention device on potable supply", detail: "Containment device at point of supply for Class 1 buildings — type matches hazard rating", reference: "NCC Vol 3 — AS/NZS 3500.1" },
        { id: "pl-4", requirement: "Floor wastes in shower recesses — minimum DN50", detail: "Trapped grate to prevent sewer gas ingress — accessible for clearing", reference: "NCC Vol 3 — AS/NZS 3500.2" },
        { id: "pl-5", requirement: "Stormwater drainage separate from sewer system", detail: "Roof runoff directed to stormwater — no cross-connection with sanitary drainage", reference: "NCC Vol 3 — AS/NZS 3500.3" },
        { id: "pl-6", requirement: "Minimum water pressure 150 kPa at highest outlet", detail: "Flow rate ≥0.1 L/s at furthest/highest outlet under simultaneous use", reference: "NCC Vol 3 — AS/NZS 3500.1" },
        { id: "pl-7", requirement: "Lead content of plumbing products compliant (NCC 2022)", detail: "All fixtures and fittings in contact with drinking water — <0.25% lead content per WaterMark certification", reference: "NCC 2022 — AS 4020, WaterMark" },
      ],
    },
    {
      id: "livable",
      title: "Livable Housing (Accessibility)",
      icon: <Accessibility className="h-4 w-4" />,
      color: "green",
      items: [
        { id: "lh-1", requirement: "Step-free pathway from street/car park to dwelling entry", detail: "No steps on approach — maximum gradient 1:20 (ramps 1:14 max 15m, 1:8 max 1.5m)", reference: "NCC 2022 — H9D3 Livable Housing" },
        { id: "lh-2", requirement: "Step-free threshold at primary entrance door", detail: "Maximum 5mm lip — flush transition or ramped threshold profile", reference: "NCC 2022 — H9D3" },
        { id: "lh-3", requirement: "Internal doors minimum 820mm clear opening on ground floor", detail: "820mm clear (nominal 870mm door) — applies to all habitable room doors on ground level", reference: "NCC 2022 — H9D4, AS 1428.1" },
        { id: "lh-4", requirement: "Ground floor toilet compliant — space for future shower conversion", detail: "Shower-convertible bathroom OR separate ground floor toilet with 900×1200mm clear floor space", reference: "NCC 2022 — H9D5" },
        { id: "lh-5", requirement: "Walls around shower, toilet and bath reinforced for future grab rails", detail: "Nogging or blocking at 600–900mm AFF — capable of 1.1 kN point load for future rail installation", reference: "NCC 2022 — H9D5" },
        { id: "lh-6", requirement: "Corded blinds/curtains not installed (strangulation hazard)", detail: "All window coverings with accessible cords — cordless or cord cleats at 1600mm AFF", reference: "NCC 2022 — H9 Advisory" },
      ],
    },
    {
      id: "stairs",
      title: "Stairways & Balustrades",
      icon: <ArrowUpDown className="h-4 w-4" />,
      color: "purple",
      items: [
        { id: "st-1", requirement: "Stair risers ≤190mm, goings ≥240mm (Volume 2 residential)", detail: "Consistent dimensions throughout flight — open risers prohibited if children under 125mm head can pass", reference: "NCC Vol 2 — Part 3.9.1.1" },
        { id: "st-2", requirement: "Stair width ≥1000mm clear between enclosing walls/balustrades", detail: "Minimum 1m clear — handrail projection maximum 100mm into this width", reference: "NCC Vol 2 — Part 3.9.1" },
        { id: "st-3", requirement: "Continuous handrail both sides for ≥2m rise, one side for <2m", detail: "Handrail 865–1000mm above nosing line — graspable profile, returns at top and bottom", reference: "NCC Vol 2 — Part 3.9.2" },
        { id: "st-4", requirement: "Balustrade height ≥1000mm where drop ≥1m (≥865mm for stairs)", detail: "Non-climbable profile — vertical members max 125mm apart — horizontal rails must not form a ladder", reference: "NCC Vol 2 — Part 3.9.2, AS 1170.1" },
        { id: "st-5", requirement: "Balustrade structural load capacity (0.6 kN/m horizontal)", detail: "Fixings and posts designed for 0.6 kN/m lateral load — engineer check for spans >2m", reference: "NCC Vol 2 — Part 3.9.2, AS 1170.1" },
        { id: "st-6", requirement: "Stair treads non-slip surface or nosing strip", detail: "R10 minimum slip resistance on treads — contrasting nosing strip for low-vision users", reference: "NCC Vol 2 — Part 3.9.1, AS 4586" },
      ],
    },
    {
      id: "condensation",
      title: "Condensation & Ventilation",
      icon: <Wind className="h-4 w-4" />,
      color: "teal",
      items: [
        { id: "cv-1", requirement: "Bathroom/kitchen exhaust fans ducted to external air", detail: "Fan to discharge outside (not into ceiling cavity or subfloor) — minimum 25L/s capacity", reference: "NCC Vol 2 — Part 3.8.5" },
        { id: "cv-2", requirement: "Roof space ventilation provided (cross-ventilation)", detail: "Soffit/eave vents on opposite sides — minimum 0.2% of ceiling area each side", reference: "NCC Vol 2 — Part 3.8.4" },
        ...(isColdZone ? [
          { id: "cv-3", requirement: "Vapour permeable sarking to external walls (Zones 6–8)", detail: "Breathable membrane behind all cladding — lapped 150mm, taped at joins, flashed at openings", reference: "NCC 2022 — H6D6 Condensation" },
          { id: "cv-4", requirement: "Roof sarking vapour permeable (Zones 6–8)", detail: "Reflective sarking or breathable membrane — installed before battens, lap 150mm down slope", reference: "NCC 2022 — H6D6, Part 3.5.1" },
        ] : []),
        { id: "cv-5", requirement: "Range hood ducted externally OR recirculating with carbon filter", detail: "If external: duct diameter ≥150mm, backdraft damper, external cowl — or recirculating with grease + carbon filters", reference: "NCC Vol 2 — Part 3.8.5" },
        { id: "cv-6", requirement: "Subfloor ventilation for suspended ground floor", detail: "Cross-ventilation path — minimum 3500mm² per lineal metre of external wall — no blocked vents", reference: "NCC Vol 2 — Part 3.4.1" },
      ],
    },
    {
      id: "electrical",
      title: "Electrical & Safety",
      icon: <Zap className="h-4 w-4" />,
      color: "amber",
      items: [
        { id: "el-1", requirement: "RCD (safety switch) protection on all power and lighting circuits", detail: "Type I RCDs on all final sub-circuits — AS/NZS 3000:2018 mandatory since 2019 (Wiring Rules)", reference: "AS/NZS 3000:2018 — 2.6.3.2" },
        { id: "el-2", requirement: "Surge protection device (SPD) installed at main switchboard", detail: "AS/NZS 3000:2018 — Class II SPD at main board protects appliances from transient overvoltage", reference: "AS/NZS 3000:2018 — 2.10.6" },
        { id: "el-3", requirement: "All bathroom/wet area GPOs minimum 3000mm from water source", detail: "No GPO within 3m of shower, bath or pool — GFCI protection if within 2.5m unavoidable", reference: "AS/NZS 3000:2018 — 4.4.2" },
        { id: "el-4", requirement: "Underground cables protected by conduit or RCD", detail: "Direct-buried cables: min 500mm depth in garden, 300mm in concrete — or conduit throughout", reference: "AS/NZS 3000:2018 — 3.12" },
        { id: "el-5", requirement: "EV charger circuit provision if garage/carport present", detail: "NCC 2022 recommends 20A dedicated circuit roughed-in for future EV charging — note: mandatory in some states", reference: "NCC 2022 — Advisory H6 (EV readiness)" },
      ],
    },
    {
      id: "thermal",
      title: "Thermal Comfort & Glazing",
      icon: <Thermometer className="h-4 w-4" />,
      color: "rose",
      items: [
        { id: "th-1", requirement: `Total glazing area ≤ ${isHotZone ? "25%" : "40%"} of floor area (typical requirement)`, detail: "Excessive glazing impacts both thermal performance and privacy — oversized areas require NatHERS justification", reference: "NCC Vol 2 — Part 3.12, H6D4" },
        { id: "th-2", requirement: `${isHotZone ? "North-facing glazing shaded (eaves/pergola)" : "North-facing glazing maximised for passive solar"}`, detail: isHotZone ? "Shade coefficient: eaves sized to shade summer sun while allowing winter entry" : "Passive solar design — 60–70% of glazing on north façade, shaded by eaves in summer", reference: "NCC Vol 2 — H6D4" },
        { id: "th-3", requirement: "Ceiling fans provision in all bedrooms and living areas (hot climates)", detail: `${zone <= 3 ? "Recommended in Zones 1–3 for free cooling — reduces A/C load significantly" : "Optional — improves comfort in warm seasons"}`, reference: "NCC Vol 2 — Advisory (comfort)" },
        { id: "th-4", requirement: "External wall thermal mass appropriate for climate zone", detail: isHotZone ? "Zones 1–3: lightweight preferred for rapid cool-down at night" : "Zones 5–8: heavyweight masonry retains heat — beneficial for cool climates", reference: "NCC Vol 2 — H6D3" },
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

  return (
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
  );
};
