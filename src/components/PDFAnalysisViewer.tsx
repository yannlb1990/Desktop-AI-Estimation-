// PDF Analysis Viewer - Shows PDF pages with detection markups and source traceability
// Includes Computer Vision detection for walls, doors, windows
// Includes Scale Calibration for real-world measurements
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { loadPDFFromArrayBuffer, renderPageToCanvas, PDFLoadResult } from '@/lib/pdfService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  Layers,
  Eye,
  EyeOff,
  DoorOpen,
  Square,
  Zap,
  Droplets,
  Home,
  Box,
  Grid3X3,
  CircleDot,
  Lightbulb,
  Wind,
  Flame,
  Cable,
  PaintBucket,
  MapPin,
  AlertCircle,
  Scan,
  Loader2,
  Ruler,
  PenTool,
  Move,
  Check,
  X,
  Trash2,
  FileText,
  Palette,
  ClipboardList,
  Building,
  Hand,
  GripHorizontal,
  MousePointer2,
} from 'lucide-react';
import { PageAnalysis, PlanAnalysisResult, StandardsReference, MaterialSelection, FloorArea } from '@/lib/aiPlanAnalyzer';
import { analyzePageImage, CVAnalysisResult, DetectedShape } from '@/lib/cvDetector';
import {
  ScaleCalibration,
  CalibrationPoint,
  MeasuredLine,
  MeasuredArea,
  createCalibration,
  createMeasuredLine,
  createMeasuredArea,
  calculatePixelDistance,
  pixelsToReal,
  pixelAreaToReal,
} from '@/lib/scaleCalibration';
import {
  RoomType,
  ROOM_TYPES,
  MeasuredRoom,
} from '@/lib/projectManager';

// Measurement mode types - added 'pan' for document navigation
type MeasurementMode = 'none' | 'calibrate' | 'distance' | 'area' | 'pan';

// Extended element types for auto-detection
type ElementType =
  | 'wall' | 'door' | 'window' | 'room'
  | 'power_point' | 'light' | 'switch' | 'smoke_detector'
  | 'toilet' | 'sink' | 'shower' | 'bath' | 'tap'
  | 'beam' | 'column' | 'slab' | 'footing'
  | 'hvac' | 'duct' | 'diffuser'
  | 'appliance' | 'furniture'
  | 'dimension' | 'annotation' | 'symbol'
  | 'site_element' | 'bike_rack' | 'bollard' | 'signage' | 'fence' | 'landscaping';

