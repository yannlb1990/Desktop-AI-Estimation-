// Supplier API - Core API layer for supplier operations
// Provides unified interface for supplier management and RFQ

import { supabase } from '@/integrations/supabase/client';

// Types
export interface Supplier {
  id: string;
  businessName: string;
  tradingName?: string;
  abn?: string;
  contactName: string;
  phone: string;
  email: string;
  website?: string;
  address?: string;
  suburb?: string;
  state: string;
  postcode?: string;
  categories: string[];
  brands?: string[];
  deliveryAreas?: string[];
  minimumOrder?: number;
  paymentTerms?: string;
  accountNumber?: string;
  rating: number;
  notes?: string;
  isPreferred: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierQuoteRequest {
  id: string;
  supplierId: string;
  projectId?: string;
  estimateId?: string;
  status: 'draft' | 'sent' | 'received' | 'accepted' | 'rejected' | 'expired';
  items: QuoteRequestItem[];
  deliveryAddress: string;
  requiredByDate?: string;
  notes?: string;
  sentAt?: string;
  receivedAt?: string;
  validUntil?: string;
  quotedTotal?: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteRequestItem {
  id: string;
  productCode?: string;
  description: string;
  quantity: number;
  unit: string;
  preferredBrand?: string;
  quotedPrice?: number;
  notes?: string;
}

export interface CreateSupplierInput {
  businessName: string;
  tradingName?: string;
  abn?: string;
  contactName: string;
  phone: string;
  email: string;
  website?: string;
  address?: string;
  suburb?: string;
  state: string;
  postcode?: string;
  categories: string[];
  brands?: string[];
  deliveryAreas?: string[];
  minimumOrder?: number;
  paymentTerms?: string;
  notes?: string;
  isPreferred?: boolean;
}

export interface CreateQuoteRequestInput {
  supplierId: string;
  projectId?: string;
  estimateId?: string;
  items: Omit<QuoteRequestItem, 'id' | 'quotedPrice'>[];
  deliveryAddress: string;
  requiredByDate?: string;
  notes?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Supplier API functions
export const supplierApi = {
  /**
   * Create a new supplier
   */
  async create(input: CreateSupplierInput): Promise<ApiResponse<Supplier>> {
    try {
      const supplier = {
        business_name: input.businessName,
        trading_name: input.tradingName,
        abn: input.abn,
        contact_name: input.contactName,
        phone: input.phone,
        email: input.email,
        website: input.website,
        address: input.address,
        suburb: input.suburb,
        state: input.state,
        postcode: input.postcode,
        categories: input.categories,
        brands: input.brands,
        delivery_areas: input.deliveryAreas,
        minimum_order: input.minimumOrder,
        payment_terms: input.paymentTerms,
        notes: input.notes,
        is_preferred: input.isPreferred || false,
        is_active: true,
        rating: 0
      };

      const { data, error } = await supabase
        .from('suppliers')
        .insert(supplier)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapSupplierFromDb(data),
        message: 'Supplier created successfully'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get supplier by ID
   */
  async getById(id: string): Promise<ApiResponse<Supplier>> {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { success: true, data: mapSupplierFromDb(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all suppliers
   */
  async getAll(filters?: {
    category?: string;
    state?: string;
    isPreferred?: boolean;
    isActive?: boolean;
  }): Promise<ApiResponse<Supplier[]>> {
    try {
      let query = supabase
        .from('suppliers')
        .select('*')
        .order('business_name', { ascending: true });

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }
      if (filters?.isPreferred !== undefined) {
        query = query.eq('is_preferred', filters.isPreferred);
      }
      if (filters?.state) {
        query = query.eq('state', filters.state);
      }
      if (filters?.category) {
        query = query.contains('categories', [filters.category]);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data.map(mapSupplierFromDb)
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get suppliers by category
   */
  async getByCategory(category: string): Promise<ApiResponse<Supplier[]>> {
    return this.getAll({ category, isActive: true });
  },

  /**
   * Get preferred suppliers
   */
  async getPreferred(): Promise<ApiResponse<Supplier[]>> {
    return this.getAll({ isPreferred: true, isActive: true });
  },

  /**
   * Update supplier
   */
  async update(id: string, input: Partial<CreateSupplierInput>): Promise<ApiResponse<Supplier>> {
    try {
      const updateData: any = {};

      if (input.businessName !== undefined) updateData.business_name = input.businessName;
      if (input.tradingName !== undefined) updateData.trading_name = input.tradingName;
      if (input.abn !== undefined) updateData.abn = input.abn;
      if (input.contactName !== undefined) updateData.contact_name = input.contactName;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.website !== undefined) updateData.website = input.website;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.suburb !== undefined) updateData.suburb = input.suburb;
      if (input.state !== undefined) updateData.state = input.state;
      if (input.postcode !== undefined) updateData.postcode = input.postcode;
      if (input.categories !== undefined) updateData.categories = input.categories;
      if (input.brands !== undefined) updateData.brands = input.brands;
      if (input.deliveryAreas !== undefined) updateData.delivery_areas = input.deliveryAreas;
      if (input.minimumOrder !== undefined) updateData.minimum_order = input.minimumOrder;
      if (input.paymentTerms !== undefined) updateData.payment_terms = input.paymentTerms;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.isPreferred !== undefined) updateData.is_preferred = input.isPreferred;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapSupplierFromDb(data),
        message: 'Supplier updated successfully'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete supplier (soft delete)
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      return { success: true, message: 'Supplier deleted successfully' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Search suppliers
   */
  async search(query: string): Promise<ApiResponse<Supplier[]>> {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .or(`business_name.ilike.%${query}%,trading_name.ilike.%${query}%,contact_name.ilike.%${query}%`)
        .order('business_name', { ascending: true })
        .limit(20);

      if (error) throw error;

      return {
        success: true,
        data: data.map(mapSupplierFromDb)
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Update supplier rating
   */
  async updateRating(id: string, rating: number): Promise<ApiResponse<Supplier>> {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .update({ rating, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapSupplierFromDb(data),
        message: 'Rating updated'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Create quote request (RFQ)
   */
  async createQuoteRequest(input: CreateQuoteRequestInput): Promise<ApiResponse<SupplierQuoteRequest>> {
    try {
      const items = input.items.map((item, index) => ({
        ...item,
        id: `item-${Date.now()}-${index}`
      }));

      const quoteRequest = {
        supplier_id: input.supplierId,
        project_id: input.projectId,
        estimate_id: input.estimateId,
        status: 'draft',
        items,
        delivery_address: input.deliveryAddress,
        required_by_date: input.requiredByDate,
        notes: input.notes
      };

      const { data, error } = await supabase
        .from('supplier_quote_requests')
        .insert(quoteRequest)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapQuoteRequestFromDb(data),
        message: 'Quote request created'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Send quote request
   */
  async sendQuoteRequest(id: string): Promise<ApiResponse<SupplierQuoteRequest>> {
    try {
      const { data, error } = await supabase
        .from('supplier_quote_requests')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // TODO: Send email notification to supplier

      return {
        success: true,
        data: mapQuoteRequestFromDb(data),
        message: 'Quote request sent to supplier'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get quote requests for a project
   */
  async getQuoteRequestsByProject(projectId: string): Promise<ApiResponse<SupplierQuoteRequest[]>> {
    try {
      const { data, error } = await supabase
        .from('supplier_quote_requests')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data.map(mapQuoteRequestFromDb)
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Update quote request with received quote
   */
  async receiveQuote(
    id: string,
    quotedItems: { itemId: string; quotedPrice: number }[],
    validUntil: string,
    quotedTotal: number
  ): Promise<ApiResponse<SupplierQuoteRequest>> {
    try {
      // Get current request
      const { data: current } = await supabase
        .from('supplier_quote_requests')
        .select('items')
        .eq('id', id)
        .single();

      // Update items with quoted prices
      const updatedItems = current?.items.map((item: any) => {
        const quoted = quotedItems.find(q => q.itemId === item.id);
        return quoted ? { ...item, quotedPrice: quoted.quotedPrice } : item;
      });

      const { data, error } = await supabase
        .from('supplier_quote_requests')
        .update({
          status: 'received',
          items: updatedItems,
          received_at: new Date().toISOString(),
          valid_until: validUntil,
          quoted_total: quotedTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapQuoteRequestFromDb(data),
        message: 'Quote received and recorded'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Accept quote
   */
  async acceptQuote(id: string): Promise<ApiResponse<SupplierQuoteRequest>> {
    try {
      const { data, error } = await supabase
        .from('supplier_quote_requests')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapQuoteRequestFromDb(data),
        message: 'Quote accepted'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Generate RFQ email content
   */
  generateRfqEmail(supplier: Supplier, request: SupplierQuoteRequest, companyName: string): string {
    const itemsList = request.items
      .map((item, idx) => `${idx + 1}. ${item.description}\n   Qty: ${item.quantity} ${item.unit}${item.preferredBrand ? `\n   Preferred: ${item.preferredBrand}` : ''}`)
      .join('\n\n');

    return `Subject: Request for Quote - ${companyName}

Dear ${supplier.contactName},

We would like to request a quote for the following materials:

${itemsList}

Delivery Details:
- Address: ${request.deliveryAddress}
${request.requiredByDate ? `- Required by: ${new Date(request.requiredByDate).toLocaleDateString('en-AU')}` : ''}

${request.notes ? `Additional Notes:\n${request.notes}\n` : ''}
Please provide your best pricing including:
- Unit prices
- Any available discounts
- Delivery charges
- Quote validity period

Kind regards,
${companyName}
`;
  }
};

// Helper functions
function mapSupplierFromDb(data: any): Supplier {
  return {
    id: data.id,
    businessName: data.business_name,
    tradingName: data.trading_name,
    abn: data.abn,
    contactName: data.contact_name,
    phone: data.phone,
    email: data.email,
    website: data.website,
    address: data.address,
    suburb: data.suburb,
    state: data.state,
    postcode: data.postcode,
    categories: data.categories || [],
    brands: data.brands,
    deliveryAreas: data.delivery_areas,
    minimumOrder: data.minimum_order,
    paymentTerms: data.payment_terms,
    accountNumber: data.account_number,
    rating: data.rating,
    notes: data.notes,
    isPreferred: data.is_preferred,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

function mapQuoteRequestFromDb(data: any): SupplierQuoteRequest {
  return {
    id: data.id,
    supplierId: data.supplier_id,
    projectId: data.project_id,
    estimateId: data.estimate_id,
    status: data.status,
    items: data.items || [],
    deliveryAddress: data.delivery_address,
    requiredByDate: data.required_by_date,
    notes: data.notes,
    sentAt: data.sent_at,
    receivedAt: data.received_at,
    validUntil: data.valid_until,
    quotedTotal: data.quoted_total,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}
