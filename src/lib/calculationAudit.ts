// Calculation Audit Trail - Shows detailed breakdown of how estimates are calculated
// Provides full transparency into pricing logic

export interface CalculationStep {
  stepNumber: number;
  description: string;
  formula: string;
  inputs: Record<string, { value: number | string; unit?: string; source?: string }>;
  result: number;
  unit: string;
}

export interface MaterialLookupResult {
  found: boolean;
  materialName: string;
  searchedName: string;
  supplier?: string;
  unitPrice?: number;
  priceUnit?: string;
  lastUpdated?: Date;
  alternatives?: Array<{
    name: string;
    supplier: string;
    price: number;
    unit: string;
  }>;
  reason?: string; // Why material wasn't found
}

export interface RateBreakdown {
  itemDescription: string;
  materialComponent: {
    name: string;
    unitRate: number;
    unit: string;
    quantity: number;
    subtotal: number;
    source: string;
    lookup: MaterialLookupResult;
  };
  labourComponent: {
    trade: string;
    hourlyRate: number;
    hoursPerUnit: number;
    quantity: number;
    totalHours: number;
    subtotal: number;
    source: string;
  };
  overheadMargin?: {
    percentage: number;
    amount: number;
  };
  totalCost: number;
}

export interface CalculationAudit {
  lineItemId: string;
  lineItemDescription: string;
  timestamp: Date;

  // Detection phase
  detection: {
    method: 'schedule_parse' | 'symbol_detection' | 'text_pattern' | 'cv_analysis' | 'manual' | 'inferred';
    confidence: number;
    pageReferences: number[];
    rawData?: string; // Original detected text/data
    explanation: string;
  };

  // Quantity calculation
  quantityCalculation: {
    steps: CalculationStep[];
    finalQuantity: number;
    unit: string;
    assumptions: string[];
    warnings: string[];
  };

  // Rate lookup
  rateLookup: RateBreakdown;

  // Final calculation
  finalCalculation: {
    formula: string;
    materialCost: number;
    labourCost: number;
    totalBeforeGST: number;
    gst: number;
    totalIncGST: number;
  };

  // Validation
  validation: {
    isReasonable: boolean;
    warnings: string[];
    suggestions: string[];
  };
}

/**
 * Create a calculation step
 */
export function createStep(
  stepNumber: number,
  description: string,
  formula: string,
  inputs: Record<string, { value: number | string; unit?: string; source?: string }>,
  result: number,
  unit: string
): CalculationStep {
  return { stepNumber, description, formula, inputs, result, unit };
}

/**
 * Generate quantity calculation audit for different item types
 */
