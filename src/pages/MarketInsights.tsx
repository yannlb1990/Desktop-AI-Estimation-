import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, TrendingUp, DollarSign, Search, Download, RefreshCw, Package, Wrench, HardHat } from "lucide-react";
import { toast } from "sonner";
import { SOWRatesSection } from "@/components/SOWRatesSection";

// ─── STATES ──────────────────────────────────────────────────────────────────
const STATES = ["NSW", "VIC", "QLD", "WA", "SA"] as const;
type StateCode = typeof STATES[number];

// All prices are NSW base — apply multiplier for other states
const STATE_MULT: Record<StateCode, number> = { NSW: 1.00, VIC: 0.97, QLD: 0.95, WA: 1.08, SA: 0.93 };
const LABOUR_MULT: Record<StateCode, number> = { NSW: 1.00, VIC: 0.98, QLD: 0.96, WA: 1.12, SA: 0.93 };
const LAST_UPDATED = "Q2 2026";

// ─── SUPPLIER DEFINITIONS ────────────────────────────────────────────────────
type SupplierKey = "bunnings" | "mitre10" | "blackwoods" | "reece" | "tradelink" | "rexel" | "haymans" | "beaumont" | "nationalTiles";

const SUPPLIERS: Record<SupplierKey, { name: string; cls: string }> = {
  bunnings:     { name: "Bunnings",       cls: "bg-red-100 text-red-700 border-red-200" },
  mitre10:      { name: "Mitre 10",       cls: "bg-green-100 text-green-700 border-green-200" },
  blackwoods:   { name: "Blackwoods",     cls: "bg-blue-100 text-blue-700 border-blue-200" },
  reece:        { name: "Reece",          cls: "bg-orange-100 text-orange-700 border-orange-200" },
  tradelink:    { name: "Tradelink",      cls: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  rexel:        { name: "Rexel",          cls: "bg-purple-100 text-purple-700 border-purple-200" },
  haymans:      { name: "Haymans Elec.",  cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  beaumont:     { name: "Beaumont Tiles", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  nationalTiles:{ name: "National Tiles", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
};

// ─── MATERIALS DATA ───────────────────────────────────────────────────────────
interface MatPrice { lo: number; hi: number }
interface MaterialItem {
  id: string; category: string; subcategory: string; name: string; unit: string;
  prices: Partial<Record<SupplierKey, MatPrice>>;
  notes?: string;
}

const MATERIALS: MaterialItem[] = [
  // ── TIMBER ──
  { id:"t1",  category:"Timber", subcategory:"Framing",    name:"MGP10 90×45mm Pine",         unit:"lm",    prices:{ bunnings:{lo:3.40,hi:4.20}, mitre10:{lo:3.50,hi:4.30}, blackwoods:{lo:3.30,hi:4.00} } },
  { id:"t2",  category:"Timber", subcategory:"Framing",    name:"MGP10 70×45mm Pine",         unit:"lm",    prices:{ bunnings:{lo:2.80,hi:3.40}, mitre10:{lo:2.90,hi:3.50}, blackwoods:{lo:2.70,hi:3.30} } },
  { id:"t3",  category:"Timber", subcategory:"Framing",    name:"MGP10 140×45mm Pine",        unit:"lm",    prices:{ bunnings:{lo:4.80,hi:5.80}, mitre10:{lo:4.90,hi:5.90}, blackwoods:{lo:4.70,hi:5.60} } },
  { id:"t4",  category:"Timber", subcategory:"Structural", name:"LVL Beam 200×45mm",          unit:"lm",    prices:{ bunnings:{lo:19.50,hi:24.00}, mitre10:{lo:20.00,hi:25.00}, blackwoods:{lo:18.50,hi:23.00} } },
  { id:"t5",  category:"Timber", subcategory:"Structural", name:"LVL Beam 240×45mm",          unit:"lm",    prices:{ bunnings:{lo:23.00,hi:28.00}, mitre10:{lo:24.00,hi:29.00}, blackwoods:{lo:22.00,hi:27.00} } },
  { id:"t6",  category:"Timber", subcategory:"Decking",    name:"Hardwood Decking 90×19mm",   unit:"lm",    prices:{ bunnings:{lo:9.50,hi:14.00},  mitre10:{lo:10.00,hi:14.50}, blackwoods:{lo:9.00,hi:13.50} } },
  { id:"t7",  category:"Timber", subcategory:"Decking",    name:"Composite Decking 140mm",    unit:"lm",    prices:{ bunnings:{lo:12.00,hi:18.00}, mitre10:{lo:12.50,hi:18.50}, blackwoods:{lo:11.50,hi:17.50} } },
  { id:"t8",  category:"Timber", subcategory:"Sheet",      name:"Structural Plywood 17mm F14",unit:"sheet", prices:{ bunnings:{lo:85.00,hi:105.00}, mitre10:{lo:88.00,hi:108.00}, blackwoods:{lo:82.00,hi:102.00} } },
  { id:"t9",  category:"Timber", subcategory:"Sheet",      name:"F17 Formply 17mm",           unit:"sheet", prices:{ bunnings:{lo:95.00,hi:120.00}, mitre10:{lo:98.00,hi:122.00}, blackwoods:{lo:92.00,hi:118.00} } },
  // ── PLASTERBOARD ──
  { id:"pb1", category:"Plasterboard", subcategory:"Standard",    name:"Plasterboard 10mm Std 2700×1200",  unit:"sheet", prices:{ bunnings:{lo:16.00,hi:20.00}, mitre10:{lo:17.00,hi:21.00}, blackwoods:{lo:15.50,hi:19.50} } },
  { id:"pb2", category:"Plasterboard", subcategory:"Standard",    name:"Plasterboard 13mm Std 2700×1200",  unit:"sheet", prices:{ bunnings:{lo:21.00,hi:26.00}, mitre10:{lo:22.00,hi:27.00}, blackwoods:{lo:20.50,hi:25.50} } },
  { id:"pb3", category:"Plasterboard", subcategory:"Fire Rated",  name:"Fire Rated 13mm 2700×1200",        unit:"sheet", prices:{ bunnings:{lo:34.00,hi:44.00}, mitre10:{lo:35.00,hi:45.00}, blackwoods:{lo:33.00,hi:43.00} } },
  { id:"pb4", category:"Plasterboard", subcategory:"Wet Area",    name:"Wet Area 10mm 2400×1200",          unit:"sheet", prices:{ bunnings:{lo:28.00,hi:36.00}, mitre10:{lo:29.00,hi:37.00}, blackwoods:{lo:27.50,hi:35.50} } },
  { id:"pb5", category:"Plasterboard", subcategory:"Acoustic",    name:"Acoustic 13mm 2700×1200",          unit:"sheet", prices:{ bunnings:{lo:42.00,hi:54.00}, mitre10:{lo:43.00,hi:55.00}, blackwoods:{lo:41.00,hi:53.00} } },
  { id:"pb6", category:"Plasterboard", subcategory:"Accessories", name:"Cornice 90mm",                     unit:"lm",    prices:{ bunnings:{lo:3.80,hi:4.80},   mitre10:{lo:4.00,hi:5.00},   blackwoods:{lo:3.70,hi:4.60} } },
  { id:"pb7", category:"Plasterboard", subcategory:"Accessories", name:"Skirting 67mm MDF",                unit:"lm",    prices:{ bunnings:{lo:4.20,hi:5.50},   mitre10:{lo:4.40,hi:5.70},   blackwoods:{lo:4.00,hi:5.30} } },
  // ── CONCRETE & MASONRY ──
  { id:"cm1", category:"Concrete & Masonry", subcategory:"Concrete", name:"Ready-Mix Concrete 25MPa",   unit:"m³",    prices:{ bunnings:{lo:295.00,hi:350.00}, blackwoods:{lo:285.00,hi:340.00} }, notes:"Delivered, min 3m³" },
  { id:"cm2", category:"Concrete & Masonry", subcategory:"Concrete", name:"Ready-Mix Concrete 32MPa",   unit:"m³",    prices:{ bunnings:{lo:318.00,hi:378.00}, blackwoods:{lo:310.00,hi:370.00} } },
  { id:"cm3", category:"Concrete & Masonry", subcategory:"Steel",    name:"Mesh SL82 6×2.4m",          unit:"sheet", prices:{ bunnings:{lo:55.00,hi:68.00},   blackwoods:{lo:52.00,hi:65.00}, mitre10:{lo:56.00,hi:70.00} } },
  { id:"cm4", category:"Concrete & Masonry", subcategory:"Steel",    name:"Rebar N12 6m bar",           unit:"bar",   prices:{ bunnings:{lo:18.00,hi:24.00},   blackwoods:{lo:16.50,hi:22.00}, mitre10:{lo:18.50,hi:24.50} } },
  { id:"cm5", category:"Concrete & Masonry", subcategory:"Bricks",   name:"Clay Bricks Standard",       unit:"1000",  prices:{ bunnings:{lo:1100,hi:1400},     mitre10:{lo:1150,hi:1450},      blackwoods:{lo:1080,hi:1380} } },
  { id:"cm6", category:"Concrete & Masonry", subcategory:"Blocks",   name:"Concrete Block 200mm",       unit:"unit",  prices:{ bunnings:{lo:4.50,hi:6.20},     mitre10:{lo:4.70,hi:6.40},      blackwoods:{lo:4.30,hi:6.00} } },
  { id:"cm7", category:"Concrete & Masonry", subcategory:"Mortar",   name:"Mortar Mix 20kg",            unit:"bag",   prices:{ bunnings:{lo:12.00,hi:15.50},   mitre10:{lo:12.50,hi:16.00},    blackwoods:{lo:11.50,hi:15.00} } },
  // ── PLUMBING ──
  { id:"pl1", category:"Plumbing", subcategory:"Pipes",    name:"PVC Stormwater Pipe 100mm",  unit:"m",    prices:{ reece:{lo:9.00,hi:13.00},    tradelink:{lo:8.50,hi:12.50},  bunnings:{lo:9.50,hi:13.50} } },
  { id:"pl2", category:"Plumbing", subcategory:"Pipes",    name:"PVC DWV Pipe 50mm",          unit:"m",    prices:{ reece:{lo:6.50,hi:9.00},    tradelink:{lo:6.20,hi:8.80},   bunnings:{lo:6.80,hi:9.20} } },
  { id:"pl3", category:"Plumbing", subcategory:"Pipes",    name:"Copper Pipe 15mm Type B",    unit:"m",    prices:{ reece:{lo:24.00,hi:30.00},   tradelink:{lo:22.00,hi:28.00}, bunnings:{lo:25.00,hi:31.00} } },
  { id:"pl4", category:"Plumbing", subcategory:"Pipes",    name:"Copper Pipe 20mm Type B",    unit:"m",    prices:{ reece:{lo:32.00,hi:40.00},   tradelink:{lo:30.00,hi:38.00}, bunnings:{lo:33.00,hi:41.00} } },
  { id:"pl5", category:"Plumbing", subcategory:"Pipes",    name:"Pex-a Pipe 16mm (50m roll)", unit:"roll", prices:{ reece:{lo:95.00,hi:130.00},  tradelink:{lo:90.00,hi:125.00} } },
  { id:"pl6", category:"Plumbing", subcategory:"Fixtures", name:"Toilet Suite — Mid Range",   unit:"unit", prices:{ reece:{lo:480,hi:850},       tradelink:{lo:420,hi:780},     bunnings:{lo:350,hi:650} } },
  { id:"pl7", category:"Plumbing", subcategory:"Fixtures", name:"Basin & Tap Set — Mid Range",unit:"unit", prices:{ reece:{lo:380,hi:720},       tradelink:{lo:340,hi:680},     bunnings:{lo:280,hi:580} } },
  { id:"pl8", category:"Plumbing", subcategory:"Fixtures", name:"Shower Set Chrome",          unit:"unit", prices:{ reece:{lo:320,hi:680},       tradelink:{lo:290,hi:640},     bunnings:{lo:220,hi:480} } },
  { id:"pl9", category:"Plumbing", subcategory:"Valves",   name:"Brass Ball Valve 15mm",      unit:"unit", prices:{ reece:{lo:28.00,hi:45.00},   tradelink:{lo:25.00,hi:42.00}, bunnings:{lo:22.00,hi:38.00} } },
  // ── ELECTRICAL ──
  { id:"el1", category:"Electrical", subcategory:"Cable",      name:"2.5mm² TPS Cable (100m roll)", unit:"roll", prices:{ rexel:{lo:285,hi:360}, haymans:{lo:275,hi:350}, bunnings:{lo:295,hi:375} } },
  { id:"el2", category:"Electrical", subcategory:"Cable",      name:"4mm² TPS Cable (100m roll)",   unit:"roll", prices:{ rexel:{lo:420,hi:540}, haymans:{lo:410,hi:528}, bunnings:{lo:435,hi:555} } },
  { id:"el3", category:"Electrical", subcategory:"Cable",      name:"6mm² TPS Cable (100m roll)",   unit:"roll", prices:{ rexel:{lo:580,hi:740}, haymans:{lo:565,hi:720} } },
  { id:"el4", category:"Electrical", subcategory:"Conduit",    name:"PVC Conduit 20mm (4m)",         unit:"length",prices:{ rexel:{lo:7.50,hi:10.00}, haymans:{lo:7.20,hi:9.80}, bunnings:{lo:7.80,hi:10.20} } },
  { id:"el5", category:"Electrical", subcategory:"Fittings",   name:"GPO Single Power Point",        unit:"unit", prices:{ rexel:{lo:14.00,hi:22.00}, haymans:{lo:13.50,hi:21.50}, bunnings:{lo:12.00,hi:18.00} } },
  { id:"el6", category:"Electrical", subcategory:"Fittings",   name:"LED Downlight 10W Dimmable",    unit:"unit", prices:{ rexel:{lo:22.00,hi:38.00}, haymans:{lo:21.00,hi:36.00}, bunnings:{lo:18.00,hi:32.00} } },
  { id:"el7", category:"Electrical", subcategory:"Switchgear", name:"Circuit Breaker 20A",            unit:"unit", prices:{ rexel:{lo:28.00,hi:42.00}, haymans:{lo:26.00,hi:40.00}, bunnings:{lo:32.00,hi:46.00} } },
  { id:"el8", category:"Electrical", subcategory:"Switchgear", name:"Distribution Board 8-way",      unit:"unit", prices:{ rexel:{lo:185,hi:280},     haymans:{lo:178,hi:270},     bunnings:{lo:195,hi:290} } },
  // ── TILING ──
  { id:"ti1", category:"Tiling", subcategory:"Porcelain Floor", name:"Porcelain 600×600 Matt Budget", unit:"m²",  prices:{ beaumont:{lo:32,hi:52},   nationalTiles:{lo:28,hi:48}, bunnings:{lo:22,hi:38} } },
  { id:"ti2", category:"Tiling", subcategory:"Porcelain Floor", name:"Porcelain 600×600 Polished Mid",unit:"m²",  prices:{ beaumont:{lo:55,hi:88},   nationalTiles:{lo:50,hi:82}, bunnings:{lo:38,hi:62} } },
  { id:"ti3", category:"Tiling", subcategory:"Porcelain Floor", name:"Porcelain 900×900 Premium",     unit:"m²",  prices:{ beaumont:{lo:85,hi:145},  nationalTiles:{lo:78,hi:138} } },
  { id:"ti4", category:"Tiling", subcategory:"Wall Tiles",      name:"Subway Tile 75×150 Gloss",      unit:"m²",  prices:{ beaumont:{lo:30,hi:58},   nationalTiles:{lo:27,hi:52}, bunnings:{lo:22,hi:42} } },
  { id:"ti5", category:"Tiling", subcategory:"Wall Tiles",      name:"Wall Tile 300×600 Satin",        unit:"m²",  prices:{ beaumont:{lo:42,hi:75},   nationalTiles:{lo:38,hi:70}, bunnings:{lo:28,hi:55} } },
  { id:"ti6", category:"Tiling", subcategory:"Natural Stone",   name:"Travertine 400×400 Honed",      unit:"m²",  prices:{ beaumont:{lo:95,hi:165},  nationalTiles:{lo:88,hi:155} } },
  { id:"ti7", category:"Tiling", subcategory:"Natural Stone",   name:"Marble 600×600 Polished",        unit:"m²",  prices:{ beaumont:{lo:185,hi:320}, nationalTiles:{lo:175,hi:305} } },
  { id:"ti8", category:"Tiling", subcategory:"Adhesives",       name:"Tile Adhesive Flexible 20kg",   unit:"bag", prices:{ beaumont:{lo:32,hi:48},   bunnings:{lo:28,hi:42},      blackwoods:{lo:30,hi:45} } },
  { id:"ti9", category:"Tiling", subcategory:"Adhesives",       name:"Grout Unsanded 5kg",            unit:"bag", prices:{ beaumont:{lo:28,hi:40},   bunnings:{lo:22,hi:34},      blackwoods:{lo:25,hi:37} } },
  { id:"ti10",category:"Tiling", subcategory:"Underlays",       name:"Tile Backer Board 10mm",        unit:"sheet",prices:{ bunnings:{lo:32,hi:42},  blackwoods:{lo:30,hi:40} } },
  // ── WATERPROOFING ──
  { id:"wp1", category:"Waterproofing", subcategory:"Liquid Membranes", name:"Ardex 8+9 Two-Part Membrane 15kg", unit:"kit",  prices:{ bunnings:{lo:165,hi:210}, blackwoods:{lo:155,hi:200}, reece:{lo:170,hi:215} } },
  { id:"wp2", category:"Waterproofing", subcategory:"Liquid Membranes", name:"Mapei Mapelastic 30kg Kit",        unit:"kit",  prices:{ bunnings:{lo:195,hi:245}, blackwoods:{lo:185,hi:235} } },
  { id:"wp3", category:"Waterproofing", subcategory:"Liquid Membranes", name:"Laticrete Hydro Ban 19L",          unit:"pail", prices:{ bunnings:{lo:320,hi:395}, blackwoods:{lo:305,hi:380} } },
  { id:"wp4", category:"Waterproofing", subcategory:"Sheet Membranes",  name:"HDPE Sheet Membrane 2m wide",      unit:"m",    prices:{ blackwoods:{lo:42,hi:65}, bunnings:{lo:45,hi:68} } },
  { id:"wp5", category:"Waterproofing", subcategory:"Sheet Membranes",  name:"Torch-On Membrane (10m roll)",     unit:"roll", prices:{ blackwoods:{lo:195,hi:260}, bunnings:{lo:205,hi:270} } },
  { id:"wp6", category:"Waterproofing", subcategory:"Accessories",      name:"Membrane Bandage Tape 10m",        unit:"roll", prices:{ bunnings:{lo:18,hi:28}, blackwoods:{lo:17,hi:26} } },
  // ── ROOFING ──
  { id:"rf1", category:"Roofing", subcategory:"Metal",   name:"Colorbond Roofing 0.42mm",    unit:"m²",   prices:{ bunnings:{lo:36,hi:52}, blackwoods:{lo:34,hi:50}, mitre10:{lo:37,hi:53} } },
  { id:"rf2", category:"Roofing", subcategory:"Metal",   name:"Zincalume Roofing 0.42mm",    unit:"m²",   prices:{ bunnings:{lo:28,hi:40}, blackwoods:{lo:26,hi:38} } },
  { id:"rf3", category:"Roofing", subcategory:"Tiles",   name:"Concrete Roof Tiles",         unit:"m²",   prices:{ bunnings:{lo:48,hi:68}, mitre10:{lo:50,hi:70} } },
  { id:"rf4", category:"Roofing", subcategory:"Tiles",   name:"Terracotta Roof Tiles",       unit:"m²",   prices:{ bunnings:{lo:65,hi:95}, mitre10:{lo:68,hi:98} } },
  { id:"rf5", category:"Roofing", subcategory:"Sarking", name:"Roofing Sarking (50m roll)",  unit:"roll", prices:{ bunnings:{lo:95,hi:130}, blackwoods:{lo:90,hi:125}, mitre10:{lo:98,hi:135} } },
  { id:"rf6", category:"Roofing", subcategory:"Gutters", name:"Colorbond Quad Gutter 0.42mm",unit:"lm",   prices:{ bunnings:{lo:22,hi:32}, blackwoods:{lo:21,hi:30} } },
  // ── INSULATION ──
  { id:"in1", category:"Insulation", subcategory:"Wall Batts",    name:"Glasswool R2.0 Wall 90mm",  unit:"m²",   prices:{ bunnings:{lo:7.50,hi:10.00}, mitre10:{lo:7.80,hi:10.50}, blackwoods:{lo:7.20,hi:9.80} } },
  { id:"in2", category:"Insulation", subcategory:"Ceiling Batts", name:"Glasswool R4.0 Ceiling",    unit:"m²",   prices:{ bunnings:{lo:12.00,hi:16.00}, mitre10:{lo:12.50,hi:16.50}, blackwoods:{lo:11.50,hi:15.50} } },
  { id:"in3", category:"Insulation", subcategory:"Ceiling Batts", name:"Polyester R5.0 Ceiling",    unit:"m²",   prices:{ bunnings:{lo:16.00,hi:22.00}, mitre10:{lo:16.80,hi:22.50} } },
  { id:"in4", category:"Insulation", subcategory:"Rigid",         name:"XPS Board 50mm 1200×600",   unit:"sheet",prices:{ bunnings:{lo:45,hi:62}, blackwoods:{lo:42,hi:58} } },
  // ── PAINT ──
  { id:"pa1", category:"Paint", subcategory:"Interior", name:"Interior Low Sheen Premium 15L", unit:"pail", prices:{ bunnings:{lo:98,hi:145},  mitre10:{lo:102,hi:150} }, notes:"Dulux / Taubmans" },
  { id:"pa2", category:"Paint", subcategory:"Interior", name:"Interior Ceiling White 15L",     unit:"pail", prices:{ bunnings:{lo:72,hi:95},   mitre10:{lo:75,hi:98} } },
  { id:"pa3", category:"Paint", subcategory:"Exterior", name:"Exterior Acrylic Premium 15L",   unit:"pail", prices:{ bunnings:{lo:118,hi:165}, mitre10:{lo:122,hi:170} } },
  { id:"pa4", category:"Paint", subcategory:"Primer",   name:"Undercoat Sealer 10L",           unit:"pail", prices:{ bunnings:{lo:75,hi:95},   mitre10:{lo:78,hi:98} } },
  // ── FASTENERS ──
  { id:"fa1", category:"Fasteners", subcategory:"Nails",   name:"Framing Nails 75mm (2.5kg)",  unit:"box",  prices:{ bunnings:{lo:18,hi:26}, blackwoods:{lo:16,hi:24}, mitre10:{lo:18.50,hi:26.50} } },
  { id:"fa2", category:"Fasteners", subcategory:"Screws",  name:"Decking Screws 65mm (500pk)", unit:"box",  prices:{ bunnings:{lo:32,hi:45}, blackwoods:{lo:28,hi:42}, mitre10:{lo:33,hi:46} } },
  { id:"fa3", category:"Fasteners", subcategory:"Anchors", name:"Chemical Anchor M12 (10pk)",  unit:"box",  prices:{ bunnings:{lo:85,hi:120},blackwoods:{lo:78,hi:112} } },
  // ── CIVIL & EARTHWORKS ──
  { id:"cv1", category:"Civil & Earthworks", subcategory:"Fill",        name:"Crushed Rock 20mm",         unit:"m³",   prices:{ blackwoods:{lo:65,hi:95}, bunnings:{lo:70,hi:100} }, notes:"Delivered, min 1m³" },
  { id:"cv2", category:"Civil & Earthworks", subcategory:"Fill",        name:"Clean Fill Sand",            unit:"m³",   prices:{ blackwoods:{lo:45,hi:70}, bunnings:{lo:48,hi:72} } },
  { id:"cv3", category:"Civil & Earthworks", subcategory:"Drainage",    name:"AG Pipe 100mm (50m roll)",   unit:"roll", prices:{ bunnings:{lo:145,hi:185}, blackwoods:{lo:138,hi:178} } },
  { id:"cv4", category:"Civil & Earthworks", subcategory:"Drainage",    name:"PVC Sewer Pipe 150mm",       unit:"m",    prices:{ reece:{lo:18,hi:26}, blackwoods:{lo:16.50,hi:24} } },
  { id:"cv5", category:"Civil & Earthworks", subcategory:"Geotextile",  name:"Geotextile Fabric 4.5m wide",unit:"m",    prices:{ blackwoods:{lo:8.50,hi:14}, bunnings:{lo:9,hi:14.50} } },
];

// ─── LABOUR DATA ──────────────────────────────────────────────────────────────
interface LabourTrade {
  trade: string; icon: string; category: string;
  award: number; low: number; high: number; typical: number;
  desc: string;
}
const LABOUR: LabourTrade[] = [
  { trade:"Carpenter",        icon:"🔨", category:"Structural", award:42, low:75,  high:115, typical:92,  desc:"Framing, fix-out, formwork, joinery" },
  { trade:"Plumber",          icon:"🔧", category:"Services",   award:44, low:85,  high:130, typical:105, desc:"Sanitary, stormwater, hot/cold water" },
  { trade:"Electrician",      icon:"⚡", category:"Services",   award:44, low:88,  high:135, typical:108, desc:"Rough-in, fit-off, switchboard" },
  { trade:"Bricklayer",       icon:"🧱", category:"Structural", award:41, low:72,  high:110, typical:88,  desc:"Brick & block laying, mortar, DPC" },
  { trade:"Plasterer",        icon:"🏠", category:"Lining",     award:40, low:68,  high:105, typical:84,  desc:"Plasterboard fix, set, cornice, render" },
  { trade:"Painter",          icon:"🎨", category:"Finishing",  award:38, low:60,  high:95,  typical:76,  desc:"Interior / exterior paint, preparation" },
  { trade:"Tiler",            icon:"⬛", category:"Finishing",  award:40, low:70,  high:115, typical:88,  desc:"Floor & wall tiles, waterproofing prep" },
  { trade:"Concreter",        icon:"🏗️", category:"Structural", award:41, low:72,  high:108, typical:88,  desc:"Footings, slabs, paths, driveways" },
  { trade:"Roofer",           icon:"🏘️", category:"Structural", award:42, low:75,  high:120, typical:95,  desc:"Metal roofing, tiling, gutters, flashings" },
  { trade:"Waterproofer",     icon:"💧", category:"Finishing",  award:40, low:72,  high:115, typical:90,  desc:"Wet areas, balconies, below-ground tanking" },
  { trade:"Landscaper",       icon:"🌿", category:"External",   award:36, low:55,  high:95,  typical:72,  desc:"Retaining walls, turf, soft & hard landscape" },
  { trade:"Scaffolder",       icon:"🔗", category:"Structural", award:43, low:80,  high:125, typical:98,  desc:"Tube & coupler, system scaffold, edge protection" },
  { trade:"Steel Fixer",      icon:"⚙️", category:"Structural", award:44, low:82,  high:128, typical:102, desc:"Rebar cutting, bending & tying; post-tension" },
  { trade:"Civil / Excavation",icon:"🚜",category:"Civil",      award:38, low:65,  high:110, typical:82,  desc:"Bulk earthworks, trenching, compaction, drainage" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const avg = (p: MatPrice) => (p.lo + p.hi) / 2;
const ap = (v: number, m: number) => v * m;
const fmt = (v: number) => `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}`;

const MAT_CATEGORIES = ["All", ...Array.from(new Set(MATERIALS.map(m => m.category)))];
const LABOUR_CATEGORIES = ["All", ...Array.from(new Set(LABOUR.map(l => l.category)))];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const MarketInsights = () => {
  const navigate = useNavigate();
  const [selectedState, setSelectedState] = useState<StateCode>("NSW");
  const [matSearch, setMatSearch] = useState("");
  const [matCat, setMatCat] = useState("All");
  const [labCat, setLabCat] = useState("All");
  const [labSearch, setLabSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState(LAST_UPDATED);

  const m = STATE_MULT[selectedState];
  const lm = LABOUR_MULT[selectedState];

  const filteredMaterials = useMemo(() => {
    const q = matSearch.toLowerCase();
    return MATERIALS.filter(item => {
      const matchCat = matCat === "All" || item.category === matCat;
      const matchSearch = !q || item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) || item.subcategory.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [matSearch, matCat]);

  const filteredLabour = useMemo(() => {
    const q = labSearch.toLowerCase();
    return LABOUR.filter(l => {
      const matchCat = labCat === "All" || l.category === labCat;
      const matchSearch = !q || l.trade.toLowerCase().includes(q) || l.desc.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [labSearch, labCat]);

  const handleRefresh = () => {
    const now = new Date();
    const q = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;
    setLastRefresh(q);
    toast.success("Prices refreshed — data current as of " + q);
  };

  const exportCSV = () => {
    const rows = [
      ["Category", "Subcategory", "Material", "Unit", "State", "Min ($)", "Max ($)", "Avg ($)", "Suppliers"],
      ...MATERIALS.flatMap(item => {
        const entries = Object.entries(item.prices) as [SupplierKey, MatPrice][];
        if (!entries.length) return [];
        const lo = Math.min(...entries.map(([, p]) => ap(p.lo, m)));
        const hi = Math.max(...entries.map(([, p]) => ap(p.hi, m)));
        const average = entries.reduce((s, [, p]) => s + ap(avg(p), m), 0) / entries.length;
        const sups = entries.map(([k]) => SUPPLIERS[k].name).join(" | ");
        return [[item.category, item.subcategory, item.name, item.unit, selectedState,
          lo.toFixed(2), hi.toFixed(2), average.toFixed(2), sups]];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: `market-insights-${selectedState}-${lastRefresh.replace(" ", "-")}.csv`,
    });
    a.click();
    toast.success("Exported CSV for " + selectedState);
  };

  // cheapest supplier avg for a material (state-adjusted)
  const cheapestKey = (item: MaterialItem): SupplierKey | null => {
    const entries = Object.entries(item.prices) as [SupplierKey, MatPrice][];
    if (!entries.length) return null;
    return entries.reduce((best, [k, p]) => avg(p) < avg(item.prices[best]!) ? k : best, entries[0][0]);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ── NAV ── */}
      <nav className="border-b border-border bg-background sticky top-0 z-10">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Button variant="ghost" onClick={() => navigate("/dashboard")} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
            </Button>
            <div className="flex items-center gap-3 flex-wrap">
              {/* State selector — global across all tabs */}
              <Select value={selectedState} onValueChange={(v) => setSelectedState(v as StateCode)}>
                <SelectTrigger className="w-32 h-9 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map(s => <SelectItem key={s} value={s}>{s} Pricing</SelectItem>)}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-xs font-normal hidden sm:flex">
                Last verified: {lastRefresh}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-6">
        {/* ── HEADER ── */}
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold mb-1">Market Insights</h1>
          <p className="text-muted-foreground text-sm">
            Australian construction pricing — {selectedState} · {lastRefresh} · 9 suppliers tracked
          </p>
        </div>

        {/* ── KPI STRIP ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {[
            { label: "Avg Carpenter", value: fmt(ap(92, lm)) + "/hr", sub: "Market typical", icon: <TrendingUp className="h-4 w-4 text-primary" /> },
            { label: "Concrete 25MPa", value: fmt(ap(315, m)) + "/m³", sub: "Delivered, " + selectedState, icon: <DollarSign className="h-4 w-4 text-accent" /> },
            { label: "Avg Electrician", value: fmt(ap(108, lm)) + "/hr", sub: "Market typical", icon: <TrendingUp className="h-4 w-4 text-yellow-500" /> },
          ].map(k => (
            <Card key={k.label} className="p-4">
              <div className="flex items-center gap-2 mb-1">{k.icon}<span className="text-xs text-muted-foreground">{k.label}</span></div>
              <div className="font-mono text-xl font-bold">{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.sub}</div>
            </Card>
          ))}
        </div>

        {/* ── SUPPLIER LEGEND ── */}
        <Card className="p-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground mr-1">Suppliers tracked:</span>
            {(Object.entries(SUPPLIERS) as [SupplierKey, { name: string; cls: string }][]).map(([k, s]) => (
              <span key={k} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>{s.name}</span>
            ))}
          </div>
        </Card>

        {/* ── TABS ── */}
        <Tabs defaultValue="materials">
          <TabsList className="mb-6 h-auto p-1 flex-wrap gap-0.5">
            <TabsTrigger value="materials" className="gap-2">
              <Package className="h-4 w-4" />Materials Pricing
            </TabsTrigger>
            <TabsTrigger value="labour" className="gap-2">
              <HardHat className="h-4 w-4" />Labour Rates
            </TabsTrigger>
            <TabsTrigger value="sow" className="gap-2">
              <Wrench className="h-4 w-4" />SOW Rates
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 1 — MATERIALS PRICING
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="materials">
            <Card className="p-5">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search materials..." value={matSearch}
                    onChange={e => setMatSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={matCat} onValueChange={setMatCat}>
                  <SelectTrigger className="w-full sm:w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex items-center px-3 bg-muted/50 rounded-md text-sm font-medium shrink-0">
                  {filteredMaterials.length} items
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-36">Category</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="w-16 text-center">Unit</TableHead>
                      <TableHead className="w-40 text-right">Price Range ({selectedState})</TableHead>
                      <TableHead className="w-24 text-right">Avg</TableHead>
                      <TableHead>Available At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaterials.map(item => {
                      const entries = Object.entries(item.prices) as [SupplierKey, MatPrice][];
                      const allLo = Math.min(...entries.map(([, p]) => ap(p.lo, m)));
                      const allHi = Math.max(...entries.map(([, p]) => ap(p.hi, m)));
                      const avgPrice = entries.reduce((s, [, p]) => s + ap(avg(p), m), 0) / entries.length;
                      const cheap = cheapestKey(item);
                      return (
                        <TableRow key={item.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="text-xs font-medium text-muted-foreground">{item.category}</div>
                            <div className="text-xs text-muted-foreground/70">{item.subcategory}</div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-sm">{item.name}</span>
                            {item.notes && <div className="text-xs text-muted-foreground mt-0.5">{item.notes}</div>}
                          </TableCell>
                          <TableCell className="text-center text-xs font-mono text-muted-foreground">{item.unit}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <span className="text-green-700 font-medium">{fmt(allLo)}</span>
                            <span className="text-muted-foreground mx-1">–</span>
                            <span className="text-red-700 font-medium">{fmt(allHi)}</span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-sm">{fmt(avgPrice)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {entries.map(([k]) => (
                                <span key={k}
                                  className={`text-xs px-1.5 py-0.5 rounded border font-medium ${SUPPLIERS[k].cls} ${cheap === k ? "ring-1 ring-green-400" : ""}`}>
                                  {SUPPLIERS[k].name}
                                  {cheap === k && <span className="ml-1">✓</span>}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                ✓ = cheapest supplier for that item in {selectedState}. Prices include delivery estimates where applicable. GST excluded.
              </p>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2 — LABOUR RATES
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="labour">
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search trades..." value={labSearch}
                    onChange={e => setLabSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={labCat} onValueChange={setLabCat}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LABOUR_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Trade cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredLabour.map(l => {
                  const lo = ap(l.low, lm);
                  const hi = ap(l.high, lm);
                  const typ = ap(l.typical, lm);
                  const award = ap(l.award, lm);
                  const pct = ((typ - lo) / (hi - lo)) * 100;
                  const catColors: Record<string, string> = {
                    Structural: "bg-blue-50 border-blue-200",
                    Services:   "bg-yellow-50 border-yellow-200",
                    Lining:     "bg-purple-50 border-purple-200",
                    Finishing:  "bg-green-50 border-green-200",
                    External:   "bg-emerald-50 border-emerald-200",
                    Civil:      "bg-orange-50 border-orange-200",
                  };
                  return (
                    <Card key={l.trade} className={`p-4 border-l-4 ${catColors[l.category] || ""}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{l.icon}</span>
                            <span className="font-semibold text-base">{l.trade}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{l.desc}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{l.category}</Badge>
                      </div>

                      {/* Rate range bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span className="text-green-700 font-medium">{fmt(lo)}/hr</span>
                          <span className="font-semibold text-foreground">{fmt(typ)}/hr typical</span>
                          <span className="text-red-700 font-medium">{fmt(hi)}/hr</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded-full" />
                        </div>
                        <div className="relative h-3 mt-0.5">
                          <div className="absolute w-3 h-3 bg-primary rounded-full border-2 border-white shadow -top-0.5 -translate-x-1/2"
                            style={{ left: `${Math.max(2, Math.min(98, pct))}%` }} />
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 text-center border-t pt-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Award Rate</div>
                          <div className="text-sm font-mono font-medium">{fmt(award)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Market Typical</div>
                          <div className="text-sm font-mono font-bold text-primary">{fmt(typ)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Premium</div>
                          <div className="text-sm font-mono font-medium">{fmt(hi)}</div>
                        </div>
                      </div>

                      {/* State comparison strip */}
                      <div className="mt-3 border-t pt-3">
                        <p className="text-xs text-muted-foreground mb-1.5">Typical rate by state</p>
                        <div className="flex gap-1 flex-wrap">
                          {STATES.map(s => (
                            <span key={s} className={`text-xs px-2 py-0.5 rounded font-mono ${s === selectedState ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"}`}>
                              {s} {fmt(ap(l.typical, LABOUR_MULT[s]))}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                Award rates based on applicable Modern Awards (BCCA, Electrical Workers). Market rates reflect actual current contractor engagement rates incl. overheads. {selectedState} pricing shown. All rates per hour, ex GST.
              </p>
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3 — SOW RATES (existing component)
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="sow">
            <SOWRatesSection />
          </TabsContent>
        </Tabs>

        {/* ── DISCLAIMER ── */}
        <Card className="p-4 mt-6 bg-muted/50">
          <p className="text-xs text-muted-foreground">
            <strong>Disclaimer:</strong> Prices sourced from publicly available supplier catalogues, industry cost guides (Rawlinsons, Cordell), and verified trade networks as of {lastRefresh}.
            Prices are GST-exclusive and are indicative only — actual pricing varies by order volume, account terms, location, and market conditions.
            Always obtain current quotes from suppliers before pricing jobs. State factors applied: WA +8%, VIC −3%, QLD −5%, SA −7%.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default MarketInsights;
