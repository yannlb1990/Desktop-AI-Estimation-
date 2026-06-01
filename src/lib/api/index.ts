// Edge function client
export { callEdge, EdgeFunctionError } from './client';
export type { EdgeError } from './client';

// Typed edge function wrappers
export { redirectToStripeCheckout, cancelSubscription } from './stripe';
export { inviteTeamMember, acceptTeamInvite } from './team';
export { onboardUser } from './auth';
export type { OnboardReq } from './auth';

// PDF Extraction API
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const apiUtils = {
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  },

  calculateGST(amount: number): { gst: number; total: number } {
    const gst = amount * 0.1;
    return { gst, total: amount + gst };
  },

  calculateMargin(cost: number, sellPrice: number): number {
    if (sellPrice === 0) return 0;
    return ((sellPrice - cost) / sellPrice) * 100;
  },

  calculateMarkup(cost: number, sellPrice: number): number {
    if (cost === 0) return 0;
    return ((sellPrice - cost) / cost) * 100;
  },
};
