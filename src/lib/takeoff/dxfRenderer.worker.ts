import DxfParser from 'dxf-parser';
import { MAX_ENTITIES, renderEntities, computeLayout } from './dxfGeometry';

self.onmessage = async (e: MessageEvent<{ text: string; targetMaxDim: number }>) => {
  const { text, targetMaxDim } = e.data;

  try {
    const parser = new DxfParser();
    const dxf = parser.parseSync(text);
    let entities: any[] = dxf?.entities ?? [];

    const truncated = entities.length > MAX_ENTITIES;
    if (truncated) entities = entities.slice(0, MAX_ENTITIES);

    if (entities.length === 0) {
      self.postMessage({ error: 'DXF file contains no renderable geometry' });
      return;
    }

    const layout = computeLayout(entities, targetMaxDim);
    if (!layout) {
      self.postMessage({ error: 'DXF bounding box is too small or empty' });
      return;
    }

    const { scale, canvasW, canvasH, tx, ty } = layout;
    const canvas = new OffscreenCanvas(canvasW, canvasH);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.strokeStyle = '#1a1a2e';
    (ctx as any).fillStyle = '#1a1a2e';
    ctx.lineWidth = Math.max(0.8, scale * 0.15);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    renderEntities(ctx, entities, tx, ty, scale);

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const buffer = await blob.arrayBuffer();

    self.postMessage({ buffer, width: canvasW, height: canvasH, truncated }, [buffer]);
  } catch (err) {
    self.postMessage({ error: String(err) });
  }
};
