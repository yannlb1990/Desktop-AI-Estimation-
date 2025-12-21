// Webhook System - Real-time event notifications
// Provides webhook management for external integrations

import { supabase } from '@/integrations/supabase/client';

// Webhook event types
export type WebhookEventType =
  | 'estimate.created'
  | 'estimate.updated'
  | 'estimate.sent'
  | 'estimate.approved'
  | 'estimate.rejected'
  | 'project.created'
  | 'project.updated'
  | 'project.won'
  | 'project.lost'
  | 'quote_request.sent'
  | 'quote_request.received'
  | 'price.alert'
  | 'compliance.warning';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  secret?: string;
  isActive: boolean;
  headers?: Record<string, string>;
  retryCount: number;
  lastTriggeredAt?: string;
  lastStatus?: 'success' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: any;
  status: 'pending' | 'success' | 'failed';
  statusCode?: number;
  response?: string;
  attempts: number;
  nextRetryAt?: string;
  createdAt: string;
  completedAt?: string;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  data: any;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  events: WebhookEventType[];
  secret?: string;
  headers?: Record<string, string>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Webhook API functions
export const webhookApi = {
  /**
   * Create a new webhook
   */
  async create(input: CreateWebhookInput): Promise<ApiResponse<Webhook>> {
    try {
      const webhook = {
        name: input.name,
        url: input.url,
        events: input.events,
        secret: input.secret,
        headers: input.headers,
        is_active: true,
        retry_count: 3
      };

      const { data, error } = await supabase
        .from('webhooks')
        .insert(webhook)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapWebhookFromDb(data),
        message: 'Webhook created successfully'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all webhooks
   */
  async getAll(): Promise<ApiResponse<Webhook[]>> {
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data.map(mapWebhookFromDb)
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Update webhook
   */
  async update(id: string, input: Partial<CreateWebhookInput> & { isActive?: boolean }): Promise<ApiResponse<Webhook>> {
    try {
      const updateData: any = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.url !== undefined) updateData.url = input.url;
      if (input.events !== undefined) updateData.events = input.events;
      if (input.secret !== undefined) updateData.secret = input.secret;
      if (input.headers !== undefined) updateData.headers = input.headers;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('webhooks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapWebhookFromDb(data),
        message: 'Webhook updated successfully'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete webhook
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { success: true, message: 'Webhook deleted successfully' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Test webhook
   */
  async test(id: string): Promise<ApiResponse<{ statusCode: number; response: string }>> {
    try {
      const { data: webhook } = await supabase
        .from('webhooks')
        .select('*')
        .eq('id', id)
        .single();

      if (!webhook) {
        return { success: false, error: 'Webhook not found' };
      }

      const testPayload: WebhookPayload = {
        id: `test-${Date.now()}`,
        event: 'estimate.created',
        timestamp: new Date().toISOString(),
        data: {
          test: true,
          message: 'This is a test webhook delivery'
        }
      };

      const result = await deliverWebhook(webhook, testPayload);

      return {
        success: result.success,
        data: {
          statusCode: result.statusCode || 0,
          response: result.response || ''
        },
        message: result.success ? 'Test successful' : 'Test failed'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get webhook delivery history
   */
  async getDeliveries(webhookId: string, limit: number = 50): Promise<ApiResponse<WebhookDelivery[]>> {
    try {
      const { data, error } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        data: data.map(mapDeliveryFromDb)
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Retry failed delivery
   */
  async retryDelivery(deliveryId: string): Promise<ApiResponse<WebhookDelivery>> {
    try {
      const { data: delivery } = await supabase
        .from('webhook_deliveries')
        .select('*, webhooks(*)')
        .eq('id', deliveryId)
        .single();

      if (!delivery) {
        return { success: false, error: 'Delivery not found' };
      }

      const result = await deliverWebhook(delivery.webhooks, {
        id: delivery.id,
        event: delivery.event_type,
        timestamp: new Date().toISOString(),
        data: delivery.payload
      });

      // Update delivery record
      const { data: updated, error } = await supabase
        .from('webhook_deliveries')
        .update({
          status: result.success ? 'success' : 'failed',
          status_code: result.statusCode,
          response: result.response,
          attempts: delivery.attempts + 1,
          completed_at: result.success ? new Date().toISOString() : null
        })
        .eq('id', deliveryId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapDeliveryFromDb(updated),
        message: result.success ? 'Retry successful' : 'Retry failed'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// Webhook trigger functions
export const webhookTrigger = {
  /**
   * Trigger webhook event
   */
  async trigger(eventType: WebhookEventType, data: any): Promise<void> {
    try {
      // Get all active webhooks subscribed to this event
      const { data: webhooks } = await supabase
        .from('webhooks')
        .select('*')
        .eq('is_active', true)
        .contains('events', [eventType]);

      if (!webhooks || webhooks.length === 0) return;

      const payload: WebhookPayload = {
        id: `evt-${Date.now()}`,
        event: eventType,
        timestamp: new Date().toISOString(),
        data
      };

      // Deliver to all subscribed webhooks
      for (const webhook of webhooks) {
        await queueWebhookDelivery(webhook, payload);
      }
    } catch (error) {
      console.error('Webhook trigger error:', error);
    }
  },

  // Convenience methods for common events
  async estimateCreated(estimate: any) {
    await this.trigger('estimate.created', { estimate });
  },

  async estimateUpdated(estimate: any, changes: string[]) {
    await this.trigger('estimate.updated', { estimate, changes });
  },

  async estimateSent(estimate: any, recipient: string) {
    await this.trigger('estimate.sent', { estimate, recipient });
  },

  async estimateApproved(estimate: any) {
    await this.trigger('estimate.approved', { estimate });
  },

  async estimateRejected(estimate: any, reason?: string) {
    await this.trigger('estimate.rejected', { estimate, reason });
  },

  async projectCreated(project: any) {
    await this.trigger('project.created', { project });
  },

  async projectUpdated(project: any, changes: string[]) {
    await this.trigger('project.updated', { project, changes });
  },

  async projectWon(project: any, value: number) {
    await this.trigger('project.won', { project, value });
  },

  async projectLost(project: any, reason?: string) {
    await this.trigger('project.lost', { project, reason });
  },

  async quoteRequestSent(request: any, supplier: any) {
    await this.trigger('quote_request.sent', { request, supplier });
  },

  async quoteRequestReceived(request: any, supplier: any) {
    await this.trigger('quote_request.received', { request, supplier });
  },

  async priceAlert(material: string, oldPrice: number, newPrice: number, changePercent: number) {
    await this.trigger('price.alert', { material, oldPrice, newPrice, changePercent });
  },

  async complianceWarning(estimateId: string, issues: any[]) {
    await this.trigger('compliance.warning', { estimateId, issues });
  }
};

// Helper functions
async function queueWebhookDelivery(webhook: any, payload: WebhookPayload): Promise<void> {
  try {
    // Create delivery record
    const { data: delivery } = await supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        event_type: payload.event,
        payload: payload.data,
        status: 'pending',
        attempts: 0
      })
      .select()
      .single();

    // Attempt delivery
    const result = await deliverWebhook(webhook, payload);

    // Update delivery record
    await supabase
      .from('webhook_deliveries')
      .update({
        status: result.success ? 'success' : 'failed',
        status_code: result.statusCode,
        response: result.response,
        attempts: 1,
        completed_at: result.success ? new Date().toISOString() : null,
        next_retry_at: result.success ? null : getNextRetryTime(1, webhook.retry_count)
      })
      .eq('id', delivery?.id);

    // Update webhook last triggered
    await supabase
      .from('webhooks')
      .update({
        last_triggered_at: new Date().toISOString(),
        last_status: result.success ? 'success' : 'failed'
      })
      .eq('id', webhook.id);
  } catch (error) {
    console.error('Queue webhook delivery error:', error);
  }
}

async function deliverWebhook(
  webhook: any,
  payload: WebhookPayload
): Promise<{ success: boolean; statusCode?: number; response?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Delivery': payload.id,
      'X-Webhook-Timestamp': payload.timestamp,
      ...(webhook.headers || {})
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      const signature = await generateSignature(JSON.stringify(payload), webhook.secret);
      headers['X-Webhook-Signature'] = signature;
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    return {
      success: response.ok,
      statusCode: response.status,
      response: responseText.substring(0, 1000) // Limit response size
    };
  } catch (error: any) {
    return {
      success: false,
      response: error.message
    };
  }
}

async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function getNextRetryTime(attempt: number, maxRetries: number): string | null {
  if (attempt >= maxRetries) return null;

  // Exponential backoff: 1min, 5min, 30min
  const delays = [60000, 300000, 1800000];
  const delay = delays[Math.min(attempt - 1, delays.length - 1)];

  return new Date(Date.now() + delay).toISOString();
}

function mapWebhookFromDb(data: any): Webhook {
  return {
    id: data.id,
    name: data.name,
    url: data.url,
    events: data.events || [],
    secret: data.secret,
    isActive: data.is_active,
    headers: data.headers,
    retryCount: data.retry_count,
    lastTriggeredAt: data.last_triggered_at,
    lastStatus: data.last_status,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

function mapDeliveryFromDb(data: any): WebhookDelivery {
  return {
    id: data.id,
    webhookId: data.webhook_id,
    eventType: data.event_type,
    payload: data.payload,
    status: data.status,
    statusCode: data.status_code,
    response: data.response,
    attempts: data.attempts,
    nextRetryAt: data.next_retry_at,
    createdAt: data.created_at,
    completedAt: data.completed_at
  };
}
