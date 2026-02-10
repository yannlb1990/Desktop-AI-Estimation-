// AI Plan Analyzer - Comprehensive PDF analysis for construction estimation
// Extracts building elements, symbols, schedules, and generates auto-estimation

import {
  loadPDFFromFile,
  loadPDFFromArrayBuffer,
  extractPageText,
  PDFLoadResult,
  ExtractedTextItem,
} from './pdfService';
import {
  ExtractedText,
  extractTextFromPDF,
  findDimensions,
  findRoomLabels,
  findAnnotations,
  findDoorWindowTags,
  findFloorFinishes,
} from './takeoff/pdfTextExtractor';
import { Trade, MeasurementArea, CostItem, Measurement } from './takeoff/types';
import { lookupMaterial } from './materialLookup';
import {
  AUSTRALIAN_CONSTRUCTION_RATES,
  SOWCategory,
  SOW_CATEGORY_LABELS,
  SOW_CATEGORY_ORDER,
  getRateByCode,
  calculateTypicalHouseCost,
  DEFAULT_OVERHEADS,
} from './australianRates';
import {
  extractFloorAreas as extractFloorAreasFromTexts,
  parseWindowScheduleTable,
  parseDoorScheduleTable,
  countSymbolReferences,
} from './takeoff/pdfTextExtractor';

// === TYPES ===

export type DrawingType =
  | 'floor_plan'
  | 'site_plan'
  | 'elevation'
  | 'section'
  | 'detail'
  | 'schedule'
  | 'electrical'
  | 'plumbing'
  | 'structural'
  | 'ffe'
  | 'roof_plan'
  | 'reflected_ceiling'
  | 'landscape'
  | 'unknown';

export type ConstructionType = 'timber_frame' | 'steel_frame' | 'brick_veneer' | 'double_brick' | 'concrete' | 'unknown';

export interface DetectedSymbol {
  type: 'door' | 'window' | 'power_point' | 'light' | 'switch' | 'tap' | 'sink' | 'toilet' | 'shower' | 'appliance' | 'furniture' | 'site_element' | 'other';
  subType?: string;
  bounds: { x: number; y: number; width: number; height: number };
  label?: string;
  scheduleRef?: string;  // Reference to schedule item (e.g., "W01", "D05")
  confidence: number;
  pageIndex: number;
}

export interface DetectedElement {
  type: 'wall' | 'ceiling' | 'floor' | 'roof' | 'beam' | 'column' | 'slab' | 'footing';
  constructionType: ConstructionType;
  material?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    area?: number;
    thickness?: number;
  };
  location?: string;
  roomLabel?: string;
  nccReference?: string;
  confidence: number;
  pageIndex: number;
}

export interface ScheduleItem {
  type: 'window' | 'door' | 'finish' | 'hardware' | 'appliance' | 'light_fixture';
  reference: string;  // e.g., "W01", "D05"
  description: string;
  size?: string;
  material?: string;
  manufacturer?: string;
  model?: string;
  finish?: string;
  hardware?: string;
  quantity: number;
  location?: string[];
  unitCost?: number;
  pageIndex: number;
}

export interface PageAnalysis {
  pageIndex: number;
  pageNumber: number;
  drawingType: DrawingType;
  drawingTitle?: string;
  drawingNumber?: string;
  scale?: string;
  constructionType: ConstructionType;
  elements: DetectedElement[];
  symbols: DetectedSymbol[];
  scheduleItems: ScheduleItem[];
  rooms: { name: string; area?: number }[];
  dimensions: { text: string; value?: number; unit?: string }[];
  annotations: string[];
  textContent: string[];
  confidence: number;
  // Enhanced extraction data
  standardsReferences?: StandardsReference[];
  materialSelections?: MaterialSelection[];
  floorAreas?: FloorArea[];
  electricalCounts?: Record<string, number>;
}

export interface PlanAnalysisResult {
  fileName: string;
  totalPages: number;
  analysisDate: Date;
  pages: PageAnalysis[];
  summary: {
    projectType: string;
    constructionType: ConstructionType;
    totalFloorArea?: number;
    totalRooms: number;
    totalDoors: number;
    totalWindows: number;
    trades: Trade[];
    // Enhanced summary data
    floorAreas?: FloorArea[];
    standardsReferenced?: string[];
    materialSelections?: MaterialSelection[];
  };
  schedules: {
    windows: ScheduleItem[];
    doors: ScheduleItem[];
    finishes: ScheduleItem[];
    appliances: ScheduleItem[];
  };
  // Enhanced extraction results
  standardsReferences: StandardsReference[];
  materialSelections: MaterialSelection[];
  electricalSummary?: Record<string, number>;
  estimatedItems: EstimatedLineItem[];
}

// Source location tracking for traceability
export interface SourceLocation {
  pageNumber: number;
  pageIndex: number;
  drawingType: DrawingType;
  drawingTitle?: string;
  gridReference?: string;  // e.g., "A4", "B2"
  detectionMethod: 'text_pattern' | 'symbol_match' | 'schedule_parse' | 'hatch_analysis' | 'dimension_calc' | 'inference';
  detectionReason: string;  // Human-readable explanation
  symbolRef?: string;  // Reference to DetectedSymbol id
  scheduleRef?: string;  // Reference to ScheduleItem reference
  bounds?: { x: number; y: number; width: number; height: number };  // Normalized 0-100%
}

export interface MaterialLookupInfo {
  found: boolean;
  materialName: string;
  supplier?: string;
  unitPrice?: number;
  priceUnit?: string;
  lastUpdated?: string;
  alternatives?: Array<{ name: string; supplier: string; price: number }>;
  reason?: string; // Why not found
}

export interface CalculationBreakdown {
  quantitySource: string;
  quantityFormula?: string;
  assumptions: string[];
  warnings: string[];
  materialRate: number;
  materialSource: string;
  labourRate: number;
  labourHoursPerUnit: number;
  labourSource: string;
}

export interface EstimatedLineItem {
  id: string;
  trade: Trade;
  category: string;
  description: string;
  quantity: number;
  unit: 'LM' | 'M2' | 'M3' | 'count' | 'each' | 'item';
  unitRate: number;
  labourHours: number;
  materialCost: number;
  labourCost: number;
  totalCost: number;
  area?: MeasurementArea;
  nccCode?: string;
  source: 'detected' | 'schedule' | 'inferred';
  confidence: number;
  // Source traceability
  sourceLocations?: SourceLocation[];
  primarySource?: SourceLocation;
  // Material lookup info
  materialLookup?: MaterialLookupInfo;
  // Calculation breakdown for audit trail
  calculationBreakdown?: CalculationBreakdown;
}

// === DRAWING TYPE CLASSIFICATION ===

const DRAWING_TYPE_KEYWORDS: Record<DrawingType, string[]> = {
  floor_plan: ['floor plan', 'ground floor', 'first floor', 'level', 'layout', 'ga plan', 'general arrangement'],
  site_plan: ['site plan', 'site layout', 'block plan', 'survey', 'setback', 'boundary'],
  elevation: ['elevation', 'north elevation', 'south elevation', 'east elevation', 'west elevation', 'front', 'rear', 'side'],
  section: ['section', 'cross section', 'longitudinal', 'detail section', 'building section'],
  detail: ['detail', 'construction detail', 'junction', 'typical', 'connection'],
  schedule: ['schedule', 'window schedule', 'door schedule', 'finish schedule', 'legend'],
  electrical: ['electrical', 'power', 'lighting', 'switchboard', 'circuit', 'data', 'communications'],
  plumbing: ['plumbing', 'hydraulic', 'drainage', 'water', 'sewer', 'stormwater', 'sanitary'],
  structural: ['structural', 'framing', 'footing', 'slab', 'beam', 'column', 'steel', 'rebar'],
  ffe: ['ff&e', 'furniture', 'fixtures', 'equipment', 'fitout', 'joinery'],
  roof_plan: ['roof plan', 'roofing', 'roof framing', 'roof layout'],
  reflected_ceiling: ['rcp', 'reflected ceiling', 'ceiling plan', 'ceiling layout'],
  landscape: ['landscape', 'planting', 'garden', 'paving', 'external works'],
  unknown: [],
};

