// NCC/BCA Compliance Checker
// Automatically checks estimates against National Construction Code requirements
// and suggests missing compliance items

import { NCC_REFERENCES, NCCReference } from '@/data/nccReferences';

export interface ComplianceCheckResult {
  isCompliant: boolean;
  score: number; // 0-100
  requiredItems: ComplianceRequirement[];
  missingItems: ComplianceRequirement[];
  presentItems: ComplianceRequirement[];
  warnings: ComplianceWarning[];
  suggestions: ComplianceSuggestion[];
}

export interface ComplianceRequirement {
  id: string;
  nccCode: string;
  nccTitle: string;
  category: string;
  requirement: string;
  description: string;
  isMandatory: boolean;
  estimatedCost?: number;
  suggestedLineItem?: {
    trade: string;
    sow: string;
    description: string;
    unit: string;
    rate: number;
  };
}

export interface ComplianceWarning {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  nccCode: string;
  title: string;
  description: string;
  affectedItems?: string[];
}

export interface ComplianceSuggestion {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'add' | 'modify' | 'review';
  title: string;
  description: string;
  nccReference?: string;
  estimatedCost?: number;
  lineItem?: {
    trade: string;
    sow: string;
    description: string;
    unit: string;
    qty: number;
    rate: number;
  };
}

