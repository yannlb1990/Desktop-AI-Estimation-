// Pure calculation functions for PDF Takeoff measurements in world coordinates

import { WorldPoint, ScaleData, DistanceUnit, Measurement } from './types';

/**
 * Calculate scale from preset ratio using PDF page dimensions
 * @param presetScale - Scale string like "1:100"
 * @param pageWidthPoints - Full PDF page width in points
 * @param drawingAreaPercent - Percentage of page that is actual drawing (0.6-1.0), accounting for title blocks/borders
 */
export function calculatePresetScaleWorld(
  presetScale: string,
  pageWidthPoints: number,
  drawingAreaPercent: number = 0.85 // Default 85% - typical for A1/A3 architectural plans
): ScaleData {
  const ratio = parseInt(presetScale.split(':')[1], 10);
  
  // PDF points to mm: 1 point = 1/72 inch = 25.4/72 mm
  const mmPerPoint = 25.4 / 72;
  
  // Adjust for title blocks and borders - only the drawing area counts
  const effectiveWidth = pageWidthPoints * Math.max(0.6, Math.min(1.0, drawingAreaPercent));
  const pageWidthMM = effectiveWidth * mmPerPoint;
  const pageWidthMetres = pageWidthMM / 1000;
  
  // At scale 1:ratio, real width = page width × ratio
  const impliedRealWidth = pageWidthMetres * ratio;
  
  // World units (points) per real metre
  const unitsPerMetre = effectiveWidth / impliedRealWidth;
  
  return {
    unitsPerMetre,
    scaleFactor: ratio,
    scaleMethod: 'preset',
    drawingAreaPercent,
  };
}

/**
 * Calculate scale from manual two-point calibration in WORLD coordinates
 */
export function calculateManualScaleWorld(
  p1: WorldPoint,
  p2: WorldPoint,
  realWorldDistance: number,
  unit: DistanceUnit = 'm'
): ScaleData {
  // Distance in world units (PDF points)
  const worldDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);

  // Convert input distance to metres
  let distanceMetres: number;
  switch (unit) {
    case 'mm': distanceMetres = realWorldDistance / 1000; break;
    case 'cm': distanceMetres = realWorldDistance / 100; break;
    case 'ft': distanceMetres = realWorldDistance * 0.3048; break;
    case 'in': distanceMetres = realWorldDistance * 0.0254; break;
    default:   distanceMetres = realWorldDistance; break;
  }

  // World units (points) per metre
  const unitsPerMetre = worldDistance / distanceMetres;

  return {
    unitsPerMetre,
    scaleFactor: null,
    scaleMethod: 'manual',
    calibrationLine: { 
      p1, 
      p2, 
      worldDistance,
      realDistance: distanceMetres
    },
  };
}

/**
 * Calculate linear measurement in world space
 */
export function calculateLinearWorld(
  p1: WorldPoint,
  p2: WorldPoint,
  unitsPerMetre: number
): { worldValue: number; realValue: number; unit: 'LM' } {
  const worldDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const realMetres = worldDistance / unitsPerMetre;
  
  return {
    worldValue: worldDistance,
    realValue: realMetres,
    unit: 'LM',
  };
}

/**
 * Calculate rectangle area in world space
 */
export function calculateRectangleAreaWorld(
  p1: WorldPoint,
  p2: WorldPoint,
  unitsPerMetre: number
): { worldValue: number; realValue: number; unit: 'M2'; dimensions: { width: number; height: number } } {
  const width = Math.abs(p2.x - p1.x);
  const height = Math.abs(p2.y - p1.y);
  const worldArea = width * height;
  const realArea = worldArea / (unitsPerMetre * unitsPerMetre);
  
  return {
    worldValue: worldArea,
    realValue: realArea,
    unit: 'M2',
    dimensions: {
      width: width / unitsPerMetre,
      height: height / unitsPerMetre,
    },
  };
}

/**
 * Calculate polygon area in world space (shoelace formula)
 */
export function calculatePolygonAreaWorld(
  points: WorldPoint[],
  unitsPerMetre: number
): { worldValue: number; realValue: number; unit: 'M2' } {
  if (points.length < 3) {
    return { worldValue: 0, realValue: 0, unit: 'M2' };
  }

  // Shoelace formula for polygon area
  let worldArea = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    worldArea += points[i].x * points[j].y;
    worldArea -= points[j].x * points[i].y;
  }
  worldArea = Math.abs(worldArea / 2);

  const realArea = worldArea / (unitsPerMetre * unitsPerMetre);
  
  return {
    worldValue: worldArea,
    realValue: realArea,
    unit: 'M2',
  };
}

/**
 * Calculate circle area in world space
 */
export function calculateCircleAreaWorld(
  center: WorldPoint,
  edgePoint: WorldPoint,
  unitsPerMetre: number
): { worldValue: number; realValue: number; radiusMetres: number; unit: 'M2' } {
  const radiusWorld = Math.hypot(edgePoint.x - center.x, edgePoint.y - center.y);
  const radiusMetres = radiusWorld / unitsPerMetre;
  const realArea = Math.PI * radiusMetres * radiusMetres;
  
  return {
    worldValue: Math.PI * radiusWorld * radiusWorld,
    realValue: realArea,
    radiusMetres,
    unit: 'M2',
  };
}

/**
 * Calculate sloped roof area (accounts for pitch)
 */
export function calculateSlopedArea(
  baseArea: number,
  roofPitch: { rise: number; run: number }
): number {
  const slopeFactor = Math.sqrt(
    Math.pow(roofPitch.run, 2) + 
    Math.pow(roofPitch.rise, 2)
  ) / roofPitch.run;
  
  return baseArea * slopeFactor;
}

/**
 * Calculate volume from area and depth
 */
export function calculateVolumeWorld(
  areaM2: number,
  depthMetres: number
): { realValue: number; unit: 'M3' } {
  if (depthMetres <= 0) {
    throw new Error('Depth must be positive for volume calculations');
  }
  return {
    realValue: areaM2 * depthMetres,
    unit: 'M3',
  };
}

/**
 * Calculate centroid in world coordinates (for label placement)
 */
export function calculateCentroidWorld(points: WorldPoint[]): WorldPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  
  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

/**
 * Aggregate measurements by unit type
 */
export function aggregateMeasurements(
  measurements: Measurement[],
  unit: 'LM' | 'M2' | 'M3' | 'count'
): number {
  return measurements
    .filter(m => m.unit === unit)
    .reduce((total, m) => total + m.realValue, 0);
}

/**
 * Check if a world point is near another world point (for polygon closure detection)
 */
export function isWorldPointNear(
  point1: WorldPoint,
  point2: WorldPoint,
  thresholdInUnits: number = 20
): boolean {
  const distance = Math.hypot(point2.x - point1.x, point2.y - point1.y);
  return distance < thresholdInUnits;
}

/**
 * Snap world point to grid
 */
export function snapWorldToGrid(point: WorldPoint, gridSize: number): WorldPoint {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}