function classifyDrawingType(texts: ExtractedText[]): { type: DrawingType; confidence: number; title?: string } {
  const allText = texts.map(t => t.text.toLowerCase()).join(' ');

  let bestMatch: DrawingType = 'unknown';
  let bestScore = 0;
  let matchedTitle: string | undefined;

  for (const [type, keywords] of Object.entries(DRAWING_TYPE_KEYWORDS) as [DrawingType, string[]][]) {
    let score = 0;
    for (const keyword of keywords) {
      if (allText.includes(keyword)) {
        score += keyword.split(' ').length; // Multi-word matches score higher
        // Try to extract the title
        const regex = new RegExp(`([^\\n]*${keyword}[^\\n]*)`, 'i');
        const match = allText.match(regex);
        if (match) {
          matchedTitle = match[1].trim().substring(0, 100);
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = type;
      if (matchedTitle) {
        matchedTitle = matchedTitle;
      }
    }
  }

  return {
    type: bestMatch,
    confidence: Math.min(bestScore / 5, 1),
    title: matchedTitle,
  };
}

// === CONSTRUCTION TYPE DETECTION ===

const CONSTRUCTION_TYPE_PATTERNS: Record<ConstructionType, RegExp[]> = {
  timber_frame: [
    /timber\s*frame/i,
    /stud\s*wall/i,
    /90\s*x\s*45/i,
    /70\s*x\s*35/i,
    /noggin/i,
    /bearer/i,
    /joist/i,
    /rafter/i,
    /truss/i,
  ],
  steel_frame: [
    /steel\s*frame/i,
    /light\s*gauge/i,
    /c\s*section/i,
    /rhs/i,
    /shs/i,
    /ufc/i,
    /portal\s*frame/i,
  ],
  brick_veneer: [
    /brick\s*veneer/i,
    /face\s*brick/i,
    /cavity\s*wall/i,
    /110\s*brick/i,
  ],
  double_brick: [
    /double\s*brick/i,
    /solid\s*brick/i,
    /230\s*brick/i,
    /full\s*brick/i,
  ],
  concrete: [
    /concrete\s*block/i,
    /tilt[\s-]?up/i,
    /precast/i,
    /in[\s-]?situ/i,
    /concrete\s*wall/i,
    /hebel/i,
    /aac/i,
  ],
  unknown: [],
};

function detectConstructionType(texts: ExtractedText[]): { type: ConstructionType; confidence: number } {
  const allText = texts.map(t => t.text.toLowerCase()).join(' ');

  let bestMatch: ConstructionType = 'unknown';
  let bestScore = 0;

  for (const [type, patterns] of Object.entries(CONSTRUCTION_TYPE_PATTERNS) as [ConstructionType, RegExp[]][]) {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(allText)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = type;
    }
  }

  // Also check for hatch pattern keywords
  if (allText.includes('diagonal hatch') || allText.includes('brick hatch')) {
    if (bestMatch === 'unknown') {
      bestMatch = 'brick_veneer';
      bestScore = 1;
    }
  }

  return {
    type: bestMatch,
    confidence: Math.min(bestScore / 3, 1),
  };
}

// === SYMBOL RECOGNITION ===

const SYMBOL_PATTERNS: Record<string, { regex: RegExp; type: DetectedSymbol['type']; subType?: string }[]> = {
  doors: [
    { regex: /\bD(\d{1,2})\b/gi, type: 'door' },
    { regex: /door\s*(\d+)/gi, type: 'door' },
    { regex: /\bSD\d/gi, type: 'door', subType: 'sliding' },
    { regex: /\bPD\d/gi, type: 'door', subType: 'pivot' },
    { regex: /\bBFD\d/gi, type: 'door', subType: 'bifold' },
    // Commercial door types
    { regex: /\bFD\d/gi, type: 'door', subType: 'fire_door' },
    { regex: /\bAD\d/gi, type: 'door', subType: 'automatic' },
    { regex: /\bRD\d/gi, type: 'door', subType: 'roller' },
    { regex: /\bGD\d/gi, type: 'door', subType: 'glass' },
  ],
  windows: [
    { regex: /\bW(\d{1,2})\b/gi, type: 'window' },
    { regex: /window\s*(\d+)/gi, type: 'window' },
    { regex: /\bAW\d/gi, type: 'window', subType: 'awning' },
    { regex: /\bSW\d/gi, type: 'window', subType: 'sliding' },
    { regex: /\bFW\d/gi, type: 'window', subType: 'fixed' },
    { regex: /\bDH\d/gi, type: 'window', subType: 'double_hung' },
    { regex: /\bCW\d/gi, type: 'window', subType: 'curtain_wall' },
  ],
  // Commercial/Office rooms - detect room labels as "other" type for scope detection
  rooms: [
    { regex: /\b(OFFICE)\s*\d*[A-Z]?\b/gi, type: 'other', subType: 'office' },
    { regex: /\b(CORRIDOR)\s*\d*\b/gi, type: 'other', subType: 'corridor' },
    { regex: /\b(MEETING)\s*(ROOM)?\s*\d*\b/gi, type: 'other', subType: 'meeting' },
    { regex: /\b(CONFERENCE)\s*(ROOM)?\s*\d*\b/gi, type: 'other', subType: 'conference' },
    { regex: /\b(RECEPTION)\b/gi, type: 'other', subType: 'reception' },
    { regex: /\b(LOBBY)\b/gi, type: 'other', subType: 'lobby' },
    { regex: /\b(LIFT|ELEVATOR)\s*\d*\b/gi, type: 'other', subType: 'lift' },
    { regex: /\b(SERVICE\s*LIFT)\b/gi, type: 'other', subType: 'service_lift' },
    { regex: /\b(STAIR|STAIRWELL)\s*\d*\b/gi, type: 'other', subType: 'stair' },
    { regex: /\b(FIRE\s*STAIR)\b/gi, type: 'other', subType: 'fire_stair' },
    { regex: /\b(PLANT)\s*(ROOM)?\b/gi, type: 'other', subType: 'plant_room' },
    { regex: /\b(AC\s*PLANT)\b/gi, type: 'other', subType: 'ac_plant' },
    { regex: /\b(COMMS)\s*(ROOM)?\b/gi, type: 'other', subType: 'comms' },
    { regex: /\b(SERVER)\s*(ROOM)?\b/gi, type: 'other', subType: 'server' },
    { regex: /\b(ELECTRICAL)\s*(ROOM)?\b/gi, type: 'other', subType: 'electrical' },
    { regex: /\b(MECHANICAL)\s*(ROOM)?\b/gi, type: 'other', subType: 'mechanical' },
    { regex: /\b(AMENITIES)\b/gi, type: 'other', subType: 'amenities' },
    { regex: /\b(BREAKOUT)\b/gi, type: 'other', subType: 'breakout' },
    { regex: /\b(KITCHENETTE)\b/gi, type: 'other', subType: 'kitchenette' },
    { regex: /\b(CLEANERS?)\b/gi, type: 'other', subType: 'cleaners' },
    { regex: /\b(STORAGE)\b/gi, type: 'other', subType: 'storage' },
    // Room number patterns (4.28A, G.01, L1.05)
    { regex: /\b(\d+\.\d+[A-Z]?)\b/g, type: 'other', subType: 'room_number' },
    { regex: /\b([GBLP]\d*\.\d+[A-Z]?)\b/gi, type: 'other', subType: 'room_number' },
  ],
  electrical: [
    { regex: /\bGPO\b/gi, type: 'power_point' },
    { regex: /\bDGPO\b/gi, type: 'power_point', subType: 'double' },
    { regex: /\bSW\b(?!\d)/gi, type: 'switch' },
    { regex: /\bDIM\b/gi, type: 'switch', subType: 'dimmer' },
    { regex: /\b(LED|downlight|pendant|batten)\b/gi, type: 'light' },
  ],
  plumbing: [
    { regex: /\b(basin|vanity)\b/gi, type: 'sink' },
    { regex: /\bWC\b/gi, type: 'toilet' },
    { regex: /\b(shower|shwr)\b/gi, type: 'shower' },
    { regex: /\b(HWT|hot\s*water)/gi, type: 'appliance', subType: 'hot_water' },
  ],
  appliances: [
    { regex: /\b(DW|dishwasher)\b/gi, type: 'appliance', subType: 'dishwasher' },
    { regex: /\b(WM|washing\s*machine)\b/gi, type: 'appliance', subType: 'washing_machine' },
    { regex: /\b(cooktop|rangehood)\b/gi, type: 'appliance', subType: 'cooking' },
    { regex: /\b(fridge|refrigerator)\b/gi, type: 'appliance', subType: 'fridge' },
    { regex: /\boven\b/gi, type: 'appliance', subType: 'oven' },
    { regex: /\b(AC|air\s*con)/gi, type: 'appliance', subType: 'aircon' },
  ],
  site_elements: [
    // Bike racks and parking
    { regex: /\b(bike\s*rack|bicycle\s*rack|bike\s*stand|bicycle\s*stand|cycle\s*rack)\b/gi, type: 'site_element', subType: 'bike_rack' },
    { regex: /\b(\d+)\s*(?:bike|bicycle)\s*spaces?\b/gi, type: 'site_element', subType: 'bike_parking' },
    // Bollards and barriers
    { regex: /\b(bollard|removable\s*bollard|fixed\s*bollard)\b/gi, type: 'site_element', subType: 'bollard' },
    { regex: /\b(wheel\s*stop|car\s*stop)\b/gi, type: 'site_element', subType: 'wheel_stop' },
    // Site furniture
    { regex: /\b(bench\s*seat|park\s*bench|seating|seat)\b/gi, type: 'site_element', subType: 'bench' },
    { regex: /\b(bin|rubbish\s*bin|waste\s*bin|recycling\s*bin)\b/gi, type: 'site_element', subType: 'bin' },
    { regex: /\b(drinking\s*fountain|water\s*fountain|bubbler)\b/gi, type: 'site_element', subType: 'fountain' },
    { regex: /\b(shade\s*structure|pergola|shelter|gazebo)\b/gi, type: 'site_element', subType: 'shade' },
    // Signage
    { regex: /\b(signage|sign|wayfinding|directional\s*sign)\b/gi, type: 'site_element', subType: 'signage' },
    { regex: /\b(entry\s*sign|building\s*sign)\b/gi, type: 'site_element', subType: 'signage' },
    // Landscaping elements
    { regex: /\b(planter|planter\s*box|raised\s*garden)\b/gi, type: 'site_element', subType: 'planter' },
    { regex: /\b(retaining\s*wall|garden\s*wall)\b/gi, type: 'site_element', subType: 'retaining_wall' },
    { regex: /\b(fence|fencing|paling\s*fence|colorbond\s*fence)\b/gi, type: 'site_element', subType: 'fence' },
    { regex: /\b(letterbox|mail\s*box)\b/gi, type: 'site_element', subType: 'letterbox' },
    // Parking and driveways
    { regex: /\b(car\s*space|parking\s*space|car\s*park)\b/gi, type: 'site_element', subType: 'car_space' },
    { regex: /\b(driveway|crossover)\b/gi, type: 'site_element', subType: 'driveway' },
    { regex: /\b(footpath|pathway|paved\s*path)\b/gi, type: 'site_element', subType: 'footpath' },
    // External services
    { regex: /\b(meter\s*box|electric\s*meter)\b/gi, type: 'site_element', subType: 'meter_box' },
    { regex: /\b(NBN\s*pit|telstra\s*pit)\b/gi, type: 'site_element', subType: 'comms_pit' },
    { regex: /\b(stormwater\s*pit|gully\s*pit|drain)\b/gi, type: 'site_element', subType: 'drainage' },
    // Outdoor lighting
    { regex: /\b(bollard\s*light|garden\s*light|path\s*light)\b/gi, type: 'site_element', subType: 'outdoor_light' },
    { regex: /\b(flood\s*light|security\s*light)\b/gi, type: 'site_element', subType: 'security_light' },
  ],
};

function detectSymbols(texts: ExtractedText[], pageIndex: number): DetectedSymbol[] {
  const symbols: DetectedSymbol[] = [];
  const seen = new Set<string>();

  for (const text of texts) {
    const content = text.text.trim();

    for (const [category, patterns] of Object.entries(SYMBOL_PATTERNS)) {
      for (const { regex, type, subType } of patterns) {
        regex.lastIndex = 0; // Reset regex state
        let match;
        while ((match = regex.exec(content)) !== null) {
          const key = `${type}-${match[0]}-${text.x.toFixed(0)}-${text.y.toFixed(0)}`;
          if (!seen.has(key)) {
            seen.add(key);
            symbols.push({
              type,
              subType,
              bounds: { x: text.x, y: text.y, width: text.width, height: text.height },
              label: match[0],
              scheduleRef: match[1] || undefined,
              confidence: 0.85,
              pageIndex,
            });
          }
        }
      }
    }
  }

  return symbols;
}

// === SCHEDULE PARSING (Enhanced for Australian architectural plans) ===

// Extended schedule item with more details
export interface ExtendedScheduleItem extends ScheduleItem {
  width?: number;
  height?: number;
  headHeight?: number;
  glazing?: string;
  frame?: string;
  notes?: string;
  figure?: string;
}

// Australian Standards reference
export interface StandardsReference {
  code: string;
  description?: string;
  pageIndex: number;
}

// Material selection from schedules
export interface MaterialSelection {
  category: string;
  selection: string;
  colour?: string;
  manufacturer?: string;
  pageIndex: number;
}

// Floor area from plans
export interface FloorArea {
  name: string;
  area: number;
  unit: 'm²' | 'sqm' | 'ft²';
  pageIndex: number;
}

// Parse window schedule - handles various Australian formats
function parseWindowSchedule(texts: ExtractedText[], pageIndex: number): ExtendedScheduleItem[] {
  const items: ExtendedScheduleItem[] = [];
  const allText = texts.map(t => t.text).join('\n');
  const allTextLower = allText.toLowerCase();

  // Check if this page contains a window schedule
  if (!allTextLower.includes('window schedule') && !allTextLower.includes('window sch')) {
    // Still try to find window references even without explicit schedule
    const windowRefRegex = /\bW(\d{1,2})\b/g;
    let match;
    const seen = new Set<string>();
    while ((match = windowRefRegex.exec(allText)) !== null) {
      const ref = `W${match[1]}`;
      if (!seen.has(ref)) {
        seen.add(ref);
        // Basic detection without full schedule details
      }
    }
    return items;
  }

  // Pattern 1: Table format with TYPE, SIZE, HEAD HT, QTY columns
  // Example: W01    820 x 1210    2100    1    FIG 1    6.38 LAMINATED    ALUMINIUM POWDERCOATED
  const tablePattern1 = /W(\d{1,2})\s+(\d+)\s*[xX×]\s*(\d+)\s+(\d+)?\s+(\d+)?\s*(FIG\s*\d+)?[^\n]*(LAMINATED|TOUGHENED|CLEAR|OBSCURE)?[^\n]*(ALUMINIUM|TIMBER|UPVC)?/gi;
  let match;
  while ((match = tablePattern1.exec(allText)) !== null) {
    items.push({
      type: 'window',
      reference: `W${match[1]}`,
      description: `Window ${match[1]}`,
      size: `${match[2]}x${match[3]}`,
      width: parseInt(match[2]),
      height: parseInt(match[3]),
      headHeight: match[4] ? parseInt(match[4]) : undefined,
      quantity: match[5] ? parseInt(match[5]) : 1,
      figure: match[6]?.trim(),
      glazing: match[7]?.trim(),
      frame: match[8]?.trim(),
      pageIndex,
    });
  }

  // Pattern 2: Simpler format W01 820x1210
  const simplePattern = /W(\d{1,2})\s+(\d+)\s*[xX×]\s*(\d+)/gi;
  const seenRefs = new Set(items.map(i => i.reference));
  while ((match = simplePattern.exec(allText)) !== null) {
    const ref = `W${match[1]}`;
    if (!seenRefs.has(ref)) {
      seenRefs.add(ref);
      items.push({
        type: 'window',
        reference: ref,
        description: `Window ${match[1]}`,
        size: `${match[2]}x${match[3]}`,
        width: parseInt(match[2]),
        height: parseInt(match[3]),
        quantity: 1,
        pageIndex,
      });
    }
  }

  // Pattern 3: Descriptive format "AWNING WINDOW 820 x 1210"
  const descriptivePattern = /(SLIDING|AWNING|FIXED|CASEMENT|DOUBLE\s*HUNG|LOUVRE)\s+WINDOW\s+(\d+)\s*[xX×]\s*(\d+)/gi;
  while ((match = descriptivePattern.exec(allText)) !== null) {
    items.push({
      type: 'window',
      reference: `W-${items.length + 1}`,
      description: `${match[1]} Window`,
      size: `${match[2]}x${match[3]}`,
      width: parseInt(match[2]),
      height: parseInt(match[3]),
      quantity: 1,
      pageIndex,
    });
  }

  return items;
}

// Parse door schedule - handles various Australian formats
function parseDoorSchedule(texts: ExtractedText[], pageIndex: number): ExtendedScheduleItem[] {
  const items: ExtendedScheduleItem[] = [];
  const allText = texts.map(t => t.text).join('\n');
  const allTextLower = allText.toLowerCase();

  // Check if this page contains a door schedule
  if (!allTextLower.includes('door schedule') && !allTextLower.includes('door sch')) {
    return items;
  }

  // Pattern 1: Full door schedule format
  // Example: D01    2040 x 820    HINGED SOLID CORE    LEVER SET    PAINT FINISH
  const tablePattern = /D(\d{1,2})\s+(\d+)\s*[xX×]\s*(\d+)[^\n]*(HINGED|SLIDING|BIFOLD|PIVOT|CAVITY|ROLLER|SECTIONAL)?[^\n]*(SOLID\s*CORE|HOLLOW\s*CORE|FLUSH|GLAZED|PANEL|ROBES?)?[^\n]*(LEVER|KNOB|PULL|PANIC)?/gi;
  let match;
  while ((match = tablePattern.exec(allText)) !== null) {
    const doorType = match[4] || '';
    const doorStyle = match[5] || '';
    const hardware = match[6] || '';

    items.push({
      type: 'door',
      reference: `D${match[1]}`,
      description: `${doorType} ${doorStyle}`.trim() || `Door ${match[1]}`,
      size: `${match[2]}x${match[3]}`,
      width: parseInt(match[3]),  // Width is second dimension for doors
      height: parseInt(match[2]), // Height is first dimension for doors
      hardware: hardware || undefined,
      quantity: 1,
      pageIndex,
    });
  }

  // Pattern 2: Garage door format
  const garageDoorPattern = /(GARAGE\s*DOOR|SECTIONAL\s*DOOR|ROLLER\s*DOOR)\s+(\d+)\s*[xX×]\s*(\d+)/gi;
  while ((match = garageDoorPattern.exec(allText)) !== null) {
    items.push({
      type: 'door',
      reference: `GD-${items.length + 1}`,
      description: match[1].replace(/\s+/g, ' ').trim(),
      size: `${match[2]}x${match[3]}`,
      width: parseInt(match[2]),
      height: parseInt(match[3]),
      quantity: 1,
      pageIndex,
    });
  }

  // Pattern 3: Simple door refs D01, D02 with dimensions
  const simpleDoorPattern = /D(\d{1,2})\s+(\d+)\s*[xX×]\s*(\d+)/gi;
  const seenRefs = new Set(items.map(i => i.reference));
  while ((match = simpleDoorPattern.exec(allText)) !== null) {
    const ref = `D${match[1]}`;
    if (!seenRefs.has(ref)) {
      seenRefs.add(ref);
      items.push({
        type: 'door',
        reference: ref,
        description: `Door ${match[1]}`,
        size: `${match[2]}x${match[3]}`,
        width: parseInt(match[3]),
        height: parseInt(match[2]),
        quantity: 1,
        pageIndex,
      });
    }
  }

  return items;
}

// Parse material selections table
function parseMaterialSelections(texts: ExtractedText[], pageIndex: number): MaterialSelection[] {
  const materials: MaterialSelection[] = [];
  const allText = texts.map(t => t.text).join('\n');
  const allTextLower = allText.toLowerCase();

  // Check for material selection section
  if (!allTextLower.includes('material') && !allTextLower.includes('selection') &&
      !allTextLower.includes('finish') && !allTextLower.includes('colour')) {
    return materials;
  }

  // Common material categories in Australian residential construction
  const materialPatterns = [
    { category: 'BRICKWORK', regex: /(?:brick(?:work)?|face\s*brick)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'CLADDING', regex: /(?:cladding|weatherboard|hebel|aac)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'ROOF', regex: /(?:roof(?:ing)?|roof\s*(?:tiles?|sheets?))\s*[:=]?\s*([^\n]+)/gi },
    { category: 'GUTTERS', regex: /(?:gutters?|downpipes?|fascia)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'WINDOWS', regex: /(?:window\s*frames?|glazing)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'EXTERNAL PAINT', regex: /(?:ext(?:ernal)?\s*paint|ext(?:ernal)?\s*colour)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'INTERNAL PAINT', regex: /(?:int(?:ernal)?\s*paint|int(?:ernal)?\s*colour|wall\s*paint)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'FLOOR TILES', regex: /(?:floor\s*tiles?|tiling)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'WALL TILES', regex: /(?:wall\s*tiles?|splashback)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'CARPET', regex: /(?:carpet|floor\s*covering)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'BENCHTOP', regex: /(?:bench\s*top|benchtop|kitchen\s*bench)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'GARAGE DOOR', regex: /(?:garage\s*door)\s*[:=]?\s*([^\n]+)/gi },
  ];

  for (const { category, regex } of materialPatterns) {
    let match;
    while ((match = regex.exec(allText)) !== null) {
      const selection = match[1].trim();
      if (selection.length > 2 && selection.length < 100) {
        // Extract colour if present
        const colourMatch = selection.match(/(?:colour|color)\s*[:=]?\s*([^\s,]+)/i);
        materials.push({
          category,
          selection: selection.replace(/(?:colour|color)\s*[:=]?\s*[^\s,]+/i, '').trim(),
          colour: colourMatch?.[1],
          pageIndex,
        });
      }
    }
  }

  // Look for Colorbond selections (common in Australia)
  const colorbondPattern = /colorbond\s*[:=]?\s*([^\n,]+)/gi;
  let match;
  while ((match = colorbondPattern.exec(allText)) !== null) {
    materials.push({
      category: 'COLORBOND',
      selection: match[1].trim(),
      manufacturer: 'BlueScope',
      pageIndex,
    });
  }

  return materials;
}

// Extract Australian Standards references
function extractStandardsReferences(texts: ExtractedText[], pageIndex: number): StandardsReference[] {
  const standards: StandardsReference[] = [];
  const allText = texts.map(t => t.text).join(' ');
  const seen = new Set<string>();

  // Pattern for Australian Standards: AS/NZS 1234, AS:1234, AS 1234.1
  const asPattern = /AS(?:\/NZS)?\s*:?\s*(\d{3,5}(?:\.\d+)?(?:\.\d+)?)/gi;
  let match;
  while ((match = asPattern.exec(allText)) !== null) {
    const code = `AS ${match[1]}`;
    if (!seen.has(code)) {
      seen.add(code);
      standards.push({ code, pageIndex });
    }
  }

  // Common Australian construction standards with descriptions
  const knownStandards: Record<string, string> = {
    'AS 3700': 'Masonry Structures',
    'AS 3660': 'Termite Management',
    'AS 1288': 'Glass in Buildings',
    'AS 3600': 'Concrete Structures',
    'AS 2870': 'Residential Slabs and Footings',
    'AS 4773': 'Masonry in Small Buildings',
    'AS 1684': 'Residential Timber-framed Construction',
    'AS 1720': 'Timber Structures',
    'AS 4055': 'Wind Loads for Housing',
    'AS 3959': 'Bushfire Attack Levels',
    'AS 4100': 'Steel Structures',
    'AS 3000': 'Electrical Installations (Wiring Rules)',
    'AS 3500': 'Plumbing and Drainage',
    'AS 4254': 'Ductwork',
    'AS 1562': 'Metal Roofing',
    'AS 2047': 'Windows and External Glazed Doors',
    'AS 1926': 'Pool Fencing',
    'AS 1428': 'Accessibility',
    'AS 4586': 'Slip Resistance',
  };

  // Add descriptions to found standards
  for (const std of standards) {
    for (const [code, description] of Object.entries(knownStandards)) {
      if (std.code.includes(code.split(' ')[1])) {
        std.description = description;
        break;
      }
    }
  }

  // Also look for NCC references
  const nccPattern = /NCC\s*(Volume\s*\d|20\d{2}|BCA)/gi;
  while ((match = nccPattern.exec(allText)) !== null) {
    const code = `NCC ${match[1]}`;
    if (!seen.has(code)) {
      seen.add(code);
      standards.push({ code, description: 'National Construction Code', pageIndex });
    }
  }

  return standards;
}

// Extract floor areas from plans
function extractFloorAreas(texts: ExtractedText[], pageIndex: number): FloorArea[] {
  const areas: FloorArea[] = [];
  const allText = texts.map(t => t.text).join('\n');

  // Pattern for area annotations: "Living 45.6m²" or "LIVING: 45.6 m2"
  const areaPattern = /([A-Za-z][A-Za-z\s\/]+?)[\s:=]+(\d+(?:\.\d+)?)\s*(?:m²|m2|sqm|SQM)/gi;
  let match;
  while ((match = areaPattern.exec(allText)) !== null) {
    const name = match[1].trim().toUpperCase();
    const area = parseFloat(match[2]);

    // Filter out non-room names
    if (area > 0 && name.length > 1 && name.length < 50 &&
        !name.includes('SCALE') && !name.includes('DRAWING')) {
      areas.push({
        name,
        area,
        unit: 'm²',
        pageIndex,
      });
    }
  }

  // Pattern for total floor area
  const totalPattern = /(?:total|gross|nett?)\s*(?:floor\s*)?area\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:m²|m2|sqm)/gi;
  while ((match = totalPattern.exec(allText)) !== null) {
    areas.push({
      name: 'TOTAL FLOOR AREA',
      area: parseFloat(match[1]),
      unit: 'm²',
      pageIndex,
    });
  }

  return areas;
}

