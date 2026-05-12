// PDF Text Extraction Utility for extracting dimensions and room labels from architectural plans
import * as pdfjs from 'pdfjs-dist';

export interface ExtractedText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
  fontSize?: number;
  fontName?: string;
}

export interface ExtractedElement {
  type: 'text' | 'dimension' | 'room_label' | 'annotation' | 'area' | 'schedule_item';
  content: string;
  bounds: { x: number; y: number; width: number; height: number };
  pageIndex: number;
  confidence?: number;
  value?: number;
  unit?: string;
}

// Floor area extraction result
export interface ExtractedFloorArea {
  name: string;
  area: number;
  unit: string;
  pageIndex: number;
}

// Schedule table extraction
export interface ExtractedScheduleRow {
  type: 'window' | 'door' | 'finish' | 'appliance';
  reference: string;
  description: string;
  size?: string;
  width?: number;
  height?: number;
  quantity: number;
  material?: string;
  finish?: string;
  hardware?: string;
  notes?: string;
  pageIndex: number;
}

// Extract all text items from a PDF page with enhanced metadata
export async function extractTextFromPDF(
  pdfUrl: string,
  pageIndex: number
): Promise<ExtractedText[]> {
  try {
    const pdf = await pdfjs.getDocument(pdfUrl).promise;
    const page = await pdf.getPage(pageIndex + 1);
    const textContent = await page.getTextContent();

    const items: ExtractedText[] = [];

    for (const item of textContent.items as any[]) {
      if (!item.str || !item.str.trim()) continue;

      items.push({
        text: item.str,
        x: item.transform?.[4] || 0,
        y: item.transform?.[5] || 0,
        width: item.width || 0,
        height: item.height || Math.abs(item.transform?.[0]) || 10,
        pageIndex,
        fontSize: Math.abs(item.transform?.[0]) || 10,
        fontName: item.fontName || '',
      });
    }

    return items;
  } catch (error) {
    console.error('Error extracting text from PDF page', pageIndex, ':', error);
    return [];
  }
}

// Extract ALL text from a PDF page as a single string (for regex parsing)
export async function extractFullPageText(
  pdfUrl: string,
  pageIndex: number
): Promise<string> {
  const texts = await extractTextFromPDF(pdfUrl, pageIndex);

  // Sort by Y (top to bottom) then X (left to right) to maintain reading order
  const sorted = [...texts].sort((a, b) => {
    const yDiff = b.y - a.y; // PDF Y is bottom-up, so reverse
    if (Math.abs(yDiff) > 5) return yDiff;
    return a.x - b.x;
  });

  // Group by approximate rows
  const rows: string[] = [];
  let currentRow: string[] = [];
  let lastY = sorted[0]?.y || 0;

  for (const item of sorted) {
    if (Math.abs(item.y - lastY) > 10) {
      if (currentRow.length > 0) {
        rows.push(currentRow.join(' '));
      }
      currentRow = [item.text];
      lastY = item.y;
    } else {
      currentRow.push(item.text);
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow.join(' '));
  }

  return rows.join('\n');
}

