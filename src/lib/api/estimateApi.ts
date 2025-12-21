// Estimate API - Core API layer for estimate operations
// Provides unified interface for all estimate-related operations

import { supabase } from '@/integrations/supabase/client';

// Types
export interface Estimate {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
  revision: number;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  projectAddress?: string;
  subtotal: number;
  gst: number;
  total: number;
  marginPercent: number;
  validUntil?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface EstimateLineItem {
  id: string;
  estimateId: string;
  trade: string;
  sow: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  total: number;
  category?: string;
  nccCodes?: string[];
  notes?: string;
  sortOrder: number;
}

export interface CreateEstimateInput {
  projectId: string;
  name: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  projectAddress?: string;
  marginPercent?: number;
  validDays?: number;
  notes?: string;
}

export interface UpdateEstimateInput {
  name?: string;
  description?: string;
  status?: Estimate['status'];
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  projectAddress?: string;
  marginPercent?: number;
  validUntil?: string;
  notes?: string;
}

export interface AddLineItemInput {
  trade: string;
  sow: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  category?: string;
  nccCodes?: string[];
  notes?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Estimate API functions
export const estimateApi = {
  /**
   * Create a new estimate
   */
  async create(input: CreateEstimateInput): Promise<ApiResponse<Estimate>> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return { success: false, error: 'Not authenticated' };
      }

