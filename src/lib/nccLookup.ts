// NCC Code Auto-Lookup System
// Maps SOW types to relevant NCC codes based on keywords

import { NCC_REFERENCES, NCCReference } from '@/data/nccReferences';

// SOW to NCC keyword mappings
const SOW_NCC_MAPPINGS: Record<string, string[]> = {
  // Framing
  "Wall Framing": ["structure", "structural", "framing", "timber"],
  "Roof Framing": ["structure", "structural", "roof", "bracing"],
  "Floor Frame": ["structure", "structural", "floor", "loads"],
  "Steel Framing": ["structure", "structural", "steel", "BCA"],

  // Waterproofing
  "Waterproofing": ["waterproofing", "wet area", "membrane", "moisture"],
  "Bathroom": ["wet area", "waterproofing", "bathroom", "shower"],
  "Shower": ["wet area", "waterproofing", "shower", "membrane"],
  "Laundry": ["wet area", "waterproofing", "laundry"],

  // Fire Safety
  "Fire Rating": ["fire", "FRL", "fire resistance", "fire walls"],
  "Fire Door": ["fire", "door", "fire resistance"],
  "Fire Collar": ["fire", "penetration", "fire protection"],

  // Electrical
  "Electrical": ["electrical", "wiring", "safety", "AS3000"],
  "Power Point": ["electrical", "wiring"],
  "Light Point": ["electrical", "lighting"],
  "Switchboard": ["electrical", "safety"],

  // Plumbing
  "Plumbing": ["plumbing", "drainage", "water", "sanitary"],
  "Drainage": ["drainage", "plumbing", "sanitary"],
  "Hot Water": ["plumbing", "water", "energy"],

  // Insulation & Energy
  "Insulation": ["insulation", "thermal", "energy", "R-value"],
  "Thermal": ["thermal", "insulation", "energy rating"],
  "Glazing": ["glazing", "windows", "thermal", "energy"],

  // Access
  "Disability Access": ["access", "disability", "mobility", "DDA"],
  "Handrail": ["access", "handrail", "balustrade", "safety"],
  "Ramp": ["access", "disability", "ramp"],

  // External
  "Deck": ["balustrade", "handrail", "external"],
  "Balcony": ["balustrade", "external", "structure"],
  "Cladding": ["external", "cladding", "weatherproofing"],
  "Roofing": ["roof", "external", "weatherproofing"],

  // Concrete
  "Concrete": ["structure", "concrete", "foundations", "footings"],
  "Slab": ["structure", "concrete", "slab", "foundations"],
  "Footings": ["structure", "foundations", "footings"],
};

// Category to NCC section mappings
const CATEGORY_NCC_MAPPINGS: Record<string, string[]> = {
  "Framing": ["B1.2", "B1.4"],
  "First Fix": ["B2.2", "G6.1"],
  "Fit Out": ["D1.8", "D2.13"],
  "External": ["B2.2", "F4.1"],
  "Wet Areas": ["B2.3", "F4.1"],
  "Fire": ["C1.1", "C2.2"],
  "Energy": ["J1.1", "J3.2"],
};

export interface NCCLookupResult {
  references: NCCReference[];
  primaryCode: string | null;
  relevanceScore: number;
}

/**
 * Auto-lookup NCC codes for a given SOW item
 */
export function lookupNCCForSOW(
  sowName: string,
  category: string,
  description: string = ""
): NCCLookupResult {
  const searchTerms: string[] = [];

  // Get keywords from SOW name mapping
  Object.entries(SOW_NCC_MAPPINGS).forEach(([key, keywords]) => {
    if (sowName.toLowerCase().includes(key.toLowerCase())) {
      searchTerms.push(...keywords);
    }
  });

  // Add category keywords
  const categoryKeywords = CATEGORY_NCC_MAPPINGS[category];
  if (categoryKeywords) {
    searchTerms.push(...categoryKeywords);
  }

  // Add words from SOW name and description
  const allWords = `${sowName} ${description}`.toLowerCase().split(/\s+/);
  searchTerms.push(...allWords.filter(w => w.length > 3));

  // Score each NCC reference
  const scoredRefs = NCC_REFERENCES.map(ref => {
    let score = 0;
    const refKeywords = ref.keywords.map(k => k.toLowerCase());
    const refTitle = ref.title.toLowerCase();
    const refDesc = ref.description.toLowerCase();

    searchTerms.forEach(term => {
      if (refKeywords.some(k => k.includes(term) || term.includes(k))) {
        score += 3;
      }
      if (refTitle.includes(term)) {
        score += 2;
      }
      if (refDesc.includes(term)) {
        score += 1;
      }
    });

    // Bonus for exact ID match
    if (categoryKeywords?.includes(ref.id)) {
      score += 5;
    }

    return { ref, score };
  });

  // Filter and sort by score
  const relevantRefs = scoredRefs
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ ref }) => ref);

  const maxScore = scoredRefs.length > 0
    ? Math.max(...scoredRefs.map(r => r.score))
    : 0;

  return {
    references: relevantRefs,
    primaryCode: relevantRefs.length > 0 ? relevantRefs[0].id : null,
    relevanceScore: Math.min(maxScore / 10, 1) // Normalize to 0-1
  };
}

/**
 * Get NCC reference by ID
 */
export function getNCCByCode(code: string): NCCReference | undefined {
  return NCC_REFERENCES.find(ref => ref.id === code);
}

/**
 * Search NCC references by keyword
 */
export function searchNCC(query: string): NCCReference[] {
  const terms = query.toLowerCase().split(/\s+/);

  return NCC_REFERENCES.filter(ref => {
    const searchText = `${ref.title} ${ref.keywords.join(' ')} ${ref.description} ${ref.section}`.toLowerCase();
    return terms.some(term => searchText.includes(term));
  });
}

/**
 * Get all unique NCC categories
 */
export function getNCCCategories(): string[] {
  return [...new Set(NCC_REFERENCES.map(ref => ref.category))];
}