// Extract scale from title block or annotations
function extractPageScale(texts: ExtractedText[]): string | undefined {
  const allText = texts.map(t => t.text).join(' ');

  // Pattern for scale: "SCALE 1:100" or "1:200 @ A3"
  const scalePatterns = [
    /SCALE\s*[:=]?\s*(1\s*:\s*\d+)/gi,
    /\b(1\s*:\s*(?:10|20|25|50|100|200|250|500|1000))\b/gi,
    /@\s*A[0-4]\s*[:=]?\s*(1\s*:\s*\d+)/gi,
  ];

  for (const pattern of scalePatterns) {
    const match = pattern.exec(allText);
    if (match) {
      return match[1].replace(/\s/g, '');
    }
  }

  return undefined;
}

// Count electrical symbols on a page
function countElectricalSymbols(texts: ExtractedText[], pageIndex: number): Record<string, number> {
  const counts: Record<string, number> = {};
  const allText = texts.map(t => t.text).join(' ').toUpperCase();

  // Electrical symbol patterns
  const symbolPatterns: [string, RegExp][] = [
    ['GPO', /\bGPO\b/g],
    ['DGPO', /\bDGPO\b/g],
    ['SW', /\bSW\b(?!\d)/g],
    ['DIMMER', /\bDIM\b/g],
    ['LED', /\bLED\b/g],
    ['DOWNLIGHT', /\bDL\b|\bDOWNLIGHT/g],
    ['SMOKE DETECTOR', /\bSD\b|\bSMOKE/g],
    ['EXHAUST FAN', /\bEF\b|\bEXHAUST/g],
    ['DATA POINT', /\bDP\b|\bDATA/g],
    ['TV POINT', /\bTV\b/g],
    ['CEILING FAN', /\bCF\b|\bCEILING\s*FAN/g],
    ['AIR CON', /\bAC\b|\bAIR\s*CON/g],
    ['PENDANT', /\bPENDANT/g],
    ['SENSOR', /\bSENSOR/g],
    ['RANGE HOOD', /\bRH\b|\bRANGE\s*HOOD/g],
  ];

  for (const [name, pattern] of symbolPatterns) {
    const matches = allText.match(pattern);
    if (matches) {
      counts[name] = matches.length;
    }
  }

  return counts;
}

