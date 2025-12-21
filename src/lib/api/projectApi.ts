// Project API - Core API layer for project operations
// Provides unified interface for all project-related operations

import { supabase } from '@/integrations/supabase/client';

// Types
export interface Project {
  id: string;
  name: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  address: string;
  suburb?: string;
  state: string;
  postcode: string;
  projectType: 'residential' | 'commercial' | 'renovation' | 'extension' | 'new-build';
  status: 'enquiry' | 'quoting' | 'won' | 'lost' | 'in-progress' | 'completed';
  estimatedValue?: number;
  actualValue?: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  address: string;
  suburb?: string;
  state: string;
  postcode: string;
  projectType: Project['projectType'];
  estimatedValue?: number;
  notes?: string;
  tags?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  projectType?: Project['projectType'];
  status?: Project['status'];
  estimatedValue?: number;
  actualValue?: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
  tags?: string[];
}

export interface ProjectStats {
  totalProjects: number;
  enquiries: number;
  quoting: number;
  won: number;
  lost: number;
  inProgress: number;
  completed: number;
  totalEstimatedValue: number;
  totalActualValue: number;
  winRate: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Project API functions
export const projectApi = {
  /**
   * Create a new project
   */
  async create(input: CreateProjectInput): Promise<ApiResponse<Project>> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return { success: false, error: 'Not authenticated' };
      }

      const project = {
        name: input.name,
        description: input.description,
        client_name: input.clientName,
        client_email: input.clientEmail,
        client_phone: input.clientPhone,
        address: input.address,
        suburb: input.suburb,
        state: input.state,
        postcode: input.postcode,
        project_type: input.projectType,
        status: 'enquiry',
        estimated_value: input.estimatedValue,
        notes: input.notes,
        tags: input.tags,
        created_by: user.user.id
      };

      const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapProjectFromDb(data),
        message: 'Project created successfully'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get project by ID
   */
  async getById(id: string): Promise<ApiResponse<Project>> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { success: true, data: mapProjectFromDb(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all projects
   */
  async getAll(filters?: {
    status?: Project['status'];
    projectType?: Project['projectType'];
    state?: string;
  }): Promise<ApiResponse<Project[]>> {
    try {
      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.projectType) {
        query = query.eq('project_type', filters.projectType);
      }
      if (filters?.state) {
        query = query.eq('state', filters.state);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data.map(mapProjectFromDb)
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Update project
   */
  async update(id: string, input: UpdateProjectInput): Promise<ApiResponse<Project>> {
    try {
      const updateData: any = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.clientName !== undefined) updateData.client_name = input.clientName;
      if (input.clientEmail !== undefined) updateData.client_email = input.clientEmail;
      if (input.clientPhone !== undefined) updateData.client_phone = input.clientPhone;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.suburb !== undefined) updateData.suburb = input.suburb;
      if (input.state !== undefined) updateData.state = input.state;
      if (input.postcode !== undefined) updateData.postcode = input.postcode;
      if (input.projectType !== undefined) updateData.project_type = input.projectType;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.estimatedValue !== undefined) updateData.estimated_value = input.estimatedValue;
      if (input.actualValue !== undefined) updateData.actual_value = input.actualValue;
      if (input.startDate !== undefined) updateData.start_date = input.startDate;
      if (input.endDate !== undefined) updateData.end_date = input.endDate;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.tags !== undefined) updateData.tags = input.tags;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapProjectFromDb(data),
        message: 'Project updated successfully'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete project
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { success: true, message: 'Project deleted successfully' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get project statistics
   */
  async getStats(): Promise<ApiResponse<ProjectStats>> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('status, estimated_value, actual_value');

      if (error) throw error;

      const stats: ProjectStats = {
        totalProjects: data.length,
        enquiries: 0,
        quoting: 0,
        won: 0,
        lost: 0,
        inProgress: 0,
        completed: 0,
        totalEstimatedValue: 0,
        totalActualValue: 0,
        winRate: 0
      };

      data.forEach(project => {
        switch (project.status) {
          case 'enquiry': stats.enquiries++; break;
          case 'quoting': stats.quoting++; break;
          case 'won': stats.won++; break;
          case 'lost': stats.lost++; break;
          case 'in-progress': stats.inProgress++; break;
          case 'completed': stats.completed++; break;
        }
        stats.totalEstimatedValue += project.estimated_value || 0;
        stats.totalActualValue += project.actual_value || 0;
      });

      const totalDecided = stats.won + stats.lost;
      stats.winRate = totalDecided > 0 ? (stats.won / totalDecided) * 100 : 0;

      return { success: true, data: stats };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Search projects
   */
  async search(query: string): Promise<ApiResponse<Project[]>> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .or(`name.ilike.%${query}%,client_name.ilike.%${query}%,address.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return {
        success: true,
        data: data.map(mapProjectFromDb)
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Update project status
   */
  async updateStatus(id: string, status: Project['status']): Promise<ApiResponse<Project>> {
    return this.update(id, { status });
  },

  /**
   * Mark project as won
   */
  async markAsWon(id: string, actualValue?: number): Promise<ApiResponse<Project>> {
    return this.update(id, {
      status: 'won',
      actualValue,
      startDate: new Date().toISOString()
    });
  },

  /**
   * Mark project as lost
   */
  async markAsLost(id: string, reason?: string): Promise<ApiResponse<Project>> {
    const { data: project } = await this.getById(id);
    const notes = reason
      ? `${project?.notes || ''}\n\nLost reason: ${reason}`
      : project?.notes;

    return this.update(id, {
      status: 'lost',
      notes
    });
  }
};

// Helper function
function mapProjectFromDb(data: any): Project {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    clientName: data.client_name,
    clientEmail: data.client_email,
    clientPhone: data.client_phone,
    address: data.address,
    suburb: data.suburb,
    state: data.state,
    postcode: data.postcode,
    projectType: data.project_type,
    status: data.status,
    estimatedValue: data.estimated_value,
    actualValue: data.actual_value,
    startDate: data.start_date,
    endDate: data.end_date,
    notes: data.notes,
    tags: data.tags,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by
  };
}
