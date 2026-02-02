// Enhanced Material Lookup Service
// Connects material pricing database to estimation engine
// Handles "material not found" gracefully with alternatives

import {
  SAMPLE_MATERIAL_PRICES,
  MaterialPrice,
  searchMaterials,
  comparePrices,
} from './materialPricing';
import { MaterialLookupResult } from './calculationAudit';

// Material name aliases for better matching
const MATERIAL_ALIASES: Record<string, string[]> = {
  // Timber framing
  'timber wall framing': ['90x45 MGP10', '90x45 pine', 'wall stud', 'timber stud'],
  'timber floor framing': ['140x45 MGP10', 'floor joist', 'bearer', 'joist'],
  'timber roof framing': ['90x45 MGP10', 'roof truss', 'rafter', 'timber truss'],

  // Linings
  'plasterboard walls': ['plasterboard 10mm', 'gyprock', 'drywall'],
  'plasterboard ceiling': ['plasterboard 10mm', 'ceiling board', 'gyprock'],
  'villaboard wet area': ['plasterboard wet area', 'wet area board', 'tile underlay'],

  // Concrete
  'concrete slab': ['concrete 25mpa', 'concrete 32mpa', 'ready mix concrete'],
  'concrete footing': ['concrete 25mpa', 'footing concrete'],

  // Roofing
  'metal roofing': ['colorbond roofing', 'roof sheet', 'trimdek', 'klip-lok'],
  'tile roofing': ['concrete roof tile', 'terracotta tile'],

  // Electrical
  'power point': ['gpo', 'double gpo', 'powerpoint'],
  'light point': ['led downlight', 'light fitting', 'downlight'],

  // Plumbing
  'basin': ['vanity', 'bathroom sink', 'hand basin'],
  'toilet': ['wc', 'toilet suite', 'pan'],
  'shower': ['shower base', 'shower screen', 'shower tray'],

  // Tiling
  'floor tiles': ['floor tile 600x600', 'ceramic floor tile', 'porcelain tile'],
  'wall tiles': ['wall tile 300x600', 'ceramic wall tile', 'feature tile'],

  // Insulation
  'ceiling insulation': ['ceiling batts', 'r4.0 batts', 'roof insulation'],
  'wall insulation': ['wall batts', 'r2.5 batts'],
};

// Rate mappings from AUSTRALIAN_RATES to material database categories
const RATE_TO_MATERIAL_MAPPING: Record<string, { category: string; searchTerms: string[] }> = {
  'Timber wall framing': { category: 'Timber & Framing', searchTerms: ['90x45 MGP10', '90x45 pine'] },
  'Steel wall framing': { category: 'Timber & Framing', searchTerms: ['steel stud', 'light gauge steel'] },
  'Timber floor framing': { category: 'Timber & Framing', searchTerms: ['140x45', 'joist', 'bearer'] },
  'Timber roof framing': { category: 'Timber & Framing', searchTerms: ['90x45', 'truss', 'rafter'] },
  'Plasterboard walls': { category: 'Plasterboard & Linings', searchTerms: ['plasterboard 10mm', 'gyprock'] },
  'Plasterboard ceiling': { category: 'Plasterboard & Linings', searchTerms: ['plasterboard 10mm', 'ceiling'] },
  'Villaboard wet area': { category: 'Plasterboard & Linings', searchTerms: ['wet area', 'villaboard'] },
  'Brick veneer': { category: 'Bricks & Blocks', searchTerms: ['face brick', 'brick'] },
  'Render': { category: 'Paint & Finishes', searchTerms: ['render', 'acrylic render'] },
  'Weatherboard cladding': { category: 'Roofing & Cladding', searchTerms: ['weatherboard', 'cladding'] },
  'Metal cladding': { category: 'Roofing & Cladding', searchTerms: ['metal cladding', 'colorbond wall'] },
  'Concrete slab': { category: 'Concrete & Cement', searchTerms: ['concrete 25mpa', 'concrete 32mpa'] },
  'Concrete footing': { category: 'Concrete & Cement', searchTerms: ['concrete', 'footing'] },
  'Metal roofing': { category: 'Roofing & Cladding', searchTerms: ['colorbond roofing', 'roof sheet'] },
  'Tile roofing': { category: 'Roofing & Cladding', searchTerms: ['roof tile', 'concrete tile'] },
  'Fascia & gutter': { category: 'Roofing & Cladding', searchTerms: ['fascia', 'gutter', 'quad gutter'] },
  'Wet area waterproofing': { category: 'Paint & Finishes', searchTerms: ['waterproofing', 'membrane'] },
  'Internal door': { category: 'Doors & Windows', searchTerms: ['internal door', 'hollow core door'] },
  'External door': { category: 'Doors & Windows', searchTerms: ['external door', 'entry door', 'solid door'] },
  'Sliding door': { category: 'Doors & Windows', searchTerms: ['sliding door', 'glass door'] },
  'Window (standard)': { category: 'Doors & Windows', searchTerms: ['awning window', 'window'] },
  'Window (large)': { category: 'Doors & Windows', searchTerms: ['sliding window', 'picture window'] },
  'Power point': { category: 'Electrical', searchTerms: ['gpo', 'power point', 'double gpo'] },
  'Light point': { category: 'Electrical', searchTerms: ['led downlight', 'light fitting', 'downlight'] },
  'Switch': { category: 'Electrical', searchTerms: ['light switch', 'switch', 'clipsal'] },
  'Basin': { category: 'Bathroom Fixtures', searchTerms: ['vanity', 'basin', 'sink'] },
  'Toilet': { category: 'Bathroom Fixtures', searchTerms: ['toilet suite', 'wc', 'pan'] },
  'Shower': { category: 'Bathroom Fixtures', searchTerms: ['shower', 'shower screen'] },
  'Bath': { category: 'Bathroom Fixtures', searchTerms: ['bath', 'bathtub', 'freestanding bath'] },
  'Floor tiles': { category: 'Tiles & Stone', searchTerms: ['floor tile 600x600', 'floor tile'] },
  'Wall tiles': { category: 'Tiles & Stone', searchTerms: ['wall tile 300x600', 'wall tile'] },
  'Paint walls': { category: 'Paint & Finishes', searchTerms: ['interior paint', 'wall paint'] },
  'Paint ceiling': { category: 'Paint & Finishes', searchTerms: ['ceiling paint', 'flat paint'] },
  'Paint trim': { category: 'Paint & Finishes', searchTerms: ['trim paint', 'gloss paint', 'enamel'] },
};