interface DetectionMarkup {
  id: string;
  type: ElementType;
  label: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  linkedEstimateId?: string;
  confidence: number;
  source: 'text' | 'cv'; // Whether detected from text or computer vision
  // For CV-detected lines (walls)
  line?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

interface PDFAnalysisViewerProps {
  pdfData: ArrayBuffer;
  pages: PageAnalysis[];
  analysisResult?: PlanAnalysisResult; // Full analysis result for enhanced data display
  onMarkupClick?: (markup: DetectionMarkup) => void;
  highlightedItemId?: string | null;
  showMarkups?: boolean;
  targetPage?: number;      // External page navigation
  targetPageVersion?: number; // Incremented on every nav request so effect always fires
  // Callbacks for project integration
  onRoomCreated?: (room: MeasuredRoom) => void;
  onCalibrationChanged?: (calibration: ScaleCalibration | null) => void;
  onCalibrationsChanged?: (calibrations: Record<number, ScaleCalibration>) => void;
  onMeasurementsChanged?: (lines: MeasuredLine[], rooms: MeasuredRoom[]) => void;
  // Initial state from saved project - supports per-page calibrations
  initialCalibration?: ScaleCalibration | null;
  initialCalibrations?: Record<number, ScaleCalibration>;
  initialMeasuredLines?: MeasuredLine[];
  initialMeasuredRooms?: MeasuredRoom[];
}

// Comprehensive color palette for all element types
const ELEMENT_COLORS: Record<ElementType, { color: string; label: string; icon: React.ReactNode }> = {
  // Structural
  wall: { color: '#1e293b', label: 'Wall', icon: <Box className="h-3 w-3" /> },
  beam: { color: '#7c3aed', label: 'Beam', icon: <Box className="h-3 w-3" /> },
  column: { color: '#6d28d9', label: 'Column', icon: <CircleDot className="h-3 w-3" /> },
  slab: { color: '#4c1d95', label: 'Slab', icon: <Grid3X3 className="h-3 w-3" /> },
  footing: { color: '#581c87', label: 'Footing', icon: <Box className="h-3 w-3" /> },

  // Openings
  door: { color: '#ef4444', label: 'Door', icon: <DoorOpen className="h-3 w-3" /> },
  window: { color: '#3b82f6', label: 'Window', icon: <Square className="h-3 w-3" /> },

  // Rooms
  room: { color: '#8b5cf6', label: 'Room', icon: <Home className="h-3 w-3" /> },

  // Electrical
  power_point: { color: '#f59e0b', label: 'Power Point', icon: <Zap className="h-3 w-3" /> },
  light: { color: '#fbbf24', label: 'Light', icon: <Lightbulb className="h-3 w-3" /> },
  switch: { color: '#d97706', label: 'Switch', icon: <CircleDot className="h-3 w-3" /> },
  smoke_detector: { color: '#dc2626', label: 'Smoke Detector', icon: <CircleDot className="h-3 w-3" /> },

  // Plumbing
  toilet: { color: '#06b6d4', label: 'Toilet', icon: <Droplets className="h-3 w-3" /> },
  sink: { color: '#14b8a6', label: 'Sink', icon: <Droplets className="h-3 w-3" /> },
  shower: { color: '#0ea5e9', label: 'Shower', icon: <Droplets className="h-3 w-3" /> },
  bath: { color: '#0891b2', label: 'Bath', icon: <Droplets className="h-3 w-3" /> },
  tap: { color: '#22d3ee', label: 'Tap', icon: <Droplets className="h-3 w-3" /> },

  // HVAC
  hvac: { color: '#10b981', label: 'HVAC Unit', icon: <Wind className="h-3 w-3" /> },
  duct: { color: '#059669', label: 'Duct', icon: <Cable className="h-3 w-3" /> },
  diffuser: { color: '#34d399', label: 'Diffuser', icon: <Wind className="h-3 w-3" /> },

  // FF&E
  appliance: { color: '#ec4899', label: 'Appliance', icon: <Flame className="h-3 w-3" /> },
  furniture: { color: '#f472b6', label: 'Furniture', icon: <Box className="h-3 w-3" /> },

  // Annotations
  dimension: { color: '#64748b', label: 'Dimension', icon: <Grid3X3 className="h-3 w-3" /> },
  annotation: { color: '#94a3b8', label: 'Annotation', icon: <PaintBucket className="h-3 w-3" /> },
  symbol: { color: '#6b7280', label: 'Symbol', icon: <CircleDot className="h-3 w-3" /> },

  // Site Elements (external/outdoor)
  site_element: { color: '#84cc16', label: 'Site Element', icon: <MapPin className="h-3 w-3" /> },
  bike_rack: { color: '#65a30d', label: 'Bike Rack', icon: <GripHorizontal className="h-3 w-3" /> },
  bollard: { color: '#a3a3a3', label: 'Bollard', icon: <CircleDot className="h-3 w-3" /> },
  signage: { color: '#0284c7', label: 'Signage', icon: <MapPin className="h-3 w-3" /> },
  fence: { color: '#78716c', label: 'Fence', icon: <Grid3X3 className="h-3 w-3" /> },
  landscaping: { color: '#22c55e', label: 'Landscaping', icon: <Box className="h-3 w-3" /> },
};

export function PDFAnalysisViewer({
  pdfData,
  pages,
  analysisResult,
  onMarkupClick,
  highlightedItemId,
  showMarkups = true,
  targetPage,
  targetPageVersion,
  onRoomCreated,
  onCalibrationChanged,
  onCalibrationsChanged,
  onMeasurementsChanged,
  initialCalibration,
  initialCalibrations,
  initialMeasuredLines,
  initialMeasuredRooms,
}: PDFAnalysisViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cvCanvasRef = useRef<HTMLCanvasElement>(null); // For CV analysis

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [baseScale, setBaseScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markupsVisible, setMarkupsVisible] = useState(showMarkups);
  const [markups, setMarkups] = useState<DetectionMarkup[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [renderKey, setRenderKey] = useState(0);
  // Store PDF page dimensions for coordinate normalization
  const [pageDimensions, setPageDimensions] = useState<Record<number, { width: number; height: number }>>({});

  // Computer Vision state
  const [cvResults, setCvResults] = useState<Record<number, CVAnalysisResult>>({});
  const [isCvAnalyzing, setIsCvAnalyzing] = useState(false);
  const [cvProgress, setCvProgress] = useState(0);
  const [showCvMarkups, setShowCvMarkups] = useState(true);
  const [showTextMarkups, setShowTextMarkups] = useState(true);

  // Scale Calibration & Measurement state - NOW PER-PAGE
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('none');
  const [calibrations, setCalibrations] = useState<Record<number, ScaleCalibration>>(() => {
    if (initialCalibrations && Object.keys(initialCalibrations).length > 0) {
      return initialCalibrations;
    }
    if (initialCalibration) {
      return { [initialCalibration.pageNumber]: initialCalibration };
    }
    return {};
  });
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const [measurementPoints, setMeasurementPoints] = useState<CalibrationPoint[]>([]);
  const [measuredLines, setMeasuredLines] = useState<MeasuredLine[]>(initialMeasuredLines || []);
  const [measuredRooms, setMeasuredRooms] = useState<MeasuredRoom[]>(initialMeasuredRooms || []);
  const [showCalibrationDialog, setShowCalibrationDialog] = useState(false);
  const [calibrationDistance, setCalibrationDistance] = useState('');
  const [calibrationUnit, setCalibrationUnit] = useState<'mm' | 'm' | 'ft' | 'in'>('m');
  const [showMeasurements, setShowMeasurements] = useState(true);

  // Pan/drag state for document navigation
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

  // Pan offset for unrestricted movement (beyond scroll bounds)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Drag-to-draw state for distance/area measurements
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<CalibrationPoint | null>(null);
  const [dragCurrentPoint, setDragCurrentPoint] = useState<CalibrationPoint | null>(null);

  // External page navigation: fires on every version bump so re-clicking same page still works.
  // Also bumps renderKey so the canvas re-renders even if it was hidden (display:none) when
  // setCurrentPage fired.
  useEffect(() => {
    if (targetPage && targetPage >= 1) {
      setCurrentPage(targetPage);
      // Defer renderKey bump so the new page renders once the tab is visible
      requestAnimationFrame(() => setRenderKey(k => k + 1));
    }
  }, [targetPageVersion, targetPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get calibration for current page
  const currentCalibration = calibrations[currentPage] || null;

  // Count calibrated vs uncalibrated pages
  const calibratedPageCount = Object.keys(calibrations).length;

  // Room assignment state (for area measurements)
  const [showRoomAssignmentDialog, setShowRoomAssignmentDialog] = useState(false);
  const [pendingAreaPoints, setPendingAreaPoints] = useState<CalibrationPoint[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType>('living');
  const [customRoomLabel, setCustomRoomLabel] = useState('');

  // Extraction summary panel state
  const [showExtractionSummary, setShowExtractionSummary] = useState(true);

  // Fullscreen takeoff mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Escape exits fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // Load PDF document using centralized service
  useEffect(() => {
    // Guard: Don't try to load if pdfData is invalid
    if (!pdfData || pdfData.byteLength === 0) {
      console.warn('[PDFAnalysisViewer] No valid pdfData provided');
      setLoadError('No PDF data provided');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadPDF = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        console.log(`[PDFAnalysisViewer] Loading PDF (${(pdfData.byteLength / 1024 / 1024).toFixed(2)} MB)...`);

        const result = await loadPDFFromArrayBuffer(pdfData);

        if (cancelled) {
          console.log('[PDFAnalysisViewer] Load cancelled, component unmounted');
          return;
        }

        setPdfDoc(result.document);
        setTotalPages(result.pageCount);
        setPageDimensions(result.pageDimensions);
        setCurrentPage(1);

        console.log(`[PDFAnalysisViewer] PDF loaded: ${result.pageCount} pages`);
      } catch (error) {
        if (cancelled) return;

        console.error('[PDFAnalysisViewer] Error loading PDF:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load PDF');
        setTotalPages(0);
        setPdfDoc(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPDF();

    return () => {
      cancelled = true;
    };
  }, [pdfData]);

  // Generate markups from page analysis using ACTUAL bounds from detection
  useEffect(() => {
    const generatedMarkups: DetectionMarkup[] = [];

    pages.forEach((page) => {
      const pageDim = pageDimensions[page.pageNumber];
      if (!pageDim) return; // Wait for page dimensions to load

      // Helper to normalize PDF coordinates to percentage (0-100)
      // PDF coordinates: bottom-left origin, raw units
      // Canvas coordinates: top-left origin, percentage
      const normalizeCoords = (x: number, y: number, width: number, height: number) => {
        // Convert to percentage of page
        const normX = (x / pageDim.width) * 100;
        // Flip Y axis (PDF is bottom-left, canvas is top-left)
        const normY = ((pageDim.height - y - height) / pageDim.height) * 100;
        const normW = Math.max((width / pageDim.width) * 100, 2); // Minimum 2% width
        const normH = Math.max((height / pageDim.height) * 100, 1.5); // Minimum 1.5% height
        return { x: normX, y: normY, width: normW, height: normH };
      };

      // Add symbol markups with ACTUAL positions from PDF text extraction
      page.symbols.forEach((symbol, idx) => {
        const symbolType = symbol.type as ElementType;
        const config = ELEMENT_COLORS[symbolType] || ELEMENT_COLORS.symbol;

        // Use actual bounds if available, otherwise mark as "no position"
        const hasBounds = symbol.bounds && symbol.bounds.x > 0 && symbol.bounds.y > 0;
        let coords;

        if (hasBounds) {
          coords = normalizeCoords(
            symbol.bounds.x,
            symbol.bounds.y,
            symbol.bounds.width || 20,
            symbol.bounds.height || 15
          );
        } else {
          // No valid position - don't show markup for this item
          return;
        }

        generatedMarkups.push({
          id: `${page.pageNumber}-symbol-${idx}`,
          type: symbolType,
          label: symbol.label || symbol.type,
          pageNumber: page.pageNumber,
          x: coords.x,
          y: coords.y,
          width: coords.width,
          height: coords.height,
          color: config.color,
          confidence: symbol.confidence,
          source: 'text',
        });
      });

      // Add room markups - rooms typically have labels in the PDF
      // We use the room name position if available in the analysis
      page.rooms.forEach((room, idx) => {
        // Rooms don't have direct bounds, but we can try to find the text
        // For now, we'll skip rooms that don't have position data
        // This is a limitation - would need OCR with positions to fix
      });
    });

    setMarkups(generatedMarkups);
  }, [pages, pageDimensions]);

  // Run Computer Vision analysis on current page
  const runCvAnalysis = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || isCvAnalyzing) return;

    setIsCvAnalyzing(true);
    setCvProgress(0);

    try {
      // Render page at lower resolution for CV analysis (faster processing)
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1.0 }); // Use scale 1 for CV

      // Create offscreen canvas for CV
      const cvCanvas = document.createElement('canvas');
      cvCanvas.width = viewport.width;
      cvCanvas.height = viewport.height;
      const cvCtx = cvCanvas.getContext('2d')!;

      // Render to CV canvas
      await page.render({
        canvasContext: cvCtx,
        viewport,
      }).promise;

      setCvProgress(30);

      // Run CV analysis
      const result = await analyzePageImage(cvCanvas, currentPage);

      setCvProgress(90);

      // Store result
      setCvResults(prev => ({
        ...prev,
        [currentPage]: result
      }));

      setCvProgress(100);
      console.log(`CV Analysis complete for page ${currentPage}:`, result);

      // Clean up
      cvCanvas.remove();
    } catch (error) {
      console.error('CV Analysis failed:', error);
    } finally {
      setIsCvAnalyzing(false);
    }
  }, [pdfDoc, currentPage, isCvAnalyzing]);

  // Get canvas coordinates from mouse event
  const getCanvasCoordinates = useCallback((e: React.MouseEvent): CalibrationPoint | null => {
    const canvasEl = canvasRef.current;
    if (!canvasEl || canvasSize.width === 0) return null;

    const rect = canvasEl.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    };
  }, [canvasSize]);

  // Handle mouse down for drag-to-draw measurements
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (measurementMode === 'none' || measurementMode === 'pan') return;

    const point = getCanvasCoordinates(e);
    if (!point) return;

    if (measurementMode === 'calibrate') {
      if (calibrationPoints.length === 0) {
        setCalibrationPoints([point]);
        setIsDragging(true);
        setDragStartPoint(point);
        setDragCurrentPoint(point);
      }
    } else if (measurementMode === 'distance') {
      if (!currentCalibration) {
        alert('Please calibrate this page first');
        return;
      }
      setIsDragging(true);
      setDragStartPoint(point);
      setDragCurrentPoint(point);
    } else if (measurementMode === 'area') {
      if (!currentCalibration) {
        alert('Please calibrate this page first');
        return;
      }
      // Area mode: Start rectangle drag
      setIsDragging(true);
      setDragStartPoint(point);
      setDragCurrentPoint(point);
    }
  }, [measurementMode, calibrationPoints, currentCalibration, getCanvasCoordinates]);

  // Handle mouse move for drag-to-draw
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || measurementMode === 'none' || measurementMode === 'pan') return;

    const point = getCanvasCoordinates(e);
    if (point) {
      setDragCurrentPoint(point);
    }
  }, [isDragging, measurementMode, getCanvasCoordinates]);

  // Handle mouse up to complete drag-to-draw measurement
  const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartPoint || !dragCurrentPoint) {
      setIsDragging(false);
      return;
    }

    const endPoint = getCanvasCoordinates(e) || dragCurrentPoint;

    // Calculate distance to ensure it's not just a click (minimum drag distance)
    const dragDist = Math.sqrt(
      Math.pow(endPoint.x - dragStartPoint.x, 2) + Math.pow(endPoint.y - dragStartPoint.y, 2)
    );

    if (dragDist < 1) {
      // Too short - treat as a click, reset
      setIsDragging(false);
      setDragStartPoint(null);
      setDragCurrentPoint(null);
      return;
    }

    if (measurementMode === 'calibrate') {
      setCalibrationPoints([dragStartPoint, endPoint]);
      setShowCalibrationDialog(true);
    } else if (measurementMode === 'distance' && currentCalibration) {
      const newLine = createMeasuredLine(
        `Distance ${measuredLines.length + 1}`,
        currentPage,
        dragStartPoint,
        endPoint,
        currentCalibration,
        canvasSize.width,
        canvasSize.height
      );
      setMeasuredLines([...measuredLines, newLine]);
    } else if (measurementMode === 'area' && currentCalibration) {
      // Create rectangle from drag start to end
      const minX = Math.min(dragStartPoint.x, endPoint.x);
      const maxX = Math.max(dragStartPoint.x, endPoint.x);
      const minY = Math.min(dragStartPoint.y, endPoint.y);
      const maxY = Math.max(dragStartPoint.y, endPoint.y);

      const rectanglePoints: CalibrationPoint[] = [
        { x: minX, y: minY }, // Top-left
        { x: maxX, y: minY }, // Top-right
        { x: maxX, y: maxY }, // Bottom-right
        { x: minX, y: maxY }, // Bottom-left
      ];

      setPendingAreaPoints(rectanglePoints);
      setShowRoomAssignmentDialog(true);
    }

    setIsDragging(false);
    setDragStartPoint(null);
    setDragCurrentPoint(null);
  }, [isDragging, dragStartPoint, dragCurrentPoint, measurementMode, currentCalibration, measuredLines, currentPage, canvasSize, getCanvasCoordinates]);

  // Handle canvas click for measurements - now only for calibration second point
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle clicks for calibration mode when we have 1 point already
    // Other modes now use drag-to-draw
    if (measurementMode !== 'calibrate' || calibrationPoints.length !== 1) return;
    if (canvasSize.width === 0) return;

    const point = getCanvasCoordinates(e);
    if (!point) return;

    setCalibrationPoints([calibrationPoints[0], point]);
    setShowCalibrationDialog(true);
  }, [measurementMode, calibrationPoints, canvasSize, getCanvasCoordinates]);

  // Complete area measurement - show room assignment dialog
  const completeAreaMeasurement = useCallback(() => {
    if (measurementPoints.length < 3 || !currentCalibration) return;

    // Store points and show room assignment dialog
    setPendingAreaPoints([...measurementPoints]);
    setShowRoomAssignmentDialog(true);
    setMeasurementPoints([]);
    setMeasurementMode('none');
  }, [measurementPoints, currentCalibration]);

  // Apply room assignment and create measured room
  const applyRoomAssignment = useCallback(() => {
    if (pendingAreaPoints.length < 3 || !currentCalibration) return;

    const roomConfig = ROOM_TYPES[selectedRoomType];
    const roomLabel = customRoomLabel || `${roomConfig.label} ${measuredRooms.filter(r => r.roomType === selectedRoomType).length + 1}`;

    const baseArea = createMeasuredArea(
      roomLabel,
      currentPage,
      pendingAreaPoints,
      currentCalibration,
      canvasSize.width,
      canvasSize.height
    );

    const newRoom: MeasuredRoom = {
      ...baseArea,
      roomType: selectedRoomType,
      roomLabel,
      generatedLineItems: [],
    };

    const updatedRooms = [...measuredRooms, newRoom];
    setMeasuredRooms(updatedRooms);

    // Notify parent component
    onRoomCreated?.(newRoom);
    onMeasurementsChanged?.(measuredLines, updatedRooms);

    // Reset dialog state
    setShowRoomAssignmentDialog(false);
    setPendingAreaPoints([]);
    setCustomRoomLabel('');
    setSelectedRoomType('living');
  }, [pendingAreaPoints, currentCalibration, selectedRoomType, customRoomLabel, measuredRooms, currentPage, canvasSize, onRoomCreated, onMeasurementsChanged, measuredLines]);

  // Apply calibration - stores per-page
  const applyCalibration = useCallback(() => {
    if (calibrationPoints.length !== 2 || !calibrationDistance) return;

    const distance = parseFloat(calibrationDistance);
    if (isNaN(distance) || distance <= 0) {
      alert('Please enter a valid distance');
      return;
    }

    const newCalibration = createCalibration(
      currentPage,
      calibrationPoints[0],
      calibrationPoints[1],
      distance,
      calibrationUnit,
      canvasSize.width,
      canvasSize.height
    );

    // Store calibration for this page
    const updatedCalibrations = {
      ...calibrations,
      [currentPage]: newCalibration
    };
    setCalibrations(updatedCalibrations);
    setCalibrationPoints([]);
    setShowCalibrationDialog(false);
    setCalibrationDistance('');
    setMeasurementMode('none');

    // Notify parent component with current page calibration and all calibrations
    onCalibrationChanged?.(newCalibration);
    onCalibrationsChanged?.(updatedCalibrations);
    console.log(`Calibration applied for page ${currentPage}:`, newCalibration);
  }, [calibrationPoints, calibrationDistance, calibrationUnit, canvasSize, currentPage, calibrations, onCalibrationChanged, onCalibrationsChanged]);

  // Cancel measurement
  const cancelMeasurement = useCallback(() => {
    setMeasurementPoints([]);
    setCalibrationPoints([]);
    setMeasurementMode('none');
    setShowCalibrationDialog(false);
  }, []);

  // Clear all measurements
  const clearMeasurements = useCallback(() => {
    setMeasuredLines([]);
    setMeasuredRooms([]);
    setMeasurementPoints([]);
    onMeasurementsChanged?.([], []);
  }, [onMeasurementsChanged]);

  // Delete a specific measurement
  const deleteMeasurement = useCallback((type: 'line' | 'room', id: string) => {
    if (type === 'line') {
      const updatedLines = measuredLines.filter(l => l.id !== id);
      setMeasuredLines(updatedLines);
      onMeasurementsChanged?.(updatedLines, measuredRooms);
    } else {
      const updatedRooms = measuredRooms.filter(r => r.id !== id);
      setMeasuredRooms(updatedRooms);
      onMeasurementsChanged?.(measuredLines, updatedRooms);
    }
  }, [measuredLines, measuredRooms, onMeasurementsChanged]);

  // Combine text-based and CV-based markups
  const allMarkups = useMemo(() => {
    const combined: DetectionMarkup[] = [];

    // Add text-based markups if enabled
    if (showTextMarkups) {
      combined.push(...markups);
    }

    // Add CV-detected markups if enabled and available
    if (showCvMarkups && cvResults[currentPage]) {
      const cvResult = cvResults[currentPage];

      // Add walls
      cvResult.walls.forEach((shape, idx) => {
        combined.push({
          id: `cv-wall-${currentPage}-${idx}`,
          type: 'wall',
          label: `Wall ${idx + 1}`,
          pageNumber: currentPage,
          x: shape.bounds.x,
          y: shape.bounds.y,
          width: shape.bounds.width,
          height: shape.bounds.height,
          color: '#1e293b',
          confidence: shape.confidence,
          source: 'cv',
          line: shape.line ? {
            x1: shape.line.x1,
            y1: shape.line.y1,
            x2: shape.line.x2,
            y2: shape.line.y2,
          } : undefined,
        });
      });

      // Add doors
      cvResult.doors.forEach((shape, idx) => {
        combined.push({
          id: `cv-door-${currentPage}-${idx}`,
          type: 'door',
          label: `Door ${idx + 1}`,
          pageNumber: currentPage,
          x: shape.bounds.x,
          y: shape.bounds.y,
          width: shape.bounds.width,
          height: shape.bounds.height,
          color: '#ef4444',
          confidence: shape.confidence,
          source: 'cv',
        });
      });

      // Add windows
      cvResult.windows.forEach((shape, idx) => {
        combined.push({
          id: `cv-window-${currentPage}-${idx}`,
          type: 'window',
          label: `Window ${idx + 1}`,
          pageNumber: currentPage,
          x: shape.bounds.x,
          y: shape.bounds.y,
          width: shape.bounds.width,
          height: shape.bounds.height,
          color: '#3b82f6',
          confidence: shape.confidence,
          source: 'cv',
        });
      });

      // Add fixtures
      cvResult.fixtures.forEach((shape, idx) => {
        combined.push({
          id: `cv-fixture-${currentPage}-${idx}`,
          type: 'appliance',
          label: `Fixture ${idx + 1}`,
          pageNumber: currentPage,
          x: shape.bounds.x,
          y: shape.bounds.y,
          width: shape.bounds.width,
          height: shape.bounds.height,
          color: '#f59e0b',
          confidence: shape.confidence,
          source: 'cv',
        });
      });
    }

    return combined;
  }, [markups, cvResults, currentPage, showCvMarkups, showTextMarkups]);

  // Render current page with proper zoom
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    const renderPage = async () => {
      setIsLoading(true);
      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        // Get container width for base scale - ensure it has width
        let containerWidth = containerRef.current!.clientWidth - 32; // padding

        // If container has no width yet, use a reasonable default and trigger re-render
        if (containerWidth <= 0) {
          containerWidth = 800; // Fallback width
          // Schedule a re-render once layout is complete
          requestAnimationFrame(() => setRenderKey(k => k + 1));
        }

        const baseViewport = page.getViewport({ scale: 1, rotation });

        // Calculate base scale to fit width
        const calculatedBaseScale = containerWidth / baseViewport.width;
        setBaseScale(calculatedBaseScale);

        // Apply zoom on top of base scale
        const finalScale = calculatedBaseScale * zoom;
        const viewport = page.getViewport({ scale: finalScale, rotation });

        // Set canvas size
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setCanvasSize({ width: viewport.width, height: viewport.height });

        // Clear and render
        context.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

      } catch (error) {
        console.error('Error rendering page:', error);
      } finally {
        setIsLoading(false);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, zoom, rotation, renderKey]);

  // Re-render on window resize only - removed automatic re-render on mount
  // The initial render is handled by the PDF load effect
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      // Debounce resize events to prevent multiple re-renders
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setRenderKey(k => k + 1);
      }, 150);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  // Navigation
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  // Zoom controls - fixed
  const zoomIn = useCallback(() => {
    setZoom(z => Math.min(z + 0.25, 4));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(z => Math.max(z - 0.25, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  // Rotation
  const rotate = useCallback(() => {
    setRotation(r => (r + 90) % 360);
  }, []);

  // Pan/drag handlers for document navigation - unrestricted movement
  const handlePanStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (measurementMode !== 'pan') return;
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  }, [measurementMode]);

  const handlePanMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || measurementMode !== 'pan') return;
    e.preventDefault();
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    // Update pan offset for unrestricted movement
    setPanOffset(prev => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));
    setPanStart({ x: e.clientX, y: e.clientY });
  }, [isPanning, measurementMode, panStart]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Reset pan offset when changing pages or zoom
  const resetPanOffset = useCallback(() => {
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Double-click to reset pan when in pan mode
  const handleDoubleClick = useCallback(() => {
    if (measurementMode === 'pan') {
      resetPanOffset();
    }
  }, [measurementMode, resetPanOffset]);

  // Get markups for current page (using combined markups)
  const currentPageMarkups = allMarkups.filter(m => m.pageNumber === currentPage);

  // Get unique detected types for legend
  const detectedTypes = [...new Set(currentPageMarkups.map(m => m.type))];

  // Get CV result for current page
  const currentCvResult = cvResults[currentPage];

  // Separate text vs CV markups for stats
  const textMarkupCount = currentPageMarkups.filter(m => m.source === 'text').length;
  const cvMarkupCount = currentPageMarkups.filter(m => m.source === 'cv').length;

  // Get current page analysis
  const currentPageAnalysis = pages.find(p => p.pageNumber === currentPage);

  const mainContent = (
    <div className={isFullscreen
      ? 'fixed inset-0 z-[9999] flex flex-col bg-gray-950 text-white'
      : 'flex flex-col w-full'
    }>
      {/* Toolbar */}
      <div className={`flex items-center justify-between p-3 border-b flex-wrap gap-2 ${
        isFullscreen ? 'bg-gray-900 border-gray-700' : 'bg-muted/30'
      }`}>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Page Navigation */}
          <div className="flex items-center gap-1 bg-background rounded-md border px-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-[90px] text-center font-medium">
              {loadError ? (
                <span className="text-red-500">Error</span>
              ) : totalPages > 0 ? (
                `Page ${currentPage} / ${totalPages}`
              ) : (
                'Loading...'
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-background rounded-md border px-1">
            <Button variant="ghost" size="sm" onClick={zoomOut} className="h-8 w-8 p-0">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-[55px] text-center font-mono">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="sm" onClick={zoomIn} className="h-8 w-8 p-0">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={resetZoom} className="h-8 w-8 p-0" title="Fit to width">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Rotate */}
          <Button variant="outline" size="sm" onClick={rotate} className="h-8">
            <RotateCw className="h-4 w-4" />
          </Button>

          {/* Measurement Mode Separator */}
          <div className="h-6 w-px bg-border mx-1" />

          {/* Calibrate Scale - Per-page */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={measurementMode === 'calibrate' ? 'default' : currentCalibration ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setMeasurementMode(measurementMode === 'calibrate' ? 'none' : 'calibrate')}
                className={`h-8 ${!currentCalibration ? 'border-amber-500 text-amber-600 hover:bg-amber-50' : ''}`}
              >
                <Ruler className="h-4 w-4 mr-1" />
                {currentCalibration ? currentCalibration.scale : 'Not Scaled'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{currentCalibration ? `Page ${currentPage} scale: ${currentCalibration.scale} - Click to recalibrate` : `Page ${currentPage} needs calibration`}</p>
            </TooltipContent>
          </Tooltip>

          {/* Scale Status Badge */}
          <Badge
            variant={currentCalibration ? 'default' : 'destructive'}
            className={`text-xs ${currentCalibration ? 'bg-green-600' : 'bg-amber-500'}`}
          >
            {calibratedPageCount}/{totalPages} scaled
          </Badge>

          {/* Measure Distance */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={measurementMode === 'distance' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMeasurementMode(measurementMode === 'distance' ? 'none' : 'distance')}
                disabled={!currentCalibration}
                className="h-8"
              >
                <Move className="h-4 w-4 mr-1" />
                Distance
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{currentCalibration ? 'Drag to measure distance between two points' : 'Calibrate this page first'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Measure Area (m²) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={measurementMode === 'area' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMeasurementMode(measurementMode === 'area' ? 'none' : 'area')}
                disabled={!currentCalibration}
                className="h-8"
              >
                <PenTool className="h-4 w-4 mr-1" />
                Area m²
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{currentCalibration ? 'Drag to draw rectangle area (square meters)' : 'Calibrate this page first'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Pan/Grab Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={measurementMode === 'pan' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMeasurementMode(measurementMode === 'pan' ? 'none' : 'pan')}
                className="h-8"
              >
                <Hand className="h-4 w-4 mr-1" />
                Pan
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Drag to pan/move the document freely. Double-click to reset position.</p>
            </TooltipContent>
          </Tooltip>

          {/* Complete Area / Cancel - shown when using polygon mode (legacy) */}
          {measurementMode === 'area' && measurementPoints.length >= 3 && !isDragging && (
            <Button
              variant="default"
              size="sm"
              onClick={completeAreaMeasurement}
              className="h-8 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-1" />
              Complete
            </Button>
          )}

          {measurementMode !== 'none' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelMeasurement}
              className="h-8 text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* CV Analysis Button */}
          <Button
            variant={currentCvResult ? 'default' : 'outline'}
            size="sm"
            onClick={runCvAnalysis}
            disabled={isCvAnalyzing}
            className="h-8"
            title="Run Computer Vision analysis to detect walls, doors, and windows"
          >
            {isCvAnalyzing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Scan className="h-4 w-4 mr-1" />
            )}
            {isCvAnalyzing ? 'Analyzing...' : currentCvResult ? 'CV Done' : 'Run CV'}
          </Button>

          {/* Toggle Text Markups */}
          <Button
            variant={showTextMarkups ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowTextMarkups(!showTextMarkups)}
            className="h-8"
            title="Toggle text-based detections"
          >
            {showTextMarkups ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
            Text
          </Button>

          {/* Toggle CV Markups */}
          <Button
            variant={showCvMarkups && currentCvResult ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowCvMarkups(!showCvMarkups)}
            disabled={!currentCvResult}
            className="h-8"
            title="Toggle CV-based detections"
          >
            {showCvMarkups ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
            CV
          </Button>

          {/* Drawing Type */}
          {currentPageAnalysis && (
            <Badge variant="secondary" className="text-xs capitalize">
              {currentPageAnalysis.drawingType.replace('_', ' ')}
            </Badge>
          )}

          {/* Fullscreen Toggle */}
          <div className="h-6 w-px bg-border mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isFullscreen ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setIsFullscreen(f => !f)}
                className={`h-8 font-medium ${isFullscreen ? 'bg-blue-600 hover:bg-blue-700 text-white border-0' : 'border-blue-300 text-blue-600 hover:bg-blue-50'}`}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4 mr-1" /> : <Maximize2 className="h-4 w-4 mr-1" />}
                {isFullscreen ? 'Exit' : 'Full Screen'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isFullscreen ? 'Exit fullscreen takeoff mode' : 'Enter fullscreen for takeoff — tools float over the plan'}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* CV Analysis Progress — hidden in fullscreen (status shown in floating bar) */}
      {isCvAnalyzing && !isFullscreen && (
        <div className="px-4 py-2 border-b bg-blue-50 dark:bg-blue-950">
          <div className="flex items-center gap-3">
            <Scan className="h-4 w-4 text-blue-600 animate-pulse" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Running Computer Vision analysis...
            </span>
            <Progress value={cvProgress} className="flex-1 h-2" />
            <span className="text-xs text-muted-foreground">{cvProgress}%</span>
          </div>
        </div>
      )}

      {/* Measurement Mode Instructions — hidden in fullscreen (shown as floating chip instead) */}
      {!isFullscreen && measurementMode !== 'none' && measurementMode !== 'pan' && (
        <div className={`px-4 py-2 border-b ${
          measurementMode === 'calibrate' ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800' :
          measurementMode === 'distance' ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' :
          'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {measurementMode === 'calibrate' && (
                <>
                  <Ruler className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                    Calibration Mode:
                  </span>
                  <span className="text-sm text-amber-600 dark:text-amber-400">
                    {calibrationPoints.length === 0
                      ? 'Click the first point of a known dimension'
                      : calibrationPoints.length === 1
                      ? 'Click the second point'
                      : 'Enter the distance'}
                  </span>
                </>
              )}
              {measurementMode === 'distance' && (
                <>
                  <Move className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                    Distance Mode:
                  </span>
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    {isDragging
                      ? 'Release to complete measurement'
                      : 'Click and drag to measure distance'}
                  </span>
                </>
              )}
              {measurementMode === 'area' && (
                <>
                  <PenTool className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                    Area Mode:
                  </span>
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {isDragging
                      ? 'Release to create room area'
                      : 'Click and drag to draw rectangle area'}
                  </span>
                </>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={cancelMeasurement} className="h-6 px-2">
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* PDF Canvas Container - Full Width with pan support */}
      <div
        ref={containerRef}
        className={`relative overflow-auto ${
          isFullscreen ? 'flex-1 bg-gray-900' : 'bg-gray-200 dark:bg-gray-800'
        } ${measurementMode === 'pan' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        style={isFullscreen ? undefined : { maxHeight: '70vh' }}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
      >
        {/* ── FULLSCREEN FLOATING TOOL PALETTE ── */}
        {isFullscreen && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-gray-800/95 backdrop-blur-sm rounded-2xl p-2 shadow-2xl border border-white/10 z-30 select-none">
            {/* Pointer */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setMeasurementMode('none')}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    measurementMode === 'none' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <MousePointer2 className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>Select / View</p></TooltipContent>
            </Tooltip>

            {/* Pan */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setMeasurementMode(measurementMode === 'pan' ? 'none' : 'pan')}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    measurementMode === 'pan' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <Hand className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>Pan / Move (drag)</p></TooltipContent>
            </Tooltip>

            <div className="h-px bg-white/10 mx-1 my-0.5" />

            {/* Calibrate */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setMeasurementMode(measurementMode === 'calibrate' ? 'none' : 'calibrate')}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${
                    measurementMode === 'calibrate' ? 'bg-amber-500 text-white shadow-lg' :
                    currentCalibration ? 'text-green-400 hover:bg-gray-700' : 'text-amber-400 hover:bg-gray-700 hover:text-amber-300'
                  }`}
                >
                  <Ruler className="h-5 w-5" />
                  {!currentCalibration && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border border-gray-800" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{currentCalibration ? `Calibrated: ${currentCalibration.scale}` : 'Set scale (required first)'}</p>
              </TooltipContent>
            </Tooltip>

            {/* Distance */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => currentCalibration && setMeasurementMode(measurementMode === 'distance' ? 'none' : 'distance')}
                  disabled={!currentCalibration}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    measurementMode === 'distance' ? 'bg-blue-600 text-white shadow-lg' :
                    currentCalibration ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <Move className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>{currentCalibration ? 'Measure distance' : 'Calibrate first'}</p></TooltipContent>
            </Tooltip>

            {/* Area */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => currentCalibration && setMeasurementMode(measurementMode === 'area' ? 'none' : 'area')}
                  disabled={!currentCalibration}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    measurementMode === 'area' ? 'bg-green-600 text-white shadow-lg' :
                    currentCalibration ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <PenTool className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>{currentCalibration ? 'Measure area (m²)' : 'Calibrate first'}</p></TooltipContent>
            </Tooltip>

            <div className="h-px bg-white/10 mx-1 my-0.5" />

            {/* Zoom In */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={zoomIn} className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 hover:bg-gray-700 hover:text-white transition-all">
                  <ZoomIn className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>Zoom in</p></TooltipContent>
            </Tooltip>

            {/* Zoom Out */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={zoomOut} className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 hover:bg-gray-700 hover:text-white transition-all">
                  <ZoomOut className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>Zoom out</p></TooltipContent>
            </Tooltip>

            {/* Reset zoom */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={resetZoom} className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 hover:bg-gray-700 hover:text-white transition-all text-[10px] font-bold">
                  {Math.round(zoom * 100)}%
                </button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>Reset zoom ({Math.round(zoom * 100)}%)</p></TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* ── FULLSCREEN FLOATING STATUS BAR (bottom-center, when tool active) ── */}
        {isFullscreen && measurementMode !== 'none' && (
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-full shadow-2xl border text-sm font-medium backdrop-blur-sm ${
            measurementMode === 'calibrate' ? 'bg-amber-600/90 border-amber-400 text-white' :
            measurementMode === 'distance' ? 'bg-blue-600/90 border-blue-400 text-white' :
            measurementMode === 'area' ? 'bg-green-600/90 border-green-400 text-white' :
            'bg-gray-800/90 border-gray-600 text-gray-200'
          }`}>
            {measurementMode === 'calibrate' && <><Ruler className="h-4 w-4" />{calibrationPoints.length === 0 ? 'Click first point' : calibrationPoints.length === 1 ? 'Click second point' : 'Enter distance'}</>}
            {measurementMode === 'distance' && <><Move className="h-4 w-4" />{isDragging ? 'Release to complete' : 'Click and drag to measure'}</>}
            {measurementMode === 'area' && <><PenTool className="h-4 w-4" />{isDragging ? 'Release to complete area' : 'Click and drag to draw area'}</>}
            {measurementMode === 'pan' && <><Hand className="h-4 w-4" />Drag to pan · Double-click to reset</>}
            <button onClick={cancelMeasurement} className="ml-1 opacity-70 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── FULLSCREEN PAGE NAV (bottom-right) ── */}
        {isFullscreen && (
          <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 bg-gray-800/95 backdrop-blur-sm rounded-full px-2 py-1 shadow-xl border border-white/10">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition-all">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-gray-200 font-medium min-w-[70px] text-center">
              {currentPage} / {totalPages}
            </span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition-all">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="relative p-4 flex justify-center">
          {/* Loading state */}
          {isLoading && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 z-20">
              <div className="flex items-center gap-2 bg-background/90 px-4 py-2 rounded-lg shadow">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading PDF...</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {loadError && (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-red-600 mb-2">Failed to Load PDF</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">{loadError}</p>
              <p className="text-xs text-muted-foreground text-center">
                Please try re-uploading the PDF file or check if the file is corrupted.
              </p>
            </div>
          )}

          {/* PDF Canvas - only show when loaded successfully */}
          {!loadError && (
          <div
            className={`relative inline-block shadow-xl rounded-lg overflow-hidden bg-white ${
              measurementMode === 'pan' ? '' :
              measurementMode !== 'none' ? 'cursor-crosshair' : ''
            }`}
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
              transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            }}
            onClick={handleCanvasClick}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={() => {
              if (isDragging) {
                setIsDragging(false);
                setDragStartPoint(null);
                setDragCurrentPoint(null);
              }
            }}
          >
            <canvas ref={canvasRef} />

            {/* Measurement Overlay - always on top */}
            {canvasSize.width > 0 && showMeasurements && (
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ width: canvasSize.width, height: canvasSize.height, zIndex: 30 }}
              >
                {/* Calibration line being drawn */}
                {measurementMode === 'calibrate' && calibrationPoints.length >= 1 && (
                  <>
                    <circle
                      cx={`${calibrationPoints[0].x}%`}
                      cy={`${calibrationPoints[0].y}%`}
                      r="6"
                      fill="#f59e0b"
                      stroke="white"
                      strokeWidth="2"
                    />
                    {calibrationPoints.length === 2 && (
                      <>
                        <line
                          x1={`${calibrationPoints[0].x}%`}
                          y1={`${calibrationPoints[0].y}%`}
                          x2={`${calibrationPoints[1].x}%`}
                          y2={`${calibrationPoints[1].y}%`}
                          stroke="#f59e0b"
                          strokeWidth="3"
                          strokeDasharray="8,4"
                        />
                        <circle
                          cx={`${calibrationPoints[1].x}%`}
                          cy={`${calibrationPoints[1].y}%`}
                          r="6"
                          fill="#f59e0b"
                          stroke="white"
                          strokeWidth="2"
                        />
                      </>
                    )}
                  </>
                )}

                {/* Current calibration line for this page */}
                {currentCalibration && (
                  <line
                    x1={`${currentCalibration.point1.x}%`}
                    y1={`${currentCalibration.point1.y}%`}
                    x2={`${currentCalibration.point2.x}%`}
                    y2={`${currentCalibration.point2.y}%`}
                    stroke="#22c55e"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                    opacity="0.6"
                  />
                )}

                {/* Distance being measured - old click mode */}
                {measurementMode === 'distance' && measurementPoints.length === 1 && !isDragging && (
                  <circle
                    cx={`${measurementPoints[0].x}%`}
                    cy={`${measurementPoints[0].y}%`}
                    r="5"
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth="2"
                  />
                )}

                {/* Distance being drawn - drag mode */}
                {isDragging && measurementMode === 'distance' && dragStartPoint && dragCurrentPoint && (
                  <>
                    <line
                      x1={`${dragStartPoint.x}%`}
                      y1={`${dragStartPoint.y}%`}
                      x2={`${dragCurrentPoint.x}%`}
                      y2={`${dragCurrentPoint.y}%`}
                      stroke="#3b82f6"
                      strokeWidth="3"
                      strokeDasharray="8,4"
                    />
                    <circle
                      cx={`${dragStartPoint.x}%`}
                      cy={`${dragStartPoint.y}%`}
                      r="6"
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <circle
                      cx={`${dragCurrentPoint.x}%`}
                      cy={`${dragCurrentPoint.y}%`}
                      r="6"
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth="2"
                    />
                    {currentCalibration && (
                      <text
                        x={`${(dragStartPoint.x + dragCurrentPoint.x) / 2}%`}
                        y={`${(dragStartPoint.y + dragCurrentPoint.y) / 2 - 2}%`}
                        textAnchor="middle"
                        fill="white"
                        stroke="#3b82f6"
                        strokeWidth="3"
                        paintOrder="stroke"
                        fontSize="14"
                        fontWeight="bold"
                      >
                        {(() => {
                          const dist = calculatePixelDistance(dragStartPoint, dragCurrentPoint, canvasSize.width, canvasSize.height);
                          const realDist = pixelsToReal(dist, currentCalibration);
                          return `${realDist.toFixed(2)}m`;
                        })()}
                      </text>
                    )}
                  </>
                )}

                {/* Calibration being drawn - drag mode */}
                {isDragging && measurementMode === 'calibrate' && dragStartPoint && dragCurrentPoint && (
                  <>
                    <line
                      x1={`${dragStartPoint.x}%`}
                      y1={`${dragStartPoint.y}%`}
                      x2={`${dragCurrentPoint.x}%`}
                      y2={`${dragCurrentPoint.y}%`}
                      stroke="#f59e0b"
                      strokeWidth="3"
                      strokeDasharray="8,4"
                    />
                    <circle
                      cx={`${dragStartPoint.x}%`}
                      cy={`${dragStartPoint.y}%`}
                      r="6"
                      fill="#f59e0b"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <circle
                      cx={`${dragCurrentPoint.x}%`}
                      cy={`${dragCurrentPoint.y}%`}
                      r="6"
                      fill="#f59e0b"
                      stroke="white"
                      strokeWidth="2"
                    />
                  </>
                )}

                {/* Area polygon being drawn - old click mode */}
                {measurementMode === 'area' && measurementPoints.length > 0 && !isDragging && (
                  <>
                    <polygon
                      points={measurementPoints.map(p => `${(p.x / 100) * canvasSize.width},${(p.y / 100) * canvasSize.height}`).join(' ')}
                      fill="rgba(34, 197, 94, 0.2)"
                      stroke="#22c55e"
                      strokeWidth="2"
                      strokeDasharray="6,3"
                    />
                    {measurementPoints.map((p, i) => (
                      <circle
                        key={i}
                        cx={`${p.x}%`}
                        cy={`${p.y}%`}
                        r="5"
                        fill="#22c55e"
                        stroke="white"
                        strokeWidth="2"
                      />
                    ))}
                  </>
                )}

                {/* Area rectangle being drawn - drag mode */}
                {isDragging && measurementMode === 'area' && dragStartPoint && dragCurrentPoint && (
                  <>
                    <rect
                      x={`${Math.min(dragStartPoint.x, dragCurrentPoint.x)}%`}
                      y={`${Math.min(dragStartPoint.y, dragCurrentPoint.y)}%`}
                      width={`${Math.abs(dragCurrentPoint.x - dragStartPoint.x)}%`}
                      height={`${Math.abs(dragCurrentPoint.y - dragStartPoint.y)}%`}
                      fill="rgba(34, 197, 94, 0.2)"
                      stroke="#22c55e"
                      strokeWidth="2"
                      strokeDasharray="6,3"
                    />
                    <circle
                      cx={`${dragStartPoint.x}%`}
                      cy={`${dragStartPoint.y}%`}
                      r="5"
                      fill="#22c55e"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <circle
                      cx={`${dragCurrentPoint.x}%`}
                      cy={`${dragCurrentPoint.y}%`}
                      r="5"
                      fill="#22c55e"
                      stroke="white"
                      strokeWidth="2"
                    />
                    {currentCalibration && (
                      <text
                        x={`${(dragStartPoint.x + dragCurrentPoint.x) / 2}%`}
                        y={`${(dragStartPoint.y + dragCurrentPoint.y) / 2}%`}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        stroke="#22c55e"
                        strokeWidth="3"
                        paintOrder="stroke"
                        fontSize="16"
                        fontWeight="bold"
                      >
                        {(() => {
                          const widthPx = Math.abs(dragCurrentPoint.x - dragStartPoint.x) / 100 * canvasSize.width;
                          const heightPx = Math.abs(dragCurrentPoint.y - dragStartPoint.y) / 100 * canvasSize.height;
                          const areaPx = widthPx * heightPx;
                          const areaReal = pixelAreaToReal(areaPx, currentCalibration);
                          return `${areaReal.toFixed(2)}m²`;
                        })()}
                      </text>
                    )}
                  </>
                )}

                {/* Completed measured lines */}
                {measuredLines.filter(l => l.pageNumber === currentPage).map((line) => (
                  <g key={line.id}>
                    <line
                      x1={`${line.point1.x}%`}
                      y1={`${line.point1.y}%`}
                      x2={`${line.point2.x}%`}
                      y2={`${line.point2.y}%`}
                      stroke="#3b82f6"
                      strokeWidth="3"
                    />
                    <circle cx={`${line.point1.x}%`} cy={`${line.point1.y}%`} r="4" fill="#3b82f6" />
                    <circle cx={`${line.point2.x}%`} cy={`${line.point2.y}%`} r="4" fill="#3b82f6" />
                    <text
                      x={`${(line.point1.x + line.point2.x) / 2}%`}
                      y={`${(line.point1.y + line.point2.y) / 2 - 1}%`}
                      textAnchor="middle"
                      fill="white"
                      stroke="#3b82f6"
                      strokeWidth="3"
                      paintOrder="stroke"
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {line.lengthReal.toFixed(2)}m
                    </text>
                  </g>
                ))}

                {/* Completed measured rooms */}
                {measuredRooms.filter(r => r.pageNumber === currentPage).map((room) => {
                  const roomConfig = ROOM_TYPES[room.roomType];
                  const color = roomConfig.color;
                  return (
                    <g key={room.id}>
                      <polygon
                        points={room.points.map(p => `${(p.x / 100) * canvasSize.width},${(p.y / 100) * canvasSize.height}`).join(' ')}
                        fill={`${color}40`}
                        stroke={color}
                        strokeWidth="2"
                      />
                      {room.points.map((p, i) => (
                        <circle key={i} cx={`${p.x}%`} cy={`${p.y}%`} r="4" fill={color} />
                      ))}
                      {/* Room label background */}
                      <rect
                        x={`${room.points.reduce((sum, p) => sum + p.x, 0) / room.points.length - 8}%`}
                        y={`${room.points.reduce((sum, p) => sum + p.y, 0) / room.points.length - 3}%`}
                        width="16%"
                        height="6%"
                        fill={`${color}cc`}
                        rx="4"
                      />
                      {/* Room name */}
                      <text
                        x={`${room.points.reduce((sum, p) => sum + p.x, 0) / room.points.length}%`}
                        y={`${room.points.reduce((sum, p) => sum + p.y, 0) / room.points.length - 0.5}%`}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="12"
                        fontWeight="bold"
                      >
                        {room.roomLabel}
                      </text>
                      {/* Area measurement */}
                      <text
                        x={`${room.points.reduce((sum, p) => sum + p.x, 0) / room.points.length}%`}
                        y={`${room.points.reduce((sum, p) => sum + p.y, 0) / room.points.length + 2}%`}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="14"
                        fontWeight="bold"
                      >
                        {room.areaReal.toFixed(2)}m²
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Markup Overlay - positioned over canvas */}
            {(showTextMarkups || showCvMarkups) && canvasSize.width > 0 && (
              <div
                className="absolute top-0 left-0 pointer-events-none"
                style={{
                  width: canvasSize.width,
                  height: canvasSize.height,
                }}
              >
                {/* SVG layer for line-based markups (walls) */}
                <svg
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  style={{ width: canvasSize.width, height: canvasSize.height }}
                >
                  {currentPageMarkups
                    .filter(m => m.source === 'cv' && m.line)
                    .map((markup) => (
                      <line
                        key={markup.id}
                        x1={`${markup.line!.x1}%`}
                        y1={`${markup.line!.y1}%`}
                        x2={`${markup.line!.x2}%`}
                        y2={`${markup.line!.y2}%`}
                        stroke={markup.color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        opacity="0.7"
                      />
                    ))}
                </svg>

                {/* Div-based markups for boxes */}
                {currentPageMarkups
                  .filter(m => !(m.source === 'cv' && m.line))
                  .map((markup) => {
                    const isHighlighted = markup.linkedEstimateId === highlightedItemId;
                    const config = ELEMENT_COLORS[markup.type] || ELEMENT_COLORS.symbol;
                    const isCv = markup.source === 'cv';

                    return (
                      <Tooltip key={markup.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`
                              absolute pointer-events-auto cursor-pointer transition-all duration-200
                              hover:scale-105 hover:z-20
                              ${isHighlighted ? 'ring-4 ring-yellow-400 z-10 scale-110' : ''}
                              ${isCv ? 'border-dashed' : ''}
                            `}
                            style={{
                              left: `${markup.x}%`,
                              top: `${markup.y}%`,
                              width: `${Math.max(markup.width, 1)}%`,
                              height: `${Math.max(markup.height, 1)}%`,
                              backgroundColor: `${markup.color}${isCv ? '25' : '40'}`,
                              border: `${isCv ? '2px dashed' : '2px solid'} ${markup.color}`,
                              borderRadius: isCv ? '2px' : '4px',
                              boxShadow: `0 2px 4px ${markup.color}30`,
                            }}
                            onClick={() => onMarkupClick?.(markup)}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-2">
                              {config.icon}
                              <span className="font-semibold">{markup.label}</span>
                              <Badge variant={isCv ? 'secondary' : 'outline'} className="text-[9px] h-4">
                                {isCv ? 'CV' : 'Text'}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground">
                              Type: {config.label}
                            </p>
                            <p className="text-muted-foreground">
                              Confidence: {Math.round(markup.confidence * 100)}%
                            </p>
                            {isCv && (
                              <p className="text-blue-600 text-[10px]">
                                Detected via Computer Vision
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Adaptive Legend - hidden in fullscreen */}
      {!isFullscreen && (showTextMarkups || showCvMarkups) && (
        <div className="p-3 border-t bg-muted/30">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Detected Elements</span>
              <Badge variant="outline" className="text-xs">
                {currentPageMarkups.length} total
              </Badge>
              {textMarkupCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {textMarkupCount} text
                </Badge>
              )}
              {cvMarkupCount > 0 && (
                <Badge className="text-xs bg-blue-600">
                  {cvMarkupCount} CV
                </Badge>
              )}
            </div>
            {currentPageMarkups.length === 0 && !currentCvResult && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3" />
                <span>Click "Run CV" to detect walls, doors, windows</span>
              </div>
            )}
          </div>

          {/* CV Analysis Results Summary */}
          {currentCvResult && (
            <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Scan className="h-3 w-3 text-blue-600" />
                  <span className="font-medium text-blue-700 dark:text-blue-300">CV Analysis</span>
                </div>
                <span className="text-muted-foreground">
                  {currentCvResult.processingTimeMs.toFixed(0)}ms
                </span>
              </div>
              <div className="flex gap-4 mt-1 text-xs">
                <span><strong>{currentCvResult.walls.length}</strong> walls</span>
                <span><strong>{currentCvResult.doors.length}</strong> doors</span>
                <span><strong>{currentCvResult.windows.length}</strong> windows</span>
                <span><strong>{currentCvResult.fixtures.length}</strong> fixtures</span>
              </div>
            </div>
          )}

          {/* Enhanced Extraction Summary */}
          {analysisResult && (
            <div className="mb-3 rounded-lg border bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800">
              <button
                onClick={() => setShowExtractionSummary(!showExtractionSummary)}
                className="w-full flex items-center justify-between p-2 text-left"
              >
                <div className="flex items-center gap-2 text-xs">
                  <FileText className="h-3 w-3 text-emerald-600" />
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">
                    PDF Extraction Summary
                  </span>
                  {analysisResult.standardsReferences?.length > 0 && (
                    <Badge variant="outline" className="text-[9px] h-4 bg-white/50">
                      {analysisResult.standardsReferences.length} AS refs
                    </Badge>
                  )}
                  {analysisResult.materialSelections?.length > 0 && (
                    <Badge variant="outline" className="text-[9px] h-4 bg-white/50">
                      {analysisResult.materialSelections.length} materials
                    </Badge>
                  )}
                  {analysisResult.summary.floorAreas && analysisResult.summary.floorAreas.length > 0 && (
                    <Badge variant="outline" className="text-[9px] h-4 bg-white/50">
                      {analysisResult.summary.floorAreas.length} areas
                    </Badge>
                  )}
                </div>
                {showExtractionSummary ? (
                  <ChevronUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-emerald-600" />
                )}
              </button>

              {showExtractionSummary && (
                <div className="px-2 pb-2 space-y-2">
                  {/* Floor Areas */}
                  {analysisResult.summary.floorAreas && analysisResult.summary.floorAreas.length > 0 && (
                    <div className="bg-white/50 dark:bg-white/5 rounded p-2">
                      <div className="flex items-center gap-1 mb-1 text-[10px] text-muted-foreground uppercase font-medium">
                        <Building className="h-3 w-3" />
                        Floor Areas
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {analysisResult.summary.floorAreas.slice(0, 6).map((area, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span className="text-muted-foreground truncate">{area.name}</span>
                            <span className="font-medium">{area.area.toFixed(2)}m²</span>
                          </div>
                        ))}
                      </div>
                      {analysisResult.summary.totalFloorArea && (
                        <div className="mt-1 pt-1 border-t flex justify-between text-xs font-medium">
                          <span>Total Floor Area</span>
                          <span className="text-emerald-600">{analysisResult.summary.totalFloorArea.toFixed(2)}m²</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Australian Standards */}
                  {analysisResult.standardsReferences && analysisResult.standardsReferences.length > 0 && (
                    <div className="bg-white/50 dark:bg-white/5 rounded p-2">
                      <div className="flex items-center gap-1 mb-1 text-[10px] text-muted-foreground uppercase font-medium">
                        <ClipboardList className="h-3 w-3" />
                        Australian Standards Referenced
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {analysisResult.standardsReferences.map((std, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-[10px] h-5"
                            title={std.description}
                          >
                            {std.code}
                            {std.description && (
                              <span className="ml-1 text-muted-foreground">({std.description})</span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Material Selections */}
                  {analysisResult.materialSelections && analysisResult.materialSelections.length > 0 && (
                    <div className="bg-white/50 dark:bg-white/5 rounded p-2">
                      <div className="flex items-center gap-1 mb-1 text-[10px] text-muted-foreground uppercase font-medium">
                        <Palette className="h-3 w-3" />
                        Material Selections
                      </div>
                      <div className="space-y-1 text-xs">
                        {analysisResult.materialSelections.slice(0, 8).map((mat, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span className="text-muted-foreground">{mat.category}</span>
                            <span className="font-medium truncate max-w-[60%] text-right">
                              {mat.selection}
                              {mat.colour && (
                                <span className="text-muted-foreground ml-1">({mat.colour})</span>
                              )}
                            </span>
                          </div>
                        ))}
                        {analysisResult.materialSelections.length > 8 && (
                          <div className="text-[10px] text-muted-foreground text-center pt-1">
                            +{analysisResult.materialSelections.length - 8} more materials
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Electrical Summary */}
                  {analysisResult.electricalSummary && Object.keys(analysisResult.electricalSummary).length > 0 && (
                    <div className="bg-white/50 dark:bg-white/5 rounded p-2">
                      <div className="flex items-center gap-1 mb-1 text-[10px] text-muted-foreground uppercase font-medium">
                        <Zap className="h-3 w-3" />
                        Electrical Symbols Detected
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {Object.entries(analysisResult.electricalSummary).map(([key, count]) => (
                          <div key={key} className="flex items-center gap-1">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Schedules Summary */}
                  {(analysisResult.schedules.windows.length > 0 || analysisResult.schedules.doors.length > 0) && (
                    <div className="bg-white/50 dark:bg-white/5 rounded p-2">
                      <div className="flex items-center gap-1 mb-1 text-[10px] text-muted-foreground uppercase font-medium">
                        <ClipboardList className="h-3 w-3" />
                        Schedules Extracted
                      </div>
                      <div className="flex gap-4 text-xs">
                        {analysisResult.schedules.windows.length > 0 && (
                          <span><strong>{analysisResult.schedules.windows.length}</strong> window types</span>
                        )}
                        {analysisResult.schedules.doors.length > 0 && (
                          <span><strong>{analysisResult.schedules.doors.length}</strong> door types</span>
                        )}
                        {analysisResult.schedules.finishes.length > 0 && (
                          <span><strong>{analysisResult.schedules.finishes.length}</strong> finishes</span>
                        )}
                        {analysisResult.schedules.appliances.length > 0 && (
                          <span><strong>{analysisResult.schedules.appliances.length}</strong> appliances</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {detectedTypes.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {detectedTypes.map((type) => {
                const config = ELEMENT_COLORS[type] || ELEMENT_COLORS.symbol;
                const textCount = currentPageMarkups.filter(m => m.type === type && m.source === 'text').length;
                const cvCount = currentPageMarkups.filter(m => m.type === type && m.source === 'cv').length;

                return (
                  <div
                    key={type}
                    className="flex items-center gap-2 px-2 py-1 bg-background rounded border text-xs"
                  >
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${config.color}30`, border: `2px solid ${config.color}` }}
                    >
                      <span style={{ color: config.color }}>{config.icon}</span>
                    </div>
                    <span className="font-medium">{config.label}</span>
                    {textCount > 0 && (
                      <Badge variant="outline" className="h-5 text-[10px]">
                        {textCount}
                      </Badge>
                    )}
                    {cvCount > 0 && (
                      <Badge className="h-5 text-[10px] bg-blue-600">
                        {cvCount}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Click "Run CV" to detect visual elements (walls, doors, windows) using Computer Vision.
              Text labels (D01, W02, GPO) are detected automatically from PDF text.
            </p>
          )}
        </div>
      )}

      {/* Page Thumbnails - Only if multiple pages, hidden in fullscreen */}
      {totalPages > 1 && !isFullscreen && (
        <div className="border-t p-3 bg-background">
          <ScrollArea className="w-full">
            <div className="flex gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const pageInfo = pages.find(p => p.pageNumber === pageNum);
                const pageMarkupCount = markups.filter(m => m.pageNumber === pageNum).length;
                const pageCalibration = calibrations[pageNum];
                const isCalibrated = !!pageCalibration;

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`
                      relative flex-shrink-0 w-20 h-24 rounded-lg border-2 transition-all overflow-hidden
                      ${currentPage === pageNum
                        ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                        : isCalibrated
                        ? 'border-green-500 hover:border-green-600 bg-green-50 dark:bg-green-950/30'
                        : 'border-amber-400 hover:border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                      }
                    `}
                  >
                    {/* Calibration Status Icon */}
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center ${
                      isCalibrated ? 'bg-green-500' : 'bg-amber-500'
                    }`}>
                      {isCalibrated ? (
                        <Check className="h-3 w-3 text-white" />
                      ) : (
                        <Ruler className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-muted-foreground/50">{pageNum}</span>
                    </div>
                    {pageMarkupCount > 0 && (
                      <Badge
                        className="absolute top-1 right-1 h-5 px-1.5 text-[10px]"
                      >
                        {pageMarkupCount}
                      </Badge>
                    )}
                    {/* Scale indicator at bottom */}
                    <div className={`absolute bottom-0 left-0 right-0 text-white text-[9px] text-center py-0.5 truncate px-1 ${
                      isCalibrated ? 'bg-green-600' : 'bg-amber-500'
                    }`}>
                      {isCalibrated && pageCalibration
                        ? pageCalibration.scale
                        : 'Not Scaled'
                      }
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Measurements Panel - Shows completed measurements, hidden in fullscreen */}
      {!isFullscreen && (measuredLines.length > 0 || measuredRooms.length > 0) && (
        <div className="border-t p-3 bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Measurements & Rooms</span>
              {currentCalibration && (
                <Badge variant="secondary" className="text-xs">
                  Scale: {currentCalibration.scale}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMeasurements(!showMeasurements)}
                className="h-6 px-2"
              >
                {showMeasurements ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMeasurements}
                className="h-6 px-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {/* Distance measurements */}
            {measuredLines.filter(l => l.pageNumber === currentPage).map((line) => (
              <div
                key={line.id}
                className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800"
              >
                <div className="flex items-center gap-2">
                  <Move className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">{line.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                    {line.lengthReal.toFixed(2)} m
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMeasurement('line', line.id)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Room measurements */}
            {measuredRooms.filter(r => r.pageNumber === currentPage).map((room) => {
              const roomConfig = ROOM_TYPES[room.roomType];
              return (
                <div
                  key={room.id}
                  className="flex items-center justify-between p-2 rounded-lg border"
                  style={{
                    backgroundColor: `${roomConfig.color}15`,
                    borderColor: `${roomConfig.color}40`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: roomConfig.color }}
                    />
                    <span className="text-sm font-medium">{room.roomLabel}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {roomConfig.label}
                    </Badge>
                    {roomConfig.hasWetArea && (
                      <Badge variant="secondary" className="text-[10px]">
                        <Droplets className="h-2 w-2 mr-1" />
                        Wet
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-sm font-bold" style={{ color: roomConfig.color }}>
                        {room.areaReal.toFixed(2)} m²
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({room.perimeter.toFixed(1)}m)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMeasurement('room', room.id)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          {measuredRooms.filter(r => r.pageNumber === currentPage).length > 0 && (
            <div className="mt-2 pt-2 border-t flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {measuredRooms.filter(r => r.pageNumber === currentPage).length} rooms on this page
              </span>
              <span className="text-sm font-bold">
                Total: {measuredRooms.filter(r => r.pageNumber === currentPage).reduce((sum, r) => sum + r.areaReal, 0).toFixed(2)} m²
              </span>
            </div>
          )}
        </div>
      )}

      {/* Calibration Dialog */}
      <Dialog open={showCalibrationDialog} onOpenChange={setShowCalibrationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5 text-amber-600" />
              Set Scale Calibration
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              You've selected two points. Enter the real-world distance between them to calibrate the scale.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="distance">Distance</Label>
                <Input
                  id="distance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 5.5"
                  value={calibrationDistance}
                  onChange={(e) => setCalibrationDistance(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={calibrationUnit}
                  onValueChange={(v) => setCalibrationUnit(v as 'mm' | 'm' | 'ft' | 'in')}
                >
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m">Meters (m)</SelectItem>
                    <SelectItem value="mm">Millimeters (mm)</SelectItem>
                    <SelectItem value="ft">Feet (ft)</SelectItem>
                    <SelectItem value="in">Inches (in)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              <strong>Tip:</strong> For best accuracy, select a known dimension like a door width (typically 820mm or 920mm)
              or a dimension marked on the plan.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCalibrationDialog(false);
              setCalibrationPoints([]);
            }}>
              Cancel
            </Button>
            <Button onClick={applyCalibration} disabled={!calibrationDistance}>
              <Check className="h-4 w-4 mr-1" />
              Apply Scale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room Assignment Dialog */}
      <Dialog open={showRoomAssignmentDialog} onOpenChange={setShowRoomAssignmentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-green-600" />
              Assign Room Type
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              You've drawn an area of <strong>{pendingAreaPoints.length >= 3 && currentCalibration
                ? createMeasuredArea('temp', currentPage, pendingAreaPoints, currentCalibration, canvasSize.width, canvasSize.height).areaReal.toFixed(2)
                : '0'} m²</strong>.
              Select the room type to auto-generate estimate line items.
            </p>

            {/* Room Type Grid */}
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(ROOM_TYPES) as [RoomType, typeof ROOM_TYPES[RoomType]][]).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => setSelectedRoomType(type)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    selectedRoomType === type
                      ? 'ring-2 ring-offset-2'
                      : 'hover:border-gray-400'
                  }`}
                  style={{
                    borderColor: selectedRoomType === type ? config.color : undefined,
                    backgroundColor: selectedRoomType === type ? `${config.color}15` : undefined,
                    ['--tw-ring-color' as string]: config.color,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-sm font-medium">{config.label}</span>
                  </div>
                  {config.hasWetArea && (
                    <Badge variant="secondary" className="text-[9px] h-4">
                      <Droplets className="h-2 w-2 mr-1" />
                      Wet Area
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            {/* Custom Label */}
            <div className="space-y-2">
              <Label htmlFor="roomLabel">Room Name (optional)</Label>
              <Input
                id="roomLabel"
                placeholder={`e.g., ${ROOM_TYPES[selectedRoomType].label} 1`}
                value={customRoomLabel}
                onChange={(e) => setCustomRoomLabel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-number (e.g., "Living Room 1", "Living Room 2")
              </p>
            </div>

            {/* Items that will be generated */}
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                Line items to be generated:
              </p>
              <div className="flex flex-wrap gap-1">
                {ROOM_TYPES[selectedRoomType].defaultItems.slice(0, 8).map((item) => (
                  <Badge key={item} variant="outline" className="text-[10px]">
                    {item}
                  </Badge>
                ))}
                {ROOM_TYPES[selectedRoomType].defaultItems.length > 8 && (
                  <Badge variant="secondary" className="text-[10px]">
                    +{ROOM_TYPES[selectedRoomType].defaultItems.length - 8} more
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRoomAssignmentDialog(false);
              setPendingAreaPoints([]);
            }}>
              Cancel
            </Button>
            <Button onClick={applyRoomAssignment} style={{ backgroundColor: ROOM_TYPES[selectedRoomType].color }}>
              <Check className="h-4 w-4 mr-1" />
              Create Room & Generate Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
  return isFullscreen ? createPortal(mainContent, document.body) : mainContent;
}

export default PDFAnalysisViewer;
