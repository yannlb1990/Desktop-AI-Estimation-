import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface ExtractedPage {
  pageIndex: number; // 0-based
  imageBase64: string;
  mediaType: 'image/jpeg';
  widthPx: number;
  heightPx: number;
}

const MAX_WIDTH_PX = 1500;
const JPEG_QUALITY = 0.88;

async function renderPage(
  doc: pdfjs.PDFDocumentProxy,
  pageIndex: number
): Promise<ExtractedPage> {
  const page = await doc.getPage(pageIndex + 1);
  const naturalViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(MAX_WIDTH_PX / naturalViewport.width, 2.5);
  const viewport = page.getViewport({ scale });

  const offscreen = document.createElement('canvas');
  offscreen.width = Math.round(viewport.width);
  offscreen.height = Math.round(viewport.height);
  const ctx = offscreen.getContext('2d')!;

  // White background for scanned PDFs with transparency
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, offscreen.width, offscreen.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const dataUrl = offscreen.toDataURL('image/jpeg', JPEG_QUALITY);
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
 * Renders selected pages from a File as clean JPEG images (no canvas overlays).
 * Selects up to maxPages most analysis-relevant pages:
 *   - For ≤ maxPages pages: all pages
 *   - For > maxPages pages: first 8 pages + last 2 (schedules often at the end)
 */
export async function extractAnalysisPages(
  file: File,
  maxPages = 12
): Promise<ExtractedPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const total = doc.numPages;

  let indices: number[];

  if (total <= maxPages) {
    indices = Array.from({ length: total }, (_, i) => i);
  } else {
    // First 8 pages cover ground floor, upper floor, elevations, site plan
    const firstBatch = Array.from({ length: Math.min(8, maxPages - 2) }, (_, i) => i);
    // Last 2 pages often contain door/window schedules or finish schedules
    const lastBatch = [total - 2, total - 1].filter(i => i >= 8);
    indices = [...new Set([...firstBatch, ...lastBatch])].slice(0, maxPages);
  }

  const pages = await Promise.all(indices.map((i) => renderPage(doc, i)));
  return pages;
}
