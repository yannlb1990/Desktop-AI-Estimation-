// Quote Analyzer & Confidence Scoring System
// Analyzes estimates for completeness, pricing, and risk factors

import { lookupNCCForSOW } from './nccLookup';

export interface LineItem {
  id: string;
  trade: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
  category?: string;
  nccCodes?: string[];
}

export interface QuoteAnalysis {
  confidenceScore: number; // 0-100
  confidenceLevel: 'low' | 'medium' | 'high' | 'very-high';
  risks: RiskItem[];
  warnings: WarningItem[];
  suggestions: SuggestionItem[];
  marginAnalysis: MarginAnalysis;
  completenessScore: number;
  pricingScore: number;
  complianceScore: number;
}

export interface RiskItem {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  suggestedAction?: string;
  estimatedImpact?: number;
}

export interface WarningItem {
  id: string;
  type: 'missing' | 'incomplete' | 'pricing' | 'compliance';
  title: string;
  description: string;
  lineItemId?: string;
}

export interface SuggestionItem {
  id: string;
  type: 'add' | 'modify' | 'review';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  estimatedCost?: number;
  lineItem?: Partial<LineItem>;
}

export interface MarginAnalysis {
  subtotal: number;
  overhead: number;
  overheadPercent: number;
  profit: number;
  profitPercent: number;
  totalQuote: number;
  effectiveMargin: number;
  effectiveMarkup: number;
  breakEvenPrice: number;
  suggestedPrices: {
    conservative: number;
    standard: number;
    premium: number;
  };
  industryComparison: {
    averageMargin: number;
    yourPosition: 'below' | 'average' | 'above';
    difference: number;
  };
}

// Industry standard margins by trade
const INDUSTRY_MARGINS: Record<string, { min: number; avg: number; max: number }> = {
  'Demolition': { min: 15, avg: 22, max: 30 },
  'Plumber': { min: 20, avg: 28, max: 40 },
  'Electrician': { min: 18, avg: 25, max: 35 },
  'Carpenter': { min: 18, avg: 25, max: 35 },
  'Tiler': { min: 20, avg: 28, max: 38 },
  'Painter': { min: 15, avg: 22, max: 32 },
  'Waterproofer': { min: 22, avg: 30, max: 42 },
  'Concreter': { min: 18, avg: 25, max: 35 },
  'Cabinet Maker': { min: 20, avg: 28, max: 38 },
  'Roofer': { min: 18, avg: 26, max: 36 },
  'Glazier': { min: 20, avg: 27, max: 36 },
  'default': { min: 18, avg: 25, max: 35 }
};

// Required items by project type
const REQUIRED_ITEMS_BY_TYPE: Record<string, string[]> = {
  'bathroom': [
    'waterproofing',
    'plumbing rough-in',
    'plumbing fit-off',
    'tiling',
    'electrical',
    'exhaust fan',
    'toilet',
    'vanity',
    'shower'
  ],
  'kitchen': [
    'demolition',
    'plumbing',
    'electrical',
    'cabinetry',
    'benchtop',
    'splashback',
    'appliances'
  ],
  'deck': [
    'footings',
    'subframe',
    'decking',
    'balustrade',
    'stairs'
  ],
  'granny-flat': [
    'slab',
    'framing',
    'roofing',
    'cladding',
    'windows',
    'insulation',
    'plumbing',
    'electrical',
    'linings',
    'waterproofing',
    'painting'
  ]
};

