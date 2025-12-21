// Coordinate conversion functions for PDF Takeoff
// World space = PDF page coordinates (stable, zoom-independent)
// View space = Canvas pixel coordinates (transient, affected by zoom/pan/rotation)

import { WorldPoint, ViewPoint, Transform, PDFViewportData } from './types';

/**
 * Convert view (canvas) coordinates to world (PDF) coordinates
 *
 * CRITICAL FIX: When using canvas.getPointer(e.e, true), we get raw canvas pixel
 * coordinates that ignore the viewportTransform. We must manually apply the
 * inverse transform to get world coordinates.
 *
 * This approach is more reliable than getPointer(false) which can have
 * inconsistent behavior across Fabric.js versions.
 */
export function viewToWorld(
  viewPoint: ViewPoint,
  transform: Transform,
  viewport: PDFViewportData
): WorldPoint {
  // Apply inverse of viewportTransform to convert canvas pixels to world coords
  // viewportTransform is [zoom, 0, 0, zoom, panX, panY]
  // Inverse: worldX = (canvasX - panX) / zoom
  //          worldY = (canvasY - panY) / zoom

  const worldX = (viewPoint.x - transform.panX) / transform.zoom;
  const worldY = (viewPoint.y - transform.panY) / transform.zoom;

  return {
    x: worldX,
    y: worldY
  };
}

/**
 * Convert world (PDF) coordinates to view (canvas) coordinates
 * Used for rendering stored measurements at current zoom/pan level
 * 
 * Since world coordinates are the actual PDF coordinates and the PDF
 * is rendered at base scale 1.0, we apply the current transform to
 * convert to screen position.
 */
export function worldToView(
  worldPoint: WorldPoint,
  transform: Transform,
  viewport: PDFViewportData
): ViewPoint {
  // Apply zoom and pan to convert world coords to view coords
  // PDF is at base scale 1.0, so world coords map directly to PDF pixels
  const x = worldPoint.x * transform.zoom + transform.panX;
  const y = worldPoint.y * transform.zoom + transform.panY;

  return { x, y };
}

/**
 * Calculate distance in world coordinates (zoom-independent)
 */
export function worldDistance(p1: WorldPoint, p2: WorldPoint): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}
