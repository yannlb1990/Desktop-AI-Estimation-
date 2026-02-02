// Scope Gap Checker - Detects missing items that should probably be in the estimate
// Based on 50+ years of estimating experience - catches what AI misses

import { PlanAnalysisResult, EstimatedLineItem } from './aiPlanAnalyzer';
import { Trade } from './takeoff/types';

export type GapSeverity = 'critical' | 'warning' | 'info';
export type GapCategory =
  | 'structure'
  | 'services'
  | 'wet_areas'
  | 'external'
  | 'compliance'
  | 'preliminaries'
  | 'finishes'
  | 'connections';

export interface ScopeGap {
  id: string;
  category: GapCategory;
  severity: GapSeverity;
  title: string;
  description: string;
  reason: string;  // Why we think this is missing
  suggestedItems: SuggestedItem[];
  isAcknowledged: boolean;
  acknowledgedAs: 'added' | 'not_required' | 'included_elsewhere' | null;
  acknowledgedNote?: string;
}

export interface SuggestedItem {
  description: string;
  trade: Trade;
  category: string;
  estimatedQty: number;
  unit: 'LM' | 'M2' | 'M3' | 'each' | 'item' | 'allow';
  estimatedRate: number;
  basis: string;  // Why this rate/qty
}

// Gap detection rules - the wisdom of 50 years
interface GapRule {
  id: string;
  category: GapCategory;
  severity: GapSeverity;
  title: string;
  description: string;
  condition: (analysis: PlanAnalysisResult, items: EstimatedLineItem[]) => boolean;
  reason: (analysis: PlanAnalysisResult) => string;
  suggestedItems: (analysis: PlanAnalysisResult) => SuggestedItem[];
}