// Compliance requirements by work type
const COMPLIANCE_REQUIREMENTS: Record<string, { nccCode: string; description: string }[]> = {
  'waterproofing': [
    { nccCode: 'F1.7', description: 'Waterproofing membrane required in wet areas' }
  ],
  'wet area': [
    { nccCode: 'F1.7', description: 'Waterproofing certificate required' },
    { nccCode: 'F1.9', description: 'Adequate floor drainage required' }
  ],
  'electrical': [
    { nccCode: 'G6.1', description: 'RCD protection required' },
    { nccCode: 'G6.2', description: 'Electrical safety compliance' }
  ],
  'structure': [
    { nccCode: 'B1.2', description: 'Structural adequacy required' },
    { nccCode: 'B1.4', description: 'Structural framing compliance' }
  ],
  'fire': [
    { nccCode: 'C1.1', description: 'Fire resistance requirements' },
    { nccCode: 'C2.2', description: 'Fire detection/alarm requirements' }
  ],
  'balustrade': [
    { nccCode: 'D2.16', description: 'Balustrade height and gaps compliance' },
    { nccCode: 'D2.17', description: 'Handrail requirements' }
  ],
  'insulation': [
    { nccCode: 'H6.2', description: 'Building insulation requirements (R-values)' }
  ],
  'glazing': [
    { nccCode: 'J1.1', description: 'Glazing energy efficiency' }
  ]
};

/**
 * Analyze a quote for completeness, risks, and pricing
 */
export function analyzeQuote(
  lineItems: LineItem[],
  projectType: string,
  targetMarginPercent: number = 25,
  overheadPercent: number = 10
): QuoteAnalysis {
  const risks: RiskItem[] = [];
  const warnings: WarningItem[] = [];
  const suggestions: SuggestionItem[] = [];

  // Calculate subtotal
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

  // Check for completeness
  const completenessResult = checkCompleteness(lineItems, projectType, warnings, suggestions);

  // Check for pricing issues
  const pricingResult = checkPricing(lineItems, warnings, risks);

  // Check for compliance issues
  const complianceResult = checkCompliance(lineItems, projectType, warnings, suggestions);

  // Calculate margin analysis
  const marginAnalysis = calculateMarginAnalysis(
    subtotal,
    targetMarginPercent,
    overheadPercent,
    lineItems
  );

  // Generate risk items
  generateRiskItems(lineItems, projectType, risks, marginAnalysis);

  // Calculate confidence score
  const { score, level } = calculateConfidenceScore(
    completenessResult.score,
    pricingResult.score,
    complianceResult.score,
    risks,
    warnings
  );

  return {
    confidenceScore: score,
    confidenceLevel: level,
    risks,
    warnings,
    suggestions,
    marginAnalysis,
    completenessScore: completenessResult.score,
    pricingScore: pricingResult.score,
    complianceScore: complianceResult.score
  };
}

/**
 * Check quote completeness against project type requirements
 */
function checkCompleteness(
  lineItems: LineItem[],
  projectType: string,
  warnings: WarningItem[],
  suggestions: SuggestionItem[]
): { score: number } {
  const requiredItems = REQUIRED_ITEMS_BY_TYPE[projectType.toLowerCase()] || [];
  let foundCount = 0;

  const itemDescriptions = lineItems.map(item =>
    `${item.trade} ${item.description}`.toLowerCase()
  );

  requiredItems.forEach((required, index) => {
    const found = itemDescriptions.some(desc => desc.includes(required.toLowerCase()));
    if (found) {
      foundCount++;
    } else {
      warnings.push({
        id: `missing-${index}`,
        type: 'missing',
        title: `Missing: ${required}`,
        description: `This ${projectType} project typically requires ${required} work. Consider adding this to your quote.`
      });

      suggestions.push({
        id: `add-${index}`,
        type: 'add',
        priority: 'high',
        title: `Add ${required}`,
        description: `Consider adding ${required} to ensure complete scope coverage.`
      });
    }
  });

  const score = requiredItems.length > 0
    ? Math.round((foundCount / requiredItems.length) * 100)
    : 100;

  return { score };
}

/**
 * Check for pricing anomalies
 */
