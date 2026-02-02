// Scale Calibration System for PDF Measurement
// Allows users to calibrate scale by setting a known dimension

export interface CalibrationPoint {
  x: number;  // Percentage of canvas width (0-100)
  y: number;  // Percentage of canvas height (0-100)
}

export interface ScaleCalibration {
  id: string;
  pageNumber: number;
  point1: CalibrationPoint;
  point2: CalibrationPoint;
  pixelDistance: number;      // Distance in pixels on canvas
  realDistance: number;       // Real-world distance
  unit: 'mm' | 'm' | 'ft' | 'in';
  pixelsPerUnit: number;      // Calculated: pixelDistance / realDistance (converted to mm)
  scale: string;              // e.g., "1:100"
  createdAt: Date;
}

export interface MeasuredArea {
  id: string;
  name: string;
  pageNumber: number;
  points: CalibrationPoint[];  // Polygon points
  areaPixels: number;          // Area in pixels squared
  areaReal: number;            // Area in real units (m²)
  perimeter: number;           // Perimeter in real units (m)
  calibrationId: string;       // Reference to calibration used
}

export interface MeasuredLine {
  id: string;
  name: string;
  pageNumber: number;
  point1: CalibrationPoint;
  point2: CalibrationPoint;
  lengthPixels: number;
  lengthReal: number;          // Length in real units (m)
  calibrationId: string;
}

// Unit conversion to millimeters (base unit)
const UNIT_TO_MM: Record<string, number> = {
  'mm': 1,
  'm': 1000,
  'ft': 304.8,
  'in': 25.4,
};

/**
 * Calculate distance between two points
 */
export function calculatePixelDistance(
  p1: CalibrationPoint,
  p2: CalibrationPoint,
  canvasWidth: number,
  canvasHeight: number
): number {
  const x1 = (p1.x / 100) * canvasWidth;
  const y1 = (p1.y / 100) * canvasHeight;
  const x2 = (p2.x / 100) * canvasWidth;
  const y2 = (p2.y / 100) * canvasHeight;

  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Create a scale calibration from two points and a known distance
 */
export function createCalibration(
  pageNumber: number,
  point1: CalibrationPoint,
  point2: CalibrationPoint,
  realDistance: number,
  unit: ScaleCalibration['unit'],
  canvasWidth: number,
  canvasHeight: number
): ScaleCalibration {
  const pixelDistance = calculatePixelDistance(point1, point2, canvasWidth, canvasHeight);
  const realDistanceMm = realDistance * UNIT_TO_MM[unit];
  const pixelsPerMm = pixelDistance / realDistanceMm;

  // Calculate approximate scale (e.g., 1:100)
  // Assuming A1 drawing at 841mm width rendered at ~1000px
  const pdfPointsPerMm = 72 / 25.4; // 72 DPI = ~2.83 points per mm
  const scaleRatio = Math.round(1 / (pixelsPerMm * pdfPointsPerMm / 72));
  const scale = `1:${scaleRatio}`;

  return {
    id: `cal-${Date.now()}`,
    pageNumber,
    point1,
    point2,
    pixelDistance,
    realDistance,
    unit,
    pixelsPerUnit: pixelsPerMm * 1000, // pixels per meter
    scale,
    createdAt: new Date(),
  };
}

/**
 * Calculate area of a polygon using Shoelace formula
 */
export function calculatePolygonArea(
  points: CalibrationPoint[],
  canvasWidth: number,
  canvasHeight: number
): number {
  if (points.length < 3) return 0;

  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x1 = (points[i].x / 100) * canvasWidth;
    const y1 = (points[i].y / 100) * canvasHeight;
    const x2 = (points[j].x / 100) * canvasWidth;
    const y2 = (points[j].y / 100) * canvasHeight;

    area += x1 * y2;
    area -= x2 * y1;
  }

  return Math.abs(area) / 2;
}

/**
 * Calculate perimeter of a polygon
 */
export function calculatePolygonPerimeter(
  points: CalibrationPoint[],
  canvasWidth: number,
  canvasHeight: number
): number {
  if (points.length < 2) return 0;

  let perimeter = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += calculatePixelDistance(points[i], points[j], canvasWidth, canvasHeight);
  }

  return perimeter;
}

/**
 * Convert pixel measurement to real-world units using calibration
 */
export function pixelsToReal(
  pixels: number,
  calibration: ScaleCalibration,
  outputUnit: 'mm' | 'm' | 'ft' = 'm'
): number {
  const mm = pixels / (calibration.pixelsPerUnit / 1000);
  return mm / UNIT_TO_MM[outputUnit];
}