// Main schedule parsing function - now uses all enhanced parsers
function parseSchedules(texts: ExtractedText[], pageIndex: number): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const allText = texts.map(t => t.text).join('\n');

  // Parse window schedule with enhanced function
  const windowItems = parseWindowSchedule(texts, pageIndex);
  items.push(...windowItems);

  // Parse door schedule with enhanced function
  const doorItems = parseDoorSchedule(texts, pageIndex);
  items.push(...doorItems);

  // Finish schedule parsing (existing)
  const finishRegex = /(floor|wall|ceiling|skirting)\s*(?:finish)?[\s:]+([^\n]+)/gi;
  let match;
  while ((match = finishRegex.exec(allText)) !== null) {
    items.push({
      type: 'finish',
      reference: match[1].toUpperCase(),
      description: match[2].trim(),
      quantity: 1,
      pageIndex,
    });
  }

  // Parse appliance schedule
  const appliancePatterns = [
    /\b(dishwasher|DW)\b/gi,
    /\b(washing\s*machine|WM)\b/gi,
    /\b(dryer)\b/gi,
    /\b(cooktop|rangehood|oven)\b/gi,
    /\b(fridge|refrigerator)\b/gi,
    /\b(microwave|MW)\b/gi,
  ];

  for (const pattern of appliancePatterns) {
    if (pattern.test(allText)) {
      pattern.lastIndex = 0;
      while ((match = pattern.exec(allText)) !== null) {
        items.push({
          type: 'appliance',
          reference: match[1].toUpperCase().replace(/\s+/g, '_'),
          description: match[1],
          quantity: 1,
          pageIndex,
        });
      }
    }
  }

  return items;
}

// === BUILDING ELEMENT DETECTION ===

function detectBuildingElements(
  texts: ExtractedText[],
  constructionType: ConstructionType,
  pageIndex: number
): DetectedElement[] {
  const elements: DetectedElement[] = [];
  const allText = texts.map(t => t.text.toLowerCase()).join(' ');

  // Wall detection
  const wallPatterns = [
    /(\d+(?:\.\d+)?)\s*(?:mm|m)?\s*(?:high|height)?\s*(?:internal|external|cavity|stud)?\s*wall/gi,
    /wall\s*(?:type|system)?[\s:]+([^\n,]+)/gi,
    /(\d+)\s*mm\s*(?:plasterboard|gyprock|villaboard)/gi,
  ];

  for (const pattern of wallPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(allText)) {
      elements.push({
        type: 'wall',
        constructionType,
        material: constructionType === 'timber_frame' ? 'Timber stud' :
                  constructionType === 'brick_veneer' ? 'Brick veneer' :
                  constructionType === 'steel_frame' ? 'Steel stud' : undefined,
        confidence: 0.7,
        pageIndex,
      });
    }
  }

  // Floor detection
  if (/concrete\s*slab|floor\s*slab|raft\s*slab|waffle\s*slab|strip\s*footing/i.test(allText)) {
    elements.push({
      type: 'floor',
      constructionType: 'concrete',
      material: 'Concrete slab',
      confidence: 0.8,
      pageIndex,
    });
  }

  if (/timber\s*floor|suspended\s*floor|bearer|joist/i.test(allText)) {
    elements.push({
      type: 'floor',
      constructionType: 'timber_frame',
      material: 'Timber floor framing',
      confidence: 0.75,
      pageIndex,
    });
  }

  // Ceiling detection
  if (/plasterboard\s*ceiling|gyprock\s*ceiling|bulkhead|cornice/i.test(allText)) {
    elements.push({
      type: 'ceiling',
      constructionType,
      material: 'Plasterboard',
      confidence: 0.7,
      pageIndex,
    });
  }

  // Roof detection
  if (/roof\s*(?:tile|sheet|metal|colorbond)|roofing|fascia|gutter/i.test(allText)) {
    elements.push({
      type: 'roof',
      constructionType: constructionType === 'steel_frame' ? 'steel_frame' : 'timber_frame',
      confidence: 0.75,
      pageIndex,
    });
  }

  return elements;
}

// === ESTIMATION GENERATION ===

