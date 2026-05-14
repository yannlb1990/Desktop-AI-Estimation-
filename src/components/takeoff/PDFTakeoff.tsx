import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, ChevronLeft, ChevronRight, Trash2, FileText, SlidersHorizontal, Combine, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PDFUploadManager } from './PDFUploadManager';
import { InteractiveCanvas } from './InteractiveCanvas';
import { ScalingCalibrator } from './ScalingCalibrator';
import { MeasurementToolbar } from './MeasurementToolbar';
import { ViewportControls } from './ViewportControls';
import { Magnifier } from './Magnifier';
import { TakeoffTable } from './TakeoffTable';
import { CostEstimator } from './CostEstimator';
import { AIExtractionPanel } from './AIExtractionPanel';
import { DetectionResultsPanel } from './DetectionResultsPanel';
import { useTakeoffState } from '@/hooks/useTakeoffState';
import { WorldPoint, MeasurementUnit, Measurement, PDFViewportData, CostItem } from '@/lib/takeoff/types';
import { DetectedOpening } from '@/lib/takeoff/pdfTextExtractor';
import { fetchNCCCode } from '@/lib/takeoff/nccCodeFetcher';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportMeasurementsToJSON } from '@/lib/takeoff/export';
import { ledgerToCsv } from '@/lib/takeoff/ledger';
import { shortcutToTool, shouldHandleShortcut } from '@/lib/takeoff/shortcuts';
import { TAKEOFF_UNITS, UNIT_GROUPS } from '@/lib/takeoff/units';
import { generateTakeoffPdf } from '@/lib/takeoff/pdfReport';
import { GroupLegend } from './GroupLegend';
import { MaterialExtractorPanel } from './MaterialExtractorPanel';
import { PlanIntelligencePanel } from './PlanIntelligencePanel';
import { SOWGeneratorDialog } from './SOWGeneratorDialog';
import { ProfileConfigDialog } from './ProfileConfigDialog';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { DimensionExtraction, ExtractedTable, RoomArea } from '@/lib/api/pdfExtractionApi';
import { AppProfile, loadProfile } from '@/lib/takeoff/profile';

interface PDFTakeoffProps {
  projectId: string;
  estimateId?: string;
  onAddCostItems?: (items: any[]) => void;
}

