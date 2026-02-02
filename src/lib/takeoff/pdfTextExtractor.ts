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

// Extract floor areas from text (e.g., "GF LIVING 136.37", "TOTAL 174.53m²")
// Strict extraction - only actual room floor areas from schedules/title blocks
export function extractFloorAreas(texts: ExtractedText[], pageIndex: number): ExtractedFloorArea[] {
  const areas: ExtractedFloorArea[] = [];
  const allText = texts.map(t => t.text).join(' ');
  const seen = new Set<string>();

  // STRICT room name keywords - must be actual rooms, not descriptions
  const roomKeywords = /^(living|bed|bath|kitchen|garage|alfresco|porch|entry|lounge|dining|study|office|laundry|store|wir|bir|ensuite|meals|family|rumpus|theatre|pantry|foyer|hall|nook|retreat|master|guest|powder|toilet|utility|mud|scullery)/i;

  // Words that indicate it's NOT a room area (exclude these)
  const excludeKeywords = /roof|plan area|site|colorbond|single|double|storey|house|actual|building|coverage|setback|boundary|lot|block|structure/i;

  // Only match specific floor area table formats
  // Pattern: "GF LIVING" or "BEDROOM 1" followed by number
  const strictRoomPattern = /\b((?:GF|FF|UF|GROUND|FIRST|UPPER|LOWER)?\s*(?:LIVING|BED(?:ROOM)?|BATH(?:ROOM)?|KITCHEN|GARAGE|ALFRESCO|PORCH|ENTRY|LOUNGE|DINING|STUDY|OFFICE|LAUNDRY|STORE|WIR|BIR|ENS(?:UITE)?|MEALS|FAMILY|RUMPUS|THEATRE|PANTRY|FOYER|HALL|NOOK|RETREAT|MASTER|GUEST|POWDER|TOILET|UTILITY|MUD|SCULLERY)(?:\s*\d)?)\s+(\d+\.\d{1,2})/gi;

  let match;
  while ((match = strictRoomPattern.exec(allText)) !== null) {
    const name = match[1].trim().toUpperCase();
    const area = parseFloat(match[2]);

    // Skip if area is unrealistic for a room (< 2m² or > 200m²)
    if (area < 2 || area > 200) continue;

    // Skip if contains exclude keywords
    if (excludeKeywords.test(name)) continue;

    const key = name.replace(/\s+/g, ' ');
    if (!seen.has(key)) {
      seen.add(key);
      areas.push({
        name: key,
        area,
        unit: 'm²',
        pageIndex,
      });
    }
  }

  // Also look for "TOTAL FLOOR AREA" or "TOTAL AREA" specifically (not ROOF AREA, PLAN AREA)
  const totalPattern = /\b(TOTAL\s+(?:FLOOR\s+)?AREA|TOTAL\s+GFA|NET\s+FLOOR|GROSS\s+FLOOR)\s*:?\s*(\d+\.\d{1,2})/gi;
  while ((match = totalPattern.exec(allText)) !== null) {
    const name = 'TOTAL FLOOR AREA';
    const area = parseFloat(match[2]);

    // Total should be between 50-800m² for a typical house
    if (area >= 50 && area <= 800 && !seen.has(name)) {
      seen.add(name);
      areas.push({
        name,
        area,
        unit: 'm²',
        pageIndex,
      });
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
  // Keywords to match directly
  const roomKeywords = [
    'kitchen', 'bathroom', 'bedroom', 'living', 'dining', 'laundry',
    'garage', 'patio', 'balcony', 'hall', 'hallway', 'entry', 'foyer',
    'office', 'store', 'storage', 'ensuite', 'wc', 'toilet', 'powder',
    'bath', 'bed', 'lounge', 'study', 'rumpus', 'family', 'meals',
    'alfresco', 'theatre', 'pantry', 'scullery', 'mud', 'walk-in',
    'wardrobe', 'robe', 'wir', 'bir', 'master', 'guest', 'utility',
    'porch', 'ens', 'l\'dry', 'ldry', 'mpl', 'mpd', 'nook', 'retreat'
  ];

  // Patterns for numbered rooms (BED 1, BATH 2, etc.)
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
  ];

  return texts
    .filter(t => {
      const lower = t.text.toLowerCase().trim();
      // Skip if too long (not a room label)
      if (lower.length > 50 || lower.length < 2) return false;
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
    /^SD\d{1,2}$/i,    // SD1 (sliding door)
    /^PD\d{1,2}$/i,    // PD1 (pivot door)
    /^BFD\d{1,2}$/i,   // BFD1 (bifold door)
    /^AW\d{1,2}$/i,    // AW1 (awning window)
    /^FW\d{1,2}$/i,    // FW1 (fixed window)
  ];

  return texts
    .filter(t => {
      const trimmed = t.text.trim();
      // Must be short (tag-like)
      if (trimmed.length < 2 || trimmed.length > 5) return false;
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
