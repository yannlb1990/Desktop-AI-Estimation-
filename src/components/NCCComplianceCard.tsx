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