// Extract floor areas from text (e.g., "GF LIVING 136.37", "TOTAL 174.53m²", "OFFICE 7P 45.5m²")
// Includes both residential and commercial building patterns
export function extractFloorAreas(texts: ExtractedText[], pageIndex: number): ExtractedFloorArea[] {
  const areas: ExtractedFloorArea[] = [];
  const allText = texts.map(t => t.text).join(' ');
  const seen = new Set<string>();

  // Words that indicate it's NOT a room area (exclude these)
  const excludeKeywords = /roof|plan area|site|colorbond|single|double|storey|house|actual|building|coverage|setback|boundary|lot|block|structure/i;

  // Pattern 1: Residential format - "GF LIVING" or "BEDROOM 1" followed by number
  const residentialPattern = /\b((?:GF|FF|UF|GROUND|FIRST|UPPER|LOWER|UNIT\s*\d)?\s*(?:LIVING|BED(?:ROOM)?|BATH(?:ROOM)?|KITCHEN|GARAGE|CARPORT|ALFRESCO|BALCONY|DECK|OUTDOOR|VERANDAH|PERGOLA|PORCH|ENTRY|LOUNGE|DINING|STUDY|LAUNDRY|STORE|WIR|BIR|ENS(?:UITE)?|MEALS|FAMILY|RUMPUS|THEATRE|PANTRY|FOYER|HALL|NOOK|RETREAT|MASTER|GUEST|POWDER|TOILET|UTILITY|MUD|SCULLERY|WORKSHOP|MEDIA|GAMES|SITTING|PDR)(?:\s*\d)?)\s+(\d+\.?\d*)\s*(?:m²|m2|sqm)?/gi;

  // Pattern 2: Commercial format - "OFFICE 7P", "CORRIDOR", "MEETING ROOM 1" followed by area
  const commercialPattern = /\b((?:OFFICE|CORRIDOR|MEETING|CONFERENCE|BOARDROOM|RECEPTION|LOBBY|LIFT|STAIR|PLANT|AC\s*PLANT|COMMS|SERVER|ELECTRICAL|MECHANICAL|AMENITIES|BREAKOUT|KITCHENETTE|CLEANERS?|STORAGE|FIRE\s*STAIR|SERVICE\s*LIFT)(?:\s*(?:ROOM)?)?(?:\s*\d+)?[A-Z]?)\s+(\d+\.?\d*)\s*(?:m²|m2|sqm)?/gi;

  // Pattern 3: Room number format - "4.28A 45.5m²"
  const roomNumberPattern = /\b(\d+\.\d+[A-Z]?)\s+(\d+\.?\d*)\s*(?:m²|m2|sqm)/gi;

  // Pattern 4: Level-based format - "L4.28" or "G.01"
  const levelRoomPattern = /\b([GBLP]\d*\.\d+[A-Z]?)\s+(\d+\.?\d*)\s*(?:m²|m2|sqm)?/gi;

  let match;

  // Extract residential areas — key includes area so Unit 1/Unit 2 same-name rooms aren't deduped
  while ((match = residentialPattern.exec(allText)) !== null) {
    const name = match[1].trim().toUpperCase();
    const area = parseFloat(match[2]);

    if (area < 1 || area > 1500) continue;
    if (excludeKeywords.test(name)) continue;

    const key = `${name.replace(/\s+/g, ' ')}|${Math.round(area)}`;
    if (!seen.has(key)) {
      seen.add(key);
      areas.push({ name: name.replace(/\s+/g, ' '), area, unit: 'm²', pageIndex });
    }
  }

  // Extract commercial areas
  while ((match = commercialPattern.exec(allText)) !== null) {
    const name = match[1].trim().toUpperCase();
    const area = parseFloat(match[2]);

    if (area < 1 || area > 2000) continue; // Commercial can be larger
    if (excludeKeywords.test(name)) continue;

    const key = name.replace(/\s+/g, ' ');
    if (!seen.has(key)) {
      seen.add(key);
      areas.push({ name: key, area, unit: 'm²', pageIndex });
    }
  }

  // Extract room number areas (e.g., 4.28A 45.5)
  while ((match = roomNumberPattern.exec(allText)) !== null) {
    const name = `ROOM ${match[1].toUpperCase()}`;
    const area = parseFloat(match[2]);

    if (area < 1 || area > 500) continue;

    if (!seen.has(name)) {
      seen.add(name);
      areas.push({ name, area, unit: 'm²', pageIndex });
    }
  }

  // Extract level-based room areas (G.01, L1.05)
  while ((match = levelRoomPattern.exec(allText)) !== null) {
    const name = `ROOM ${match[1].toUpperCase()}`;
    const area = parseFloat(match[2]);

    if (area < 1 || area > 500) continue;

    if (!seen.has(name)) {
      seen.add(name);
      areas.push({ name, area, unit: 'm²', pageIndex });
    }
  }

  // Look for "TOTAL FLOOR AREA" or "NLA" (Net Lettable Area) for commercial
  const totalPattern = /\b(TOTAL\s+(?:FLOOR\s+)?AREA|TOTAL\s+GFA|NET\s+FLOOR|GROSS\s+FLOOR|NLA|GFA|NET\s+LETTABLE)\s*:?\s*(\d+\.?\d*)\s*(?:m²|m2|sqm)?/gi;
  while ((match = totalPattern.exec(allText)) !== null) {
    const name = 'TOTAL FLOOR AREA';
    const area = parseFloat(match[2]);

    // Commercial buildings can be much larger
    if (area >= 10 && area <= 50000 && !seen.has(name)) {
      seen.add(name);
      areas.push({ name, area, unit: 'm²', pageIndex });
    }
  }

  // Handle "TOTAL FLOOR AREA FOR UNIT 1 & 2 = 640.10 m2" format (duplex/multi-unit)
  const totalForUnitPattern = /TOTAL\s+FLOOR\s+AREA\s+FOR[^\n]{0,60}?(\d{3,}\.?\d*)\s*m[²2]/gi;
  while ((match = totalForUnitPattern.exec(allText)) !== null) {
    const name = 'TOTAL FLOOR AREA';
    const area = parseFloat(match[1]);
    if (area >= 100 && area <= 50000 && !seen.has(name)) {
      seen.add(name);
      areas.push({ name, area, unit: 'm²', pageIndex });
    }
  }

  // Sort: rooms by area descending, total at end
  return areas.sort((a, b) => {
    if (a.name.includes('TOTAL')) return 1;
    if (b.name.includes('TOTAL')) return -1;
    return b.area - a.area;
  });
}