function checkPricing(
  lineItems: LineItem[],
  warnings: WarningItem[],
  risks: RiskItem[]
): { score: number } {
  let issues = 0;
  const totalItems = lineItems.length;

  lineItems.forEach((item, index) => {
    // Check for zero or very low rates
    if (item.rate === 0) {
      issues++;
      warnings.push({
        id: `zero-rate-${index}`,
        type: 'pricing',
        title: `Zero rate: ${item.description}`,
        description: 'This item has a zero rate. Is this intentional?',
        lineItemId: item.id
      });
    } else if (item.rate < 10 && item.unit !== 'ea') {
      issues++;
      warnings.push({
        id: `low-rate-${index}`,
        type: 'pricing',
        title: `Low rate: ${item.description}`,
        description: `Rate of $${item.rate}/${item.unit} seems low. Please verify.`,
        lineItemId: item.id
      });
    }

    // Check for unusually high quantities
    if (item.quantity > 1000 && !['m²', 'lm'].includes(item.unit)) {
      issues++;
      warnings.push({
        id: `high-qty-${index}`,
        type: 'pricing',
        title: `High quantity: ${item.description}`,
        description: `Quantity of ${item.quantity} ${item.unit} seems high. Please verify.`,
        lineItemId: item.id
      });
    }

    // Check for missing quantities
    if (item.quantity === 0 && item.rate > 0) {
      issues++;
      risks.push({
        id: `zero-qty-${index}`,
        severity: 'medium',
        category: 'Pricing',
        title: `Zero quantity: ${item.description}`,
        description: 'This item has a rate but zero quantity.',
        suggestedAction: 'Enter the correct quantity or remove this item'
      });
    }
  });

  const score = totalItems > 0
    ? Math.round(((totalItems - issues) / totalItems) * 100)
    : 100;

  return { score };
}

/**
 * Check for NCC/BCA compliance requirements
 */
function checkCompliance(
  lineItems: LineItem[],
  projectType: string,
  warnings: WarningItem[],
  suggestions: SuggestionItem[]
): { score: number } {
  const itemDescriptions = lineItems.map(item =>
    `${item.trade} ${item.description} ${item.category || ''}`.toLowerCase()
  );
  const allText = itemDescriptions.join(' ');

  let requiredCompliance: string[] = [];
  let foundCompliance: string[] = [];

  // Check what work types are present
  Object.entries(COMPLIANCE_REQUIREMENTS).forEach(([workType, requirements]) => {
    if (allText.includes(workType)) {
      requirements.forEach(req => {
        requiredCompliance.push(req.nccCode);

        // Check if compliance item exists
        const hasComplianceItem = lineItems.some(item =>
          item.nccCodes?.includes(req.nccCode) ||
          item.description.toLowerCase().includes('certificate') ||
          item.description.toLowerCase().includes('compliance')
        );

        if (hasComplianceItem) {
          foundCompliance.push(req.nccCode);
        } else {
          warnings.push({
            id: `compliance-${req.nccCode}`,
            type: 'compliance',
            title: `NCC ${req.nccCode} - ${req.description}`,
            description: `This project includes ${workType} work which requires NCC ${req.nccCode} compliance.`
          });

          suggestions.push({
            id: `add-compliance-${req.nccCode}`,
            type: 'add',
            priority: 'high',
            title: `Add compliance item for NCC ${req.nccCode}`,
            description: req.description
          });
        }
      });
    }
  });

  // Special check for waterproofing certificate
  if (allText.includes('bathroom') || allText.includes('wet area') || allText.includes('shower')) {
    const hasWPCert = lineItems.some(item =>
      item.description.toLowerCase().includes('waterproof') &&
      item.description.toLowerCase().includes('certificate')
    );

    if (!hasWPCert) {
      suggestions.push({
        id: 'add-wp-cert',
        type: 'add',
        priority: 'high',
        title: 'Add Waterproofing Certificate',
        description: 'Wet area work requires a waterproofing compliance certificate from a licensed waterproofer.',
        estimatedCost: 150,
        lineItem: {
          trade: 'Waterproofer',
          description: 'Waterproofing Compliance Certificate',
          quantity: 1,
          unit: 'ea',
          rate: 150
        }
      });
    }
  }

  const score = requiredCompliance.length > 0
    ? Math.round((foundCompliance.length / requiredCompliance.length) * 100)
    : 100;

  return { score };
}