// Rate type with trade and category for estimation
export interface RateInfo {
  materialRate: number;
  labourRate: number;
  labourHours: number;
  unit: string;
  trade: string;
  category: string;
}

export const AUSTRALIAN_RATES: Record<string, RateInfo> = {
  // Framing
  'Timber wall framing': { materialRate: 45, labourRate: 75, labourHours: 0.5, unit: 'M2', trade: 'Carpentry', category: 'Framing' },
  'Steel wall framing': { materialRate: 55, labourRate: 85, labourHours: 0.6, unit: 'M2', trade: 'Structural Steel', category: 'Framing' },
  'Timber floor framing': { materialRate: 65, labourRate: 75, labourHours: 0.4, unit: 'M2', trade: 'Carpentry', category: 'Framing' },
  'Timber roof framing': { materialRate: 75, labourRate: 75, labourHours: 0.6, unit: 'M2', trade: 'Carpentry', category: 'Framing' },

  // Linings
  'Plasterboard walls': { materialRate: 22, labourRate: 65, labourHours: 0.35, unit: 'M2', trade: 'Plasterboard', category: 'Linings' },
  'Plasterboard ceiling': { materialRate: 25, labourRate: 65, labourHours: 0.4, unit: 'M2', trade: 'Plasterboard', category: 'Linings' },
  'Villaboard wet area': { materialRate: 35, labourRate: 70, labourHours: 0.45, unit: 'M2', trade: 'Plasterboard', category: 'Linings' },

  // External
  'Brick veneer': { materialRate: 95, labourRate: 85, labourHours: 1.2, unit: 'M2', trade: 'Brickwork', category: 'External Cladding' },
  'Render': { materialRate: 45, labourRate: 70, labourHours: 0.8, unit: 'M2', trade: 'Rendering', category: 'External Cladding' },
  'Weatherboard cladding': { materialRate: 55, labourRate: 75, labourHours: 0.6, unit: 'M2', trade: 'Carpentry', category: 'External Cladding' },
  'Metal cladding': { materialRate: 85, labourRate: 80, labourHours: 0.5, unit: 'M2', trade: 'Roofing', category: 'External Cladding' },

  // Concrete
  'Concrete slab': { materialRate: 180, labourRate: 90, labourHours: 0.15, unit: 'M2', trade: 'Concrete', category: 'Structure' },
  'Concrete footing': { materialRate: 250, labourRate: 90, labourHours: 0.2, unit: 'LM', trade: 'Concrete', category: 'Structure' },

  // Roofing
  'Metal roofing': { materialRate: 65, labourRate: 80, labourHours: 0.3, unit: 'M2', trade: 'Roofing', category: 'Roof' },
  'Tile roofing': { materialRate: 85, labourRate: 85, labourHours: 0.5, unit: 'M2', trade: 'Roofing', category: 'Roof' },
  'Fascia & gutter': { materialRate: 35, labourRate: 75, labourHours: 0.25, unit: 'LM', trade: 'Roofing', category: 'Roof' },

  // Waterproofing
  'Wet area waterproofing': { materialRate: 45, labourRate: 70, labourHours: 0.4, unit: 'M2', trade: 'Waterproofing', category: 'Wet Areas' },

  // Doors & Windows (average)
  'Internal door': { materialRate: 350, labourRate: 75, labourHours: 1.5, unit: 'each', trade: 'Windows & Doors', category: 'Doors' },
  'External door': { materialRate: 650, labourRate: 75, labourHours: 2, unit: 'each', trade: 'Windows & Doors', category: 'Doors' },
  'Sliding door': { materialRate: 1200, labourRate: 80, labourHours: 3, unit: 'each', trade: 'Windows & Doors', category: 'Doors' },
  'Window (standard)': { materialRate: 450, labourRate: 75, labourHours: 1.5, unit: 'each', trade: 'Windows & Doors', category: 'Windows' },
  'Window (large)': { materialRate: 850, labourRate: 80, labourHours: 2.5, unit: 'each', trade: 'Windows & Doors', category: 'Windows' },

  // Electrical
  'Power point': { materialRate: 25, labourRate: 95, labourHours: 0.5, unit: 'each', trade: 'Electrical', category: 'Power' },
  'Light point': { materialRate: 45, labourRate: 95, labourHours: 0.75, unit: 'each', trade: 'Electrical', category: 'Lighting' },
  'Switch': { materialRate: 15, labourRate: 95, labourHours: 0.3, unit: 'each', trade: 'Electrical', category: 'Switching' },

  // Plumbing
  'Basin': { materialRate: 280, labourRate: 100, labourHours: 2, unit: 'each', trade: 'Plumbing', category: 'Fixtures' },
  'Toilet': { materialRate: 450, labourRate: 100, labourHours: 2.5, unit: 'each', trade: 'Plumbing', category: 'Fixtures' },
  'Shower': { materialRate: 650, labourRate: 100, labourHours: 4, unit: 'each', trade: 'Plumbing', category: 'Fixtures' },
  'Bath': { materialRate: 800, labourRate: 100, labourHours: 3, unit: 'each', trade: 'Plumbing', category: 'Fixtures' },

  // Tiling
  'Floor tiles': { materialRate: 65, labourRate: 75, labourHours: 0.8, unit: 'M2', trade: 'Tiling', category: 'Floor Finishes' },
  'Wall tiles': { materialRate: 55, labourRate: 75, labourHours: 1, unit: 'M2', trade: 'Tiling', category: 'Wall Finishes' },

  // Painting
  'Paint walls': { materialRate: 8, labourRate: 55, labourHours: 0.15, unit: 'M2', trade: 'Painting', category: 'Finishes' },
  'Paint ceiling': { materialRate: 8, labourRate: 55, labourHours: 0.2, unit: 'M2', trade: 'Painting', category: 'Finishes' },
  'Paint trim': { materialRate: 5, labourRate: 55, labourHours: 0.1, unit: 'LM', trade: 'Painting', category: 'Finishes' },

  // Insulation
  'Ceiling insulation': { materialRate: 15, labourRate: 50, labourHours: 0.1, unit: 'M2', trade: 'Insulation', category: 'Thermal' },
  'Wall insulation': { materialRate: 12, labourRate: 50, labourHours: 0.15, unit: 'M2', trade: 'Insulation', category: 'Thermal' },
};

// Helper to get SOW category label for trade mapping
function mapTradeToSOWCategory(trade: Trade): SOWCategory {
  const mapping: Partial<Record<Trade, SOWCategory>> = {
    'Concreter': 'STRUCTURE',
    'Carpenter': 'FRAMING_TRUSS',
    'Bricklayer': 'EXTERNAL',
    'Roofer': 'ROOFING',
    'Glazier': 'WINDOWS_DOORS',
    'Plasterer': 'INTERNAL_LININGS',
    'Painter': 'PAINTING',
    'Tiler': 'FLOOR_COVERINGS',
    'Electrician': 'ELECTRICAL',
    'Plumber': 'PLUMBING',
    'HVAC': 'HVAC',
  };
  return mapping[trade] || 'INTERNAL_FIT_OUT';
}