// Parse window schedule table
export function parseWindowScheduleTable(texts: ExtractedText[], pageIndex: number): ExtractedScheduleRow[] {
  const windows: ExtractedScheduleRow[] = [];
  const allText = texts.map(t => t.text).join('\n');

  // Check if this page has a window schedule
  if (!/window\s*schedule/i.test(allText)) {
    return windows;
  }

  // Pattern for window entries: W01, W02, etc. with dimensions
  // Format: W01 820 x 1210 2100 1 FIG 1 6.38 LAMINATED ALUMINIUM
  const windowPattern = /W(\d{1,2})\s+(\d{3,4})\s*[xX×]\s*(\d{3,4})\s+(\d{4})?\s*(\d+)?/g;
  let match;

  while ((match = windowPattern.exec(allText)) !== null) {
    const ref = `W${match[1].padStart(2, '0')}`;
    const width = parseInt(match[2]);
    const height = parseInt(match[3]);
    const headHeight = match[4] ? parseInt(match[4]) : undefined;
    const qty = match[5] ? parseInt(match[5]) : 1;

    // Determine window type from size
    let windowType = 'Standard Window';
    if (width > 1500 || height > 1500) {
      windowType = 'Large Window';
    } else if (width > 2000) {
      windowType = 'Feature Window';
    }

    windows.push({
      type: 'window',
      reference: ref,
      description: `${windowType} ${width}x${height}mm`,
      size: `${width}x${height}`,
      width,
      height,
      quantity: qty,
      pageIndex,
    });
  }

  // Also try simpler pattern
  const simplePattern = /W(\d{1,2})[^\d]*(\d{3,4})\s*[xX×]\s*(\d{3,4})/g;
  while ((match = simplePattern.exec(allText)) !== null) {
    const ref = `W${match[1].padStart(2, '0')}`;
    if (!windows.find(w => w.reference === ref)) {
      windows.push({
        type: 'window',
        reference: ref,
        description: `Window ${match[2]}x${match[3]}mm`,
        size: `${match[2]}x${match[3]}`,
        width: parseInt(match[2]),
        height: parseInt(match[3]),
        quantity: 1,
        pageIndex,
      });
    }
  }

  return windows;
}

// Parse door schedule table
export function parseDoorScheduleTable(texts: ExtractedText[], pageIndex: number): ExtractedScheduleRow[] {
  const doors: ExtractedScheduleRow[] = [];
  const allText = texts.map(t => t.text).join('\n');

  // Check if this page has a door schedule
  if (!/door\s*schedule/i.test(allText)) {
    return doors;
  }

  // Pattern for door entries: D01, D02, etc.
  // Format: D01 2040 x 820 HINGED SOLID CORE LEVER SET
  const doorPattern = /D(\d{1,2})\s+(\d{3,4})\s*[xX×]\s*(\d{3,4})[^\n]*(HINGED|SLIDING|BIFOLD|PIVOT|CAVITY|ROLLER|SECTIONAL)?[^\n]*(SOLID\s*CORE|HOLLOW\s*CORE|FLUSH|GLAZED|PANEL|ROBES?)?/gi;
  let match;

  while ((match = doorPattern.exec(allText)) !== null) {
    const ref = `D${match[1].padStart(2, '0')}`;
    const height = parseInt(match[2]);
    const width = parseInt(match[3]);
    const doorStyle = match[4] || 'HINGED';
    const doorType = match[5] || '';

    // Determine if internal or external
    const isExternal = height > 2100 || width > 900 || /ENTRY|FRONT|EXTERNAL/i.test(allText.substring(match.index, match.index + 100));
    const isGarage = /GARAGE|SECTIONAL|ROLLER/i.test(doorStyle);

    let description = '';
    if (isGarage) {
      description = `Garage Door ${width}x${height}mm`;
    } else if (isExternal) {
      description = `External ${doorStyle} Door ${width}x${height}mm`;
    } else {
      description = `Internal ${doorStyle} ${doorType} Door ${width}x${height}mm`;
    }

    doors.push({
      type: 'door',
      reference: ref,
      description: description.replace(/\s+/g, ' ').trim(),
      size: `${width}x${height}`,
      width,
      height,
      quantity: 1,
      pageIndex,
    });
  }

  // Try simpler pattern for doors
  const simplePattern = /D(\d{1,2})[^\d]*(\d{3,4})\s*[xX×]\s*(\d{3,4})/g;
  while ((match = simplePattern.exec(allText)) !== null) {
    const ref = `D${match[1].padStart(2, '0')}`;
    if (!doors.find(d => d.reference === ref)) {
      doors.push({
        type: 'door',
        reference: ref,
        description: `Door ${match[2]}x${match[3]}mm`,
        size: `${match[2]}x${match[3]}`,
        width: parseInt(match[3]),
        height: parseInt(match[2]),
        quantity: 1,
        pageIndex,
      });
    }
  }

  return doors;
}