/**
 * Calculate margin analysis
 */
function calculateMarginAnalysis(
  subtotal: number,
  targetMarginPercent: number,
  overheadPercent: number,
  lineItems: LineItem[]
): MarginAnalysis {
  const overhead = subtotal * (overheadPercent / 100);
  const costBase = subtotal + overhead;

  // Calculate for target margin
  const profit = costBase * (targetMarginPercent / 100);
  const totalQuote = costBase + profit;

  // Effective margin = profit / total quote
  const effectiveMargin = (profit / totalQuote) * 100;

  // Effective markup = profit / cost base
  const effectiveMarkup = (profit / costBase) * 100;

  // Break-even price (just covers costs + overhead)
  const breakEvenPrice = costBase;

  // Suggested prices at different margin levels
  const suggestedPrices = {
    conservative: costBase * 1.15, // 15% margin
    standard: costBase * 1.25,     // 25% margin
    premium: costBase * 1.35       // 35% margin
  };

  // Get average industry margin based on trades in quote
  const trades = [...new Set(lineItems.map(item => item.trade))];
  let totalAvgMargin = 0;
  trades.forEach(trade => {
    const margin = INDUSTRY_MARGINS[trade] || INDUSTRY_MARGINS['default'];
    totalAvgMargin += margin.avg;
  });
  const avgIndustryMargin = trades.length > 0 ? totalAvgMargin / trades.length : 25;

  return {
    subtotal,
    overhead,
    overheadPercent,
    profit,
    profitPercent: targetMarginPercent,
    totalQuote,
    effectiveMargin,
    effectiveMarkup,
    breakEvenPrice,
    suggestedPrices,
    industryComparison: {
      averageMargin: avgIndustryMargin,
      yourPosition: effectiveMargin < avgIndustryMargin - 3 ? 'below'
                  : effectiveMargin > avgIndustryMargin + 3 ? 'above'
                  : 'average',
      difference: effectiveMargin - avgIndustryMargin
    }
  };
}

/**
 * Generate risk items based on analysis
 */
