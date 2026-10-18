/**
 * Everything a configured wall puts into the estimate: framing, each face's lining or
 * cladding, insulation, doors and windows taken off the faces, and optional painting,
 * skirting and cornice. The Wall Setup preview and the estimate both come from here,
 * so what the dialog shows is exactly what gets added.
 *
 * Quantities are rule-of-thumb takeoff figures, not an engineered design.
 */
import { framingMembersForWall } from './framingMembers';

/** What can go on one face of a wall */
export type FaceFinish =
  | 'none'
  | 'pb_10' | 'pb_13'          // plasterboard
  | 'fc_6' | 'fc_9'            // FC sheet lining (wet areas)
  | 'fc_ext'                   // FC sheet cladding, external face
  | 'weatherboard'
  | 'brick';                   // brick veneer outer skin

export interface WallBuild {
  framingSystem: string;       // 'timber_90_mgp10' | 'timber_70_mgp10' | 'steel_92' | ... | 'none'
  faceA: FaceFinish;           // inside face
  faceB: FaceFinish;           // other side (outside for external walls)
  /** sheets per lined face: 2 for fire-rated walls */
  layers: number;
  insulationType: string | null;
  doors: number;
  windows: number;
  doorWidthM: number;
  doorHeightM: number;
  windowWidthM: number;
  windowHeightM: number;
  paint: boolean;
  skirting: boolean;
  cornice: boolean;
}

export interface WallLine {
  key: string;
  name: string;
  category: 'Framing' | 'Lining' | 'Cladding' | 'Insulation' | 'Painting' | 'Trim';
  trade: string;
  unit: 'M2' | 'LM';
  qty: number;
  /** id in SCOPE_OF_WORK_RATES */
  rateId: string;
  waste: number;
  material: string;
}

export const FRAMING_LABELS: Record<string, string> = {
  timber_90_mgp10: 'Timber frame 90mm MGP10',
  timber_90_mgp12: 'Timber frame 90mm MGP12',
  timber_70_mgp10: 'Timber frame 70mm MGP10',
  steel_64: 'Steel frame 64mm',
  steel_92: 'Steel frame 92mm',
};

export const FACE_LABELS: Record<FaceFinish, string> = {
  none: 'Nothing',
  pb_10: 'Plasterboard 10mm',
  pb_13: 'Plasterboard 13mm',
  fc_6: 'FC sheet 6mm',
  fc_9: 'FC sheet 9mm',
  fc_ext: 'FC cladding',
  weatherboard: 'Weatherboards',
  brick: 'Brick veneer',
};

export const INSULATION_LABELS: Record<string, string> = {
  r2_batts: 'R2.0 batts',
  r25_batts: 'R2.5 batts',
  r3_batts: 'R3.0 batts',
  r4_batts: 'R4.0 batts',
  acoustic: 'Acoustic batts',
};

const isLining = (f: FaceFinish) => f === 'pb_10' || f === 'pb_13' || f === 'fc_6' || f === 'fc_9';
const isCladding = (f: FaceFinish) => f === 'fc_ext' || f === 'weatherboard' || f === 'brick';

const FACE_RATE: Record<FaceFinish, string> = {
  none: '', pb_10: 'plas-002', pb_13: 'plas-002', fc_6: 'clad-002', fc_9: 'clad-002',
  fc_ext: 'clad-002', weatherboard: 'clad-001', brick: 'clad-003',
};

/** Standard brick 230 x 76 with 10 mm joints: about 48 per m² of veneer */
export const BRICKS_PER_M2 = 48.4;
/** Veneer ties at about 600 mm each way */
export const TIES_PER_M2 = 2.8;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function openingsArea(b: WallBuild): number {
  return Math.max(0, b.doors) * b.doorWidthM * b.doorHeightM + Math.max(0, b.windows) * b.windowWidthM * b.windowHeightM;
}

