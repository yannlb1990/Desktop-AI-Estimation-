import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, FabricImage, Circle, Line, Path, Rect, Polygon, Text, Point as FabricPoint, util as fabricUtil } from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorldPoint, ViewPoint, Transform, PDFViewportData, Measurement, ToolType } from '@/lib/takeoff/types';
import { calculateLinearWorld, calculateRectangleAreaWorld, calculatePolygonAreaWorld, calculateCentroidWorld, calculateCircleAreaWorld } from '@/lib/takeoff/calculations';
import { viewToWorld } from '@/lib/takeoff/coordinates';
import { DetectedOpening } from '@/lib/takeoff/pdfTextExtractor';
import { getCachedPDF } from '@/lib/takeoff/pdfCache';
import { patchPaletteJP2Tiles } from '@/lib/takeoff/jp2Patch';

// PDF.js worker served from /public — no CDN, no Vite ?url magic
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// ─── Snap helpers (module-level, no closure risk) ────────────────────────────

/** Snap `to` so the angle from `from→to` is the nearest multiple of snapDeg. */
function snapEndpointToAngle(from: WorldPoint, to: WorldPoint, snapDeg = 45): WorldPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return to;
  const angle = Math.atan2(dy, dx);
  const snapRad = (snapDeg * Math.PI) / 180;
  const snapped = Math.round(angle / snapRad) * snapRad;
  return { x: from.x + dist * Math.cos(snapped), y: from.y + dist * Math.sin(snapped) };
}

/** Snap rectangle end-point to make a perfect square (equal side length). */
function snapToSquare(from: WorldPoint, to: WorldPoint): WorldPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const side = Math.min(Math.abs(dx), Math.abs(dy));
  return { x: from.x + Math.sign(dx) * side, y: from.y + Math.sign(dy) * side };
}

/** Return midpoints for every edge of a measurement's worldPoints array. */
function getMidpointsForMeasurement(m: { type?: string; worldPoints: WorldPoint[] }): WorldPoint[] {
  const pts = m.worldPoints;
  if (pts.length < 2) return [];
  if (m.type === 'rectangle' && pts.length === 2) {
    const minX = Math.min(pts[0].x, pts[1].x), maxX = Math.max(pts[0].x, pts[1].x);
    const minY = Math.min(pts[0].y, pts[1].y), maxY = Math.max(pts[0].y, pts[1].y);
    return [
      { x: (minX + maxX) / 2, y: minY },
      { x: (minX + maxX) / 2, y: maxY },
      { x: minX, y: (minY + maxY) / 2 },
      { x: maxX, y: (minY + maxY) / 2 },
    ];
  }
  const n = m.type === 'polygon' ? pts.length : pts.length - 1;
  const mids: WorldPoint[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    mids.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return mids;
}

/** Snap cursor to nearest endpoint (priority) or midpoint within threshold.
 *  Returns the snapped point and whether it is a midpoint. */
function computeSnapPoint(
  cursor: WorldPoint,
  measurements: { type?: string; worldPoints?: WorldPoint[] }[],
  thresh: number
): { point: WorldPoint; isMidpoint: boolean } | null {
  for (const m of measurements) {
    if (!m.worldPoints) continue;
    for (const ep of m.worldPoints) {
      if (Math.hypot(cursor.x - ep.x, cursor.y - ep.y) < thresh)
        return { point: { x: ep.x, y: ep.y }, isMidpoint: false };
    }
  }
  for (const m of measurements) {
    if (!m.worldPoints || m.worldPoints.length < 2) continue;
    for (const mid of getMidpointsForMeasurement(m as any)) {
      if (Math.hypot(cursor.x - mid.x, cursor.y - mid.y) < thresh)
        return { point: { x: mid.x, y: mid.y }, isMidpoint: true };
    }
  }
  return null;
}

/** In-place update of a Fabric Line's world endpoints (no scale/skew accumulation). */
function setFabricLineCoords(line: any, x1: number, y1: number, x2: number, y2: number) {
  line.set({
    x1, y1, x2, y2,
    left: (x1 + x2) / 2,
    top: (y1 + y2) / 2,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
    scaleX: 1, scaleY: 1,
  });
  line.setCoords();
}

/**
 * Sync the four visual wall lines to match the hit-rect's current position/scale.
 * objects = [hitRect, wl1, wl2, wc1, wc2]
 * hitRect is rotated to the wall axis; its local X = wall length, local Y = thickness (locked).
 */
function syncWallFromRect(
  hitRect: any,
  objects: any[],
  wallThickness: number,
  upm: number,
) {
  if (objects.length < 5) return;
  const [, wl1, wl2, wc1, wc2] = objects;

  const angle = (hitRect.angle ?? 0) * Math.PI / 180;
  const cx: number = hitRect.left;
  const cy: number = hitRect.top;
  const halfLength = (hitRect.width * (hitRect.scaleX ?? 1)) / 2;

  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const axisP1 = { x: cx - cosA * halfLength, y: cy - sinA * halfLength };
  const axisP2 = { x: cx + cosA * halfLength, y: cy + sinA * halfLength };

  const geo = wallGeometry(axisP1, axisP2, wallThickness, upm);
  setFabricLineCoords(wl1, geo.l1p1.x, geo.l1p1.y, geo.l1p2.x, geo.l1p2.y);
  setFabricLineCoords(wl2, geo.l2p1.x, geo.l2p1.y, geo.l2p2.x, geo.l2p2.y);
  setFabricLineCoords(wc1, geo.l1p1.x, geo.l1p1.y, geo.l2p1.x, geo.l2p1.y);
  setFabricLineCoords(wc2, geo.l1p2.x, geo.l1p2.y, geo.l2p2.x, geo.l2p2.y);
}

/** Build the transparent hit-rect that acts as the primary interactive object for a wall. */
function makeWallHitRect(axisP1: WorldPoint, axisP2: WorldPoint, thicknessMm: number, upm: number, strokeWidth: number) {
  const dx = axisP2.x - axisP1.x, dy = axisP2.y - axisP1.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const thicknessWorld = (thicknessMm / 1000) * upm;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const cx = (axisP1.x + axisP2.x) / 2;
  const cy = (axisP1.y + axisP2.y) / 2;

  const hitRect = new Rect({
    left: cx, top: cy,
    width: length, height: thicknessWorld,
    angle,
    originX: 'center', originY: 'center',
    fill: 'rgba(0,0,0,0)',
    stroke: null,
    hasControls: true, hasBorders: true,
    lockRotation: true, lockScalingY: true,
    cornerColor: '#2563eb', cornerStyle: 'circle' as const,
    cornerSize: 10, transparentCorners: false, borderColor: '#2563eb',
    borderScaleFactor: 2,
    selectable: false, evented: false,
  });
  // Only show left/right endpoint handles — MT/MB/corners would scale thickness
  hitRect.setControlsVisibility({ mt: false, mb: false, tl: false, tr: false, bl: false, br: false });
  (hitRect as any)._isWallPrimary = true;
  return hitRect;
}

/** Compute the four corner points for a wall-line given two endpoints, thickness in mm, and unitsPerMetre. */
function wallGeometry(p1: WorldPoint, p2: WorldPoint, thicknessMm: number, upm: number) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const hw = (thicknessMm / 1000) * upm / 2;
  return {
    l1p1: { x: p1.x + nx * hw, y: p1.y + ny * hw },
    l1p2: { x: p2.x + nx * hw, y: p2.y + ny * hw },
    l2p1: { x: p1.x - nx * hw, y: p1.y - ny * hw },
    l2p2: { x: p2.x - nx * hw, y: p2.y - ny * hw },
    hw,
  };
}

/** Quadratic bezier arc-wall geometry given start, end, a through-point (ctrl), thickness mm, and upm. */
function arcWallGeometry(
  p1: WorldPoint, p2: WorldPoint, ctrl: WorldPoint,
  thicknessMm: number, upm: number | null
) {
  // hw in world units; if uncalibrated use 1/3 of chord as placeholder
  const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
  const hw = upm ? (thicknessMm / 1000) * upm / 2 : chord * 0.06;

  // Bezier control point so the curve passes through ctrl at t=0.5:
  //   ctrl = 0.25*p1 + 0.5*Q + 0.25*p2  => Q = 2*ctrl - (p1+p2)/2
  const Qx = 2 * ctrl.x - (p1.x + p2.x) / 2;
  const Qy = 2 * ctrl.y - (p1.y + p2.y) / 2;

  // Tangent normals at p1 and p2
  const t1x = Qx - p1.x, t1y = Qy - p1.y;
  const t1l = Math.sqrt(t1x * t1x + t1y * t1y) || 1;
  const n1 = { x: -t1y / t1l, y: t1x / t1l };

  const t2x = p2.x - Qx, t2y = p2.y - Qy;
  const t2l = Math.sqrt(t2x * t2x + t2y * t2y) || 1;
  const n2 = { x: -t2y / t2l, y: t2x / t2l };

  // Average normal at Q
  const nqx = (n1.x + n2.x) / 2, nqy = (n1.y + n2.y) / 2;
  const nql = Math.sqrt(nqx * nqx + nqy * nqy) || 1;
  const nq = { x: nqx / nql, y: nqy / nql };

  return {
    hw,
    Q: { x: Qx, y: Qy },
    outer: {
      p1: { x: p1.x + n1.x * hw, y: p1.y + n1.y * hw },
      Q:  { x: Qx + nq.x * hw,  y: Qy + nq.y * hw },
      p2: { x: p2.x + n2.x * hw, y: p2.y + n2.y * hw },
    },
    inner: {
      p1: { x: p1.x - n1.x * hw, y: p1.y - n1.y * hw },
      Q:  { x: Qx - nq.x * hw,  y: Qy - nq.y * hw },
      p2: { x: p2.x - n2.x * hw, y: p2.y - n2.y * hw },
    },
  };
}

interface InteractiveCanvasProps {
  pdfUrl: string | null;
  planId?: string;
  pageIndex: number;
  transform: Transform;
  activeTool: ToolType;
  isCalibrated: boolean;
  unitsPerMetre: number | null;
  calibrationMode: 'preset' | 'manual' | null;
  selectedColor?: string;
  measurements?: Measurement[];
  detectedOpenings?: DetectedOpening[];
  onMeasurementComplete: (measurement: Measurement) => void;
  onMeasurementUpdate?: (id: string, updates: Partial<Measurement>) => void;
  onCalibrationPointsSet: (points: [WorldPoint, WorldPoint]) => void;
  onTransformChange: (transform: Partial<Transform>) => void;
  onViewportReady: (viewport: PDFViewportData) => void;
  onDeleteLastMeasurement?: () => void;
  onDeleteMeasurement?: (id: string) => void;
  onMeasurementSelect?: (id: string, screenX: number, screenY: number) => void;
  /** Parent passes a ref; canvas fills `.current` with an `{ export }` handle. */
  canvasExportRef?: React.RefObject<{ export: () => void } | null>;
  wallThickness?: number;
  /** Called when the user clicks "Re-upload PDF" on the session-expired error screen. */
  onReupload?: () => void;
  /** Original file name — used to choose between PDF.js and direct image loading. */
  fileName?: string;
  /** Fill hatch pattern for the next wall drawn. */
  wallHatchType?: string;
  /** Which face(s) to apply face-lining hatches (plasterboard / wet-area / cladding). */
  wallHatchSide?: string;
  /**
   * Parent passes a mutable ref; canvas fills `.current` with imperative methods.
   * Use `canvasActionsRef.current?.removeObjects(id)` to delete canvas objects before
   * dispatching DELETE_MEASUREMENT so removal is synchronous (same frame), not deferred.
   */
  canvasActionsRef?: React.MutableRefObject<{ removeObjects: (id: string) => void } | null>;
}