export const PDFTakeoff = ({ projectId, estimateId, onAddCostItems }: PDFTakeoffProps) => {
  const { state, dispatch } = useTakeoffState(projectId);
  const [activeTab, setActiveTab] = React.useState('upload');
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [manualCalibrationPoints, setManualCalibrationPoints] = useState<[WorldPoint, WorldPoint] | null>(null);
  const [pdfViewport, setPdfViewport] = useState<{ width: number; height: number } | null>(null);
  const [pageFilter, setPageFilter] = useState<number | 'all'>('all');
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedDimensions, setExtractedDimensions] = useState<DimensionExtraction[]>([]);
  const [extractedTables, setExtractedTables] = useState<ExtractedTable[]>([]);
  const [detectedOpenings, setDetectedOpenings] = useState<DetectedOpening[]>([]);
  const [showSOWDialog, setShowSOWDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [isTakeoffFullscreen, setIsTakeoffFullscreen] = useState(false);
  const [appProfile, setAppProfile] = useState<AppProfile>(() => loadProfile());
  const [sidebarSelectedIds, setSidebarSelectedIds] = useState<Set<string>>(new Set());
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const initialFitDoneRef = useRef(false);

  // Reset initial fit when PDF changes
  React.useEffect(() => {
    if (state.pdfFile) {
      initialFitDoneRef.current = false;
    }
  }, [state.pdfFile?.url]);

  // Filter measurements by page
  const filteredMeasurements = useMemo(() => {
    if (pageFilter === 'all') return state.measurements;
    return state.measurements.filter((m) => m.pageIndex === pageFilter);
  }, [pageFilter, state.measurements]);

  // Calculate totals by unit type
  const totalsByUnit = useMemo(() => {
    return filteredMeasurements.reduce<Record<string, number>>((acc, measurement) => {
      const current = acc[measurement.unit] || 0;
      acc[measurement.unit] = current + measurement.realValue;
      return acc;
    }, { LM: 0, M2: 0, M3: 0, count: 0 });
  }, [filteredMeasurements]);

  // Download helper
  const downloadFile = (filename: string, content: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Auto-switch to measure tab after upload OR when PDF is restored from localStorage
  const hasAutoSwitched = React.useRef(false);
  React.useEffect(() => {
    if (state.pdfFile && activeTab === 'upload') {
      setActiveTab('measure');
      if (!hasAutoSwitched.current) {
        hasAutoSwitched.current = true;
        // Only show the toast on fresh uploads, not on restoration
        if (state.pdfFile.file) {
          toast.success('PDF uploaded! Set scale to start measuring');
        } else {
          toast.success(`Plan restored: ${state.pdfFile.name}`);
        }
      }
    }
  }, [state.pdfFile, activeTab]);

  // Keyboard shortcuts: V=select H=pan E=eraser L=line R=rect P=polygon C=circle N=count Esc=select
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!shouldHandleShortcut(e.target)) return;
      if (e.key === 'Escape') {
        setIsTakeoffFullscreen(false);
        dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
        return;
      }
      const tool = shortcutToTool(e.key);
      if (tool !== null) dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool });
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  const handleZoomIn = () => {
    dispatch({
      type: 'SET_TRANSFORM',
      payload: { zoom: Math.min(state.transform.zoom + 0.25, 4) }
    });
  };

  const handleZoomOut = () => {
    dispatch({ 
      type: 'SET_TRANSFORM', 
      payload: { zoom: Math.max(state.transform.zoom - 0.25, 0.1) } 
    });
  };

  const handleRotate = () => {
    const newRotation = ((rotation + 90) % 360) as 0 | 90 | 180 | 270;
    setRotation(newRotation);
    dispatch({ 
      type: 'SET_TRANSFORM', 
      payload: { rotation: newRotation } 
    });
  };

  const handleFitToScreen = () => {
    const container = canvasContainerRef.current;
    const containerWidth = container?.clientWidth || 1200;
    const containerHeight = container?.clientHeight || 800;

    if (pdfViewport) {
      const fitZoom = Math.min(
        containerWidth / pdfViewport.width,
        containerHeight / pdfViewport.height
      );
      dispatch({
        type: 'SET_TRANSFORM',
        payload: { zoom: fitZoom, panX: 0, panY: 0 }
      });
    } else {
      dispatch({
        type: 'SET_TRANSFORM',
        payload: { zoom: 1, panX: 0, panY: 0 }
      });
    }
  };

  const handlePagePrevious = () => {
    if (state.currentPageIndex > 0) {
      dispatch({ type: 'SET_CURRENT_PAGE', payload: state.currentPageIndex - 1 });
    }
  };

  const handlePageNext = () => {
    if (state.pdfFile && state.currentPageIndex < state.pdfFile.pageCount - 1) {
      dispatch({ type: 'SET_CURRENT_PAGE', payload: state.currentPageIndex + 1 });
    }
  };

  // FIX: Memoize callbacks to prevent infinite re-renders
  const handleMeasurementComplete = useCallback((measurement: Measurement) => {
    // Guard: never store zero-length / zero-area measurements.
    // These arise from accidental clicks (no drag) or double-clicks and clutter
    // the sidebar with "0.00 m" entries that can't be meaningfully edited.
    // Count measurements are exempt (their realValue is the item count ≥ 1).
    if ((measurement as any).type !== 'count' && measurement.realValue === 0) return;
    dispatch({ type: 'ADD_MEASUREMENT', payload: measurement });
    toast.success('Measurement added');
  }, [dispatch]);

  const handleDeleteLastMeasurement = useCallback(() => {
    const measurements = state.measurements;
    if (measurements.length === 0) {
      toast.error('No measurements to delete');
      return;
    }
    const lastMeasurement = measurements[measurements.length - 1];
    dispatch({ type: 'DELETE_MEASUREMENT', payload: lastMeasurement.id });
    toast.success('Last measurement deleted');
  }, [dispatch, state.measurements]);

  const handleDeleteMeasurement = useCallback((id: string) => {
    dispatch({ type: 'DELETE_MEASUREMENT', payload: id });
    toast.success('Measurement deleted');
  }, [dispatch]);

  const handleCalibrationPointsSet = useCallback((points: [WorldPoint, WorldPoint]) => {
    setManualCalibrationPoints(points);
    toast.info('Enter real-world distance below');
  }, []);

  const handleTransformChange = useCallback((transform: Partial<typeof state.transform>) => {
    dispatch({ type: 'SET_TRANSFORM', payload: transform });
  }, [dispatch]);

  const handleViewportReady = useCallback((viewport: PDFViewportData) => {
    setPdfViewport({ width: viewport.width, height: viewport.height });
    
    // CRITICAL: Only fit on initial load, not on every callback
    if (!initialFitDoneRef.current) {
      initialFitDoneRef.current = true;
      
      // Use setTimeout to ensure container has been laid out
      setTimeout(() => {
        const container = canvasContainerRef.current;
        const containerWidth = container?.clientWidth || 1200;
        const containerHeight = container?.clientHeight || 800;
        
        const fitZoom = Math.min(
          containerWidth / viewport.width,
          containerHeight / viewport.height
        );
        
        dispatch({ type: 'SET_TRANSFORM', payload: { zoom: fitZoom, panX: 0, panY: 0 } });
      }, 50);
    }
  }, [dispatch]);

  // New callbacks for upgraded components
  const handleCalibrationCancel = useCallback(() => {
    setManualCalibrationPoints(null);
    dispatch({ type: 'SET_CALIBRATION_MODE', payload: null });
  }, [dispatch]);

  const handleResetScale = useCallback(() => {
    dispatch({ type: 'RESET_SCALE', payload: state.currentPageIndex });
  }, [dispatch, state.currentPageIndex]);

  // Handle measurement updates from canvas (resize/move)
  const handleMeasurementUpdate = useCallback((id: string, updates: Partial<Measurement>) => {
    dispatch({ type: 'UPDATE_MEASUREMENT', payload: { id, updates } });
    toast.success('Measurement updated');
  }, [dispatch]);

  const handleFetchNCCCode = useCallback(async (id: string, area: string, materials: string[]) => {
    return await fetchNCCCode(area, materials);
  }, []);

  // AI Extraction handlers
  const handleDimensionsExtracted = useCallback((dimensions: DimensionExtraction[]) => {
    setExtractedDimensions(dimensions);

    // Optionally auto-create measurements from extracted dimensions
    dimensions.forEach((dim) => {
      // Create a measurement from the extracted dimension
      const measurement: Measurement = {
        id: crypto.randomUUID(),
        type: 'line',
        points: [], // Will be positioned based on bbox
        pixelValue: 0,
        realValue: dim.value,
        unit: dim.dimension_type === 'area' ? 'M2' : 'LM',
        label: `AI: ${dim.text}`,
        color: '#10B981', // Green for AI-extracted
        pageIndex: dim.page,
        timestamp: Date.now(),
        validated: false,
        addedToEstimate: false,
        comments: `Extracted from PDF: ${dim.text} (${dim.unit})`,
      };

      dispatch({ type: 'ADD_MEASUREMENT', payload: measurement });
    });

    if (dimensions.length > 0) {
      toast.success(`Added ${dimensions.length} AI-extracted dimensions`);
    }
  }, [dispatch]);

  const handleTablesExtracted = useCallback((tables: ExtractedTable[]) => {
    setExtractedTables(tables);
    // Tables can be used for BOQ import
  }, []);

  const handleTextExtracted = useCallback((text: string) => {
    // Text can be used for drawing title detection, notes, etc.
    console.log('Extracted text:', text.substring(0, 200));
  }, []);

  const handleRoomAreasImported = useCallback((areas: RoomArea[]) => {
    areas.forEach((area) => {
      const measurement: Measurement = {
        id: crypto.randomUUID(),
        type: 'rectangle',
        worldPoints: [],
        worldValue: 0,
        realValue: area.area_m2,
        unit: 'm²',
        label: area.name,
        color: '#6366f1',
        pageIndex: area.page,
        timestamp: new Date(),
        validated: false,
        addedToEstimate: false,
        measurementType: 'Floor',
        comments: `Imported from plan text: ${area.name} ${area.area_m2} m²`,
      };
      dispatch({ type: 'ADD_MEASUREMENT', payload: measurement });
    });
  }, [dispatch]);

  const handleAddToEstimate = useCallback((measurementIds: string[]) => {
    let itemsCreated = 0;

    measurementIds.forEach(id => {
      const measurement = state.measurements.find(m => m.id === id);
      if (!measurement) return;

      // Calculate effective quantity and unit
      let quantity = measurement.realValue;
      let unit = measurement.unit;

      // Wall: calculate m² from LM × height
      if (measurement.measurementType === 'Wall' && measurement.height && measurement.unit === 'LM') {
        quantity = measurement.realValue * measurement.height;
        unit = 'M2';
      }

      // Concrete floor: calculate m³
      if (measurement.measurementType === 'Floor' && measurement.isConcreteFloor && measurement.concreteDepth) {
        quantity = measurement.realValue * measurement.concreteDepth;
        unit = 'M3';
      }

      // 1. Create main framing/structure item
      if (measurement.framingSystem && measurement.framingSystem !== 'none') {
        const framingLabels: Record<string, string> = {
          'steel_64': 'Steel Frame 64mm',
          'steel_92': 'Steel Frame 92mm',
          'timber_90_mgp12': 'Timber Frame 90mm MGP12',
          'timber_90_mgp10': 'Timber Frame 90mm MGP10',
        };

        // Auto-set trade based on framing type
        const isSteel = measurement.framingSystem.includes('steel');
        const trade = isSteel ? 'General' : 'Carpenter';

        // Framing is always measured in M2, regardless of concrete depth
        const framingQty = measurement.measurementType === 'Wall' && measurement.height && measurement.unit === 'LM'
          ? measurement.realValue * measurement.height
          : measurement.realValue;

        const framingItem: CostItem = {
          id: crypto.randomUUID(),
          category: 'Framing',
          name: framingLabels[measurement.framingSystem] || 'Framing',
          description: `${measurement.measurementType} framing - ${measurement.area || 'General'}`,
          unit: 'M2', // Framing is always M2
          unitCost: 0,
          quantity: framingQty,
          linkedMeasurements: [measurement.id],
          wasteFactor: 1.1,
          subtotal: 0,
          area: measurement.area,
          measurementType: measurement.measurementType,
          drawingNumber: measurement.drawingNumber || `Page ${measurement.pageIndex + 1}`,
          laborHours: measurement.labourHours,
          trade: trade,
          material: framingLabels[measurement.framingSystem],
        };
        dispatch({ type: 'ADD_COST_ITEM', payload: framingItem });
        itemsCreated++;
      }

      // 2. Create lining item if checked
      if (measurement.hasLining) {
        const liningLabels: Record<string, string> = {
          'pb_10': 'Plasterboard 10mm',
          'pb_13': 'Plasterboard 13mm',
          'fc_6': 'FC Cement 6mm',
          'fc_9': 'FC Cement 9mm',
          'custom': measurement.customLining || 'Custom Lining',
        };

        const liningName = liningLabels[measurement.liningType || ''] || 'Wall Lining';

        const liningItem: CostItem = {
          id: crypto.randomUUID(),
          category: 'Lining',
          name: liningName,
          description: `${measurement.measurementType} lining - ${measurement.area || 'General'}`,
          unit: 'M2',
          unitCost: 0,
          quantity: quantity, // Same m² as framing
          linkedMeasurements: [measurement.id],
          wasteFactor: 1.1,
          subtotal: 0,
          area: measurement.area,
          measurementType: measurement.measurementType,
          drawingNumber: measurement.drawingNumber || `Page ${measurement.pageIndex + 1}`,
          parentItemId: measurement.id,
          trade: 'Plasterer',
          material: liningName,
        };
        dispatch({ type: 'ADD_COST_ITEM', payload: liningItem });
        itemsCreated++;
      }

      // 3. Create insulation item if checked
      if (measurement.hasInsulation) {
        const insulationLabels: Record<string, string> = {
          'r2_batts': 'R2.0 Batts',
          'r25_batts': 'R2.5 Batts',
          'r3_batts': 'R3.0 Batts',
          'r4_batts': 'R4.0 Batts',
          'foam': 'Spray Foam',
          'reflective': 'Reflective Foil',
          'acoustic': 'Acoustic Batts',
          'custom': 'Custom Insulation',
        };

        const insulationName = insulationLabels[measurement.insulationType || ''] || 'Wall Insulation';

        const insulationItem: CostItem = {
          id: crypto.randomUUID(),
          category: 'Insulation',
          name: insulationName,
          description: `${measurement.measurementType} insulation - ${measurement.area || 'General'}`,
          unit: 'M2',
          unitCost: 0,
          quantity: quantity, // Same m² as framing
          linkedMeasurements: [measurement.id],
          wasteFactor: 1.05,
          subtotal: 0,
          area: measurement.area,
          measurementType: measurement.measurementType,
          drawingNumber: measurement.drawingNumber || `Page ${measurement.pageIndex + 1}`,
          parentItemId: measurement.id,
          trade: 'Insulation',
          material: insulationName,
        };
        dispatch({ type: 'ADD_COST_ITEM', payload: insulationItem });
        itemsCreated++;
      }

      // 4. If no framing but still a measurement, create generic item
      if (!measurement.framingSystem || measurement.framingSystem === 'none') {
        if (!measurement.hasLining && !measurement.hasInsulation) {
          // Auto-determine trade based on measurement type and area
          let autoTrade = 'General';
          let material = '';

          if (measurement.isConcreteFloor) {
            autoTrade = 'Concreter';
            const concreteLabels: Record<string, string> = {
              '20mpa': '20 MPa Concrete',
              '25mpa': '25 MPa Concrete',
              '32mpa': '32 MPa Concrete',
              '40mpa': '40 MPa Concrete',
            };
            material = concreteLabels[measurement.concreteType || ''] || 'Concrete';
          } else if (measurement.measurementType === 'Floor') {
            autoTrade = 'Tiler'; // Default for floor finishes
          } else if (measurement.measurementType === 'Ceiling') {
            autoTrade = 'Plasterer';
          } else if (measurement.area === 'Bathroom' || measurement.area === 'Ensuite' || measurement.area === 'Laundry') {
            autoTrade = 'Waterproofer';
          }

          const genericItem: CostItem = {
            id: crypto.randomUUID(),
            category: measurement.measurementType || 'General',
            name: measurement.label || `${measurement.measurementType || measurement.type} - ${measurement.area || 'General'}`,
            description: measurement.comments || `Measurement from takeoff`,
            unit: unit,
            unitCost: 0,
            quantity: quantity,
            linkedMeasurements: [measurement.id],
            wasteFactor: 1.0,
            subtotal: 0,
            area: measurement.area,
            measurementType: measurement.measurementType,
            drawingNumber: measurement.drawingNumber || `Page ${measurement.pageIndex + 1}`,
            laborHours: measurement.labourHours,
            trade: autoTrade,
            material: material || undefined,
          };
          dispatch({ type: 'ADD_COST_ITEM', payload: genericItem });
          itemsCreated++;
        }
      }

      // Mark measurement as added to estimate
      dispatch({
        type: 'UPDATE_MEASUREMENT',
        payload: { id: measurement.id, updates: { addedToEstimate: true, validated: true } }
      });
    });

    if (itemsCreated > 0) {
      toast.success(`${itemsCreated} cost item${itemsCreated !== 1 ? 's' : ''} added — continue validating or switch to Costs tab`);
    }
  }, [state.measurements, dispatch]);

  // ── Fullscreen portal ───────────────────────────────────────────────────────
  const fullscreenPortal = isTakeoffFullscreen && state.pdfFile ? createPortal(
    <div className="fixed inset-0 z-[9999] bg-[#0f172a] text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1e293b] border-b border-gray-700 shrink-0">
        <MeasurementToolbar
          activeTool={state.activeTool}
          onToolSelect={(tool) => dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool })}
          onUndo={() => dispatch({ type: 'UNDO' })}
          onRedo={() => dispatch({ type: 'REDO' })}
          canUndo={state.historyIndex > 0}
          canRedo={state.historyIndex < state.history.length - 1}
          disabled={!state.isCalibrated && state.activeTool !== 'pan'}
        />
        {/* Zoom + rotate + fit */}
        <div className="flex items-center gap-1 border-l border-gray-600 pl-2 ml-1">
          <Button variant="ghost" size="sm" onClick={handleZoomOut} className="h-8 text-gray-200 hover:bg-gray-700"><ZoomOut className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-14 text-center text-gray-200">{Math.round(state.transform.zoom * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={handleZoomIn} className="h-8 text-gray-200 hover:bg-gray-700"><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={handleRotate} className="h-8 text-gray-200 hover:bg-gray-700"><RotateCw className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={handleFitToScreen} className="h-8 text-gray-200 hover:bg-gray-700" title="Fit to screen"><Maximize2 className="h-4 w-4" /></Button>
        </div>
        {/* Scale popover */}
        <div className="border-l border-gray-600 pl-2 ml-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 gap-1.5 ${state.isCalibrated ? 'text-green-400 hover:bg-green-950/40' : 'text-amber-400 hover:bg-amber-950/40'}`}
                title="Scale calibration"
              >
                <Ruler className="h-3.5 w-3.5" />
                {state.isCalibrated ? (state.currentScale?.name ?? 'Calibrated') : 'Set Scale'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 z-[10000]" align="start">
              <ScalingCalibrator
                currentScale={state.currentScale}
                isCalibrated={state.isCalibrated}
                onScaleSet={(scale) => {
                  dispatch({ type: 'SET_SCALE', payload: { pageIndex: state.currentPageIndex, scale } });
                  toast.success('Scale set successfully');
                }}
                onManualCalibrationStart={() => {
                  dispatch({ type: 'SET_CALIBRATION_MODE', payload: 'manual' });
                  toast.info('Click two points on a known dimension');
                }}
                onManualCalibrationCancel={handleCalibrationCancel}
                onResetScale={handleResetScale}
                manualPoints={manualCalibrationPoints}
                onCalibrationComplete={() => {
                  setManualCalibrationPoints(null);
                  dispatch({ type: 'SET_CALIBRATION_MODE', payload: null });
                }}
                pdfViewport={pdfViewport}
              />
            </PopoverContent>
          </Popover>
        </div>
        {/* Page navigation */}
        {state.pdfFile.pageCount > 1 && (
          <div className="flex items-center gap-1 border-l border-gray-600 pl-2 ml-1">
            <Button variant="ghost" size="sm" onClick={handlePagePrevious} disabled={state.currentPageIndex === 0} className="h-8 text-gray-200 hover:bg-gray-700"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm text-gray-200 min-w-24 text-center">Page {state.currentPageIndex + 1} / {state.pdfFile.pageCount}</span>
            <Button variant="ghost" size="sm" onClick={handlePageNext} disabled={state.currentPageIndex === state.pdfFile.pageCount - 1} className="h-8 text-gray-200 hover:bg-gray-700"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
        <Button
          size="sm"
          onClick={() => setIsTakeoffFullscreen(false)}
          className="ml-auto bg-red-700 hover:bg-red-600 text-white"
        >
          <Minimize2 className="h-4 w-4 mr-1.5" />
          Exit Full Screen
        </Button>
      </div>

      {/* Canvas — full width, takes all remaining vertical space */}
      <div className="flex-1 overflow-hidden">
        <InteractiveCanvas
          pdfUrl={state.pdfFile.url}
          pageIndex={state.currentPageIndex}
          transform={state.transform}
          activeTool={state.activeTool}
          isCalibrated={state.isCalibrated}
          unitsPerMetre={state.currentScale?.unitsPerMetre || null}
          calibrationMode={state.calibrationMode}
          selectedColor={state.selectedColor}
          measurements={state.measurements.filter(m => m.pageIndex === state.currentPageIndex)}
          detectedOpenings={detectedOpenings}
          onMeasurementComplete={handleMeasurementComplete}
          onMeasurementUpdate={handleMeasurementUpdate}
          onCalibrationPointsSet={handleCalibrationPointsSet}
          onTransformChange={handleTransformChange}
          onViewportReady={handleViewportReady}
          onDeleteLastMeasurement={handleDeleteLastMeasurement}
          onDeleteMeasurement={handleDeleteMeasurement}
        />
      </div>

      {/* Bottom measurements panel */}
      <div className="h-72 bg-[#1e293b] border-t border-gray-700 flex flex-col shrink-0">
        <div className="px-3 py-1.5 border-b border-gray-700 flex items-center gap-3 shrink-0">
          <h3 className="font-semibold text-sm text-gray-100">Measurements ({filteredMeasurements.length})</h3>
          <Select
            value={String(pageFilter)}
            onValueChange={(val) => setPageFilter(val === 'all' ? 'all' : Number(val))}
          >
            <SelectTrigger className="w-28 h-6 text-xs border-gray-600 bg-gray-800 text-gray-200">
              <SelectValue placeholder="All pages" />
            </SelectTrigger>
            <SelectContent className="z-[10000]">
              <SelectItem value="all">All pages</SelectItem>
              {Array.from({ length: state.pageCount || 1 }).map((_, idx) => (
                <SelectItem key={idx} value={String(idx)}>Page {idx + 1}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-hidden p-2">
          {filteredMeasurements.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No measurements yet. Use the tools above to start measuring.</p>
          ) : (
            <TakeoffTable
              inline
              measurements={filteredMeasurements}
              onUpdateMeasurement={(id, updates) => dispatch({ type: 'UPDATE_MEASUREMENT', payload: { id, updates } })}
              onDeleteMeasurement={(id) => dispatch({ type: 'DELETE_MEASUREMENT', payload: id })}
              onAddToEstimate={handleAddToEstimate}
              onFetchNCCCode={handleFetchNCCCode}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <>
    {fullscreenPortal}
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="upload">1. Upload Plan</TabsTrigger>
            <TabsTrigger value="measure" disabled={!state.pdfFile}>2. Measure</TabsTrigger>
            <TabsTrigger value="costs" disabled={!state.measurements.length}>3. Costs</TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProfileDialog(true)}
            className="gap-1.5 text-xs h-8"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {appProfile.projectType.charAt(0).toUpperCase() + appProfile.projectType.slice(1)}
          </Button>
        </div>

        <TabsContent value="upload" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <PDFUploadManager
                projectId={projectId}
                onUploadComplete={(pdfFile) => {
                  dispatch({ type: 'SET_PDF_FILE', payload: pdfFile });
                  if (pdfFile.file) setUploadedFile(pdfFile.file);
                }}
                onError={(error) => {
                  dispatch({ type: 'SET_UPLOAD_ERROR', payload: error });
                  toast.error(error);
                }}
              />
            </div>
            <div className="lg:col-span-1 space-y-4">
              <AIExtractionPanel
                pdfFile={uploadedFile}
                pdfUrl={state.pdfFile?.url || null}
                currentPage={state.currentPageIndex}
                onDimensionsExtracted={handleDimensionsExtracted}
                onTablesExtracted={handleTablesExtracted}
                onTextExtracted={handleTextExtracted}
                onRoomAreasImported={handleRoomAreasImported}
              />
              <MaterialExtractorPanel
                pdfUrl={state.pdfFile?.url || null}
                pageCount={state.pdfFile?.pageCount || 1}
                projectName={state.pdfFile?.name?.replace(/\.pdf$/i, '') || undefined}
                onImport={(measurements) => {
                  measurements.forEach((m) =>
                    dispatch({ type: 'ADD_MEASUREMENT', payload: m })
                  );
                }}
              />
              <PlanIntelligencePanel
                pdfUrl={state.pdfFile?.url || null}
                pageCount={state.pdfFile?.pageCount || 1}
                projectName={state.pdfFile?.name?.replace(/\.pdf$/i, '') || undefined}
              />
              {state.pdfFile && (
                <DetectionResultsPanel
                  pdfUrl={state.pdfFile.url}
                  totalPages={state.pdfFile.pageCount}
                  onJumpToPage={(pageIndex) => {
                    dispatch({ type: 'SET_CURRENT_PAGE', payload: pageIndex });
                    setActiveTab('measure');
                  }}
                  onScanComplete={setDetectedOpenings}
                />
              )}
            </div>
          </div>
          {state.pdfFile && (
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setActiveTab('measure')}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Plan uploaded — Start Measuring
                <span className="ml-2">→</span>
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="measure" className="space-y-4">
          {/* Plan info bar */}
          {state.pdfFile && (
            <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border rounded-lg text-sm">
              <span className="text-muted-foreground truncate max-w-xs">
                <span className="font-medium text-foreground">Plan:</span> {state.pdfFile.name}
                {state.pdfFile.pageCount > 1 && ` (${state.pdfFile.pageCount} pages)`}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 ml-2"
                onClick={() => setActiveTab('upload')}
              >
                Change Plan
              </Button>
            </div>
          )}
          {state.pdfFile && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Center - Canvas (3 cols) */}
              <div className="lg:col-span-3 space-y-2">
                <MeasurementToolbar
                  activeTool={state.activeTool}
                  onToolSelect={(tool) => dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool })}
                  onUndo={() => dispatch({ type: 'UNDO' })}
                  onRedo={() => dispatch({ type: 'REDO' })}
                  canUndo={state.historyIndex > 0}
                  canRedo={state.historyIndex < state.history.length - 1}
                  disabled={!state.isCalibrated && state.activeTool !== 'pan'}
                />

                {/* Canvas Controls */}
                <div className="flex items-center gap-2 justify-between p-2 bg-card border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleZoomOut}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-16 text-center">
                      {Math.round(state.transform.zoom * 100)}%
                    </span>
                    <Button variant="outline" size="sm" onClick={handleZoomIn}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRotate}>
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleFitToScreen}>
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setIsTakeoffFullscreen(true)}
                      className="bg-primary text-primary-foreground ml-1"
                      title="Full screen takeoff (ESC to exit)"
                    >
                      <Maximize2 className="h-4 w-4 mr-1.5" />
                      Full Screen
                    </Button>
                  </div>

                  {/* Scale popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-8 gap-1.5 ${state.isCalibrated ? 'border-green-600 text-green-400' : 'border-amber-500 text-amber-400'}`}
                        title="Scale calibration"
                      >
                        <Ruler className="h-3.5 w-3.5" />
                        {state.isCalibrated ? (state.currentScale?.name ?? 'Calibrated') : 'Set Scale'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <ScalingCalibrator
                        currentScale={state.currentScale}
                        isCalibrated={state.isCalibrated}
                        onScaleSet={(scale) => {
                          dispatch({ type: 'SET_SCALE', payload: { pageIndex: state.currentPageIndex, scale } });
                          toast.success('Scale set successfully');
                        }}
                        onManualCalibrationStart={() => {
                          dispatch({ type: 'SET_CALIBRATION_MODE', payload: 'manual' });
                          toast.info('Click two points on a known dimension');
                        }}
                        onManualCalibrationCancel={handleCalibrationCancel}
                        onResetScale={handleResetScale}
                        manualPoints={manualCalibrationPoints}
                        onCalibrationComplete={() => {
                          setManualCalibrationPoints(null);
                          dispatch({ type: 'SET_CALIBRATION_MODE', payload: null });
                        }}
                        pdfViewport={pdfViewport}
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Page Navigation */}
                  {state.pdfFile && state.pdfFile.pageCount > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePagePrevious}
                        disabled={state.currentPageIndex === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium">
                        Page {state.currentPageIndex + 1} / {state.pdfFile.pageCount}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePageNext}
                        disabled={state.currentPageIndex === state.pdfFile.pageCount - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="h-[calc(100vh-260px)] min-h-[500px]" ref={canvasContainerRef}>
                  <InteractiveCanvas
                    pdfUrl={state.pdfFile.url}
                    pageIndex={state.currentPageIndex}
                    transform={state.transform}
                    activeTool={state.activeTool}
                    isCalibrated={state.isCalibrated}
                    unitsPerMetre={state.currentScale?.unitsPerMetre || null}
                    calibrationMode={state.calibrationMode}
                    selectedColor={state.selectedColor}
                    measurements={state.measurements.filter(m => m.pageIndex === state.currentPageIndex)}
                    detectedOpenings={detectedOpenings}
                    onMeasurementComplete={handleMeasurementComplete}
                    onMeasurementUpdate={handleMeasurementUpdate}
                    onCalibrationPointsSet={handleCalibrationPointsSet}
                    onTransformChange={handleTransformChange}
                    onViewportReady={handleViewportReady}
                    onDeleteLastMeasurement={handleDeleteLastMeasurement}
                    onDeleteMeasurement={handleDeleteMeasurement}
                  />
                </div>
              </div>

              {/* Right Sidebar - Measurements */}
              <div className="lg:col-span-1 space-y-4">
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Measurements</h3>
                    <Select
                      value={String(pageFilter)}
                      onValueChange={(val) => setPageFilter(val === 'all' ? 'all' : Number(val))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="All pages" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All pages</SelectItem>
                        {Array.from({ length: state.pageCount || 1 }).map((_, idx) => (
                          <SelectItem key={idx} value={String(idx)}>
                            Page {idx + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      size="sm"
                      onClick={() =>
                        downloadFile(
                          'measurements.csv',
                          ledgerToCsv(filteredMeasurements),
                          'text/csv'
                        )
                      }
                      disabled={!filteredMeasurements.length}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      size="sm"
                      onClick={() =>
                        downloadFile(
                          'measurements.json',
                          exportMeasurementsToJSON(filteredMeasurements),
                          'application/json'
                        )
                      }
                      disabled={!filteredMeasurements.length}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      JSON
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      size="sm"
                      onClick={() =>
                        generateTakeoffPdf({
                          projectName: state.pdfFile?.name?.replace(/\.pdf$/i, '') || 'Takeoff',
                          measurements: filteredMeasurements,
                        })
                      }
                      disabled={!filteredMeasurements.length}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>

                  <GroupLegend measurements={filteredMeasurements} />

                  {/* Takeoff Table Button - Opens detailed table sheet */}
                  <TakeoffTable
                    measurements={filteredMeasurements}
                    onUpdateMeasurement={(id, updates) =>
                      dispatch({ type: 'UPDATE_MEASUREMENT', payload: { id, updates } })
                    }
                    onDeleteMeasurement={(id) =>
                      dispatch({ type: 'DELETE_MEASUREMENT', payload: id })
                    }
                    onAddToEstimate={handleAddToEstimate}
                    onFetchNCCCode={handleFetchNCCCode}
                  />
                </Card>

                <Card className="p-4">
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {filteredMeasurements.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No measurements yet</p>
                    ) : (
                      filteredMeasurements.map((m) => {
                        const isSelected = sidebarSelectedIds.has(m.id);
                        return (
                          <div
                            key={m.id}
                            className={`p-3 border rounded-md space-y-2 transition-colors ${isSelected ? 'border-blue-500 bg-blue-950/20' : 'border-border/60 bg-muted/40'}`}
                          >
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    setSidebarSelectedIds(prev => {
                                      const next = new Set(prev);
                                      checked ? next.add(m.id) : next.delete(m.id);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="capitalize">{m.type}</span>
                              </div>
                              <span className="font-medium">Page {m.pageIndex + 1}</span>
                            </div>
                            <Input
                              value={m.label}
                              onChange={(e) =>
                                dispatch({
                                  type: 'UPDATE_MEASUREMENT',
                                  payload: { id: m.id, updates: { label: e.target.value } }
                                })
                              }
                              placeholder="Label"
                              className="h-8"
                            />
                            <Select
                              value={m.measurementType ?? ''}
                              onValueChange={(val) =>
                                dispatch({
                                  type: 'UPDATE_MEASUREMENT',
                                  payload: { id: m.id, updates: { measurementType: val as Measurement['measurementType'] } }
                                })
                              }
                            >
                              <SelectTrigger className="h-7 text-xs border-dashed">
                                <SelectValue placeholder="Type (wall, floor…)" />
                              </SelectTrigger>
                              <SelectContent>
                                {(['Wall','Floor','Ceiling','Tiling','Roofing','Cladding','Concrete Slab','Framing','Painting','Waterproofing','Insulation','Other'] as const).map(t => (
                                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold">{m.realValue.toFixed(2)}</span>
                              <Select
                                value={m.unit}
                                onValueChange={(unit: string) =>
                                  dispatch({
                                    type: 'UPDATE_MEASUREMENT',
                                    payload: { id: m.id, updates: { unit } }
                                  })
                                }
                              >
                                <SelectTrigger className="w-24 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {UNIT_GROUPS.map((group) => (
                                    <SelectGroup key={group}>
                                      <SelectLabel className="text-xs text-muted-foreground">{group}</SelectLabel>
                                      {TAKEOFF_UNITS.filter((u) => u.group === group).map((u) => (
                                        <SelectItem key={u.value} value={u.value} className="text-xs">
                                          {u.value}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="ml-auto flex items-center gap-2">
                                <span
                                  className="inline-flex h-3 w-3 rounded-full"
                                  style={{ backgroundColor: m.color }}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => dispatch({ type: 'DELETE_MEASUREMENT', payload: m.id })}
                                  aria-label="Delete measurement"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(m.timestamp).toLocaleString()}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {filteredMeasurements.length > 0 && (
                    <div className="mt-4 pt-3 border-t space-y-2 text-sm">
                      {sidebarSelectedIds.size >= 2 && (() => {
                        const selected = filteredMeasurements.filter(m => sidebarSelectedIds.has(m.id));
                        const units = [...new Set(selected.map(m => m.unit))];
                        const mixedUnits = units.length > 1;
                        const total = mixedUnits ? 0 : selected.reduce((s, m) => s + m.realValue, 0);
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            className={`w-full ${mixedUnits ? 'border-amber-400 text-amber-400 opacity-70 cursor-not-allowed' : 'border-blue-400 text-blue-400 hover:bg-blue-950/20'}`}
                            disabled={mixedUnits}
                            onClick={() => {
                              if (mixedUnits) return;
                              const [first, ...rest] = selected;
                              dispatch({
                                type: 'UPDATE_MEASUREMENT',
                                payload: {
                                  id: first.id,
                                  updates: {
                                    realValue: total,
                                    label: selected.map(m => m.label || m.type).filter(Boolean).join(' + ') || first.label,
                                  }
                                }
                              });
                              rest.forEach(m => dispatch({ type: 'DELETE_MEASUREMENT', payload: m.id }));
                              setSidebarSelectedIds(new Set());
                              toast.success(`Combined ${selected.length} measurements → ${total.toFixed(2)} ${units[0]}`);
                            }}
                          >
                            <Combine className="h-4 w-4 mr-2" />
                            {mixedUnits
                              ? `Mixed units (${units.join(' + ')}) — select same unit`
                              : `Combine ${sidebarSelectedIds.size} selected (${total.toFixed(2)} ${units[0]})`}
                          </Button>
                        );
                      })()}
                      <div className="flex justify-between">
                        <span>Total measurements</span>
                        <span className="font-semibold">{filteredMeasurements.length}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>LM: {totalsByUnit.LM.toFixed(2)}</span>
                        <span>M²: {totalsByUnit.M2.toFixed(2)}</span>
                        <span>M³: {totalsByUnit.M3.toFixed(2)}</span>
                        <span>Count: {totalsByUnit.count.toFixed(0)}</span>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
          {state.measurements.length > 0 && (
            <div className="flex items-center justify-between pt-2 px-1">
              <span className="text-sm text-muted-foreground">
                {state.measurements.length} measurement{state.measurements.length !== 1 ? "s" : ""} recorded
              </span>
              <Button
                onClick={() => setActiveTab('costs')}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Done Measuring — Go to Costs
                <span className="ml-2">→</span>
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="costs">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('measure')}>
                ← Back to Measure
              </Button>
              <Button
                size="sm"
                onClick={() => setShowSOWDialog(true)}
                disabled={state.costItems.length === 0}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Generate SOW PDF
              </Button>
            </div>
            <CostEstimator
              projectId={projectId}
              measurements={state.measurements}
              costItems={state.costItems}
              enabledTrades={appProfile.enabledTrades}
              onAddCostItem={(item) => dispatch({ type: 'ADD_COST_ITEM', payload: item })}
              onUpdateCostItem={(id, updates) => dispatch({ type: 'UPDATE_COST_ITEM', payload: { id, updates } })}
              onDeleteCostItem={(id) => dispatch({ type: 'DELETE_COST_ITEM', payload: id })}
              onLinkMeasurement={(measurementId, costItemId) => {
                dispatch({ type: 'UPDATE_MEASUREMENT', payload: { id: measurementId, updates: { linkedCostItem: costItemId } } });
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      <SOWGeneratorDialog
        open={showSOWDialog}
        onOpenChange={setShowSOWDialog}
        costItems={state.costItems}
        defaultProjectName={state.pdfFile?.name?.replace(/\.pdf$/i, '') || ''}
      />

      <ProfileConfigDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        profile={appProfile}
        onSave={setAppProfile}
      />
    </div>
    </>
  );
};