      const validUntil = input.validDays
        ? new Date(Date.now() + input.validDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const estimate = {
        project_id: input.projectId,
        name: input.name,
        description: input.description,
        status: 'draft',
        revision: 1,
        client_name: input.clientName,
        client_email: input.clientEmail,
        project_address: input.projectAddress,
        subtotal: 0,
        gst: 0,
        total: 0,
        margin_percent: input.marginPercent || 25,
        valid_until: validUntil,
        notes: input.notes,
        created_by: user.user.id
      };

      const { data, error } = await supabase
        .from('estimates')
        .insert(estimate)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapEstimateFromDb(data),
        message: 'Estimate created successfully'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get estimate by ID
   */
  async getById(id: string): Promise<ApiResponse<Estimate>> {
    try {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { success: true, data: mapEstimateFromDb(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all estimates for a project
   */
  async getByProject(projectId: string): Promise<ApiResponse<Estimate[]>> {
    try {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data.map(mapEstimateFromDb)
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Update estimate
   */
  async update(id: string, input: UpdateEstimateInput): Promise<ApiResponse<Estimate>> {
    try {
      const updateData: any = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.clientName !== undefined) updateData.client_name = input.clientName;
      if (input.clientEmail !== undefined) updateData.client_email = input.clientEmail;
      if (input.clientPhone !== undefined) updateData.client_phone = input.clientPhone;
      if (input.projectAddress !== undefined) updateData.project_address = input.projectAddress;
      if (input.marginPercent !== undefined) updateData.margin_percent = input.marginPercent;
      if (input.validUntil !== undefined) updateData.valid_until = input.validUntil;
      if (input.notes !== undefined) updateData.notes = input.notes;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('estimates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapEstimateFromDb(data),
        message: 'Estimate updated successfully'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete estimate
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    try {
      // First delete line items
      await supabase
        .from('estimate_line_items')
        .delete()
        .eq('estimate_id', id);

      // Then delete estimate
      const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { success: true, message: 'Estimate deleted successfully' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get line items for estimate
   */
  async getLineItems(estimateId: string): Promise<ApiResponse<EstimateLineItem[]>> {
    try {
      const { data, error } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        data: data.map(mapLineItemFromDb)
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Add line item to estimate
   */
  async addLineItem(estimateId: string, input: AddLineItemInput): Promise<ApiResponse<EstimateLineItem>> {
    try {
      // Get current max sort order
      const { data: existing } = await supabase
        .from('estimate_line_items')
        .select('sort_order')
        .eq('estimate_id', estimateId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const sortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;
      const total = input.quantity * input.rate;

      const lineItem = {
        estimate_id: estimateId,
        trade: input.trade,
        sow: input.sow,
        description: input.description,
        unit: input.unit,
        quantity: input.quantity,
        rate: input.rate,
        total,
        category: input.category,
        ncc_codes: input.nccCodes,
        notes: input.notes,
        sort_order: sortOrder
      };

      const { data, error } = await supabase
        .from('estimate_line_items')
        .insert(lineItem)
        .select()
        .single();

      if (error) throw error;

      // Update estimate totals
      await recalculateEstimateTotals(estimateId);

      return {
        success: true,
        data: mapLineItemFromDb(data),
        message: 'Line item added successfully'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Update line item
   */
  async updateLineItem(
    id: string,
    updates: Partial<AddLineItemInput>
  ): Promise<ApiResponse<EstimateLineItem>> {
    try {
      const updateData: any = {};

      if (updates.trade !== undefined) updateData.trade = updates.trade;
      if (updates.sow !== undefined) updateData.sow = updates.sow;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.unit !== undefined) updateData.unit = updates.unit;
      if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
      if (updates.rate !== undefined) updateData.rate = updates.rate;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.nccCodes !== undefined) updateData.ncc_codes = updates.nccCodes;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      // Recalculate total if quantity or rate changed
      if (updates.quantity !== undefined || updates.rate !== undefined) {
        const { data: current } = await supabase
          .from('estimate_line_items')
          .select('quantity, rate, estimate_id')
          .eq('id', id)
          .single();

        const newQty = updates.quantity ?? current?.quantity ?? 0;
        const newRate = updates.rate ?? current?.rate ?? 0;
        updateData.total = newQty * newRate;
      }

      const { data, error } = await supabase
        .from('estimate_line_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update estimate totals
      await recalculateEstimateTotals(data.estimate_id);

      return {
        success: true,
        data: mapLineItemFromDb(data),
        message: 'Line item updated successfully'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete line item
   */
  async deleteLineItem(id: string): Promise<ApiResponse<void>> {
    try {
      // Get estimate ID first
      const { data: lineItem } = await supabase
        .from('estimate_line_items')
        .select('estimate_id')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('estimate_line_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update estimate totals
      if (lineItem) {
        await recalculateEstimateTotals(lineItem.estimate_id);
      }

      return { success: true, message: 'Line item deleted successfully' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Duplicate estimate
   */
  async duplicate(id: string, newName?: string): Promise<ApiResponse<Estimate>> {
    try {
      // Get original estimate
      const { data: original, error: fetchError } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const { data: user } = await supabase.auth.getUser();

      // Create new estimate
      const newEstimate = {
        ...original,
        id: undefined,
        name: newName || `${original.name} (Copy)`,
        status: 'draft',
        revision: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user.user?.id
      };

      const { data: created, error: createError } = await supabase
        .from('estimates')
        .insert(newEstimate)
        .select()
        .single();

      if (createError) throw createError;

      // Copy line items
      const { data: lineItems } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', id);

      if (lineItems && lineItems.length > 0) {
        const newLineItems = lineItems.map(item => ({
          ...item,
          id: undefined,
          estimate_id: created.id
        }));

        await supabase
          .from('estimate_line_items')
          .insert(newLineItems);
      }

      return {
        success: true,
        data: mapEstimateFromDb(created),
        message: 'Estimate duplicated successfully'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Create new revision of estimate
   */
  async createRevision(id: string, reason?: string): Promise<ApiResponse<Estimate>> {
    try {
      // Get current estimate
      const { data: current, error: fetchError } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Update current estimate status to superseded
      await supabase
        .from('estimates')
        .update({ status: 'superseded' })
        .eq('id', id);

      const { data: user } = await supabase.auth.getUser();

      // Create new revision
      const newRevision = {
        ...current,
        id: undefined,
        revision: current.revision + 1,
        status: 'draft',
        notes: reason ? `Revision reason: ${reason}\n\n${current.notes || ''}` : current.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user.user?.id
      };

      const { data: created, error: createError } = await supabase
        .from('estimates')
        .insert(newRevision)
        .select()
        .single();

      if (createError) throw createError;

      // Copy line items
      const { data: lineItems } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', id);

      if (lineItems && lineItems.length > 0) {
        const newLineItems = lineItems.map(item => ({
          ...item,
          id: undefined,
          estimate_id: created.id
        }));

        await supabase
          .from('estimate_line_items')
          .insert(newLineItems);
      }

      return {
        success: true,
        data: mapEstimateFromDb(created),
        message: `Revision ${created.revision} created successfully`
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// Helper functions
async function recalculateEstimateTotals(estimateId: string): Promise<void> {
  const { data: lineItems } = await supabase
    .from('estimate_line_items')
    .select('total')
    .eq('estimate_id', estimateId);

  const subtotal = lineItems?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  await supabase
    .from('estimates')
    .update({
      subtotal,
      gst,
      total,
      updated_at: new Date().toISOString()
    })
    .eq('id', estimateId);
}

function mapEstimateFromDb(data: any): Estimate {
  return {
    id: data.id,
    projectId: data.project_id,
    name: data.name,
    description: data.description,
    status: data.status,
    revision: data.revision,
    clientName: data.client_name,
    clientEmail: data.client_email,
    clientPhone: data.client_phone,
    projectAddress: data.project_address,
    subtotal: data.subtotal,
    gst: data.gst,
    total: data.total,
    marginPercent: data.margin_percent,
    validUntil: data.valid_until,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by
  };
}

function mapLineItemFromDb(data: any): EstimateLineItem {
  return {
    id: data.id,
    estimateId: data.estimate_id,
    trade: data.trade,
    sow: data.sow,
    description: data.description,
    unit: data.unit,
    quantity: data.quantity,
    rate: data.rate,
    total: data.total,
    category: data.category,
    nccCodes: data.ncc_codes,
    notes: data.notes,
    sortOrder: data.sort_order
  };
}