export const InteractiveCanvas = ({
  pdfUrl,
  planId,
  pageIndex,
  transform,
  activeTool,
  isCalibrated,
  unitsPerMetre,
  calibrationMode,
  measurements = [],
  detectedOpenings,
  onMeasurementComplete,
  onMeasurementUpdate,
  onCalibrationPointsSet,
  onTransformChange,
  onViewportReady,
  selectedColor,
  onDeleteLastMeasurement,
  onDeleteMeasurement,
  onMeasurementSelect,
  canvasExportRef,
  wallThickness = 90,
  wallHatchType = 'none',
  wallHatchSide = 'both',
  onReupload,
  fileName,
  canvasActionsRef,
}: InteractiveCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  // Cached patched ArrayBuffer for this plan — avoids repeated IndexedDB fetches
  const patchedBufferRef = useRef<ArrayBuffer | null>(null);
  const wallThicknessRef = useRef(wallThickness);
  useEffect(() => { wallThicknessRef.current = wallThickness; }, [wallThickness]);
  const unitsPerMetreRef = useRef(unitsPerMetre);
  useEffect(() => { unitsPerMetreRef.current = unitsPerMetre; }, [unitsPerMetre]);
  // Arc-wall 3-click state: phase 0=idle, 1=placed P1 (waiting for P2), 2=placed P1+P2 (move for control)
  const arcStateRef = useRef<{ phase: 0 | 1 | 2; p1: WorldPoint | null; p2: WorldPoint | null }>({
    phase: 0, p1: null, p2: null,
  });
  const arcMarkerRef = useRef<any>(null); // small dot showing P1 while in phase 1
  // Guard: auto-fit runs once per mount (remount happens on page/plan change via key prop)
  const hasAutoFittedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<PDFViewportData | null>(null);
  // Auto-dismiss tool hints after 3 s
  const [hintVisible, setHintVisible] = useState(true);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track canvas objects by measurement ID for sync
  const measurementObjectsRef = useRef<Map<string, any[]>>(new Map());

  // Track measurement ID on each shape for resize handling
  const shapeToMeasurementIdRef = useRef<Map<any, string>>(new Map());

  // Snap indicator for polygon first-point proximity
  const snapIndicatorRef = useRef<Circle | null>(null);

  // Map of measurement id → Measurement for the after:render label handler
  const measurementMapRef = useRef<Map<string, Measurement>>(new Map());
  // Preview label for live drawing feedback
  const previewLabelRef = useRef<{ text: string; worldX: number; worldY: number; color: string } | null>(null);
  // Canvas objects for detected-opening overlay (separate from measurements)
  const openingOverlayObjectsRef = useRef<any[]>([]);
  // Perpendicular-snap guide: rendered in after:render when drawing a wall-line
  const perpSnapRef = useRef<{ from: WorldPoint; to: WorldPoint } | null>(null);
  // Last endpoint snapped to perpendicular — carried from mouse:move into mouse:up
  const snappedWallEndRef = useRef<WorldPoint | null>(null);
  // Midpoint snap indicator — set to the midpoint world position when cursor is snapping to one
  const midpointSnapRef = useRef<WorldPoint | null>(null);
  // Endpoint snap indicator — set to the endpoint world position when cursor is snapping to an endpoint
  const endpointSnapIndicatorRef = useRef<WorldPoint | null>(null);
  // Arc wall control-point drag state (select mode)
  const arcDragRef = useRef<{ id: string; p1: WorldPoint; p2: WorldPoint; ctrl: WorldPoint } | null>(null);

  // Always-current draw color — avoids stale closure in mouse callbacks
  const drawColorRef = useRef<string | undefined>(selectedColor);
  useEffect(() => { drawColorRef.current = selectedColor; }, [selectedColor]);

  // Always-current hatch type — avoids stale closure in mouse callbacks
  const wallHatchTypeRef = useRef<string>('none');
  useEffect(() => { wallHatchTypeRef.current = wallHatchType || 'none'; }, [wallHatchType]);

  const wallHatchSideRef = useRef<string>('both');
  useEffect(() => { wallHatchSideRef.current = wallHatchSide || 'both'; }, [wallHatchSide]);

  // Reset and auto-dismiss hint banner whenever tool changes
  useEffect(() => {
    setHintVisible(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHintVisible(false), 3000);
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current); };
  }, [activeTool]);

  // Set of measurement IDs that are Wall/Door/Window markup — labels suppressed on canvas.
  // Stored as a ref so the after:render handler (registered once) can read it without stale closure.
  const modMarkupIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    modMarkupIdsRef.current = new Set(
      measurements
        .filter(m => {
          const mt = (m as any).measurementType as string | undefined;
          const lbl = m.label || '';
          return mt === 'Wall' || mt === 'Door' || mt === 'Window' ||
            lbl.startsWith('Wall ') || lbl.startsWith('Wall—') || lbl === 'Wall' ||
            lbl.startsWith('Door ') || lbl.startsWith('Door—') || lbl === 'Door' ||
            lbl.startsWith('Window ') || lbl.startsWith('Window—') || lbl === 'Window';
        })
        .map(m => m.id)
    );
  }, [measurements]);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<WorldPoint | null>(null);
  const previewShapeRef = useRef<any>(null);
  const [polygonPoints, setPolygonPoints] = useState<WorldPoint[]>([]);
  const [polygonMarkers, setPolygonMarkers] = useState<Circle[]>([]);
  const [polygonLines, setPolygonLines] = useState<Line[]>([]);

  // Count tool state - for grouped counting with numbered markers
  const [countPoints, setCountPoints] = useState<WorldPoint[]>([]);
  const [countMarkers, setCountMarkers] = useState<Circle[]>([]);
  const [countPreset, setCountPreset] = useState<string>('Custom'); // Preset name for count items

  // Count preset options
  const COUNT_PRESETS = ['Toilet', 'Window', 'Door', 'Light', 'Power Point', 'Switch', 'Custom'];

  // Calibration state - now supports drag-to-calibrate
  const [calibrationPoints, setCalibrationPoints] = useState<WorldPoint[]>([]);
  const [calibrationObjects, setCalibrationObjects] = useState<any[]>([]);
  const [isCalibrationDragging, setIsCalibrationDragging] = useState(false);
  const [calibrationStartPoint, setCalibrationStartPoint] = useState<WorldPoint | null>(null);
  const [calibrationPreviewLine, setCalibrationPreviewLine] = useState<any>(null);
  // Refs for synchronous access in event handlers (avoids stale closure bugs)
  const isCalibrationDraggingRef = useRef(false);
  const calibrationStartPointRef = useRef<WorldPoint | null>(null);
  const calibrationPreviewLineRef = useRef<any>(null);

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [lastClientPos, setLastClientPos] = useState<{ x: number; y: number } | null>(null);

  // Initialize Fabric canvas - SIZE TO CONTAINER with ResizeObserver
  useEffect(() => {
    if (!containerRef.current || fabricCanvasRef.current) return;

    const container = containerRef.current;
    
    // Get initial size with minimum fallback
    const getContainerSize = () => ({
      width: Math.max(container.clientWidth || 0, 800),
      height: Math.max(container.clientHeight || 0, 600)
    });

    const { width: initialWidth, height: initialHeight } = getContainerSize();
    
    const canvasElement = document.createElement('canvas');
    canvasElement.width = initialWidth;
    canvasElement.height = initialHeight;
    container.appendChild(canvasElement);
    canvasRef.current = canvasElement;

    const canvas = new FabricCanvas(canvasElement, {
      width: initialWidth,
      height: initialHeight,
      backgroundColor: '#f5f5f5',
      selection: false,
    });

    fabricCanvasRef.current = canvas;

    // ResizeObserver for dynamic container sizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (fabricCanvasRef.current && width > 0 && height > 0) {
          const newWidth = Math.max(width, 800);
          const newHeight = Math.max(height, 600);
          fabricCanvasRef.current.setWidth(newWidth);
          fabricCanvasRef.current.setHeight(newHeight);
          fabricCanvasRef.current.requestRenderAll();
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      canvas.dispose();
      if (container && canvasElement.parentNode === container) {
        container.removeChild(canvasElement);
      }
      fabricCanvasRef.current = null;
      canvasRef.current = null;
    };
  }, []);

  // Expose imperative delete handle so the right panel can remove canvas objects
  // BEFORE dispatching DELETE_MEASUREMENT — same synchronous pattern as the eraser.
  useEffect(() => {
    if (!canvasActionsRef) return;
    canvasActionsRef.current = {
      removeObjects: (id: string) => {
        const canvas = fabricCanvasRef.current;
        const objs = measurementObjectsRef.current.get(id) || [];
        objs.forEach((o: any) => {
          canvas?.remove(o);
          shapeToMeasurementIdRef.current.delete(o);
        });
        measurementObjectsRef.current.delete(id);
        measurementMapRef.current.delete(id);
        canvas?.renderAll();
      },
    };
    return () => {
      if (canvasActionsRef) canvasActionsRef.current = null;
    };
  }, [canvasActionsRef]);

  // Expose export handle to parent via canvasExportRef
  useEffect(() => {
    if (!canvasExportRef) return;
    (canvasExportRef as React.MutableRefObject<{ export: () => void } | null>).current = {
      export: () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas || !viewport) return;

        // Save current viewport transform
        const savedVT = [...(canvas.viewportTransform || [1, 0, 0, 1, 0, 0])];

        // Fit the full PDF page into the canvas
        const canvasW = canvas.width || 800;
        const canvasH = canvas.height || 600;
        const fitZoom = Math.min(canvasW / viewport.width, canvasH / viewport.height) * 0.95;
        const offsetX = (canvasW - viewport.width * fitZoom) / 2;
        const offsetY = (canvasH - viewport.height * fitZoom) / 2;
        canvas.setViewportTransform([fitZoom, 0, 0, fitZoom, offsetX, offsetY]);
        canvas.renderAll();

        const dataUrl = (canvas as any).toDataURL({ format: 'png', quality: 1, multiplier: 2 });

        // Restore
        canvas.setViewportTransform(savedVT as any);
        canvas.requestRenderAll();

        const link = document.createElement('a');
        link.download = `plan-page-${pageIndex + 1}-markup.png`;
        link.href = dataUrl;
        link.click();
      },
    };
  }, [canvasExportRef, viewport, pageIndex]);

  // Load PDF page (or raster image / DXF-converted PNG)
  useEffect(() => {
    if (!pdfUrl || !fabricCanvasRef.current) return;

    const isImageFile = /\.(png|jpe?g|dxf)$/i.test(fileName ?? '');

    // ── Image / DXF-rendered-PNG path ────────────────────────────────────────
    if (isImageFile) {
      const loadImage = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const img = await FabricImage.fromURL(pdfUrl);
          const imgW = (img.width ?? 1000);
          const imgH = (img.height ?? 1000);

          const pdfViewport: PDFViewportData = { width: imgW, height: imgH, scale: 1.0 };
          setViewport(pdfViewport);
          onViewportReady(pdfViewport);

          img.set({ left: 0, top: 0, originX: 'left', originY: 'top', selectable: false, evented: false, objectCaching: false });

          if (fabricCanvasRef.current) {
            fabricCanvasRef.current.backgroundImage = img;
            fabricCanvasRef.current.requestRenderAll();
          }

          if (!hasAutoFittedRef.current && containerRef.current) {
            hasAutoFittedRef.current = true;
            const cW = containerRef.current.clientWidth;
            const cH = containerRef.current.clientHeight;
            if (cW > 0 && cH > 0) {
              const fitZoom = Math.min(cW / imgW, cH / imgH) * 0.95;
              onTransformChange({ zoom: fitZoom, panX: (cW - imgW * fitZoom) / 2, panY: (cH - imgH * fitZoom) / 2 });
            }
          }
          setIsLoading(false);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Failed to load image: ${msg}`);
          setIsLoading(false);
        }
      };
      loadImage();
      return;
    }

    const loadPDF = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Prefer a patched ArrayBuffer when planId is available: palette-indexed
        // JPEG2000 tiles have a colr=sRGB header that contradicts the single-channel
        // image data, causing pdfjs/OpenJPEG to silently skip them (blank tile areas).
        // patchPaletteJP2Tiles fixes the colr declaration so the tiles decode correctly.
        if (planId && !patchedBufferRef.current) {
          try {
            const cached = await getCachedPDF(planId);
            if (cached) patchedBufferRef.current = patchPaletteJP2Tiles(cached.data);
          } catch { /* IndexedDB unavailable — fall back to blob URL */ }
        }

        // Try to load PDF — cascade through sources if one fails:
        // 1. Patched ArrayBuffer from IndexedDB (best quality, JP2 tiles work)
        // 2. Raw blob URL (skip patch; JP2 tiles may be blank but page loads)
        // 3. Error shown to user with re-upload prompt
        let pdf: any = null;
        const sourcesToTry: Array<{ data: ArrayBuffer } | string> = [];
        if (patchedBufferRef.current) sourcesToTry.push({ data: patchedBufferRef.current.slice(0) });
        if (pdfUrl) sourcesToTry.push(pdfUrl);

        for (const src of sourcesToTry) {
          try {
            const task = pdfjsLib.getDocument(src);
            pdf = await task.promise;
            break; // success — stop trying
          } catch (loadErr) {
            const msg = loadErr instanceof Error ? loadErr.message : String(loadErr);
            // If the patched buffer failed, clear it so the blob URL is tried next
            if (src !== pdfUrl && patchedBufferRef.current) {
              console.warn('[InteractiveCanvas] Patched buffer rejected, falling back to blob URL:', msg);
              patchedBufferRef.current = null;
            }
          }
        }

        if (!pdf) {
          // All sources exhausted
          const isExpired = pdfUrl && pdfUrl.startsWith('blob:');
          throw new Error(isExpired
            ? 'Plan file is no longer available (session expired). Please re-upload your PDF.'
            : 'Could not load PDF from any available source.');
        }

        // 'any' intent forces ALL Optional Content Groups visible regardless of their
        // display/print default state. ArchiCAD/AutoCAD PDFs often have wall/structural
        // layers marked off in print mode — 'any' is the only intent that exposes them.
        // Both calls must use the same intent (pdfjs v5 requirement).
        const optionalContentConfig = await (pdf as any).getOptionalContentConfig({ intent: 'any' });

        const page = await pdf.getPage(pageIndex + 1);

        // Get base dimensions for coordinate system (always scale 1.0)
        const baseViewport = page.getViewport({ scale: 1.0, rotation: transform.rotation });

        const pdfViewport: PDFViewportData = {
          width: baseViewport.width,
          height: baseViewport.height,
          scale: 1.0
        };
        setViewport(pdfViewport);
        onViewportReady(pdfViewport);

        // Render at high resolution so zooming stays sharp.
        // Cap by both max dimension AND total area to stay within browser canvas memory limits
        // (~256 MB). A single-dimension cap allows 100 M+ pixel canvases for A1/A0 plans,
        // which causes RangeError on getImageData. Area cap keeps allocations ≤ 200 MB.
        const maxDim = Math.max(baseViewport.width, baseViewport.height);
        const dimQuality = 12000 / maxDim;
        const areaQuality = Math.sqrt(50_000_000 / (baseViewport.width * baseViewport.height));
        const renderQuality = Math.max(2.0, Math.min(6.0, Math.min(dimQuality, areaQuality)));
        const hiResViewport = page.getViewport({ scale: renderQuality, rotation: transform.rotation });

        const tempCanvas = document.createElement('canvas');
        const context = tempCanvas.getContext('2d');

        if (!context) throw new Error('Could not get canvas context');

        tempCanvas.width = hiResViewport.width;
        tempCanvas.height = hiResViewport.height;
        context.imageSmoothingEnabled = true;
        (context as any).imageSmoothingQuality = 'high';

        await page.render({
          canvasContext: context,
          viewport: hiResViewport,
          intent: 'any',
          optionalContentConfigPromise: Promise.resolve(optionalContentConfig),
        } as any).promise;

        // Adaptive darkening pass.
        // Vector PDFs (ArchiCAD/AutoCAD exports) render hairlines as light gray
        // (luma 150–230) — a 0.55 multiply makes them clearly visible.
        // Image-based PDFs (JPEG2000 tiles, macOS print-to-PDF, scanned plans) already
        // encode correct contrast; applying the multiply smears compression artefacts
        // and degrades quality. We detect which type we have by sampling 1-in-8 pixels:
        // if non-white pixels already average below luma 80, the content is dark enough
        // and we skip the pass entirely.
        const W = tempCanvas.width, H = tempCanvas.height;
        const imageData = context.getImageData(0, 0, W, H);
        const d = imageData.data;

        let lumaSum = 0, lumaCount = 0;
        for (let i = 0; i < d.length; i += 32) { // sample every 8th pixel
          const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          if (luma < 240) { lumaSum += luma; lumaCount++; }
        }
        const avgNonWhite = lumaCount > 0 ? lumaSum / lumaCount : 0;

        if (avgNonWhite > 80) {
          // Washed-out vector content — darken to make hairlines visible
          for (let i = 0; i < d.length; i += 4) {
            const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            if (luma < 250) {
              d[i]     = Math.round(d[i]     * 0.55);
              d[i + 1] = Math.round(d[i + 1] * 0.55);
              d[i + 2] = Math.round(d[i + 2] * 0.55);
            }
          }
          context.putImageData(imageData, 0, 0);
        }
        // else: image-based PDF — leave pixels untouched, already correct contrast

        const dataUrl = tempCanvas.toDataURL('image/png');
        const img = await FabricImage.fromURL(dataUrl);

        if (fabricCanvasRef.current) {
          // Scale image back to 1.0-coordinate space so Fabric's viewportTransform
          // zoom math stays correct. Zooming now draws from the hi-res source.
          img.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            scaleX: 1 / renderQuality,
            scaleY: 1 / renderQuality,
            objectCaching: false,
          });

          fabricCanvasRef.current.backgroundImage = img;
          fabricCanvasRef.current.requestRenderAll();
        }

        // Auto-fit: runs once per mount. Reads the container's live dimensions so the
        // zoom is always accurate regardless of when or which tab is visible.
        // Also auto-orients: if rotating 90° fills the canvas ≥15% better, apply it.
        if (!hasAutoFittedRef.current && containerRef.current) {
          hasAutoFittedRef.current = true;
          const canvasW = containerRef.current.clientWidth;
          const canvasH = containerRef.current.clientHeight;
          if (canvasW > 0 && canvasH > 0) {
            const vpW = baseViewport.width;
            const vpH = baseViewport.height;
            const fit0  = Math.min(canvasW / vpW, canvasH / vpH);
            const fit90 = Math.min(canvasW / vpH, canvasH / vpW);
            const autoRotate = fit90 > fit0 * 1.15;
            const fitW = autoRotate ? vpH : vpW;
            const fitH = autoRotate ? vpW : vpH;
            const fitZoom = Math.min(canvasW / fitW, canvasH / fitH) * 0.95;
            const panX = (canvasW - fitW * fitZoom) / 2;
            const panY = (canvasH - fitH * fitZoom) / 2;
            const update: Parameters<typeof onTransformChange>[0] = { zoom: fitZoom, panX, panY };
            if (autoRotate) update.rotation = (transform.rotation + 90) % 360;
            onTransformChange(update);
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        const message = err instanceof Error ? err.message : String(err);
        // Human-readable messages thrown above (session-expired / all-sources-exhausted)
        // pass through as-is. Unexpected errors show the raw message for debugging.
        setError(message.startsWith('Plan file') || message.startsWith('Could not load')
          ? message
          : `Failed to load PDF: ${message}`);
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [pdfUrl, pageIndex, transform.rotation, onViewportReady, onTransformChange]);

  // Apply zoom and pan transforms synchronously before paint to avoid a 1-frame lag
  // where React has updated state but the canvas still shows the old viewport.
  useLayoutEffect(() => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    canvas.setViewportTransform([
      transform.zoom, 0, 0,
      transform.zoom,
      transform.panX,
      transform.panY
    ]);
    canvas.requestRenderAll();
  }, [transform.zoom, transform.panX, transform.panY]);

  // Update cursor based on active tool
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;

    if (calibrationMode === 'manual') {
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
    } else if (activeTool === 'pan' || !activeTool) {
      canvas.defaultCursor = 'grab';
      canvas.hoverCursor = 'grab';
    } else {
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
    }

    // Reset arc state when tool changes away from arc-wall
    if (activeTool !== 'arc-wall') {
      arcStateRef.current = { phase: 0, p1: null, p2: null };
      if (canvas) {
        if (arcMarkerRef.current) {
          try { canvas.remove(arcMarkerRef.current); } catch (_) {}
          arcMarkerRef.current = null;
        }
        // Remove any lingering arc-wall preview objects left on canvas
        const toRemove: any[] = [];
        canvas.getObjects().forEach((obj: any) => {
          if (obj._arcPreviews) {
            (obj._arcPreviews as any[]).forEach((s: any) => toRemove.push(s));
            toRemove.push(obj);
          }
        });
        toRemove.forEach(obj => { try { canvas.remove(obj); } catch (_) {} });
        if (toRemove.length > 0) canvas.requestRenderAll();
      }
      previewLabelRef.current = null;
    }

    // Clean up any lingering wall-line preview objects when switching away from wall-line
    if (activeTool !== 'wall-line') {
      if (canvas) {
        const wallToRemove: any[] = [];
        canvas.getObjects().forEach((obj: any) => {
          // Old 4-Line style previews (race-condition leftovers from prior code)
          if (obj._wallPreviews) {
            (obj._wallPreviews as any[]).forEach((s: any) => wallToRemove.push(s));
            wallToRemove.push(obj);
          }
          // New single-Rect style preview
          if (obj._isWallPreviewRect) {
            wallToRemove.push(obj);
          }
        });
        wallToRemove.forEach(obj => { try { canvas.remove(obj); } catch (_) {} });
        if (wallToRemove.length > 0) {
          previewLabelRef.current = null;
          canvas.requestRenderAll();
        }
      }
      // Clear ref so next wall-line session creates a fresh Rect
      if (previewShapeRef.current && ((previewShapeRef.current as any)._isWallPreviewRect || (previewShapeRef.current as any)._wallPreviews)) {
        previewShapeRef.current = null;
      }
    }
  }, [activeTool, calibrationMode]);

  // Clear calibration markers when calibration is complete
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Clear when calibration is complete
    if (isCalibrated) {
      // Remove all calibration objects
      calibrationObjects.forEach(obj => {
        try {
          canvas.remove(obj);
        } catch (e) {
          // Object may already be removed
        }
      });
      if (calibrationPreviewLine) {
        try {
          canvas.remove(calibrationPreviewLine);
        } catch (e) {
          // Preview line may already be removed
        }
        setCalibrationPreviewLine(null);
      }
      if (calibrationObjects.length > 0) {
        setCalibrationObjects([]);
        setCalibrationPoints([]);
        setCalibrationStartPoint(null);
        setIsCalibrationDragging(false);
      }
      canvas.requestRenderAll();
    }
  }, [isCalibrated, calibrationObjects, calibrationPreviewLine]);

  // Clear calibration visuals when exiting calibration mode (cancel)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (calibrationMode === null) {
      // Remove all calibration objects
      calibrationObjects.forEach(obj => {
        try {
          canvas.remove(obj);
        } catch (e) {
          // Object may already be removed
        }
      });
      if (calibrationPreviewLine) {
        try {
          canvas.remove(calibrationPreviewLine);
        } catch (e) {
          // Preview line may already be removed
        }
        setCalibrationPreviewLine(null);
      }
      if (calibrationObjects.length > 0) {
        setCalibrationObjects([]);
        setCalibrationPoints([]);
        setCalibrationStartPoint(null);
        setIsCalibrationDragging(false);
      }
      canvas.requestRenderAll();
    }
  }, [calibrationMode, calibrationObjects, calibrationPreviewLine]);

  // Zoom-aware sizes for consistent visual appearance
  const getZoomAwareSize = useCallback((baseSize: number) => {
    return baseSize / transform.zoom;
  }, [transform.zoom]);

  // Synchronously remove canvas objects for deleted measurements BEFORE the browser paints.
  // useEffect runs after paint, causing a visible ghost frame. useLayoutEffect runs before
  // paint, so the canvas is already clean when the user sees the screen update.
  useLayoutEffect(() => {
    measurementMapRef.current = new Map(measurements.map(m => [m.id, m]));
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const measurementIds = new Set(measurements.map(m => m.id));
    const objectsMap = measurementObjectsRef.current;
    const idsToRemove: string[] = [];
    const activeObj = canvas.getActiveObject();

    // Pass 1: objectsRef-based cleanup (the normal path)
    objectsMap.forEach((objects, id) => {
      if (!measurementIds.has(id)) {
        if (activeObj && objects.includes(activeObj as any)) {
          canvas.discardActiveObject();
        }
        objects.forEach((obj: any) => {
          canvas.remove(obj);
          shapeToMeasurementIdRef.current.delete(obj);
        });
        idsToRemove.push(id);
      }
    });
    idsToRemove.forEach(id => objectsMap.delete(id));

    // Pass 2: shapeRef-based sweep — catches canvas objects whose tracking entry
    // points to a deleted measurement but that slipped through Pass 1 (e.g. if
    // objectsRef was cleared imperatively without calling canvas.remove).
    const orphanObjs: any[] = [];
    canvas.getObjects().forEach((obj: any) => {
      const mid = shapeToMeasurementIdRef.current.get(obj);
      if (mid && !measurementIds.has(mid)) {
        orphanObjs.push(obj);
      }
    });
    orphanObjs.forEach(obj => {
      canvas.remove(obj);
      const mid = shapeToMeasurementIdRef.current.get(obj);
      if (mid) {
        shapeToMeasurementIdRef.current.delete(obj);
        measurementObjectsRef.current.delete(mid);
        measurementMapRef.current.delete(mid);
      }
    });

    // Always force-render so any stale `after:render` overlay (labels/hatches) is cleared
    // even when removeObjects() already cleaned the refs imperatively before this effect ran
    // and both idsToRemove and orphanObjs are empty.
    canvas.renderAll();
  }, [measurements]);

  // Sync canvas objects with measurements state:
  // 1. Remove canvas objects for deleted measurements
  // 2. Draw measurements that are in state but not yet on canvas (reload / tab-restore)
  // Note: measurements prop is pre-filtered to the current page by the parent component.
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !viewport) return;

    const measurementIds = new Set(measurements.map(m => m.id));
    const objectsMap = measurementObjectsRef.current;

    // Remove canvas objects for measurements that no longer exist in state
    const idsToRemove: string[] = [];
    const activeObj = canvas.getActiveObject();
    objectsMap.forEach((objects, id) => {
      if (!measurementIds.has(id)) {
        // If the active selection belongs to this deleted measurement, discard it
        // before removal — otherwise Fabric v6 leaves selection handles rendered
        // as a ghost on the next animation frame.
        if (activeObj && objects.includes(activeObj as any)) {
          canvas.discardActiveObject();
        }
        objects.forEach(obj => {
          canvas.remove(obj);
          shapeToMeasurementIdRef.current.delete(obj as any);
        });
        idsToRemove.push(id);
      }
    });
    idsToRemove.forEach(id => {
      objectsMap.delete(id);
    });

    // Draw measurements that are in state but not yet on canvas (page restore / reload).
    const strokeWidth = getZoomAwareSize(2);

    measurements.forEach(measurement => {
      if (objectsMap.has(measurement.id)) return; // already drawn
      if (!measurement.worldPoints || measurement.worldPoints.length < 2) return;

      const color = measurement.color || '#FF6B6B';
      let shape: any = null;

      if (measurement.type === 'line') {
        const [s, e] = measurement.worldPoints;
        if ((measurement as any).wallThickness && unitsPerMetreRef.current) {
          // Arc-wall restore (has arcControlPoint)
          if ((measurement as any).arcControlPoint && unitsPerMetreRef.current) {
            const ctrl = (measurement as any).arcControlPoint as WorldPoint;
            const geo = arcWallGeometry(s, e, ctrl, (measurement as any).wallThickness || 90, unitsPerMetreRef.current);
            const makeArcPath = (pts: { p1: WorldPoint; Q: WorldPoint; p2: WorldPoint }) =>
              `M ${pts.p1.x} ${pts.p1.y} Q ${pts.Q.x} ${pts.Q.y} ${pts.p2.x} ${pts.p2.y}`;
            const outerArc = new Path(makeArcPath(geo.outer), { stroke: color, strokeWidth: strokeWidth * 1.5, fill: '', selectable: false, evented: false });
            const innerArc = new Path(makeArcPath(geo.inner), { stroke: color, strokeWidth: strokeWidth * 1.5, fill: '', selectable: false, evented: false });
            const capS = new Line([geo.outer.p1.x, geo.outer.p1.y, geo.inner.p1.x, geo.inner.p1.y], { stroke: color, strokeWidth, selectable: false, evented: false });
            const capE = new Line([geo.outer.p2.x, geo.outer.p2.y, geo.inner.p2.x, geo.inner.p2.y], { stroke: color, strokeWidth, selectable: false, evented: false });
            (outerArc as any)._isWallSecondary = true;
            (innerArc as any)._isWallSecondary = true;
            (capS as any)._isWallSecondary = true;
            (capE as any)._isWallSecondary = true;
            [outerArc, innerArc, capS, capE].forEach(l => canvas.add(l));
            measurementObjectsRef.current.set(measurement.id, [outerArc, innerArc, capS, capE]);
            shapeToMeasurementIdRef.current.set(outerArc, measurement.id);
            shapeToMeasurementIdRef.current.set(innerArc, measurement.id);
            shapeToMeasurementIdRef.current.set(capS, measurement.id);
            shapeToMeasurementIdRef.current.set(capE, measurement.id);
            return;
          }
          // Restore wall-line as 5 fabric objects: [hitRect, wl1, wl2, wc1, wc2]
          const thickness = (measurement as any).wallThickness ?? 90;
          const geo = wallGeometry(s, e, thickness, unitsPerMetreRef.current);
          const hitRect = makeWallHitRect(s, e, thickness, unitsPerMetreRef.current, strokeWidth);
          const wl1 = new Line([geo.l1p1.x, geo.l1p1.y, geo.l1p2.x, geo.l1p2.y], { stroke: color, strokeWidth: strokeWidth * 1.5, selectable: false, evented: false, hasControls: false, hasBorders: false });
          const wl2 = new Line([geo.l2p1.x, geo.l2p1.y, geo.l2p2.x, geo.l2p2.y], { stroke: color, strokeWidth: strokeWidth * 1.5, selectable: false, evented: false });
          const wc1 = new Line([geo.l1p1.x, geo.l1p1.y, geo.l2p1.x, geo.l2p1.y], { stroke: color, strokeWidth, selectable: false, evented: false });
          const wc2 = new Line([geo.l1p2.x, geo.l1p2.y, geo.l2p2.x, geo.l2p2.y], { stroke: color, strokeWidth, selectable: false, evented: false });
          (wl1 as any)._isWallSecondary = true;
          (wl2 as any)._isWallSecondary = true;
          (wc1 as any)._isWallSecondary = true;
          (wc2 as any)._isWallSecondary = true;
          [hitRect, wl1, wl2, wc1, wc2].forEach(l => canvas.add(l));
          measurementObjectsRef.current.set(measurement.id, [hitRect, wl1, wl2, wc1, wc2]);
          shapeToMeasurementIdRef.current.set(hitRect, measurement.id);
          shapeToMeasurementIdRef.current.set(wl1, measurement.id);
          shapeToMeasurementIdRef.current.set(wl2, measurement.id);
          shapeToMeasurementIdRef.current.set(wc1, measurement.id);
          shapeToMeasurementIdRef.current.set(wc2, measurement.id);
          return; // skip the generic shape = ... and canvas.add(shape) below
        }
        const isRefLine = measurement.color === '#38bdf8';
        shape = new Line([s.x, s.y, e.x, e.y], {
          stroke: color,
          strokeWidth: isRefLine ? strokeWidth * 0.75 : strokeWidth,
          strokeDashArray: isRefLine ? [getZoomAwareSize(8), getZoomAwareSize(4)] : undefined,
          selectable: false,
          evented: false,
          hasControls: true,
          hasBorders: true,
          lockRotation: true,
          cornerColor: '#2563eb',
          cornerStyle: 'circle' as const,
          cornerSize: 10,
          transparentCorners: false,
          borderColor: '#2563eb',
        });
      } else if (measurement.type === 'rectangle') {
        const [s, e] = measurement.worldPoints;
        shape = new Rect({
          left: Math.min(s.x, e.x),
          top: Math.min(s.y, e.y),
          width: Math.abs(e.x - s.x),
          height: Math.abs(e.y - s.y),
          fill: color + '4d', stroke: color, strokeWidth,
          selectable: false, evented: false,
        });
      } else if (measurement.type === 'circle') {
        const [center, edge] = measurement.worldPoints;
        const dx = edge.x - center.x;
        const dy = edge.y - center.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        shape = new Circle({
          left: center.x - radius, top: center.y - radius, radius,
          fill: color + '4d', stroke: color, strokeWidth,
          selectable: false, evented: false,
        });
      } else if (measurement.type === 'polygon' && measurement.worldPoints.length >= 3) {
        const pts = measurement.worldPoints.map(p => new FabricPoint(p.x, p.y));
        shape = new Polygon(pts, {
          fill: color + '4d', stroke: color, strokeWidth,
          selectable: false, evented: false,
        });
      }

      if (!shape) return;

      canvas.add(shape);
      objectsMap.set(measurement.id, [shape]);
      shapeToMeasurementIdRef.current.set(shape, measurement.id);
    });

    canvas.requestRenderAll();
  }, [viewport, measurements, getZoomAwareSize]);

  // Draw colored markers on the canvas for detected openings (windows=blue, doors=amber).
  // PDF text coordinates have y=0 at the page bottom; canvas world space has y=0 at the top,
  // so we flip: worldY = viewport.height - opening.y. Only renders at rotation=0.
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !viewport) return;

    // Remove previous overlay objects
    openingOverlayObjectsRef.current.forEach(obj => {
      try { canvas.remove(obj); } catch (_) {}
    });
    openingOverlayObjectsRef.current = [];

    const pageOpenings = (detectedOpenings ?? []).filter(
      o => o.page === pageIndex && !(o.x === 0 && o.y === 0),
    );

    if (pageOpenings.length === 0) {
      canvas.requestRenderAll();
      return;
    }

    const RADIUS = 14; // fixed world-space radius — scales naturally with viewport zoom

    for (const opening of pageOpenings) {
      const worldX = opening.x;
      const worldY = viewport.height - opening.y;
      const isWindow = opening.type === 'window';
      const color = isWindow ? '#3B82F6' : '#F59E0B';

      const circle = new Circle({
        left: worldX - RADIUS,
        top: worldY - RADIUS,
        radius: RADIUS,
        fill: color + '33',
        stroke: color,
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });

      canvas.add(circle);
      openingOverlayObjectsRef.current.push(circle);
    }

    canvas.requestRenderAll();
  }, [detectedOpenings, pageIndex, viewport]);

  // Draw measurement labels natively on the canvas after Fabric renders objects.
  // This is more reliable than Fabric.js Text objects (which have v6 rendering quirks)
  // and automatically follows shapes when they are moved/resized.
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const drawLabels = (evt?: { ctx?: CanvasRenderingContext2D }) => {
      // Use the event ctx so export (toCanvasElement) gets labels drawn to its off-screen
      // canvas instead of the live display canvas. Falls back to contextContainer for
      // normal after:render calls.
      const ctx = (evt as any)?.ctx ?? ((canvas as any).contextContainer as CanvasRenderingContext2D);
      if (!ctx) return;
      const vt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      const zoom = vt[0] || 1;
      const panX = vt[4] || 0;
      const panY = vt[5] || 0;
      // During export Fabric sets enableRetinaScaling=false (DPR=1). Using
      // getRetinaScaling() instead of window.devicePixelRatio keeps the formula correct.
      const dpr = (canvas as any).getRetinaScaling?.() ?? (window.devicePixelRatio || 1);

      // Draw in raw physical pixels (identity transform) to avoid Fabric 6 DPR/CSS
      // ambiguity: viewportTransform pan is in CSS pixels but ctx.setTransform(dpr)
      // would double-scale it, displacing every label.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // World-coord → physical-pixel helpers (world * zoom + pan gives CSS pixel,
      // multiply by dpr gives physical canvas pixel).
      const tpx = (wx: number) => (wx * zoom + panX) * dpr;
      const tpy = (wy: number) => (wy * zoom + panY) * dpr;

      const fontSize = 10 * dpr;
      const dotR = 2.5 * dpr;

      ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const drawLabel = (text: string, worldAnchorX: number, worldAnchorY: number, color: string) => {
        const ax = tpx(worldAnchorX);
        const ay = tpy(worldAnchorY);
        const ly = ay - dotR - 3 * dpr;

        ctx.beginPath();
        ctx.arc(ax, ay, dotR, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = 'rgba(255,255,255,0.88)';
        ctx.lineJoin = 'round';
        ctx.strokeText(text, ax, ly);

        ctx.fillStyle = color;
        ctx.fillText(text, ax, ly);
      };

      // Door/window symbols — p1/p2 in world coords, converted inside
      const drawDoorSymbol = (p1: WorldPoint, p2: WorldPoint, color: string, subtype?: string) => {
        const x1 = tpx(p1.x), y1 = tpy(p1.y);
        const x2 = tpx(p2.x), y2 = tpy(p2.y);
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;
        // Cap symbol size so overlapping doors don't create a starburst.
        // symR ≤ 22 CSS px keeps the indicator compact at any zoom/door width.
        const symR = Math.min(len, 22 * dpr);
        const lineAngle = Math.atan2(dy, dx);
        ctx.save();
        ctx.strokeStyle = color + 'cc';
        ctx.lineWidth = 1 * dpr;
        if (subtype === 'Cavity Slider') {
          // Two parallel lines + bidirectional arrow
          const perpX = -dy / len, perpY = dx / len;
          const off = 4 * dpr;
          ctx.setLineDash([]);
          for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(x1 + perpX * off * s, y1 + perpY * off * s);
            ctx.lineTo(x2 + perpX * off * s, y2 + perpY * off * s);
            ctx.stroke();
          }
          const aSize = 6 * dpr;
          for (const [ax, ay, dir] of [[x1, y1, 1], [x2, y2, -1]] as [number, number, number][]) {
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax + Math.cos(lineAngle) * aSize * dir, ay + Math.sin(lineAngle) * aSize * dir);
            ctx.stroke();
          }
        } else if (subtype === 'Bi-fold') {
          ctx.setLineDash([]);
          const half = symR / 2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 + Math.cos(lineAngle - Math.PI / 4) * half, y1 + Math.sin(lineAngle - Math.PI / 4) * half);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 + Math.cos(lineAngle + Math.PI / 4) * half, y1 + Math.sin(lineAngle + Math.PI / 4) * half);
          ctx.stroke();
        } else if (subtype === 'French') {
          ctx.setLineDash([4 * dpr, 3 * dpr]);
          const half = symR / 2;
          ctx.beginPath(); ctx.arc(x1, y1, half, lineAngle, lineAngle + Math.PI / 2, false); ctx.stroke();
          ctx.beginPath(); ctx.arc(x2, y2, half, lineAngle + Math.PI, lineAngle + Math.PI * 1.5, false); ctx.stroke();
        } else if (subtype === 'Garage') {
          ctx.setLineDash([]);
          const perpX = -dy / len, perpY = dx / len;
          const nLines = 4;
          for (let i = 0; i <= nLines; i++) {
            const t = i / nLines;
            const bx = x1 + dx * t, by = y1 + dy * t;
            const off = 6 * dpr;
            ctx.beginPath();
            ctx.moveTo(bx + perpX * off, by + perpY * off);
            ctx.lineTo(bx - perpX * off, by - perpY * off);
            ctx.stroke();
          }
        } else if (subtype === 'Fire Door') {
          ctx.setLineDash([4 * dpr, 3 * dpr]);
          ctx.beginPath(); ctx.arc(x1, y1, symR, lineAngle, lineAngle + Math.PI / 2, false); ctx.stroke();
          ctx.setLineDash([]);
          const endAngle = lineAngle + Math.PI / 2;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + symR * Math.cos(endAngle), y1 + symR * Math.sin(endAngle)); ctx.stroke();
          ctx.fillStyle = color + 'cc';
          ctx.font = `bold ${Math.max(8 * dpr, symR * 0.55)}px system-ui`;
          ctx.textAlign = 'center';
          ctx.fillText('FD', (x1 + x1 + symR * Math.cos(endAngle)) / 2, (y1 + y1 + symR * Math.sin(endAngle)) / 2 - 4 * dpr);
        } else {
          // Default: Internal / Entry — compact quarter-circle swing indicator
          ctx.setLineDash([4 * dpr, 3 * dpr]);
          ctx.beginPath(); ctx.arc(x1, y1, symR, lineAngle, lineAngle + Math.PI / 2, false); ctx.stroke();
          ctx.setLineDash([]);
          const endAngle = lineAngle + Math.PI / 2;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + symR * Math.cos(endAngle), y1 + symR * Math.sin(endAngle));
          ctx.strokeStyle = color + '88'; ctx.stroke();
        }
        ctx.restore();
      };

      const drawWindowSymbol = (p1: WorldPoint, p2: WorldPoint, color: string, subtype?: string) => {
        const x1 = tpx(p1.x), y1 = tpy(p1.y);
        const x2 = tpx(p2.x), y2 = tpy(p2.y);
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const perpX = -dy / len, perpY = dx / len;
        ctx.save();
        ctx.strokeStyle = color + 'bb';
        ctx.lineWidth = 1 * dpr;
        if (subtype === 'Fixed') {
          ctx.lineWidth = 2.5 * dpr;
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        } else if (subtype === 'Louvre') {
          ctx.setLineDash([]);
          const nBars = Math.max(3, Math.round(len / (10 * dpr)));
          const offPx = 5 * dpr;
          for (let i = 0; i <= nBars; i++) {
            const t = i / nBars;
            const bx = x1 + dx * t, by = y1 + dy * t;
            ctx.beginPath();
            ctx.moveTo(bx + perpX * offPx, by + perpY * offPx);
            ctx.lineTo(bx - perpX * offPx, by - perpY * offPx);
            ctx.stroke();
          }
          for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(x1 + perpX * offPx * s, y1 + perpY * offPx * s);
            ctx.lineTo(x2 + perpX * offPx * s, y2 + perpY * offPx * s);
            ctx.stroke();
          }
        } else if (subtype === 'Skylight') {
          const offPx = 6 * dpr;
          ctx.setLineDash([]);
          for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(x1 + perpX * offPx * s, y1 + perpY * offPx * s);
            ctx.lineTo(x2 + perpX * offPx * s, y2 + perpY * offPx * s);
            ctx.stroke();
          }
          for (const pt of [{ x: x1, y: y1 }, { x: x2, y: y2 }]) {
            ctx.beginPath();
            ctx.moveTo(pt.x - perpX * offPx, pt.y - perpY * offPx);
            ctx.lineTo(pt.x + perpX * offPx, pt.y + perpY * offPx);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(x1 + perpX * offPx, y1 + perpY * offPx);
          ctx.lineTo(x2 - perpX * offPx, y2 - perpY * offPx);
          ctx.moveTo(x1 - perpX * offPx, y1 - perpY * offPx);
          ctx.lineTo(x2 + perpX * offPx, y2 + perpY * offPx);
          ctx.stroke();
        } else if (subtype === 'Sliding') {
          const offPx = 5 * dpr;
          ctx.setLineDash([]);
          for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(x1 + perpX * offPx * s, y1 + perpY * offPx * s);
            ctx.lineTo(x2 + perpX * offPx * s, y2 + perpY * offPx * s);
            ctx.stroke();
          }
          for (const pt of [{ x: x1, y: y1 }, { x: x2, y: y2 }]) {
            ctx.beginPath();
            ctx.moveTo(pt.x - perpX * offPx, pt.y - perpY * offPx);
            ctx.lineTo(pt.x + perpX * offPx, pt.y + perpY * offPx);
            ctx.stroke();
          }
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          const aLen = Math.min(len * 0.3, 15 * dpr);
          const ux = dx / len, uy = dy / len;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath();
          ctx.moveTo(mx - ux * aLen, my - uy * aLen);
          ctx.lineTo(mx + ux * aLen, my + uy * aLen);
          ctx.stroke();
          for (const [tip, dir] of [[{x: mx + ux * aLen, y: my + uy * aLen}, 1], [{x: mx - ux * aLen, y: my - uy * aLen}, -1]] as [{x:number;y:number}, number][]) {
            const aHead = 4 * dpr;
            ctx.beginPath();
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(tip.x - (ux * Math.cos(0.4) - uy * Math.sin(0.4)) * aHead * dir, tip.y - (uy * Math.cos(0.4) + ux * Math.sin(0.4)) * aHead * dir);
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(tip.x - (ux * Math.cos(-0.4) - uy * Math.sin(-0.4)) * aHead * dir, tip.y - (uy * Math.cos(-0.4) + ux * Math.sin(-0.4)) * aHead * dir);
            ctx.stroke();
          }
        } else {
          // Default: Awning / Casement — two parallel lines with end caps
          const offPx = 5 * dpr;
          ctx.setLineDash([]);
          for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(x1 + perpX * offPx * s, y1 + perpY * offPx * s);
            ctx.lineTo(x2 + perpX * offPx * s, y2 + perpY * offPx * s);
            ctx.stroke();
          }
          for (const pt of [{ x: x1, y: y1 }, { x: x2, y: y2 }]) {
            ctx.beginPath();
            ctx.moveTo(pt.x - perpX * offPx, pt.y - perpY * offPx);
            ctx.lineTo(pt.x + perpX * offPx, pt.y + perpY * offPx);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5 * dpr;
            ctx.stroke();
          }
        }
        ctx.restore();
      };

      // ── Pass 1: wall hatch fills (drawn before labels so labels sit on top) ──
      // Iterate measurementMapRef (rebuilt from props first) so deleted IDs are never hatched.
      measurementMapRef.current.forEach((hm, hatchId) => {
        if (!hm) return;
        const ht = (hm as any).wallHatchType as string | undefined;
        if (!ht || ht === 'none') return;
        if (!hm.wallThickness || !hm.worldPoints || hm.worldPoints.length < 2) return;

        const upm = unitsPerMetreRef.current || 1;
        const hp1 = hm.worldPoints[0];
        const hp2 = hm.worldPoints[1];
        const thkMm = hm.wallThickness;
        const isArc = !!(hm as any).arcControlPoint;
        const toS = (wx: number, wy: number) => ({ x: tpx(wx), y: tpy(wy) });

        ctx.save();
        ctx.setLineDash([]);

        let bbCorners: { x: number; y: number }[] = [];

        if (isArc) {
          const ctrl = (hm as any).arcControlPoint as WorldPoint;
          const g = arcWallGeometry(hp1, hp2, ctrl, thkMm, upm);
          const op1 = toS(g.outer.p1.x, g.outer.p1.y);
          const oQ  = toS(g.outer.Q.x,  g.outer.Q.y);
          const op2 = toS(g.outer.p2.x, g.outer.p2.y);
          const ip1 = toS(g.inner.p1.x, g.inner.p1.y);
          const iQ  = toS(g.inner.Q.x,  g.inner.Q.y);
          const ip2 = toS(g.inner.p2.x, g.inner.p2.y);
          ctx.beginPath();
          ctx.moveTo(op1.x, op1.y);
          ctx.quadraticCurveTo(oQ.x, oQ.y, op2.x, op2.y);
          ctx.lineTo(ip2.x, ip2.y);
          ctx.quadraticCurveTo(iQ.x, iQ.y, ip1.x, ip1.y);
          ctx.closePath();
          bbCorners = [op1, oQ, op2, ip1, iQ, ip2];
        } else {
          const g = wallGeometry(hp1, hp2, thkMm, upm);
          const c1 = toS(g.l1p1.x, g.l1p1.y);
          const c2 = toS(g.l1p2.x, g.l1p2.y);
          const c3 = toS(g.l2p2.x, g.l2p2.y);
          const c4 = toS(g.l2p1.x, g.l2p1.y);
          ctx.beginPath();
          ctx.moveTo(c1.x, c1.y);
          ctx.lineTo(c2.x, c2.y);
          ctx.lineTo(c3.x, c3.y);
          ctx.lineTo(c4.x, c4.y);
          ctx.closePath();
          bbCorners = [c1, c2, c3, c4];
        }
        ctx.clip();

        // Arc walls: straight hatch lines clipped by a curved boundary create
        // concentric-arc artifacts. Fill with the hatch base colour instead.
        if (isArc) {
          const arcFills: Record<string, string> = {
            masonry:      'rgba(160,115,64,0.18)',
            plasterboard: 'rgba(148,163,184,0.18)',
            'fire-rated': 'rgba(239,68,68,0.12)',
            insulation:   'rgba(252,211,77,0.18)',
            cladding:     'rgba(125,211,252,0.18)',
            'wet-area':   'rgba(59,130,246,0.18)',
            glazing:      'rgba(147,197,253,0.22)',
          };
          const fill = arcFills[ht] ?? 'rgba(128,128,128,0.12)';
          const xs2 = bbCorners.map(c => c.x);
          const ys2 = bbCorners.map(c => c.y);
          ctx.fillStyle = fill;
          ctx.fillRect(Math.min(...xs2), Math.min(...ys2), Math.max(...xs2) - Math.min(...xs2), Math.max(...ys2) - Math.min(...ys2));
          ctx.restore();
          return;
        }

        const xs = bbCorners.map(c => c.x);
        const ys = bbCorners.map(c => c.y);
        const bbX0 = Math.min(...xs), bbX1 = Math.max(...xs);
        const bbY0 = Math.min(...ys), bbY1 = Math.max(...ys);
        const bbW = bbX1 - bbX0, bbH = bbY1 - bbY0;

        const ax1h = tpx(hp1.x), ay1h = tpy(hp1.y);
        const ax2h = tpx(hp2.x), ay2h = tpy(hp2.y);
        const wallAngle = Math.atan2(ay2h - ay1h, ax2h - ax1h);
        const halfLen = Math.sqrt((ax2h - ax1h) ** 2 + (ay2h - ay1h) ** 2) / 2;
        const hwPx = (thkMm / 1000) * upm * zoom * dpr / 2;
        const midX = (ax1h + ax2h) / 2, midY = (ay1h + ay2h) / 2;

        // diagonal helper: draws lines of slope 1 (↘) covering the bbox
        const diagLines = (color: string, lw: number, sp: number) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = lw;
          const cMin = bbX0 - bbY1 - sp;
          const cMax = bbX1 - bbY0 + sp;
          for (let c = cMin; c <= cMax; c += sp) {
            ctx.beginPath();
            ctx.moveTo(c + bbY0, bbY0);
            ctx.lineTo(c + bbY1, bbY1);
            ctx.stroke();
          }
        };

        if (ht === 'masonry') {
          const bH = Math.max(hwPx * 0.55, 3 * dpr);
          if (bH >= 2) {
            const bW = bH * 2.5;
            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(wallAngle);
            ctx.strokeStyle = '#a07340';
            ctx.fillStyle = 'rgba(200,170,130,0.07)';
            ctx.lineWidth = 0.75 * dpr;
            let row = 0;
            for (let y = -hwPx; y < hwPx; y += bH, row++) {
              const off = (row % 2) * bW * 0.5;
              ctx.beginPath(); ctx.moveTo(-halfLen, y); ctx.lineTo(halfLen, y); ctx.stroke();
              for (let x = -halfLen - off; x <= halfLen + bW; x += bW) {
                const rb = Math.min(y + bH, hwPx);
                ctx.fillRect(x, y + 0.5, bW - 0.8, rb - y - 0.8);
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, rb); ctx.stroke();
              }
            }
            ctx.beginPath(); ctx.moveTo(-halfLen, hwPx); ctx.lineTo(halfLen, hwPx); ctx.stroke();
            ctx.restore();
          }
        } else if (ht === 'plasterboard') {
          const stripH = Math.max(hwPx * 0.28, 2.5 * dpr);
          const sp2 = Math.max(3 * dpr, stripH * 0.55);
          const side = (hm as any).wallHatchSide as string || 'both';
          const strips: number[] = [];
          if (side === 'l1' || side === 'both') strips.push(-hwPx);
          if (side === 'l2' || side === 'both') strips.push(hwPx - stripH);
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(wallAngle);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 0.7 * dpr;
          for (const sY0 of strips) {
            const sY1 = sY0 + stripH;
            ctx.save();
            ctx.beginPath();
            ctx.rect(-halfLen, sY0, halfLen * 2, stripH + 0.5);
            ctx.clip();
            ctx.fillStyle = 'rgba(148,163,184,0.15)';
            ctx.fillRect(-halfLen, sY0, halfLen * 2, stripH);
            for (let c = -halfLen - stripH - sp2; c <= halfLen + sp2; c += sp2) {
              ctx.beginPath();
              ctx.moveTo(c + sY0, sY0);
              ctx.lineTo(c + sY1, sY1);
              ctx.stroke();
            }
            ctx.restore();
          }
          ctx.restore();
        } else if (ht === 'fire-rated') {
          ctx.fillStyle = 'rgba(239,68,68,0.07)';
          ctx.fillRect(bbX0, bbY0, bbW, bbH);
          diagLines('#fca5a5', 0.7 * dpr, 4 * dpr);
        } else if (ht === 'insulation') {
          const wvSp = Math.max(hwPx * 0.45, 4 * dpr);
          const wvA  = wvSp * 0.38;
          const wvP  = wvSp * 2.2;
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(wallAngle);
          ctx.strokeStyle = '#fcd34d';
          ctx.lineWidth = 1 * dpr;
          for (let y = -hwPx + wvSp * 0.5; y < hwPx; y += wvSp) {
            ctx.beginPath();
            let first = true;
            for (let x = -halfLen; x <= halfLen; x += 1.5) {
              const wy = y + Math.sin((x / wvP) * Math.PI * 2) * wvA;
              first ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy);
              first = false;
            }
            ctx.stroke();
          }
          ctx.restore();
        } else if (ht === 'cladding') {
          const stripH = Math.max(hwPx * 0.22, 2 * dpr);
          const sideClad = (hm as any).wallHatchSide as string || 'l1';
          const strips: number[] = [];
          if (sideClad === 'l1' || sideClad === 'both') strips.push(-hwPx);
          if (sideClad === 'l2' || sideClad === 'both') strips.push(hwPx - stripH);
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(wallAngle);
          ctx.strokeStyle = '#7dd3fc';
          ctx.lineWidth = 0.8 * dpr;
          for (const sY0 of strips) {
            const sY1 = sY0 + stripH;
            ctx.save();
            ctx.beginPath();
            ctx.rect(-halfLen, sY0, halfLen * 2, stripH + 0.5);
            ctx.clip();
            ctx.fillStyle = 'rgba(125,211,252,0.15)';
            ctx.fillRect(-halfLen, sY0, halfLen * 2, stripH);
            const lineGap = Math.max(1.8 * dpr, stripH / 3);
            for (let y = sY0 + lineGap; y < sY1; y += lineGap) {
              ctx.beginPath(); ctx.moveTo(-halfLen, y); ctx.lineTo(halfLen, y); ctx.stroke();
            }
            ctx.restore();
          }
          ctx.restore();
        } else if (ht === 'wet-area') {
          const stripH = Math.max(hwPx * 0.28, 2.5 * dpr);
          const sp2 = Math.max(3 * dpr, stripH * 0.55);
          const sideWet = (hm as any).wallHatchSide as string || 'l1';
          const strips: number[] = [];
          if (sideWet === 'l1' || sideWet === 'both') strips.push(-hwPx);
          if (sideWet === 'l2' || sideWet === 'both') strips.push(hwPx - stripH);
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(wallAngle);
          ctx.strokeStyle = 'rgba(59,130,246,0.65)';
          ctx.lineWidth = 0.7 * dpr;
          for (const sY0 of strips) {
            const sY1 = sY0 + stripH;
            ctx.save();
            ctx.beginPath();
            ctx.rect(-halfLen, sY0, halfLen * 2, stripH + 0.5);
            ctx.clip();
            ctx.fillStyle = 'rgba(59,130,246,0.15)';
            ctx.fillRect(-halfLen, sY0, halfLen * 2, stripH);
            for (let c = -halfLen - stripH - sp2; c <= halfLen + sp2; c += sp2) {
              ctx.beginPath();
              ctx.moveTo(c + sY0, sY0);
              ctx.lineTo(c + sY1, sY1);
              ctx.stroke();
            }
            ctx.restore();
          }
          ctx.restore();
        } else if (ht === 'glazing') {
          // X pattern (two diagonal directions)
          diagLines('rgba(147,197,253,0.80)', 1.5 * dpr, 14 * dpr);
          // Also draw ↗ direction
          ctx.lineWidth = 1.5 * dpr;
          ctx.strokeStyle = 'rgba(147,197,253,0.80)';
          const sp = 14 * dpr;
          const cMin = bbX0 + bbY0 - sp;
          const cMax = bbX1 + bbY1 + sp;
          for (let c = cMin; c <= cMax; c += sp) {
            ctx.beginPath();
            ctx.moveTo(c - bbY0, bbY0);
            ctx.lineTo(c - bbY1, bbY1);
            ctx.stroke();
          }
        }

        ctx.restore();
      });

      // ── Pass 2: labels, symbols, endpoint squares ────────────────────────
      // ── Render each measurement ──────────────────────────────────────────
      measurementObjectsRef.current.forEach((objects, measurementId) => {
        const measurement = measurementMapRef.current.get(measurementId);
        if (!measurement) return;
        const shape = objects[0];
        if (!shape) return;

        // Default anchor: shape center in world coords
        const center = shape.getCenterPoint();
        let worldAnchorX = center.x;
        let worldAnchorY = center.y;

        // Arc-wall: use worldPoints midpoint (Path bounding-box center drifts)
        if ((measurement as any).arcControlPoint && measurement.worldPoints?.length >= 2) {
          worldAnchorX = (measurement.worldPoints[0].x + measurement.worldPoints[1].x) / 2;
          worldAnchorY = (measurement.worldPoints[0].y + measurement.worldPoints[1].y) / 2;
        }

        const mType = (measurement as any).measurementType as string | undefined;
        const lbl = measurement.label || '';
        const isModMarkup =
          mType === 'Wall' || mType === 'Door' || mType === 'Window' ||
          lbl.startsWith('Wall ') || lbl === 'Wall' ||
          lbl.startsWith('Door ') || lbl === 'Door' ||
          lbl.startsWith('Window ') || lbl === 'Window';

        // Fabric v6 Line type is 'Line' (capital L). Use calcLinePoints()+calcTransformMatrix()
        // so the anchor is always correct even if the object was scaled or repositioned.
        const fabricLineLocalPts = (shape as any).calcLinePoints?.();
        if (fabricLineLocalPts && measurement.worldPoints?.length >= 2) {
          const mat = (shape as any).calcTransformMatrix();
          const wP1: WorldPoint = fabricUtil.transformPoint({ x: fabricLineLocalPts.x1, y: fabricLineLocalPts.y1 }, mat);
          const wP2: WorldPoint = fabricUtil.transformPoint({ x: fabricLineLocalPts.x2, y: fabricLineLocalPts.y2 }, mat);
          const dx = wP2.x - wP1.x;
          const dy = wP2.y - wP1.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = -dy / len;
          const perpY = dx / len;
          // 8 CSS-px perpendicular offset expressed in world units
          const worldOffset = 8 / zoom;
          const sideSign = perpY <= 0 ? 1 : -1;
          worldAnchorX = (wP1.x + wP2.x) / 2 + perpX * worldOffset * sideSign;
          worldAnchorY = (wP1.y + wP2.y) / 2 + perpY * worldOffset * sideSign;

          // Endpoint squares (3 CSS px)
          const sqR = 3 * dpr;
          ctx.fillStyle = measurement.color || '#FF6B6B';
          ctx.fillRect(tpx(wP1.x) - sqR, tpy(wP1.y) - sqR, sqR * 2, sqR * 2);
          ctx.fillRect(tpx(wP2.x) - sqR, tpy(wP2.y) - sqR, sqR * 2, sqR * 2);

          const isDoor = mType === 'Door' || lbl.startsWith('Door ') || lbl.startsWith('Door—') || lbl === 'Door';
          const isWindow = mType === 'Window' || lbl.startsWith('Window ') || lbl.startsWith('Window—') || lbl === 'Window';
          if (isDoor) drawDoorSymbol(wP1, wP2, measurement.color || '#8b5cf6', (measurement as any).modSubtype);
          else if (isWindow) drawWindowSymbol(wP1, wP2, measurement.color || '#06b6d4', (measurement as any).modSubtype);
        } else if ((measurement as any).type === 'count') {
          let sx = 0, sy = 0;
          objects.forEach(o => { const c = o.getCenterPoint(); sx += c.x; sy += c.y; });
          worldAnchorX = sx / objects.length;
          worldAnchorY = sy / objects.length;
        }

        if (measurement.label && !isModMarkup) {
          drawLabel(measurement.label, worldAnchorX, worldAnchorY, measurement.color || '#FF6B6B');
        }

        if ((measurement as any).type === 'count') {
          ctx.fillStyle = 'white';
          ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          objects.forEach((obj, i) => {
            const c = obj.getCenterPoint();
            ctx.fillText(String(i + 1), tpx(c.x), tpy(c.y));
          });
        }
      });

      if (previewLabelRef.current) {
        const { text, worldX, worldY, color } = previewLabelRef.current;
        drawLabel(text, worldX, worldY, color);
      }

      // Draw perpendicular-snap guide (dashed cyan line through the snapped endpoint)
      const snapGuide = perpSnapRef.current;
      if (snapGuide) {
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(tpx(snapGuide.from.x), tpy(snapGuide.from.y));
        ctx.lineTo(tpx(snapGuide.to.x), tpy(snapGuide.to.y));
        ctx.stroke();
        ctx.restore();
      }

      // Draw midpoint-snap triangle indicator (yellow triangle = AutoCAD midpoint style)
      const midSnap = midpointSnapRef.current;
      if (midSnap) {
        const cx = tpx(midSnap.x), cy = tpy(midSnap.y);
        const s = 7 * dpr;
        ctx.save();
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s, cy + s * 0.7);
        ctx.lineTo(cx - s, cy + s * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Feature 1: Endpoint snap indicator — cyan circle with cross
      const epSnap = endpointSnapIndicatorRef.current;
      if (epSnap) {
        const cx = tpx(epSnap.x), cy = tpy(epSnap.y);
        const r = 8 * dpr;
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2 * dpr;
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.4, cy); ctx.lineTo(cx + r * 0.4, cy);
        ctx.moveTo(cx, cy - r * 0.4); ctx.lineTo(cx, cy + r * 0.4);
        ctx.stroke();
        ctx.restore();
      }

      // Feature 2: Arc wall control-point handles (orange diamond, always visible)
      measurementMapRef.current.forEach((m) => {
        const ctrl = (m as any).arcControlPoint as WorldPoint | undefined;
        if (!ctrl || !m.worldPoints || m.worldPoints.length < 2) return;
        const cx = tpx(ctrl.x), cy = tpy(ctrl.y);
        const s = 6 * dpr;
        ctx.save();
        ctx.fillStyle = arcDragRef.current?.id === m.id ? '#fb923c' : '#f97316cc';
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      });

      // Feature 3: Squareness indicator — green square symbol where walls meet at ~90°
      {
        const walls = Array.from(measurementMapRef.current.values()).filter(
          m => !!(m as any).wallThickness && m.worldPoints?.length >= 2
        );
        const snapThresh = 18 / zoom;
        for (let i = 0; i < walls.length; i++) {
          for (let j = i + 1; j < walls.length; j++) {
            const mA = walls[i], mB = walls[j];
            for (const epA of mA.worldPoints) {
              for (const epB of mB.worldPoints) {
                if (Math.hypot(epA.x - epB.x, epA.y - epB.y) > snapThresh) continue;
                const otherA = mA.worldPoints.find((ep: WorldPoint) => ep !== epA) || mA.worldPoints[1];
                const otherB = mB.worldPoints.find((ep: WorldPoint) => ep !== epB) || mB.worldPoints[1];
                const angleA = Math.atan2(otherA.y - epA.y, otherA.x - epA.x);
                const angleB = Math.atan2(otherB.y - epB.y, otherB.x - epB.x);
                let diff = Math.abs(angleA - angleB);
                while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
                if (Math.abs(diff - Math.PI / 2) < (6 * Math.PI / 180)) {
                  const sx = tpx(epA.x), sy = tpy(epA.y);
                  const sqS = 7 * dpr;
                  ctx.save();
                  ctx.translate(sx, sy);
                  ctx.rotate(angleA);
                  ctx.strokeStyle = '#22c55e';
                  ctx.lineWidth = 1.5 * dpr;
                  ctx.setLineDash([]);
                  ctx.beginPath();
                  ctx.moveTo(sqS, 0); ctx.lineTo(sqS, sqS); ctx.lineTo(0, sqS);
                  ctx.stroke();
                  ctx.restore();
                }
              }
            }
          }
        }
      }

      ctx.restore();
    };

    canvas.on('after:render', drawLabels);
    return () => { canvas.off('after:render', drawLabels); };
  // Re-register whenever measurements change so the suppression list stays current.
  // The function itself only reads refs — no stale-closure risk.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurements]);

  // Toggle selection mode on shapes when tool changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const isSelectMode = activeTool === 'select';

    // Update measurement objects' selectability.
    // IMPORTANT: Skip Text labels entirely — calling .set() on Text with
    // control-related properties (cornerSize, borderScaleFactor, etc.) can
    // interfere with Fabric.js v6 text rendering and make labels invisible.
    // Labels are always non-interactive; only primary shapes get resize handles.
    measurementObjectsRef.current.forEach((objects) => {
      objects.forEach(obj => {
        if (!obj || typeof obj.set !== 'function') return;
        if (obj.type === 'text' || obj.type === 'i-text') return;

        // Wall companion lines are always non-interactive; only wl1 (_isWallPrimary) gets handles
        if ((obj as any)._isWallSecondary) {
          obj.set({ selectable: false, evented: false, hasControls: false, hasBorders: false });
          return;
        }

        if ((obj as any)._isCountMarker) {
          // Count markers: movable but NOT resizable
          obj.set({
            selectable: isSelectMode,
            evented: isSelectMode,
            hasControls: false,   // no resize handles
            hasBorders: isSelectMode,
            lockRotation: true,
            lockScalingX: true,
            lockScalingY: true,
            borderColor: '#2563eb',
            borderScaleFactor: 2,
          });
        } else {
          obj.set({
            selectable: isSelectMode,
            evented: isSelectMode,
            hasControls: isSelectMode,
            hasBorders: isSelectMode,
            lockRotation: true,
            cornerColor: '#2563eb',
            cornerStyle: 'circle',
            cornerSize: 10,
            transparentCorners: false,
            borderColor: '#2563eb',
            borderScaleFactor: 2,
          });
        }
      });
    });

    // Update canvas selection setting
    canvas.selection = isSelectMode;

    // Set cursor based on mode
    if (isSelectMode) {
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
    }

    canvas.requestRenderAll();
  }, [activeTool]);

  // Fire onMeasurementSelect when a shape is clicked in select mode
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !onMeasurementSelect) return;

    const handleSelection = (e: any) => {
      if (activeTool !== 'select') return;
      const target = e.selected?.[0] ?? e.target;
      if (!target) return;
      const measurementId = shapeToMeasurementIdRef.current.get(target);
      if (!measurementId) return;
      // Get screen position from the native mouse event if available
      const nativeEvent = e.e as MouseEvent | undefined;
      const screenX = nativeEvent?.clientX ?? 0;
      const screenY = nativeEvent?.clientY ?? 0;
      onMeasurementSelect(measurementId, screenX, screenY);
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    return () => {
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
    };
  }, [activeTool, onMeasurementSelect]);

  // Handle object modification (resize/move) to update measurements
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !onMeasurementUpdate) return;

    const handleObjectModified = (e: any) => {
      const target = e.target;
      if (!target) return;

      const measurementId = shapeToMeasurementIdRef.current.get(target);
      if (!measurementId) return;

      // Count marker moved — update its world position and re-emit measurement
      if ((target as any)._isCountMarker) {
        const objects = measurementObjectsRef.current.get(measurementId);
        const measurement = measurementMapRef.current.get(measurementId);
        if (!objects || !measurement) return;

        const markerIndex = objects.indexOf(target);
        if (markerIndex === -1) return;

        const center = target.getCenterPoint();
        const newWorldPoints = [...measurement.worldPoints] as WorldPoint[];
        newWorldPoints[markerIndex] = { x: center.x, y: center.y };

        const countName = (measurement as any).countName ?? 'Custom';
        const labelName = countName === 'Custom' ? 'Items' : countName;
        const labelText = `${newWorldPoints.length} × ${labelName}`;

        onMeasurementUpdate(measurementId, {
          worldPoints: newWorldPoints,
          label: labelText,
        });

        // Snap position to exact center (remove any accidental scale drift)
        const r = (target as any).radius || 0;
        target.set({ left: center.x - r, top: center.y - r, scaleX: 1, scaleY: 1 });
        target.setCoords();
        canvas.requestRenderAll();
        return;
      }

      const effectiveUnits = unitsPerMetre || 1;
      const objects = measurementObjectsRef.current.get(measurementId);

      // Get the transformed coordinates
      // Fabric v6 Line type is 'Line' (capital L). Use calcLinePoints() for local coords —
      // target.x1/y1 are the original world coords, not local, so transformPoint with them
      // would double-offset by the center translation.
      if ((target as any).calcLinePoints) {
        const matrix = target.calcTransformMatrix();
        const localPts = (target as any).calcLinePoints();
        const p1 = fabricUtil.transformPoint({ x: localPts.x1, y: localPts.y1 }, matrix);
        const p2 = fabricUtil.transformPoint({ x: localPts.x2, y: localPts.y2 }, matrix);

        const existingMeasurement = measurementMapRef.current.get(measurementId);
        const isWallPrimary = (target as any)._isWallPrimary;

        // For wall-lines wl1 sits at axis+normal*hw; derive axis to keep worldPoints
        // as centerline coords (used by wallGeometry on restore).
        let startPoint: WorldPoint;
        let endPoint: WorldPoint;
        if (isWallPrimary && (existingMeasurement as any)?.wallThickness) {
          const dx = p2.x - p1.x, dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = -dy / len, ny = dx / len;
          const upm = effectiveUnits;
          const hw = ((existingMeasurement as any).wallThickness / 1000) * upm / 2;
          startPoint = { x: p1.x - nx * hw, y: p1.y - ny * hw };
          endPoint   = { x: p2.x - nx * hw, y: p2.y - ny * hw };
          // Sync companion objects immediately after commit
          if (objects) syncWallCompanions(target, objects, (existingMeasurement as any).wallThickness, upm);
        } else {
          startPoint = { x: p1.x, y: p1.y };
          endPoint   = { x: p2.x, y: p2.y };
        }

        const result = calculateLinearWorld(startPoint, endPoint, effectiveUnits);

        // Wall/Door/Window keep empty labels so no text appears on canvas
        const mTypeForLabel = (existingMeasurement as any)?.measurementType as string | undefined;
        const isModLine = mTypeForLabel === 'Wall' || mTypeForLabel === 'Door' || mTypeForLabel === 'Window';
        const labelText = isModLine
          ? ''
          : (isCalibrated ? `${result.realValue.toFixed(2)} m` : `${result.worldValue.toFixed(0)} px`);

        onMeasurementUpdate(measurementId, {
          worldPoints: [startPoint, endPoint],
          worldValue: result.worldValue,
          realValue: isCalibrated ? result.realValue : result.worldValue,
          label: labelText,
        });

        // Don't touch the line's internal x1/y1/x2/y2 — setting them triggers
        // Fabric's _setWidthHeight() which treats them as absolute coords and
        // collapses the line. Just refresh hit-testing coords and let Fabric
        // render the scaled line correctly. calcTransformMatrix() always gives
        // correct endpoint positions regardless of scale state.
        target.setCoords();

      } else if (target.type === 'rect' && (target as any)._isWallPrimary) {
        // Wall hit-rect modified (moved or length-resized). Extract new axis from rect geometry.
        const existingMeasurement = measurementMapRef.current.get(measurementId);
        const wallThickness = (existingMeasurement as any)?.wallThickness ?? 90;
        const angle = (target.angle ?? 0) * Math.PI / 180;
        const cx: number = target.left;
        const cy: number = target.top;
        const halfLength = (target.width * (target.scaleX ?? 1)) / 2;
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const axisP1: WorldPoint = { x: cx - cosA * halfLength, y: cy - sinA * halfLength };
        const axisP2: WorldPoint = { x: cx + cosA * halfLength, y: cy + sinA * halfLength };

        // Absorb scaleX into width so scale resets to 1
        target.set({ width: target.width * (target.scaleX ?? 1), scaleX: 1 });
        target.setCoords();

        if (objects) syncWallFromRect(target, objects, wallThickness, effectiveUnits);

        const result = calculateLinearWorld(axisP1, axisP2, effectiveUnits);
        onMeasurementUpdate(measurementId, {
          worldPoints: [axisP1, axisP2],
          worldValue: result.worldValue,
          realValue: isCalibrated ? result.realValue : result.worldValue,
          label: '',
        });

      } else if (target.type === 'rect') {
        // For rectangles, calculate from bounding box after transform
        const left = target.left;
        const top = target.top;
        const width = target.width * target.scaleX;
        const height = target.height * target.scaleY;

        const startPoint: WorldPoint = { x: left, y: top };
        const endPoint: WorldPoint = { x: left + width, y: top + height };
        const result = calculateRectangleAreaWorld(startPoint, endPoint, effectiveUnits);

        const labelText = isCalibrated ? `${result.realValue.toFixed(2)} m²` : `${result.worldValue.toFixed(0)} px²`;

        onMeasurementUpdate(measurementId, {
          worldPoints: [startPoint, endPoint],
          worldValue: result.worldValue,
          realValue: isCalibrated ? result.realValue : result.worldValue,
          dimensions: result.dimensions,
          label: labelText,
        });

        // Reset scale and apply size directly
        target.set({
          width: width,
          height: height,
          scaleX: 1,
          scaleY: 1,
        });
        target.setCoords();

      } else if (target.type === 'circle') {
        // For circles, calculate from radius
        const centerX = target.left + target.radius * target.scaleX;
        const centerY = target.top + target.radius * target.scaleY;
        const radius = target.radius * Math.max(target.scaleX, target.scaleY);

        const startPoint: WorldPoint = { x: centerX, y: centerY };
        const endPoint: WorldPoint = { x: centerX + radius, y: centerY };
        const result = calculateCircleAreaWorld(startPoint, endPoint, effectiveUnits);

        const labelText = isCalibrated ? `${result.realValue.toFixed(2)} m²` : `${result.worldValue.toFixed(0)} px²`;

        onMeasurementUpdate(measurementId, {
          worldPoints: [startPoint, endPoint],
          worldValue: result.worldValue,
          realValue: isCalibrated ? result.realValue : result.worldValue,
          label: labelText,
        });

        // Reset scale and apply radius directly
        target.set({
          radius: radius,
          left: centerX - radius,
          top: centerY - radius,
          scaleX: 1,
          scaleY: 1,
        });
        target.setCoords();

      } else if (target.type === 'polygon') {
        // For polygons, update the label position when moved.
        // Fabric.js stores polygon points relative to its origin, so get
        // actual world positions by applying the transform matrix.
        const matrix = target.calcTransformMatrix();
        const rawPoints: { x: number; y: number }[] = (target as any).points || [];
        const worldPts: WorldPoint[] = rawPoints.map((p: { x: number; y: number }) => {
          const tp = fabricUtil.transformPoint({ x: p.x, y: p.y }, matrix);
          return { x: tp.x, y: tp.y };
        });

        const boundingRect = target.getBoundingRect();
        const centerX = boundingRect.left + boundingRect.width / 2;
        const centerY = boundingRect.top + boundingRect.height / 2;

        if (worldPts.length >= 3) {
          const result = calculatePolygonAreaWorld(worldPts, effectiveUnits);
          const labelText = isCalibrated ? `${result.realValue.toFixed(2)} m²` : `${result.worldValue.toFixed(0)} px²`;

          onMeasurementUpdate(measurementId, {
            worldPoints: worldPts,
            worldValue: result.worldValue,
            realValue: isCalibrated ? result.realValue : result.worldValue,
            label: labelText,
          });
        }
      }

      canvas.requestRenderAll();
    };

    canvas.on('object:modified', handleObjectModified);

    return () => {
      canvas.off('object:modified', handleObjectModified);
    };
  }, [onMeasurementUpdate, unitsPerMetre, isCalibrated]);

  // Live sync of wall companion objects (wl2, cap1, cap2) while dragging wl1.
  // Without this the 4 independent Fabric lines separate during a move/scale.
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const syncWall = (e: any) => {
      const target = e.target;
      if (!target || !(target as any)._isWallPrimary) return;
      const measurementId = shapeToMeasurementIdRef.current.get(target);
      if (!measurementId) return;
      const objects = measurementObjectsRef.current.get(measurementId);
      const measurement = measurementMapRef.current.get(measurementId);
      if (!objects || !measurement) return;
      const upm = unitsPerMetreRef.current || 1;
      const thickness = (measurement as any).wallThickness ?? 90;
      syncWallFromRect(target, objects, thickness, upm);
      canvas.requestRenderAll();
    };

    canvas.on('object:moving', syncWall);
    canvas.on('object:scaling', syncWall);

    return () => {
      canvas.off('object:moving', syncWall);
      canvas.off('object:scaling', syncWall);
    };
  }, []);

  // Live measurement label during resize / move — updates previewLabelRef on every
  // object:scaling / object:moving frame so after:render draws the live value.
  // object:modified clears it (shape committed, static label takes over).
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const getLiveLabel = (target: any): { text: string; worldX: number; worldY: number; color: string } | null => {
      const measurementId = shapeToMeasurementIdRef.current.get(target);
      if (!measurementId) return null;
      const measurement = measurementMapRef.current.get(measurementId);
      if (!measurement) return null;
      if ((target as any)._isCountMarker) return null; // count markers don't show area label

      const effectiveUnits = unitsPerMetre || 1;
      const color = measurement.color || '#FF6B6B';

      let text = '';
      let worldX = 0;
      let worldY = 0;

      if ((target as any).calcLinePoints) {
        const matrix = target.calcTransformMatrix();
        const localPts = (target as any).calcLinePoints();
        const p1 = fabricUtil.transformPoint({ x: localPts.x1, y: localPts.y1 }, matrix);
        const p2 = fabricUtil.transformPoint({ x: localPts.x2, y: localPts.y2 }, matrix);
        const sp: WorldPoint = { x: p1.x, y: p1.y };
        const ep: WorldPoint = { x: p2.x, y: p2.y };
        const result = calculateLinearWorld(sp, ep, effectiveUnits);
        text = isCalibrated ? `${result.realValue.toFixed(2)} m` : `${result.worldValue.toFixed(0)} px`;
        // Offset label perpendicular to line
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const zoom = canvas.getZoom() || 1;
        const offset = 14 / zoom;
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        worldX = midX + (-dy / len) * offset;
        worldY = midY + (dx / len) * offset;

      } else if (target.type === 'rect') {
        const width = target.width * target.scaleX;
        const height = target.height * target.scaleY;
        const sp: WorldPoint = { x: target.left, y: target.top };
        const ep: WorldPoint = { x: target.left + width, y: target.top + height };
        const result = calculateRectangleAreaWorld(sp, ep, effectiveUnits);
        text = isCalibrated ? `${result.realValue.toFixed(2)} m²` : `${result.worldValue.toFixed(0)} px²`;
        const center = target.getCenterPoint();
        worldX = center.x;
        worldY = center.y;

      } else if (target.type === 'circle') {
        const radius = target.radius * Math.max(target.scaleX, target.scaleY);
        const centerX = target.left + target.radius * target.scaleX;
        const centerY = target.top + target.radius * target.scaleY;
        const sp: WorldPoint = { x: centerX, y: centerY };
        const ep: WorldPoint = { x: centerX + radius, y: centerY };
        const result = calculateCircleAreaWorld(sp, ep, effectiveUnits);
        text = isCalibrated ? `${result.realValue.toFixed(2)} m²` : `${result.worldValue.toFixed(0)} px²`;
        const center = target.getCenterPoint();
        worldX = center.x;
        worldY = center.y;

      } else if (target.type === 'polygon') {
        const matrix = target.calcTransformMatrix();
        const rawPoints: { x: number; y: number }[] = (target as any).points || [];
        const worldPts: WorldPoint[] = rawPoints.map((p: { x: number; y: number }) => {
          const tp = fabricUtil.transformPoint({ x: p.x, y: p.y }, matrix);
          return { x: tp.x, y: tp.y };
        });
        if (worldPts.length >= 3) {
          const result = calculatePolygonAreaWorld(worldPts, effectiveUnits);
          text = isCalibrated ? `${result.realValue.toFixed(2)} m²` : `${result.worldValue.toFixed(0)} px²`;
        }
        const center = target.getCenterPoint();
        worldX = center.x;
        worldY = center.y;

      } else {
        return null;
      }

      if (!text) return null;
      return { text, worldX, worldY, color };
    };

    const handleLiveTransform = (e: any) => {
      const target = e.target;
      if (!target) return;
      const label = getLiveLabel(target);
      previewLabelRef.current = label;
      canvas.requestRenderAll();
    };

    const handleModifiedClear = () => {
      previewLabelRef.current = null;
      // requestRenderAll is already called by handleObjectModified
    };

    canvas.on('object:scaling', handleLiveTransform);
    canvas.on('object:moving', handleLiveTransform);
    canvas.on('object:modified', handleModifiedClear);

    return () => {
      canvas.off('object:scaling', handleLiveTransform);
      canvas.off('object:moving', handleLiveTransform);
      canvas.off('object:modified', handleModifiedClear);
    };
  }, [unitsPerMetre, isCalibrated]);

  // Delete key — remove a single selected count marker and update the count
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: cancel arc-wall drawing in progress
      if (e.key === 'Escape' && arcStateRef.current.phase !== 0) {
        arcStateRef.current = { phase: 0, p1: null, p2: null };
        const canvas = fabricCanvasRef.current;
        if (canvas) {
          if (arcMarkerRef.current) {
            try { canvas.remove(arcMarkerRef.current); } catch (_) {}
            arcMarkerRef.current = null;
          }
          const toRemove: any[] = [];
          canvas.getObjects().forEach((obj: any) => {
            if (obj._arcPreviews) {
              (obj._arcPreviews as any[]).forEach((s: any) => toRemove.push(s));
              toRemove.push(obj);
            }
          });
          toRemove.forEach(obj => { try { canvas.remove(obj); } catch (_) {} });
          previewLabelRef.current = null;
          canvas.renderAll();
        }
        return;
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const active = canvas.getActiveObject() as any;
      if (!active?._isCountMarker) return;

      e.preventDefault();

      const measurementId = shapeToMeasurementIdRef.current.get(active);
      if (!measurementId) return;

      const objects = measurementObjectsRef.current.get(measurementId);
      const measurement = measurementMapRef.current.get(measurementId);
      if (!objects || !measurement) return;

      const markerIndex = objects.indexOf(active);

      // Remove from canvas and tracking
      canvas.remove(active);
      canvas.discardActiveObject();
      shapeToMeasurementIdRef.current.delete(active);

      const newObjects = objects.filter(o => o !== active);

      if (newObjects.length === 0) {
        // Last marker removed — delete the whole measurement
        measurementObjectsRef.current.delete(measurementId);
        onDeleteMeasurement?.(measurementId);
      } else {
        measurementObjectsRef.current.set(measurementId, newObjects);

        // Remove the corresponding worldPoint
        const newWorldPoints = (measurement.worldPoints as WorldPoint[]).filter((_, i) => i !== markerIndex);
        const countName = (measurement as any).countName ?? 'Custom';
        const labelName = countName === 'Custom' ? 'Items' : countName;
        const labelText = `${newWorldPoints.length} × ${labelName}`;

        onMeasurementUpdate?.(measurementId, {
          worldPoints: newWorldPoints,
          worldValue: newWorldPoints.length,
          realValue: newWorldPoints.length,
          label: labelText,
        });
      }

      canvas.requestRenderAll();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDeleteMeasurement, onMeasurementUpdate]);

  // Handle mouse wheel zoom
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY;
      let newZoom = transform.zoom - delta / 1000;
      newZoom = Math.max(0.1, Math.min(5, newZoom));

      // Update state - the transform useEffect will apply it
      onTransformChange({ zoom: newZoom });
    };

    const canvasElement = canvas.getElement();
    canvasElement.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvasElement.removeEventListener('wheel', handleWheel);
    };
  }, [onTransformChange, transform.zoom]);

  // Handle calibration DRAG (new drag-to-calibrate)
  const handleCalibrationMouseDown = useCallback((worldPoint: WorldPoint) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !viewport) return;

    // Clear any previous calibration objects from canvas before starting fresh
    setCalibrationObjects(prev => {
      prev.forEach(obj => { try { canvas.remove(obj); } catch (_e) {} });
      return [];
    });
    if (calibrationPreviewLineRef.current) {
      try { canvas.remove(calibrationPreviewLineRef.current); } catch (_e) {}
      calibrationPreviewLineRef.current = null;
      setCalibrationPreviewLine(null);
    }

    // Set refs SYNCHRONOUSLY before React re-render so mousemove/mouseup can read them
    isCalibrationDraggingRef.current = true;
    calibrationStartPointRef.current = worldPoint;

    setIsCalibrationDragging(true);
    setCalibrationStartPoint(worldPoint);

    // Zoom-aware sizes for consistent visual appearance
    const markerRadius = getZoomAwareSize(5);
    const strokeWidth = getZoomAwareSize(2);
    const fontSize = getZoomAwareSize(16);

    // Draw start marker at WORLD coordinates
    const marker = new Circle({
      left: worldPoint.x - markerRadius,
      top: worldPoint.y - markerRadius,
      radius: markerRadius,
      fill: 'red',
      stroke: 'white',
      strokeWidth: strokeWidth,
      selectable: false,
      evented: false,
    });
    canvas.add(marker);

    const label = new Text('A', {
      left: worldPoint.x + getZoomAwareSize(10),
      top: worldPoint.y - getZoomAwareSize(10),
      fontSize: fontSize,
      fill: 'red',
      fontWeight: 'bold',
      selectable: false,
      evented: false,
    });
    canvas.add(label);

    setCalibrationObjects([marker, label]);
    canvas.requestRenderAll();
  }, [viewport, getZoomAwareSize]);

  const handleCalibrationMouseMove = useCallback((worldPoint: WorldPoint) => {
    const canvas = fabricCanvasRef.current;
    // Use refs for synchronous values (state would be stale here)
    if (!canvas || !isCalibrationDraggingRef.current || !calibrationStartPointRef.current) return;

    // Remove previous preview line via ref (not stale state)
    if (calibrationPreviewLineRef.current) {
      canvas.remove(calibrationPreviewLineRef.current);
      calibrationPreviewLineRef.current = null;
    }

    const strokeWidth = getZoomAwareSize(2);
    const dashSize = getZoomAwareSize(5);
    const start = calibrationStartPointRef.current;

    // Draw preview line at WORLD positions
    const line = new Line([
      start.x, start.y,
      worldPoint.x, worldPoint.y
    ], {
      stroke: 'red',
      strokeWidth: strokeWidth,
      strokeDashArray: [dashSize, dashSize],
      selectable: false,
      evented: false,
    });
    canvas.add(line);
    calibrationPreviewLineRef.current = line;
    setCalibrationPreviewLine(line);
    canvas.requestRenderAll();
  }, [getZoomAwareSize]);

  const handleCalibrationMouseUp = useCallback((worldPoint: WorldPoint) => {
    const canvas = fabricCanvasRef.current;
    // Use refs for synchronous values (state would be stale here)
    if (!canvas || !isCalibrationDraggingRef.current || !calibrationStartPointRef.current || !viewport) return;

    const start = calibrationStartPointRef.current;

    // Clean up preview line via ref
    if (calibrationPreviewLineRef.current) {
      canvas.remove(calibrationPreviewLineRef.current);
      calibrationPreviewLineRef.current = null;
      setCalibrationPreviewLine(null);
    }

    const strokeWidth = getZoomAwareSize(2);
    const dashSize = getZoomAwareSize(5);
    const markerRadius = getZoomAwareSize(5);
    const fontSize = getZoomAwareSize(16);

    // Draw final line at WORLD positions
    const line = new Line([
      start.x, start.y,
      worldPoint.x, worldPoint.y
    ], {
      stroke: 'red',
      strokeWidth: strokeWidth,
      strokeDashArray: [dashSize, dashSize],
      selectable: false,
      evented: false,
    });
    canvas.add(line);

    // Add end marker
    const marker = new Circle({
      left: worldPoint.x - markerRadius,
      top: worldPoint.y - markerRadius,
      radius: markerRadius,
      fill: 'red',
      stroke: 'white',
      strokeWidth: strokeWidth,
      selectable: false,
      evented: false,
    });
    canvas.add(marker);

    const label = new Text('B', {
      left: worldPoint.x + getZoomAwareSize(10),
      top: worldPoint.y - getZoomAwareSize(10),
      fontSize: fontSize,
      fill: 'red',
      fontWeight: 'bold',
      selectable: false,
      evented: false,
    });
    canvas.add(label);

    setCalibrationObjects(prev => [...prev, line, marker, label]);

    // Reset refs synchronously
    isCalibrationDraggingRef.current = false;
    calibrationStartPointRef.current = null;

    // Complete calibration
    onCalibrationPointsSet([start, worldPoint]);

    setIsCalibrationDragging(false);
    setCalibrationStartPoint(null);
    canvas.requestRenderAll();
  }, [viewport, onCalibrationPointsSet, getZoomAwareSize]);

  // Handle double click to close polygon (declared before handleMouseDown to avoid TDZ)
  const handleDoubleClick = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || activeTool !== 'polygon' || polygonPoints.length < 3 || !viewport) return;

    const effectiveUnits = unitsPerMetre || 1;
    const result = calculatePolygonAreaWorld(polygonPoints, effectiveUnits);

    const strokeWidth = getZoomAwareSize(2);

    // Draw polygon at WORLD coordinates
    const worldPointsFabric = polygonPoints.map(wp => new FabricPoint(wp.x, wp.y));
    const polygon = new Polygon(worldPointsFabric, {
      fill: isCalibrated ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 152, 0, 0.3)',
      stroke: isCalibrated ? 'green' : 'orange',
      strokeWidth: strokeWidth,
      selectable: false,
      evented: false,
      hasControls: true,
      hasBorders: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      cornerColor: '#2563eb',
      cornerStyle: 'circle',
      cornerSize: 10,
      transparentCorners: false,
      borderColor: '#2563eb',
    });
    canvas.add(polygon);

    const displayValue = isCalibrated ? result.realValue : result.worldValue;
    const labelText = isCalibrated ? `${displayValue.toFixed(2)} m²` : `${displayValue.toFixed(0)} px²`;

    // Clean up markers, lines, and snap indicator
    polygonMarkers.forEach(marker => canvas.remove(marker));
    polygonLines.forEach(line => canvas.remove(line));
    if (snapIndicatorRef.current) {
      canvas.remove(snapIndicatorRef.current);
      snapIndicatorRef.current = null;
    }
    setPolygonMarkers([]);
    setPolygonLines([]);

    const measurementId = crypto.randomUUID();

    // Register objects for sync with state
    measurementObjectsRef.current.set(measurementId, [polygon]);

    // Register shape for selection (polygon move only, no resize)
    shapeToMeasurementIdRef.current.set(polygon, measurementId);

    const measurement: Measurement = {
      id: measurementId,
      type: 'polygon',
      worldPoints: polygonPoints,
      worldValue: result.worldValue,
      realValue: isCalibrated ? result.realValue : result.worldValue,
      unit: 'M2',
      color: isCalibrated ? '#4CAF50' : '#FF9800',
      label: labelText,
      pageIndex: pageIndex,
      timestamp: new Date(),
    };

    onMeasurementComplete(measurement);
    setPolygonPoints([]);
    canvas.requestRenderAll();
  }, [
    viewport, transform, activeTool, polygonPoints, polygonMarkers, polygonLines,
    isCalibrated, unitsPerMetre, pageIndex, onMeasurementComplete,
    getZoomAwareSize
  ]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: any) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !viewport) return;

    // CRITICAL FIX: Use getPointer(e.e, true) to get raw canvas pixel coordinates
    // Then manually convert to world coordinates using viewToWorld
    // This is more reliable than getPointer(false) across Fabric.js versions
    const pointer = canvas.getPointer(e.e, true);
    const viewPoint: ViewPoint = { x: pointer.x, y: pointer.y };

    // Convert to world coordinates for storage (applies inverse transform)
    let worldPoint = viewToWorld(viewPoint, transform, viewport);

    // Snap click point to nearest endpoint or midpoint
    if (activeTool && activeTool !== 'pan' && activeTool !== 'select' && activeTool !== 'eraser') {
      const snapZoom = fabricCanvasRef.current?.getZoom() || 1;
      const snapResult = computeSnapPoint(worldPoint, measurements, 12 / snapZoom);
      if (snapResult) worldPoint = snapResult.point;
    }
    midpointSnapRef.current = null;
    endpointSnapIndicatorRef.current = null;

    // Handle calibration (drag-to-calibrate)
    if (calibrationMode === 'manual' && !isCalibrated) {
      handleCalibrationMouseDown(worldPoint);
      return;
    }

    // Handle pan
    if (activeTool === 'pan' || !activeTool) {
      setIsPanning(true);
      setLastClientPos({ x: e.e.clientX, y: e.e.clientY });
      canvas.defaultCursor = 'grabbing';
      return;
    }

    // Handle select mode — check arc control point hit before letting Fabric handle selection
    if (activeTool === 'select') {
      const snapZoom = fabricCanvasRef.current?.getZoom() || 1;
      const hitThresh = 12 / snapZoom;
      let arcHit: { id: string; p1: WorldPoint; p2: WorldPoint; ctrl: WorldPoint } | null = null;
      measurementMapRef.current.forEach((m, id) => {
        if (arcHit) return;
        const ctrl = (m as any).arcControlPoint as WorldPoint | undefined;
        if (!ctrl || !m.worldPoints || m.worldPoints.length < 2) return;
        if (Math.hypot(worldPoint.x - ctrl.x, worldPoint.y - ctrl.y) < hitThresh) {
          arcHit = { id, p1: m.worldPoints[0], p2: m.worldPoints[1], ctrl };
        }
      });
      if (arcHit) { arcDragRef.current = arcHit; return; }
      return;
    }

    // Handle eraser — click the specific shape you want to remove
    if (activeTool === 'eraser') {
      // World-space pointer — getPointer(e, true) gives raw canvas px; viewToWorld converts to world coords
      const rawPtr = canvas.getPointer(e.e, true);
      const worldPtr = viewToWorld(rawPtr, transform, viewport!);
      const hitThreshold = 20 / transform.zoom; // 20 screen-px expressed in world units

      // ── Count markers: check by world-space distance (reliable for small circles) ──
      let countHit: { marker: any; measurementId: string; markerIndex: number } | null = null;
      measurementObjectsRef.current.forEach((objects, measurementId) => {
        if (countHit) return;
        objects.forEach((obj, idx) => {
          if (countHit) return;
          if (!(obj as any)._isCountMarker) return;
          const c = obj.getCenterPoint(); // world coords
          const r = ((obj as any).radius as number) || hitThreshold;
          const dist = Math.hypot(worldPtr.x - c.x, worldPtr.y - c.y);
          if (dist <= r + hitThreshold) {
            countHit = { marker: obj, measurementId, markerIndex: idx };
          }
        });
      });

      if (countHit) {
        const { marker, measurementId, markerIndex } = countHit as { marker: any; measurementId: string; markerIndex: number };
        const objects = measurementObjectsRef.current.get(measurementId)!;
        const measurement = measurementMapRef.current.get(measurementId);

        canvas.remove(marker);
        shapeToMeasurementIdRef.current.delete(marker);

        const newObjects = objects.filter(o => o !== marker);

        if (newObjects.length === 0) {
          measurementObjectsRef.current.delete(measurementId);
          measurementMapRef.current.delete(measurementId);
          onDeleteMeasurement?.(measurementId);
        } else {
          measurementObjectsRef.current.set(measurementId, newObjects);
          if (measurement) {
            const newWorldPoints = (measurement.worldPoints as WorldPoint[]).filter((_, i) => i !== markerIndex);
            const countName = (measurement as any).countName ?? 'Custom';
            const labelName = countName === 'Custom' ? 'Items' : countName;
            onMeasurementUpdate?.(measurementId, {
              worldPoints: newWorldPoints,
              worldValue: newWorldPoints.length,
              realValue: newWorldPoints.length,
              label: `${newWorldPoints.length} × ${labelName}`,
            });
          }
        }
        canvas.requestRenderAll();
        return;
      }

      // ── Other shapes: enable evented on ALL canvas objects so findTarget catches
      //    both tracked measurements AND any orphaned shapes (zero-area accidents etc.)
      const allObjs = canvas.getObjects().filter(
        (o: any) => o.type !== 'text' && !o._isCountMarker
      );
      allObjs.forEach((o: any) => o.set({ evented: true }));

      let target: any = canvas.findTarget(e.e);
      allObjs.forEach((o: any) => o.set({ evented: false }));

      // Proximity fallback — works for thin lines that findTarget misses
      if (!target) {
        let minDist = hitThreshold;
        for (const obj of allObjs) {
          const center = (obj as any).getCenterPoint();
          const d = Math.hypot(worldPtr.x - center.x, worldPtr.y - center.y);
          if (d < minDist) { minDist = d; target = obj; }
        }
      }

      if (target) {
        const measurementId = shapeToMeasurementIdRef.current.get(target);
        if (measurementId) {
          // Known measurement — remove all its canvas objects immediately (don't wait
          // for the sync effect, which only runs on state change)
          const tracked = measurementObjectsRef.current.get(measurementId) || [];
          tracked.forEach((o: any) => { canvas.remove(o); shapeToMeasurementIdRef.current.delete(o); });
          measurementObjectsRef.current.delete(measurementId);
          measurementMapRef.current.delete(measurementId);
          onDeleteMeasurement?.(measurementId);
        } else {
          // Orphaned / untracked shape — just remove it from canvas directly
          canvas.remove(target);
        }
        canvas.requestRenderAll();
      }
      return;
    }

    // Arc-wall 3-click flow — intercept before normal draw logic
    if (activeTool === 'arc-wall') {
      const phase = arcStateRef.current.phase;
      const arcZoom = fabricCanvasRef.current?.getZoom() || 1;
      if (phase === 0) {
        // Click 1: place P1
        arcStateRef.current = { phase: 1, p1: worldPoint, p2: null };
        // Place a small dot marker at P1
        if (arcMarkerRef.current) { try { canvas.remove(arcMarkerRef.current); } catch (_) {} }
        const dot = new Circle({ left: worldPoint.x - 4 / arcZoom, top: worldPoint.y - 4 / arcZoom, radius: 4 / arcZoom, fill: '#f97316', stroke: '', selectable: false, evented: false });
        canvas.add(dot);
        arcMarkerRef.current = dot;
        canvas.renderAll();
        return; // don't start normal drawing
      } else if (phase === 1) {
        // Click 2: place P2
        arcStateRef.current.p2 = worldPoint;
        arcStateRef.current.phase = 2;
        canvas.renderAll();
        return; // don't start normal drawing
      } else if (phase === 2 && arcStateRef.current.p1 && arcStateRef.current.p2) {
        // Click 3: control point = worldPoint → complete arc
        const p1 = arcStateRef.current.p1;
        const p2 = arcStateRef.current.p2;
        const ctrl = worldPoint;
        const eu = unitsPerMetreRef.current;
        const arcStrokeWidth = getZoomAwareSize(2);
        const geo = arcWallGeometry(p1, p2, ctrl, wallThicknessRef.current, eu);

        const arcColor = drawColorRef.current || '#f97316';
        const makeArcPath = (pts: { p1: WorldPoint; Q: WorldPoint; p2: WorldPoint }) =>
          `M ${pts.p1.x} ${pts.p1.y} Q ${pts.Q.x} ${pts.Q.y} ${pts.p2.x} ${pts.p2.y}`;
        const outerArc = new Path(makeArcPath(geo.outer), { stroke: arcColor, strokeWidth: arcStrokeWidth * 1.5, fill: '', selectable: false, evented: false });
        const innerArc = new Path(makeArcPath(geo.inner), { stroke: arcColor, strokeWidth: arcStrokeWidth * 1.5, fill: '', selectable: false, evented: false });
        const capS = new Line([geo.outer.p1.x, geo.outer.p1.y, geo.inner.p1.x, geo.inner.p1.y], { stroke: arcColor, strokeWidth: arcStrokeWidth, selectable: false, evented: false });
        const capE = new Line([geo.outer.p2.x, geo.outer.p2.y, geo.inner.p2.x, geo.inner.p2.y], { stroke: arcColor, strokeWidth: arcStrokeWidth, selectable: false, evented: false });
        // Mark all arc-wall pieces as secondary so none become independently selectable in select mode
        (outerArc as any)._isWallSecondary = true;
        (innerArc as any)._isWallSecondary = true;
        (capS as any)._isWallSecondary = true;
        (capE as any)._isWallSecondary = true;
        [outerArc, innerArc, capS, capE].forEach(s => canvas.add(s));

        // Remove P1 marker
        if (arcMarkerRef.current) { try { canvas.remove(arcMarkerRef.current); } catch (_) {} arcMarkerRef.current = null; }

        // Reset arc state BEFORE emitting measurement so subsequent draws start fresh
        arcStateRef.current = { phase: 0, p1: null, p2: null };

        const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const result = eu
          ? { realValue: chord / eu, unit: 'm' as const }
          : { realValue: chord, unit: 'px' as const };

        const id = crypto.randomUUID();
        measurementObjectsRef.current.set(id, [outerArc, innerArc, capS, capE]);
        // Map ALL pieces so eraser hits any part and removes the whole arc wall
        shapeToMeasurementIdRef.current.set(outerArc, id);
        shapeToMeasurementIdRef.current.set(innerArc, id);
        shapeToMeasurementIdRef.current.set(capS, id);
        shapeToMeasurementIdRef.current.set(capE, id);

        onMeasurementComplete?.({
          id,
          type: 'line',
          label: `Arc wall ${wallThicknessRef.current}mm`,
          worldPoints: [p1, p2],
          arcControlPoint: ctrl,
          realValue: result.realValue,
          unit: 'LM',
          color: arcColor,
          pageIndex,
          wallThickness: wallThicknessRef.current,
          wallHatchType: wallHatchTypeRef.current,
          wallHatchSide: wallHatchSideRef.current,
        } as any);

        canvas.renderAll();
        return;
      }
    }

    setIsDrawing(true);
    setStartPoint(worldPoint);

    // Handle count tool - accumulate points with numbered markers
    if (activeTool === 'count') {
      const markerRadius = getZoomAwareSize(10);
      const strokeWidth = getZoomAwareSize(2);

      // Circle marker — number drawn via after:render so it always follows the circle
      const marker = new Circle({
        left: worldPoint.x - markerRadius,
        top: worldPoint.y - markerRadius,
        radius: markerRadius,
        fill: '#FF9800',
        stroke: 'white',
        strokeWidth,
        selectable: false,
        evented: false,
      });
      // Flag so select-mode and object:modified can identify these as individual count markers
      (marker as any)._isCountMarker = true;
      canvas.add(marker);

      setCountPoints([...countPoints, worldPoint]);
      setCountMarkers([...countMarkers, marker]);

      setIsDrawing(false);
      canvas.requestRenderAll();
      return;
    }

    // Handle polygon tool
    if (activeTool === 'polygon') {
      // Shift-snap: snap new vertex to 45° from the previous vertex
      if (e.e.shiftKey && polygonPoints.length > 0) {
        worldPoint = snapEndpointToAngle(polygonPoints[polygonPoints.length - 1], worldPoint, 45);
      }

      // Snap-to-close: if we have ≥3 points and click near the first point, complete the polygon
      if (polygonPoints.length >= 3) {
        const first = polygonPoints[0];
        const snapThresholdWorld = 15 / transform.zoom;
        const dx = worldPoint.x - first.x;
        const dy = worldPoint.y - first.y;
        if (Math.sqrt(dx * dx + dy * dy) < snapThresholdWorld) {
          // Clean up snap indicator before completing
          if (snapIndicatorRef.current) {
            canvas.remove(snapIndicatorRef.current);
            snapIndicatorRef.current = null;
          }
          handleDoubleClick();
          return;
        }
      }

      const newPoints = [...polygonPoints, worldPoint];
      const markerRadius = getZoomAwareSize(3);
      const strokeWidth = getZoomAwareSize(2);
      const dashSize = getZoomAwareSize(5);

      // Draw point marker at WORLD position
      const marker = new Circle({
        left: worldPoint.x - markerRadius,
        top: worldPoint.y - markerRadius,
        radius: markerRadius,
        fill: 'green',
        stroke: 'white',
        strokeWidth: getZoomAwareSize(1),
        selectable: false,
        evented: false,
      });
      canvas.add(marker);
      setPolygonMarkers([...polygonMarkers, marker]);

      // Add line from previous point at WORLD positions
      if (newPoints.length > 1) {
        const prevWorld = newPoints[newPoints.length - 2];
        const line = new Line([prevWorld.x, prevWorld.y, worldPoint.x, worldPoint.y], {
          stroke: 'green',
          strokeWidth: strokeWidth,
          strokeDashArray: [dashSize, dashSize],
          selectable: false,
          evented: false,
        });
        canvas.add(line);
        setPolygonLines([...polygonLines, line]);
      }

      setPolygonPoints(newPoints);
      canvas.requestRenderAll();
      return;
    }
  }, [
    viewport, transform, calibrationMode, isCalibrated, activeTool,
    polygonPoints, polygonMarkers, polygonLines, pageIndex,
    countPoints, countMarkers, onDeleteLastMeasurement,
    handleCalibrationMouseDown, onMeasurementComplete, getZoomAwareSize,
    handleDoubleClick, onMeasurementUpdate, onDeleteMeasurement
  ]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: any) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !viewport) return;

    // Handle calibration drag preview (use refs to avoid stale closure)
    if (calibrationMode === 'manual' && isCalibrationDraggingRef.current && calibrationStartPointRef.current) {
      const pointer = canvas.getPointer(e.e, true);
      const currentWorld = viewToWorld({ x: pointer.x, y: pointer.y }, transform, viewport);
      handleCalibrationMouseMove(currentWorld);
      return;
    }

    // Handle panning (use client coordinates for smooth panning)
    if (isPanning && lastClientPos) {
      const deltaX = e.e.clientX - lastClientPos.x;
      const deltaY = e.e.clientY - lastClientPos.y;

      onTransformChange({
        panX: transform.panX + deltaX,
        panY: transform.panY + deltaY
      });

      setLastClientPos({ x: e.e.clientX, y: e.e.clientY });
      return;
    }

    // Feature 2: Arc drag in select mode
    if (activeTool === 'select' && arcDragRef.current) {
      const arcPtr = canvas.getPointer(e.e, true);
      const newCtrl: WorldPoint = viewToWorld({ x: arcPtr.x, y: arcPtr.y }, transform, viewport);
      const { id, p1, p2 } = arcDragRef.current;
      arcDragRef.current.ctrl = newCtrl;
      const eu = unitsPerMetreRef.current;
      const m = measurementMapRef.current.get(id);
      if (m && eu) {
        const strokeWidth = getZoomAwareSize(2);
        const color = m.color || '#f97316';
        const geo = arcWallGeometry(p1, p2, newCtrl, (m as any).wallThickness || 90, eu);
        const makeArcPath = (pts: { p1: WorldPoint; Q: WorldPoint; p2: WorldPoint }) =>
          `M ${pts.p1.x} ${pts.p1.y} Q ${pts.Q.x} ${pts.Q.y} ${pts.p2.x} ${pts.p2.y}`;
        const oldObjs = measurementObjectsRef.current.get(id) || [];
        oldObjs.forEach((o: any) => { canvas.remove(o); shapeToMeasurementIdRef.current.delete(o); });
        const outerArc = new Path(makeArcPath(geo.outer), { stroke: color, strokeWidth: strokeWidth * 1.5, fill: '', selectable: false, evented: false });
        const innerArc = new Path(makeArcPath(geo.inner), { stroke: color, strokeWidth: strokeWidth * 1.5, fill: '', selectable: false, evented: false });
        const capS = new Line([geo.outer.p1.x, geo.outer.p1.y, geo.inner.p1.x, geo.inner.p1.y], { stroke: color, strokeWidth, selectable: false, evented: false });
        const capE = new Line([geo.outer.p2.x, geo.outer.p2.y, geo.inner.p2.x, geo.inner.p2.y], { stroke: color, strokeWidth, selectable: false, evented: false });
        (outerArc as any)._isWallSecondary = true;
        (innerArc as any)._isWallSecondary = true;
        (capS as any)._isWallSecondary = true;
        (capE as any)._isWallSecondary = true;
        [outerArc, innerArc, capS, capE].forEach(o => canvas.add(o));
        measurementObjectsRef.current.set(id, [outerArc, innerArc, capS, capE]);
        shapeToMeasurementIdRef.current.set(outerArc, id);
        shapeToMeasurementIdRef.current.set(innerArc, id);
        shapeToMeasurementIdRef.current.set(capS, id);
        shapeToMeasurementIdRef.current.set(capE, id);
      }
      canvas.requestRenderAll();
      return;
    }

    // Polygon snap indicator — show green ring near first point when ≥2 points placed
    if (activeTool === 'polygon' && polygonPoints.length >= 2) {
      const snapPointer = canvas.getPointer(e.e, true);
      const snapWorld: WorldPoint = viewToWorld({ x: snapPointer.x, y: snapPointer.y }, transform, viewport);
      const first = polygonPoints[0];
      const snapThreshold = 15 / transform.zoom;
      const dx = snapWorld.x - first.x;
      const dy = snapWorld.y - first.y;
      const isNearFirst = Math.sqrt(dx * dx + dy * dy) < snapThreshold;

      // Remove old indicator
      if (snapIndicatorRef.current) {
        canvas.remove(snapIndicatorRef.current);
        snapIndicatorRef.current = null;
      }

      if (isNearFirst) {
        const indicatorRadius = getZoomAwareSize(12);
        const indicator = new Circle({
          left: first.x - indicatorRadius,
          top: first.y - indicatorRadius,
          radius: indicatorRadius,
          fill: 'rgba(0, 200, 0, 0.2)',
          stroke: '#00CC00',
          strokeWidth: getZoomAwareSize(2),
          strokeDashArray: [getZoomAwareSize(3), getZoomAwareSize(3)],
          selectable: false,
          evented: false,
        });
        canvas.add(indicator);
        snapIndicatorRef.current = indicator;
      }

      canvas.requestRenderAll();
    }

    // Allow preview even without calibration
    if (!isDrawing || !startPoint) return;

    // CRITICAL FIX: Use getPointer(e.e, true) for raw canvas coordinates
    const pointer = canvas.getPointer(e.e, true);
    let currentWorldPoint: WorldPoint = viewToWorld(
      { x: pointer.x, y: pointer.y },
      transform,
      viewport
    );

    // Snap: endpoints (priority) then midpoints — 12 screen-px threshold
    const zoom = fabricCanvasRef.current?.getZoom() || 1;
    const snapResult = computeSnapPoint(currentWorldPoint, measurements, 12 / zoom);
    if (snapResult) {
      currentWorldPoint = snapResult.point;
      midpointSnapRef.current = snapResult.isMidpoint ? snapResult.point : null;
      // Feature 1: endpoint snap indicator
      endpointSnapIndicatorRef.current = snapResult.isMidpoint ? null : snapResult.point;
    } else {
      midpointSnapRef.current = null;
      endpointSnapIndicatorRef.current = null;
    }

    // Shift-snap: 45° for line, square for rectangle
    if (e.e.shiftKey && startPoint) {
      if (activeTool === 'line') currentWorldPoint = snapEndpointToAngle(startPoint, currentWorldPoint, 45);
      else if (activeTool === 'rectangle') currentWorldPoint = snapToSquare(startPoint, currentWorldPoint);
    }

    // Remove previous preview
    if (previewShapeRef.current) {
      // Clean up wall preview extras
      if ((previewShapeRef.current as any)?._wallPreviews) {
        ((previewShapeRef.current as any)._wallPreviews as any[]).forEach((s: any) => canvas.remove(s));
      }
      // Clean up arc-wall preview extras
      if ((previewShapeRef.current as any)?._arcPreviews) {
        ((previewShapeRef.current as any)._arcPreviews as any[]).forEach((s: any) => canvas.remove(s));
      }
      if (!(activeTool === 'wall-line' && (previewShapeRef.current as any)._isWallPreviewRect)) {
        canvas.remove(previewShapeRef.current);
      }
    }

    let shape: any = null;
    const drawColor = drawColorRef.current || (isCalibrated ? 'red' : 'orange');
    const strokeWidth = getZoomAwareSize(2);
    const dashSize = getZoomAwareSize(5);

    // Draw preview shapes at WORLD coordinates - viewportTransform handles zoom/pan
    if (activeTool === 'line') {
      shape = new Line([startPoint.x, startPoint.y, currentWorldPoint.x, currentWorldPoint.y], {
        stroke: drawColor,
        strokeWidth: strokeWidth,
        strokeDashArray: [dashSize, dashSize],
        selectable: false,
        evented: false,
      });
    } else if (activeTool === 'rectangle') {
      shape = new Rect({
        left: Math.min(startPoint.x, currentWorldPoint.x),
        top: Math.min(startPoint.y, currentWorldPoint.y),
        width: Math.abs(currentWorldPoint.x - startPoint.x),
        height: Math.abs(currentWorldPoint.y - startPoint.y),
        fill: isCalibrated ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)',
        stroke: isCalibrated ? 'green' : 'orange',
        strokeWidth: strokeWidth,
        strokeDashArray: [dashSize, dashSize],
        selectable: false,
        evented: false,
      });
    } else if (activeTool === 'circle') {
      const dx = currentWorldPoint.x - startPoint.x;
      const dy = currentWorldPoint.y - startPoint.y;
      const radius = Math.sqrt(dx * dx + dy * dy);

      shape = new Circle({
        left: startPoint.x - radius,
        top: startPoint.y - radius,
        radius: radius,
        fill: isCalibrated ? 'rgba(156, 39, 176, 0.2)' : 'rgba(255, 152, 0, 0.2)',
        stroke: isCalibrated ? 'purple' : 'orange',
        strokeWidth: strokeWidth,
        strokeDashArray: [dashSize, dashSize],
        selectable: false,
        evented: false,
      });
    } else if (activeTool === 'wall-line') {
      let bestSnap: { snapped: WorldPoint; guideFrom: WorldPoint; guideTo: WorldPoint } | null = null;
      if (e.e.shiftKey) {
        currentWorldPoint = snapEndpointToAngle(startPoint, currentWorldPoint, 45);
        snappedWallEndRef.current = null;
        perpSnapRef.current = null;
      } else {
        // Perpendicular snap: check all existing wall measurements for a 90° alignment
        perpSnapRef.current = null;
        const measurements = measurementMapRef.current;
        const SNAP_DEG = 8; // degrees tolerance for perp snap
        let bestDelta = Infinity;
        measurements.forEach((m) => {
          if (!(m as any).wallThickness || m.worldPoints.length < 2) return;
          const wA = m.worldPoints[0], wB = m.worldPoints[1];
          const wallAngle = Math.atan2(wB.y - wA.y, wB.x - wA.x);
          const perpAngle = wallAngle + Math.PI / 2;
          // Try both perpendicular directions
          [perpAngle, perpAngle + Math.PI].forEach(targetAngle => {
            const curAngle = Math.atan2(currentWorldPoint.y - startPoint.y, currentWorldPoint.x - startPoint.x);
            let delta = Math.abs(curAngle - targetAngle);
            while (delta > Math.PI) delta = Math.abs(delta - 2 * Math.PI);
            if (delta < (SNAP_DEG * Math.PI / 180) && delta < bestDelta) {
              bestDelta = delta;
              const dist = Math.hypot(currentWorldPoint.x - startPoint.x, currentWorldPoint.y - startPoint.y);
              const snapped = {
                x: startPoint.x + dist * Math.cos(targetAngle),
                y: startPoint.y + dist * Math.sin(targetAngle),
              };
              // Guide line extends ±30% of canvas width along the perp direction
              const guideLen = (canvas.getWidth() / (canvas.viewportTransform?.[0] || 1)) * 0.3;
              bestSnap = {
                snapped,
                guideFrom: { x: snapped.x - Math.cos(targetAngle) * guideLen, y: snapped.y - Math.sin(targetAngle) * guideLen },
                guideTo:   { x: snapped.x + Math.cos(targetAngle) * guideLen, y: snapped.y + Math.sin(targetAngle) * guideLen },
              };
            }
          });
        });
        if (bestSnap) {
          currentWorldPoint = (bestSnap as any).snapped;
          snappedWallEndRef.current = (bestSnap as any).snapped;
          perpSnapRef.current = { from: (bestSnap as any).guideFrom, to: (bestSnap as any).guideTo };
        } else {
          snappedWallEndRef.current = null;
        }
      }
      const eu = unitsPerMetreRef.current || 1;
      const wdx = currentWorldPoint.x - startPoint.x;
      const wdy = currentWorldPoint.y - startPoint.y;
      const wallLength = Math.sqrt(wdx * wdx + wdy * wdy) || 0.001;
      const wallAngleDeg = Math.atan2(wdy, wdx) * (180 / Math.PI);
      const midX = (startPoint.x + currentWorldPoint.x) / 2;
      const midY = (startPoint.y + currentWorldPoint.y) / 2;
      const thicknessWorld = (wallThicknessRef.current / 1000) * eu;
      const wallColor = drawColorRef.current || '#f59e0b';

      if (previewShapeRef.current && (previewShapeRef.current as any)._isWallPreviewRect) {
        // Update the single Rect in-place — no canvas remove/add, no duplication
        previewShapeRef.current.set({
          left: midX,
          top: midY,
          width: wallLength,
          height: thicknessWorld,
          angle: wallAngleDeg,
          stroke: wallColor,
        });
        previewShapeRef.current.setCoords();
        shape = previewShapeRef.current;
      } else {
        shape = new Rect({
          left: midX,
          top: midY,
          width: wallLength,
          height: thicknessWorld,
          originX: 'center',
          originY: 'center',
          angle: wallAngleDeg,
          fill: 'rgba(245,158,11,0.08)',
          stroke: wallColor,
          strokeWidth,
          strokeDashArray: [dashSize, dashSize],
          selectable: false,
          evented: false,
        });
        (shape as any)._isWallPreviewRect = true;
        canvas.add(shape);
      }

      const eu2 = unitsPerMetreRef.current || 1;
      const r = calculateLinearWorld(startPoint, currentWorldPoint, eu2);
      const t = isCalibrated ? `${r.realValue.toFixed(2)} m  (${wallThicknessRef.current}mm wall)` : `${r.worldValue.toFixed(0)} px`;
      const angleLabel = bestSnap ? '  ⊾ 90°' : '';
      previewLabelRef.current = { text: t + angleLabel, worldX: (startPoint.x + currentWorldPoint.x) / 2, worldY: (startPoint.y + currentWorldPoint.y) / 2, color: wallColor };
    } else if (activeTool === 'offset') {
      const offsetColor = '#38bdf8';
      shape = new Line([startPoint.x, startPoint.y, currentWorldPoint.x, currentWorldPoint.y], {
        stroke: offsetColor,
        strokeWidth: strokeWidth * 0.75,
        strokeDashArray: [dashSize * 2, dashSize],
        selectable: false,
        evented: false,
      });
      const eu = unitsPerMetre || 1;
      const r = calculateLinearWorld(startPoint, currentWorldPoint, eu);
      const t = isCalibrated ? `Ref: ${r.realValue.toFixed(2)} m` : `Ref: ${r.worldValue.toFixed(0)} px`;
      previewLabelRef.current = { text: t, worldX: (startPoint.x + currentWorldPoint.x) / 2, worldY: (startPoint.y + currentWorldPoint.y) / 2, color: offsetColor };
    } else if (activeTool === 'arc-wall') {
      const phase = arcStateRef.current.phase;
      if (phase === 1 && arcStateRef.current.p1) {
        // Phase 1: straight preview from P1 to cursor
        const p1 = arcStateRef.current.p1;
        const arcColor = '#f97316'; // orange-500
        shape = new Line([p1.x, p1.y, currentWorldPoint.x, currentWorldPoint.y], {
          stroke: arcColor, strokeWidth, strokeDashArray: [dashSize, dashSize],
          selectable: false, evented: false,
        });
        const eu = unitsPerMetreRef.current;
        const r = calculateLinearWorld(p1, currentWorldPoint, eu || 1);
        const t = eu ? `${r.realValue.toFixed(2)} m` : `${r.worldValue.toFixed(0)} px`;
        previewLabelRef.current = { text: t, worldX: (p1.x + currentWorldPoint.x) / 2, worldY: (p1.y + currentWorldPoint.y) / 2, color: arcColor };
      } else if (phase === 2 && arcStateRef.current.p1 && arcStateRef.current.p2) {
        // Phase 2: arc preview — cursor IS the control point
        const p1 = arcStateRef.current.p1;
        const p2 = arcStateRef.current.p2;
        const eu = unitsPerMetreRef.current;
        const geo = arcWallGeometry(p1, p2, currentWorldPoint, wallThicknessRef.current, eu);
        const arcColor = '#f97316';
        const makeArcPath = (pts: { p1: WorldPoint; Q: WorldPoint; p2: WorldPoint }) =>
          `M ${pts.p1.x} ${pts.p1.y} Q ${pts.Q.x} ${pts.Q.y} ${pts.p2.x} ${pts.p2.y}`;
        const outerArc = new Path(makeArcPath(geo.outer), { stroke: arcColor, strokeWidth, strokeDashArray: [dashSize, dashSize], fill: '', selectable: false, evented: false });
        const innerArc = new Path(makeArcPath(geo.inner), { stroke: arcColor, strokeWidth, strokeDashArray: [dashSize, dashSize], fill: '', selectable: false, evented: false });
        const capS = new Line([geo.outer.p1.x, geo.outer.p1.y, geo.inner.p1.x, geo.inner.p1.y], { stroke: arcColor, strokeWidth: strokeWidth * 0.5, strokeDashArray: [dashSize, dashSize], selectable: false, evented: false });
        const capE = new Line([geo.outer.p2.x, geo.outer.p2.y, geo.inner.p2.x, geo.inner.p2.y], { stroke: arcColor, strokeWidth: strokeWidth * 0.5, strokeDashArray: [dashSize, dashSize], selectable: false, evented: false });
        [outerArc, innerArc, capS, capE].forEach(s => canvas.add(s));
        shape = outerArc;
        (shape as any)._arcPreviews = [innerArc, capS, capE];
        const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const t = eu ? `${(chord / eu).toFixed(2)} m arc` : `${chord.toFixed(0)} px arc`;
        previewLabelRef.current = { text: t, worldX: (p1.x + p2.x) / 2, worldY: (p1.y + p2.y) / 2, color: arcColor };
      }
    }

    if (shape) {
      if (!(activeTool === 'wall-line') && !(activeTool === 'arc-wall')) {
        canvas.add(shape);
      }
      previewShapeRef.current = shape;
    }

    // Update live measurement preview label
    if (activeTool === 'line') {
      const eu = unitsPerMetre || 1;
      const r = calculateLinearWorld(startPoint, currentWorldPoint, eu);
      const t = isCalibrated ? `${r.realValue.toFixed(2)} m` : `${r.worldValue.toFixed(0)} px`;
      previewLabelRef.current = { text: t, worldX: (startPoint.x + currentWorldPoint.x) / 2, worldY: (startPoint.y + currentWorldPoint.y) / 2, color: drawColorRef.current || (isCalibrated ? 'red' : 'orange') };
    } else if (activeTool === 'rectangle') {
      const eu = unitsPerMetre || 1;
      const r = calculateRectangleAreaWorld(startPoint, currentWorldPoint, eu);
      const t = isCalibrated ? `${r.realValue.toFixed(2)} m²` : `${r.worldValue.toFixed(0)} px²`;
      previewLabelRef.current = { text: t, worldX: (startPoint.x + currentWorldPoint.x) / 2, worldY: (startPoint.y + currentWorldPoint.y) / 2, color: isCalibrated ? 'green' : 'orange' };
    } else if (activeTool === 'circle') {
      const eu = unitsPerMetre || 1;
      const r = calculateCircleAreaWorld(startPoint, currentWorldPoint, eu);
      const t = isCalibrated ? `${r.realValue.toFixed(2)} m²` : `${r.worldValue.toFixed(0)} px²`;
      previewLabelRef.current = { text: t, worldX: startPoint.x, worldY: startPoint.y, color: isCalibrated ? 'purple' : 'orange' };
    } else if (activeTool === 'wall-line' || activeTool === 'offset' || activeTool === 'arc-wall') {
      // previewLabelRef already set in the shape-building block above — leave it alone
    } else {
      previewLabelRef.current = null;
    }

    canvas.requestRenderAll();
  }, [
    viewport, transform, isPanning, lastClientPos, isDrawing, startPoint,
    activeTool, isCalibrated, unitsPerMetre, onTransformChange,
    calibrationMode, isCalibrationDragging, calibrationStartPoint, handleCalibrationMouseMove,
    getZoomAwareSize, polygonPoints, measurements
  ]);

  // Handle mouse up
  const handleMouseUp = useCallback((e: any) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Handle calibration drag end (use refs to avoid stale closure)
    if (calibrationMode === 'manual' && isCalibrationDraggingRef.current && calibrationStartPointRef.current) {
      const pointer = canvas.getPointer(e.e, true);
      const worldEnd = viewToWorld({ x: pointer.x, y: pointer.y }, transform, viewport);
      handleCalibrationMouseUp(worldEnd);
      return;
    }

    // Handle pan end
    if (isPanning) {
      setIsPanning(false);
      setLastClientPos(null);
      canvas.defaultCursor = 'grab';
      return;
    }

    // Feature 2: Complete arc control-point drag
    if (arcDragRef.current) {
      const { id, ctrl } = arcDragRef.current;
      onMeasurementUpdate?.(id, { arcControlPoint: ctrl } as any);
      arcDragRef.current = null;
      canvas.requestRenderAll();
      return;
    }

    if (!isDrawing || !startPoint || !viewport) return;

    // CRITICAL FIX: Use getPointer(e.e, true) for raw canvas coordinates
    const pointer = canvas.getPointer(e.e, true);
    let worldEndPoint = viewToWorld({ x: pointer.x, y: pointer.y }, transform, viewport);

    // Shift-snap: commit the same snap applied during preview
    if (e.e.shiftKey && startPoint) {
      if (activeTool === 'line') worldEndPoint = snapEndpointToAngle(startPoint, worldEndPoint, 45);
      else if (activeTool === 'rectangle') worldEndPoint = snapToSquare(startPoint, worldEndPoint);
    }

    // Remove preview shape
    if (previewShapeRef.current) {
      // Clean up wall preview extras
      if ((previewShapeRef.current as any)?._wallPreviews) {
        ((previewShapeRef.current as any)._wallPreviews as any[]).forEach((s: any) => canvas.remove(s));
      }
      // Clean up arc-wall preview extras
      if ((previewShapeRef.current as any)?._arcPreviews) {
        ((previewShapeRef.current as any)._arcPreviews as any[]).forEach((s: any) => canvas.remove(s));
      }
      canvas.remove(previewShapeRef.current);
      previewShapeRef.current = null;
    }

    // Helper: abort drawing cleanly (clears preview label + ghost state)
    const abortDraw = () => {
      previewLabelRef.current = null;
      perpSnapRef.current = null;
      canvas.requestRenderAll();
      setIsDrawing(false);
      setStartPoint(null);
    };

    // Zoom-aware sizes for final shapes
    const strokeWidth = getZoomAwareSize(2);

    // Complete measurement based on tool
    if (activeTool === 'line') {
      // Ignore accidental clicks — require at least 5 world units of drag
      const minDist = 5 / transform.zoom;
      const dx0 = worldEndPoint.x - startPoint.x;
      const dy0 = worldEndPoint.y - startPoint.y;
      if (Math.sqrt(dx0 * dx0 + dy0 * dy0) < minDist) {
        abortDraw(); return;
      }

      const effectiveUnits = unitsPerMetre || 1;
      const result = calculateLinearWorld(startPoint, worldEndPoint, effectiveUnits);
      const lineStroke = drawColorRef.current || (isCalibrated ? 'red' : 'orange');

      // Draw at WORLD coordinates - viewportTransform handles zoom/pan
      const line = new Line([startPoint.x, startPoint.y, worldEndPoint.x, worldEndPoint.y], {
        stroke: lineStroke,
        strokeWidth: strokeWidth,
        selectable: false,
        evented: false,
        hasControls: true,
        hasBorders: true,
        lockRotation: true,
        cornerColor: '#2563eb',
        cornerStyle: 'circle',
        cornerSize: 10,
        transparentCorners: false,
        borderColor: '#2563eb',
      });
      canvas.add(line);

      const displayValue = isCalibrated ? result.realValue : result.worldValue;
      const labelText = isCalibrated ? `${displayValue.toFixed(2)} m` : `${displayValue.toFixed(0)} px`;

      const measurementId = crypto.randomUUID();

      // Register objects for sync with state
      measurementObjectsRef.current.set(measurementId, [line]);

      // Register shape for resize handling
      shapeToMeasurementIdRef.current.set(line, measurementId);

      const measurement: Measurement = {
        id: measurementId,
        type: 'line',
        worldPoints: [startPoint, worldEndPoint],
        worldValue: result.worldValue,
        realValue: isCalibrated ? result.realValue : result.worldValue,
        unit: 'LM',
        color: drawColorRef.current || (isCalibrated ? '#FF6B6B' : '#FF9800'),
        label: labelText,
        pageIndex: pageIndex,
        timestamp: new Date(),
      };

      onMeasurementComplete(measurement);
    } else if (activeTool === 'wall-line') {
      if (e.e.shiftKey) worldEndPoint = snapEndpointToAngle(startPoint, worldEndPoint, 45);
      else if (snappedWallEndRef.current) worldEndPoint = snappedWallEndRef.current;
      snappedWallEndRef.current = null;

      const minDist = 5 / transform.zoom;
      const dx0 = worldEndPoint.x - startPoint.x;
      const dy0 = worldEndPoint.y - startPoint.y;
      if (Math.sqrt(dx0 * dx0 + dy0 * dy0) < minDist) { abortDraw(); return; }

      const eu = unitsPerMetreRef.current || 1;
      const thickness = wallThicknessRef.current;
      const geo = wallGeometry(startPoint, worldEndPoint, thickness, eu);
      const wallColor = drawColorRef.current || '#f59e0b';
      const result = calculateLinearWorld(startPoint, worldEndPoint, eu);

      // Wall = [hitRect, wl1, wl2, wc1, wc2]. hitRect is the transparent body (click/move/resize).
      // Visual lines are purely decorative (_isWallSecondary).
      const wallHitRect = makeWallHitRect(startPoint, worldEndPoint, thickness, eu, strokeWidth);
      const wallLine1 = new Line([geo.l1p1.x, geo.l1p1.y, geo.l1p2.x, geo.l1p2.y], {
        stroke: wallColor, strokeWidth: strokeWidth * 1.5, selectable: false, evented: false,
        hasControls: false, hasBorders: false,
      });
      const wallLine2 = new Line([geo.l2p1.x, geo.l2p1.y, geo.l2p2.x, geo.l2p2.y], {
        stroke: wallColor, strokeWidth: strokeWidth * 1.5, selectable: false, evented: false,
        hasControls: false, hasBorders: false,
      });
      const cap1 = new Line([geo.l1p1.x, geo.l1p1.y, geo.l2p1.x, geo.l2p1.y], {
        stroke: wallColor, strokeWidth, selectable: false, evented: false,
      });
      const cap2 = new Line([geo.l1p2.x, geo.l1p2.y, geo.l2p2.x, geo.l2p2.y], {
        stroke: wallColor, strokeWidth, selectable: false, evented: false,
      });
      (wallLine1 as any)._isWallSecondary = true;
      (wallLine2 as any)._isWallSecondary = true;
      (cap1 as any)._isWallSecondary = true;
      (cap2 as any)._isWallSecondary = true;
      [wallHitRect, wallLine1, wallLine2, cap1, cap2].forEach(l => canvas.add(l));

      const measurementId = crypto.randomUUID();
      measurementObjectsRef.current.set(measurementId, [wallHitRect, wallLine1, wallLine2, cap1, cap2]);
      shapeToMeasurementIdRef.current.set(wallHitRect, measurementId);
      shapeToMeasurementIdRef.current.set(wallLine1, measurementId);
      shapeToMeasurementIdRef.current.set(wallLine2, measurementId);
      shapeToMeasurementIdRef.current.set(cap1, measurementId);
      shapeToMeasurementIdRef.current.set(cap2, measurementId);

      const labelText = isCalibrated ? `${result.realValue.toFixed(2)} m` : `${result.worldValue.toFixed(0)} px`;
      const measurement: Measurement = {
        id: measurementId,
        type: 'line',
        worldPoints: [startPoint, worldEndPoint],
        worldValue: result.worldValue,
        realValue: isCalibrated ? result.realValue : result.worldValue,
        unit: 'LM',
        color: wallColor,
        label: labelText,
        wallThickness: thickness,
        wallHatchType: wallHatchTypeRef.current as any,
        wallHatchSide: wallHatchSideRef.current as any,
        pageIndex,
        timestamp: new Date(),
      };
      onMeasurementComplete(measurement);
    } else if (activeTool === 'offset') {
      const minDist = 5 / transform.zoom;
      const dx0 = worldEndPoint.x - startPoint.x;
      const dy0 = worldEndPoint.y - startPoint.y;
      if (Math.sqrt(dx0 * dx0 + dy0 * dy0) < minDist) { abortDraw(); return; }

      const eu = unitsPerMetre || 1;
      const result = calculateLinearWorld(startPoint, worldEndPoint, eu);
      const refColor = '#38bdf8';

      const refLine = new Line([startPoint.x, startPoint.y, worldEndPoint.x, worldEndPoint.y], {
        stroke: refColor,
        strokeWidth: strokeWidth * 0.75,
        strokeDashArray: [getZoomAwareSize(8), getZoomAwareSize(4)],
        selectable: false,
        evented: false,
        hasControls: true,
        hasBorders: true,
        lockRotation: true,
        cornerColor: '#2563eb',
        cornerStyle: 'circle' as const,
        cornerSize: 10,
        transparentCorners: false,
        borderColor: '#2563eb',
      });
      canvas.add(refLine);

      const measurementId = crypto.randomUUID();
      measurementObjectsRef.current.set(measurementId, [refLine]);
      shapeToMeasurementIdRef.current.set(refLine, measurementId);

      const labelText = isCalibrated ? `Ref: ${result.realValue.toFixed(2)} m` : '';
      const measurement: Measurement = {
        id: measurementId,
        type: 'line',
        worldPoints: [startPoint, worldEndPoint],
        worldValue: result.worldValue,
        realValue: isCalibrated ? result.realValue : result.worldValue,
        unit: 'LM',
        color: refColor,
        label: labelText,
        pageIndex,
        timestamp: new Date(),
      };
      onMeasurementComplete(measurement);
    } else if (activeTool === 'rectangle') {
      // Ignore accidental clicks — require minimum drag in both axes
      const minDist = 5 / transform.zoom;
      if (Math.abs(worldEndPoint.x - startPoint.x) < minDist || Math.abs(worldEndPoint.y - startPoint.y) < minDist) {
        abortDraw(); return;
      }

      const effectiveUnits = unitsPerMetre || 1;
      const result = calculateRectangleAreaWorld(startPoint, worldEndPoint, effectiveUnits);

      // Draw at WORLD coordinates
      const rect = new Rect({
        left: Math.min(startPoint.x, worldEndPoint.x),
        top: Math.min(startPoint.y, worldEndPoint.y),
        width: Math.abs(worldEndPoint.x - startPoint.x),
        height: Math.abs(worldEndPoint.y - startPoint.y),
        fill: isCalibrated ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 152, 0, 0.3)',
        stroke: isCalibrated ? 'green' : 'orange',
        strokeWidth: strokeWidth,
        selectable: false,
        evented: false,
        hasControls: true,
        hasBorders: true,
        lockRotation: true,
        cornerColor: '#2563eb',
        cornerStyle: 'circle',
        cornerSize: 10,
        transparentCorners: false,
        borderColor: '#2563eb',
      });
      canvas.add(rect);

      const displayValueRect = isCalibrated ? result.realValue : result.worldValue;
      const labelText = isCalibrated ? `${displayValueRect.toFixed(2)} m²` : `${displayValueRect.toFixed(0)} px²`;

      const measurementId = crypto.randomUUID();

      // Register objects for sync with state
      measurementObjectsRef.current.set(measurementId, [rect]);

      // Register shape for resize handling
      shapeToMeasurementIdRef.current.set(rect, measurementId);

      const measurement: Measurement = {
        id: measurementId,
        type: 'rectangle',
        worldPoints: [startPoint, worldEndPoint],
        worldValue: result.worldValue,
        realValue: isCalibrated ? result.realValue : result.worldValue,
        unit: 'M2',
        dimensions: result.dimensions,
        color: isCalibrated ? '#4CAF50' : '#FF9800',
        label: labelText,
        pageIndex: pageIndex,
        timestamp: new Date(),
      };

      onMeasurementComplete(measurement);
    } else if (activeTool === 'circle') {
      // Ignore accidental clicks — require minimum drag radius
      const minDist = 5 / transform.zoom;
      const dxc = worldEndPoint.x - startPoint.x;
      const dyc = worldEndPoint.y - startPoint.y;
      if (Math.sqrt(dxc * dxc + dyc * dyc) < minDist) {
        abortDraw(); return;
      }

      const effectiveUnits = unitsPerMetre || 1;
      const result = calculateCircleAreaWorld(startPoint, worldEndPoint, effectiveUnits);

      // Calculate radius in WORLD coords
      const dx = worldEndPoint.x - startPoint.x;
      const dy = worldEndPoint.y - startPoint.y;
      const radiusWorld = Math.sqrt(dx * dx + dy * dy);

      // Draw at WORLD coordinates
      const circle = new Circle({
        left: startPoint.x - radiusWorld,
        top: startPoint.y - radiusWorld,
        radius: radiusWorld,
        fill: isCalibrated ? 'rgba(156, 39, 176, 0.3)' : 'rgba(255, 152, 0, 0.3)',
        stroke: isCalibrated ? 'purple' : 'orange',
        strokeWidth: strokeWidth,
        selectable: false,
        evented: false,
        hasControls: true,
        hasBorders: true,
        lockRotation: true,
        cornerColor: '#2563eb',
        cornerStyle: 'circle',
        cornerSize: 10,
        transparentCorners: false,
        borderColor: '#2563eb',
        lockUniScaling: true, // Keep circle uniform when scaling
      });
      canvas.add(circle);

      const displayValueCircle = isCalibrated ? result.realValue : result.worldValue;
      const labelText = isCalibrated ? `${displayValueCircle.toFixed(2)} m²` : `${displayValueCircle.toFixed(0)} px²`;

      const measurementId = crypto.randomUUID();

      // Register objects for sync with state
      measurementObjectsRef.current.set(measurementId, [circle]);

      // Register shape for resize handling
      shapeToMeasurementIdRef.current.set(circle, measurementId);

      const measurement: Measurement = {
        id: measurementId,
        type: 'circle',
        worldPoints: [startPoint, worldEndPoint],
        worldValue: result.worldValue,
        realValue: isCalibrated ? result.realValue : result.worldValue,
        unit: 'M2',
        color: isCalibrated ? '#9C27B0' : '#FF9800',
        label: labelText,
        pageIndex: pageIndex,
        timestamp: new Date(),
      };

      onMeasurementComplete(measurement);
    }

    previewLabelRef.current = null;
    perpSnapRef.current = null;
    snappedWallEndRef.current = null;
    midpointSnapRef.current = null;
    setIsDrawing(false);
    setStartPoint(null);
    canvas.requestRenderAll();
  }, [
    viewport, transform, isPanning, isDrawing, startPoint,
    activeTool, isCalibrated, unitsPerMetre, pageIndex,
    onMeasurementComplete, calibrationMode, isCalibrationDragging,
    calibrationStartPoint, handleCalibrationMouseUp, getZoomAwareSize
  ]);


  // Cancel polygon drawing
  const handleCancelPolygon = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Remove markers, lines, and snap indicator
    polygonMarkers.forEach(marker => canvas.remove(marker));
    polygonLines.forEach(line => canvas.remove(line));
    if (snapIndicatorRef.current) {
      canvas.remove(snapIndicatorRef.current);
      snapIndicatorRef.current = null;
    }
    setPolygonMarkers([]);
    setPolygonLines([]);
    setPolygonPoints([]);
    canvas.requestRenderAll();
  }, [polygonMarkers, polygonLines]);

  // Complete count group - save as single measurement
  const handleCompleteCount = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || countPoints.length === 0) return;

    const measurementId = crypto.randomUUID();

    // Register count markers for sync with state
    measurementObjectsRef.current.set(measurementId, [...countMarkers]);

    // Register each marker so the eraser can find them
    countMarkers.forEach(m => shapeToMeasurementIdRef.current.set(m, measurementId));

    // Generate label based on preset
    const labelName = countPreset === 'Custom' ? 'Items' : countPreset;
    const labelText = `${countPoints.length} × ${labelName}`;

    const measurement: Measurement = {
      id: measurementId,
      type: 'count' as any, // Count type for proper handling
      worldPoints: countPoints,
      worldValue: countPoints.length,
      realValue: countPoints.length,
      unit: 'count',
      color: '#FF9800',
      label: labelText,
      pageIndex: pageIndex,
      timestamp: new Date(),
      // Store the preset name for the table
      countName: countPreset,
    } as any;

    onMeasurementComplete(measurement);
    setCountPoints([]);
    setCountMarkers([]);
    setCountPreset('Custom'); // Reset preset for next count
    canvas.requestRenderAll();
  }, [countPoints, countMarkers, countPreset, pageIndex, onMeasurementComplete]);

  // Cancel count - remove all markers
  const handleCancelCount = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    countMarkers.forEach(marker => canvas.remove(marker));
    setCountMarkers([]);
    setCountPoints([]);
    canvas.requestRenderAll();
  }, [countMarkers]);

  // Attach event handlers with ALL dependencies
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:dblclick', handleDoubleClick);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('mouse:dblclick', handleDoubleClick);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick]);

  return (
    <div className="relative w-full min-h-[600px] h-full flex items-center justify-center bg-muted rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-3 max-w-sm text-center px-6">
            <p className="text-destructive text-sm">{error}</p>
            {onReupload && error.includes('session expired') && (
              <Button size="sm" onClick={onReupload}>
                Re-upload PDF
              </Button>
            )}
          </div>
        </div>
      )}
      {!isCalibrated && activeTool && activeTool !== 'pan' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500/90 text-black px-4 py-2 rounded-md text-sm font-medium z-10 shadow-lg">
          ⚠️ Set scale first for accurate measurements (currently showing pixel values)
        </div>
      )}

      {/* Polygon completion controls */}
      {activeTool === 'polygon' && polygonPoints.length >= 3 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
          <Button
            onClick={handleDoubleClick}
            className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
            size="sm"
          >
            <Check className="h-4 w-4 mr-1" />
            Complete Polygon ({polygonPoints.length} points)
          </Button>
          <Button
            onClick={handleCancelPolygon}
            variant="destructive"
            size="sm"
            className="shadow-lg"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      )}

      {/* Polygon hint when drawing */}
      {activeTool === 'polygon' && polygonPoints.length > 0 && polygonPoints.length < 3 && hintVisible && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500/90 text-white px-4 py-2 rounded-md text-sm font-medium z-10 shadow-lg transition-opacity duration-500">
          Click to add points ({polygonPoints.length}/3 minimum)
        </div>
      )}

      {/* Count completion controls */}
      {activeTool === 'count' && countPoints.length >= 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 space-y-2">
          {/* Preset selection */}
          <div className="flex flex-wrap gap-1 justify-center bg-white/95 dark:bg-gray-900/95 p-2 rounded-lg shadow-lg">
            {COUNT_PRESETS.map(preset => (
              <Button
                key={preset}
                variant={countPreset === preset ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setCountPreset(preset)}
              >
                {preset}
              </Button>
            ))}
          </div>
          {/* Action buttons */}
          <div className="flex gap-2 justify-center">
            <Button
              onClick={handleCompleteCount}
              className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg"
              size="sm"
            >
              <Check className="h-4 w-4 mr-1" />
              Finish: {countPoints.length} × {countPreset === 'Custom' ? 'Items' : countPreset}
            </Button>
            <Button
              onClick={handleCancelCount}
              variant="destructive"
              size="sm"
              className="shadow-lg"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Count hint when tool is active */}
      {activeTool === 'count' && countPoints.length === 0 && hintVisible && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-orange-500/90 text-white px-4 py-2 rounded-md text-sm font-medium z-10 shadow-lg transition-opacity duration-500">
          Click to count items (toilets, windows, doors, etc.) - select type then click "Finish"
        </div>
      )}

      {/* Eraser hint */}
      {activeTool === 'eraser' && hintVisible && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-md text-sm font-medium z-10 shadow-lg transition-opacity duration-500">
          Click on a measurement to delete it, or click empty space to delete last
        </div>
      )}

      {/* Select tool hint */}
      {activeTool === 'select' && hintVisible && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600/90 text-white px-4 py-2 rounded-md text-sm font-medium z-10 shadow-lg transition-opacity duration-500">
          Click shapes to select - drag corners to resize, drag center to move
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
