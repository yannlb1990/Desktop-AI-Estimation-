// Core TypeScript interfaces for PDF Takeoff system with unified coordinate system

// === COORDINATE TYPES ===
// World coordinates = PDF page coordinates (stable, zoom-independent, stored)
export interface WorldPoint {
  x: number;  // PDF points (1 point = 1/72 inch)
  y: number;
}

// View coordinates = Canvas pixel coordinates (transient, for rendering only)
export interface ViewPoint {
  x: number;
  y: number;
}

// Legacy Point type for backward compatibility
export interface Point {
  x: number;
  y: number;
}

// === TRANSFORM STATE ===
export interface Transform {
  zoom: number;
  panX: number;
  panY: number;
  rotation: 0 | 90 | 180 | 270;
}

// === PDF METADATA ===
export interface PDFPageMeta {
  pageNumber: number;
  width: number;      // PDF points
  height: number;     // PDF points
  rotation: 0 | 90 | 180 | 270;
}

export interface PDFViewportData {
  width: number;   // PDF points
  height: number;  // PDF points
  scale: number;
}

// === MEASUREMENT TYPES ===
export type MeasurementType = 'line' | 'rectangle' | 'polygon' | 'circle';
export type MeasurementUnit = 'LM' | 'M2' | 'M3' | 'count';
export type ToolType = 'select' | 'pan' | 'eraser' | 'line' | 'rectangle' | 'polygon' | 'circle' | 'count' | null;

// Area options for measurements
export type MeasurementArea = 'Kitchen' | 'Bathroom' | 'Bedroom' | 'Living Room' | 'Dining Room' | 'Laundry' | 'Garage' | 'Patio' | 'Balcony' | 'Hallway' | 'Entry' | 'Office' | 'Storage' | 'Utility' | 'Ensuite' | 'WC' | 'External' | 'Other';

// Material categories
export const MATERIAL_CATEGORIES = {
  Flooring: ['Tiles', 'Timber', 'Carpet', 'Vinyl', 'Concrete', 'Epoxy'],
  Walls: ['Plasterboard', 'Render', 'Paint', 'Tiles', 'Cladding', 'Brick'],
  Ceiling: ['Plasterboard', 'Acoustic Tiles', 'Exposed', 'Bulkhead'],
  Waterproofing: ['Membrane', 'Sealant', 'Tanking'],
  Insulation: ['Batts', 'Foam', 'Reflective'],
  Structural: ['Steel', 'Timber Frame', 'Concrete', 'Block'],
} as const;

// Enhanced measurement with additional fields
export interface EnhancedMeasurement extends Measurement {
  area?: MeasurementArea;
  materials?: string[];
  nccCode?: string;
  validated?: boolean;
  addedToEstimate?: boolean;
}
export type CalibrationMode = 'preset' | 'manual' | null;
export type DistanceUnit = 'm' | 'mm' | 'cm' | 'ft' | 'in';

// === SCALE DATA (World Units) ===
export interface ScaleData {
  unitsPerMetre: number;    // World units (PDF points) per real metre
  scaleFactor: number | null;
  scaleMethod: 'preset' | 'manual';
  drawingAreaPercent?: number;  // For preset scale - accounts for title blocks/borders (0.6-1.0)
  calibrationLine?: {
    p1: WorldPoint;
    p2: WorldPoint;
    worldDistance: number;  // Distance in PDF points
    realDistance: number;   // Distance in metres
  };
}

// === MEASUREMENT (World Coordinates) ===
export interface Measurement {
  id: string;
  type: MeasurementType;
  worldPoints: WorldPoint[];   // Stored in world space (stable, zoom-independent)
  worldValue: number;          // Value in PDF points or points²
  realValue: number;           // Value in metres or m²
  unit: MeasurementUnit;
  color: string;
  label: string;
  dimensions?: { width: number; height: number };
  roofPitch?: { rise: number; run: number };
  depth?: number;
  linkedCostItem?: string;
  pageIndex: number;
  timestamp: Date;
}

