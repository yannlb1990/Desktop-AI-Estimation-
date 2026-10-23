/**
 * Plan revision compare: what changed between two issues of the same drawing.
 * Both pages are rendered at the same size; ink (dark pixels) found only in the new
 * revision is painted green, ink only in the old one red. A small tolerance stops
 * anti-aliasing and 1-2 px shifts from lighting up the whole sheet.
 */
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';
import { getCachedPDF } from './pdfCache';
import { inkMask, diffMasks } from './revisionMask';
export { inkMask, dilate, diffMasks } from './revisionMask';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface PlanSource { planId?: string; url?: string; storagePath?: string; data?: ArrayBuffer }

async function openPdf(src: PlanSource): Promise<any> {
  if (src.data) return pdfjsLib.getDocument({ data: new Uint8Array(src.data.slice(0)) }).promise;
  if (src.planId) {
    const cached = await getCachedPDF(src.planId).catch(() => null);
    if (cached) return pdfjsLib.getDocument({ data: new Uint8Array(cached.data.slice(0)) }).promise;
  }
  let url = src.url;
  const path = src.storagePath ?? (url?.startsWith('storage:') ? url : undefined);
  if (path?.startsWith('storage:')) {
    const [bucket, ...rest] = path.slice('storage:'.length).split('/');
    const { data } = await supabase.storage.from(bucket).createSignedUrl(rest.join('/'), 3600);
    url = data?.signedUrl;
  }
  if (!url) throw new Error('The previous revision is not available on this device or in the cloud.');
  return pdfjsLib.getDocument(url).promise;
}

async function renderToCanvas(pdf: any, pageIndex: number, scale: number, rotation: number) {
  const page = await pdf.getPage(pageIndex + 1);
  const vp = page.getViewport({ scale, rotation });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const optional = await pdf.getOptionalContentConfig({ intent: 'any' }).catch(() => undefined);
  await page.render({ canvasContext: ctx, viewport: vp, intent: 'any', ...(optional ? { optionalContentConfigPromise: Promise.resolve(optional) } : {}) } as any).promise;
  const base = page.getViewport({ scale: 1, rotation });
  return { canvas, ctx, baseW: base.width, baseH: base.height };
}

export interface RevisionOverlay {
  dataUrl: string;
  /** overlay pixels per page unit (draw at 1/scale) */
  scale: number;
  added: number;
  removed: number;
  /** share of the new sheet's linework that changed, 0-1 */
  changedShare: number;
}

/** The changes on one page between the previous and the current revision. */
export async function buildRevisionOverlay(current: PlanSource, previous: PlanSource, pageIndex: number, rotation = 0): Promise<RevisionOverlay> {
  const [newPdf, oldPdf] = await Promise.all([openPdf(current), openPdf(previous)]);
  try {
  if (pageIndex >= oldPdf.numPages) throw new Error(`The previous revision has no page ${pageIndex + 1}.`);
  const probe = await newPdf.getPage(pageIndex + 1);
  const base = probe.getViewport({ scale: 1, rotation });
  // About 6 million pixels: sharp enough for linework, light on memory (tablets cap canvases)
  const scale = Math.max(1, Math.min(4, Math.sqrt(6_000_000 / (base.width * base.height))));
  const [a, b] = await Promise.all([renderToCanvas(newPdf, pageIndex, scale, rotation), renderToCanvas(oldPdf, pageIndex, scale, rotation)]);
  if (Math.abs(a.baseW - b.baseW) / a.baseW > 0.02 || Math.abs(a.baseH - b.baseH) / a.baseH > 0.02) {
    throw new Error('This page is a different sheet size in the previous revision, so it cannot be overlaid.');
  }
  const w = a.canvas.width, h = Math.min(a.canvas.height, b.canvas.height);
  const ww = Math.min(w, b.canvas.width);
  const newInk = inkMask(a.ctx.getImageData(0, 0, ww, h).data, ww, h);
  const oldInk = inkMask(b.ctx.getImageData(0, 0, ww, h).data, ww, h);
  const diff = diffMasks(oldInk, newInk, ww, h, Math.max(2, Math.round(scale)));
  const out = document.createElement('canvas');
  out.width = ww; out.height = h;
  out.getContext('2d')!.putImageData(new ImageData(diff.overlay, ww, h), 0, 0);
  const result = {
    dataUrl: out.toDataURL('image/png'),
    scale,
    added: diff.added,
    removed: diff.removed,
    changedShare: diff.ink > 0 ? (diff.added + diff.removed) / diff.ink : 0,
  };
  // Hand the pixel memory back now rather than at the next garbage collection
  for (const c of [a.canvas, b.canvas, out]) { c.width = 0; c.height = 0; }
  return result;
  } finally {
    // Documents live in the pdf.js worker until destroyed
    newPdf.destroy?.(); oldPdf.destroy?.();
  }
}
