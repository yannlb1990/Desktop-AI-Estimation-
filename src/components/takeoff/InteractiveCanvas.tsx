import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, FabricImage, Circle, Line, Rect, Polygon, Text, Point as FabricPoint, util as fabricUtil } from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorldPoint, ViewPoint, Transform, PDFViewportData, Measurement, ToolType } from '@/lib/takeoff/types';
import { calculateLinearWorld, calculateRectangleAreaWorld, calculatePolygonAreaWorld, calculateCentroidWorld, calculateCircleAreaWorld } from '@/lib/takeoff/calculations';
import { viewToWorld } from '@/lib/takeoff/coordinates';
import { DetectedOpening } from '@/lib/takeoff/pdfTextExtractor';

// PDF.js worker served from /public — no CDN, no Vite ?url magic
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface InteractiveCanvasProps {
  pdfUrl: string | null;
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
}

export const InteractiveCanvas = ({
  pdfUrl,
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
  onDeleteLastMeasurement,
  onDeleteMeasurement,
  onMeasurementSelect,
}: InteractiveCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<PDFViewportData | null>(null);

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

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<WorldPoint | null>(null);
  const [previewShape, setPreviewShape] = useState<any>(null);
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

  // Load PDF page
  useEffect(() => {
    if (!pdfUrl || !fabricCanvasRef.current) return;

    const loadPDF = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('Loading PDF from:', pdfUrl);
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageIndex + 1);

        // Get base dimensions for coordinate system (always scale 1.0)
        const baseViewport = page.getViewport({ scale: 1.0, rotation: transform.rotation });

        console.log('PDF base viewport:', {
          width: baseViewport.width,
          height: baseViewport.height
        });

        const pdfViewport: PDFViewportData = {
          width: baseViewport.width,
          height: baseViewport.height,
          scale: 1.0
        };
        setViewport(pdfViewport);
        onViewportReady(pdfViewport);

        // Render at high resolution so zooming stays sharp.
        // Cap so the canvas stays under ~12 000px (browser canvas limit safety margin).
        const maxDim = Math.max(baseViewport.width, baseViewport.height);
        const renderQuality = Math.max(3.0, Math.min(6.0, 12000 / maxDim));
        const hiResViewport = page.getViewport({ scale: renderQuality, rotation: transform.rotation });

        const tempCanvas = document.createElement('canvas');
        const context = tempCanvas.getContext('2d');

        if (!context) throw new Error('Could not get canvas context');

        tempCanvas.width = hiResViewport.width;
        tempCanvas.height = hiResViewport.height;
        context.imageSmoothingEnabled = true;
        (context as any).imageSmoothingQuality = 'high';

        await page.render({ canvasContext: context, viewport: hiResViewport }).promise;

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

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        const message = err instanceof Error ? err.message : String(err);
        const isExpiredBlob = pdfUrl.startsWith('blob:');
        setError(
          isExpiredBlob
            ? 'Plan file is no longer available (session expired). Please re-upload your PDF.'
            : `Failed to load PDF: ${message}`
        );
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [pdfUrl, pageIndex, transform.rotation, onViewportReady]);

  // Apply zoom and pan transforms - SINGLE SOURCE OF TRUTH
  // Re-render measurements when transform changes for stability
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    
    // Apply viewportTransform for zoom and pan
    // [scaleX, skewY, skewX, scaleY, translateX, translateY]
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

  // Keep measurementMapRef in sync so the after:render label handler always has current data
  useEffect(() => {
    measurementMapRef.current = new Map(measurements.map(m => [m.id, m]));
    fabricCanvasRef.current?.requestRenderAll();
  }, [measurements]);

  // Sync canvas objects with measurements state:
  // 1. Remove canvas objects for deleted measurements
  // 2. Draw measurements that are in state but not yet on canvas (reload / tab-restore)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !viewport) return;

    const measurementIds = new Set(measurements.map(m => m.id));
    const objectsMap = measurementObjectsRef.current;

    // Remove canvas objects for measurements that no longer exist in state
    const idsToRemove: string[] = [];
    objectsMap.forEach((objects, id) => {
      if (!measurementIds.has(id)) {
        objects.forEach(obj => canvas.remove(obj));
        idsToRemove.push(id);
      }
    });
    idsToRemove.forEach(id => {
      objectsMap.delete(id);
    });

    // Draw measurements that are in state but not yet on canvas (page restore / reload)
    const strokeWidth = getZoomAwareSize(2);

    measurements.forEach(measurement => {
      if (objectsMap.has(measurement.id)) return; // already drawn
      if (!measurement.worldPoints || measurement.worldPoints.length < 2) return;

      const color = measurement.color || '#FF6B6B';
      let shape: any = null;

      if (measurement.type === 'line') {
        const [s, e] = measurement.worldPoints;
        shape = new Line([s.x, s.y, e.x, e.y], {
          stroke: color, strokeWidth, selectable: false, evented: false,
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

    const drawLabels = () => {
      const ctx = (canvas as any).contextContainer as CanvasRenderingContext2D;
      if (!ctx) return;
      const vt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      const zoom = vt[0] || 1;

      // Establish a known, deterministic context state so labels always land on shapes:
      // 1. Reset to identity (clears whatever Fabric left on the context)
      // 2. Reapply DPR scale (Fabric applies this at init; we must match it)
      // 3. Apply viewport transform (pan + zoom) — now context is in world space
      // Drawing at raw world coordinates then correctly maps to screen via these transforms.
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);          // baseline: DPR only
      ctx.transform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5]); // apply viewport → world space

      // Font/stroke sizes in world units so they appear consistent at all zoom levels
      const worldFontSize = 12 / zoom;
      const padX = 6 / zoom;
      const labelH = 20 / zoom;

      ctx.font = `bold ${worldFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const drawLabel = (text: string, worldX: number, worldY: number, color: string) => {
        const textW = ctx.measureText(text).width;
        const boxX = worldX - textW / 2 - padX;
        const boxY = worldY - labelH / 2; // centred on the shape midpoint
        ctx.fillStyle = 'rgba(255,255,255,0.93)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 / zoom;
        ctx.fillRect(boxX, boxY, textW + padX * 2, labelH);
        ctx.strokeRect(boxX, boxY, textW + padX * 2, labelH);
        ctx.fillStyle = color;
        ctx.fillText(text, worldX, boxY + labelH / 2);
      };

      measurementObjectsRef.current.forEach((objects, measurementId) => {
        const measurement = measurementMapRef.current.get(measurementId);
        if (!measurement?.label) return;
        const shape = objects[0];
        if (!shape) return;
        // getCenterPoint() returns the object's centre in canvas (world) coordinates,
        // which is exactly what we draw in after applying the viewport transform.
        const center = shape.getCenterPoint();
        let worldX = center.x;
        let worldY = center.y;

        if (shape.type === 'line') {
          // For lines, offset label slightly to the left of the line (perpendicular)
          // so it sits next to the line rather than obscuring it.
          const mat = shape.calcTransformMatrix();
          const p1 = fabricUtil.transformPoint({ x: (shape as any).x1, y: (shape as any).y1 }, mat);
          const p2 = fabricUtil.transformPoint({ x: (shape as any).x2, y: (shape as any).y2 }, mat);
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          // Left-hand perpendicular (rotate 90° counter-clockwise)
          const perpX = -dy / len;
          const perpY = dx / len;
          const offset = 14 / zoom; // ~14 CSS-px offset in world units
          worldX += perpX * offset;
          worldY += perpY * offset;
        } else if (measurement.type === 'count') {
          // For count groups, average the centres of all markers
          let sx = 0, sy = 0;
          objects.forEach(o => { const c = o.getCenterPoint(); sx += c.x; sy += c.y; });
          worldX = sx / objects.length;
          worldY = sy / objects.length;
        }

        drawLabel(measurement.label, worldX, worldY, measurement.color || '#FF6B6B');

        // For count groups: draw the number inside each individual circle
        if ((measurement as any).type === 'count') {
          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          objects.forEach((obj, i) => {
            const c = obj.getCenterPoint();
            ctx.fillText(String(i + 1), c.x, c.y);
          });
        }
      });

      if (previewLabelRef.current) {
        const { text, worldX, worldY, color } = previewLabelRef.current;
        drawLabel(text, worldX, worldY, color);
      }

      ctx.restore();
    };

    canvas.on('after:render', drawLabels);
    return () => { canvas.off('after:render', drawLabels); };
  }, []); // Reads only refs — no stale-closure risk, register once

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
      if (target.type === 'line') {
        // For lines, we need to apply the transformation matrix to get actual coordinates
        // Fabric.js lines store x1,y1,x2,y2 relative to their origin
        const matrix = target.calcTransformMatrix();
        const p1 = fabricUtil.transformPoint({ x: target.x1, y: target.y1 }, matrix);
        const p2 = fabricUtil.transformPoint({ x: target.x2, y: target.y2 }, matrix);

        const startPoint: WorldPoint = { x: p1.x, y: p1.y };
        const endPoint: WorldPoint = { x: p2.x, y: p2.y };
        const result = calculateLinearWorld(startPoint, endPoint, effectiveUnits);

        const labelText = isCalibrated ? `${result.realValue.toFixed(2)} m` : `${result.worldValue.toFixed(0)} px`;

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

  // Delete key — remove a single selected count marker and update the count
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    const worldPoint = viewToWorld(viewPoint, transform, viewport);

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

    // Handle select mode — Fabric.js manages object selection natively, don't start drawing
    if (activeTool === 'select') return;

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
          onDeleteMeasurement?.(measurementId);
        } else {
          // Orphaned / untracked shape — just remove it from canvas directly
          canvas.remove(target);
        }
        canvas.requestRenderAll();
      }
      return;
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
    const currentWorldPoint: WorldPoint = viewToWorld(
      { x: pointer.x, y: pointer.y },
      transform,
      viewport
    );

    // Remove previous preview
    if (previewShape) {
      canvas.remove(previewShape);
    }

    let shape: any = null;
    const color = isCalibrated ? 'red' : 'orange';
    const strokeWidth = getZoomAwareSize(2);
    const dashSize = getZoomAwareSize(5);

    // Draw preview shapes at WORLD coordinates - viewportTransform handles zoom/pan
    if (activeTool === 'line') {
      shape = new Line([startPoint.x, startPoint.y, currentWorldPoint.x, currentWorldPoint.y], {
        stroke: color,
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
    }

    if (shape) {
      canvas.add(shape);
      setPreviewShape(shape);
    }

    // Update live measurement preview label
    if (activeTool === 'line') {
      const eu = unitsPerMetre || 1;
      const r = calculateLinearWorld(startPoint, currentWorldPoint, eu);
      const t = isCalibrated ? `${r.realValue.toFixed(2)} m` : `${r.worldValue.toFixed(0)} px`;
      previewLabelRef.current = { text: t, worldX: (startPoint.x + currentWorldPoint.x) / 2, worldY: (startPoint.y + currentWorldPoint.y) / 2, color: isCalibrated ? 'red' : 'orange' };
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
    } else {
      previewLabelRef.current = null;
    }

    canvas.requestRenderAll();
  }, [
    viewport, transform, isPanning, lastClientPos, isDrawing, startPoint,
    previewShape, activeTool, isCalibrated, unitsPerMetre, onTransformChange,
    calibrationMode, isCalibrationDragging, calibrationStartPoint, handleCalibrationMouseMove,
    getZoomAwareSize, polygonPoints
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

    if (!isDrawing || !startPoint || !viewport) return;

    // CRITICAL FIX: Use getPointer(e.e, true) for raw canvas coordinates
    const pointer = canvas.getPointer(e.e, true);
    const worldEndPoint = viewToWorld({ x: pointer.x, y: pointer.y }, transform, viewport);

    // Remove preview shape
    if (previewShape) {
      canvas.remove(previewShape);
      setPreviewShape(null);
    }

    // Helper: abort drawing cleanly (clears preview label + ghost state)
    const abortDraw = () => {
      previewLabelRef.current = null;
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

      // Draw at WORLD coordinates - viewportTransform handles zoom/pan
      const line = new Line([startPoint.x, startPoint.y, worldEndPoint.x, worldEndPoint.y], {
        stroke: isCalibrated ? 'red' : 'orange',
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
        color: isCalibrated ? '#FF6B6B' : '#FF9800',
        label: labelText,
        pageIndex: pageIndex,
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
    setIsDrawing(false);
    setStartPoint(null);
    canvas.requestRenderAll();
  }, [
    viewport, transform, isPanning, isDrawing, startPoint, previewShape,
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
          <p className="text-destructive">{error}</p>
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
      {activeTool === 'polygon' && polygonPoints.length > 0 && polygonPoints.length < 3 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500/90 text-white px-4 py-2 rounded-md text-sm font-medium z-10 shadow-lg">
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
      {activeTool === 'count' && countPoints.length === 0 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-orange-500/90 text-white px-4 py-2 rounded-md text-sm font-medium z-10 shadow-lg">
          Click to count items (toilets, windows, doors, etc.) - select type then click "Finish"
        </div>
      )}

      {/* Eraser hint */}
      {activeTool === 'eraser' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-md text-sm font-medium z-10 shadow-lg">
          Click on a measurement to delete it, or click empty space to delete last
        </div>
      )}

      {/* Select tool hint */}
      {activeTool === 'select' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600/90 text-white px-4 py-2 rounded-md text-sm font-medium z-10 shadow-lg">
          Click shapes to select - drag corners to resize, drag center to move
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
