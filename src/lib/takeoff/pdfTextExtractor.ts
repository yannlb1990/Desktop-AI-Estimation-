// PDF Text Extraction Utility for extracting dimensions and room labels from architectural plans
import * as pdfjs from 'pdfjs-dist';

export interface ExtractedText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

export interface ExtractedElement {
  type: 'text' | 'dimension' | 'room_label' | 'annotation';
  content: string;
  bounds: { x: number; y: number; width: number; height: number };
  pageIndex: number;
  confidence?: number;
}

// Extract all text items from a PDF page
export async function extractTextFromPDF(
  pdfUrl: string,
  pageIndex: number
): Promise<ExtractedText[]> {
  try {
    const pdf = await pdfjs.getDocument(pdfUrl).promise;
    const page = await pdf.getPage(pageIndex + 1);
    const textContent = await page.getTextContent();

    return textContent.items
      .filter((item: any) => item.str && item.str.trim())
      .map((item: any) => ({
        text: item.str,
        x: item.transform?.[4] || 0,
        y: item.transform?.[5] || 0,
        width: item.width || 0,
        height: item.height || 0,
        pageIndex,
      }));
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return [];
  }
}

// Find dimension annotations (e.g., "5000", "2.5m", "10'-6"")
export function findDimensions(texts: ExtractedText[]): ExtractedElement[] {
  // Pattern for dimensions: numbers with optional units
  const dimensionPatterns = [
    /^(\d+(?:[.,]\d+)?)\s*(mm|cm|m|'|"|ft|in)?$/i, // Simple: "5000", "2.5m"
    /^(\d+)['']?\s*[-–]\s*(\d+)[""]?$/i, // Imperial: "10'-6"", "10-6"
    /^(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?$/i, // Dimensions: "900x600"
  ];

  return texts
    .filter(t => {
      const trimmed = t.text.trim();
      return dimensionPatterns.some(pattern => pattern.test(trimmed));
    })
    .map(t => ({
      type: 'dimension' as const,
      content: t.text.trim(),
      bounds: { x: t.x, y: t.y, width: t.width, height: t.height },
      pageIndex: t.pageIndex,
      confidence: 0.9,
    }));
}

// Find room labels (kitchen, bathroom, bedroom, etc.)
export function findRoomLabels(texts: ExtractedText[]): ExtractedElement[] {
  const roomKeywords = [
    'kitchen', 'bathroom', 'bedroom', 'living', 'dining', 'laundry',
    'garage', 'patio', 'balcony', 'hall', 'hallway', 'entry', 'foyer',
    'office', 'store', 'storage', 'ensuite', 'wc', 'toilet', 'powder',
    'bath', 'bed', 'lounge', 'study', 'rumpus', 'family', 'meals',
    'alfresco', 'theatre', 'pantry', 'scullery', 'mud', 'walk-in',
    'wardrobe', 'robe', 'wir', 'bir', 'master', 'guest', 'utility'
  ];

  return texts
    .filter(t => {
      const lower = t.text.toLowerCase().trim();
      return roomKeywords.some(k => lower.includes(k)) && lower.length < 50;
    })
    .map(t => ({
      type: 'room_label' as const,
      content: t.text.trim(),
      bounds: { x: t.x, y: t.y, width: t.width, height: t.height },
      pageIndex: t.pageIndex,
      confidence: 0.85,
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
  const annotations = findAnnotations(texts);

  // Deduplicate by position
  const seen = new Set<string>();
  const all = [...dimensions, ...roomLabels, ...annotations];
  
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