export function generateQuantityAudit(
  itemType: string,
  detectedValue: number | null,
  assumptions: Record<string, number>,
  calibratedArea?: number
): { steps: CalculationStep[]; quantity: number; unit: string; assumptions: string[]; warnings: string[] } {
  const steps: CalculationStep[] = [];
  const assumptionsList: string[] = [];
  const warnings: string[] = [];
  let quantity = 0;
  let unit = 'each';

  switch (itemType) {
    case 'wall_framing':
      if (calibratedArea) {
        steps.push(createStep(1, 'Get measured floor area', 'Floor area from calibrated measurement',
          { floorArea: { value: calibratedArea, unit: 'm²', source: 'Calibrated measurement' } },
          calibratedArea, 'm²'));

        steps.push(createStep(2, 'Calculate wall area', 'Floor area × wall height × perimeter factor',
          {
            floorArea: { value: calibratedArea, unit: 'm²' },
            wallHeight: { value: assumptions.wallHeight || 2.7, unit: 'm', source: 'Assumption' },
            perimeterFactor: { value: assumptions.perimeterFactor || 0.8, source: 'Industry standard' }
          },
          calibratedArea * (assumptions.wallHeight || 2.7) * (assumptions.perimeterFactor || 0.8), 'm²'));

        quantity = calibratedArea * (assumptions.wallHeight || 2.7) * (assumptions.perimeterFactor || 0.8);
        assumptionsList.push(`Wall height: ${assumptions.wallHeight || 2.7}m`);
        assumptionsList.push(`Perimeter factor: ${assumptions.perimeterFactor || 0.8} (accounts for openings)`);
      } else {
        steps.push(createStep(1, 'Use default floor area', 'No calibration - using assumed area',
          { assumedArea: { value: assumptions.defaultFloorArea || 150, unit: 'm²', source: 'Default assumption' } },
          assumptions.defaultFloorArea || 150, 'm²'));

        quantity = (assumptions.defaultFloorArea || 150) * (assumptions.wallHeight || 2.7) * 0.8;
        warnings.push('Area not measured - using default assumption. Consider calibrating scale for accurate measurement.');
        assumptionsList.push(`Default floor area: ${assumptions.defaultFloorArea || 150}m² (assumed)`);
      }
      unit = 'm²';
      break;

    case 'doors':
      if (detectedValue !== null && detectedValue > 0) {
        steps.push(createStep(1, 'Count detected doors', 'Doors from schedule or symbol detection',
          { detectedCount: { value: detectedValue, source: 'PDF Analysis' } },
          detectedValue, 'each'));
        quantity = detectedValue;
      } else {
        // Infer from room count
        const roomCount = assumptions.roomCount || 8;
        steps.push(createStep(1, 'Estimate from room count', 'Rooms × average doors per room',
          {
            roomCount: { value: roomCount, source: 'Detected rooms' },
            doorsPerRoom: { value: 1.5, source: 'Industry average' }
          },
          Math.ceil(roomCount * 1.5), 'each'));
        quantity = Math.ceil(roomCount * 1.5);
        warnings.push('Door count inferred from room count - verify against plans');
        assumptionsList.push('Average 1.5 doors per room');
      }
      unit = 'each';
      break;

    case 'electrical_points':
      if (detectedValue !== null && detectedValue > 0) {
        steps.push(createStep(1, 'Count detected GPOs', 'Power points from electrical plan',
          { detectedCount: { value: detectedValue, source: 'PDF Analysis' } },
          detectedValue, 'each'));
        quantity = detectedValue;
      } else {
        // Standard allowance per room
        const roomCount = assumptions.roomCount || 8;
        steps.push(createStep(1, 'Estimate from room count', 'Rooms × GPOs per room',
          {
            roomCount: { value: roomCount, source: 'Detected rooms' },
            gposPerRoom: { value: 4, source: 'AS/NZS 3000 minimum' }
          },
          roomCount * 4, 'each'));
        quantity = roomCount * 4;
        warnings.push('Electrical points estimated - no electrical plan detected');
        assumptionsList.push('4 GPOs per room (AS/NZS 3000 minimum)');
      }
      unit = 'each';
      break;

    default:
      if (detectedValue !== null) {
        quantity = detectedValue;
        steps.push(createStep(1, 'Use detected quantity', 'Direct from PDF analysis',
          { detectedValue: { value: detectedValue, source: 'PDF Analysis' } },
          detectedValue, 'each'));
      }
  }

  return { steps, quantity, unit, assumptions: assumptionsList, warnings };
}

/**
 * Generate rate breakdown with material lookup
 */
export function generateRateBreakdown(
  description: string,
  materialRate: number,
  labourRate: number,
  labourHours: number,
  quantity: number,
  trade: string,
  materialLookup: MaterialLookupResult
): RateBreakdown {
  const materialSubtotal = materialRate * quantity;
  const labourSubtotal = labourRate * labourHours * quantity;

  return {
    itemDescription: description,
    materialComponent: {
      name: materialLookup.found ? materialLookup.materialName : `${description} (material)`,
      unitRate: materialRate,
      unit: materialLookup.priceUnit || '$/unit',
      quantity,
      subtotal: materialSubtotal,
      source: materialLookup.found
        ? `${materialLookup.supplier} - Updated ${materialLookup.lastUpdated?.toLocaleDateString() || 'N/A'}`
        : 'Rawlinsons Construction Handbook 2024',
      lookup: materialLookup,
    },
    labourComponent: {
      trade,
      hourlyRate: labourRate,
      hoursPerUnit: labourHours,
      quantity,
      totalHours: labourHours * quantity,
      subtotal: labourSubtotal,
      source: 'Fair Work Award Rates + 20% contractor margin',
    },
    totalCost: materialSubtotal + labourSubtotal,
  };
}

/**
 * Validate calculation reasonableness
 */