// Work type to NCC requirements mapping
const WORK_TYPE_REQUIREMENTS: Record<string, ComplianceRequirement[]> = {
  'bathroom': [
    {
      id: 'bath-wp-1',
      nccCode: 'F1.7',
      nccTitle: 'Wet Area Waterproofing',
      category: 'Wet Areas',
      requirement: 'Waterproofing Membrane',
      description: 'Waterproofing membrane must be applied to shower floors, walls to 1800mm above floor, and bathroom floor',
      isMandatory: true,
      estimatedCost: 1200,
      suggestedLineItem: {
        trade: 'Waterproofer',
        sow: 'Waterproofing Membrane',
        description: 'Apply waterproofing membrane to shower and wet areas per AS3740',
        unit: 'm²',
        rate: 85
      }
    },
    {
      id: 'bath-wp-cert',
      nccCode: 'F1.7',
      nccTitle: 'Wet Area Waterproofing',
      category: 'Wet Areas',
      requirement: 'Waterproofing Certificate',
      description: 'Licensed waterproofer must provide certificate of compliance',
      isMandatory: true,
      estimatedCost: 150,
      suggestedLineItem: {
        trade: 'Waterproofer',
        sow: 'Waterproofing Certificate',
        description: 'Supply waterproofing compliance certificate',
        unit: 'ea',
        rate: 150
      }
    },
    {
      id: 'bath-exhaust',
      nccCode: 'F4.5',
      nccTitle: 'Ventilation',
      category: 'Ventilation',
      requirement: 'Exhaust Fan',
      description: 'Bathroom must have mechanical ventilation exhausting to outside',
      isMandatory: true,
      estimatedCost: 380,
      suggestedLineItem: {
        trade: 'Electrician',
        sow: 'Exhaust Fan',
        description: 'Supply and install exhaust fan with timer or humidity sensor',
        unit: 'ea',
        rate: 380
      }
    },
    {
      id: 'bath-drain',
      nccCode: 'F1.9',
      nccTitle: 'Floor Drainage',
      category: 'Wet Areas',
      requirement: 'Floor Waste',
      description: 'Bathroom floor must have adequate drainage with floor waste',
      isMandatory: true,
      estimatedCost: 250,
      suggestedLineItem: {
        trade: 'Plumber',
        sow: 'Floor Waste',
        description: 'Supply and install floor waste with trap',
        unit: 'ea',
        rate: 250
      }
    }
  ],

  'shower': [
    {
      id: 'shower-wp',
      nccCode: 'F1.7',
      nccTitle: 'Wet Area Waterproofing',
      category: 'Wet Areas',
      requirement: 'Shower Waterproofing',
      description: 'Shower recess must be waterproofed including floor, walls to 1800mm, and hob',
      isMandatory: true,
      estimatedCost: 850,
      suggestedLineItem: {
        trade: 'Waterproofer',
        sow: 'Shower Waterproofing',
        description: 'Waterproof shower recess floor and walls per AS3740',
        unit: 'm²',
        rate: 95
      }
    },
    {
      id: 'shower-screen',
      nccCode: 'B1.1',
      nccTitle: 'Safety Glass',
      category: 'Glazing',
      requirement: 'Safety Glass Shower Screen',
      description: 'Shower screens must be safety glass (toughened or laminated)',
      isMandatory: true,
      estimatedCost: 1100,
      suggestedLineItem: {
        trade: 'Glazier',
        sow: 'Shower Screen',
        description: 'Supply and install safety glass shower screen',
        unit: 'ea',
        rate: 1100
      }
    }
  ],

  'laundry': [
    {
      id: 'laundry-wp',
      nccCode: 'F1.7',
      nccTitle: 'Wet Area Waterproofing',
      category: 'Wet Areas',
      requirement: 'Laundry Waterproofing',
      description: 'Laundry floor within 1.5m of appliances and trough must be waterproofed',
      isMandatory: true,
      estimatedCost: 450,
      suggestedLineItem: {
        trade: 'Waterproofer',
        sow: 'Laundry Waterproofing',
        description: 'Waterproof laundry floor to wet areas per AS3740',
        unit: 'm²',
        rate: 75
      }
    },
    {
      id: 'laundry-drain',
      nccCode: 'F1.9',
      nccTitle: 'Floor Drainage',
      category: 'Wet Areas',
      requirement: 'Floor Waste',
      description: 'Laundry requires floor waste for drainage',
      isMandatory: true,
      estimatedCost: 220,
      suggestedLineItem: {
        trade: 'Plumber',
        sow: 'Floor Waste',
        description: 'Supply and install floor waste',
        unit: 'ea',
        rate: 220
      }
    }
  ],

  'deck': [
    {
      id: 'deck-bal',
      nccCode: 'D2.16',
      nccTitle: 'Balustrades',
      category: 'Safety',
      requirement: 'Balustrade',
      description: 'Balustrade required where deck height exceeds 1m above ground. Min height 1m, max gap 125mm',
      isMandatory: true,
      estimatedCost: 3500,
      suggestedLineItem: {
        trade: 'Carpenter',
        sow: 'Balustrade',
        description: 'Supply and install compliant balustrade per NCC D2.16',
        unit: 'lm',
        rate: 280
      }
    },
    {
      id: 'deck-handrail',
      nccCode: 'D2.17',
      nccTitle: 'Handrails',
      category: 'Safety',
      requirement: 'Stair Handrail',
      description: 'Handrail required on stairs with 4 or more risers',
      isMandatory: true,
      estimatedCost: 450,
      suggestedLineItem: {
        trade: 'Carpenter',
        sow: 'Stair Handrail',
        description: 'Supply and install handrail to stairs per NCC D2.17',
        unit: 'lm',
        rate: 150
      }
    },
    {
      id: 'deck-structure',
      nccCode: 'B1.4',
      nccTitle: 'Structural Timber',
      category: 'Structure',
      requirement: 'Structural Compliance',
      description: 'Deck structure must comply with AS1684 or engineering design',
      isMandatory: true,
      suggestedLineItem: {
        trade: 'Engineer',
        sow: 'Engineering Certification',
        description: 'Engineering design and certification for deck structure',
        unit: 'ea',
        rate: 850
      }
    }
  ],

  'electrical': [
    {
      id: 'elec-rcd',
      nccCode: 'G6.2',
      nccTitle: 'RCD Protection',
      category: 'Electrical Safety',
      requirement: 'RCD Safety Switch',
      description: 'All power and lighting circuits must be RCD protected',
      isMandatory: true,
      estimatedCost: 360,
      suggestedLineItem: {
        trade: 'Electrician',
        sow: 'RCD Safety Switches',
        description: 'Supply and install RCD safety switches for all circuits',
        unit: 'ea',
        rate: 180
      }
    },
    {
      id: 'elec-smoke',
      nccCode: 'G6.5',
      nccTitle: 'Smoke Alarms',
      category: 'Fire Safety',
      requirement: 'Smoke Alarms',
      description: 'Interconnected smoke alarms required in all bedrooms, hallways, and each level',
      isMandatory: true,
      estimatedCost: 450,
      suggestedLineItem: {
        trade: 'Electrician',
        sow: 'Smoke Alarms',
        description: 'Supply and install interconnected smoke alarms per NCC requirements',
        unit: 'ea',
        rate: 150
      }
    },
    {
      id: 'elec-cert',
      nccCode: 'G6.1',
      nccTitle: 'Electrical Safety',
      category: 'Compliance',
      requirement: 'Electrical Certificate',
      description: 'Compliance certificate required for all electrical work',
      isMandatory: true,
      estimatedCost: 150,
      suggestedLineItem: {
        trade: 'Electrician',
        sow: 'Electrical Compliance Certificate',
        description: 'Issue certificate of electrical compliance',
        unit: 'ea',
        rate: 150
      }
    }
  ],

  'plumbing': [
    {
      id: 'plumb-cert',
      nccCode: 'B1.4',
      nccTitle: 'Plumbing Compliance',
      category: 'Compliance',
      requirement: 'Plumbing Certificate',
      description: 'Compliance certificate required for all plumbing work',
      isMandatory: true,
      estimatedCost: 150,
      suggestedLineItem: {
        trade: 'Plumber',
        sow: 'Plumbing Compliance Certificate',
        description: 'Issue certificate of plumbing compliance',
        unit: 'ea',
        rate: 150
      }
    },
    {
      id: 'plumb-backflow',
      nccCode: 'B1.4',
      nccTitle: 'Backflow Prevention',
      category: 'Water Safety',
      requirement: 'Backflow Prevention',
      description: 'Backflow prevention required on water supply connections',
      isMandatory: false,
      estimatedCost: 280,
      suggestedLineItem: {
        trade: 'Plumber',
        sow: 'Backflow Prevention Valve',
        description: 'Supply and install backflow prevention device',
        unit: 'ea',
        rate: 280
      }
    }
  ],

  'insulation': [
    {
      id: 'ins-walls',
      nccCode: 'H6.2',
      nccTitle: 'Building Insulation',
      category: 'Energy',
      requirement: 'Wall Insulation',
      description: 'External walls require minimum R2.0 insulation (climate zone dependent)',
      isMandatory: true,
      suggestedLineItem: {
        trade: 'Insulation',
        sow: 'Wall Insulation',
        description: 'Supply and install wall insulation batts (minimum R2.5)',
        unit: 'm²',
        rate: 18
      }
    },
    {
      id: 'ins-ceiling',
      nccCode: 'H6.2',
      nccTitle: 'Building Insulation',
      category: 'Energy',
      requirement: 'Ceiling Insulation',
      description: 'Ceiling requires minimum R4.0 insulation (climate zone dependent)',
      isMandatory: true,
      suggestedLineItem: {
        trade: 'Insulation',
        sow: 'Ceiling Insulation',
        description: 'Supply and install ceiling insulation batts (minimum R4.0)',
        unit: 'm²',
        rate: 22
      }
    }
  ],

  'glazing': [
    {
      id: 'glaze-safety',
      nccCode: 'J1.1',
      nccTitle: 'Glazing',
      category: 'Safety',
      requirement: 'Safety Glazing',
      description: 'Safety glass required in doors, sidelights, and areas of risk',
      isMandatory: true,
      suggestedLineItem: {
        trade: 'Glazier',
        sow: 'Safety Glass',
        description: 'Supply and install safety glass (toughened/laminated)',
        unit: 'm²',
        rate: 250
      }
    },
    {
      id: 'glaze-energy',
      nccCode: 'J1.1',
      nccTitle: 'Glazing Energy',
      category: 'Energy',
      requirement: 'Energy Efficient Glazing',
      description: 'Glazing must meet energy efficiency requirements for climate zone',
      isMandatory: true,
      suggestedLineItem: {
        trade: 'Glazier',
        sow: 'Double Glazed Windows',
        description: 'Supply and install energy efficient double glazed windows',
        unit: 'ea',
        rate: 850
      }
    }
  ],

  'fire': [
    {
      id: 'fire-wall',
      nccCode: 'C1.1',
      nccTitle: 'Fire Separation',
      category: 'Fire Safety',
      requirement: 'Fire Rated Wall',
      description: 'Fire rated wall required between dwelling and garage',
      isMandatory: true,
      suggestedLineItem: {
        trade: 'Plasterer',
        sow: 'Fire Rated Wall',
        description: 'Install fire rated plasterboard system (FRL 60/60/60)',
        unit: 'm²',
        rate: 85
      }
    },
    {
      id: 'fire-door',
      nccCode: 'C3.4',
      nccTitle: 'Fire Doors',
      category: 'Fire Safety',
      requirement: 'Fire Door',
      description: 'Self-closing fire door required between dwelling and attached garage',
      isMandatory: true,
      estimatedCost: 850,
      suggestedLineItem: {
        trade: 'Carpenter',
        sow: 'Fire Door',
        description: 'Supply and install self-closing fire door with frame',
        unit: 'ea',
        rate: 850
      }
    }
  ],

  'access': [
    {
      id: 'access-entry',
      nccCode: 'D3.1',
      nccTitle: 'Access for People with Disabilities',
      category: 'Accessibility',
      requirement: 'Accessible Entry',
      description: 'At least one accessible entry with continuous path of travel',
      isMandatory: false, // Depends on building class
      suggestedLineItem: {
        trade: 'Builder',
        sow: 'Accessible Entry',
        description: 'Construct step-free accessible entry per AS1428',
        unit: 'allow',
        rate: 2500
      }
    },
    {
      id: 'access-handrail',
      nccCode: 'D2.17',
      nccTitle: 'Handrails',
      category: 'Accessibility',
      requirement: 'Handrails',
      description: 'Handrails required on stairs and ramps',
      isMandatory: true,
      suggestedLineItem: {
        trade: 'Carpenter',
        sow: 'Handrails',
        description: 'Supply and install handrails per NCC requirements',
        unit: 'lm',
        rate: 120
      }
    }
  ]
};