function generateEstimation(
  pages: PageAnalysis[],
  schedules: PlanAnalysisResult['schedules'],
  floorAreas: FloorArea[] = [],
  electricalSummary: Record<string, number> = {}
): EstimatedLineItem[] {
  const items: EstimatedLineItem[] = [];
  let itemId = 1;

  // === EXTRACT KEY QUANTITIES FROM PDF ===

  // Get total floor area (most important quantity for estimation)
  let totalFloorArea = 0;
  let floorAreaSource: 'detected' | 'inferred' = 'inferred';

  console.log(`[AIAnalyzer] Floor areas extracted: ${floorAreas.length} items`);
  if (floorAreas.length > 0) {
    console.log(`[AIAnalyzer] Floor areas:`, floorAreas.map(a => `${a.name}: ${a.area}m²`).join(', '));
  }

  // First, look for explicit TOTAL area
  const totalArea = floorAreas.find(a =>
    /TOTAL|GROSS|FLOOR\s*AREA/i.test(a.name) && a.area > 50
  );

  if (totalArea && totalArea.area > 50 && totalArea.area < 1000) {
    totalFloorArea = totalArea.area;
    floorAreaSource = 'detected';
    console.log(`[AIAnalyzer] Using TOTAL area: ${totalFloorArea}m²`);
  } else {
    // Look for living area (usually the main floor area)
    const livingArea = floorAreas.find(a =>
      /GF\s*LIVING|LIVING|GROUND\s*FLOOR/i.test(a.name) && a.area > 50
    );

    if (livingArea && livingArea.area > 50) {
      // Add typical garage (~25m²) and alfresco (~15m²) if living area found
      totalFloorArea = livingArea.area + 40; // Living + garage/outdoor
      floorAreaSource = 'detected';
    } else if (floorAreas.length > 0) {
      // Sum up individual areas, but cap at 500m²
      const summed = floorAreas
        .filter(a => a.area > 1 && a.area < 500) // Filter out bogus values
        .reduce((sum, a) => sum + a.area, 0);

      if (summed > 80 && summed < 500) {
        totalFloorArea = summed;
        floorAreaSource = 'detected';
      }
    }
  }

  // If still no floor area, use a reasonable default
  if (totalFloorArea < 80 || totalFloorArea > 800) {
    totalFloorArea = 175; // Default ~175m² typical Australian 4-bed house
    floorAreaSource = 'inferred';
  }

  // Round to reasonable precision
  totalFloorArea = Math.round(totalFloorArea);

  // Count symbols across all pages
  const symbolCounts: Record<string, number> = {};
  const elementCounts: Record<string, number> = {};

  for (const page of pages) {
    for (const symbol of page.symbols) {
      symbolCounts[symbol.type] = (symbolCounts[symbol.type] || 0) + 1;
    }
    for (const element of page.elements) {
      const key = `${element.type}-${element.constructionType}`;
      elementCounts[key] = (elementCounts[key] || 0) + 1;
    }
  }

  // Calculate realistic electrical counts based on floor area
  // Typical residential: ~1 GPO per 6m², ~1 light per 8m², ~1 switch per 12m²
  const maxPowerPoints = Math.ceil(totalFloorArea / 6) + 10; // Max realistic GPOs
  const maxLights = Math.ceil(totalFloorArea / 8) + 5; // Max realistic lights
  const maxSwitches = Math.ceil(totalFloorArea / 12) + 5; // Max realistic switches

  // Use detected counts but cap to realistic maximums
  const rawPowerPoints = electricalSummary['GPO'] || electricalSummary['powerPoints'] || symbolCounts['power_point'] || 0;
  const rawLights = electricalSummary['lights'] || symbolCounts['light'] || 0;
  const rawSwitches = electricalSummary['switches'] || symbolCounts['switch'] || 0;

  // Cap to realistic numbers - if detected count is > 2x max, it's likely counting legend text
  const powerPoints = rawPowerPoints > maxPowerPoints * 2 ? maxPowerPoints : Math.max(rawPowerPoints, Math.ceil(totalFloorArea / 8));
  const lights = rawLights > maxLights * 2 ? maxLights : Math.max(rawLights, Math.ceil(totalFloorArea / 10));
  const switches = rawSwitches > maxSwitches * 2 ? maxSwitches : Math.max(rawSwitches, Math.ceil(totalFloorArea / 15));

  const smokeDetectors = Math.min(electricalSummary['smokeDetectors'] || symbolCounts['smoke_detector'] || 0, 10) || Math.ceil(totalFloorArea / 50) + 1;
  const exhaustFans = Math.min(electricalSummary['exhaustFans'] || symbolCounts['exhaust_fan'] || 0, 6) || 3;

  // Count wet rooms for plumbing/tiling
  const wetRoomCount = Math.max(
    pages.flatMap(p => p.rooms)
      .filter(r => /bathroom|ensuite|laundry|toilet|wc|powder/i.test(r.name)).length,
    2 // minimum 2 wet rooms
  );

  // Determine construction type
  const constructionType = pages.reduce((acc, p) => {
    if (p.constructionType !== 'unknown') return p.constructionType;
    return acc;
  }, 'timber_frame' as ConstructionType);

  // Calculate derived quantities
  const wallPerimeter = Math.sqrt(totalFloorArea) * 4 * 1.3; // Approx wall perimeter
  const externalWallArea = wallPerimeter * 2.7; // 2.7m wall height
  const internalWallArea = totalFloorArea * 2.5; // Internal walls ~2.5x floor area
  const roofArea = totalFloorArea * 1.15; // Roof ~15% more than floor area
  const wetAreaFloor = wetRoomCount * 8; // ~8m² per wet room
  const wetAreaWall = wetRoomCount * 25; // ~25m² walls per wet room

  // Helper to add line item with proper SOW categorization
  const addItem = (
    rateCode: string,
    quantity: number,
    source: 'detected' | 'schedule' | 'inferred',
    confidence: number,
    customDescription?: string,
    quantityNote?: string
  ) => {
    if (quantity <= 0) return;

    const rate = AUSTRALIAN_CONSTRUCTION_RATES.find(r => r.code === rateCode);
    if (!rate) {
      console.warn(`Rate code ${rateCode} not found`);
      return;
    }

    const materialCost = rate.materialRate * quantity;
    const labourCost = rate.labourRate * rate.labourHours * quantity;
    const totalCost = materialCost + labourCost;

    // Map SOW category to trade names matching TRADE_OPTIONS in UI
    const tradeMap: Partial<Record<SOWCategory, string>> = {
      'PRELIMINARIES': 'Preliminaries',
      'SITE_WORKS': 'Site Works',
      'STRUCTURE': 'Concrete',
      'FRAMING_TRUSS': 'Carpentry',
      'EXTERNAL': 'Brickwork',
      'ROOFING': 'Roofing',
      'WINDOWS_DOORS': 'Windows & Doors',
      'INTERNAL_LININGS': 'Plasterboard',
      'INTERNAL_FIT_OUT': 'Joinery',
      'ELECTRICAL': 'Electrical',
      'PLUMBING': 'Plumbing',
      'HVAC': 'HVAC',
      'PAINTING': 'Painting',
      'FLOOR_COVERINGS': 'Floor Coverings',
      'EXTERNAL_WORKS': 'External Works',
      'CERTIFICATIONS': 'Certifications',
    };

    const trade = tradeMap[rate.category] || 'Other';

    items.push({
      id: `EST-${itemId++}`,
      trade,
      category: SOW_CATEGORY_LABELS[rate.category],
      description: customDescription || rate.description,
      quantity: Math.round(quantity * 100) / 100,
      unit: rate.unit as EstimatedLineItem['unit'],
      unitRate: rate.totalRate,
      labourHours: rate.labourHours * quantity,
      materialCost: Math.round(materialCost),
      labourCost: Math.round(labourCost),
      totalCost: Math.round(totalCost),
      source,
      confidence,
      calculationBreakdown: {
        quantitySource: quantityNote || (source === 'detected' ? 'Extracted from PDF' :
                        source === 'schedule' ? 'From schedule' : 'Calculated from floor area'),
        assumptions: source === 'inferred' ? ['Based on typical residential construction'] : [],
        warnings: source === 'inferred' ? ['Verify quantity against actual plans'] : [],
        materialRate: rate.materialRate,
        materialSource: 'Rawlinsons 2024 / Industry rates',
        labourRate: rate.labourRate,
        labourHoursPerUnit: rate.labourHours,
        labourSource: 'Fair Work Award + contractor margin',
      },
    });
  };

  // === GENERATE ESTIMATE BY SOW CATEGORY ===

  // --- PRELIMINARIES ---
  addItem('PRELIM-01', 1, 'inferred', 0.9, 'Site establishment');
  addItem('PRELIM-02', 1, 'inferred', 0.8, 'Site amenities');

  // --- SITE WORKS ---
  addItem('SITE-01', totalFloorArea * 1.5, floorAreaSource, 0.7,
    `Site clearing (${(totalFloorArea * 1.5).toFixed(0)}m²)`,
    `Floor area ${totalFloorArea}m² × 1.5 for site coverage`);

  // --- STRUCTURE ---
  // Slab - use actual floor area
  if (elementCounts['floor-concrete'] > 0 || constructionType !== 'unknown') {
    addItem('STRUCT-01', totalFloorArea, floorAreaSource, 0.85,
      `Waffle pod slab (${totalFloorArea.toFixed(0)}m²)`,
      `Total floor area: ${totalFloorArea}m²`);
  }

  // --- FRAMING & TRUSS ---
  if (constructionType === 'timber_frame' || constructionType === 'brick_veneer' || constructionType === 'unknown') {
    addItem('FRAME-01', internalWallArea, floorAreaSource === 'detected' ? 'detected' : 'inferred', 0.8,
      `Timber wall framing (${internalWallArea.toFixed(0)}m²)`,
      `Internal walls: floor area × 2.5 = ${internalWallArea.toFixed(0)}m²`);
  }

  addItem('FRAME-03', totalFloorArea, floorAreaSource, 0.85,
    `Roof trusses (${totalFloorArea.toFixed(0)}m² coverage)`,
    `Based on floor area`);

  addItem('FRAME-04', totalFloorArea, floorAreaSource, 0.85,
    `Ceiling battens (${totalFloorArea.toFixed(0)}m²)`,
    `Based on floor area`);

  // --- ROOFING ---
  addItem('ROOF-01', roofArea, floorAreaSource === 'detected' ? 'detected' : 'inferred', 0.8,
    `Colorbond roofing (${roofArea.toFixed(0)}m²)`,
    `Roof area: floor area × 1.15 = ${roofArea.toFixed(0)}m²`);

  addItem('ROOF-03', roofArea, 'inferred', 0.85, `Sarking/building wrap (${roofArea.toFixed(0)}m²)`);
  addItem('ROOF-04', wallPerimeter, 'inferred', 0.8, `Fascia and barge (${wallPerimeter.toFixed(0)}lm)`);
  addItem('ROOF-05', wallPerimeter, 'inferred', 0.8, `Gutters (${wallPerimeter.toFixed(0)}lm)`);
  addItem('ROOF-06', 8, 'inferred', 0.8, 'Downpipes (8 typical)');

  // --- EXTERNAL ---
  if (constructionType === 'brick_veneer' || elementCounts['wall-brick_veneer'] > 0) {
    addItem('EXT-01', externalWallArea * 0.7, 'inferred', 0.75,
      `Brick veneer (${(externalWallArea * 0.7).toFixed(0)}m²)`,
      `External walls minus windows/doors`);
  } else {
    addItem('EXT-02', externalWallArea * 0.7, 'inferred', 0.75,
      `Hebel cladding (${(externalWallArea * 0.7).toFixed(0)}m²)`,
      `External walls minus windows/doors`);
  }

  // --- WINDOWS & DOORS ---
  // From schedule if available
  const windowCount = schedules.windows.length > 0
    ? schedules.windows.reduce((sum, w) => sum + w.quantity, 0)
    : Math.ceil(totalFloorArea / 15); // ~1 window per 15m²

  const doorCount = schedules.doors.length > 0
    ? schedules.doors.reduce((sum, d) => sum + d.quantity, 0)
    : Math.ceil(totalFloorArea / 20); // ~1 door per 20m²

  if (schedules.windows.length > 0) {
    for (const win of schedules.windows) {
      const isLarge = win.size && parseInt(win.size.split('x')[0]) > 1500;
      addItem(isLarge ? 'WD-03' : 'WD-01', win.quantity, 'schedule', 0.95,
        `${win.reference}: ${win.description}`,
        'From window schedule');
    }
  } else {
    addItem('WD-01', windowCount, 'inferred', 0.7,
      `Windows - standard (${windowCount} estimated)`,
      `Estimated ~1 per 15m² of floor area`);
  }

  if (schedules.doors.length > 0) {
    let hasEntry = false;
    let hasGarage = false;
    for (const door of schedules.doors) {
      const isExternal = /external|entry|front/i.test(door.description);
      const isGarage = /garage|sectional|roller/i.test(door.description);

      if (isGarage && !hasGarage) {
        addItem('WD-07', 1, 'schedule', 0.95, `${door.reference}: Garage door`, 'From door schedule');
        hasGarage = true;
      } else if (isExternal && !hasEntry) {
        addItem('WD-06', door.quantity, 'schedule', 0.95,
          `${door.reference}: ${door.description}`, 'From door schedule');
        hasEntry = true;
      } else if (!isGarage) {
        addItem('WD-04', door.quantity, 'schedule', 0.95,
          `${door.reference}: Internal door`, 'From door schedule');
      }
    }
  } else {
    addItem('WD-06', 1, 'inferred', 0.8, 'Entry door');
    addItem('WD-04', doorCount - 1, 'inferred', 0.7,
      `Internal doors (${doorCount - 1} estimated)`,
      'Estimated from floor area');
    addItem('WD-07', 1, 'inferred', 0.8, 'Garage door (single)');
  }

  // --- INTERNAL LININGS ---
  addItem('INT-01', internalWallArea, 'inferred', 0.8,
    `Plasterboard walls (${internalWallArea.toFixed(0)}m²)`,
    'Internal wall area');
  addItem('INT-02', totalFloorArea, floorAreaSource, 0.85,
    `Plasterboard ceiling (${totalFloorArea.toFixed(0)}m²)`,
    'Total floor area');
  addItem('INT-03', wetAreaWall, 'inferred', 0.8,
    `Villaboard wet areas (${wetAreaWall.toFixed(0)}m²)`,
    `${wetRoomCount} wet rooms × ~25m² walls`);
  addItem('INT-04', wetAreaFloor + wetAreaWall * 0.5, 'inferred', 0.8,
    `Waterproofing (${(wetAreaFloor + wetAreaWall * 0.5).toFixed(0)}m²)`,
    'Wet area floors and splashbacks');
  addItem('INT-05', totalFloorArea, 'inferred', 0.85,
    `Ceiling insulation R4.0 (${totalFloorArea.toFixed(0)}m²)`);

  // --- INTERNAL FIT-OUT ---
  addItem('FIT-01', 6, 'inferred', 0.8, 'Kitchen cabinetry (6lm typical)');
  addItem('FIT-02', 4, 'inferred', 0.8, 'Stone benchtop (4lm typical)');
  addItem('FIT-03', wetRoomCount, 'inferred', 0.8, `Bathroom vanities (${wetRoomCount})`);
  addItem('FIT-04', 1, 'inferred', 0.85, 'Laundry trough and cabinet');
  addItem('FIT-06', wallPerimeter * 2, 'inferred', 0.8,
    `Skirting (${(wallPerimeter * 2).toFixed(0)}lm)`,
    'Approx internal perimeter');

  // --- ELECTRICAL ---
  // Use the capped realistic values calculated above
  addItem('ELEC-01', powerPoints, rawPowerPoints > 0 ? 'detected' : 'inferred',
    rawPowerPoints > 0 ? 0.85 : 0.7,
    `Power points (${powerPoints})`,
    rawPowerPoints > maxPowerPoints * 2
      ? `Capped from ${rawPowerPoints} (likely counted legend) to realistic ${powerPoints}`
      : `Based on ${totalFloorArea.toFixed(0)}m² floor area (~1 per 6m²)`);

  addItem('ELEC-03', lights, rawLights > 0 ? 'detected' : 'inferred',
    rawLights > 0 ? 0.85 : 0.7,
    `Light points - LED downlights (${lights})`,
    rawLights > maxLights * 2
      ? `Capped from ${rawLights} (likely counted legend) to realistic ${lights}`
      : `Based on ${totalFloorArea.toFixed(0)}m² floor area (~1 per 8m²)`);

  addItem('ELEC-05', switches, rawSwitches > 0 ? 'detected' : 'inferred',
    rawSwitches > 0 ? 0.85 : 0.7,
    `Switches (${switches})`,
    `Based on ${totalFloorArea.toFixed(0)}m² floor area (~1 per 15m²)`);

  addItem('ELEC-06', smokeDetectors, 'inferred', 0.9,
    `Smoke detectors (${smokeDetectors})`,
    'NCC requirement - interconnected');

  addItem('ELEC-07', exhaustFans, 'inferred', 0.85,
    `Exhaust fans (${exhaustFans})`,
    `${wetRoomCount} wet rooms`);

  addItem('ELEC-09', 1, 'inferred', 0.95, 'Switchboard');
  addItem('ELEC-10', 1, 'inferred', 0.95, 'Electrical fit-off and testing');

  // --- PLUMBING ---
  const toilets = symbolCounts['toilet'] || wetRoomCount;
  const basins = symbolCounts['sink'] || wetRoomCount + 1;
  const showers = symbolCounts['shower'] || wetRoomCount;

  addItem('PLUMB-01', toilets + basins + showers + 2, 'inferred', 0.8,
    `Water supply rough-in (${toilets + basins + showers + 2} fixtures)`,
    'All plumbing fixtures');
  addItem('PLUMB-02', toilets + basins + showers + 2, 'inferred', 0.8,
    `Drainage rough-in (${toilets + basins + showers + 2} fixtures)`);

  addItem('PLUMB-03', toilets, symbolCounts['toilet'] > 0 ? 'detected' : 'inferred', 0.85,
    `Toilet suites (${toilets})`);
  addItem('PLUMB-04', showers, symbolCounts['shower'] > 0 ? 'detected' : 'inferred', 0.85,
    `Shower mixer and rose (${showers})`);
  addItem('PLUMB-05', basins, symbolCounts['sink'] > 0 ? 'detected' : 'inferred', 0.85,
    `Basin mixer taps (${basins})`);
  addItem('PLUMB-06', 1, 'inferred', 0.9, 'Kitchen sink');
  addItem('PLUMB-07', 1, 'inferred', 0.9, 'Kitchen mixer tap');
  addItem('PLUMB-08', 1, 'inferred', 0.9, 'Hot water system (gas)');
  addItem('PLUMB-09', 1, 'inferred', 0.85, 'Stormwater drainage');
  addItem('PLUMB-10', 1, 'inferred', 0.85, 'Sewer connection');

  // --- HVAC ---
  const acUnits = symbolCounts['air_conditioning'] || 0;
  if (acUnits > 0) {
    addItem('HVAC-01', acUnits, 'detected', 0.9, `Split system AC (${acUnits} detected)`);
  } else {
    // Allow for either split or ducted
    addItem('HVAC-01', 3, 'inferred', 0.7, 'Split system AC (3 typical)', 'Or ducted alternative');
  }

  // --- PAINTING ---
  addItem('PAINT-01', internalWallArea, 'inferred', 0.85,
    `Internal walls painting (${internalWallArea.toFixed(0)}m²)`);
  addItem('PAINT-02', totalFloorArea, 'inferred', 0.85,
    `Ceiling painting (${totalFloorArea.toFixed(0)}m²)`);
  addItem('PAINT-03', doorCount, 'inferred', 0.85,
    `Door and frame painting (${doorCount})`);
  addItem('PAINT-04', externalWallArea * 0.3, 'inferred', 0.8,
    `External painting (${(externalWallArea * 0.3).toFixed(0)}m²)`,
    'Rendered/painted areas only');

  // --- FLOOR COVERINGS ---
  const livingArea = totalFloorArea * 0.5; // ~50% hard flooring
  const carpetArea = totalFloorArea * 0.3; // ~30% carpet (bedrooms)

  addItem('FLOOR-01', wetAreaFloor, 'inferred', 0.85,
    `Floor tiles - wet areas (${wetAreaFloor.toFixed(0)}m²)`);
  addItem('FLOOR-02', wetAreaWall * 0.4, 'inferred', 0.8,
    `Wall tiles - wet areas (${(wetAreaWall * 0.4).toFixed(0)}m²)`,
    'Splashbacks and shower walls');
  addItem('FLOOR-05', livingArea, 'inferred', 0.75,
    `Vinyl plank flooring (${livingArea.toFixed(0)}m²)`,
    'Living areas');
  addItem('FLOOR-03', carpetArea, 'inferred', 0.75,
    `Carpet (${carpetArea.toFixed(0)}m²)`,
    'Bedrooms');

  // --- EXTERNAL WORKS ---
  addItem('EXTW-01', 25, 'inferred', 0.7, 'Concrete paths (25m² typical)');
  addItem('EXTW-05', 1, 'inferred', 0.9, 'Letterbox');
  addItem('EXTW-06', 1, 'inferred', 0.9, 'Clothesline');

  // --- CERTIFICATIONS ---
  addItem('CERT-01', 1, 'inferred', 0.95, 'Building permit and inspections');
  addItem('CERT-02', 1, 'inferred', 0.95, 'Engineering certification');
  addItem('CERT-03', 1, 'inferred', 0.95, 'Energy rating (NatHERS)');
  addItem('CERT-04', 1, 'inferred', 0.95, 'Survey and setout');
  addItem('CERT-05', 1, 'inferred', 0.95, 'Final inspection');

  // === SANITY CHECK ===
  const totalEstimate = items.reduce((sum, item) => sum + item.totalCost, 0);
  const { low, mid, high } = calculateTypicalHouseCost(totalFloorArea);

  console.log(`[AIAnalyzer] Estimate Summary:
    - Floor area: ${totalFloorArea}m² (source: ${floorAreaSource})
    - Total items: ${items.length}
    - Total cost: $${totalEstimate.toLocaleString()}
    - Expected range: $${low.toLocaleString()} - $${high.toLocaleString()}
  `);

  // If estimate is unreasonably high (>3x high end) or low (<0.5x low end), warn
  if (totalEstimate > high * 3) {
    console.warn(`[AIAnalyzer] WARNING: Estimate is ${(totalEstimate / high).toFixed(1)}x higher than expected high end.`);
    console.warn(`[AIAnalyzer] Check floor area (${totalFloorArea}m²) and electrical counts.`);
  } else if (totalEstimate < low * 0.5) {
    console.warn(`[AIAnalyzer] WARNING: Estimate is ${(totalEstimate / low).toFixed(1)}x lower than expected low end.`);
  }

  return items;
}