export function validateCalculation(
  itemType: string,
  quantity: number,
  totalCost: number,
  floorArea?: number
): { isReasonable: boolean; warnings: string[]; suggestions: string[] } {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let isReasonable = true;

  // Cost per m² benchmarks (Australian residential)
  const benchmarks: Record<string, { min: number; max: number; typical: number }> = {
    'wall_framing': { min: 30, max: 100, typical: 65 },
    'plasterboard': { min: 20, max: 60, typical: 40 },
    'electrical': { min: 100, max: 300, typical: 180 }, // per m² of floor
    'plumbing': { min: 80, max: 250, typical: 150 },
  };

  if (floorArea && benchmarks[itemType]) {
    const costPerM2 = totalCost / floorArea;
    const benchmark = benchmarks[itemType];

    if (costPerM2 < benchmark.min) {
      warnings.push(`Cost seems low: $${costPerM2.toFixed(0)}/m² vs typical $${benchmark.typical}/m²`);
      suggestions.push('Review quantity - may be underestimated');
      isReasonable = false;
    } else if (costPerM2 > benchmark.max) {
      warnings.push(`Cost seems high: $${costPerM2.toFixed(0)}/m² vs typical $${benchmark.typical}/m²`);
      suggestions.push('Review rates or check for duplicate items');
      isReasonable = false;
    }
  }

  // Quantity sanity checks
  if (itemType === 'doors' && quantity > 50) {
    warnings.push('Large door count - verify this is correct');
  }

  if (itemType === 'electrical_points' && quantity > 200) {
    warnings.push('Very high GPO count - typical residential is 30-60');
  }

  return { isReasonable, warnings, suggestions };
}

/**
 * Format calculation audit for display
 */
export function formatAuditForDisplay(audit: CalculationAudit): string {
  const lines: string[] = [];

  lines.push(`=== ${audit.lineItemDescription} ===`);
  lines.push(`ID: ${audit.lineItemId}`);
  lines.push('');

  lines.push('📍 DETECTION');
  lines.push(`Method: ${audit.detection.method}`);
  lines.push(`Confidence: ${(audit.detection.confidence * 100).toFixed(0)}%`);
  lines.push(`Explanation: ${audit.detection.explanation}`);
  lines.push('');

  lines.push('📐 QUANTITY CALCULATION');
  for (const step of audit.quantityCalculation.steps) {
    lines.push(`Step ${step.stepNumber}: ${step.description}`);
    lines.push(`  Formula: ${step.formula}`);
    for (const [key, input] of Object.entries(step.inputs)) {
      lines.push(`  ${key}: ${input.value}${input.unit ? ` ${input.unit}` : ''} (${input.source || 'Given'})`);
    }
    lines.push(`  Result: ${step.result} ${step.unit}`);
  }
  if (audit.quantityCalculation.assumptions.length > 0) {
    lines.push('Assumptions:');
    for (const assumption of audit.quantityCalculation.assumptions) {
      lines.push(`  • ${assumption}`);
    }
  }
  lines.push('');

  lines.push('💰 RATE BREAKDOWN');
  const rate = audit.rateLookup;
  lines.push(`Material: ${rate.materialComponent.name}`);
  lines.push(`  Rate: $${rate.materialComponent.unitRate.toFixed(2)} ${rate.materialComponent.unit}`);
  lines.push(`  Qty: ${rate.materialComponent.quantity}`);
  lines.push(`  Subtotal: $${rate.materialComponent.subtotal.toFixed(2)}`);
  lines.push(`  Source: ${rate.materialComponent.source}`);

  if (!rate.materialComponent.lookup.found) {
    lines.push(`  ⚠️ MATERIAL NOT FOUND: ${rate.materialComponent.lookup.reason}`);
    if (rate.materialComponent.lookup.alternatives?.length) {
      lines.push('  Alternatives:');
      for (const alt of rate.materialComponent.lookup.alternatives) {
        lines.push(`    - ${alt.name} @ $${alt.price}/${alt.unit} (${alt.supplier})`);
      }
    }
  }

  lines.push(`Labour: ${rate.labourComponent.trade}`);
  lines.push(`  Rate: $${rate.labourComponent.hourlyRate}/hr × ${rate.labourComponent.hoursPerUnit} hrs/unit`);
  lines.push(`  Total Hours: ${rate.labourComponent.totalHours.toFixed(1)} hrs`);
  lines.push(`  Subtotal: $${rate.labourComponent.subtotal.toFixed(2)}`);
  lines.push('');

  lines.push('🧮 FINAL CALCULATION');
  lines.push(`Material Cost: $${audit.finalCalculation.materialCost.toLocaleString()}`);
  lines.push(`Labour Cost: $${audit.finalCalculation.labourCost.toLocaleString()}`);
  lines.push(`Subtotal: $${audit.finalCalculation.totalBeforeGST.toLocaleString()}`);
  lines.push(`GST (10%): $${audit.finalCalculation.gst.toLocaleString()}`);
  lines.push(`TOTAL: $${audit.finalCalculation.totalIncGST.toLocaleString()}`);

  if (audit.validation.warnings.length > 0) {
    lines.push('');
    lines.push('⚠️ WARNINGS');
    for (const warning of audit.validation.warnings) {
      lines.push(`  • ${warning}`);
    }
  }

  return lines.join('\n');
}
