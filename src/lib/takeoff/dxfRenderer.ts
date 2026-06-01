import DxfParser from 'dxf-parser';
import { MAX_ENTITIES, renderEntities, computeLayout } from './dxfGeometry';

export interface DxfRenderResult {
  blob: Blob;
  width: number;
  height: number;
  truncated: boolean;
}

export async function renderDxfToBlob(
  file: File,
  targetMaxDim = 4096,
): Promise<DxfRenderResult> {
  const text = await file.text();

  if (typeof OffscreenCanvas !== 'undefined') {
    return renderInWorker(text, targetMaxDim);
  }
  return renderOnMainThread(text, targetMaxDim);
}

function renderInWorker(text: string, targetMaxDim: number): Promise<DxfRenderResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./dxfRenderer.worker.ts', import.meta.url),
      { type: 'module' },
    );

    const cleanup = () => worker.terminate();

    worker.onmessage = (e) => {
      cleanup();
      const { error, buffer, width, height, truncated } = e.data;
      if (error) return reject(new Error(error));
      resolve({ blob: new Blob([buffer], { type: 'image/png' }), width, height, truncated: !!truncated });
    };

    worker.onerror = (err) => {
      cleanup();
      // Fall back to main-thread rendering on worker error
      renderOnMainThread(text, targetMaxDim).then(resolve).catch(reject);
    };

    worker.postMessage({ text, targetMaxDim });
  });
}

function renderOnMainThread(text: string, targetMaxDim: number): Promise<DxfRenderResult> {
  const parser = new DxfParser();
  const dxf = parser.parseSync(text);
  let entities: any[] = dxf?.entities ?? [];

  const truncated = entities.length > MAX_ENTITIES;
  if (truncated) entities = entities.slice(0, MAX_ENTITIES);

  if (entities.length === 0) throw new Error('DXF file contains no renderable geometry');

  const layout = computeLayout(entities, targetMaxDim);
  if (!layout) throw new Error('DXF bounding box is too small or empty');

  const { scale, canvasW, canvasH, tx, ty } = layout;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.strokeStyle = '#1a1a2e';
  ctx.fillStyle = '#1a1a2e';
  ctx.lineWidth = Math.max(0.8, scale * 0.15);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  renderEntities(ctx, entities, tx, ty, scale);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('Failed to rasterise DXF'));
      resolve({ blob, width: canvasW, height: canvasH, truncated });
    }, 'image/png');
  });
}
