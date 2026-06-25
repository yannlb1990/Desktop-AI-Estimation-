import { Measurement, WorldPoint, WallOpening } from './types';

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
  lengthM: number;       // gross linear metres (before opening deductions)
  netLengthM: number;    // net linear metres after deducting openings
  studs: number;         // net stud count (includes trimmer/king additions, excludes studs in opening gaps)
  trimmerStuds: number;  // 2 per opening (short studs supporting lintel ends)
  bottomPlateLM: number; // plate LM — door widths deducted, window widths kept
  topPlateLM: number;
  rakingPlateLM: number;
  noggingRows: number;
  noggings: number;
  openingCount: number;  // total door + window openings
  lintels: { widthMm: number; lm: number }[];
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
  lintels: { widthMm: number; lm: number }[];  // all lintels from all sections
  totalLintelLM: number;
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
  openings: WallOpening[];
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
      openings: m.wallOpenings ?? [],
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

  // ── Opening deductions ────────────────────────────────────────────────────
  const allOpenings = walls.flatMap(w => w.openings);
  const openingCount = allOpenings.length;

  // Bottom plate: deduct door widths only (window sills stay)
  const doorDeductionM = allOpenings
    .filter(o => o.type === 'door')
    .reduce((s, o) => s + o.widthMm / 1000, 0);

  // Studs per run: CEIL(length / spacing) + 1 end stud
  // Per opening: remove studs that fall inside the opening gap, add 2 trimmers
  let studs = 0;
  let trimmerStuds = 0;
  walls.forEach(w => {
    const baseStuds = Math.ceil((w.lengthM * 1000) / studSpacingMm) + 1;
    const openingStudsRemoved = w.openings.reduce(
      (s, o) => s + Math.max(0, Math.floor(o.widthMm / studSpacingMm) - 1),
      0,
    );
    const trimmersAdded = w.openings.length * 2; // 2 short trimmers per opening
    studs += baseStuds - openingStudsRemoved + trimmersAdded;
    trimmerStuds += trimmersAdded;
  });

  const bottomPlateLM = Math.max(0, lengthM - doorDeductionM);

  // Double top plate when setting is on (user-controlled, default true for all walls)
  const topPlateLM = doubleTopPlate ? lengthM * 2 : lengthM;

  // Raking plate: only external walls explicitly marked (LM of those walls)
  const rakingPlateLM = isExternal
    ? walls.filter(w => w.hasRakingPlate).reduce((s, w) => s + w.lengthM, 0)
    : 0;

  // Noggings: 1 row ≤ 2700mm ceiling, 2 rows above (only in solid stud bays, skip opening span)
  const noggingRows = ceilingHeightMm > 2700 ? 2 : 1;
  const noggings = walls.reduce((s, w) => {
    const solidM = Math.max(0, w.lengthM - w.openings.reduce((os, o) => os + o.widthMm / 1000, 0));
    return s + Math.ceil((solidM * 1000) / 1200) * noggingRows;
  }, 0);

  // Lintels: one per opening, spanning width + 45mm bearing each side
  const lintels = allOpenings.map(o => ({
    widthMm: o.widthMm,
    lm: (o.widthMm + 90) / 1000,
  }));

  const netLengthM = Math.max(0, lengthM - allOpenings.reduce((s, o) => s + o.widthMm / 1000, 0));

  return {
    count, lengthM, netLengthM,
    studs, trimmerStuds,
    bottomPlateLM, topPlateLM, rakingPlateLM,
    noggingRows, noggings,
    openingCount, lintels,
  };
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

  const lintels = [...external.lintels, ...internal.lintels];
  const totalLintelLM = lintels.reduce((s, l) => s + l.lm, 0);

  return { external, internal, junctions, fixings, totalStuds, lintels, totalLintelLM };
}
