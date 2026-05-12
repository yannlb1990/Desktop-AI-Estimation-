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
  extractBuildingContext,
  BuildingContext,
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

  // Filter out PDF metadata artifacts (gspublisher version strings, etc.)
  if (matchedTitle && /gspublish|version\s*\d+\.\d+|\d{4,}\.\d+\.\d+/i.test(matchedTitle)) {
    matchedTitle = undefined;
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
    // Room number patterns (4.28A, G.01) — letter suffix required to avoid matching dimension values
    { regex: /\b(\d{1,2}\.\d{2}[A-Z])\b/g, type: 'other', subType: 'room_number' },
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
  const hasScheduleHeader = allTextLower.includes('window schedule') || allTextLower.includes('window sch') ||
    allTextLower.includes('glazing schedule') || allTextLower.includes('joinery schedule');
  let match;

  // Pattern 1: Full table format (only when schedule header detected)
  // Example: W01    820 x 1210    2100    1    FIG 1    6.38 LAMINATED    ALUMINIUM POWDERCOATED
  if (hasScheduleHeader) {
    const tablePattern1 = /W(\d{1,2})\s+(\d+)\s*[xX×]\s*(\d+)\s+(\d+)?\s+(\d+)?\s*(FIG\s*\d+)?[^\n]*(LAMINATED|TOUGHENED|CLEAR|OBSCURE)?[^\n]*(ALUMINIUM|TIMBER|UPVC)?/gi;
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
  }

  // Pattern 2: Simpler format W01 820x1210 (always try)
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

  // Pattern 3: Descriptive format "AWNING WINDOW 820 x 1210" (always try)
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

  // Pattern 4: Window type tags without dimensions (AW1, SW1, FW1 etc.) (always try)
  const typedWindowPattern = /\b(AW|SW|FW|DH|CW)(\d{1,2})\b/gi;
  while ((match = typedWindowPattern.exec(allText)) !== null) {
    const ref = `${match[1].toUpperCase()}${match[2]}`;
    if (!seenRefs.has(ref)) {
      seenRefs.add(ref);
      const typeMap: Record<string, string> = { AW: 'Awning Window', SW: 'Sliding Window', FW: 'Fixed Window', DH: 'Double Hung', CW: 'Curtain Wall' };
      items.push({
        type: 'window',
        reference: ref,
        description: typeMap[match[1].toUpperCase()] || `Window ${ref}`,
        quantity: 1,
        pageIndex,
      });
    }
  }

  return items;
}

// Parse door schedule - handles various Australian formats
function parseDoorSchedule(texts: ExtractedText[], pageIndex: number): ExtendedScheduleItem[] {
  const items: ExtendedScheduleItem[] = [];
  const allText = texts.map(t => t.text).join('\n');
  const allTextLower = allText.toLowerCase();
  const hasScheduleHeader = allTextLower.includes('door schedule') || allTextLower.includes('door sch') ||
    allTextLower.includes('joinery schedule') || allTextLower.includes('joinery sch');
  let match;

  // Pattern 1: Full door schedule format (only when schedule header detected)
  if (hasScheduleHeader) {
    const tablePattern = /D(\d{1,2})\s+(\d+)\s*[xX×]\s*(\d+)[^\n]*(HINGED|SLIDING|BIFOLD|PIVOT|CAVITY|ROLLER|SECTIONAL)?[^\n]*(SOLID\s*CORE|HOLLOW\s*CORE|FLUSH|GLAZED|PANEL|ROBES?)?[^\n]*(LEVER|KNOB|PULL|PANIC)?/gi;
    while ((match = tablePattern.exec(allText)) !== null) {
      const doorType = match[4] || '';
      const doorStyle = match[5] || '';
      const hardware = match[6] || '';
      items.push({
        type: 'door',
        reference: `D${match[1]}`,
        description: `${doorType} ${doorStyle}`.trim() || `Door ${match[1]}`,
        size: `${match[2]}x${match[3]}`,
        width: parseInt(match[3]),
        height: parseInt(match[2]),
        hardware: hardware || undefined,
        quantity: 1,
        pageIndex,
      });
    }
  }

  // Pattern 2: Garage/roller/sectional doors (always try — these appear anywhere)
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

  // Pattern 3: Simple door refs D01, D02 with dimensions (always try)
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

  // Pattern 4: Door refs with type annotation but no dimensions (SD1, PD1, BFD1 etc.)
  const typedDoorPattern = /\b(SD|PD|BFD|FD|GD)(\d{1,2})\b/gi;
  while ((match = typedDoorPattern.exec(allText)) !== null) {
    const ref = `${match[1].toUpperCase()}${match[2]}`;
    if (!seenRefs.has(ref)) {
      seenRefs.add(ref);
      const typeMap: Record<string, string> = { SD: 'Sliding Door', PD: 'Pivot Door', BFD: 'Bifold Door', FD: 'Fire Door', GD: 'Glazed Door' };
      items.push({
        type: 'door',
        reference: ref,
        description: typeMap[match[1].toUpperCase()] || `Door ${ref}`,
        quantity: 1,
        pageIndex,
      });
    }
  }

  return items;
}

// Join PDF text elements line-by-line: elements at similar y are on the same line
// This prevents mid-sentence truncation caused by joining every element with \n
function joinTextsByLine(texts: ExtractedText[]): string {
  if (texts.length === 0) return '';
  const sorted = [...texts].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: string[] = [];
  let currentLineY = sorted[0].y;
  let currentLineWords: string[] = [];
  const lineThreshold = sorted[0].height > 0 ? sorted[0].height * 0.8 : 6;

  for (const t of sorted) {
    if (Math.abs(t.y - currentLineY) > lineThreshold) {
      if (currentLineWords.length) lines.push(currentLineWords.join(' '));
      currentLineY = t.y;
      currentLineWords = [t.text];
    } else {
      currentLineWords.push(t.text);
    }
  }
  if (currentLineWords.length) lines.push(currentLineWords.join(' '));
  return lines.join('\n');
}

