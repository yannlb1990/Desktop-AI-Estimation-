export type MaterialType =
  | 'Structural'
  | 'Connector'
  | 'Framing'
  | 'Lining'
  | 'Finish'
  | 'Hardware'
  | 'Plumbing'
  | 'Electrical'
  | 'Other';

export interface ExtractedMaterial {
  floor: string;
  room: string;
  material: string;
  materialType: MaterialType;
  quantity: number;
  unit: string;
}

export interface MaterialExtractionResult {
  success: boolean;
  items: ExtractedMaterial[];
  totalItems: number;
  chunksProcessed: number;
  error?: string;
}
