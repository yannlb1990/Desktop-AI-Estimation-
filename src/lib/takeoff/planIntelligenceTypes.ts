export type NoteType = 'critical' | 'warning' | 'specification' | 'verify' | 'general';
export type SpecCategory =
  | 'Timber' | 'Concrete' | 'Steel' | 'Masonry' | 'Insulation'
  | 'Glazing' | 'Waterproofing' | 'Fixings' | 'Roofing' | 'Fire'
  | 'Energy' | 'Acoustic' | 'Plumbing' | 'Electrical' | 'Other';
export type ActionPriority = 'high' | 'medium' | 'low';

export interface PlanNote {
  type: NoteType;
  content: string;
  location?: string;
  trade?: string;
}

export interface MaterialSpec {
  category: SpecCategory;
  specification: string;
  value?: string;
  standard?: string;
  locations?: string[];
}

export interface StandardRef {
  code: string;
  title: string;
  context: string;
  compliance_required: boolean;
}

export interface ActionItem {
  priority: ActionPriority;
  action: string;
  reason: string;
  trade?: string;
}

export interface PlanIntelligenceResult {
  success: boolean;
  notes: PlanNote[];
  specifications: MaterialSpec[];
  standards: StandardRef[];
  action_items: ActionItem[];
  chunksProcessed: number;
  error?: string;
}
