export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_profile: {
        Row: {
          enabled_trades: Json
          project_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          enabled_trades?: Json
          project_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          enabled_trades?: Json
          project_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assemblies: {
        Row: {
          assembly_type: Database["public"]["Enums"]["assembly_type"]
          cloned_from_id: string | null
          code: string
          created_at: string
          description: string | null
          element_category_id: string
          id: string
          name: string
          org_id: string | null
          region_code: string
          status: Database["public"]["Enums"]["assembly_status"]
          tags: string[]
          uom: string
          updated_at: string
          version: number
        }
        Insert: {
          assembly_type?: Database["public"]["Enums"]["assembly_type"]
          cloned_from_id?: string | null
          code: string
          created_at?: string
          description?: string | null
          element_category_id: string
          id?: string
          name: string
          org_id?: string | null
          region_code?: string
          status?: Database["public"]["Enums"]["assembly_status"]
          tags?: string[]
          uom?: string
          updated_at?: string
          version?: number
        }
        Update: {
          assembly_type?: Database["public"]["Enums"]["assembly_type"]
          cloned_from_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          element_category_id?: string
          id?: string
          name?: string
          org_id?: string | null
          region_code?: string
          status?: Database["public"]["Enums"]["assembly_status"]
          tags?: string[]
          uom?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assemblies_cloned_from_id_fkey"
            columns: ["cloned_from_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assemblies_element_category_id_fkey"
            columns: ["element_category_id"]
            isOneToOne: false
            referencedRelation: "element_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      assembly_components: {
        Row: {
          assembly_id: string
          cost_item_id: string
          created_at: string
          formula: string | null
          id: string
          is_optional: boolean
          notes: string | null
          qty_per_unit: number
          rounding: Database["public"]["Enums"]["rounding_rule"]
          side_count_applies: boolean
          sort_order: number
          trade_id: string
          waste_pct: number
        }
        Insert: {
          assembly_id: string
          cost_item_id: string
          created_at?: string
          formula?: string | null
          id?: string
          is_optional?: boolean
          notes?: string | null
          qty_per_unit: number
          rounding?: Database["public"]["Enums"]["rounding_rule"]
          side_count_applies?: boolean
          sort_order?: number
          trade_id: string
          waste_pct?: number
        }
        Update: {
          assembly_id?: string
          cost_item_id?: string
          created_at?: string
          formula?: string | null
          id?: string
          is_optional?: boolean
          notes?: string | null
          qty_per_unit?: number
          rounding?: Database["public"]["Enums"]["rounding_rule"]
          side_count_applies?: boolean
          sort_order?: number
          trade_id?: string
          waste_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "assembly_components_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembly_components_cost_item_id_fkey"
            columns: ["cost_item_id"]
            isOneToOne: false
            referencedRelation: "cost_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembly_components_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          city: string | null
          client_type: string | null
          company_name: string | null
          contact_name: string
          created_at: string
          email: string
          id: string
          mobile: string | null
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          client_type?: string | null
          company_name?: string | null
          contact_name: string
          created_at?: string
          email: string
          id?: string
          mobile?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          client_type?: string | null
          company_name?: string | null
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          mobile?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consumables: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          quantity: number
          sort_order: number
          unit: string
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          project_id: string
          quantity?: number
          sort_order?: number
          unit?: string
          unit_price?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          quantity?: number
          sort_order?: number
          unit?: string
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_estimator_consumables: {
        Row: {
          description: string | null
          id: string
          name: string
          project_id: string
          quantity: number
          sort_order: number
          unit: string
          unit_price: number
          user_id: string
        }
        Insert: {
          description?: string | null
          id: string
          name: string
          project_id: string
          quantity?: number
          sort_order?: number
          unit?: string
          unit_price?: number
          user_id: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          quantity?: number
          sort_order?: number
          unit?: string
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_estimator_consumables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_estimator_prefs: {
        Row: {
          gst_enabled: boolean
          margin_percent: number
          project_id: string
          selected_state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          gst_enabled?: boolean
          margin_percent?: number
          project_id: string
          selected_state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          gst_enabled?: boolean
          margin_percent?: number
          project_id?: string
          selected_state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_estimator_prefs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_item_rates: {
        Row: {
          cost_item_id: string
          created_at: string
          currency: string
          effective_from: string
          effective_to: string | null
          id: string
          org_id: string | null
          region_code: string
          source: string
          supplier: string | null
          unit_rate: number
        }
        Insert: {
          cost_item_id: string
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          org_id?: string | null
          region_code?: string
          source?: string
          supplier?: string | null
          unit_rate: number
        }
        Update: {
          cost_item_id?: string
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          org_id?: string | null
          region_code?: string
          source?: string
          supplier?: string | null
          unit_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_item_rates_cost_item_id_fkey"
            columns: ["cost_item_id"]
            isOneToOne: false
            referencedRelation: "cost_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_items: {
        Row: {
          code: string
          created_at: string
          default_trade_id: string | null
          id: string
          is_active: boolean
          item_type: Database["public"]["Enums"]["item_type"]
          name: string
          org_id: string | null
          pack_size: number | null
          uom: string
        }
        Insert: {
          code: string
          created_at?: string
          default_trade_id?: string | null
          id?: string
          is_active?: boolean
          item_type: Database["public"]["Enums"]["item_type"]
          name: string
          org_id?: string | null
          pack_size?: number | null
          uom: string
        }
        Update: {
          code?: string
          created_at?: string
          default_trade_id?: string | null
          id?: string
          is_active?: boolean
          item_type?: Database["public"]["Enums"]["item_type"]
          name?: string
          org_id?: string | null
          pack_size?: number | null
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_items_default_trade_id_fkey"
            columns: ["default_trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      default_rates: {
        Row: {
          rates: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          rates?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          rates?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      element_categories: {
        Row: {
          code: string
          created_at: string
          default_uom: string
          id: string
          name: string
          org_id: string | null
          parent_id: string | null
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          default_uom?: string
          id?: string
          name: string
          org_id?: string | null
          parent_id?: string | null
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          default_uom?: string
          id?: string
          name?: string
          org_id?: string | null
          parent_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "element_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "element_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_items: {
        Row: {
          area: string
          created_at: string
          id: string
          item_number: string | null
          labour_hours: number
          labour_rate: number
          labour_wastage_pct: number
          markup_pct: number
          material_type: string
          material_wastage_pct: number
          notes: string
          product_url: string | null
          project_id: string
          quantity: number
          related_materials: Json
          scope_of_work: string
          section_id: string | null
          sort_order: number
          trade: string
          unit: string
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string
          created_at?: string
          id: string
          item_number?: string | null
          labour_hours?: number
          labour_rate?: number
          labour_wastage_pct?: number
          markup_pct?: number
          material_type?: string
          material_wastage_pct?: number
          notes?: string
          product_url?: string | null
          project_id: string
          quantity?: number
          related_materials?: Json
          scope_of_work?: string
          section_id?: string | null
          sort_order?: number
          trade?: string
          unit?: string
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          item_number?: string | null
          labour_hours?: number
          labour_rate?: number
          labour_wastage_pct?: number
          markup_pct?: number
          material_type?: string
          material_wastage_pct?: number
          notes?: string
          product_url?: string | null
          project_id?: string
          quantity?: number
          related_materials?: Json
          scope_of_work?: string
          section_id?: string | null
          sort_order?: number
          trade?: string
          unit?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          category: string | null
          created_at: string
          description: string
          estimate_id: string | null
          id: string
          ncc_codes: string[] | null
          notes: string | null
          quantity: number
          rate: number
          sort_order: number
          sow: string
          total: number
          trade: string
          unit: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          estimate_id?: string | null
          id?: string
          ncc_codes?: string[] | null
          notes?: string | null
          quantity: number
          rate: number
          sort_order?: number
          sow: string
          total: number
          trade: string
          unit: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          estimate_id?: string | null
          id?: string
          ncc_codes?: string[] | null
          notes?: string | null
          quantity?: number
          rate?: number
          sort_order?: number
          sow?: string
          total?: number
          trade?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          template: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          template?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          template?: Json
          user_id?: string
        }
        Relationships: []
      }
      estimates: {
        Row: {
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          created_by: string | null
          description: string | null
          gst: number
          id: string
          margin_percent: number
          name: string
          notes: string | null
          project_address: string | null
          project_id: string | null
          revision: number
          status: string
          subtotal: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gst?: number
          id?: string
          margin_percent?: number
          name: string
          notes?: string | null
          project_address?: string | null
          project_id?: string | null
          revision?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gst?: number
          id?: string
          margin_percent?: number
          name?: string
          notes?: string | null
          project_address?: string | null
          project_id?: string | null
          revision?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cost_entries: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          description: string
          id: string
          project_id: string
          supplier: string
          trade: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          date: string
          description?: string
          id?: string
          project_id: string
          supplier?: string
          trade?: string
          type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          description?: string
          id?: string
          project_id?: string
          supplier?: string
          trade?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_cost_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      labour_presets: {
        Row: {
          created_at: string
          id: string
          name: string
          rates: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          rates?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rates?: Json
          user_id?: string
        }
        Relationships: []
      }
      material_prices: {
        Row: {
          brand: string | null
          category: string
          created_at: string
          id: string
          in_stock: boolean
          is_active: boolean
          lead_time_days: number | null
          notes: string | null
          previous_price: number | null
          price: number
          price_updated_at: string
          product_code: string | null
          product_name: string
          supplier: string
          unit: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category: string
          created_at?: string
          id?: string
          in_stock?: boolean
          is_active?: boolean
          lead_time_days?: number | null
          notes?: string | null
          previous_price?: number | null
          price: number
          price_updated_at?: string
          product_code?: string | null
          product_name: string
          supplier: string
          unit: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string
          id?: string
          in_stock?: boolean
          is_active?: boolean
          lead_time_days?: number | null
          notes?: string | null
          previous_price?: number | null
          price?: number
          price_updated_at?: string
          product_code?: string | null
          product_name?: string
          supplier?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      materials_library: {
        Row: {
          created_at: string
          id: string
          lead_time_weeks: number | null
          name: string
          notes: string
          product_code: string
          supplier_name: string
          supplier_type: string
          trade: string
          unit: string
          unit_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_time_weeks?: number | null
          name: string
          notes?: string
          product_code?: string
          supplier_name?: string
          supplier_type?: string
          trade: string
          unit: string
          unit_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_time_weeks?: number | null
          name?: string
          notes?: string
          product_code?: string
          supplier_name?: string
          supplier_type?: string
          trade?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ncc_compliance: {
        Row: {
          building_class: string
          check_states: Json
          climate_zone: string
          project_id: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          building_class?: string
          check_states?: Json
          climate_zone?: string
          project_id: string
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          building_class?: string
          check_states?: Json
          climate_zone?: string
          project_id?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ncc_compliance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ncc_compliance_checks: {
        Row: {
          check_date: string
          compliance_score: number
          created_at: string
          estimate_id: string | null
          id: string
          met_requirements: number
          missing_items: Json
          notes: string | null
          suggestions: Json
          total_requirements: number
          work_types: string[]
        }
        Insert: {
          check_date?: string
          compliance_score: number
          created_at?: string
          estimate_id?: string | null
          id?: string
          met_requirements: number
          missing_items?: Json
          notes?: string | null
          suggestions?: Json
          total_requirements: number
          work_types?: string[]
        }
        Update: {
          check_date?: string
          compliance_score?: number
          created_at?: string
          estimate_id?: string | null
          id?: string
          met_requirements?: number
          missing_items?: Json
          notes?: string | null
          suggestions?: Json
          total_requirements?: number
          work_types?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "ncc_compliance_checks_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      overhead_items: {
        Row: {
          amount: number
          category: string
          created_at: string
          frequency: string
          id: string
          name: string
          notes: string
          project_id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          frequency?: string
          id: string
          name: string
          notes?: string
          project_id: string
          sort_order?: number
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          frequency?: string
          id?: string
          name?: string
          notes?: string
          project_id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overhead_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      overhead_templates: {
        Row: {
          amount: number
          category: string
          created_at: string
          frequency: string
          id: string
          name: string
          notes: string
          user_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          frequency?: string
          id?: string
          name: string
          notes?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          frequency?: string
          id?: string
          name?: string
          notes?: string
          user_id?: string
        }
        Relationships: []
      }
      preferred_suppliers: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          sort_order: number
          trade: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          trade?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          trade?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      prelim_drivers: {
        Row: {
          assembly_id: string
          cost_item_id: string | null
          driver_type: Database["public"]["Enums"]["prelim_driver_type"]
          id: string
          notes: string | null
          trade_id: string
          value: number
        }
        Insert: {
          assembly_id: string
          cost_item_id?: string | null
          driver_type: Database["public"]["Enums"]["prelim_driver_type"]
          id?: string
          notes?: string | null
          trade_id: string
          value: number
        }
        Update: {
          assembly_id?: string
          cost_item_id?: string | null
          driver_type?: Database["public"]["Enums"]["prelim_driver_type"]
          id?: string
          notes?: string | null
          trade_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "prelim_drivers_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prelim_drivers_cost_item_id_fkey"
            columns: ["cost_item_id"]
            isOneToOne: false
            referencedRelation: "cost_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prelim_drivers_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          billing_period: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          plan_id: string | null
          project_type: string | null
        }
        Insert: {
          billing_period?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          phone?: string | null
          plan_id?: string | null
          project_type?: string | null
        }
        Update: {
          billing_period?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          plan_id?: string | null
          project_type?: string | null
        }
        Relationships: []
      }
      project_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          id: string
          mime_type: string | null
          project_id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          id?: string
          mime_type?: string | null
          project_id: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_reminders: {
        Row: {
          completed: boolean
          created_at: string
          due_date: string | null
          id: string
          project_id: string
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          project_id: string
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          project_id?: string
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_reminders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          category: string
          common_variations: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          line_items: Json
          name: string
          ncc_requirements: string[] | null
          sub_category: string | null
          typical_budget_max: number | null
          typical_budget_min: number | null
          typical_duration: string | null
          updated_at: string
        }
        Insert: {
          category: string
          common_variations?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          line_items?: Json
          name: string
          ncc_requirements?: string[] | null
          sub_category?: string | null
          typical_budget_max?: number | null
          typical_budget_min?: number | null
          typical_duration?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          common_variations?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          line_items?: Json
          name?: string
          ncc_requirements?: string[] | null
          sub_category?: string | null
          typical_budget_max?: number | null
          typical_budget_min?: number | null
          typical_duration?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          actual_value: number | null
          address: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          created_by: string | null
          data: Json
          description: string | null
          due_date: string | null
          end_date: string | null
          estimated_value: number | null
          id: string
          name: string
          notes: string | null
          plan_file_name: string | null
          plan_file_url: string | null
          postcode: string | null
          project_type: string
          quote_status: string | null
          site_address: string | null
          start_date: string | null
          state: string | null
          status: string
          suburb: string | null
          tags: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          actual_value?: number | null
          address?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          estimated_value?: number | null
          id?: string
          name: string
          notes?: string | null
          plan_file_name?: string | null
          plan_file_url?: string | null
          postcode?: string | null
          project_type?: string
          quote_status?: string | null
          site_address?: string | null
          start_date?: string | null
          state?: string | null
          status?: string
          suburb?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          actual_value?: number | null
          address?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          estimated_value?: number | null
          id?: string
          name?: string
          notes?: string | null
          plan_file_name?: string | null
          plan_file_url?: string | null
          postcode?: string | null
          project_type?: string
          quote_status?: string | null
          site_address?: string | null
          start_date?: string | null
          state?: string | null
          status?: string
          suburb?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      quote_brand: {
        Row: {
          abn: string
          address: string
          company_name: string
          email: string
          license_number: string
          logo_url: string | null
          phone: string
          primary_color: string
          secondary_color: string
          updated_at: string
          user_id: string
          website: string
        }
        Insert: {
          abn?: string
          address?: string
          company_name?: string
          email?: string
          license_number?: string
          logo_url?: string | null
          phone?: string
          primary_color?: string
          secondary_color?: string
          updated_at?: string
          user_id: string
          website?: string
        }
        Update: {
          abn?: string
          address?: string
          company_name?: string
          email?: string
          license_number?: string
          logo_url?: string | null
          phone?: string
          primary_color?: string
          secondary_color?: string
          updated_at?: string
          user_id?: string
          website?: string
        }
        Relationships: []
      }
      quote_settings: {
        Row: {
          default_exclusions: Json
          default_inclusions: Json
          default_margin_pct: number
          default_validity_days: number
          gst_enabled: boolean
          payment_terms: string
          show_line_items: boolean
          show_trade_groups: boolean
          show_unit_rates: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          default_exclusions?: Json
          default_inclusions?: Json
          default_margin_pct?: number
          default_validity_days?: number
          gst_enabled?: boolean
          payment_terms?: string
          show_line_items?: boolean
          show_trade_groups?: boolean
          show_unit_rates?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          default_exclusions?: Json
          default_inclusions?: Json
          default_margin_pct?: number
          default_validity_days?: number
          gst_enabled?: boolean
          payment_terms?: string
          show_line_items?: boolean
          show_trade_groups?: boolean
          show_unit_rates?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_versions: {
        Row: {
          id: string
          lines: Json
          project_id: string
          quote_number: string
          saved_at: string
          total: number
          user_id: string
          version_number: number
        }
        Insert: {
          id?: string
          lines?: Json
          project_id: string
          quote_number?: string
          saved_at?: string
          total?: number
          user_id: string
          version_number: number
        }
        Update: {
          id?: string
          lines?: Json
          project_id?: string
          quote_number?: string
          saved_at?: string
          total?: number
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_history: {
        Row: {
          change_percent: number
          changed_at: string
          id: string
          new_rate: number
          previous_rate: number
          reason: string | null
          subbie_rate_id: string | null
        }
        Insert: {
          change_percent: number
          changed_at?: string
          id?: string
          new_rate: number
          previous_rate: number
          reason?: string | null
          subbie_rate_id?: string | null
        }
        Update: {
          change_percent?: number
          changed_at?: string
          id?: string
          new_rate?: number
          previous_rate?: number
          reason?: string | null
          subbie_rate_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_history_subbie_rate_id_fkey"
            columns: ["subbie_rate_id"]
            isOneToOne: false
            referencedRelation: "subcontractor_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_metadata: {
        Row: {
          data_source: string
          id: number
          last_updated: string
          next_update: string
          notes: string | null
          version: string
        }
        Insert: {
          data_source: string
          id?: number
          last_updated: string
          next_update: string
          notes?: string | null
          version: string
        }
        Update: {
          data_source?: string
          id?: number
          last_updated?: string
          next_update?: string
          notes?: string | null
          version?: string
        }
        Relationships: []
      }
      rate_overrides: {
        Row: {
          notes: string | null
          rate_id: string
          state: string
          updated_at: string | null
          updated_by: string | null
          value: number
        }
        Insert: {
          notes?: string | null
          rate_id: string
          state: string
          updated_at?: string | null
          updated_by?: string | null
          value: number
        }
        Update: {
          notes?: string | null
          rate_id?: string
          state?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: number
        }
        Relationships: []
      }
      schedule_tasks: {
        Row: {
          color: string
          created_at: string | null
          duration_days: number
          end_date: string
          id: string
          name: string
          notes: string
          progress: number
          project_id: string
          sort_order: number
          start_date: string
          trade: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          duration_days?: number
          end_date: string
          id?: string
          name?: string
          notes?: string
          progress?: number
          project_id: string
          sort_order?: number
          start_date: string
          trade?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          duration_days?: number
          end_date?: string
          id?: string
          name?: string
          notes?: string
          progress?: number
          project_id?: string
          sort_order?: number
          start_date?: string
          trade?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractor_quotes: {
        Row: {
          amount: number
          company: string
          contact: string | null
          created_at: string
          id: string
          notes: string | null
          phone: string | null
          project_id: string
          submitted_at: string
          trade: string
          user_id: string
        }
        Insert: {
          amount?: number
          company: string
          contact?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phone?: string | null
          project_id: string
          submitted_at?: string
          trade: string
          user_id: string
        }
        Update: {
          amount?: number
          company?: string
          contact?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phone?: string | null
          project_id?: string
          submitted_at?: string
          trade?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractor_rates: {
        Row: {
          created_at: string
          description: string
          effective_from: string
          effective_to: string | null
          id: string
          includes_gst: boolean
          last_used: string | null
          min_call_out: number | null
          notes: string | null
          rate: number
          sow_type: string
          subbie_id: string | null
          trade: string
          unit: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          description: string
          effective_from: string
          effective_to?: string | null
          id?: string
          includes_gst?: boolean
          last_used?: string | null
          min_call_out?: number | null
          notes?: string | null
          rate: number
          sow_type: string
          subbie_id?: string | null
          trade: string
          unit: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          description?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          includes_gst?: boolean
          last_used?: string | null
          min_call_out?: number | null
          notes?: string | null
          rate?: number
          sow_type?: string
          subbie_id?: string | null
          trade?: string
          unit?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_rates_subbie_id_fkey"
            columns: ["subbie_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractors: {
        Row: {
          abn: string | null
          business_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          license_number: string | null
          notes: string | null
          phone: string
          rating: number
          service_areas: string[]
          trades: string[]
          updated_at: string
        }
        Insert: {
          abn?: string | null
          business_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          license_number?: string | null
          notes?: string | null
          phone: string
          rating?: number
          service_areas?: string[]
          trades?: string[]
          updated_at?: string
        }
        Update: {
          abn?: string | null
          business_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          license_number?: string | null
          notes?: string | null
          phone?: string
          rating?: number
          service_areas?: string[]
          trades?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_period: string
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_period: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quote_requests: {
        Row: {
          created_at: string
          delivery_address: string
          estimate_id: string | null
          id: string
          items: Json
          notes: string | null
          project_id: string | null
          quoted_total: number | null
          received_at: string | null
          required_by_date: string | null
          sent_at: string | null
          status: string
          supplier_id: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          delivery_address: string
          estimate_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          project_id?: string | null
          quoted_total?: number | null
          received_at?: string | null
          required_by_date?: string | null
          sent_at?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          delivery_address?: string
          estimate_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          project_id?: string | null
          quoted_total?: number | null
          received_at?: string | null
          required_by_date?: string | null
          sent_at?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quote_requests_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quote_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quote_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          abn: string | null
          account_number: string | null
          address: string | null
          brands: string[] | null
          business_name: string
          categories: string[]
          contact_name: string
          created_at: string
          delivery_areas: string[] | null
          email: string
          id: string
          is_active: boolean
          is_preferred: boolean
          minimum_order: number | null
          notes: string | null
          payment_terms: string | null
          phone: string
          postcode: string | null
          rating: number
          state: string
          suburb: string | null
          trading_name: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          abn?: string | null
          account_number?: string | null
          address?: string | null
          brands?: string[] | null
          business_name: string
          categories?: string[]
          contact_name: string
          created_at?: string
          delivery_areas?: string[] | null
          email: string
          id?: string
          is_active?: boolean
          is_preferred?: boolean
          minimum_order?: number | null
          notes?: string | null
          payment_terms?: string | null
          phone: string
          postcode?: string | null
          rating?: number
          state: string
          suburb?: string | null
          trading_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          abn?: string | null
          account_number?: string | null
          address?: string | null
          brands?: string[] | null
          business_name?: string
          categories?: string[]
          contact_name?: string
          created_at?: string
          delivery_areas?: string[] | null
          email?: string
          id?: string
          is_active?: boolean
          is_preferred?: boolean
          minimum_order?: number | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string
          postcode?: string | null
          rating?: number
          state?: string
          suburb?: string | null
          trading_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      takeoff_sessions: {
        Row: {
          cost_items: Json
          measurements: Json
          pdf_name: string | null
          pdf_page_count: number | null
          pdf_url: string | null
          plan_id: string | null
          project_id: string
          scales: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_items?: Json
          measurements?: Json
          pdf_name?: string | null
          pdf_page_count?: number | null
          pdf_url?: string | null
          plan_id?: string | null
          project_id: string
          scales?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_items?: Json
          measurements?: Json
          pdf_name?: string | null
          pdf_page_count?: number | null
          pdf_url?: string | null
          plan_id?: string | null
          project_id?: string
          scales?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "takeoff_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          email: string
          id: string
          invited_at: string
          joined_at: string | null
          role: string
          status: string
          team_id: string
          user_id: string | null
        }
        Insert: {
          email: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          role?: string
          status?: string
          team_id: string
          user_id?: string | null
        }
        Update: {
          email?: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          role?: string
          status?: string
          team_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          max_seats: number
          name: string | null
          owner_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_seats?: number
          name?: string | null
          owner_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_seats?: number
          name?: string | null
          owner_user_id?: string
        }
        Relationships: []
      }
      tender_documents: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number
          file_type: string
          file_url: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tender_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          org_id: string | null
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          org_id?: string | null
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      variations: {
        Row: {
          approved_at: string | null
          created_at: string | null
          description: string
          id: string
          items: Json
          notes: string
          number: number
          project_id: string
          reason: string
          rejected_at: string | null
          status: string
          title: string
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string | null
          description?: string
          id?: string
          items?: Json
          notes?: string
          number?: number
          project_id: string
          reason?: string
          rejected_at?: string | null
          status?: string
          title?: string
          total_amount?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string | null
          description?: string
          id?: string
          items?: Json
          notes?: string
          number?: number
          project_id?: string
          reason?: string
          rejected_at?: string | null
          status?: string
          title?: string
          total_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          event_type: string
          id: string
          next_retry_at: string | null
          payload: Json
          response: string | null
          status: string
          status_code: number | null
          webhook_id: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          event_type: string
          id?: string
          next_retry_at?: string | null
          payload: Json
          response?: string | null
          status?: string
          status_code?: number | null
          webhook_id?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          event_type?: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          response?: string | null
          status?: string
          status_code?: number | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          events: string[]
          headers: Json | null
          id: string
          is_active: boolean
          last_status: string | null
          last_triggered_at: string | null
          name: string
          retry_count: number
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          headers?: Json | null
          id?: string
          is_active?: boolean
          last_status?: string | null
          last_triggered_at?: string | null
          name: string
          retry_count?: number
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          events?: string[]
          headers?: Json | null
          id?: string
          is_active?: boolean
          last_status?: string | null
          last_triggered_at?: string | null
          name?: string
          retry_count?: number
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      assembly_trades: {
        Row: {
          assembly_id: string | null
          trade_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembly_components_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembly_components_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      resolve_rate: {
        Args: {
          p_cost_item_id: string
          p_on_date?: string
          p_org_id: string
          p_region: string
        }
        Returns: {
          rate_id: string
          unit_rate: number
        }[]
      }
    }
    Enums: {
      assembly_status: "draft" | "published" | "archived"
      assembly_type: "standard" | "preliminaries"
      item_type: "material" | "labour" | "plant" | "subcontract" | "other"
      prelim_driver_type: "pct_of_contract" | "per_week" | "per_month" | "fixed"
      rounding_rule: "none" | "up_to_pack"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      assembly_status: ["draft", "published", "archived"],
      assembly_type: ["standard", "preliminaries"],
      item_type: ["material", "labour", "plant", "subcontract", "other"],
      prelim_driver_type: ["pct_of_contract", "per_week", "per_month", "fixed"],
      rounding_rule: ["none", "up_to_pack"],
    },
  },
} as const
