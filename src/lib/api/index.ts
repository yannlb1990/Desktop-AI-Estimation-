// API Layer - Central Export
// Provides unified access to all API functions

// ==================================================
// MARKET INSIGHTS (Existing)
// ==================================================
export {
  // Material Search
  searchMaterials,
  getSuppliersForState,

  // Labour Rates
  getLabourRate,
  getLabourRateDetails,
  getAllLabourRates,
  getLabourRatesByCategory,

  // SOW Rates
  getSOWRateForState,
  getSOWRateDetails,
  getAllSOWRatesList,
  getSOWRatesForTrade,
  getSOWRatesForCategory,
  searchSOWRates,

  // Data Freshness
  getDataFreshnessStatus,
  isAllDataFresh,

  // Types
  type AustralianState,
  type LabourRate,
  type SOWRate,
  type Supplier,
  type StateSuppliers,
  type MaterialSearchResult,
  type MaterialSearchResponse,
  type LabourRateResponse,
  type SOWRateResponse,
  type DataFreshnessStatus,
} from './marketInsights';

// ==================================================
// ESTIMATE API
// ==================================================
export { estimateApi } from './estimateApi';
export type {
  Estimate,
  EstimateLineItem,
  CreateEstimateInput,
  UpdateEstimateInput,
  AddLineItemInput,
} from './estimateApi';

// ==================================================
// PROJECT API
// ==================================================
export { projectApi } from './projectApi';
export type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectStats,
} from './projectApi';

// ==================================================
// SUPPLIER API
// ==================================================
export { supplierApi } from './supplierApi';
export type {
  Supplier as SupplierFull,
  SupplierQuoteRequest,
  QuoteRequestItem,
  CreateSupplierInput,
  CreateQuoteRequestInput,
} from './supplierApi';

// ==================================================
// WEBHOOK API
// ==================================================
export { webhookApi, webhookTrigger } from './webhooks';
export type {
  Webhook,
  WebhookDelivery,
  WebhookPayload,
  WebhookEventType,
  CreateWebhookInput,
} from './webhooks';

// ==================================================
// MARKET INSIGHTS API (Extended)
// ==================================================
export { marketInsightsApi, DEFAULT_LABOUR_RATES, DEFAULT_SOW_RATES } from './marketInsightsApi';
export type {
  AustralianState as AusState,
  LabourRate as LabourRateExtended,
  SOWRate as SOWRateExtended,
  MaterialPrice,
  SupplierInfo,
  PriceWebhook,
} from './marketInsightsApi';

// ==================================================
// PDF EXTRACTION API
// ==================================================
export {
  pdfExtractionApi,
  isPDFExtractionAvailable,
  getPageText,
  getPageDimensions,
  calculateTotalArea,
} from './pdfExtractionApi';
export type {
  LayoutElementType,
  BoundingBox,
  LayoutElement,
  OCRResult,
  TableCell,
  ExtractedTable,
  DimensionExtraction,
  PageAnalysis,
  ExtractionResponse,
  ExtractionOptions,
  HealthStatus,
} from './pdfExtractionApi';

// ==================================================
// GENERIC RESPONSE TYPE
// ==================================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ==================================================
// API UTILITIES
// ==================================================
export const apiUtils = {
  /**
   * Handle API response with callbacks
   */
  handleResponse<T>(
    response: ApiResponse<T>,
    onSuccess?: (data: T) => void,
    onError?: (error: string) => void
  ): T | null {
    if (response.success && response.data) {
      onSuccess?.(response.data);
      return response.data;
    } else {
      onError?.(response.error || 'An error occurred');
      return null;
    }
  },

  /**
   * Batch multiple API calls
   */
  async batch<T>(calls: Promise<ApiResponse<T>>[]): Promise<{ results: T[]; errors: string[] }> {
    const responses = await Promise.all(calls);
    const results: T[] = [];
    const errors: string[] = [];

    responses.forEach(response => {
      if (response.success && response.data) {
        results.push(response.data);
      } else if (response.error) {
        errors.push(response.error);
      }
    });

    return { results, errors };
  },

  /**
   * Retry API call with exponential backoff
   */
  async withRetry<T>(
    call: () => Promise<ApiResponse<T>>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<ApiResponse<T>> {
    let lastError: string = '';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await call();

      if (response.success) {
        return response;
      }

      lastError = response.error || 'Unknown error';

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }

    return { success: false, error: `Failed after ${maxRetries} attempts: ${lastError}` };
  },

  /**
   * Format currency for display (AUD)
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  /**
   * Format date for AU locale
   */
  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  },

  /**
   * Calculate GST (10%)
   */
  calculateGST(amount: number): { gst: number; total: number } {
    const gst = amount * 0.1;
    return { gst, total: amount + gst };
  },

  /**
   * Calculate margin percentage
   */
  calculateMargin(cost: number, sellPrice: number): number {
    if (sellPrice === 0) return 0;
    return ((sellPrice - cost) / sellPrice) * 100;
  },

  /**
   * Calculate markup percentage
   */
  calculateMarkup(cost: number, sellPrice: number): number {
    if (cost === 0) return 0;
    return ((sellPrice - cost) / cost) * 100;
  },
};
