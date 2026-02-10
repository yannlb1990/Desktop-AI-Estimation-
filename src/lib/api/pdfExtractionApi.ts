// PDF Extraction API - Client for PDF-Extract-Kit backend
// Provides unified interface for PDF content extraction

// API Configuration
const PDF_EXTRACTION_API_URL = import.meta.env.VITE_PDF_API_URL || 'http://localhost:8000';

// ============================================
// Types
// ============================================

export type LayoutElementType =
  | 'text'
  | 'title'
  | 'table'
  | 'figure'
  | 'caption'
  | 'header'
  | 'footer'
  | 'dimension'
  | 'annotation'
  | 'drawing_element';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface LayoutElement {
  id: string;
  type: LayoutElementType;
  bbox: BoundingBox;
  text?: string;
  page: number;
  metadata?: Record<string, unknown>;
}

export interface OCRResult {
  text: string;
  bbox: BoundingBox;
  confidence: number;
  page: number;
}

export interface TableCell {
  row: number;
  col: number;
  text: string;
  bbox?: BoundingBox;
  rowspan?: number;
  colspan?: number;
}

export interface ExtractedTable {
  id: string;
  page: number;
  bbox: BoundingBox;
  rows: number;
  cols: number;
  cells: TableCell[];
  html?: string;
}

export interface DimensionExtraction {
  id: string;
  value: number;
  unit: string;
  text: string;
  bbox: BoundingBox;
  page: number;
  dimension_type: 'linear' | 'area' | 'angular' | 'radius' | 'diameter';
}

export interface PageAnalysis {
  page_number: number;
  width: number;
  height: number;
  layout_elements: LayoutElement[];
  ocr_results: OCRResult[];
  tables: ExtractedTable[];
  dimensions: DimensionExtraction[];
}

export interface ExtractionResponse {
  filename: string;
  total_pages: number;
  pages: PageAnalysis[];
  processing_time_ms: number;
  errors: string[];
}

export interface ExtractionOptions {
  extractLayout?: boolean;
  extractText?: boolean;
  extractTables?: boolean;
  extractDimensions?: boolean;
  pages?: number[];
  dpi?: number;
}

