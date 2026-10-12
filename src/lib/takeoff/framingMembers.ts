/**
 * Suggested framing members for one wall: how many studs and at what length,
 * plate and nogging lengths. Rule-of-thumb takeoff, not an engineered design.
 */
export interface FramingMembers {
  spacingMm: number;
  studs: number;
  studLengthM: number;
  plateLM: number;        // bottom plate + top plate(s)
  plateRuns: number;      // 3 = bottom + double top
  noggingRows: number;
  noggingLM: number;
}

export const STUD_SPACINGS = [300, 450, 600] as const;

export function framingMembersForWall(lengthM: number, heightM: number, spacingMm = 450, doubleTopPlate = true): FramingMembers | null {
  if (!(lengthM > 0) || !(heightM > 0)) return null;
  const studs = Math.ceil((lengthM * 1000) / spacingMm) + 1;
  const plateRuns = doubleTopPlate ? 3 : 2;
  // One row of noggings, two once the wall is over 2.7 m
  const noggingRows = heightM > 2.7 ? 2 : 1;
  return {
    spacingMm,
    studs,
    studLengthM: Math.round(heightM * 100) / 100,
    plateLM: Math.round(lengthM * plateRuns * 100) / 100,
    plateRuns,
    noggingRows,
    noggingLM: Math.round(lengthM * noggingRows * 100) / 100,
  };
}

/** Indicative timber prices (MGP10 90x35), same as the old frame estimator used */
export const TIMBER_PRICE_PER_LM = 3.85;
export const NOGGING_PRICE_PER_LM = 2.3;