// Keywords to detect work types from line items
const WORK_TYPE_KEYWORDS: Record<string, string[]> = {
  'bathroom': ['bathroom', 'ensuite', 'toilet', 'wc', 'basin', 'vanity'],
  'shower': ['shower', 'shower screen', 'shower recess'],
  'laundry': ['laundry', 'washing machine', 'trough'],
  'deck': ['deck', 'decking', 'balcony', 'verandah', 'veranda', 'pergola'],
  'electrical': ['electrical', 'wiring', 'switchboard', 'gpo', 'power point', 'lights'],
  'plumbing': ['plumbing', 'drainage', 'water supply', 'sewer'],
  'insulation': ['insulation', 'batts', 'r-value'],
  'glazing': ['window', 'glazing', 'glass', 'sliding door'],
  'fire': ['fire', 'garage', 'attached garage', 'fire rated'],
  'access': ['accessible', 'disability', 'ramp', 'mobility']
};

export interface EstimateLineItem {
  id: string;
  trade: string;
  sow: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  category?: string;
}

/**
 * Check an estimate for NCC compliance
 */
export function checkNccCompliance(
  lineItems: EstimateLineItem[],
  projectType?: string
): ComplianceCheckResult {
  const allItemText = lineItems.map(item =>
    `${item.trade} ${item.sow} ${item.description} ${item.category || ''}`.toLowerCase()
  ).join(' ');

  // Detect work types present in estimate
  const detectedWorkTypes: string[] = [];
  Object.entries(WORK_TYPE_KEYWORDS).forEach(([workType, keywords]) => {
    if (keywords.some(keyword => allItemText.includes(keyword))) {
      detectedWorkTypes.push(workType);
    }
  });

  // If project type is specified, ensure it's included
  if (projectType) {
    const normalizedType = projectType.toLowerCase();
    Object.entries(WORK_TYPE_KEYWORDS).forEach(([workType, keywords]) => {
      if (keywords.some(keyword => normalizedType.includes(keyword))) {
        if (!detectedWorkTypes.includes(workType)) {
          detectedWorkTypes.push(workType);
        }
      }
    });
  }

  // Gather all applicable requirements
  const requiredItems: ComplianceRequirement[] = [];
  detectedWorkTypes.forEach(workType => {
    const requirements = WORK_TYPE_REQUIREMENTS[workType] || [];
    requirements.forEach(req => {
      if (!requiredItems.some(r => r.id === req.id)) {
        requiredItems.push(req);
      }
    });
  });

  // Check which requirements are met
  const presentItems: ComplianceRequirement[] = [];
  const missingItems: ComplianceRequirement[] = [];

  requiredItems.forEach(requirement => {
    const isPresent = checkRequirementPresent(lineItems, requirement);
    if (isPresent) {
      presentItems.push(requirement);
    } else {
      missingItems.push(requirement);
    }
  });

  // Generate warnings for missing mandatory items
  const warnings: ComplianceWarning[] = [];
  missingItems.forEach(item => {
    if (item.isMandatory) {
      warnings.push({
        id: `warn-${item.id}`,
        severity: 'critical',
        nccCode: item.nccCode,
        title: `Missing: ${item.requirement}`,
        description: item.description
      });
    }
  });

  // Generate suggestions for missing items
  const suggestions: ComplianceSuggestion[] = [];
  missingItems.forEach(item => {
    suggestions.push({
      id: `suggest-${item.id}`,
      priority: item.isMandatory ? 'critical' : 'medium',
      type: 'add',
      title: `Add ${item.requirement}`,
      description: item.description,
      nccReference: `NCC ${item.nccCode}: ${item.nccTitle}`,
      estimatedCost: item.estimatedCost,
      lineItem: item.suggestedLineItem ? {
        trade: item.suggestedLineItem.trade,
        sow: item.suggestedLineItem.sow,
        description: item.suggestedLineItem.description,
        unit: item.suggestedLineItem.unit,
        qty: 1,
        rate: item.suggestedLineItem.rate
      } : undefined
    });
  });

  // Calculate compliance score
  const mandatoryItems = requiredItems.filter(r => r.isMandatory);
  const mandatoryPresent = presentItems.filter(r => r.isMandatory);
  const score = mandatoryItems.length > 0
    ? Math.round((mandatoryPresent.length / mandatoryItems.length) * 100)
    : 100;

  const isCompliant = missingItems.filter(r => r.isMandatory).length === 0;

  return {
    isCompliant,
    score,
    requiredItems,
    missingItems,
    presentItems,
    warnings,
    suggestions
  };
}