// === MAIN ANALYSIS FUNCTION ===

export interface AnalysisPDFResult {
  analysis: PlanAnalysisResult;
  arrayBuffer: ArrayBuffer;
}

/**
 * Analyze a PDF file and extract construction information
 * Returns both the analysis result and the ArrayBuffer for viewer use
 */
export async function analyzePDF(file: File): Promise<PlanAnalysisResult> {
  console.log(`[AIAnalyzer] Starting analysis of ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

  // Load PDF using centralized service
  const { result: pdfResult, arrayBuffer } = await loadPDFFromFile(file);
  const pdf = pdfResult.document;
  const pageCount = pdfResult.pageCount;

  console.log(`[AIAnalyzer] PDF loaded: ${pageCount} pages`);

  // Store arrayBuffer for viewer use (will be cached in service)
  const fileUrl = URL.createObjectURL(file);

  try {
    const pages: PageAnalysis[] = [];

    const allScheduleItems: ScheduleItem[] = [];
    const allStandardsReferences: StandardsReference[] = [];
    const allMaterialSelections: MaterialSelection[] = [];
    const allFloorAreas: FloorArea[] = [];
    const aggregatedElectricalCounts: Record<string, number> = {};

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const pageNumber = pageIndex + 1;

      // Extract text from page
      const texts = await extractTextFromPDF(fileUrl, pageIndex);

      // Classify drawing type
      const { type: drawingType, confidence: typeConfidence, title } = classifyDrawingType(texts);

      // Detect construction type
      const { type: constructionType, confidence: constructionConfidence } = detectConstructionType(texts);

      // Find dimensions, rooms, annotations using existing functions
      const dimensions = findDimensions(texts);
      const roomLabels = findRoomLabels(texts);
      const annotations = findAnnotations(texts);
      const floorFinishes = findFloorFinishes(texts);

      // Find door/window tags on floor plans (D1, W2, etc.)
      const doorWindowTags = findDoorWindowTags(texts);

      // Detect symbols (schedule references, electrical, plumbing)
      const symbols = detectSymbols(texts, pageIndex);

      // Add door/window tags as symbols with their positions
      for (const tag of doorWindowTags) {
        symbols.push({
          type: tag.type === 'door' ? 'door' : 'window',
          subType: undefined,
          bounds: tag.bounds,
          label: tag.content,
          scheduleRef: tag.content,
          confidence: tag.confidence,
          pageIndex,
        });
      }

      // Parse schedules (enhanced)
      const scheduleItems = parseSchedules(texts, pageIndex);
      allScheduleItems.push(...scheduleItems);

      // Extract Australian Standards references
      const standardsRefs = extractStandardsReferences(texts, pageIndex);
      allStandardsReferences.push(...standardsRefs);

      // Extract material selections
      const materials = parseMaterialSelections(texts, pageIndex);
      allMaterialSelections.push(...materials);

      // Extract floor areas
      const floorAreas = extractFloorAreas(texts, pageIndex);
      allFloorAreas.push(...floorAreas);

      // Count electrical symbols
      const electricalCounts = countElectricalSymbols(texts, pageIndex);
      for (const [key, count] of Object.entries(electricalCounts)) {
        aggregatedElectricalCounts[key] = (aggregatedElectricalCounts[key] || 0) + count;
      }

      // Detect building elements
      const elements = detectBuildingElements(texts, constructionType, pageIndex);

      // Extract drawing number and scale (enhanced)
      let drawingNumber: string | undefined;
      let scale = extractPageScale(texts);

      for (const text of texts) {
        const drawingMatch = text.text.match(/(?:drawing|dwg|sheet)\s*(?:no\.?|#)?\s*([A-Z]?\d+[-.]?\d*)/i);
        if (drawingMatch) drawingNumber = drawingMatch[1];

        // Fallback scale extraction if not found by extractPageScale
        if (!scale) {
          const scaleMatch = text.text.match(/scale\s*:?\s*(1\s*:\s*\d+)/i);
          if (scaleMatch) scale = scaleMatch[1].replace(/\s/g, '');
        }
      }

      pages.push({
        pageIndex,
        pageNumber,
        drawingType,
        drawingTitle: title,
        drawingNumber,
        scale,
        constructionType,
        elements,
        symbols,
        scheduleItems,
        rooms: roomLabels.map(r => ({ name: r.content })),
        dimensions: dimensions.map(d => ({ text: d.content })),
        annotations: annotations.map(a => a.content),
        textContent: texts.map(t => t.text),
        confidence: (typeConfidence + constructionConfidence) / 2,
        // Enhanced extraction data
        standardsReferences: standardsRefs,
        materialSelections: materials,
        floorAreas,
        electricalCounts: Object.keys(electricalCounts).length > 0 ? electricalCounts : undefined,
      });
    }

    // Aggregate schedules
    const schedules = {
      windows: allScheduleItems.filter(s => s.type === 'window'),
      doors: allScheduleItems.filter(s => s.type === 'door'),
      finishes: allScheduleItems.filter(s => s.type === 'finish'),
      appliances: allScheduleItems.filter(s => s.type === 'appliance'),
    };

    // Deduplicate standards references
    const uniqueStandards = Array.from(
      new Map(allStandardsReferences.map(s => [s.code, s])).values()
    );

    // Deduplicate material selections by category
    const uniqueMaterials = Array.from(
      new Map(allMaterialSelections.map(m => [`${m.category}-${m.selection}`, m])).values()
    );

    // Determine overall construction type
    const overallConstructionType = pages
      .map(p => p.constructionType)
      .filter(c => c !== 'unknown')
      .reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<ConstructionType, number>);

    const primaryConstructionType = Object.entries(overallConstructionType)
      .sort(([, a], [, b]) => b - a)[0]?.[0] as ConstructionType || 'timber_frame';

    // Determine project type
    const hasFloorPlan = pages.some(p => p.drawingType === 'floor_plan');
    const hasElevation = pages.some(p => p.drawingType === 'elevation');
    let projectType = 'Residential';
    if (hasFloorPlan && hasElevation) {
      projectType = 'New Build';
    } else if (hasFloorPlan) {
      projectType = 'Addition/Renovation';
    }

    // Count unique items
    const allSymbols = pages.flatMap(p => p.symbols);
    const uniqueDoors = new Set(allSymbols.filter(s => s.type === 'door').map(s => s.label)).size || schedules.doors.reduce((sum, d) => sum + d.quantity, 0);
    const uniqueWindows = new Set(allSymbols.filter(s => s.type === 'window').map(s => s.label)).size || schedules.windows.reduce((sum, w) => sum + w.quantity, 0);
    const uniqueRooms = new Set(pages.flatMap(p => p.rooms.map(r => r.name))).size;

    // Calculate total floor area from extracted areas
    const totalFloorArea = allFloorAreas
      .filter(a => a.name.includes('TOTAL') || a.name.includes('LIVING') || a.name.includes('GROSS'))
      .reduce((max, a) => Math.max(max, a.area), 0) ||
      allFloorAreas.reduce((sum, a) => sum + a.area, 0);

    // Determine required trades
    const trades: Trade[] = [];
    if (primaryConstructionType === 'timber_frame' || primaryConstructionType === 'steel_frame') {
      trades.push('Carpenter');
    }
    if (primaryConstructionType === 'brick_veneer' || primaryConstructionType === 'double_brick') {
      trades.push('Bricklayer');
    }
    trades.push('Concreter', 'Electrician', 'Plumber', 'Plasterer', 'Painter', 'Tiler', 'Roofer', 'Glazier');

    // Generate estimation
    const estimatedItems = generateEstimation(pages, schedules, allFloorAreas, aggregatedElectricalCounts);

    return {
      fileName: file.name,
      totalPages: pageCount,
      analysisDate: new Date(),
      pages,
      summary: {
        projectType,
        constructionType: primaryConstructionType,
        totalFloorArea: totalFloorArea > 0 ? totalFloorArea : undefined,
        totalRooms: uniqueRooms,
        totalDoors: uniqueDoors,
        totalWindows: uniqueWindows,
        trades: [...new Set(trades)],
        // Enhanced summary
        floorAreas: allFloorAreas,
        standardsReferenced: uniqueStandards.map(s => s.code),
        materialSelections: uniqueMaterials,
      },
      schedules,
      // Enhanced extraction results
      standardsReferences: uniqueStandards,
      materialSelections: uniqueMaterials,
      electricalSummary: Object.keys(aggregatedElectricalCounts).length > 0 ? aggregatedElectricalCounts : undefined,
      estimatedItems,
    };
  } finally {
    URL.revokeObjectURL(fileUrl);
  }
}

/**
 * Analyze a PDF file and return both analysis and ArrayBuffer for viewer use
 * This ensures the PDF is only loaded once and shared between analysis and viewer
 */
export async function analyzePDFWithData(file: File): Promise<AnalysisPDFResult> {
  console.log(`[AIAnalyzer] Starting analysis with data return for ${file.name}`);

  // Load PDF using centralized service
  const { result: pdfResult, arrayBuffer } = await loadPDFFromFile(file);

  // Run analysis (will use cached PDF from service)
  const analysis = await analyzePDF(file);

  console.log(`[AIAnalyzer] Analysis complete. ArrayBuffer size: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

  return {
    analysis,
    arrayBuffer,
  };
}

// === UTILITY FUNCTIONS ===

export function calculateEstimateTotals(items: EstimatedLineItem[]): {
  totalMaterials: number;
  totalLabour: number;
  subtotal: number;
  gst: number;
  total: number;
  byTrade: Record<Trade, number>;
} {
  const byTrade: Record<string, number> = {};
  let totalMaterials = 0;
  let totalLabour = 0;

  for (const item of items) {
    totalMaterials += item.materialCost;
    totalLabour += item.labourCost;
    byTrade[item.trade] = (byTrade[item.trade] || 0) + item.totalCost;
  }

  const subtotal = totalMaterials + totalLabour;
  const gst = subtotal * 0.1;

  return {
    totalMaterials,
    totalLabour,
    subtotal,
    gst,
    total: subtotal + gst,
    byTrade: byTrade as Record<Trade, number>,
  };
}

export function exportAnalysisToJSON(result: PlanAnalysisResult): string {
  return JSON.stringify(result, null, 2);
}

export function getAnalysisConfidenceLevel(result: PlanAnalysisResult): 'high' | 'medium' | 'low' {
  const avgConfidence = result.pages.reduce((sum, p) => sum + p.confidence, 0) / result.pages.length;
  const hasSchedules = result.schedules.windows.length > 0 || result.schedules.doors.length > 0;
  const hasDetectedElements = result.pages.some(p => p.elements.length > 0);

  if (avgConfidence > 0.7 && hasSchedules && hasDetectedElements) return 'high';
  if (avgConfidence > 0.4 || hasSchedules || hasDetectedElements) return 'medium';
  return 'low';
}