// Count symbol references on a page (W01, D01, GPO, etc.)
export function countSymbolReferences(texts: ExtractedText[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const allText = texts.map(t => t.text).join(' ');

  // Window references
  const windowRefs = allText.match(/\bW\d{1,2}\b/g) || [];
  counts['windows'] = new Set(windowRefs).size;

  // Door references
  const doorRefs = allText.match(/\bD\d{1,2}\b/g) || [];
  counts['doors'] = new Set(doorRefs).size;

  // Electrical
  counts['GPO'] = (allText.match(/\bGPO\b/gi) || []).length;
  counts['DGPO'] = (allText.match(/\bDGPO\b/gi) || []).length;
  counts['powerPoints'] = counts['GPO'] + (counts['DGPO'] * 2);

  // Lights
  counts['lights'] = (allText.match(/\b(LED|DL|DOWNLIGHT|LIGHT|LP)\b/gi) || []).length;

  // Switches
  counts['switches'] = (allText.match(/\bSW\b/gi) || []).length;

  // Smoke detectors
  counts['smokeDetectors'] = (allText.match(/\b(SD|SMOKE)\b/gi) || []).length;

  // Exhaust fans
  counts['exhaustFans'] = (allText.match(/\b(EF|EXHAUST)\b/gi) || []).length;

  // Plumbing fixtures - look for symbols
  counts['toilets'] = (allText.match(/\bWC\b/gi) || []).length;
  counts['basins'] = (allText.match(/\b(BASIN|VANITY)\b/gi) || []).length;
  counts['showers'] = (allText.match(/\b(SHR|SHOWER)\b/gi) || []).length;

  return counts;
}

// Parse dimension value from string to mm
function parseDimensionToMM(text: string): { value: number; unit: string } | null {
  const trimmed = text.trim().replace(/,/g, '');

  // Australian drawings typically use mm (no decimal point for mm, with decimal for m)
  // Pattern: 5000 (mm), 21,888 (mm), 2.400 (m), 12.480 (m)

  // Check for metric with decimal (likely meters)
  const metersMatch = trimmed.match(/^(\d+)[.,](\d{3})$/);
  if (metersMatch) {
    // Format like "2.400" or "12.480" = meters
    const meters = parseFloat(`${metersMatch[1]}.${metersMatch[2]}`);
    return { value: meters * 1000, unit: 'mm' };
  }

  // Check for explicit unit
  const withUnitMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m)$/i);
  if (withUnitMatch) {
    const num = parseFloat(withUnitMatch[1].replace(',', '.'));
    const unit = withUnitMatch[2].toLowerCase();
    if (unit === 'm') return { value: num * 1000, unit: 'mm' };
    if (unit === 'cm') return { value: num * 10, unit: 'mm' };
    return { value: num, unit: 'mm' };
  }

  // Plain number - assume mm if > 100, otherwise could be m
  const plainMatch = trimmed.match(/^(\d+)$/);
  if (plainMatch) {
    const num = parseInt(plainMatch[1], 10);
    // Numbers 100-50000 are likely mm (100mm to 50m)
    if (num >= 100 && num <= 50000) {
      return { value: num, unit: 'mm' };
    }
  }

  // Imperial format (rare in Australia but possible)
  const imperialMatch = trimmed.match(/^(\d+)[''][-–]?(\d+)[""]?$/);
  if (imperialMatch) {
    const feet = parseInt(imperialMatch[1], 10);
    const inches = parseInt(imperialMatch[2], 10);
    return { value: (feet * 12 + inches) * 25.4, unit: 'mm' };
  }

  return null;
}