/**
 * Check if a requirement is present in the line items
 */
function checkRequirementPresent(
  lineItems: EstimateLineItem[],
  requirement: ComplianceRequirement
): boolean {
  const allText = lineItems.map(item =>
    `${item.trade} ${item.sow} ${item.description}`.toLowerCase()
  ).join(' ');

  // Check for specific keywords based on requirement type
  const requirementLower = requirement.requirement.toLowerCase();

  // Specific checks for different requirement types
  if (requirementLower.includes('waterproofing membrane')) {
    return allText.includes('waterproof') &&
           (allText.includes('membrane') || allText.includes('as3740'));
  }

  if (requirementLower.includes('waterproofing certificate')) {
    return allText.includes('waterproof') && allText.includes('certificate');
  }

  if (requirementLower.includes('exhaust fan')) {
    return allText.includes('exhaust') || allText.includes('ventilation');
  }

  if (requirementLower.includes('floor waste')) {
    return allText.includes('floor waste') || allText.includes('floor drain');
  }

  if (requirementLower.includes('balustrade')) {
    return allText.includes('balustrade') || allText.includes('handrail');
  }

  if (requirementLower.includes('rcd')) {
    return allText.includes('rcd') || allText.includes('safety switch');
  }

  if (requirementLower.includes('smoke alarm')) {
    return allText.includes('smoke') && (allText.includes('alarm') || allText.includes('detector'));
  }

  if (requirementLower.includes('certificate')) {
    return allText.includes('certificate') || allText.includes('compliance');
  }

  if (requirementLower.includes('insulation')) {
    return allText.includes('insulation') || allText.includes('batts');
  }

  if (requirementLower.includes('fire door')) {
    return allText.includes('fire') && allText.includes('door');
  }

  if (requirementLower.includes('fire rated wall')) {
    return allText.includes('fire') && (allText.includes('rated') || allText.includes('frl'));
  }

  if (requirementLower.includes('safety glass')) {
    return allText.includes('safety glass') || allText.includes('toughened') || allText.includes('laminated');
  }

  // Generic check - look for key words from the requirement
  const keyWords = requirementLower.split(' ').filter(w => w.length > 3);
  return keyWords.some(word => allText.includes(word));
}

/**
 * Get NCC reference by code
 */
export function getNccReference(code: string): NCCReference | undefined {
  return NCC_REFERENCES.find(ref => ref.id === code);
}

/**
 * Get all requirements for a work type
 */
export function getRequirementsForWorkType(workType: string): ComplianceRequirement[] {
  return WORK_TYPE_REQUIREMENTS[workType.toLowerCase()] || [];
}

/**
 * Get detected work types from line items
 */
export function detectWorkTypes(lineItems: EstimateLineItem[]): string[] {
  const allText = lineItems.map(item =>
    `${item.trade} ${item.sow} ${item.description}`.toLowerCase()
  ).join(' ');

  const detectedTypes: string[] = [];
  Object.entries(WORK_TYPE_KEYWORDS).forEach(([workType, keywords]) => {
    if (keywords.some(keyword => allText.includes(keyword))) {
      detectedTypes.push(workType);
    }
  });

  return detectedTypes;
}