/**
 * Enhanced material lookup with fuzzy matching and alternatives
 */
export function lookupMaterial(
  rateKey: string,
  materials: MaterialPrice[] = SAMPLE_MATERIAL_PRICES
): MaterialLookupResult {
  // Try direct search first
  let matches = searchMaterials(materials, rateKey);

  // If no matches, try the mapping
  if (matches.length === 0) {
    const mapping = RATE_TO_MATERIAL_MAPPING[rateKey];
    if (mapping) {
      for (const term of mapping.searchTerms) {
        matches = searchMaterials(materials, term);
        if (matches.length > 0) break;
      }

      // If still no matches, get all from category
      if (matches.length === 0) {
        matches = materials.filter(m => m.category === mapping.category);
      }
    }
  }

  // If no matches, try aliases
  if (matches.length === 0) {
    const lowerKey = rateKey.toLowerCase();
    for (const [key, aliases] of Object.entries(MATERIAL_ALIASES)) {
      if (lowerKey.includes(key) || key.includes(lowerKey)) {
        for (const alias of aliases) {
          matches = searchMaterials(materials, alias);
          if (matches.length > 0) break;
        }
        if (matches.length > 0) break;
      }
    }
  }

  // Found materials
  if (matches.length > 0) {
    // Sort by price
    const sorted = [...matches].sort((a, b) => a.basePrice - b.basePrice);
    const bestMatch = sorted[0];

    return {
      found: true,
      materialName: bestMatch.name,
      searchedName: rateKey,
      supplier: bestMatch.supplier,
      unitPrice: bestMatch.basePrice,
      priceUnit: `$/${bestMatch.unit}`,
      lastUpdated: bestMatch.lastUpdated,
      alternatives: sorted.slice(1, 4).map(m => ({
        name: m.name,
        supplier: m.supplier,
        price: m.basePrice,
        unit: m.unit,
      })),
    };
  }

  // Not found - provide helpful suggestions
  const suggestions = getSuggestions(rateKey, materials);

  return {
    found: false,
    materialName: `${rateKey} (not found in database)`,
    searchedName: rateKey,
    reason: `No material matching "${rateKey}" found in the pricing database. Using default rates from Rawlinsons 2024.`,
    alternatives: suggestions.map(m => ({
      name: m.name,
      supplier: m.supplier,
      price: m.basePrice,
      unit: m.unit,
    })),
  };
}

/**
 * Get suggestions for similar materials
 */