export interface HealthStatus {
  status: string;
  version: string;
  models_loaded: Record<string, boolean>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// PDF Extraction API
// ============================================

export const pdfExtractionApi = {
  /**
   * Check API health and model status
   */
  async health(): Promise<ApiResponse<HealthStatus>> {
    try {
      const response = await fetch(`${PDF_EXTRACTION_API_URL}/health`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to connect to PDF extraction API: ${message}`
      };
    }
  },

  /**
   * Extract content from a PDF file
   */
  async extractPDF(
    file: File,
    options: ExtractionOptions = {}
  ): Promise<ApiResponse<ExtractionResponse>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Build query params
      const params = new URLSearchParams();
      if (options.extractLayout !== undefined) {
        params.append('extract_layout', String(options.extractLayout));
      }
      if (options.extractText !== undefined) {
        params.append('extract_text', String(options.extractText));
      }
      if (options.extractTables !== undefined) {
        params.append('extract_tables', String(options.extractTables));
      }
      if (options.extractDimensions !== undefined) {
        params.append('extract_dimensions', String(options.extractDimensions));
      }
      if (options.pages && options.pages.length > 0) {
        params.append('pages', options.pages.join(','));
      }
      if (options.dpi) {
        params.append('dpi', String(options.dpi));
      }

      const url = `${PDF_EXTRACTION_API_URL}/extract?${params.toString()}`;

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `API returned ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `PDF extraction failed: ${message}`
      };
    }
  },

  /**
   * Extract content from an image file
   */
  async extractImage(
    file: File,
    options: Omit<ExtractionOptions, 'extractTables' | 'pages' | 'dpi'> = {}
  ): Promise<ApiResponse<PageAnalysis>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const params = new URLSearchParams();
      if (options.extractLayout !== undefined) {
        params.append('extract_layout', String(options.extractLayout));
      }
      if (options.extractText !== undefined) {
        params.append('extract_text', String(options.extractText));
      }
      if (options.extractDimensions !== undefined) {
        params.append('extract_dimensions', String(options.extractDimensions));
      }

      const url = `${PDF_EXTRACTION_API_URL}/extract/image?${params.toString()}`;

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `API returned ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Image extraction failed: ${message}`
      };
    }
  },

  /**
   * Extract content from multiple PDF files
   */
  async extractBatch(
    files: File[]
  ): Promise<ApiResponse<{ results: ExtractionResponse[] }>> {
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`${PDF_EXTRACTION_API_URL}/extract/batch`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `API returned ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Batch extraction failed: ${message}`
      };
    }
  },

  /**
   * Convert dimension to meters (for measurement normalization)
   */
  normalizeDimension(dimension: DimensionExtraction): number {
    const { value, unit } = dimension;
    const lowerUnit = unit.toLowerCase();

    // Convert to meters
    if (lowerUnit === 'mm') return value / 1000;
    if (lowerUnit === 'cm') return value / 100;
    if (lowerUnit === 'm' || lowerUnit === 'metre' || lowerUnit === 'meter') return value;
    if (lowerUnit === 'km') return value * 1000;
    if (lowerUnit === 'in' || lowerUnit === 'inch') return value * 0.0254;
    if (lowerUnit === 'ft' || lowerUnit === 'foot' || lowerUnit === 'feet') return value * 0.3048;
    if (lowerUnit === 'yd' || lowerUnit === 'yard') return value * 0.9144;

    // Area units
    if (lowerUnit === 'sqm' || lowerUnit === 'm2' || lowerUnit === 'm²') return value;
    if (lowerUnit === 'sqft') return value * 0.092903;

    return value; // Default: assume meters
  },

  /**
   * Group OCR results into logical text blocks
   */
  groupTextBlocks(ocrResults: OCRResult[]): OCRResult[][] {
    if (ocrResults.length === 0) return [];

    // Sort by Y position, then X
    const sorted = [...ocrResults].sort((a, b) => {
      const yDiff = a.bbox.y - b.bbox.y;
      if (Math.abs(yDiff) > 10) return yDiff;
      return a.bbox.x - b.bbox.x;
    });

    const groups: OCRResult[][] = [];
    let currentGroup: OCRResult[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const prev = sorted[i - 1];

      // Check if on same line (within threshold)
      const sameLineThreshold = Math.max(current.bbox.height, prev.bbox.height) * 0.5;
      const yDiff = Math.abs(current.bbox.y - prev.bbox.y);

      if (yDiff <= sameLineThreshold) {
        currentGroup.push(current);
      } else {
        groups.push(currentGroup);
        currentGroup = [current];
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  },

  /**
   * Find dimensions near a specific location
   */
  findNearbyDimensions(
    dimensions: DimensionExtraction[],
    x: number,
    y: number,
    radius: number = 100
  ): DimensionExtraction[] {
    return dimensions.filter((dim) => {
      const centerX = dim.bbox.x + dim.bbox.width / 2;
      const centerY = dim.bbox.y + dim.bbox.height / 2;
      const distance = Math.sqrt(Math.pow(centerX - x, 2) + Math.pow(centerY - y, 2));
      return distance <= radius;
    });
  },

  /**
   * Extract table data as 2D array
   */
  tableToArray(table: ExtractedTable): string[][] {
    const result: string[][] = Array.from({ length: table.rows }, () =>
      Array(table.cols).fill('')
    );

    table.cells.forEach((cell) => {
      if (cell.row < table.rows && cell.col < table.cols) {
        result[cell.row][cell.col] = cell.text;
      }
    });

    return result;
  },

  /**
   * Find tables containing BOQ/schedule data
   */
  findBOQTables(tables: ExtractedTable[]): ExtractedTable[] {
    const boqKeywords = [
      'qty', 'quantity', 'unit', 'rate', 'amount', 'total',
      'item', 'description', 'schedule', 'bill', 'boq',
      'material', 'labour', 'cost', 'price'
    ];

    return tables.filter((table) => {
      const headerCells = table.cells.filter((cell) => cell.row === 0);
      const headerText = headerCells.map((c) => c.text.toLowerCase()).join(' ');
      return boqKeywords.some((keyword) => headerText.includes(keyword));
    });
  },
};

// ============================================
// Utility Functions
// ============================================

/**
 * Check if the PDF extraction API is available
 */
export async function isPDFExtractionAvailable(): Promise<boolean> {
  const result = await pdfExtractionApi.health();
  return result.success && result.data?.status === 'healthy';
}

/**
 * Get combined text from all OCR results on a page
 */
export function getPageText(page: PageAnalysis): string {
  return page.ocr_results
    .sort((a, b) => {
      const yDiff = a.bbox.y - b.bbox.y;
      if (Math.abs(yDiff) > 10) return yDiff;
      return a.bbox.x - b.bbox.x;
    })
    .map((r) => r.text)
    .join(' ');
}

/**
 * Find all dimensions on a page with optional filtering
 */
export function getPageDimensions(
  page: PageAnalysis,
  type?: DimensionExtraction['dimension_type']
): DimensionExtraction[] {
  if (!type) return page.dimensions;
  return page.dimensions.filter((d) => d.dimension_type === type);
}

/**
 * Calculate total area from dimension extractions
 */
export function calculateTotalArea(dimensions: DimensionExtraction[]): number {
  const areaDimensions = dimensions.filter(
    (d) => d.dimension_type === 'area'
  );
  return areaDimensions.reduce(
    (sum, d) => sum + pdfExtractionApi.normalizeDimension(d),
    0
  );
}
