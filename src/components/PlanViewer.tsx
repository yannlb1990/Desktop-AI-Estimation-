import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Line, Textbox, FabricImage, Polygon, Rect, Circle } from "fabric";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MeasurementsTable } from "./MeasurementsTable";
import { Ruler, ZoomIn, ZoomOut, Trash2, Square, Minus, Scan, Loader2, PenTool, FileText, Box, Hash, Undo2, Redo2, Edit2, Magnet, Link, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from "pdfjs-dist";
import { MeasurementsSidebar } from "./MeasurementsSidebar";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

type ToolType = "plan" | "calibrate" | "measure-lm" | "measure-m2" | "measure-m3" | "measure-ea" | "detect" | "extract";

interface PlanViewerProps {
  planUrl: string;
  projectId?: string;
  planPageId?: string;
  wizardMode?: boolean;
  currentTool?: ToolType;
}

export const PlanViewer = ({ planUrl, projectId, planPageId: propPlanPageId, wizardMode = false, currentTool: initialTool }: PlanViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [scale, setScale] = useState(1);
  const [tool, setTool] = useState<ToolType>(initialTool || "plan");
  const [scaleFactor, setScaleFactor] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastPosX, setLastPosX] = useState(0);
  const [lastPosY, setLastPosY] = useState(0);
  const [calibratePoints, setCalibratePoints] = useState<{ x: number; y: number }[]>([]);
  const [showCalibrationDialog, setShowCalibrationDialog] = useState(false);
  const [calibrationDistance, setCalibrationDistance] = useState("");
  const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[]>([]);
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [planPageId, setPlanPageId] = useState<string | null>(propPlanPageId || null);
  const [isPlanReady, setIsPlanReady] = useState(false);
  const [isDetectingSymbols, setIsDetectingSymbols] = useState(false);
  const [detectedSymbols, setDetectedSymbols] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [showThicknessDialog, setShowThicknessDialog] = useState(false);
  const [slabThickness, setSlabThickness] = useState("");
  const [pendingVolumeArea, setPendingVolumeArea] = useState<number | null>(null);
  const [pendingVolumePoints, setPendingVolumePoints] = useState<{x: number, y: number}[]>([]);
  const [pendingMeasurement, setPendingMeasurement] = useState<{
    type: 'linear' | 'area' | 'volume' | 'ea';
    points: { x: number; y: number }[];
    value: number;
    area?: number;
    thickness?: number;
  } | null>(null);
  const [measurementLabel, setMeasurementLabel] = useState("");
  const [measurementCategory, setMeasurementCategory] = useState("");
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // Undo/Redo state
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Edit measurement state
  const [editingMeasurement, setEditingMeasurement] = useState<any | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // Grid snapping state
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapGridSize] = useState(10);
  
  // Refs for performance optimization (prevent stale closures)
  const toolRef = useRef(tool);
  const measureStartRef = useRef(measureStart);
  const isDraggingRef = useRef(isDragging);
  const lastPosXRef = useRef(lastPosX);
  const lastPosYRef = useRef(lastPosY);
  const calibratePointsRef = useRef(calibratePoints);
  const polygonPointsRef = useRef(polygonPoints);
  const scaleFactorRef = useRef(scaleFactor);
  const snapEnabledRef = useRef(snapEnabled);
  const snapGridSizeRef = useRef(snapGridSize);
  const snapIndicatorRef = useRef<Circle | null>(null);
  const planPageIdRef = useRef<string | null>(planPageId);
  
  // Update refs when state changes
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { measureStartRef.current = measureStart; }, [measureStart]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { lastPosXRef.current = lastPosX; }, [lastPosX]);
  useEffect(() => { lastPosYRef.current = lastPosY; }, [lastPosY]);
  useEffect(() => { calibratePointsRef.current = calibratePoints; }, [calibratePoints]);
  useEffect(() => { polygonPointsRef.current = polygonPoints; }, [polygonPoints]);
  useEffect(() => { scaleFactorRef.current = scaleFactor; }, [scaleFactor]);
  useEffect(() => { snapEnabledRef.current = snapEnabled; }, [snapEnabled]);
  useEffect(() => { snapGridSizeRef.current = snapGridSize; }, [snapGridSize]);
  useEffect(() => { planPageIdRef.current = planPageId; }, [planPageId]);

  // Update tool when initialTool changes (wizard mode)
  useEffect(() => {
    if (initialTool) {
      setTool(initialTool);
    }
  }, [initialTool]);

  // Sync planPageId when prop changes
  useEffect(() => {
    if (propPlanPageId) {
      setPlanPageId(propPlanPageId);
    }
  }, [propPlanPageId]);

  // Load measurements and scale when planPageId changes
  useEffect(() => {
    if (planPageId) {
      loadMeasurements();
      loadScaleFactor();
    }
  }, [planPageId]);

  // Render symbol overlays when detectedSymbols changes
  useEffect(() => {
    if (fabricCanvas && detectedSymbols.length > 0) {
      renderSymbolOverlays();
    }
  }, [detectedSymbols, fabricCanvas]);

  // Validate propPlanPageId immediately and set isPlanReady early
  useEffect(() => {
    if (propPlanPageId) {
      console.log('[SCALE DEBUG] propPlanPageId provided:', propPlanPageId, '- validating...');
      supabase
        .from('plan_pages')
        .select('id, scale_factor')
        .eq('id', propPlanPageId)
        .single()
        .then(({ data, error }) => {
          if (data && !error) {
            console.log('[SCALE DEBUG] Plan page validated, setting isPlanReady=true');
            setPlanPageId(data.id);
            planPageIdRef.current = data.id;
            if (data.scale_factor) {
              console.log('[SCALE DEBUG] Loading existing scale factor:', data.scale_factor);
              setScaleFactor(data.scale_factor);
              scaleFactorRef.current = data.scale_factor;
            }
            setIsPlanReady(true);  // SET THIS EARLY!
          } else {
            console.error('[SCALE DEBUG] Failed to validate plan page:', error);
          }
        });
    }
  }, [propPlanPageId]);

  // Ensure refs are synced when isPlanReady changes
  useEffect(() => {
    if (isPlanReady && planPageId) {
      planPageIdRef.current = planPageId;
    }
  }, [isPlanReady, planPageId]);

  // Clean up in-progress operations when tool changes
  useEffect(() => {
    if (!fabricCanvas) return;
    
    // Clear calibration objects when switching away from calibrate tool
    if (tool !== "calibrate" && calibratePointsRef.current.length > 0) {
      clearCalibrationObjects();
      setCalibratePoints([]);
    }
    
    // Clear line measurement start point when switching away
    if (tool !== "measure-lm" && measureStartRef.current) {
      setMeasureStart(null);
    }
    
    // Clear polygon points when switching away from area/volume tools
    if (tool !== "measure-m2" && tool !== "measure-m3" && polygonPointsRef.current.length > 0) {
      setPolygonPoints([]);
    }
    
    // Clean up snap indicator
    if (snapIndicatorRef.current) {
      fabricCanvas.remove(snapIndicatorRef.current);
      snapIndicatorRef.current = null;
      fabricCanvas.renderAll();
    }
  }, [tool, fabricCanvas]);

  const loadMeasurements = async () => {
    if (!planPageId) return;
    
    try {
      const { data, error } = await supabase
        .from('plan_measurements')
        .select('*')
        .eq('plan_page_id', planPageId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMeasurements(data || []);
      
      // Redraw measurements on canvas after loading
      if (fabricCanvas && data) {
        redrawMeasurementsOnCanvas(data);
      }
    } catch (error) {
      console.error('Error loading measurements:', error);
    }
  };

  const loadScaleFactor = async () => {
    if (!planPageId) return;
    
    try {
      const { data, error } = await supabase
        .from('plan_pages')
        .select('scale_factor')
        .eq('id', planPageId)
        .single();

      if (error) throw error;
      if (data?.scale_factor) {
        setScaleFactor(data.scale_factor);
      }
    } catch (error) {
      console.error('Error loading scale factor:', error);
    }
  };

  // Initialize canvas and load plan (PDF or image)
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 1000,
      height: 700,
      backgroundColor: "#f5f5f5",
    });

    setFabricCanvas(canvas);

    const loadPlan = async () => {
      setIsLoading(true);
      try {
        const isPDF = planUrl.toLowerCase().endsWith('.pdf');

        if (isPDF) {
          // Load PDF using PDF.js
          const loadingTask = pdfjsLib.getDocument(planUrl);
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);

          const viewport = page.getViewport({ scale: 1.5 });
          const tempCanvas = document.createElement('canvas');
          const context = tempCanvas.getContext('2d')!;
          tempCanvas.height = viewport.height;
          tempCanvas.width = viewport.width;

          await page.render({ 
            canvasContext: context, 
            viewport,
            intent: 'display'
          } as any).promise;

          const img = await FabricImage.fromURL(tempCanvas.toDataURL());
          const canvasWidth = 1000;
          const canvasHeight = 700;
          const imgScale = Math.min(canvasWidth / (img.width || 1), canvasHeight / (img.height || 1));
          
          img.set({
            left: 0,
            top: 0,
            selectable: false,
          });
          img.scale(imgScale);

          canvas.add(img);
          canvas.renderAll();
          createPlanPage(canvasWidth, canvasHeight);
        } else {
          // Load regular image
          const fabricImg = await FabricImage.fromURL(planUrl, {
            crossOrigin: 'anonymous'
          });
          
          fabricImg.set({
            left: 0,
            top: 0,
            selectable: false,
          });

          const canvasWidth = 1000;
          const canvasHeight = 700;
          const imgScale = Math.min(canvasWidth / (fabricImg.width || 1), canvasHeight / (fabricImg.height || 1));
          fabricImg.scale(imgScale);

          canvas.add(fabricImg);
          canvas.renderAll();
          createPlanPage(canvasWidth, canvasHeight);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error loading plan:", error);
        toast.error("Failed to load plan file");
        setIsLoading(false);
      }
    };

    loadPlan();

    return () => {
      canvas.dispose();
    };
  }, [planUrl]);

  // Create plan page in database (prevent duplicates)
  const createPlanPage = async (width: number, height: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id || !projectId) {
      console.error('[SCALE DEBUG] Cannot create plan page: missing user or project');
      return;
    }

    // If we have a propPlanPageId, UPDATE its canvas dimensions
    if (propPlanPageId) {
      console.log('[SCALE DEBUG] Updating existing plan_page with canvas dimensions:', {
        planPageId: propPlanPageId,
        width,
        height
      });
      const { error } = await supabase
        .from('plan_pages')
        .update({
          canvas_width: width,
          canvas_height: height,
          status: 'ready'
        })
        .eq('id', propPlanPageId);

      if (error) {
        console.error('[SCALE DEBUG] Error updating plan page:', error);
      } else {
        console.log('[SCALE DEBUG] Successfully updated plan page with canvas dimensions');
      }
      return;  // Don't create a new record
    }

    console.log('[SCALE DEBUG] Checking for existing plan_pages for URL:', planUrl);
    
    // Check for existing plan page first
    const { data: existing } = await supabase
      .from('plan_pages')
      .select('*')
      .eq('project_id', projectId)
      .eq('file_url', planUrl)
      .maybeSingle();
    
    if (existing) {
      console.log('[SCALE DEBUG] Found existing plan_page:', existing.id, 'scale_factor:', existing.scale_factor);
      setPlanPageId(existing.id);
      if (existing.scale_factor) {
        setScaleFactor(existing.scale_factor);
        console.log('[SCALE DEBUG] Loaded existing scale factor:', existing.scale_factor);
      }
      setIsPlanReady(true);
      return;
    }

    console.log('[SCALE DEBUG] Creating new plan_page');
    const { data, error } = await supabase
      .from('plan_pages')
      .insert({
        project_id: projectId,
        user_id: user.id,
        file_url: planUrl,
        canvas_width: width,
        canvas_height: height,
        status: 'ready'
      })
      .select()
      .single();

    if (error) {
      console.error('[SCALE DEBUG] Error creating plan page:', error);
    } else {
      console.log('[SCALE DEBUG] Created new plan_page:', data.id);
      setPlanPageId(data.id);
      setIsPlanReady(true);
    }
  };

  // Snap to grid function (uses refs to prevent stale closures)
  const snapToGrid = (point: { x: number; y: number }) => {
    if (!snapEnabledRef.current) return point;
    const gridSize = snapGridSizeRef.current;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize
    };
  };

  // Clear calibration objects from canvas using custom properties
  const clearCalibrationObjects = () => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj) => {
      if ((obj as any).__measurementType === 'calibration') {
        fabricCanvas.remove(obj);
      }
    });
    fabricCanvas.renderAll();
    console.log('[SCALE DEBUG] Cleared calibration objects');
  };
  
  
  const getCursorStyle = () => {
    switch (tool) {
      case "calibrate":
      case "measure-lm":
      case "measure-m2":
      case "measure-m3":
      case "measure-ea":
        return "crosshair";
      case "plan":
        return "grab";
      default:
        return "default";
    }
  };

  // Handle mouse interactions based on tool (OPTIMIZED with refs)
  useEffect(() => {
    if (!fabricCanvas) return;

    let rafId: number | null = null;
    let previewLine: Line | null = null;
    let snapIndicator: Circle | null = null;

    const handleMouseDown = (e: any) => {
      // Get accurate canvas coordinates accounting for zoom/pan
      const pointer = fabricCanvas.getPointer(e.e, true);
      if (!pointer) return;
      
      // Apply grid snapping
      const snappedPointer = snapToGrid(pointer);
      const currentTool = toolRef.current;

      if (currentTool === "plan") {
        setIsDragging(true);
        setLastPosX(e.e.clientX);
        setLastPosY(e.e.clientY);
      } else if (currentTool === "calibrate") {
        handleCalibrateClick(snappedPointer);
      } else if (currentTool === "measure-lm") {
        handleLineClick(snappedPointer);
      } else if (currentTool === "measure-m2") {
        handlePolygonClick(snappedPointer, "area");
      } else if (currentTool === "measure-m3") {
        handlePolygonClick(snappedPointer, "volume");
      } else if (currentTool === "measure-ea") {
        handleEAClick(snappedPointer);
      }
    };

    const handleMouseMove = (e: any) => {
      if (rafId) return; // Throttle with RAF
      
      rafId = requestAnimationFrame(() => {
        const pointer = fabricCanvas.getPointer(e.e, true);
        if (!pointer) return;
        
        const snappedPointer = snapToGrid(pointer);
        const currentTool = toolRef.current;
        const currentIsDragging = isDraggingRef.current;
        
        // Show snap indicator
        if (snapEnabledRef.current && (currentTool !== "plan" || !currentIsDragging)) {
          if (snapIndicatorRef.current) {
            fabricCanvas.remove(snapIndicatorRef.current);
          }
          snapIndicatorRef.current = new Circle({
            radius: 2,
            fill: "#FF6B6B",
            left: snappedPointer.x,
            top: snappedPointer.y,
            originX: "center",
            originY: "center",
            selectable: false,
            opacity: 0.6,
          });
          fabricCanvas.add(snapIndicatorRef.current);
        }
        
        // Pan handling with movementX/Y
        if (currentTool === "plan" && currentIsDragging) {
          const vpt = fabricCanvas.viewportTransform!;
          vpt[4] += e.e.movementX;
          vpt[5] += e.e.movementY;
          fabricCanvas.requestRenderAll();
        }
        
        // Preview line for LM measurement
        if (currentTool === "measure-lm" && measureStartRef.current) {
          if (previewLine) fabricCanvas.remove(previewLine);
          const start = measureStartRef.current;
          previewLine = new Line([start.x, start.y, snappedPointer.x, snappedPointer.y], {
            stroke: "#FF6B6B",
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            selectable: false,
            opacity: 0.6,
          });
          fabricCanvas.add(previewLine);
        }
        
        // Preview polygon edge
        if ((currentTool === "measure-m2" || currentTool === "measure-m3") && polygonPointsRef.current.length > 0) {
          if (previewLine) fabricCanvas.remove(previewLine);
          const lastPoint = polygonPointsRef.current[polygonPointsRef.current.length - 1];
          const edgeColor = currentTool === "measure-m3" ? "#2196F3" : "#4CAF50";
          previewLine = new Line([lastPoint.x, lastPoint.y, snappedPointer.x, snappedPointer.y], {
            stroke: edgeColor,
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            selectable: false,
            opacity: 0.6,
          });
          fabricCanvas.add(previewLine);
        }
        
        fabricCanvas.requestRenderAll();
        rafId = null;
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      
      // Clean up preview objects
      if (previewLine) {
        fabricCanvas.remove(previewLine);
        previewLine = null;
      }
      if (snapIndicatorRef.current) {
        fabricCanvas.remove(snapIndicatorRef.current);
        snapIndicatorRef.current = null;
      }
      fabricCanvas.requestRenderAll();
    };

    fabricCanvas.on("mouse:down", handleMouseDown);
    fabricCanvas.on("mouse:move", handleMouseMove);
    fabricCanvas.on("mouse:up", handleMouseUp);

    return () => {
      fabricCanvas.off("mouse:down", handleMouseDown);
      fabricCanvas.off("mouse:move", handleMouseMove);
      fabricCanvas.off("mouse:up", handleMouseUp);
      if (rafId) cancelAnimationFrame(rafId);
      if (previewLine) fabricCanvas.remove(previewLine);
      if (snapIndicatorRef.current) {
        fabricCanvas.remove(snapIndicatorRef.current);
        snapIndicatorRef.current = null;
      }
    };
  }, [fabricCanvas]);

  // Handle calibration clicks
  const handleCalibrateClick = (pointer: { x: number; y: number }) => {
    const currentPlanPageId = planPageIdRef.current;
    
    console.log('[SCALE DEBUG] Calibrate click:', { pointer, planPageId: currentPlanPageId, isPlanReady });
    
    // Validate planPageId exists before allowing scale setting
    if (!currentPlanPageId || !isPlanReady) {
      toast.error("Please wait for plan to load before setting scale");
      return;
    }

    if (calibratePoints.length < 2) {
      const newPoints = [...calibratePoints, pointer];
      setCalibratePoints(newPoints);

      const pointLabel = newPoints.length === 1 ? "A" : "B";
      const circle = new Circle({
        radius: 6,
        fill: "#FF6B6B",
        stroke: "#CC0000",
        strokeWidth: 1,
        left: pointer.x,
        top: pointer.y,
        originX: "center",
        originY: "center",
        selectable: false,
      });
      (circle as any).__measurementType = 'calibration';
      
      const text = new Textbox(pointLabel, {
        left: pointer.x + 8,
        top: pointer.y - 8,
        fontSize: 12,
        fontWeight: "bold",
        fill: "#FF6B6B",
        backgroundColor: "white",
        selectable: false,
      });
      (text as any).__measurementType = 'calibration';

      fabricCanvas?.add(circle);
      fabricCanvas?.add(text);
      fabricCanvas?.renderAll();

      console.log('[SCALE DEBUG] Added calibration point', pointLabel, 'at', pointer);

      if (newPoints.length === 2) {
        const canvasDistance = Math.sqrt(
          Math.pow(newPoints[1].x - newPoints[0].x, 2) +
          Math.pow(newPoints[1].y - newPoints[0].y, 2)
        );
        console.log('[SCALE DEBUG] Canvas distance between A and B:', canvasDistance.toFixed(2), 'canvas units');
        
        const line = new Line(
          [newPoints[0].x, newPoints[0].y, newPoints[1].x, newPoints[1].y],
          { stroke: '#FF6B6B', strokeWidth: 2, selectable: false }
        );
        (line as any).__measurementType = 'calibration';
        fabricCanvas?.add(line);
        fabricCanvas?.renderAll();
        setShowCalibrationDialog(true);
      }
    }
  };

  // Apply scale calibration
  const applyScale = async () => {
    const currentPlanPageId = planPageIdRef.current;
    
    console.log('[SCALE DEBUG] === APPLYING SCALE ===');
    console.log('[SCALE DEBUG] planPageId:', currentPlanPageId);
    console.log('[SCALE DEBUG] calibratePoints:', calibratePoints);
    console.log('[SCALE DEBUG] calibrationDistance input:', calibrationDistance);
    
    if (!currentPlanPageId) {
      console.error('[SCALE DEBUG] FAILED: No planPageId');
      toast.error("Plan not loaded - cannot save scale");
      return;
    }

    const realDistanceMm = parseFloat(calibrationDistance);
    if (isNaN(realDistanceMm) || realDistanceMm <= 0) {
      console.error('[SCALE DEBUG] FAILED: Invalid distance');
      toast.error("Please enter a valid distance in mm");
      return;
    }

    const canvasDistance = Math.sqrt(
      Math.pow(calibratePoints[1].x - calibratePoints[0].x, 2) +
      Math.pow(calibratePoints[1].y - calibratePoints[0].y, 2)
    );

    const calculatedScaleFactor = realDistanceMm / canvasDistance;
    
    console.log('[SCALE DEBUG] === SCALE CALCULATION ===');
    console.log('[SCALE DEBUG] Point A:', calibratePoints[0]);
    console.log('[SCALE DEBUG] Point B:', calibratePoints[1]);
    console.log('[SCALE DEBUG] dx:', (calibratePoints[1].x - calibratePoints[0].x).toFixed(2));
    console.log('[SCALE DEBUG] dy:', (calibratePoints[1].y - calibratePoints[0].y).toFixed(2));
    console.log('[SCALE DEBUG] Canvas distance:', canvasDistance.toFixed(2), 'canvas units');
    console.log('[SCALE DEBUG] Real distance:', realDistanceMm, 'mm');
    console.log('[SCALE DEBUG] Formula: scale_factor = real_mm / canvas_units');
    console.log('[SCALE DEBUG] Scale factor =', realDistanceMm, '/', canvasDistance.toFixed(2), '=', calculatedScaleFactor.toFixed(4));
    console.log('[SCALE DEBUG] planPageId:', currentPlanPageId);
    console.log('[SCALE DEBUG] This means 10 canvas pixels =', (calculatedScaleFactor * 10).toFixed(2), 'mm');
    
    setScaleFactor(calculatedScaleFactor);

    console.log('[SCALE DEBUG] Updating database...');
    const { error } = await supabase
      .from('plan_pages')
      .update({
        scale_factor: calculatedScaleFactor,
        scale_known_distance_mm: realDistanceMm,
        scale_point_a: calibratePoints[0],
        scale_point_b: calibratePoints[1]
      })
      .eq('id', currentPlanPageId);

    if (error) {
      console.error('[SCALE DEBUG] Database save FAILED:', error);
      toast.error("Failed to save scale");
      return;
    }

    console.log('[SCALE DEBUG] Scale saved successfully to database');
    toast.success(`Scale set: ${calculatedScaleFactor.toFixed(2)} mm/unit`);
    
    // Clear calibration objects from canvas after successful application
    clearCalibrationObjects();
    setShowCalibrationDialog(false);
    setCalibratePoints([]);
    setCalibrationDistance("");
    setTool("plan");
  };

  // Handle line measurement click (uses ref to prevent stale state)
  const handleLineClick = (pointer: { x: number; y: number }) => {
    const currentMeasureStart = measureStartRef.current;
    if (!currentMeasureStart) {
      setMeasureStart(pointer);
    } else {
      drawLineMeasurement(currentMeasureStart, pointer);
      setMeasureStart(null);
    }
  };

  // Handle polygon area measurement (uses ref to prevent stale state)
  const handlePolygonClick = (pointer: { x: number; y: number }, type: "area" | "volume") => {
    if (!fabricCanvas) return;

    const currentPolygonPoints = polygonPointsRef.current;

    if (currentPolygonPoints.length > 2) {
      const firstPoint = currentPolygonPoints[0];
      const distance = Math.sqrt(
        Math.pow(pointer.x - firstPoint.x, 2) + Math.pow(pointer.y - firstPoint.y, 2)
      );

      if (distance < 20) {
        if (type === "volume") {
          closeAndMeasureVolume();
        } else {
          closeAndMeasurePolygon();
        }
        return;
      }
    }

    const newPoints = [...currentPolygonPoints, pointer];
    setPolygonPoints(newPoints);

    const pointColor = type === "volume" ? "#2196F3" : "#4CAF50";
    const point = new Circle({
      radius: 4,
      fill: pointColor,
      left: pointer.x,
      top: pointer.y,
      originX: "center",
      originY: "center",
      selectable: false,
      hoverCursor: "default",
    });
    fabricCanvas.add(point);
    
    const label = new Textbox(String(newPoints.length), {
      left: pointer.x + 8,
      top: pointer.y - 8,
      fontSize: 10,
      fill: pointColor,
      backgroundColor: "rgba(255, 255, 255, 0.8)",
      selectable: false,
    });
    fabricCanvas.add(label);
    fabricCanvas.renderAll();
  };

  // Handle EA (each) marker click
  const handleEAClick = (pointer: { x: number; y: number }) => {
    if (!fabricCanvas) return;

    const marker = new Rect({
      left: pointer.x - 4,
      top: pointer.y - 4,
      width: 8,
      height: 8,
      fill: "#FF9800",
      stroke: "#F57C00",
      strokeWidth: 1,
      selectable: false,
      hoverCursor: "default",
    });
    fabricCanvas.add(marker);
    fabricCanvas.renderAll();

    setPendingMeasurement({ type: 'ea', value: 1, points: [pointer] });
    setShowLabelDialog(true);
  };

  // Close polygon and calculate volume (uses refs for current state)
  const closeAndMeasureVolume = async () => {
    if (!fabricCanvas) return;
    
    const currentScaleFactor = scaleFactorRef.current;
    const currentPolygonPoints = polygonPointsRef.current;
    
    if (!currentScaleFactor) {
      toast.error("Please set scale first");
      return;
    }
    
    // Validate minimum 3 points
    if (currentPolygonPoints.length < 3) {
      toast.error("Polygon requires at least 3 points");
      return;
    }

    let area = 0;
    const n = currentPolygonPoints.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += currentPolygonPoints[i].x * currentPolygonPoints[j].y;
      area -= currentPolygonPoints[j].x * currentPolygonPoints[i].y;
    }
    area = Math.abs(area) / 2;
    const areaRealMm2 = area * Math.pow(currentScaleFactor, 2);
    const areaM2 = areaRealMm2 / 1000000;

    setPendingVolumeArea(areaM2);
    setPendingVolumePoints([...currentPolygonPoints]);
    setShowThicknessDialog(true);
  };

  const applyVolumeCalculation = async () => {
    const thickness = parseFloat(slabThickness);
    if (isNaN(thickness) || thickness <= 0) {
      toast.error("Please enter a valid thickness in mm");
      return;
    }

    const volumeM3 = pendingVolumeArea! * (thickness / 1000);
    
    const polygon = new Polygon(pendingVolumePoints, {
      fill: "rgba(33, 150, 243, 0.3)",
      stroke: "#2196F3",
      strokeWidth: 2,
      selectable: false,
      hoverCursor: "default",
    });
    fabricCanvas?.add(polygon);

    const centerX = pendingVolumePoints.reduce((sum, p) => sum + p.x, 0) / pendingVolumePoints.length;
    const centerY = pendingVolumePoints.reduce((sum, p) => sum + p.y, 0) / pendingVolumePoints.length;

    const label = new Textbox(`${volumeM3.toFixed(2)} m³\n${thickness}mm`, {
      left: centerX,
      top: centerY,
      fontSize: 14,
      fill: "#2196F3",
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      textAlign: "center",
      originX: "center",
      originY: "center",
      selectable: false,
    });
    fabricCanvas?.add(label);
    fabricCanvas?.renderAll();

    setPolygonPoints([]);
    setPendingMeasurement({
      type: "volume",
      value: volumeM3,
      area: pendingVolumeArea!,
      thickness: thickness,
      points: pendingVolumePoints,
    });
    setShowLabelDialog(true);
    setShowThicknessDialog(false);
    setSlabThickness("");
    setPendingVolumeArea(null);
    setPendingVolumePoints([]);
  };
  
  // Close polygon and calculate area (uses refs for current state)
  const closeAndMeasurePolygon = async () => {
    if (!fabricCanvas) return;
    
    const currentScaleFactor = scaleFactorRef.current;
    const currentPolygonPoints = polygonPointsRef.current;
    
    if (!currentScaleFactor) {
      toast.error("Please set scale first");
      return;
    }
    
    // Validate minimum 3 points
    if (currentPolygonPoints.length < 3) {
      toast.error("Polygon requires at least 3 points");
      return;
    }

    let area = 0;
    const n = currentPolygonPoints.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += currentPolygonPoints[i].x * currentPolygonPoints[j].y;
      area -= currentPolygonPoints[j].x * currentPolygonPoints[i].y;
    }
    area = Math.abs(area) / 2;

    const areaRealMm2 = area * Math.pow(currentScaleFactor, 2);
    const areaM2 = areaRealMm2 / 1000000;

    const polygon = new Polygon(currentPolygonPoints, {
      fill: 'rgba(76, 175, 80, 0.3)',
      stroke: '#4CAF50',
      strokeWidth: 2,
      selectable: true
    });

    const centroid = {
      x: currentPolygonPoints.reduce((sum, p) => sum + p.x, 0) / n,
      y: currentPolygonPoints.reduce((sum, p) => sum + p.y, 0) / n
    };

    const label = new Textbox(`${areaM2.toFixed(2)} m²`, {
      left: centroid.x,
      top: centroid.y,
      fontSize: 16,
      fill: '#4CAF50',
      backgroundColor: 'white',
      selectable: true
    });

    fabricCanvas.add(polygon);
    fabricCanvas.add(label);
    fabricCanvas.renderAll();

    setPendingMeasurement({
      type: 'area',
      points: currentPolygonPoints,
      value: areaM2
    });
    setShowLabelDialog(true);
    setPolygonPoints([]);
  };

  // Draw line measurement
  const drawLineMeasurement = async (start: { x: number; y: number }, end: { x: number; y: number }) => {
    if (!fabricCanvas) return;

    const line = new Line([start.x, start.y, end.x, end.y], {
      stroke: "#FF6B6B",
      strokeWidth: 2,
      selectable: true
    });

    const distance = Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
    );

    let displayText = `${distance.toFixed(2)}px`;
    let realValue = distance;
    let realUnit = 'px';

    if (scaleFactor) {
      const realDistanceMm = distance * scaleFactor;
      const realDistanceM = realDistanceMm / 1000;
      displayText = `${realDistanceM.toFixed(2)} m`;
      realValue = realDistanceM;
      realUnit = 'm';
    }

    const text = new Textbox(displayText, {
      left: (start.x + end.x) / 2,
      top: (start.y + end.y) / 2 - 20,
      fontSize: 14,
      fill: "#FF6B6B",
      backgroundColor: "white",
      selectable: true
    });

    fabricCanvas.add(line);
    fabricCanvas.add(text);
    fabricCanvas.renderAll();

    setPendingMeasurement({
      type: 'linear',
      points: [start, end],
      value: realValue
    });
    setShowLabelDialog(true);
  };

  // Detect symbols using AI
  const handleDetectSymbols = async () => {
    if (!planPageId) {
      toast.error("Plan not loaded - cannot detect symbols");
      return;
    }

    setIsDetectingSymbols(true);
    toast.info("Detecting symbols on plan...");

    try {
      const { data, error } = await supabase.functions.invoke('plan-detect-symbols', {
        body: {
          planPageId,
          planUrl
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Detected ${data.count} symbols`);
        // Reload symbols to display them
        const { data: symbolsData } = await supabase
          .from('plan_symbols')
          .select('*')
          .eq('plan_page_id', planPageId);
        
        if (symbolsData) {
          setDetectedSymbols(symbolsData);
        }
      }
    } catch (error) {
      console.error('Error detecting symbols:', error);
      toast.error('Failed to detect symbols');
    } finally {
      setIsDetectingSymbols(false);
    }
  };

  const handleExtractSchedules = async () => {
    if (!planPageId) {
      toast.error("Plan not loaded - cannot extract schedules");
      return;
    }

    toast.info("Extracting schedules from plan...");

    try {
      const { data, error } = await supabase.functions.invoke('plan-extract-schedules', {
        body: {
          planPageId,
          planUrl
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Extracted ${data.count} schedule items`);
      }
    } catch (error) {
      console.error('Error extracting schedules:', error);
      toast.error('Failed to extract schedules');
    }
  };

  const handleLinkSymbols = async () => {
    if (!planPageId) {
      toast.error("Plan not loaded - cannot link symbols");
      return;
    }

    toast.info("Linking symbols to schedules...");

    try {
      const { data, error } = await supabase.functions.invoke('link-symbols-to-schedules', {
        body: { planPageId }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Linked ${data.updated} symbols`);
        
        if (data.issues && data.issues.length > 0) {
          data.issues.forEach((issue: string) => {
            toast.warning(issue, { duration: 5000 });
          });
        }

        // Reload symbols to show updated data
        const { data: symbolsData } = await supabase
          .from('plan_symbols')
          .select('*')
          .eq('plan_page_id', planPageId);
        
        if (symbolsData) {
          setDetectedSymbols(symbolsData);
        }
      }
    } catch (error) {
      console.error('Error linking symbols:', error);
      toast.error('Failed to link symbols');
    }
  };

  // Render symbol overlays on canvas
  const renderSymbolOverlays = () => {
    if (!fabricCanvas || detectedSymbols.length === 0) return;

    // Clear existing overlays
    fabricCanvas.getObjects().forEach(obj => {
      if ((obj as any).__symbolOverlay) {
        fabricCanvas.remove(obj);
      }
    });

    // Use actual canvas dimensions
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();

    detectedSymbols.forEach((symbol) => {
      const { x, y, width, height } = symbol.bounding_box;

      const canvasX = (x / 100) * canvasWidth;
      const canvasY = (y / 100) * canvasHeight;
      const canvasW = (width / 100) * canvasWidth;
      const canvasH = (height / 100) * canvasHeight;

      const color = getSymbolColor(symbol.symbol_type);

      const rect = new Rect({
        left: canvasX,
        top: canvasY,
        width: canvasW,
        height: canvasH,
        fill: 'transparent',
        stroke: color,
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: false
      });
      (rect as any).__symbolOverlay = true;

      const label = new Textbox(symbol.label_nearby || symbol.schedule_id || symbol.symbol_type.toUpperCase(), {
        left: canvasX,
        top: canvasY - 20,
        fontSize: 12,
        fill: color,
        backgroundColor: 'white',
        selectable: false
      });
      (label as any).__symbolOverlay = true;

      fabricCanvas.add(rect);
      fabricCanvas.add(label);
    });

    fabricCanvas.renderAll();
  };

  const getSymbolColor = (type: string) => {
    switch (type) {
      case 'door': return '#FF6B6B';
      case 'window': return '#4ECDC4';
      case 'toilet':
      case 'basin':
      case 'shower': return '#45B7D1';
      default: return '#95A5A6';
    }
  };

  // Save measurement with label and category
  const saveMeasurement = async () => {
    if (!pendingMeasurement || !planPageId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const label = measurementLabel.trim();
    if (!label) {
      toast.error("Please enter a label");
      return;
    }

    try {
      let unit = "LM";
      let realUnit = "m";
      let volumeM3 = null;
      let thicknessMm = null;
      
      if (pendingMeasurement.type === "area") {
        unit = "M2";
        realUnit = "m²";
      } else if (pendingMeasurement.type === "volume") {
        unit = "M3";
        realUnit = "m³";
        volumeM3 = pendingMeasurement.value;
        thicknessMm = pendingMeasurement.thickness;
      } else if (pendingMeasurement.type === "ea") {
        unit = "EA";
        realUnit = "ea";
      }

      const { data, error } = await supabase.from("plan_measurements").insert({
        plan_page_id: planPageId,
        user_id: user.id,
        measurement_type: pendingMeasurement.type,
        points: pendingMeasurement.points,
        raw_value: pendingMeasurement.value,
        real_value: pendingMeasurement.type === "volume" ? pendingMeasurement.area : pendingMeasurement.value,
        real_unit: realUnit,
        unit: unit,
        volume_m3: volumeM3,
        thickness_mm: thicknessMm,
        label: label,
        trade: measurementCategory || null,
      }).select().single();

      if (error) throw error;

      // Add to history for undo
      if (data) {
        addToHistory({
          type: 'add_measurement',
          data: data
        });
      }

      toast.success(`Measurement saved: ${label}`);
      setShowLabelDialog(false);
      setPendingMeasurement(null);
      setMeasurementLabel("");
      setMeasurementCategory("");
      loadMeasurements();
    } catch (error) {
      console.error('Error saving measurement:', error);
      toast.error("Failed to save measurement");
    }
  };

  // Clear all measurement objects from canvas
  const clearMeasurementObjects = () => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj) => {
      // Remove lines, polygons, textboxes, rects (but keep background image)
      if (obj instanceof Line || obj instanceof Textbox || obj instanceof Polygon || 
          obj instanceof Rect || obj instanceof Circle) {
        if (obj.selectable !== false || obj.fill === "rgba(76, 175, 80, 0.3)" || 
            obj.fill === "rgba(33, 150, 243, 0.3)" || obj.stroke === "#FF6B6B" ||
            obj.stroke === "#4CAF50" || obj.stroke === "#2196F3" || obj.fill === "#FF9800") {
          fabricCanvas.remove(obj);
        }
      }
    });
    fabricCanvas.renderAll();
  };

  // Redraw all measurements from database onto canvas
  const redrawMeasurementsFromDatabase = async () => {
    if (!fabricCanvas || !planPageId) return;
    
    try {
      const { data, error } = await supabase
        .from('plan_measurements')
        .select('*')
        .eq('plan_page_id', planPageId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) {
        redrawMeasurementsOnCanvas(data);
      }
    } catch (error) {
      console.error('Error redrawing measurements:', error);
    }
  };

  // Redraw measurements on canvas from data
  const redrawMeasurementsOnCanvas = (measurementData: any[]) => {
    if (!fabricCanvas) return;

    measurementData.forEach((m) => {
      const points = m.points as { x: number; y: number }[];
      if (!points || points.length === 0) return;

      if (m.measurement_type === 'linear') {
        const [start, end] = points;
        const line = new Line([start.x, start.y, end.x, end.y], {
          stroke: "#FF6B6B",
          strokeWidth: 2,
          selectable: false
        });
        const text = new Textbox(`${m.real_value?.toFixed(2)} ${m.real_unit}`, {
          left: (start.x + end.x) / 2,
          top: (start.y + end.y) / 2 - 20,
          fontSize: 14,
          fill: "#FF6B6B",
          backgroundColor: "white",
          selectable: false
        });
        fabricCanvas.add(line);
        fabricCanvas.add(text);
      } else if (m.measurement_type === 'area') {
        const polygon = new Polygon(points, {
          fill: 'rgba(76, 175, 80, 0.3)',
          stroke: '#4CAF50',
          strokeWidth: 2,
          selectable: false
        });
        const centroid = {
          x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
          y: points.reduce((sum, p) => sum + p.y, 0) / points.length
        };
        const text = new Textbox(`${m.real_value?.toFixed(2)} ${m.real_unit}`, {
          left: centroid.x,
          top: centroid.y,
          fontSize: 16,
          fill: '#4CAF50',
          backgroundColor: 'white',
          selectable: false
        });
        fabricCanvas.add(polygon);
        fabricCanvas.add(text);
      } else if (m.measurement_type === 'volume') {
        const polygon = new Polygon(points, {
          fill: "rgba(33, 150, 243, 0.3)",
          stroke: "#2196F3",
          strokeWidth: 2,
          selectable: false
        });
        const centroid = {
          x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
          y: points.reduce((sum, p) => sum + p.y, 0) / points.length
        };
        const text = new Textbox(`${m.volume_m3?.toFixed(2)} m³\n${m.thickness_mm}mm`, {
          left: centroid.x,
          top: centroid.y,
          fontSize: 14,
          fill: "#2196F3",
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          textAlign: "center",
          originX: "center",
          originY: "center",
          selectable: false
        });
        fabricCanvas.add(polygon);
        fabricCanvas.add(text);
      } else if (m.measurement_type === 'ea') {
        const [point] = points;
        const marker = new Rect({
          left: point.x - 4,
          top: point.y - 4,
          width: 8,
          height: 8,
          fill: "#FF9800",
          stroke: "#F57C00",
          strokeWidth: 1,
          selectable: false
        });
        fabricCanvas.add(marker);
      }
    });
    
    fabricCanvas.renderAll();
  };

  // Undo/Redo functions
  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;
  
  const addToHistory = (action: any) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(action);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = async () => {
    if (!canUndo || historyIndex < 0) return;
    const action = history[historyIndex];
    
    if (action.type === 'add_measurement') {
      await supabase.from('plan_measurements').delete().eq('id', action.data.id);
      clearMeasurementObjects();
      await redrawMeasurementsFromDatabase();
      toast.success("Undone");
    }
    
    setHistoryIndex(prev => prev - 1);
    await loadMeasurements();
  };

  const redo = async () => {
    if (!canRedo) return;
    const action = history[historyIndex + 1];
    
    if (action.type === 'add_measurement') {
      await supabase.from('plan_measurements').insert(action.data);
      clearMeasurementObjects();
      await redrawMeasurementsFromDatabase();
      toast.success("Redone");
    }
    
    setHistoryIndex(prev => prev + 1);
    await loadMeasurements();
  };
  
  // Edit measurement
  const handleEditMeasurement = (measurement: any) => {
    setEditingMeasurement(measurement);
    setShowEditDialog(true);
  };
  
  const updateMeasurement = async () => {
    if (!editingMeasurement) return;
    
    try {
      const { error } = await supabase
        .from('plan_measurements')
        .update({
          label: editingMeasurement.label,
          trade: editingMeasurement.trade
        })
        .eq('id', editingMeasurement.id);

      if (error) throw error;
      
      toast.success("Measurement updated");
      setShowEditDialog(false);
      setEditingMeasurement(null);
      await loadMeasurements();
    } catch (error) {
      console.error('Error updating measurement:', error);
      toast.error("Failed to update measurement");
    }
  };

  // Delete measurement
  const deleteMeasurement = async (id: string) => {
    try {
      const measurementToDelete = measurements.find(m => m.id === id);
      
      const { error } = await supabase
        .from('plan_measurements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Add to history for undo
      if (measurementToDelete) {
        addToHistory({
          type: 'delete_measurement',
          data: measurementToDelete
        });
      }

      toast.success("Measurement deleted");
      loadMeasurements();
    } catch (error) {
      console.error('Error deleting measurement:', error);
      toast.error("Failed to delete measurement");
    }
  };

  const handleZoomIn = () => {
    if (!fabricCanvas) return;
    const newScale = scale * 1.2;
    setScale(newScale);
    fabricCanvas.setZoom(newScale);
    fabricCanvas.renderAll();
  };

  const handleZoomOut = () => {
    if (!fabricCanvas) return;
    const newScale = scale / 1.2;
    setScale(newScale);
    fabricCanvas.setZoom(newScale);
    fabricCanvas.renderAll();
  };

  const handleClearMeasurements = () => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj) => {
      if (obj instanceof Line || obj instanceof Textbox || obj instanceof Polygon || obj instanceof Rect) {
        if (obj.selectable !== false) {
          fabricCanvas.remove(obj);
        }
      }
    });
    fabricCanvas.renderAll();
    setPolygonPoints([]);
    setCalibratePoints([]);
    toast.success("Measurements cleared");
  };

  return (
    <div className="flex gap-4">
      <div className="flex-1 space-y-4">
        {!wizardMode && (
          <Card className="p-4">
            <div className="flex flex-wrap gap-2">
            <Button
              variant={tool === "plan" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool("plan")}
            >
              <FileText className="h-4 w-4 mr-2" />
              Plan
            </Button>

            <Button
              variant={tool === "calibrate" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool("calibrate")}
              disabled={!isPlanReady}
              title={!isPlanReady ? "Loading plan..." : "Set scale by clicking two reference points"}
            >
              {!isPlanReady && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isPlanReady && <Ruler className="h-4 w-4 mr-2" />}
              Set Scale
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <PenTool className="h-4 w-4 mr-2" />
                  Measure ▾
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setTool("measure-lm")}>
                  <Minus className="h-4 w-4 mr-2" />
                  LM (Line)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTool("measure-m2")}>
                  <Square className="h-4 w-4 mr-2" />
                  M² (Area)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTool("measure-m3")}>
                  <Box className="h-4 w-4 mr-2" />
                  M³ (Slab)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTool("measure-ea")}>
                  <Hash className="h-4 w-4 mr-2" />
                  EA (Each)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={undo} 
              disabled={!canUndo}
              title="Undo last action"
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Undo
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={redo} 
              disabled={!canRedo}
              title="Redo last action"
            >
              <Redo2 className="h-4 w-4 mr-2" />
              Redo
            </Button>
            
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4 mr-2" />
              Zoom In
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4 mr-2" />
              Zoom Out
            </Button>
            
            <Button
              variant={snapEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setSnapEnabled(!snapEnabled)}
              title={`Grid snapping: ${snapEnabled ? 'ON' : 'OFF'}`}
            >
              <Magnet className="h-4 w-4 mr-2" />
              Snap {snapEnabled ? "On" : "Off"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDetectSymbols}
              disabled={isDetectingSymbols || !isPlanReady}
              title={!isPlanReady ? "Loading plan..." : "Auto-detect doors, windows, fixtures"}
            >
              {isDetectingSymbols ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
            
            <Button
              onClick={handleExtractSchedules}
              disabled={!isPlanReady}
              variant="outline"
              size="sm"
              title="Extract door/window schedules"
            >
              <FileText className="h-4 w-4" />
            </Button>
            
            <Button
              onClick={handleLinkSymbols}
              disabled={!isPlanReady}
              variant="outline"
              size="sm"
              title="Link symbols to schedules"
            >
              <Link className="h-4 w-4" />
            </Button>

            <Button variant="destructive" size="sm" onClick={handleClearMeasurements}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>

            {scaleFactor && (
              <>
                <Badge variant="secondary" className="ml-auto">
                  {scaleFactor.toFixed(2)} mm/unit
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  title="Show scale diagnostics"
                >
                  Debug
                </Button>
              </>
            )}
            {!isPlanReady && (
              <Badge variant="outline" className="ml-auto">
                Loading plan...
              </Badge>
            )}
          </div>
        </Card>
        )}

        {/* Diagnostic Panel */}
        {showDiagnostics && (
          <Card className="p-4 bg-muted/50">
            <div className="space-y-2 text-xs">
              <h4 className="font-semibold text-sm mb-2">Scale Diagnostics</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Plan Page ID:</span>
                  <p className="font-mono text-xs truncate">{planPageId || 'Not set'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Ready:</span>
                  <p className={isPlanReady ? "text-green-600" : "text-red-600"}>
                    {isPlanReady ? "✓ Yes" : "✗ No"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Scale Factor (State):</span>
                  <p className="font-mono">{scaleFactor ? scaleFactor.toFixed(4) : 'Not set'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">10px =</span>
                  <p className="font-mono">{scaleFactor ? (scaleFactor * 10).toFixed(2) + ' mm' : '-'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Calibration Points:</span>
                  <p className="font-mono text-xs">
                    {calibratePoints.length > 0 
                      ? calibratePoints.map((p, i) => `${String.fromCharCode(65 + i)}(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(' → ')
                      : 'None'}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full mt-2" onClick={async () => {
                if (!planPageId) return;
                const { data } = await supabase.from('plan_pages').select('scale_factor').eq('id', planPageId).single();
                toast.info(`DB scale_factor: ${data?.scale_factor ? data.scale_factor.toFixed(4) : 'null'}`);
              }}>
                Check DB Value
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-4">
        <div className="border border-border rounded-lg overflow-hidden bg-background relative" style={{ cursor: getCursorStyle() }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {!isPlanReady && !isLoading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading plan...</span>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {tool === "calibrate" && "Click two points on a known dimension"}
          {tool === "measure-lm" && "Click start and end points to measure line distance"}
          {tool === "measure-m2" && "Click points to create a polygon for area. Click near start to close."}
          {tool === "measure-m3" && "Click points to create a polygon for slab volume. Click near start to close."}
          {tool === "measure-ea" && "Click to place markers for counting fixtures"}
          {tool === "plan" && "Plan mode: drag to pan the canvas"}
        </p>
      </Card>

      <Dialog open={showCalibrationDialog} onOpenChange={setShowCalibrationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Scale</DialogTitle>
            <DialogDescription>
              Enter the real-world distance between the two points you selected
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Distance (mm)</Label>
            <Input
              type="number"
              value={calibrationDistance}
              onChange={(e) => setCalibrationDistance(e.target.value)}
              placeholder="e.g., 5000 for 5 meters"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCalibrationDialog(false);
              setCalibratePoints([]);
              setCalibrationDistance("");
              clearCalibrationObjects();
            }}>
              Cancel
            </Button>
            <Button onClick={applyScale}>Apply Scale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showThicknessDialog} onOpenChange={setShowThicknessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Slab Thickness</DialogTitle>
            <DialogDescription>
              Area calculated: {pendingVolumeArea?.toFixed(2)} m². Enter slab thickness to calculate volume.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Thickness (mm)</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {[100, 120, 150, 200].map(t => (
                <Button
                  key={t}
                  variant={slabThickness === String(t) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSlabThickness(String(t))}
                >
                  {t}mm
                </Button>
              ))}
            </div>
            <Input
              type="number"
              value={slabThickness}
              onChange={(e) => setSlabThickness(e.target.value)}
              placeholder="Custom thickness in mm"
              className="mt-3"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowThicknessDialog(false);
              setPendingVolumeArea(null);
              setPendingVolumePoints([]);
              setSlabThickness("");
              setPolygonPoints([]);
              // Remove any temporary polygon points from canvas
              if (fabricCanvas) {
                const objects = fabricCanvas.getObjects();
                objects.forEach((obj) => {
                  if (obj instanceof Circle && (obj.fill === "#2196F3" || obj.fill === "#4CAF50")) {
                    fabricCanvas.remove(obj);
                  }
                  if (obj instanceof Textbox && obj.fill === "#2196F3") {
                    fabricCanvas.remove(obj);
                  }
                });
                fabricCanvas.renderAll();
              }
            }}>
              Cancel
            </Button>
            <Button onClick={applyVolumeCalculation}>Calculate Volume</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLabelDialog} onOpenChange={setShowLabelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Label Measurement</DialogTitle>
            <DialogDescription>
              Give this measurement a name and category
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Measurement Name</Label>
              <Input
                value={measurementLabel}
                onChange={(e) => setMeasurementLabel(e.target.value)}
                placeholder="e.g., Bedroom Wall N, Bathroom Floor, Door D01"
                autoFocus
              />
            </div>
            <div>
              <Label>Category (optional)</Label>
              <Select value={measurementCategory} onValueChange={setMeasurementCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gyprock">Gyprock</SelectItem>
                  <SelectItem value="Tiling">Tiling</SelectItem>
                  <SelectItem value="Framing">Framing</SelectItem>
                  <SelectItem value="Flooring">Flooring</SelectItem>
                  <SelectItem value="Painting">Painting</SelectItem>
                  <SelectItem value="Concrete">Concrete</SelectItem>
                  <SelectItem value="Doors">Doors</SelectItem>
                  <SelectItem value="Windows">Windows</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowLabelDialog(false);
              setPendingMeasurement(null);
              setMeasurementLabel("");
              setMeasurementCategory("");
              // Clear any preview objects on canvas
              clearMeasurementObjects();
              redrawMeasurementsOnCanvas(measurements);
            }}>
              Cancel
            </Button>
            <Button onClick={saveMeasurement}>Save Measurement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Measurement</DialogTitle>
            <DialogDescription>
              Update the label and category for this measurement
            </DialogDescription>
          </DialogHeader>
          {editingMeasurement && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Measurement Name</Label>
                <Input
                  value={editingMeasurement.label || ""}
                  onChange={(e) => setEditingMeasurement({
                    ...editingMeasurement,
                    label: e.target.value
                  })}
                  placeholder="e.g., Bedroom Wall N"
                  autoFocus
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select 
                  value={editingMeasurement.trade || ""} 
                  onValueChange={(value) => setEditingMeasurement({
                    ...editingMeasurement,
                    trade: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gyprock">Gyprock</SelectItem>
                    <SelectItem value="Tiling">Tiling</SelectItem>
                    <SelectItem value="Framing">Framing</SelectItem>
                    <SelectItem value="Flooring">Flooring</SelectItem>
                    <SelectItem value="Painting">Painting</SelectItem>
                    <SelectItem value="Concrete">Concrete</SelectItem>
                    <SelectItem value="Doors">Doors</SelectItem>
                    <SelectItem value="Windows">Windows</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              setEditingMeasurement(null);
            }}>
              Cancel
            </Button>
            <Button onClick={updateMeasurement}>Update Measurement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!wizardMode && measurements.length > 0 && (
        <Card className="p-4 mt-4">
          <h3 className="font-semibold mb-4">Measurements Table</h3>
          <MeasurementsTable 
            measurements={measurements}
            onDelete={deleteMeasurement}
            onEdit={handleEditMeasurement}
          />
        </Card>
      )}
      </div>

      {!wizardMode && (
        <MeasurementsSidebar
          measurements={measurements}
          onDelete={deleteMeasurement}
          onEdit={handleEditMeasurement}
          planPageId={planPageId || ""}
        />
      )}
    </div>
  );
};