// Returns true for selections that look like mid-sentence fragments
function isFragment(s: string): boolean {
  if (/^[&]/.test(s)) return true;
  if (/^[a-z]/.test(s)) return true;
  if (/^(AND|OF|TO|THE|WITH|WITHIN|OR|IN|FOR|A|AT)\s/i.test(s)) return true;
  if (/\s(AND|&|OF|TO|WITH)\s*$/i.test(s)) return true;
  if (s.split(/\s+/).length < 2 && s.length < 12) return true;
  return false;
}

// Parse material selections table
function parseMaterialSelections(texts: ExtractedText[], pageIndex: number): MaterialSelection[] {
  const materials: MaterialSelection[] = [];
  const allText = joinTextsByLine(texts);
  const allTextLower = allText.toLowerCase();

  // Check for material selection section
  if (!allTextLower.includes('material') && !allTextLower.includes('selection') &&
      !allTextLower.includes('finish') && !allTextLower.includes('colour')) {
    return materials;
  }

  // Common material categories in Australian residential construction
  const materialPatterns = [
    { category: 'BRICKWORK', regex: /(?:brick(?:work)?|face\s*brick)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'CLADDING', regex: /(?:cladding|weatherboard|hebel|aac|linea|knotwood|weathertex)\s*[:=]?\s*([^\n]+)/gi },
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
    { category: 'WALL FRAMING', regex: /(\d+mm\s*(?:wall\s*)?frames?(?:\s*to\s*have\s*R\d+\.\d+\s*(?:wall\s*)?batts?)?)/gi },
    { category: 'INSULATION', regex: /(R\d+\.\d+\s*(?:wall|ceiling|roof)\s*batts?)/gi },
    { category: 'INTERNAL LINING', regex: /(?:plasterboard|villaboard|fibro|blue\s*board|scyon)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'RENDER', regex: /(?:render(?:ed|ing)?|acrylic\s*render|texture\s*coat)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'WATERPROOFING', regex: /(?:waterproof(?:ing)?|emerproof|tanking)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'FLOORING', regex: /(?:engineered\s*timber|hybrid\s*floor|vinyl\s*plank|timber\s*floor(?:ing)?)\s*[:=]?\s*([^\n]+)/gi },
    { category: 'BALUSTRADE', regex: /(?:balustrad(?:e|ing)|glass\s*balustr)\s*[:=]?\s*([^\n]+)/gi },
  ];

  for (const { category, regex } of materialPatterns) {
    let match;
    while ((match = regex.exec(allText)) !== null) {
      const selection = match[1]?.trim() || match[0]?.trim();
      if (selection && selection.length > 8 && selection.length < 300 && !selection.endsWith('-') && !isFragment(selection)) {
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

  // Finish schedule parsing — filter out scale notes and dimension strings
  const finishRegex = /(floor|wall|ceiling|skirting)\s*(?:finish)?[\s:]+([^\n]+)/gi;
  let match;
  while ((match = finishRegex.exec(allText)) !== null) {
    const description = match[2].trim();
    // Skip scale notations (e.g., "1:100", "1:200")
    if (/^\d+\s*:\s*\d+/.test(description)) continue;
    // Skip entries that start with a number and have no real words
    if (/^\d/.test(description) && !/[a-zA-Z]{3,}/.test(description)) continue;
    // Skip short entries (< 3 chars)
    if (description.length < 3) continue;
    // Skip entries that are just scale keywords
    if (/^(COVERING|FIRST|SECOND|THIRD|LEVEL|PLAN|SECOND\s*FLOOR|GROUND\s*FLOOR)/i.test(description)) continue;
    items.push({
      type: 'finish',
      reference: match[1].toUpperCase(),
      description,
      quantity: 1,
      pageIndex,
    });
  }

  // Parse appliance schedule — one entry per type per page (deduplicated by reference)
  const appliancePatterns: Array<[RegExp, string]> = [
    [/\b(dishwasher|DW)\b/gi, 'DISHWASHER'],
    [/\b(washing\s*machine|WM)\b/gi, 'WASHING_MACHINE'],
    [/\b(dryer)\b/gi, 'DRYER'],
    [/\b(cooktop)\b/gi, 'COOKTOP'],
    [/\b(rangehood)\b/gi, 'RANGEHOOD'],
    [/\b(oven)\b/gi, 'OVEN'],
    [/\b(fridge|refrigerator)\b/gi, 'FRIDGE'],
    [/\b(microwave|MW)\b/gi, 'MICROWAVE'],
  ];

  for (const [pattern, ref] of appliancePatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(allText)) {
      // Count occurrences
      pattern.lastIndex = 0;
      let qty = 0;
      let firstLabel = ref;
      while ((match = pattern.exec(allText)) !== null) {
        qty++;
        if (qty === 1) firstLabel = match[1];
      }
      items.push({
        type: 'appliance',
        reference: ref,
        description: firstLabel,
        quantity: qty,
        pageIndex,
      });
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

  // === BUILDING CONTEXT: detect duplex, multi-storey, pool, materials ===
  const allPageTexts = pages.flatMap(p => p.textContent);
  const ctx = extractBuildingContext(allPageTexts);
  const { isDuplex, unitCount, isMultiStorey, storeyCount, hasPool, hasCarport,
    hasEngineeredTimber, hasLouvreWindows, hasFeatureWeatherboard,
    hasAluminiumBattens, hasRender, hasBreezeBlock } = ctx;

  console.log(`[AIAnalyzer] Building context:`, ctx);

  // === FLOOR AREA DETECTION ===
  let totalFloorArea = 0;
  let floorAreaSource: 'detected' | 'inferred' = 'inferred';

  console.log(`[AIAnalyzer] Floor areas extracted: ${floorAreas.length} items`);
  if (floorAreas.length > 0) {
    console.log(`[AIAnalyzer] Floor areas:`, floorAreas.map(a => `${a.name}: ${a.area}m²`).join(', '));
  }

  // Look for explicit TOTAL area first
  const totalArea = floorAreas.find(a =>
    /TOTAL|GROSS|FLOOR\s*AREA/i.test(a.name) && a.area > 50
  );

  if (totalArea && totalArea.area > 50 && totalArea.area < 10000) {
    totalFloorArea = totalArea.area;
    floorAreaSource = 'detected';
    console.log(`[AIAnalyzer] Using TOTAL area: ${totalFloorArea}m²`);
  } else if (floorAreas.length > 0) {
    // Sum ALL valid individual room/space areas (cap per area, not total)
    const summed = floorAreas
      .filter(a => a.area > 1 && a.area < 1000)
      .reduce((sum, a) => sum + a.area, 0);

    if (summed > 50) {
      totalFloorArea = summed;
      floorAreaSource = 'detected';
      console.log(`[AIAnalyzer] Summed floor areas: ${totalFloorArea}m² from ${floorAreas.length} items`);
    }
  }

  // Context-derived fallback: use context-detected areas if area extraction failed
  if (totalFloorArea < 80 && ctx.totalGrossArea > 80) {
    totalFloorArea = ctx.totalGrossArea;
    floorAreaSource = 'detected';
    console.log(`[AIAnalyzer] Using context-derived area: ${totalFloorArea}m²`);
  }

  // Final fallback: use reasonable default based on building type
  if (totalFloorArea < 80 || totalFloorArea > 8000) {
    totalFloorArea = isDuplex ? 400 : 175;
    floorAreaSource = 'inferred';
    console.log(`[AIAnalyzer] Using default area: ${totalFloorArea}m² (isDuplex=${isDuplex})`);
  }

  totalFloorArea = Math.round(totalFloorArea);

  // Per-unit floor area for kitchens, bathrooms, etc.
  const floorAreaPerUnit = Math.round(totalFloorArea / unitCount);

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

  // Count rooms from extracted labels
  const allRooms = pages.flatMap(p => p.rooms);
  const detectedWetRooms = allRooms
    .filter(r => /bathroom|ensuite|laundry|toilet|wc|powder/i.test(r.name)).length;
  const detectedBedrooms = allRooms
    .filter(r => /\bbed\b|\bbedroom\b|\bmaster\b|\bguest\s*bed/i.test(r.name)).length;
  const detectedBathrooms = allRooms
    .filter(r => /\bbath\b|\bbathroom\b|\bensuite\b/i.test(r.name)).length;

  // Minimum: 2 per unit (ensuite + main), plus laundry
  const minWetRooms = unitCount * 3;
  const wetRoomCount = Math.max(detectedWetRooms, minWetRooms);
  // Bedroom and bathroom counts with realistic minimums per unit
  const bedroomCount = Math.max(detectedBedrooms, unitCount * 3); // min 3-bed per unit
  const bathroomCount = Math.max(detectedBathrooms, unitCount * 2); // min 2 bathrooms per unit

  // Determine construction type
  const constructionType = pages.reduce((acc, p) => {
    if (p.constructionType !== 'unknown') return p.constructionType;
    return acc;
  }, 'timber_frame' as ConstructionType);

  // Calculate derived quantities
  // Footprint = ground floor area only (for roof, external perimeter, etc.)
  const footprintArea = isMultiStorey ? Math.round(totalFloorArea / storeyCount) : totalFloorArea;
  // External wall perimeter: based on footprint per unit, accounting for party walls in duplex
  const wallPerimeter = Math.round(Math.sqrt(footprintArea / unitCount) * 3.8 * unitCount);
  // External wall area: perimeter × full building height (all storeys)
  const externalWallArea = Math.round(wallPerimeter * 2.7 * storeyCount);
  // Garage/carport area excluded from internal finishes
  const garageArea = Math.round(totalFloorArea * (isDuplex ? 0.14 : 0.11));
  const habitableArea = totalFloorArea - garageArea;
  const roofArea = Math.round(footprintArea * 1.15);
  const wetAreaFloor = wetRoomCount * 8;
  const wetAreaWall = wetRoomCount * 25;

  // === WALL ASSEMBLY PATHWAY ===
  // All framing, insulation, cladding, lining, and painting quantities trace back to these
  // source measurements so every component of each wall type is internally consistent.

  // windowCount is needed here for opening fraction; also referenced in WINDOWS section below
  const windowCount = schedules.windows.length > 0
    ? schedules.windows.reduce((sum, w) => sum + w.quantity, 0)
    : Math.ceil(totalFloorArea / 12);

  // External wall gross face area — full perimeter × full height × all storeys, before any deductions
  const extWallGross = externalWallArea;
  // Opening fraction: 32% standard residential, 38% for louvre-heavy or high-glazing designs
  const extWallOpeningFraction = (hasLouvreWindows || windowCount > totalFloorArea / 8) ? 0.38 : 0.32;
  // External wall NET — openings deducted; used for cladding (outside) AND internal lining (inside)
  const extWallNet = Math.round(extWallGross * (1 - extWallOpeningFraction));
  // Internal partitions single-face area across all floors
  const intWallSingleFace = Math.round(totalFloorArea * 0.9);
  // Total framing area = external (gross) + internal partitions; both use the same stud frame
  const totalFramingArea = extWallGross + intWallSingleFace;
  // Wall insulation: external cavity batts (gross area) + acoustic batts in ~25% of internal walls
  const totalWallInsulation = extWallGross + Math.round(intWallSingleFace * 0.25);
  // Wall plasterboard: ext wall internal face (net) + BOTH sides of internal partitions − wet areas
  const wallPlasterboard = Math.round(extWallNet + intWallSingleFace * 2 - wetAreaWall);

  console.log('[Assembly Pathway]', {
    extWallGross, extWallNet,
    intWallSingleFace, totalFramingArea,
    totalWallInsulation, wallPlasterboard,
    habitableArea, wetAreaWall,
  });

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

  // --- PRELIMINARIES --- (rate is per m² of GFA; scales automatically with project size)
  addItem('PRELIM-01', totalFloorArea, 'inferred', 0.9,
    `Site establishment, supervision & temporary facilities (${totalFloorArea}m² project)`);
  addItem('PRELIM-02', totalFloorArea, 'inferred', 0.8,
    `Site office, amenities & perimeter fencing (${totalFloorArea}m²)`);

  // --- SITE WORKS ---
  addItem('SITE-01', totalFloorArea * 1.5, floorAreaSource, 0.7,
    `Site clearing (${(totalFloorArea * 1.5).toFixed(0)}m²)`,
    `Floor area ${totalFloorArea}m² × 1.5 for site coverage`);

  // --- STRUCTURE ---
  // Ground floor slab
  if (elementCounts['floor-concrete'] > 0 || constructionType !== 'unknown') {
    addItem('STRUCT-01', totalFloorArea, floorAreaSource, 0.85,
      `Waffle pod slab on ground (${totalFloorArea.toFixed(0)}m²)`,
      `Total ground floor area: ${totalFloorArea}m²`);
  }

  // First floor structure (cassette/floor joists) for multi-storey
  if (isMultiStorey) {
    // Estimate upper floor area — typically ~45–55% of total for 2-storey with garages on ground
    const upperFloorArea = ctx.firstFloorArea > 0
      ? ctx.firstFloorArea
      : Math.round(totalFloorArea * 0.45);
    addItem('STRUCT-05', upperFloorArea, ctx.firstFloorArea > 0 ? 'detected' : 'inferred', 0.85,
      `First floor structure — cassette/floor joists (${upperFloorArea}m²)`,
      `Upper level floor framing`);
  }

  // --- FRAMING & TRUSS ---
  if (constructionType === 'timber_frame' || constructionType === 'brick_veneer' || constructionType === 'unknown') {
    addItem('FRAME-01', totalFramingArea, floorAreaSource === 'detected' ? 'detected' : 'inferred', 0.8,
      `Timber wall framing (${totalFramingArea}m²: ${extWallGross}m² ext + ${intWallSingleFace}m² int)`,
      `External wall gross ${extWallGross}m² + internal partitions single-face ${intWallSingleFace}m²`);
  }

  // Roof trusses only cover the roof footprint (ground floor for 2-storey)
  const roofCoverageArea = isMultiStorey ? Math.round(totalFloorArea / storeyCount) : totalFloorArea;
  addItem('FRAME-03', roofCoverageArea, floorAreaSource, 0.85,
    `Roof trusses (${roofCoverageArea}m² coverage)`,
    `Based on roof footprint`);

  addItem('FRAME-04', totalFloorArea, floorAreaSource, 0.85,
    `Ceiling battens (${totalFloorArea.toFixed(0)}m²)`,
    `Based on floor area`);

  // --- ROOFING --- (roofArea already = footprint × 1.15, computed above)
  addItem('ROOF-01', roofArea, floorAreaSource === 'detected' ? 'detected' : 'inferred', 0.8,
    `Colorbond roofing (${roofArea}m²)`,
    `Roof footprint ${footprintArea}m² × 1.15 pitch factor`);

  addItem('ROOF-03', roofArea, 'inferred', 0.85, `Sarking/building wrap (${roofArea}m²)`);
  addItem('ROOF-04', wallPerimeter, 'inferred', 0.8, `Fascia and barge (${wallPerimeter}lm)`);
  addItem('ROOF-05', wallPerimeter, 'inferred', 0.8, `Gutters (${wallPerimeter}lm)`);
  const downpipeCount = Math.max(6, Math.round(wallPerimeter / 9));
  addItem('ROOF-06', downpipeCount * 3, 'inferred', 0.8, `Downpipes (${downpipeCount} × 3lm avg)`);

  // --- CARPORT STRUCTURE (if detected) ---
  if (hasCarport) {
    const carportArea = 36 * unitCount; // ~18m² per unit carport
    addItem('EXTW-07', carportArea, 'detected', 0.85,
      `Carport structure (${unitCount} × 18m²)`,
      'Carport detected in plans — posts, beams, Colorbond roof');
  }

  // --- EXTERNAL CLADDING ---
  // extWallNet from wall assembly pathway already deducts openings — use directly for cladding
  const claddingNet = extWallNet;

  const claddingDetected = hasFeatureWeatherboard || hasAluminiumBattens || hasRender || hasBreezeBlock;

  if (claddingDetected) {
    // Distribute across detected cladding types
    const typesFound = [hasFeatureWeatherboard, hasAluminiumBattens, hasRender, hasBreezeBlock].filter(Boolean).length;
    const brickVeneerPresent = constructionType === 'brick_veneer' || elementCounts['wall-brick_veneer'] > 0;
    const brickShare = brickVeneerPresent ? 0.25 : 0;
    const remaining = 1 - brickShare;
    const sharePerType = remaining / (typesFound || 1);

    if (brickVeneerPresent) {
      addItem('EXT-01', claddingNet * brickShare, 'detected', 0.8,
        `Brick veneer (${(claddingNet * brickShare).toFixed(0)}m²)`);
    }
    if (hasFeatureWeatherboard) {
      addItem('EXT-05', claddingNet * sharePerType, 'detected', 0.85,
        `Feature weatherboard — Linea/Weathertex (${(claddingNet * sharePerType).toFixed(0)}m²)`);
    }
    if (hasAluminiumBattens) {
      addItem('EXT-06', claddingNet * sharePerType * 0.6, 'detected', 0.85,
        `Aluminium feature battens — Knotwood (${(claddingNet * sharePerType * 0.6).toFixed(0)}m²)`);
    }
    if (hasRender) {
      addItem('EXT-04', claddingNet * sharePerType, 'detected', 0.85,
        `Acrylic render to FC sheeting (${(claddingNet * sharePerType).toFixed(0)}m²)`);
    }
    if (hasBreezeBlock) {
      addItem('EXT-07', claddingNet * 0.08, 'detected', 0.8,
        `Besser/breeze block feature wall (${(claddingNet * 0.08).toFixed(0)}m²)`);
    }
  } else if (constructionType === 'brick_veneer' || elementCounts['wall-brick_veneer'] > 0) {
    addItem('EXT-01', claddingNet, 'inferred', 0.75,
      `Brick veneer (${claddingNet.toFixed(0)}m²)`, `External walls minus windows/doors`);
  } else {
    addItem('EXT-02', claddingNet, 'inferred', 0.75,
      `Hebel cladding (${claddingNet.toFixed(0)}m²)`, `External walls minus windows/doors`);
  }

  // --- WINDOWS & DOORS ---
  // windowCount already computed in wall assembly pathway above

  const doorCount = schedules.doors.length > 0
    ? schedules.doors.reduce((sum, d) => sum + d.quantity, 0)
    : Math.ceil(totalFloorArea / 15);

  if (schedules.windows.length > 0) {
    for (const win of schedules.windows) {
      const isLouvre = /louv(?:re|er)/i.test(win.description);
      const isLargeSlider = win.size && parseInt(win.size.split('x')[0]) > 1800;
      const isCurved = /curved|feature|arch/i.test(win.description);
      let rateCode = 'WD-01';
      if (isLouvre) rateCode = 'WD-11';
      else if (isCurved) rateCode = 'WD-12';
      else if (isLargeSlider) rateCode = 'WD-03';
      addItem(rateCode, win.quantity, 'schedule', 0.95,
        `${win.reference}: ${win.description}`, 'From window schedule');
    }
  } else if (hasLouvreWindows) {
    const louvreCount = Math.ceil(windowCount * 0.5);
    const stdCount = windowCount - louvreCount;
    addItem('WD-11', louvreCount, 'inferred', 0.7, `Louvre windows (${louvreCount} estimated)`);
    addItem('WD-01', stdCount, 'inferred', 0.7, `Standard windows (${stdCount} estimated)`);
  } else {
    addItem('WD-01', windowCount, 'inferred', 0.7,
      `Windows — standard (${windowCount} estimated)`,
      `~1 per 12m² of floor area`);
  }

  if (schedules.doors.length > 0) {
    let garageDoorCount = 0;
    let stackerDoorCount = 0;
    let entryDoorCount = 0;
    let robeDoorCount = 0;
    let cavityCount = 0;
    let internalCount = 0;

    for (const door of schedules.doors) {
      const isGarage = /garage|sectional|roller|overhead/i.test(door.description);
      const isStacker = /stacker|sliding\s*stack/i.test(door.description);
      const isRobe = /robe|wardrobe|sliding\s*robe/i.test(door.description);
      const isCavity = /cavity\s*slid/i.test(door.description);
      const isExternal = /external|entry|front|main\s*entry/i.test(door.description);

      if (isGarage) {
        garageDoorCount += door.quantity;
      } else if (isStacker) {
        stackerDoorCount += door.quantity;
        addItem('WD-10', door.quantity, 'schedule', 0.95,
          `${door.reference}: Sliding stacker door (${door.quantity})`, 'From door schedule');
      } else if (isRobe) {
        robeDoorCount += door.quantity;
        addItem('WD-09', door.quantity * 1.5, 'schedule', 0.9,
          `${door.reference}: Sliding robe doors (${door.quantity})`, 'From door schedule');
      } else if (isCavity) {
        cavityCount += door.quantity;
        addItem('WD-04', door.quantity, 'schedule', 0.95,
          `${door.reference}: Cavity sliding door (${door.quantity})`, 'From door schedule');
      } else if (isExternal) {
        entryDoorCount += door.quantity;
        addItem('WD-06', door.quantity, 'schedule', 0.95,
          `${door.reference}: Entry door (${door.quantity})`, 'From door schedule');
      } else {
        internalCount += door.quantity;
        addItem('WD-04', door.quantity, 'schedule', 0.95,
          `${door.reference}: Internal door (${door.quantity})`, 'From door schedule');
      }
    }

    if (garageDoorCount > 0) {
      addItem('WD-07', garageDoorCount, 'schedule', 0.95,
        `Overhead garage doors (${garageDoorCount})`, 'From door schedule');
    }
    // If no entry door in schedule, add one per unit
    if (entryDoorCount === 0) {
      addItem('WD-06', unitCount, 'inferred', 0.85, `Entry doors (${unitCount} units)`);
    }
  } else {
    // No schedule — estimate from floor area
    const garageDoorsEstimated = unitCount; // 1 per unit
    const entryDoorsEstimated = unitCount;
    const internalDoorsEstimated = Math.max(1, doorCount - garageDoorsEstimated - entryDoorsEstimated);
    addItem('WD-06', entryDoorsEstimated, 'inferred', 0.8, `Entry doors (${entryDoorsEstimated})`);
    addItem('WD-04', internalDoorsEstimated, 'inferred', 0.7,
      `Internal doors (${internalDoorsEstimated} estimated)`, 'Estimated from floor area');
    addItem('WD-07', garageDoorsEstimated, 'inferred', 0.8,
      `Garage doors (${garageDoorsEstimated})`, '1 per unit');
  }

  // --- INTERNAL LININGS ---
  addItem('INT-01', wallPlasterboard, 'inferred', 0.8,
    `Plasterboard walls (${wallPlasterboard}m²: ${extWallNet}m² ext + ${intWallSingleFace * 2}m² int both sides)`,
    `Ext wall net ${extWallNet}m² + internal partitions ×2 ${intWallSingleFace * 2}m² − wet areas ${wetAreaWall}m²`);
  addItem('INT-02', habitableArea, floorAreaSource, 0.85,
    `Plasterboard ceiling (${habitableArea}m² habitable)`,
    `Total area minus garage (${garageArea}m²)`);
  addItem('INT-03', wetAreaWall, 'inferred', 0.8,
    `Villaboard wet areas (${wetAreaWall}m²)`,
    `${wetRoomCount} wet rooms × ~25m² walls`);
  addItem('INT-04', wetAreaFloor + wetAreaWall * 0.5, 'inferred', 0.8,
    `Waterproofing membrane AS 3740 (${(wetAreaFloor + wetAreaWall * 0.5).toFixed(0)}m²)`,
    'Wet area floors + shower/bath splashbacks');
  addItem('INT-05', habitableArea, 'inferred', 0.85,
    `Ceiling insulation R4.0 (${habitableArea}m² habitable area)`);
  addItem('INT-06', totalWallInsulation, 'inferred', 0.8,
    `Wall insulation R2.5 batts (${totalWallInsulation}m²: ${extWallGross}m² ext cavity + ${Math.round(intWallSingleFace * 0.25)}m² acoustic)`,
    `External cavity insulation ${extWallGross}m² + acoustic batts in 25% of internal partitions`);

  // --- STAIRS & BALUSTRADE (multi-storey) ---
  if (isMultiStorey) {
    addItem('FIT-10', unitCount, 'detected', 0.9,
      `Staircase — timber with balustrade (${unitCount} stair${unitCount > 1 ? 's' : ''})`,
      `${unitCount} staircase per unit, 2-storey building`);
    const balustradeLm = Math.round(Math.sqrt(totalFloorArea / storeyCount) * 1.5 * unitCount);
    addItem('FIT-11', balustradeLm, 'inferred', 0.75,
      `Glass balustrade — upper landings/balcony (${balustradeLm}lm)`,
      'Upper floor landing and balcony edges');
  }

  // --- INTERNAL FIT-OUT ---
  // Kitchens: 1 per unit, 6.5lm average run
  addItem('FIT-01', 6.5 * unitCount, 'inferred', 0.85,
    `Kitchen cabinetry (${unitCount} kitchen${unitCount > 1 ? 's' : ''} × 6.5lm)`,
    `${unitCount} unit${unitCount > 1 ? 's' : ''} — 1 kitchen each`);
  addItem('FIT-02', 4.5 * unitCount, 'inferred', 0.85,
    `Stone benchtop 20mm (${unitCount} kitchen${unitCount > 1 ? 's' : ''} × 4.5lm)`,
    `${unitCount} unit${unitCount > 1 ? 's' : ''}`);

  // Bathrooms: detected count + powder room per unit
  const pdrCount = unitCount;
  addItem('FIT-03', bathroomCount + pdrCount, bathroomCount > unitCount * 2 ? 'detected' : 'inferred', 0.85,
    `Bathroom vanities (${bathroomCount} full + ${pdrCount} PDR)`,
    `${bathroomCount} bathrooms/ensuites + powder rooms`);

  // Freestanding baths: 1 per unit (ensuite or master bath)
  addItem('FIT-08', unitCount, 'inferred', 0.8,
    `Freestanding bath (${unitCount} — one per unit ensuite)`,
    'Premium bath per ensuite');

  // Frameless shower screens: 1 per bathroom/ensuite
  addItem('FIT-09', bathroomCount, 'inferred', 0.8,
    `Frameless shower screens (${bathroomCount})`,
    `${bathroomCount} bathrooms/ensuites`);

  // Laundry: 1 per unit
  addItem('FIT-04', unitCount, 'inferred', 0.85,
    `Laundry trough and cabinet (${unitCount})`,
    `1 per unit`);

  // Wardrobes: detected bedrooms × 2.4lm average
  addItem('FIT-05', bedroomCount * 2.4, bedroomCount > unitCount * 3 ? 'detected' : 'inferred', 0.8,
    `Built-in wardrobe shelving (${bedroomCount} bedrooms × 2.4lm)`,
    `${bedroomCount} bedrooms detected/estimated`);

  // Skirting: ~2× internal perimeter across all floors
  const skirtingLm = Math.round(Math.sqrt(habitableArea / unitCount) * 3.8 * unitCount * 2);
  addItem('FIT-06', skirtingLm, 'inferred', 0.8,
    `Skirting (${skirtingLm}lm all habitable floors)`,
    'Approx internal perimeter across all habitable floors');

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

  addItem('ELEC-09', unitCount, 'inferred', 0.95,
    `Switchboard (${unitCount} — one per unit)`,
    `Separate metering per unit for duplex`);
  addItem('ELEC-10', unitCount, 'inferred', 0.95,
    `Electrical fit-off and testing (${unitCount} units)`);

  // --- PLUMBING ---
  // Minimum fixtures: toilets = 2 per unit (ensuite + main + PDR), basins similar, showers = 2 per unit
  const minToilets = unitCount * 3;
  const minShowers = unitCount * 2;
  const minBasins = unitCount * 3;
  const toilets = Math.max(symbolCounts['toilet'] || 0, minToilets);
  const showers = Math.max(symbolCounts['shower'] || 0, minShowers);
  const basins = Math.max(symbolCounts['sink'] || 0, minBasins);
  const fixtureCount = toilets + basins + showers + unitCount * 2; // +2 per unit for kitchen/laundry

  addItem('PLUMB-01', fixtureCount, 'inferred', 0.8,
    `Water supply rough-in (${fixtureCount} fixtures across ${unitCount} unit${unitCount > 1 ? 's' : ''})`,
    'All plumbing fixtures');
  addItem('PLUMB-02', fixtureCount, 'inferred', 0.8,
    `Drainage rough-in (${fixtureCount} fixtures)`);

  addItem('PLUMB-03', toilets, symbolCounts['toilet'] > 0 ? 'detected' : 'inferred', 0.85,
    `Toilet suites (${toilets})`);
  addItem('PLUMB-04', showers, symbolCounts['shower'] > 0 ? 'detected' : 'inferred', 0.85,
    `Shower mixer and rose (${showers})`);
  addItem('PLUMB-05', basins, symbolCounts['sink'] > 0 ? 'detected' : 'inferred', 0.85,
    `Basin mixer taps (${basins})`);
  addItem('PLUMB-06', unitCount, 'inferred', 0.9,
    `Kitchen sink (${unitCount} — one per unit)`);
  addItem('PLUMB-07', unitCount, 'inferred', 0.9,
    `Kitchen mixer tap (${unitCount})`);
  addItem('PLUMB-08', unitCount, 'inferred', 0.9,
    `Hot water system (${unitCount} — one per unit)`);
  addItem('PLUMB-09', unitCount, 'inferred', 0.85,
    `Stormwater drainage (${unitCount} connections)`);
  addItem('PLUMB-10', unitCount, 'inferred', 0.85,
    `Sewer connection (${unitCount} — separate per unit)`);

  // --- HVAC ---
  const acUnits = symbolCounts['air_conditioning'] || 0;
  const minAcUnits = unitCount * 3; // ~3 splits per unit (living, master, open plan)
  const finalAcCount = acUnits > 0 ? acUnits : minAcUnits;
  addItem('HVAC-01', finalAcCount, acUnits > 0 ? 'detected' : 'inferred', acUnits > 0 ? 0.9 : 0.7,
    `Split system AC (${finalAcCount} — ~3 per unit)`,
    `${unitCount} unit${unitCount > 1 ? 's' : ''} × 3 splits`);

  // --- PAINTING ---
  addItem('PAINT-01', wallPlasterboard, 'inferred', 0.85,
    `Internal walls painting (${wallPlasterboard}m² — matches plasterboard area)`,
    `Same area as INT-01 wall plasterboard`);
  addItem('PAINT-02', habitableArea, 'inferred', 0.85,
    `Ceiling painting (${habitableArea}m² habitable)`,
    `Excluding garage (${garageArea}m²)`);
  addItem('PAINT-03', doorCount, 'inferred', 0.85,
    `Door and frame painting (${doorCount})`);
  addItem('PAINT-04', extWallGross * 0.35, 'inferred', 0.8,
    `External painting — rendered/painted surfaces (${Math.round(extWallGross * 0.35)}m²)`);

  // --- FLOOR COVERINGS --- (garage excluded from all finish areas)
  const tileArea = wetAreaFloor;                           // wet rooms only
  const hardFloorArea = Math.round(habitableArea * 0.52); // living, hall, kitchen, dining
  const carpetArea = Math.round(habitableArea * 0.30);    // bedrooms only

  addItem('FLOOR-01', tileArea, 'inferred', 0.85,
    `Floor tiles (porcelain) — wet areas (${tileArea}m²)`,
    `${wetRoomCount} wet rooms × 8m²`);
  addItem('FLOOR-02', Math.round(wetAreaWall * 0.5), 'inferred', 0.8,
    `Wall tiles — shower walls & splashbacks (${Math.round(wetAreaWall * 0.5)}m²)`);

  if (hasEngineeredTimber) {
    addItem('FLOOR-04', hardFloorArea, 'detected', 0.85,
      `Engineered timber flooring (${hardFloorArea}m²)`,
      'Detected from plan notes — living and main areas');
  } else {
    addItem('FLOOR-05', hardFloorArea, 'inferred', 0.75,
      `Vinyl plank flooring (${hardFloorArea}m²)`,
      `52% of habitable area (${habitableArea}m²)`);
  }

  addItem('FLOOR-03', carpetArea, 'inferred', 0.75,
    `Carpet with underlay (${carpetArea}m²)`,
    `30% of habitable area — bedrooms, approx ${bedroomCount} rooms`);

  // --- EXTERNAL WORKS ---
  const pathArea = 25 * unitCount;
  addItem('EXTW-01', pathArea, 'inferred', 0.7,
    `Concrete paths and driveways (${pathArea}m²)`,
    `${unitCount} units`);
  addItem('EXTW-05', unitCount, 'inferred', 0.9,
    `Letterbox (${unitCount})`, `1 per unit`);
  addItem('EXTW-06', unitCount, 'inferred', 0.9,
    `Clothesline (${unitCount})`, `1 per unit`);

  // Pool (if detected in plans)
  if (hasPool) {
    addItem('POOL-01', 1, 'detected', 0.9,
      'Inground concrete pool — complete package (6×3m, excavation, shell, tiling, filtration, pump)',
      'Swimming pool detected in site/floor plans');
    addItem('POOL-02', 24, 'inferred', 0.8,
      'Glass pool fencing — frameless toughened (~24lm)',
      'Pool perimeter fencing to QDC/NCC requirements');
    addItem('EXTW-09', 30, 'inferred', 0.75,
      'Pool surrounds / paved area (30m²)',
      'Paving around pool area');
  }

  // Gate and intercom (detected via breeze block wall or duplex)
  if (hasBreezeBlock || isDuplex) {
    addItem('EXTW-08', unitCount, 'detected', 0.8,
      `Gate and intercom system (${unitCount} units)`,
      'Detected entry wall/gate in plans');
  }

  // Termite management (NCC mandatory for all new class 1 dwellings)
  addItem('EXTW-10', unitCount, 'inferred', 0.95,
    `Termite management AS 3660 chemical soil treatment (${unitCount} dwelling${unitCount > 1 ? 's' : ''})`,
    'NCC mandatory — chemical soil treatment + physical barriers');

  // --- CERTIFICATIONS ---
  // Duplex requires dual occupancy DA, separate OCs, higher fees
  const certMultiplier = isDuplex ? 1.8 : 1;
  addItem('CERT-01', certMultiplier, 'inferred', 0.95,
    isDuplex ? 'Building permit — dual occupancy DA (inc. separate OC per unit)' : 'Building permit and inspections',
    'Includes DA/CDC application, mandatory progress inspections');
  addItem('CERT-02', certMultiplier, 'inferred', 0.95,
    'Engineering certification (structural + geotechnical)');
  addItem('CERT-03', unitCount, 'inferred', 0.95,
    `Energy rating NatHERS (${unitCount} dwelling${unitCount > 1 ? 's' : ''})`);
  addItem('CERT-04', 1, 'inferred', 0.95, 'Survey and setout (registered surveyor)');
  addItem('CERT-05', unitCount, 'inferred', 0.95,
    `Final inspection and occupancy certificate (${unitCount})`);

  // === SANITY CHECK ===
  const totalEstimate = items.reduce((sum, item) => sum + item.totalCost, 0);
  const { low, mid, high } = calculateTypicalHouseCost(totalFloorArea);

  console.log(`[AIAnalyzer] Estimate Summary:
    - Floor area: ${totalFloorArea}m² (source: ${floorAreaSource})
    - Building: ${isDuplex ? `Duplex — ${unitCount} units` : 'Single dwelling'}, ${storeyCount}-storey
    - Pool: ${hasPool}, Carport: ${hasCarport}
    - Cladding: weatherboard=${hasFeatureWeatherboard}, battens=${hasAluminiumBattens}, render=${hasRender}, breezeblock=${hasBreezeBlock}
    - Total items: ${items.length}
    - Total cost: $${totalEstimate.toLocaleString()}
    - Expected range: $${low.toLocaleString()} - $${high.toLocaleString()} (× ${unitCount} units)
  `);

  // Allow higher ratios for duplex/multi-unit builds
  const maxRatio = isDuplex ? 6 : 3;
  if (totalEstimate > high * maxRatio) {
    console.warn(`[AIAnalyzer] WARNING: Estimate ${(totalEstimate / high).toFixed(1)}x above expected high — check floor area (${totalFloorArea}m²) and electrical.`);
  } else if (totalEstimate < low * 0.4) {
    console.warn(`[AIAnalyzer] WARNING: Estimate ${(totalEstimate / low).toFixed(1)}x below expected low — likely missing items.`);
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

    // Aggregate schedules — deduplicate windows/doors by reference, appliances by reference (sum qty)
    const dedupeByRef = (items: ScheduleItem[]) => {
      const map = new Map<string, ScheduleItem>();
      for (const item of items) {
        const existing = map.get(item.reference);
        if (!existing) {
          map.set(item.reference, { ...item });
        } else {
          existing.quantity = Math.max(existing.quantity, item.quantity);
        }
      }
      return Array.from(map.values());
    };

    const dedupeAppliances = (items: ScheduleItem[]) => {
      const map = new Map<string, ScheduleItem>();
      for (const item of items) {
        const existing = map.get(item.reference);
        if (!existing) {
          map.set(item.reference, { ...item });
        } else {
          // Use max quantity seen across pages (not sum — same appliance appears on multiple pages)
          existing.quantity = Math.max(existing.quantity, item.quantity);
        }
      }
      return Array.from(map.values());
    };

    const schedules = {
      windows: dedupeByRef(allScheduleItems.filter(s => s.type === 'window')),
      doors: dedupeByRef(allScheduleItems.filter(s => s.type === 'door')),
      finishes: allScheduleItems.filter(s => s.type === 'finish'),
      appliances: dedupeAppliances(allScheduleItems.filter(s => s.type === 'appliance')),
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

    // Count items — prefer schedule totals (most accurate), fall back to symbol count
    const allSymbols = pages.flatMap(p => p.symbols);
    const scheduleDoorTotal = schedules.doors.reduce((sum, d) => sum + d.quantity, 0);
    const scheduleWindowTotal = schedules.windows.reduce((sum, w) => sum + w.quantity, 0);
    const symbolDoorCount = allSymbols.filter(s => s.type === 'door').length;
    const symbolWindowCount = allSymbols.filter(s => s.type === 'window').length;
    const uniqueDoors = scheduleDoorTotal > 0 ? scheduleDoorTotal : symbolDoorCount;
    const uniqueWindows = scheduleWindowTotal > 0 ? scheduleWindowTotal : symbolWindowCount;
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