const SCOPE_GAP_RULES: GapRule[] = [
  // === STRUCTURE ===
  {
    id: 'no-footings',
    category: 'structure',
    severity: 'critical',
    title: 'No Footings/Foundation',
    description: 'Every building needs footings - none detected in estimate',
    condition: (analysis, items) => {
      const hasFootings = items.some(i =>
        /footing|foundation|slab\s*edge|strip\s*foot/i.test(i.description)
      );
      const isNewBuild = analysis.summary.projectType.includes('New');
      return isNewBuild && !hasFootings;
    },
    reason: () => 'New build detected but no footing/foundation items found',
    suggestedItems: (analysis) => [{
      description: 'Strip footings to engineer\'s design',
      trade: 'Concreter',
      category: 'Concrete',
      estimatedQty: 60,
      unit: 'LM',
      estimatedRate: 250,
      basis: 'Typical 450x300 strip footing including excavation, formwork, reo, concrete'
    }]
  },
  {
    id: 'no-termite',
    category: 'structure',
    severity: 'critical',
    title: 'No Termite Protection',
    description: 'Termite management system required by NCC - not detected',
    condition: (analysis, items) => {
      const hasTermite = items.some(i =>
        /termite|pest|kordon|termimesh|physical\s*barrier/i.test(i.description)
      );
      return !hasTermite;
    },
    reason: () => 'NCC requires termite management for all new buildings - none found in estimate',
    suggestedItems: () => [{
      description: 'Termite management system (physical barrier)',
      trade: 'General',
      category: 'Compliance',
      estimatedQty: 1,
      unit: 'item',
      estimatedRate: 2500,
      basis: 'Kordon or similar physical barrier system to slab perimeter'
    }]
  },

  // === SERVICES ===
  {
    id: 'kitchen-no-electrical',
    category: 'services',
    severity: 'critical',
    title: 'Kitchen Without Electrical',
    description: 'Kitchen detected but no kitchen electrical items',
    condition: (analysis, items) => {
      const hasKitchen = analysis.pages.some(p =>
        p.rooms.some(r => /kitchen/i.test(r.name))
      );
      const hasKitchenElec = items.some(i =>
        /kitchen/i.test(i.description) && i.trade === 'Electrician'
      );
      const hasOvenCircuit = items.some(i =>
        /oven|cooktop|range|stove/i.test(i.description)
      );
      return hasKitchen && !hasKitchenElec && !hasOvenCircuit;
    },
    reason: (analysis) => {
      const kitchenCount = analysis.pages.flatMap(p => p.rooms).filter(r => /kitchen/i.test(r.name)).length;
      return `${kitchenCount} kitchen(s) detected but no dedicated electrical circuits for appliances`;
    },
    suggestedItems: () => [
      {
        description: 'Oven circuit - dedicated 32A',
        trade: 'Electrician',
        category: 'Electrical',
        estimatedQty: 1,
        unit: 'each',
        estimatedRate: 450,
        basis: 'Dedicated circuit from switchboard, cable, isolator'
      },
      {
        description: 'Cooktop circuit - dedicated 32A',
        trade: 'Electrician',
        category: 'Electrical',
        estimatedQty: 1,
        unit: 'each',
        estimatedRate: 450,
        basis: 'Dedicated circuit from switchboard'
      },
      {
        description: 'Dishwasher circuit',
        trade: 'Electrician',
        category: 'Electrical',
        estimatedQty: 1,
        unit: 'each',
        estimatedRate: 280,
        basis: 'Dedicated circuit, isolation switch'
      },
      {
        description: 'Rangehood connection',
        trade: 'Electrician',
        category: 'Electrical',
        estimatedQty: 1,
        unit: 'each',
        estimatedRate: 180,
        basis: 'Power point and isolation'
      }
    ]
  },
  {
    id: 'no-switchboard',
    category: 'services',
    severity: 'critical',
    title: 'No Switchboard/Main Board',
    description: 'Electrical items found but no switchboard allowance',
    condition: (analysis, items) => {
      const hasElectrical = items.some(i => i.trade === 'Electrician');
      const hasSwitchboard = items.some(i =>
        /switchboard|main\s*board|distribution|msb|sub\s*board/i.test(i.description)
      );
      return hasElectrical && !hasSwitchboard;
    },
    reason: () => 'Electrical items in estimate but no switchboard - every job needs one',
    suggestedItems: () => [{
      description: 'Switchboard - new residential 24 pole',
      trade: 'Electrician',
      category: 'Electrical',
      estimatedQty: 1,
      unit: 'each',
      estimatedRate: 1800,
      basis: '24 pole board, safety switches, circuit breakers, metering'
    }]
  },
  {
    id: 'no-smoke-alarms',
    category: 'services',
    severity: 'critical',
    title: 'No Smoke Alarms',
    description: 'Smoke alarms required by NCC - none in estimate',
    condition: (analysis, items) => {
      const hasSmokeAlarms = items.some(i =>
        /smoke\s*alarm|smoke\s*detector/i.test(i.description)
      );
      return !hasSmokeAlarms;
    },
    reason: () => 'NCC requires interconnected smoke alarms in all bedrooms, hallways - none found',
    suggestedItems: (analysis) => {
      const bedrooms = analysis.pages.flatMap(p => p.rooms).filter(r => /bed|master/i.test(r.name)).length;
      const qty = Math.max(3, bedrooms + 2); // Bedrooms + hallway + living
      return [{
        description: 'Smoke alarms - 240V interconnected (NCC compliant)',
        trade: 'Electrician',
        category: 'Compliance',
        estimatedQty: qty,
        unit: 'each',
        estimatedRate: 185,
        basis: `${qty} locations: bedrooms, hallway, living areas - hardwired interconnected`
      }];
    }
  },
  {
    id: 'no-hot-water',
    category: 'services',
    severity: 'critical',
    title: 'No Hot Water System',
    description: 'Bathrooms detected but no hot water system',
    condition: (analysis, items) => {
      const hasWetAreas = analysis.pages.some(p =>
        p.rooms.some(r => /bathroom|ensuite|laundry/i.test(r.name))
      );
      const hasHotWater = items.some(i =>
        /hot\s*water|hwu|hws|heat\s*pump/i.test(i.description)
      );
      return hasWetAreas && !hasHotWater;
    },
    reason: () => 'Wet areas detected but no hot water system - every home needs one',
    suggestedItems: () => [{
      description: 'Hot water system - heat pump 270L',
      trade: 'Plumber',
      category: 'Plumbing',
      estimatedQty: 1,
      unit: 'each',
      estimatedRate: 3500,
      basis: 'Heat pump HWS supply and install, complies with energy requirements'
    }]
  },

  // === WET AREAS ===
  {
    id: 'bathroom-no-waterproofing',
    category: 'wet_areas',
    severity: 'critical',
    title: 'Bathroom Without Waterproofing',
    description: 'Bathroom detected but no waterproofing in estimate',
    condition: (analysis, items) => {
      const hasBathroom = analysis.pages.some(p =>
        p.rooms.some(r => /bathroom|ensuite|shower/i.test(r.name))
      );
      const hasWaterproofing = items.some(i =>
        /waterproof|membrane/i.test(i.description)
      );
      return hasBathroom && !hasWaterproofing;
    },
    reason: (analysis) => {
      const bathCount = analysis.pages.flatMap(p => p.rooms).filter(r => /bathroom|ensuite/i.test(r.name)).length;
      return `${bathCount} bathroom(s) detected but no waterproofing - required by AS3740`;
    },
    suggestedItems: (analysis) => {
      const bathCount = Math.max(1, analysis.pages.flatMap(p => p.rooms).filter(r => /bathroom|ensuite/i.test(r.name)).length);
      return [{
        description: 'Wet area waterproofing - floors and walls',
        trade: 'Waterproofer',
        category: 'Waterproofing',
        estimatedQty: bathCount * 12,
        unit: 'M2',
        estimatedRate: 65,
        basis: `${bathCount} bathrooms × 12m² avg (floor + walls to 1800mm in shower)`
      }];
    }
  },
  {
    id: 'bathroom-no-exhaust',
    category: 'wet_areas',
    severity: 'warning',
    title: 'Bathroom Without Exhaust Fan',
    description: 'Bathroom detected but no exhaust fan',
    condition: (analysis, items) => {
      const hasBathroom = analysis.pages.some(p =>
        p.rooms.some(r => /bathroom|ensuite|toilet|wc/i.test(r.name))
      );
      const hasExhaust = items.some(i =>
        /exhaust|extract|ventilation\s*fan/i.test(i.description)
      );
      return hasBathroom && !hasExhaust;
    },
    reason: () => 'Bathrooms require mechanical ventilation if no openable window',
    suggestedItems: (analysis) => {
      const bathCount = Math.max(1, analysis.pages.flatMap(p => p.rooms).filter(r => /bathroom|ensuite|toilet|wc/i.test(r.name)).length);
      return [{
        description: 'Exhaust fans - bathroom/toilet',
        trade: 'Electrician',
        category: 'Electrical',
        estimatedQty: bathCount,
        unit: 'each',
        estimatedRate: 280,
        basis: 'Exhaust fan, ducting to exterior, wiring to switch'
      }];
    }
  },
  {
    id: 'laundry-no-tub',
    category: 'wet_areas',
    severity: 'warning',
    title: 'Laundry Without Tub/Trough',
    description: 'Laundry detected but no laundry tub',
    condition: (analysis, items) => {
      const hasLaundry = analysis.pages.some(p =>
        p.rooms.some(r => /laundry/i.test(r.name))
      );
      const hasTub = items.some(i =>
        /laundry\s*tub|laundry\s*trough|wash\s*trough/i.test(i.description)
      );
      return hasLaundry && !hasTub;
    },
    reason: () => 'Laundry room detected but no laundry tub/trough in estimate',
    suggestedItems: () => [{
      description: 'Laundry tub - 45L stainless steel',
      trade: 'Plumber',
      category: 'Plumbing',
      estimatedQty: 1,
      unit: 'each',
      estimatedRate: 650,
      basis: 'SS laundry tub, cabinet, tapware, waste connection'
    }]
  },

  // === EXTERNAL WORKS ===
  {
    id: 'no-external-works',
    category: 'external',
    severity: 'warning',
    title: 'No External Works',
    description: 'No driveway, paths, or landscaping detected',
    condition: (analysis, items) => {
      const hasExternal = items.some(i =>
        /driveway|path|paving|landscap|turf|garden|fence|retaining/i.test(i.description)
      );
      const isNewBuild = analysis.summary.projectType.includes('New');
      return isNewBuild && !hasExternal;
    },
    reason: () => 'New build but no external works - client will expect finished site',
    suggestedItems: () => [
      {
        description: 'Concrete driveway - exposed aggregate',
        trade: 'Concreter',
        category: 'External',
        estimatedQty: 50,
        unit: 'M2',
        estimatedRate: 120,
        basis: 'Typical 50m² driveway, 100mm thick, exposed aggregate'
      },
      {
        description: 'Concrete paths',
        trade: 'Concreter',
        category: 'External',
        estimatedQty: 25,
        unit: 'M2',
        estimatedRate: 95,
        basis: 'Entry path, side access, rear - broom finish'
      },
      {
        description: 'Turf and garden beds',
        trade: 'Landscaper',
        category: 'External',
        estimatedQty: 1,
        unit: 'allow',
        estimatedRate: 5000,
        basis: 'Allowance for turf, mulch, basic planting'
      }
    ]
  },
  {
    id: 'no-fencing',
    category: 'external',
    severity: 'warning',
    title: 'No Fencing',
    description: 'No fencing detected - usually required',
    condition: (analysis, items) => {
      const hasFencing = items.some(i =>
        /fence|fencing|colorbond|paling|pool\s*fence/i.test(i.description)
      );
      const isNewBuild = analysis.summary.projectType.includes('New');
      return isNewBuild && !hasFencing;
    },
    reason: () => 'New build typically requires boundary fencing',
    suggestedItems: () => [{
      description: 'Colorbond fencing - 1800mm',
      trade: 'General',
      category: 'External',
      estimatedQty: 60,
      unit: 'LM',
      estimatedRate: 125,
      basis: 'Typical 3 boundaries × 20m, 1800mm Colorbond'
    }]
  },
  {
    id: 'no-letterbox',
    category: 'external',
    severity: 'info',
    title: 'No Letterbox',
    description: 'Small item but clients always ask "where\'s my letterbox?"',
    condition: (analysis, items) => {
      const hasLetterbox = items.some(i =>
        /letterbox|mailbox/i.test(i.description)
      );
      const isNewBuild = analysis.summary.projectType.includes('New');
      return isNewBuild && !hasLetterbox;
    },
    reason: () => 'Every house needs a letterbox - small cost, big annoyance if missed',
    suggestedItems: () => [{
      description: 'Letterbox - brick pier with insert',
      trade: 'Bricklayer',
      category: 'External',
      estimatedQty: 1,
      unit: 'each',
      estimatedRate: 650,
      basis: 'Brick pier letterbox to match house'
    }]
  },

  // === CONNECTIONS ===
  {
    id: 'no-sewer-connection',
    category: 'connections',
    severity: 'critical',
    title: 'No Sewer Connection',
    description: 'No sewer connection to mains detected',
    condition: (analysis, items) => {
      const hasSewer = items.some(i =>
        /sewer\s*connect|sewer\s*junction|sewer\s*main|WSAA/i.test(i.description)
      );
      const isNewBuild = analysis.summary.projectType.includes('New');
      return isNewBuild && !hasSewer;
    },
    reason: () => 'New build needs sewer connection - often $5-15k depending on distance',
    suggestedItems: () => [{
      description: 'Sewer connection to main - by licensed drainer',
      trade: 'Plumber',
      category: 'Connections',
      estimatedQty: 1,
      unit: 'item',
      estimatedRate: 6500,
      basis: 'Allow for junction, trenching to boundary, council fees'
    }]
  },
  {
    id: 'no-stormwater',
    category: 'connections',
    severity: 'critical',
    title: 'No Stormwater Drainage',
    description: 'No stormwater system detected',
    condition: (analysis, items) => {
      const hasStormwater = items.some(i =>
        /stormwater|storm\s*water|downpipe|drain|ag\s*drain|rubble\s*pit/i.test(i.description)
      );
      const isNewBuild = analysis.summary.projectType.includes('New');
      return isNewBuild && !hasStormwater;
    },
    reason: () => 'Stormwater disposal required - charged pit, connection to street, or on-site disposal',
    suggestedItems: () => [
      {
        description: 'Stormwater drainage - pits, pipes, connection',
        trade: 'Plumber',
        category: 'Drainage',
        estimatedQty: 1,
        unit: 'item',
        estimatedRate: 4500,
        basis: 'Downpipe connections, pits, 90mm pipe to street/disposal'
      },
      {
        description: 'Ag drain to boundary',
        trade: 'Plumber',
        category: 'Drainage',
        estimatedQty: 40,
        unit: 'LM',
        estimatedRate: 45,
        basis: 'Subsoil drainage if required by engineer'
      }
    ]
  },
  {
    id: 'no-water-meter',
    category: 'connections',
    severity: 'warning',
    title: 'No Water Connection/Meter',
    description: 'No water connection to mains detected',
    condition: (analysis, items) => {
      const hasWater = items.some(i =>
        /water\s*connect|water\s*meter|water\s*main|water\s*service/i.test(i.description)
      );
      const isNewBuild = analysis.summary.projectType.includes('New');
      return isNewBuild && !hasWater;
    },
    reason: () => 'New build needs water connection and meter',
    suggestedItems: () => [{
      description: 'Water service connection - 20mm',
      trade: 'Plumber',
      category: 'Connections',
      estimatedQty: 1,
      unit: 'item',
      estimatedRate: 2800,
      basis: 'Tapping fee, meter, pipe to boundary, council fees'
    }]
  },
  {
    id: 'no-power-connection',
    category: 'connections',
    severity: 'warning',
    title: 'No Power Connection',
    description: 'No electrical connection to mains detected',
    condition: (analysis, items) => {
      const hasPower = items.some(i =>
        /power\s*connect|mains\s*connect|energex|ausgrid|supply\s*authority/i.test(i.description)
      );
      const isNewBuild = analysis.summary.projectType.includes('New');
      return isNewBuild && !hasPower;
    },
    reason: () => 'New build needs power connection - supply authority fees apply',
    suggestedItems: () => [{
      description: 'Electrical connection - underground to pit',
      trade: 'Electrician',
      category: 'Connections',
      estimatedQty: 1,
      unit: 'item',
      estimatedRate: 3500,
      basis: 'Consumer mains, meter box, connection to pit, authority fees'
    }]
  },

  // === COMPLIANCE ===
  {
    id: 'no-energy-rating',
    category: 'compliance',
    severity: 'warning',
    title: 'No Energy Rating/Insulation',
    description: 'No insulation items detected - required for 6-star compliance',
    condition: (analysis, items) => {
      const hasInsulation = items.some(i =>
        /insulation|batts|r[0-9]|sarking|energy\s*rating/i.test(i.description)
      );
      return !hasInsulation;
    },
    reason: () => 'NCC requires minimum 6-star energy rating - insulation is essential',
    suggestedItems: () => [
      {
        description: 'Ceiling insulation - R5.0 batts',
        trade: 'Insulation',
        category: 'Insulation',
        estimatedQty: 150,
        unit: 'M2',
        estimatedRate: 18,
        basis: 'R5.0 ceiling batts for climate zone compliance'
      },
      {
        description: 'Wall insulation - R2.5 batts',
        trade: 'Insulation',
        category: 'Insulation',
        estimatedQty: 200,
        unit: 'M2',
        estimatedRate: 14,
        basis: 'R2.5 wall batts for external walls'
      }
    ]
  },
  {
    id: 'no-handrails',
    category: 'compliance',
    severity: 'warning',
    title: 'No Handrails/Balustrades',
    description: 'Stairs or deck detected but no balustrade/handrail',
    condition: (analysis, items) => {
      const hasStairs = analysis.pages.some(p =>
        p.rooms.some(r => /stair/i.test(r.name)) ||
        p.annotations.some(a => /stair|step|deck|balcon/i.test(a))
      );
      const hasBalustrade = items.some(i =>
        /balustrade|handrail|railing|guard/i.test(i.description)
      );
      return hasStairs && !hasBalustrade;
    },
    reason: () => 'Stairs/deck detected - NCC requires balustrades where fall height > 1m',
    suggestedItems: () => [{
      description: 'Stair balustrade - timber with glass infill',
      trade: 'Carpenter',
      category: 'Compliance',
      estimatedQty: 8,
      unit: 'LM',
      estimatedRate: 450,
      basis: 'Timber posts, glass infill panels, handrail - NCC compliant'
    }]
  },

  // === FINISHES ===
  {
    id: 'no-floor-coverings',
    category: 'finishes',
    severity: 'warning',
    title: 'No Floor Coverings',
    description: 'No carpet, timber, or vinyl flooring detected',
    condition: (analysis, items) => {
      const hasFlooring = items.some(i =>
        /carpet|timber\s*floor|vinyl|laminate|hybrid|floor\s*cover/i.test(i.description)
      );
      const hasTilesOnly = items.some(i => /floor\s*tile/i.test(i.description));
      return !hasFlooring && !hasTilesOnly;
    },
    reason: () => 'No floor finishes detected - client expects finished floors',
    suggestedItems: () => [
      {
        description: 'Carpet to bedrooms - mid-range',
        trade: 'General',
        category: 'Flooring',
        estimatedQty: 50,
        unit: 'M2',
        estimatedRate: 75,
        basis: 'Carpet, underlay, install to bedrooms'
      },
      {
        description: 'Hybrid flooring to living areas',
        trade: 'General',
        category: 'Flooring',
        estimatedQty: 60,
        unit: 'M2',
        estimatedRate: 85,
        basis: 'Hybrid plank flooring to living, dining, hallway'
      }
    ]
  },
  {
    id: 'no-skirting',
    category: 'finishes',
    severity: 'info',
    title: 'No Skirting/Architraves',
    description: 'No skirting or architraves detected',
    condition: (analysis, items) => {
      const hasSkirting = items.some(i =>
        /skirting|architrave|door\s*trim/i.test(i.description)
      );
      return !hasSkirting;
    },
    reason: () => 'Skirting and architraves typically required for finished appearance',
    suggestedItems: (analysis) => {
      const doors = analysis.summary.totalDoors || 10;
      return [
        {
          description: 'Skirting - 90mm MDF primed',
          trade: 'Carpenter',
          category: 'Finishes',
          estimatedQty: 120,
          unit: 'LM',
          estimatedRate: 18,
          basis: 'Supply, install, fill and sand - typical house perimeter'
        },
        {
          description: 'Architraves - 65mm MDF primed',
          trade: 'Carpenter',
          category: 'Finishes',
          estimatedQty: doors * 6,
          unit: 'LM',
          estimatedRate: 15,
          basis: `${doors} doors × 6LM each (both sides)`
        }
      ];
    }
  },
  {
    id: 'no-mirrors',
    category: 'finishes',
    severity: 'info',
    title: 'No Bathroom Mirrors',
    description: 'Bathrooms detected but no mirrors',
    condition: (analysis, items) => {
      const hasBathroom = analysis.pages.some(p =>
        p.rooms.some(r => /bathroom|ensuite/i.test(r.name))
      );
      const hasMirrors = items.some(i =>
        /mirror/i.test(i.description)
      );
      return hasBathroom && !hasMirrors;
    },
    reason: () => 'Bathrooms detected but no mirrors - client expectation',
    suggestedItems: (analysis) => {
      const bathCount = Math.max(1, analysis.pages.flatMap(p => p.rooms).filter(r => /bathroom|ensuite/i.test(r.name)).length);
      return [{
        description: 'Bathroom mirrors - frameless polished edge',
        trade: 'Glazier',
        category: 'Finishes',
        estimatedQty: bathCount,
        unit: 'each',
        estimatedRate: 350,
        basis: '900x750mm mirror, polished edges, adhesive fix'
      }];
    }
  },

  // === PRELIMINARIES (Critical but often missed) ===
  {
    id: 'no-site-costs',
    category: 'preliminaries',
    severity: 'critical',
    title: 'No Site/Preliminary Costs',
    description: 'No preliminaries or site establishment detected',
    condition: (analysis, items) => {
      const hasPrelims = items.some(i =>
        /prelim|site\s*estab|scaffold|skip|toilet\s*hire|temp\s*fence|site\s*shed/i.test(i.description)
      );
      return !hasPrelims;
    },
    reason: () => 'No site costs in estimate - these typically add 8-15% to project cost',
    suggestedItems: () => [
      {
        description: 'Site establishment - shed, toilet, temp power',
        trade: 'General',
        category: 'Preliminaries',
        estimatedQty: 1,
        unit: 'item',
        estimatedRate: 3500,
        basis: 'Site shed, portable toilet, temp power board setup'
      },
      {
        description: 'Scaffold hire - 12 weeks',
        trade: 'General',
        category: 'Preliminaries',
        estimatedQty: 12,
        unit: 'each',
        estimatedRate: 450,
        basis: '12 weeks × $450/week for typical house scaffold'
      },
      {
        description: 'Skip bins - construction waste',
        trade: 'General',
        category: 'Preliminaries',
        estimatedQty: 6,
        unit: 'each',
        estimatedRate: 650,
        basis: '6 × 6m³ skip bins throughout construction'
      },
      {
        description: 'Temporary fencing',
        trade: 'General',
        category: 'Preliminaries',
        estimatedQty: 60,
        unit: 'LM',
        estimatedRate: 35,
        basis: 'Temp fence hire for duration of build'
      },
      {
        description: 'Site supervision allowance',
        trade: 'General',
        category: 'Preliminaries',
        estimatedQty: 1,
        unit: 'allow',
        estimatedRate: 8000,
        basis: 'Site supervisor time, coordination, inspections'
      },
      {
        description: 'Final clean',
        trade: 'General',
        category: 'Preliminaries',
        estimatedQty: 1,
        unit: 'item',
        estimatedRate: 1500,
        basis: 'Builder\'s clean and final clean before handover'
      }
    ]
  },
  {
    id: 'no-certification',
    category: 'preliminaries',
    severity: 'critical',
    title: 'No Certification Costs',
    description: 'No certifier, engineer, or inspection fees detected',
    condition: (analysis, items) => {
      const hasCerts = items.some(i =>
        /certif|engineer|inspect|survey|BA\s*fee|DA\s*fee|CDC|approval/i.test(i.description.toLowerCase())
      );
      return !hasCerts;
    },
    reason: () => 'No certification or approval costs - these are mandatory',
    suggestedItems: () => [
      {
        description: 'Building certifier fees',
        trade: 'General',
        category: 'Compliance',
        estimatedQty: 1,
        unit: 'item',
        estimatedRate: 4500,
        basis: 'Private certifier - CDC, inspections, occupation certificate'
      },
      {
        description: 'Structural engineer',
        trade: 'General',
        category: 'Compliance',
        estimatedQty: 1,
        unit: 'item',
        estimatedRate: 3500,
        basis: 'Structural engineering design and certification'
      },
      {
        description: 'Energy rating assessment',
        trade: 'General',
        category: 'Compliance',
        estimatedQty: 1,
        unit: 'item',
        estimatedRate: 800,
        basis: 'NatHERS 6-star energy assessment'
      },
      {
        description: 'BASIX certificate (NSW) / Equiv',
        trade: 'General',
        category: 'Compliance',
        estimatedQty: 1,
        unit: 'item',
        estimatedRate: 400,
        basis: 'State sustainability compliance certificate'
      }
    ]
  }
];

