// PDF Service - Centralized PDF loading and text extraction
// Ensures consistent PDF handling across the application

import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker once
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface PDFLoadResult {
  document: pdfjs.PDFDocumentProxy;
  pageCount: number;
  pageDimensions: Record<number, { width: number; height: number }>;
}

export interface ExtractedTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

// Cache for loaded PDFs to prevent re-loading
const pdfCache = new Map<string, PDFLoadResult>();

/**
 * Generate a cache key from an ArrayBuffer
 */
function generateCacheKey(data: ArrayBuffer): string {
  // Use first 1000 bytes + length as a simple hash
  const view = new Uint8Array(data.slice(0, 1000));
  let hash = data.byteLength;
  for (let i = 0; i < view.length; i++) {
    hash = ((hash << 5) - hash) + view[i];
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `pdf_${hash}_${data.byteLength}`;
}

/**
 * Load PDF from ArrayBuffer with caching
 */
export async function loadPDFFromArrayBuffer(data: ArrayBuffer): Promise<PDFLoadResult> {
  if (!data || data.byteLength === 0) {
    throw new Error('Invalid PDF data: ArrayBuffer is empty or undefined');
  }

  const cacheKey = generateCacheKey(data);

  // Check cache first
  const cached = pdfCache.get(cacheKey);
  if (cached) {
    console.log('[PDFService] Using cached PDF document');
    return cached;
  }

  console.log(`[PDFService] Loading PDF from ArrayBuffer (${(data.byteLength / 1024 / 1024).toFixed(2)} MB)`);

  try {
    // Clone the ArrayBuffer to prevent detached buffer issues
    const dataCopy = data.slice(0);

    const loadingTask = pdfjs.getDocument({ data: dataCopy });
    const document = await loadingTask.promise;

    // Get dimensions for all pages
    const pageDimensions: Record<number, { width: number; height: number }> = {};
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      pageDimensions[i] = { width: viewport.width, height: viewport.height };
    }

    const result: PDFLoadResult = {
      document,
      pageCount: document.numPages,
      pageDimensions,
    };

    // Cache the result
    pdfCache.set(cacheKey, result);

    console.log(`[PDFService] PDF loaded successfully: ${document.numPages} pages`);
    return result;
  } catch (error) {
    console.error('[PDFService] Failed to load PDF:', error);
    throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load PDF from File object
 */
export async function loadPDFFromFile(file: File): Promise<{ result: PDFLoadResult; arrayBuffer: ArrayBuffer }> {
  console.log(`[PDFService] Loading PDF from file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

  const arrayBuffer = await file.arrayBuffer();
  const result = await loadPDFFromArrayBuffer(arrayBuffer);

  return { result, arrayBuffer };
}

/**
 * Load PDF from URL (Object URL or remote URL)
 */
export async function loadPDFFromURL(url: string): Promise<PDFLoadResult> {
  console.log(`[PDFService] Loading PDF from URL: ${url.substring(0, 50)}...`);

  try {
    const loadingTask = pdfjs.getDocument(url);
    const document = await loadingTask.promise;

    // Get dimensions for all pages
    const pageDimensions: Record<number, { width: number; height: number }> = {};
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      pageDimensions[i] = { width: viewport.width, height: viewport.height };
    }

    console.log(`[PDFService] PDF loaded from URL: ${document.numPages} pages`);

    return {
      document,
      pageCount: document.numPages,
      pageDimensions,
    };
  } catch (error) {
    console.error('[PDFService] Failed to load PDF from URL:', error);
    throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from a specific page with position information
 */
export async function extractPageText(
  document: pdfjs.PDFDocumentProxy,
  pageNumber: number
): Promise<ExtractedTextItem[]> {
  if (pageNumber < 1 || pageNumber > document.numPages) {
    throw new Error(`Invalid page number: ${pageNumber}. PDF has ${document.numPages} pages.`);
  }

  const page = await document.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });

  const items: ExtractedTextItem[] = [];

  for (const item of textContent.items) {
    if ('str' in item && item.str.trim()) {
      // Transform coordinates from PDF space to normalized space
      const tx = item.transform;
      const x = tx[4];
      const y = viewport.height - tx[5]; // Flip Y-axis
      const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);

      items.push({
        text: item.str,
        x,
        y,
        width: item.width || 0,
        height: item.height || fontSize,
        fontSize,
        fontName: item.fontName || '',
      });
    }
  }

  return items;
}

/**
 * Extract all text from a page as a single string
 */
export async function extractPageTextContent(
  document: pdfjs.PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  const items = await extractPageText(document, pageNumber);
  return items.map(item => item.text).join(' ');
}

/**
 * Render a page to a canvas
 */
export async function renderPageToCanvas(
  document: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1,
  rotation: number = 0
): Promise<{ width: number; height: number }> {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation });

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get canvas 2D context');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  context.clearRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return { width: viewport.width, height: viewport.height };
}

/**
 * Clear the PDF cache
 */
export function clearPDFCache(): void {
  pdfCache.clear();
  console.log('[PDFService] PDF cache cleared');
}

/**
 * Get cache stats
 */
export function getPDFCacheStats(): { count: number; keys: string[] } {
  return {
    count: pdfCache.size,
    keys: Array.from(pdfCache.keys()),
  };
}