// Find dimension annotations (e.g., "5000", "2.400", "21,888", "10'-6"")
export function findDimensions(texts: ExtractedText[]): ExtractedElement[] {
  // Pattern for dimensions: numbers with optional units
  const dimensionPatterns = [
    /^(\d+(?:[.,]\d+)?)\s*(mm|cm|m|'|"|ft|in)?$/i, // Simple: "5000", "2.5m"
    /^(\d+)['']?\s*[-–]\s*(\d+)[""]?$/i, // Imperial: "10'-6"", "10-6"
    /^(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?$/i, // Dimensions: "900x600"
    /^\d{1,2}[.,]\d{3}$/, // Format like "2.400" or "21.888" for meters with mm precision
    /^\d{3,5}$/, // Plain numbers 100-99999 (likely mm)
  ];

  return texts
    .filter(t => {
      const trimmed = t.text.trim();
      if (trimmed.length < 2 || trimmed.length > 15) return false;
      return dimensionPatterns.some(pattern => pattern.test(trimmed));
    })
    .map(t => {
      const parsed = parseDimensionToMM(t.text.trim());
      return {
        type: 'dimension' as const,
        content: t.text.trim(),
        bounds: { x: t.x, y: t.y, width: t.width, height: t.height },
        pageIndex: t.pageIndex,
        confidence: 0.9,
        value: parsed?.value,
        unit: parsed?.unit,
      };
    });
}

// Find room labels (kitchen, bathroom, bedroom, etc.)
export function findRoomLabels(texts: ExtractedText[]): ExtractedElement[] {
  // Keywords to match directly - includes residential AND commercial building terms
  const roomKeywords = [
    // Residential
    'kitchen', 'bathroom', 'bedroom', 'living', 'dining', 'laundry',
    'garage', 'patio', 'balcony', 'hall', 'hallway', 'entry', 'foyer',
    'store', 'storage', 'ensuite', 'wc', 'toilet', 'powder',
    'bath', 'bed', 'lounge', 'study', 'rumpus', 'family', 'meals',
    'alfresco', 'theatre', 'pantry', 'scullery', 'mud', 'walk-in',
    'wardrobe', 'robe', 'wir', 'bir', 'master', 'guest', 'utility',
    'porch', 'ens', 'l\'dry', 'ldry', 'mpl', 'mpd', 'nook', 'retreat',

    // Commercial / Office buildings
    'office', 'corridor', 'lobby', 'reception', 'meeting', 'conference',
    'boardroom', 'breakout', 'break room', 'cafeteria', 'canteen',
    'server', 'comms', 'communications', 'electrical', 'mechanical',
    'plant', 'plant room', 'ac plant', 'hvac', 'lift', 'elevator',
    'stair', 'stairwell', 'fire stair', 'loading', 'dock', 'dock leveller',
    'amenities', 'changeroom', 'change room', 'locker', 'shower',
    'cleaners', 'cleaner', 'waste', 'bin', 'garbage', 'refuse',
    'mailroom', 'mail room', 'copy', 'print', 'filing', 'archive',
    'training', 'interview', 'quiet', 'focus', 'collaboration',
    'open plan', 'workstation', 'hot desk', 'booth', 'phone booth',
    'kitchenette', 'tea room', 'staff', 'waiting', 'ante',

    // Industrial / Warehouse
    'warehouse', 'workshop', 'factory', 'production', 'assembly',
    'dispatch', 'receiving', 'staging', 'coolroom', 'cold store',
    'freezer', 'dry store', 'bulk store', 'dangerous goods', 'dg store',

    // Healthcare
    'consult', 'treatment', 'procedure', 'recovery', 'ward',
    'nurses', 'station', 'pharmacy', 'pathology', 'radiology',

    // Retail
    'retail', 'sales', 'display', 'fitting', 'cashier', 'pos',

    // Service areas
    'service', 'services', 'riser', 'duct', 'shaft', 'void',
    'ceiling void', 'floor void', 'plenum', 'bulkhead', 'soffit'
  ];

  // Patterns for numbered rooms (BED 1, BATH 2, OFFICE 3P, etc.)
  const roomPatterns = [
    /^bed\s*\d+$/i,
    /^bath\s*\d+$/i,
    /^bedroom\s*\d+$/i,
    /^bathroom\s*\d+$/i,
    /^ens\s*\d*$/i,
    /^wc\s*\d*$/i,
    /^garage\s*\d*$/i,
    /^store\s*\d*$/i,
    /^robe\s*\d*$/i,
    // Commercial patterns
    /^office\s*\d+[a-z]?$/i,        // OFFICE 1, OFFICE 7P
    /^meeting\s*\d+$/i,              // MEETING 1
    /^conference\s*\d+$/i,           // CONFERENCE 1
    /^corridor\s*\d*$/i,             // CORRIDOR, CORRIDOR 1
    /^lift\s*\d*$/i,                 // LIFT, LIFT 1
    /^stair\s*\d*$/i,                // STAIR, STAIR 1
    /^level\s*\d+$/i,                // LEVEL 1, LEVEL 2
    /^floor\s*\d+$/i,                // FLOOR 1
    /^zone\s*\d+$/i,                 // ZONE 1
    /^area\s*\d+$/i,                 // AREA 1
    // Room number patterns (e.g., 4.28A, G.01) — require letter suffix to avoid matching dimension values like 3.400
    /^\d{1,2}\.\d{2}[a-z]$/i,        // 4.28A, 1.05B (letter suffix required)
    /^[gbl]\d*\.\d+[a-z]?$/i,        // G.01, B.02, L1.05 (Ground, Basement, Level)
    /^rm\s*\d+$/i,                   // RM 1, RM 101
    /^room\s*\d+$/i,                 // ROOM 1
    // Service room patterns
    /^service\s*lift$/i,             // SERVICE LIFT
    /^fire\s*stair$/i,               // FIRE STAIR
    /^plant\s*room$/i,               // PLANT ROOM
    /^ac\s*plant$/i,                 // AC PLANT
    /^comms\s*room$/i,               // COMMS ROOM
  ];

  return texts
    .filter(t => {
      const text = t.text.trim();
      const lower = text.toLowerCase();
      // Skip if too long (room labels are short) or too short
      if (lower.length > 30 || lower.length < 2) return false;
      // Skip annotation/note prefixes
      if (/^\d+[.)]\s/.test(text)) return false;        // "2. WRITTEN..." or "1) NOTE..."
      if (/^[-©*•]/.test(text)) return false;           // "- NOTE..." or "© 2023..."
      // Skip strings with technical metadata keywords
      if (/posi[\s-]?strut|ncc\s*\d|rpeq|gspublish|version\s*\d/i.test(text)) return false;
      // Check keywords
      if (roomKeywords.some(k => lower.includes(k))) return true;
      // Check patterns for numbered rooms
      if (roomPatterns.some(p => p.test(lower))) return true;
      return false;
    })
    .map(t => ({
      type: 'room_label' as const,
      content: t.text.trim(),
      bounds: { x: t.x, y: t.y, width: t.width, height: t.height },
      pageIndex: t.pageIndex,
      confidence: 0.85,
    }));
}

// Find door/window tags on floor plans (D1, D2, W01, W02 labels near symbols)
export function findDoorWindowTags(texts: ExtractedText[]): ExtractedElement[] {
  // Patterns for door/window tags - these are short labels like D1, D2, W01, W02
  const tagPatterns = [
    /^D\d{1,2}$/i,     // D1, D2, D10
    /^W\d{1,2}$/i,     // W1, W2, W10
    /^D0\d$/i,         // D01, D02
    /^W0\d$/i,         // W01, W02
    /^D-\d{1,2}$/i,    // D-1, D-01 (dash format)
    /^W-\d{1,2}$/i,    // W-1, W-01 (dash format)
    /^SD\d{1,2}$/i,    // SD1 (sliding door)
    /^PD\d{1,2}$/i,    // PD1 (pivot door)
    /^BFD\d{1,2}$/i,   // BFD1 (bifold door)
    /^AW\d{1,2}$/i,    // AW1 (awning window)
    /^FW\d{1,2}$/i,    // FW1 (fixed window)
    /^DG\d{1,2}$/i,    // DG1 (double-glazed)
    /^CW\d{1,2}$/i,    // CW1 (cavity window)
    /^GL\d{1,2}$/i,    // GL1 (glazing panel)
  ];

  return texts
    .filter(t => {
      const trimmed = t.text.trim();
      // Must be short (tag-like) — allow up to 6 chars for BFD01
      if (trimmed.length < 2 || trimmed.length > 6) return false;
      return tagPatterns.some(p => p.test(trimmed));
    })
    .map(t => {
      const text = t.text.trim().toUpperCase();
      const isDoor = text.startsWith('D') || text.startsWith('SD') || text.startsWith('PD') || text.startsWith('BFD');
      return {
        type: (isDoor ? 'door' : 'window') as 'door' | 'window',
        content: text,
        bounds: { x: t.x, y: t.y, width: t.width, height: t.height },
        pageIndex: t.pageIndex,
        confidence: 0.9,
      };
    });
}

// Find floor finish labels (TILES, CARPET, HYBRID FLOOR, CONCRETE, etc.)
export function findFloorFinishes(texts: ExtractedText[]): ExtractedElement[] {
  const finishKeywords = [
    'tiles', 'tile', 'carpet', 'vinyl', 'timber', 'hardwood', 'laminate',
    'concrete', 'polished', 'hybrid', 'floor', 'flooring', 'aggregate',
    'exposed', 'screed', 'render', 'paving', 'pavers', 'slate', 'marble',
    'granite', 'terrazzo', 'epoxy', 'linoleum', 'cork', 'bamboo'
  ];

  // Patterns for specific finishes
  const finishPatterns = [
    /hybrid\s*floor/i,
    /tiles?\s*floor/i,
    /timber\s*floor/i,
    /exposed\s*aggregate/i,
    /polished\s*concrete/i,
  ];

  return texts
    .filter(t => {
      const lower = t.text.toLowerCase().trim();
      if (lower.length > 50 || lower.length < 3) return false;
      // Check patterns first
      if (finishPatterns.some(p => p.test(lower))) return true;
      // Check keywords
      return finishKeywords.some(k => lower.includes(k));
    })
    .map(t => ({
      type: 'annotation' as const, // Floor finishes categorized as annotations
      content: t.text.trim(),
      bounds: { x: t.x, y: t.y, width: t.width, height: t.height },
      pageIndex: t.pageIndex,
      confidence: 0.8,
    }));
}

// Find annotations (notes, specifications, etc.)
export function findAnnotations(texts: ExtractedText[]): ExtractedElement[] {
  const annotationKeywords = [
    'note', 'nts', 'typical', 'verify', 'refer', 'see', 'detail',
    'section', 'elevation', 'plan', 'spec', 'finish', 'install',
    'existing', 'proposed', 'new', 'remove', 'demolish', 'ffl', 'ssl'
  ];

  return texts
    .filter(t => {
      const lower = t.text.toLowerCase().trim();
      return annotationKeywords.some(k => lower.includes(k)) &&
             lower.length > 3 &&
             lower.length < 100;
    })
    .map(t => ({
      type: 'annotation' as const,
      content: t.text.trim(),
      bounds: { x: t.x, y: t.y, width: t.width, height: t.height },
      pageIndex: t.pageIndex,
      confidence: 0.7,
    }));
}

// Extract all elements from a PDF page
export async function extractAllElements(
  pdfUrl: string,
  pageIndex: number
): Promise<ExtractedElement[]> {
  const texts = await extractTextFromPDF(pdfUrl, pageIndex);

  const dimensions = findDimensions(texts);
  const roomLabels = findRoomLabels(texts);
  const floorFinishes = findFloorFinishes(texts);
  const annotations = findAnnotations(texts);

  // Deduplicate by position and content
  const seen = new Set<string>();
  const all = [...dimensions, ...roomLabels, ...floorFinishes, ...annotations];

  return all.filter(el => {
    const key = `${el.bounds.x.toFixed(0)}-${el.bounds.y.toFixed(0)}-${el.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── MULTI-PAGE OPENING DETECTION ────────────────────────────────────────────

/** A window or door detected from the plan (merged from floor-plan tags + schedule rows). */
export interface DetectedOpening {
  ref: string;           // W01, D03, SD1
  type: 'window' | 'door';
  width?: number;        // mm
  height?: number;       // mm
  page: number;          // 0-indexed page where the tag was found on the floor plan
  x: number;            // PDF coordinate x of the tag
  y: number;            // PDF coordinate y of the tag
  confidence: number;   // 0–1
  source: 'floor_plan' | 'schedule' | 'merged';
  description?: string; // e.g. "Sliding Door 820×2100mm"
}

/**
 * Robust schedule parser — works on ANY page text (doesn't require "window schedule" header).
 * Matches patterns like: W01 820 x 1210, W-01 900×2100, D01 2040 x 820
 */
export function parseOpeningScheduleRobust(
  allText: string,
  type: 'window' | 'door',
  pageIndex: number,
): ExtractedScheduleRow[] {
  const results: ExtractedScheduleRow[] = [];
  const prefix = type === 'window' ? 'W' : 'D';
  const seen = new Set<string>();

  // Match: prefix + optional dash/space + 1-2 digits, then within 30 chars: NNN x NNN
  const pattern = new RegExp(
    `\\b${prefix}[-\\s]?(\\d{1,2})\\b[^\\n]{0,30}?(\\d{3,4})\\s*[xX×*]\\s*(\\d{3,4})`,
    'gi',
  );

  let match;
  while ((match = pattern.exec(allText)) !== null) {
    const ref = `${prefix}${match[1].padStart(2, '0')}`;
    if (seen.has(ref)) continue;
    seen.add(ref);

    const n1 = parseInt(match[2]);
    const n2 = parseInt(match[3]);

    // Door dims in AU drawings are often stated HEIGHT × WIDTH; height > 1500 is a giveaway
    let width: number, height: number;
    if (type === 'door' && n1 > 1500) {
      height = n1; width = n2;
    } else {
      width = n1; height = n2;
    }

    results.push({
      type,
      reference: ref,
      description: `${type === 'window' ? 'Window' : 'Door'} ${width}×${height}mm`,
      size: `${width}×${height}`,
      width,
      height,
      quantity: 1,
      pageIndex,
    });
  }

  return results;
}

/**
 * Scan every page of a PDF to build a merged list of detected openings.
 * Combines floor-plan tag positions with schedule dimension data.
 */
export async function extractOpeningsAllPages(
  pdfUrl: string,
  totalPages: number,
  onProgress?: (completedPages: number) => void,
): Promise<DetectedOpening[]> {
  const tagMap      = new Map<string, DetectedOpening>();
  const scheduleMap = new Map<string, ExtractedScheduleRow>();

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const texts   = await extractTextFromPDF(pdfUrl, pageIdx);
    const allText = texts.map(t => t.text).join('\n');

    // Floor-plan tags → position data
    const tags = findDoorWindowTags(texts);
    for (const tag of tags) {
      const ref = tag.content;
      if (!tagMap.has(ref)) {
        tagMap.set(ref, {
          ref,
          type: tag.type as 'window' | 'door',
          page: pageIdx,
          x: tag.bounds.x,
          y: tag.bounds.y,
          confidence: tag.confidence ?? 0.8,
          source: 'floor_plan',
        });
      }
    }

    // Schedule rows (any page) → dimension data
    const windowRows = parseOpeningScheduleRobust(allText, 'window', pageIdx);
    const doorRows   = parseOpeningScheduleRobust(allText, 'door',   pageIdx);
    for (const row of [...windowRows, ...doorRows]) {
      if (!scheduleMap.has(row.reference)) scheduleMap.set(row.reference, row);
    }

    onProgress?.(pageIdx + 1);
  }

  // Merge: tag position + schedule dimensions
  const allRefs = new Set([...tagMap.keys(), ...scheduleMap.keys()]);
  const result: DetectedOpening[] = [];

  for (const ref of allRefs) {
    const tag      = tagMap.get(ref);
    const schedule = scheduleMap.get(ref);

    if (tag && schedule) {
      result.push({ ...tag, width: schedule.width, height: schedule.height, confidence: 0.95, source: 'merged', description: schedule.description });
    } else if (tag) {
      result.push(tag);
    } else if (schedule) {
      result.push({
        ref: schedule.reference,
        type: schedule.type as 'window' | 'door',
        width: schedule.width,
        height: schedule.height,
        page: schedule.pageIndex,
        x: 0, y: 0,
        confidence: 0.65,
        source: 'schedule',
        description: schedule.description,
      });
    }
  }

  return result.sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
}

// ─── BUILDING CONTEXT DETECTION ──────────────────────────────────────────────

export interface BuildingContext {
  isDuplex: boolean;
  unitCount: number;
  isMultiStorey: boolean;
  storeyCount: number;
  hasPool: boolean;
  hasCarport: boolean;
  hasEngineeredTimber: boolean;
  hasLouvreWindows: boolean;
  hasFeatureWeatherboard: boolean;
  hasAluminiumBattens: boolean;
  hasRender: boolean;
  hasBreezeBlock: boolean;
  groundFloorArea: number;
  firstFloorArea: number;
  totalGrossArea: number;
}

/**
 * Scan all page text content to determine building type, storeys, pool, materials, etc.
 * Called once per analysis run with all pages' textContent concatenated.
 */
export function extractBuildingContext(allPageTexts: string[]): BuildingContext {
  const fullText = allPageTexts.join('\n');
  const upper = fullText.toUpperCase();

  // Duplex / multi-unit detection
  const isDuplex = /DUPLEX|DUAL\s*OCC(?:UPANCY)?|\bUNIT\s+[12]\b|\bUNIT\s+ONE\b|\bUNIT\s+TWO\b/i.test(fullText);
  const unitMatches = upper.match(/\bUNIT\s+(\d+)\b/g) || [];
  const unitNumbers = new Set(unitMatches.map(m => m.replace(/\D/g, '')));
  const unitCount = isDuplex ? Math.max(2, unitNumbers.size) : 1;

  // Multi-storey detection
  const isMultiStorey = /FIRST\s*FLOOR|FF\s*(?:FLOOR|PLAN)|UPPER\s*FLOOR|LEVEL\s*[12]|2\s*STOREY|TWO\s*STOREY|\bFF\b/i.test(fullText);
  const storeyCount = isMultiStorey ? 2 : 1;

  // Pool
  const hasPool = /SWIM(?:MING)?\s*POOL|POOL\s*FENCE|POOL\s*AREA|INGROUND\s*POOL|CONCRETE\s*POOL/i.test(fullText);

  // Carport
  const hasCarport = /CARPORT/i.test(fullText);

  // Floor coverings
  const hasEngineeredTimber = /ENGINEERED\s*TIMBER|TIMBER\s*FLOOR(?:ING)?|HARDWOOD\s*FLOOR|HYBRID\s*FLOOR/i.test(fullText);

  // Window types
  const hasLouvreWindows = /LOUV(?:RE|ER)\s*WINDOW|LOUVRE/i.test(fullText);

  // Cladding types
  const hasFeatureWeatherboard = /LINEA|WEATHERTEX|JAMES\s*HARDIE|HARDIPLANK|WEATHERBOARD/i.test(fullText);
  const hasAluminiumBattens = /KNOTWOOD|ALUM(?:INIUM)?\s*BATTEN|FEATURE\s*BATTEN/i.test(fullText);
  const hasRender = /RENDER(?:ED|ING)?|ACRYLIC\s*RENDER|TEXTURE\s*COAT/i.test(fullText);
  const hasBreezeBlock = /BREEZE\s*BLOCK|BESSER\s*BLOCK|DECORATIVE\s*BLOCK/i.test(fullText);

  // Extract floor areas from all text — sum ground and first floor separately
  let groundFloorArea = 0;
  let firstFloorArea = 0;

  // Ground floor patterns
  const gfPattern = /\b(?:GF|GROUND\s*FLOOR|GROUND\s*LEVEL)?\s*(?:LIVING|GARAGE|ALFRESCO|OUTDOOR|DECK|BALCONY|CARPORT|PORCH|KITCHEN|DINING|LOUNGE|FAMILY|MEALS|ENTRY|FOYER)\s+(\d+\.?\d*)\s*(?:m²|m2)?/gi;
  let m;
  while ((m = gfPattern.exec(fullText)) !== null) {
    const val = parseFloat(m[1]);
    if (val > 1 && val < 500) groundFloorArea += val;
  }

  // First floor patterns
  const ffPattern = /\b(?:FF|FIRST\s*FLOOR|UPPER\s*FLOOR|UPPER\s*LEVEL)\s*(?:LIVING|BED(?:ROOM)?|BATH(?:ROOM)?|ENSUITE|ROBE|STUDY|SITTING|RETREAT|HALL|BALCONY|LANDING)?\s+(\d+\.?\d*)\s*(?:m²|m2)?/gi;
  while ((m = ffPattern.exec(fullText)) !== null) {
    const val = parseFloat(m[1]);
    if (val > 1 && val < 500) firstFloorArea += val;
  }

  const totalGrossArea = groundFloorArea + firstFloorArea;

  return {
    isDuplex, unitCount, isMultiStorey, storeyCount,
    hasPool, hasCarport,
    hasEngineeredTimber, hasLouvreWindows,
    hasFeatureWeatherboard, hasAluminiumBattens, hasRender, hasBreezeBlock,
    groundFloorArea, firstFloorArea, totalGrossArea,
  };
}

// Get element statistics for a page
export async function getPageElementStats(
  pdfUrl: string,
  pageIndex: number
): Promise<{ dimensions: number; roomLabels: number; annotations: number; total: number }> {
  const elements = await extractAllElements(pdfUrl, pageIndex);
  
  return {
    dimensions: elements.filter(e => e.type === 'dimension').length,
    roomLabels: elements.filter(e => e.type === 'room_label').length,
    annotations: elements.filter(e => e.type === 'annotation').length,
    total: elements.length,
  };
}
