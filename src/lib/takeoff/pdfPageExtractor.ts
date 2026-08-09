import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface ExtractedPage {
  pageIndex: number; // 0-based
  imageBase64: string;
  mediaType: 'image/jpeg';
  widthPx: number;
  heightPx: number;
}

export interface ExtractionResult {
  pages: ExtractedPage[];
  /** True when the PDF has no meaningful text layer (total chars < 100 across all pages). */
  isScanned: boolean;
}

// 1200px keeps A3/A1 construction plans readable for Claude while halving
// payload vs 1500px. Each image is ~80-150 KB at quality 0.80.
const MAX_WIDTH_PX = 1200;
// Per-batch 4.5 MB base64 ceiling — leaves headroom before Supabase's 6 MB limit.
const MAX_BATCH_BYTES = 4_500_000;

async function renderPage(
  doc: pdfjs.PDFDocumentProxy,
  pageIndex: number,
  quality: number
): Promise<ExtractedPage> {
  const page = await doc.getPage(pageIndex + 1);
  const naturalViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(MAX_WIDTH_PX / naturalViewport.width, 2.0);
  const viewport = page.getViewport({ scale });

  const offscreen = document.createElement('canvas');
  offscreen.width = Math.round(viewport.width);
  offscreen.height = Math.round(viewport.height);
  const ctx = offscreen.getContext('2d')!;

  // White background for scanned PDFs with transparency
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, offscreen.width, offscreen.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  const dataUrl = offscreen.toDataURL('image/jpeg', quality);
  const imageBase64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

  return {
    pageIndex,
    imageBase64,
    mediaType: 'image/jpeg',
    widthPx: offscreen.width,
    heightPx: offscreen.height,
  };
}

/**
 * Selects page indices prioritising floor plans (front) and schedules (back).
 */
function selectPageIndices(total: number, maxPages: number): number[] {
  if (total <= maxPages) {
    return Array.from({ length: total }, (_, i) => i);
  }
  // Take most of the budget from the front (floor plans, elevations)
  // and 3 from the end (door/window/finish schedules).
  const frontCount = Math.max(maxPages - 3, Math.ceil(maxPages * 0.85));
  const front = Array.from({ length: frontCount }, (_, i) => i);
  const back = [total - 3, total - 2, total - 1].filter(i => i >= frontCount);
  return [...new Set([...front, ...back])].slice(0, maxPages);
}

/**
 * Renders up to maxPages pages from a PDF for AI analysis.
 *
 * Default is 50 pages — the chunked caller in useAIPlanAnalysis splits these
 * into batches of CHUNK_SIZE before sending to the edge function.
 *
 * Automatically reduces JPEG quality if a rendered set exceeds MAX_BATCH_BYTES,
 * so individual batches stay under the Supabase 6 MB request limit.
 *
 * Returns an ExtractionResult that includes an isScanned flag — true when the
 * PDF has no meaningful text layer (total chars < 100 across sampled pages).
 */
export async function extractAnalysisPages(
  file: File,
  maxPages = 50
): Promise<ExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const indices = selectPageIndices(doc.numPages, maxPages);

  let pages = await Promise.all(indices.map(i => renderPage(doc, i, 0.80)));

  // If a full render is too large, drop quality — line drawings compress well at 0.62.
  const totalBytes = pages.reduce((sum, p) => sum + p.imageBase64.length, 0);
  if (totalBytes > MAX_BATCH_BYTES) {
    pages = await Promise.all(indices.map(i => renderPage(doc, i, 0.62)));
  }

  // Detect scanned PDFs by sampling text content from up to 5 pages.
  // If the total character count across sampled pages is < 100, the PDF has
  // no meaningful text layer and is treated as scanned/image-only.
  const sampleIndices = indices.slice(0, 5);
  let totalChars = 0;
  for (const i of sampleIndices) {
    try {
      const page = await doc.getPage(i + 1);
      const textContent = await page.getTextContent();
      totalChars += textContent.items.reduce(
        (sum, item) => sum + ((item as { str?: string }).str?.length ?? 0),
        0
      );
    } catch {
      // Ignore errors on individual pages — treat as no text
    }
  }
  const isScanned = totalChars < 100;

  return { pages, isScanned };
}