function getSuggestions(query: string, materials: MaterialPrice[]): MaterialPrice[] {
  const words = query.toLowerCase().split(/\s+/);
  const scored = materials.map(m => {
    let score = 0;
    const nameLower = m.name.toLowerCase();
    const catLower = m.category.toLowerCase();

    for (const word of words) {
      if (word.length < 3) continue;
      if (nameLower.includes(word)) score += 2;
      if (catLower.includes(word)) score += 1;
    }

    return { material: m, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.material);
}

/**
 * Lookup multiple materials at once
 */
export function lookupMaterials(
  rateKeys: string[],
  materials: MaterialPrice[] = SAMPLE_MATERIAL_PRICES
): Map<string, MaterialLookupResult> {
  const results = new Map<string, MaterialLookupResult>();

  for (const key of rateKeys) {
    results.set(key, lookupMaterial(key, materials));
  }

  return results;
}

/**
 * Get all materials not found in a lookup
 */
export function getMissingMaterials(
  lookupResults: Map<string, MaterialLookupResult>
): string[] {
  const missing: string[] = [];

  for (const [key, result] of lookupResults.entries()) {
    if (!result.found) {
      missing.push(key);
    }
  }

  return missing;
}

/**
 * Calculate total potential savings from alternatives
 */
export function calculatePotentialSavings(
  lookupResults: Map<string, MaterialLookupResult>,
  quantities: Map<string, number>
): {
  totalCurrentCost: number;
  totalBestPrice: number;
  potentialSavings: number;
  itemSavings: Array<{
    item: string;
    currentSupplier: string;
    currentPrice: number;
    bestSupplier: string;
    bestPrice: number;
    savings: number;
    quantity: number;
  }>;
} {
  let totalCurrentCost = 0;
  let totalBestPrice = 0;
  const itemSavings: Array<{
    item: string;
    currentSupplier: string;
    currentPrice: number;
    bestSupplier: string;
    bestPrice: number;
    savings: number;
    quantity: number;
  }> = [];

  for (const [key, result] of lookupResults.entries()) {
    const quantity = quantities.get(key) || 1;

    if (result.found && result.unitPrice) {
      const currentCost = result.unitPrice * quantity;
      totalCurrentCost += currentCost;

      // Check if there's a cheaper alternative
      if (result.alternatives && result.alternatives.length > 0) {
        const cheaper = result.alternatives.filter(a => a.price < result.unitPrice!);
        if (cheaper.length > 0) {
          const best = cheaper[0];
          const bestCost = best.price * quantity;
          totalBestPrice += bestCost;

          itemSavings.push({
            item: key,
            currentSupplier: result.supplier!,
            currentPrice: result.unitPrice,
            bestSupplier: best.supplier,
            bestPrice: best.price,
            savings: currentCost - bestCost,
            quantity,
          });
        } else {
          totalBestPrice += currentCost;
        }
      } else {
        totalBestPrice += currentCost;
      }
    }
  }

  return {
    totalCurrentCost,
    totalBestPrice,
    potentialSavings: totalCurrentCost - totalBestPrice,
    itemSavings: itemSavings.sort((a, b) => b.savings - a.savings),
  };
}

/**
 * Format material lookup result for display
 */
export function formatLookupResult(result: MaterialLookupResult): string {
  const lines: string[] = [];

  if (result.found) {
    lines.push(`Found: ${result.materialName}`);
    lines.push(`Price: ${result.unitPrice?.toFixed(2)} ${result.priceUnit}`);
    lines.push(`Supplier: ${result.supplier}`);
    lines.push(`Updated: ${result.lastUpdated?.toLocaleDateString() || 'N/A'}`);

    if (result.alternatives && result.alternatives.length > 0) {
      lines.push('');
      lines.push('Alternatives:');
      for (const alt of result.alternatives) {
        lines.push(`  - ${alt.name}: $${alt.price.toFixed(2)}/${alt.unit} (${alt.supplier})`);
      }
    }
  } else {
    lines.push(`NOT FOUND: ${result.searchedName}`);
    lines.push(`Reason: ${result.reason}`);

    if (result.alternatives && result.alternatives.length > 0) {
      lines.push('');
      lines.push('Similar materials you might mean:');
      for (const alt of result.alternatives) {
        lines.push(`  - ${alt.name}: $${alt.price.toFixed(2)}/${alt.unit} (${alt.supplier})`);
      }
    }
  }

  return lines.join('\n');
}

// Export default materials for use elsewhere
export { SAMPLE_MATERIAL_PRICES };