/**
 * Convert pixel area to real-world area
 */
export function pixelAreaToReal(
  pixelArea: number,
  calibration: ScaleCalibration,
  outputUnit: 'm2' | 'ft2' = 'm2'
): number {
  const mmPerPixel = 1 / (calibration.pixelsPerUnit / 1000);
  const mm2 = pixelArea * (mmPerPixel ** 2);

  if (outputUnit === 'm2') {
    return mm2 / 1000000; // mm² to m²
  } else {
    return mm2 / (304.8 ** 2); // mm² to ft²
  }
}

/**
 * Create a measured area from polygon points
 */
export function createMeasuredArea(
  name: string,
  pageNumber: number,
  points: CalibrationPoint[],
  calibration: ScaleCalibration,
  canvasWidth: number,
  canvasHeight: number
): MeasuredArea {
  const areaPixels = calculatePolygonArea(points, canvasWidth, canvasHeight);
  const perimeterPixels = calculatePolygonPerimeter(points, canvasWidth, canvasHeight);

  return {
    id: `area-${Date.now()}`,
    name,
    pageNumber,
    points,
    areaPixels,
    areaReal: pixelAreaToReal(areaPixels, calibration),
    perimeter: pixelsToReal(perimeterPixels, calibration),
    calibrationId: calibration.id,
  };
}

/**
 * Create a measured line
 */
export function createMeasuredLine(
  name: string,
  pageNumber: number,
  point1: CalibrationPoint,
  point2: CalibrationPoint,
  calibration: ScaleCalibration,
  canvasWidth: number,
  canvasHeight: number
): MeasuredLine {
  const lengthPixels = calculatePixelDistance(point1, point2, canvasWidth, canvasHeight);

  return {
    id: `line-${Date.now()}`,
    name,
    pageNumber,
    point1,
    point2,
    lengthPixels,
    lengthReal: pixelsToReal(lengthPixels, calibration),
    calibrationId: calibration.id,
  };
}

/**
 * Extract scale from PDF text (e.g., "1:100", "Scale: 1:50")
 */
export function extractScaleFromText(texts: string[]): { scale: string; ratio: number } | null {
  const scalePatterns = [
    /scale\s*:?\s*(1\s*:\s*\d+)/i,
    /\b(1\s*:\s*\d+)\b/,
    /at\s+(1\s*:\s*\d+)/i,
  ];

  for (const text of texts) {
    for (const pattern of scalePatterns) {
      const match = text.match(pattern);
      if (match) {
        const scale = match[1].replace(/\s/g, '');
        const ratio = parseInt(scale.split(':')[1]);
        if (ratio >= 1 && ratio <= 1000) {
          return { scale, ratio };
        }
      }
    }
  }

  return null;
}

/**
 * Estimate calibration from extracted scale and page dimensions
 */
export function estimateCalibrationFromScale(
  scaleRatio: number,
  pageWidthPx: number,
  pageHeightPx: number,
  assumedPaperSize: 'A1' | 'A2' | 'A3' | 'A4' = 'A1'
): ScaleCalibration {
  // Paper sizes in mm
  const paperSizes = {
    'A1': { width: 841, height: 594 },
    'A2': { width: 594, height: 420 },
    'A3': { width: 420, height: 297 },
    'A4': { width: 297, height: 210 },
  };

  const paper = paperSizes[assumedPaperSize];

  // At scale 1:100, 1mm on paper = 100mm real
  // So paper width in real = paper.width * scaleRatio
  const realWidthMm = paper.width * scaleRatio;
  const pixelsPerMm = pageWidthPx / realWidthMm;

  return {
    id: `cal-auto-${Date.now()}`,
    pageNumber: 1,
    point1: { x: 0, y: 50 },
    point2: { x: 100, y: 50 },
    pixelDistance: pageWidthPx,
    realDistance: realWidthMm / 1000, // in meters
    unit: 'm',
    pixelsPerUnit: pixelsPerMm * 1000,
    scale: `1:${scaleRatio}`,
    createdAt: new Date(),
  };
}

// Default calibrations for common scales (based on A1 paper at 1000px width)
export const DEFAULT_CALIBRATIONS: Record<string, { pixelsPerMeter: number; description: string }> = {
  '1:50': { pixelsPerMeter: 23.8, description: 'Detail drawings' },
  '1:100': { pixelsPerMeter: 11.9, description: 'Floor plans' },
  '1:200': { pixelsPerMeter: 5.95, description: 'Site plans' },
  '1:500': { pixelsPerMeter: 2.38, description: 'Large site plans' },
};