// Main function to detect scope gaps
export function detectScopeGaps(
  analysis: PlanAnalysisResult,
  estimatedItems: EstimatedLineItem[]
): ScopeGap[] {
  const gaps: ScopeGap[] = [];

  for (const rule of SCOPE_GAP_RULES) {
    if (rule.condition(analysis, estimatedItems)) {
      gaps.push({
        id: rule.id,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        reason: rule.reason(analysis),
        suggestedItems: rule.suggestedItems(analysis),
        isAcknowledged: false,
        acknowledgedAs: null,
      });
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return gaps;
}

// Calculate total cost of suggested items for a gap
export function calculateGapCost(gap: ScopeGap): number {
  return gap.suggestedItems.reduce((sum, item) => {
    return sum + (item.estimatedQty * item.estimatedRate);
  }, 0);
}

// Calculate total cost of all unacknowledged gaps
export function calculateTotalGapRisk(gaps: ScopeGap[]): number {
  return gaps
    .filter(g => !g.isAcknowledged)
    .reduce((sum, gap) => sum + calculateGapCost(gap), 0);
}

// Get summary statistics
export function getGapSummary(gaps: ScopeGap[]): {
  critical: number;
  warning: number;
  info: number;
  acknowledged: number;
  totalRisk: number;
} {
  return {
    critical: gaps.filter(g => g.severity === 'critical' && !g.isAcknowledged).length,
    warning: gaps.filter(g => g.severity === 'warning' && !g.isAcknowledged).length,
    info: gaps.filter(g => g.severity === 'info' && !g.isAcknowledged).length,
    acknowledged: gaps.filter(g => g.isAcknowledged).length,
    totalRisk: calculateTotalGapRisk(gaps),
  };
}

// Convert suggested item to estimated line item
export function suggestedItemToEstimate(
  suggested: SuggestedItem,
  gapId: string
): EstimatedLineItem {
  const totalCost = suggested.estimatedQty * suggested.estimatedRate;
  return {
    id: `GAP-${gapId}-${Date.now()}`,
    trade: suggested.trade,
    category: suggested.category,
    description: suggested.description,
    quantity: suggested.estimatedQty,
    unit: suggested.unit as EstimatedLineItem['unit'],
    unitRate: suggested.estimatedRate,
    labourHours: 0, // Will be calculated based on trade
    materialCost: totalCost * 0.6,
    labourCost: totalCost * 0.4,
    totalCost,
    source: 'inferred',
    confidence: 0.7,
  };
}
