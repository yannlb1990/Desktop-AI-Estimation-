import { Measurement, WorldPoint } from './types';

export type FrameMaterial = 'timber' | 'steel';
export type StudSpacing = 300 | 450 | 600;
export type CeilingHeight = 2400 | 2440 | 2700 | 3000;
export type TimberSize = '90x35' | '90x45' | '140x45' | '70x35';
export type SteelSize = '64mm' | '76mm' | '92mm';

export interface FrameSettings {
  material: FrameMaterial;
  studSpacingMm: StudSpacing;
  ceilingHeightMm: CeilingHeight;
  timberSize: TimberSize;
  steelSize: SteelSize;
  doubleTopPlate: boolean;
}

export const DEFAULT_FRAME_SETTINGS: FrameSettings = {
  material: 'timber',
  studSpacingMm: 600,
  ceilingHeightMm: 2440,
  timberSize: '90x35',
  steelSize: '92mm',
  doubleTopPlate: true,
};

export interface SectionBOM {
  count: number;         // number of wall runs
  lengthM: number;       // total linear metres
  studs: number;
  bottomPlateLM: number;
  topPlateLM: number;
  rakingPlateLM: number; // angled top plate at roof pitch (external walls with hasRakingPlate only)
  noggingRows: number;   // rows per wall (1 or 2 depending on ceiling height)
  noggings: number;      // total count
}

export interface JunctionAnalysis {
  externalCorners: number;  // L-corner between 2 external walls → +3 studs each
  internalCorners: number;  // L-corner involving ≥1 internal wall → +2 studs each
  tJunctions: number;       // T-junction (endpoint hits middle of another wall) → +2 studs each
  totalExtraStuds: number;
}

export interface FramingFixings {
  // Timber
  nails90mm?: number;    // stud-to-plate (4 per stud)
  nails75mm?: number;    // noggings (3 per nogging)
  anchorBolts?: number;  // slab anchor bolts (1 per 1800mm per AS1684)
  // Steel
  tekScrews?: number;    // 4 flanges × 2 screws per stud
  trackAnchors?: number; // 1 per 1200mm of track
  lBrackets?: number;    // 2 per corner
}

export interface FramingBOM {
  external: SectionBOM;
  internal: SectionBOM;
  junctions: JunctionAnalysis;
  fixings: FramingFixings;
  totalStuds: number;    // studs + junction extra studs combined
}

// ── Wall segment extracted from Measurement ──────────────────────────────────

export interface WallSegment {
  id: string;
  label: string;
  lengthM: number;
  classification: 'external' | 'internal';
  hasRakingPlate: boolean;
  p1: WorldPoint;
  p2: WorldPoint;
}