// === COST ITEM ===
export interface CostItem {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: MeasurementUnit;
  unitCost: number;
  quantity: number;
  linkedMeasurements: string[];
  laborHours?: number;
  wasteFactor: number;
  supplierCode?: string;
  notes?: string;
  subtotal: number;
}

// === PDF FILE ===
export interface PDFFile {
  file: File;
  url: string;
  name: string;
  pageCount: number;
}

// === PDF STATE ===
export interface PDFState {
  uploadedFile: File | null;
  fileUrl: string | null;
  fileName: string;
  pages: PDFPageMeta[];
  currentPageIndex: number;
  loadingStatus: 'idle' | 'loading' | 'success' | 'error';
  errorMessage?: string;
}

// === TAKEOFF STATE ===
export interface TakeoffState {
  // PDF state
  pdfFile: PDFFile | null;
  uploadStatus: 'idle' | 'loading' | 'success' | 'error';
  uploadError: string | null;
  
  // Page state
  currentPageIndex: number;
  pageCount: number;
  
  // Transform state (view-only, doesn't affect measurements)
  transform: Transform;
  
  // Scaling state (Record for JSON serialization, not Map)
  scales: Record<number, ScaleData>;
  currentScale: ScaleData | null;
  isCalibrated: boolean;
  calibrationMode: CalibrationMode;
  
  // Measurement state (stored in world coordinates)
  activeTool: ToolType;
  measurements: Measurement[];
  selectedMeasurementId: string | null;
  currentMeasurement: {
    worldPoints: WorldPoint[];
    isComplete: boolean;
  } | null;
  
  // Cost state
  costItems: CostItem[];
  selectedCostItemId: string | null;
  
  // Estimate totals
  estimate: {
    materials: number;
    labor: number;
    subtotal: number;
    markup: number;
    total: number;
  };
  
  // UI state
  roofPitch: { rise: number; run: number };
  depthInput: number;
  selectedColor: string;
  
  // History for undo/redo
  history: Measurement[][];
  historyIndex: number;
}

// === ACTIONS ===
export type TakeoffAction =
  | { type: 'SET_PDF_FILE'; payload: PDFFile }
  | { type: 'SET_UPLOAD_STATUS'; payload: TakeoffState['uploadStatus'] }
  | { type: 'SET_UPLOAD_ERROR'; payload: string }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'SET_SCALE'; payload: { pageIndex: number; scale: ScaleData } }
  | { type: 'RESET_SCALE'; payload: number }
  | { type: 'SET_CALIBRATION_MODE'; payload: CalibrationMode }
  | { type: 'SET_TRANSFORM'; payload: Partial<Transform> }
  | { type: 'SET_ACTIVE_TOOL'; payload: ToolType }
  | { type: 'ADD_MEASUREMENT'; payload: Measurement }
  | { type: 'UPDATE_MEASUREMENT'; payload: { id: string; updates: Partial<Measurement> } }
  | { type: 'DELETE_MEASUREMENT'; payload: string }
  | { type: 'SELECT_MEASUREMENT'; payload: string | null }
  | { type: 'SET_CURRENT_MEASUREMENT'; payload: TakeoffState['currentMeasurement'] }
  | { type: 'ADD_COST_ITEM'; payload: CostItem }
  | { type: 'UPDATE_COST_ITEM'; payload: { id: string; updates: Partial<CostItem> } }
  | { type: 'DELETE_COST_ITEM'; payload: string }
  | { type: 'LINK_MEASUREMENT_TO_COST'; payload: { measurementId: string; costItemId: string } }
  | { type: 'SET_ROOF_PITCH'; payload: { rise: number; run: number } }
  | { type: 'SET_DEPTH_INPUT'; payload: number }
  | { type: 'SET_SELECTED_COLOR'; payload: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'DELETE_LAST_MEASUREMENT' }
  | { type: 'CALCULATE_ESTIMATE' };