function generateRiskItems(
  lineItems: LineItem[],
  projectType: string,
  risks: RiskItem[],
  marginAnalysis: MarginAnalysis
): void {
  // Check for margin too low
  if (marginAnalysis.effectiveMargin < 15) {
    risks.push({
      id: 'margin-low',
      severity: 'high',
      category: 'Financial',
      title: 'Low Profit Margin',
      description: `Your effective margin is ${marginAnalysis.effectiveMargin.toFixed(1)}%, which is below the industry minimum of 15%.`,
      suggestedAction: 'Consider increasing your quote by at least ' +
        ((marginAnalysis.suggestedPrices.conservative - marginAnalysis.totalQuote).toFixed(0)),
      estimatedImpact: marginAnalysis.suggestedPrices.conservative - marginAnalysis.totalQuote
    });
  }

  // Check for no provisional sum
  const hasProvisional = lineItems.some(item =>
    item.description.toLowerCase().includes('provisional') ||
    item.description.toLowerCase().includes('contingency') ||
    item.description.toLowerCase().includes('allowance')
  );

  if (!hasProvisional && lineItems.length > 5) {
    risks.push({
      id: 'no-contingency',
      severity: 'medium',
      category: 'Scope',
      title: 'No Contingency/Provisional Sum',
      description: 'This quote has no contingency for unforeseen issues.',
      suggestedAction: 'Add 5-10% contingency for unexpected conditions',
      estimatedImpact: marginAnalysis.subtotal * 0.05
    });
  }

  // Check for demolition without waste removal
  const hasDemolition = lineItems.some(item =>
    item.description.toLowerCase().includes('demolition') ||
    item.description.toLowerCase().includes('strip out')
  );
  const hasWasteRemoval = lineItems.some(item =>
    item.description.toLowerCase().includes('waste') ||
    item.description.toLowerCase().includes('skip') ||
    item.description.toLowerCase().includes('disposal')
  );

  if (hasDemolition && !hasWasteRemoval) {
    risks.push({
      id: 'no-waste-removal',
      severity: 'medium',
      category: 'Scope',
      title: 'Demolition without Waste Removal',
      description: 'Demolition is included but no waste removal line item.',
      suggestedAction: 'Add skip bin / waste removal',
      estimatedImpact: 450
    });
  }

  // Check for plumbing without compliance certificate
  const hasPlumbing = lineItems.some(item =>
    item.trade.toLowerCase() === 'plumber' ||
    item.description.toLowerCase().includes('plumbing')
  );
  const hasPlumbingCert = lineItems.some(item =>
    item.description.toLowerCase().includes('plumbing') &&
    item.description.toLowerCase().includes('certificate')
  );

  if (hasPlumbing && !hasPlumbingCert) {
    risks.push({
      id: 'no-plumbing-cert',
      severity: 'low',
      category: 'Compliance',
      title: 'No Plumbing Compliance Certificate',
      description: 'Plumbing work typically requires a compliance certificate.',
      suggestedAction: 'Confirm if certificate is included in plumbing rate'
    });
  }
}

/**
 * Calculate overall confidence score
 */
function calculateConfidenceScore(
  completenessScore: number,
  pricingScore: number,
  complianceScore: number,
  risks: RiskItem[],
  warnings: WarningItem[]
): { score: number; level: 'low' | 'medium' | 'high' | 'very-high' } {
  // Weight the scores
  let baseScore = (
    completenessScore * 0.35 +
    pricingScore * 0.35 +
    complianceScore * 0.30
  );

  // Deduct for risks
  risks.forEach(risk => {
    switch (risk.severity) {
      case 'critical': baseScore -= 15; break;
      case 'high': baseScore -= 10; break;
      case 'medium': baseScore -= 5; break;
      case 'low': baseScore -= 2; break;
    }
  });

  // Deduct for warnings (less impact)
  baseScore -= warnings.length * 1.5;

  // Clamp to 0-100
  const score = Math.max(0, Math.min(100, Math.round(baseScore)));

  // Determine level
  let level: 'low' | 'medium' | 'high' | 'very-high';
  if (score >= 85) level = 'very-high';
  else if (score >= 70) level = 'high';
  else if (score >= 50) level = 'medium';
  else level = 'low';

  return { score, level };
}

/**
 * Quick margin calculator for simple use
 */
export function calculateQuickMargin(
  costTotal: number,
  quotePrice: number
): {
  grossProfit: number;
  marginPercent: number;
  markupPercent: number;
} {
  const grossProfit = quotePrice - costTotal;
  const marginPercent = quotePrice > 0 ? (grossProfit / quotePrice) * 100 : 0;
  const markupPercent = costTotal > 0 ? (grossProfit / costTotal) * 100 : 0;

  return {
    grossProfit,
    marginPercent,
    markupPercent
  };
}

/**
 * Calculate quote price from cost and target margin
 */
export function calculateQuotePrice(
  costTotal: number,
  targetMarginPercent: number
): number {
  // Margin = (Price - Cost) / Price
  // So: Price = Cost / (1 - Margin)
  return costTotal / (1 - targetMarginPercent / 100);
}

/**
 * Calculate quote price from cost and target markup
 */
export function calculateQuotePriceFromMarkup(
  costTotal: number,
  markupPercent: number
): number {
  return costTotal * (1 + markupPercent / 100);
}