/** Lines for one wall. Openings in `b` are this wall's share. */
export function wallLines(lengthM: number, heightM: number, b: WallBuild): WallLine[] {
  if (!(lengthM > 0) || !(heightM > 0)) return [];
  const gross = lengthM * heightM;
  const net = Math.max(0, gross - openingsArea(b));
  const lines: WallLine[] = [];

  if (b.framingSystem && b.framingSystem !== 'none') {
    // The frame is built over the full wall; openings change members, not area
    lines.push({
      key: 'framing', name: 'Wall framing', category: 'Framing',
      trade: b.framingSystem.startsWith('steel') ? 'General' : 'Carpenter',
      unit: 'M2', qty: r2(gross), rateId: 'carp-011', waste: 1.1,
      material: FRAMING_LABELS[b.framingSystem] ?? 'Framing',
    });
  }

  const faces: [FaceFinish, string][] = [[b.faceA, 'a'], [b.faceB, 'b']];
  // Same lining on both faces is one line (2 faces), as estimators price it
  const sameLining = isLining(b.faceA) && b.faceA === b.faceB;
  const layers = Math.max(1, b.layers || 1);
  if (sameLining) {
    lines.push({
      key: 'lining', name: 'Wall lining', category: 'Lining', trade: 'Plasterer', unit: 'M2',
      qty: r2(net * 2 * layers), rateId: FACE_RATE[b.faceA], waste: 1.1,
      material: `${FACE_LABELS[b.faceA]}, both faces${layers > 1 ? `, ${layers} layers` : ''}`,
    });
  } else {
    for (const [face, side] of faces) {
      if (isLining(face)) {
        lines.push({
          // Each face its own name: the takeoff merges same-name lines on one wall
          key: `lining-${side}`, name: side === 'a' ? 'Wall lining, inside face' : 'Wall lining, other face', category: 'Lining', trade: 'Plasterer', unit: 'M2',
          qty: r2(net * layers), rateId: FACE_RATE[face], waste: 1.1,
          material: `${FACE_LABELS[face]}, one face${layers > 1 ? `, ${layers} layers` : ''}`,
        });
      } else if (isCladding(face)) {
        const brick = face === 'brick';
        lines.push({
          key: `cladding-${side}`, name: brick ? 'Brick veneer' : 'External cladding', category: 'Cladding',
          trade: brick ? 'Bricklayer' : 'Cladding Installer', unit: 'M2', qty: r2(net), rateId: FACE_RATE[face],
          waste: brick ? 1.05 : 1.1,
          material: brick
            ? `Brick veneer, about ${Math.ceil(net * BRICKS_PER_M2)} bricks and ${Math.ceil(net * TIES_PER_M2)} ties`
            : FACE_LABELS[face],
        });
      }
    }
  }

  if (b.insulationType) {
    lines.push({
      key: 'insulation', name: 'Wall insulation', category: 'Insulation', trade: 'Insulation', unit: 'M2',
      qty: r2(net), rateId: 'insul-002', waste: 1.05, material: INSULATION_LABELS[b.insulationType] ?? 'Wall batts',
    });
  }

  // Finishes on the lined faces only (cladding and brick are not painted here)
  const liningFaces = (isLining(b.faceA) ? 1 : 0) + (isLining(b.faceB) ? 1 : 0);
  if (b.paint && liningFaces > 0) {
    lines.push({
      key: 'paint', name: 'Painting walls', category: 'Painting', trade: 'Painter', unit: 'M2',
      qty: r2(net * liningFaces), rateId: 'paint-001', waste: 1, material: `2 coats, ${liningFaces === 2 ? 'both faces' : 'one face'}`,
    });
  }
  if (b.skirting && liningFaces > 0) {
    // Skirting runs along each lined face, stopping at doorways
    const run = Math.max(0, lengthM * liningFaces - Math.max(0, b.doors) * b.doorWidthM * liningFaces);
    lines.push({
      key: 'skirting', name: 'Skirting', category: 'Trim', trade: 'Carpenter', unit: 'LM',
      qty: r2(run), rateId: 'carp-009', waste: 1.1, material: `Along ${liningFaces === 2 ? 'both faces' : 'one face'}, less doorways`,
    });
  }
  if (b.cornice && liningFaces > 0) {
    lines.push({
      key: 'cornice', name: 'Cornice', category: 'Trim', trade: 'Plasterer', unit: 'LM',
      qty: r2(lengthM * liningFaces), rateId: 'plas-005', waste: 1.1, material: `90mm cove, ${liningFaces === 2 ? 'both faces' : 'one face'}`,
    });
  }
  return lines;
}

/** Framing members including what openings add: 2 jamb studs each and a lintel 300 mm wider. */
export function wallMembers(lengthM: number, heightM: number, spacingMm: number, b: WallBuild) {
  const base = framingMembersForWall(lengthM, heightM, spacingMm);
  if (!base) return null;
  const openings = Math.max(0, b.doors) + Math.max(0, b.windows);
  const lintelLM = Math.max(0, b.doors) * (b.doorWidthM + 0.3) + Math.max(0, b.windows) * (b.windowWidthM + 0.3);
  return { ...base, jambStuds: Math.ceil(openings * 2), lintelLM: r2(lintelLM), openings };
}

/** The build a wall measurement saved before Wall Setup v2 (one lining type on N faces). */
export function legacyWallBuild(m: {
  framingSystem?: string; hasLining?: boolean; liningType?: string; liningFaces?: number;
  hasInsulation?: boolean; insulationType?: string;
}): WallBuild {
  const lining = (m.hasLining ? (m.liningType as FaceFinish) : 'none') || 'none';
  const known = lining in FACE_LABELS ? lining : 'pb_10';
  return {
    framingSystem: m.framingSystem || 'none',
    faceA: m.hasLining ? known : 'none',
    faceB: m.hasLining && (m.liningFaces ?? 1) >= 2 ? known : 'none',
    layers: 1,
    insulationType: m.hasInsulation ? (m.insulationType || 'r2_batts') : null,
    doors: 0, windows: 0, doorWidthM: 0.82, doorHeightM: 2.04, windowWidthM: 1.2, windowHeightM: 1.2,
    paint: false, skirting: false, cornice: false,
  };
}