export function extractWallSegments(measurements: Measurement[]): WallSegment[] {
  return measurements
    .filter(m => m.wallThickness !== undefined && m.worldPoints?.length >= 2 && m.realValue > 0)
    .map(m => ({
      id: m.id,
      label: m.label || `Wall ${m.id.slice(-4)}`,
      lengthM: m.realValue,
      classification: m.wallClassification ?? 'internal',
      hasRakingPlate: m.hasRakingPlate ?? false,
      p1: m.worldPoints[0],
      p2: m.worldPoints[1],
    }));
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

function ptDist(a: WorldPoint, b: WorldPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function pointToSegmentDist(p: WorldPoint, a: WorldPoint, b: WorldPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return ptDist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return ptDist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

// ── Junction detection ────────────────────────────────────────────────────────

export function detectJunctions(walls: WallSegment[], unitsPerMetre: number): JunctionAnalysis {
  // 50 mm tolerance in world units (PDF points)
  const threshold = 0.05 * unitsPerMetre;

  let externalCorners = 0;
  let internalCorners = 0;
  let tJunctions = 0;

  // For each pair of walls, check if they share an endpoint region
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const wa = walls[i];
      const wb = walls[j];

      const endptsA = [wa.p1, wa.p2];
      const endptsB = [wb.p1, wb.p2];

      let connected = false;
      let endpointToMiddle = false;

      for (const ea of endptsA) {
        for (const eb of endptsB) {
          if (ptDist(ea, eb) < threshold) {
            connected = true;
          }
        }
        // Check if endpoint of A lands on the body of B (T-junction)
        if (pointToSegmentDist(ea, wb.p1, wb.p2) < threshold) {
          const isEndpointOfB = ptDist(ea, wb.p1) < threshold || ptDist(ea, wb.p2) < threshold;
          if (!isEndpointOfB) endpointToMiddle = true;
        }
      }

      for (const eb of endptsB) {
        if (pointToSegmentDist(eb, wa.p1, wa.p2) < threshold) {
          const isEndpointOfA = ptDist(eb, wa.p1) < threshold || ptDist(eb, wa.p2) < threshold;
          if (!isEndpointOfA) endpointToMiddle = true;
        }
      }

      if (connected || endpointToMiddle) {
        if (endpointToMiddle) {
          tJunctions++;
        } else if (wa.classification === 'external' && wb.classification === 'external') {
          externalCorners++;
        } else {
          internalCorners++;
        }
      }
    }
  }

  const totalExtraStuds =
    externalCorners * 3 + internalCorners * 2 + tJunctions * 2;

  return { externalCorners, internalCorners, tJunctions, totalExtraStuds };
}

// ── Per-section BOM ───────────────────────────────────────────────────────────

function calcSection(
  walls: WallSegment[],
  settings: FrameSettings,
  isExternal: boolean,
): SectionBOM {
  const count = walls.length;
  const lengthM = walls.reduce((s, w) => s + w.lengthM, 0);
  const { studSpacingMm, ceilingHeightMm, doubleTopPlate } = settings;

  // Studs per run: CEIL(length / spacing) + 1 end stud
  const studs = walls.reduce(
    (s, w) => s + Math.ceil((w.lengthM * 1000) / studSpacingMm) + 1,
    0,
  );

  const bottomPlateLM = lengthM;

  // Double top plate when setting is on (user-controlled, default true for all walls)
  const topPlateLM = doubleTopPlate ? lengthM * 2 : lengthM;

  // Raking plate: only external walls explicitly marked (LM of those walls)
  const rakingPlateLM = isExternal
    ? walls.filter(w => w.hasRakingPlate).reduce((s, w) => s + w.lengthM, 0)
    : 0;

  // Noggings: 1 row ≤ 2700mm ceiling, 2 rows above
  const noggingRows = ceilingHeightMm > 2700 ? 2 : 1;
  const noggings = walls.reduce(
    (s, w) => s + Math.ceil((w.lengthM * 1000) / 1200) * noggingRows,
    0,
  );

  return { count, lengthM, studs, bottomPlateLM, topPlateLM, rakingPlateLM, noggingRows, noggings };
}

// ── Fixings cascade from material ─────────────────────────────────────────────

function calcFixings(
  bom: { external: SectionBOM; internal: SectionBOM; totalStuds: number },
  settings: FrameSettings,
): FramingFixings {
  const { material } = settings;
  const { external, internal, totalStuds } = bom;
  const totalLM = external.lengthM + internal.lengthM;
  const totalNoggings = external.noggings + internal.noggings;

  if (material === 'timber') {
    return {
      nails90mm: totalStuds * 4,
      nails75mm: totalNoggings * 3,
      anchorBolts: Math.ceil((totalLM * 1000) / 1800),
    };
  } else {
    return {
      tekScrews: totalStuds * 8,   // 4 flanges × 2 screws
      trackAnchors: Math.ceil((totalLM * 1000) / 1200),
      lBrackets: 0,  // updated after junction detection
    };
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function calculateFramingBOM(
  walls: WallSegment[],
  settings: FrameSettings,
  unitsPerMetre: number,
): FramingBOM {
  const externalWalls = walls.filter(w => w.classification === 'external');
  const internalWalls = walls.filter(w => w.classification === 'internal');

  const external = calcSection(externalWalls, settings, true);
  const internal = calcSection(internalWalls, settings, false);
  const junctions = detectJunctions(walls, unitsPerMetre);

  const totalStuds = external.studs + internal.studs + junctions.totalExtraStuds;

  const fixings = calcFixings({ external, internal, totalStuds }, settings);
  if (settings.material === 'steel') {
    fixings.lBrackets = (junctions.externalCorners + junctions.internalCorners) * 2;
  }

  return { external, internal, junctions, fixings, totalStuds };
}
