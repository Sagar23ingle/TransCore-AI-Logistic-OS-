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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_requests: {
        Row: {
          created_at: string
          error: string | null
          id: string
          kind: string
          model: string | null
          owner_id: string
          prompt: string | null
          response: string | null
          status: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          model?: string | null
          owner_id: string
          prompt?: string | null
          response?: string | null
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          model?: string | null
          owner_id?: string
          prompt?: string | null
          response?: string | null
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: []
      }
      alert_prefs: {
        Row: {
          document_expiry: boolean
          email_enabled: boolean
          emi_reminders: boolean
          maintenance: boolean
          marketplace_matches: boolean
          push_enabled: boolean
          trip_updates: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          document_expiry?: boolean
          email_enabled?: boolean
          emi_reminders?: boolean
          maintenance?: boolean
          marketplace_matches?: boolean
          push_enabled?: boolean
          trip_updates?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          document_expiry?: boolean
          email_enabled?: boolean
          emi_reminders?: boolean
          maintenance?: boolean
          marketplace_matches?: boolean
          push_enabled?: boolean
          trip_updates?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          company_id: string | null
          created_at: string
          days_remaining: number | null
          dedup_key: string
          driver_id: string | null
          due_date: string | null
          id: string
          is_dismissed: boolean
          is_read: boolean
          kind: string
          message: string | null
          owner_id: string
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
          vehicle_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          days_remaining?: number | null
          dedup_key: string
          driver_id?: string | null
          due_date?: string | null
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          kind: string
          message?: string | null
          owner_id: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          title: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          days_remaining?: number | null
          dedup_key?: string
          driver_id?: string | null
          due_date?: string | null
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          kind?: string
          message?: string | null
          owner_id?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          title?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event: string
          id: number
          props: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: number
          props?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: number
          props?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string | null
          entity: string | null
          entity_id: string | null
          id: number
          ip: string | null
          metadata: Json | null
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          company_id?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: number
          ip?: string | null
          metadata?: Json | null
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: number
          ip?: string | null
          metadata?: Json | null
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          gstin: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          gstin?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          gstin?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["company_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          company_id: string | null
          created_at: string
          doc_type: Database["public"]["Enums"]["document_type"]
          driver_id: string | null
          expiry_date: string | null
          id: string
          issued_on: string | null
          mime_type: string | null
          notes: string | null
          owner_id: string
          size_bytes: number | null
          storage_path: string
          title: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          doc_type: Database["public"]["Enums"]["document_type"]
          driver_id?: string | null
          expiry_date?: string | null
          id?: string
          issued_on?: string | null
          mime_type?: string | null
          notes?: string | null
          owner_id: string
          size_bytes?: number | null
          storage_path: string
          title: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          driver_id?: string | null
          expiry_date?: string | null
          id?: string
          issued_on?: string | null
          mime_type?: string | null
          notes?: string | null
          owner_id?: string
          size_bytes?: number | null
          storage_path?: string
          title?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_scores: {
        Row: {
          avg_speed_kmh: number | null
          company_id: string | null
          computed_at: string
          distance_km: number
          driver_id: string
          fuel_efficiency_kmpl: number | null
          id: string
          max_speed_kmh: number | null
          overall_score: number
          owner_id: string
          performance_score: number
          period_end: string
          period_start: string
          safety_score: number
          speed_violations: number
          trips_completed: number
          trips_delayed: number
        }
        Insert: {
          avg_speed_kmh?: number | null
          company_id?: string | null
          computed_at?: string
          distance_km?: number
          driver_id: string
          fuel_efficiency_kmpl?: number | null
          id?: string
          max_speed_kmh?: number | null
          overall_score?: number
          owner_id: string
          performance_score?: number
          period_end: string
          period_start: string
          safety_score?: number
          speed_violations?: number
          trips_completed?: number
          trips_delayed?: number
        }
        Update: {
          avg_speed_kmh?: number | null
          company_id?: string | null
          computed_at?: string
          distance_km?: number
          driver_id?: string
          fuel_efficiency_kmpl?: number | null
          id?: string
          max_speed_kmh?: number | null
          overall_score?: number
          owner_id?: string
          performance_score?: number
          period_end?: string
          period_start?: string
          safety_score?: number
          speed_violations?: number
          trips_completed?: number
          trips_delayed?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_scores_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          address: string | null
          company_id: string | null
          created_at: string
          full_name: string
          id: string
          joined_on: string | null
          license_expiry: string | null
          license_number: string | null
          monthly_salary: number | null
          notes: string | null
          owner_id: string
          phone: string | null
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          joined_on?: string | null
          license_expiry?: string | null
          license_number?: string | null
          monthly_salary?: number | null
          notes?: string | null
          owner_id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          joined_on?: string | null
          license_expiry?: string | null
          license_number?: string | null
          monthly_salary?: number | null
          notes?: string | null
          owner_id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      error_reports: {
        Row: {
          created_at: string
          id: number
          message: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          message: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          message?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          incurred_on: string
          owner_id: string
          receipt_path: string | null
          trip_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          incurred_on?: string
          owner_id: string
          receipt_path?: string | null
          trip_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          incurred_on?: string
          owner_id?: string
          receipt_path?: string | null
          trip_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_logs: {
        Row: {
          company_id: string | null
          created_at: string
          driver_id: string | null
          filled_on: string
          id: string
          is_full_tank: boolean
          litres: number
          notes: string | null
          odometer_km: number
          owner_id: string
          price_per_litre: number
          station: string | null
          total_amount: number
          trip_id: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          driver_id?: string | null
          filled_on?: string
          id?: string
          is_full_tank?: boolean
          litres: number
          notes?: string | null
          odometer_km: number
          owner_id: string
          price_per_litre: number
          station?: string | null
          total_amount: number
          trip_id?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          driver_id?: string | null
          filled_on?: string
          id?: string
          is_full_tank?: boolean
          litres?: number
          notes?: string | null
          odometer_km?: number
          owner_id?: string
          price_per_litre?: number
          station?: string | null
          total_amount?: number
          trip_id?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_events: {
        Row: {
          company_id: string | null
          event_type: Database["public"]["Enums"]["geofence_event_type"]
          geofence_id: string
          id: number
          owner_id: string
          recorded_at: string
          trip_id: string | null
          vehicle_id: string
        }
        Insert: {
          company_id?: string | null
          event_type: Database["public"]["Enums"]["geofence_event_type"]
          geofence_id: string
          id?: number
          owner_id: string
          recorded_at?: string
          trip_id?: string | null
          vehicle_id: string
        }
        Update: {
          company_id?: string | null
          event_type?: Database["public"]["Enums"]["geofence_event_type"]
          geofence_id?: string
          id?: number
          owner_id?: string
          recorded_at?: string
          trip_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_geofence_id_fkey"
            columns: ["geofence_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      geofences: {
        Row: {
          center_lat: number
          center_lng: number
          color: string
          company_id: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          radius_m: number
          updated_at: string
        }
        Insert: {
          center_lat: number
          center_lng: number
          color?: string
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          radius_m: number
          updated_at?: string
        }
        Update: {
          center_lat?: number
          center_lng?: number
          color?: string
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          radius_m?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_pings: {
        Row: {
          accuracy_m: number | null
          company_id: string | null
          heading: number | null
          id: number
          lat: number
          lng: number
          owner_id: string
          recorded_at: string
          source: string
          speed_kmh: number | null
          trip_id: string | null
          vehicle_id: string
        }
        Insert: {
          accuracy_m?: number | null
          company_id?: string | null
          heading?: number | null
          id?: number
          lat: number
          lng: number
          owner_id: string
          recorded_at?: string
          source?: string
          speed_kmh?: number | null
          trip_id?: string | null
          vehicle_id: string
        }
        Update: {
          accuracy_m?: number | null
          company_id?: string | null
          heading?: number | null
          id?: number
          lat?: number
          lng?: number
          owner_id?: string
          recorded_at?: string
          source?: string
          speed_kmh?: number | null
          trip_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_pings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_pings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_pings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_inr: number
          company_id: string | null
          created_at: string
          gst_amount: number
          id: string
          invoice_number: string
          issued_at: string | null
          owner_id: string
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_inr: number
          company_id?: string | null
          created_at?: string
          gst_amount?: number
          id?: string
          invoice_number: string
          issued_at?: string | null
          owner_id: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          amount_inr?: number
          company_id?: string | null
          created_at?: string
          gst_amount?: number
          id?: string
          invoice_number?: string
          issued_at?: string | null
          owner_id?: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      load_bids: {
        Row: {
          bid_amount: number
          bidder_id: string
          created_at: string
          id: string
          load_id: string
          message: string | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
        }
        Insert: {
          bid_amount: number
          bidder_id: string
          created_at?: string
          id?: string
          load_id: string
          message?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Update: {
          bid_amount?: number
          bidder_id?: string
          created_at?: string
          id?: string
          load_id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_bids_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
      loads: {
        Row: {
          assigned_owner_id: string | null
          assigned_vehicle_id: string | null
          broker_id: string
          budget_amount: number
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          delivery_by: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          distance_km: number | null
          goods_type: string
          id: string
          notes: string | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          pickup_at: string
          status: Database["public"]["Enums"]["load_status"]
          title: string
          updated_at: string
          vehicle_type: string
          weight_tons: number
        }
        Insert: {
          assigned_owner_id?: string | null
          assigned_vehicle_id?: string | null
          broker_id: string
          budget_amount?: number
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          delivery_by?: string | null
          destination: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          goods_type: string
          id?: string
          notes?: string | null
          origin: string
          origin_lat?: number | null
          origin_lng?: number | null
          pickup_at: string
          status?: Database["public"]["Enums"]["load_status"]
          title: string
          updated_at?: string
          vehicle_type: string
          weight_tons: number
        }
        Update: {
          assigned_owner_id?: string | null
          assigned_vehicle_id?: string | null
          broker_id?: string
          budget_amount?: number
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          delivery_by?: string | null
          destination?: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          goods_type?: string
          id?: string
          notes?: string | null
          origin?: string
          origin_lat?: number | null
          origin_lng?: number | null
          pickup_at?: string
          status?: Database["public"]["Enums"]["load_status"]
          title?: string
          updated_at?: string
          vehicle_type?: string
          weight_tons?: number
        }
        Relationships: [
          {
            foreignKeyName: "loads_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          company_id: string | null
          cost: number
          created_at: string
          id: string
          next_service_due_km: number | null
          next_service_due_on: string | null
          notes: string | null
          odometer_km: number | null
          owner_id: string
          service_type: string
          serviced_on: string
          updated_at: string
          vehicle_id: string
          vendor: string | null
        }
        Insert: {
          company_id?: string | null
          cost?: number
          created_at?: string
          id?: string
          next_service_due_km?: number | null
          next_service_due_on?: string | null
          notes?: string | null
          odometer_km?: number | null
          owner_id: string
          service_type: string
          serviced_on?: string
          updated_at?: string
          vehicle_id: string
          vendor?: string | null
        }
        Update: {
          company_id?: string | null
          cost?: number
          created_at?: string
          id?: string
          next_service_due_km?: number | null
          next_service_due_on?: string | null
          notes?: string | null
          odometer_km?: number | null
          owner_id?: string
          service_type?: string
          serviced_on?: string
          updated_at?: string
          vehicle_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_inr: number
          created_at: string
          id: string
          invoice_id: string | null
          owner_id: string
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          raw: Json | null
          status: string
        }
        Insert: {
          amount_inr: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          owner_id: string
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          raw?: Json | null
          status: string
        }
        Update: {
          amount_inr?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          owner_id?: string
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          raw?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          ai_monthly_limit: number
          features: Json
          id: string
          interval: string
          is_active: boolean
          name: string
          price_inr: number
          sort_order: number
          vehicle_limit: number
        }
        Insert: {
          ai_monthly_limit?: number
          features?: Json
          id: string
          interval?: string
          is_active?: boolean
          name: string
          price_inr?: number
          sort_order?: number
          vehicle_limit?: number
        }
        Update: {
          ai_monthly_limit?: number
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          name?: string
          price_inr?: number
          sort_order?: number
          vehicle_limit?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          owner_id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          owner_id: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          owner_id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          advance_paid: number | null
          client_name: string | null
          company_id: string | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          distance_km: number | null
          driver_id: string | null
          end_odometer_km: number | null
          freight_amount: number | null
          goods_description: string | null
          id: string
          last_ping_at: string | null
          notes: string | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          owner_id: string
          scheduled_start: string | null
          start_odometer_km: number | null
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          advance_paid?: number | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          destination: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          end_odometer_km?: number | null
          freight_amount?: number | null
          goods_description?: string | null
          id?: string
          last_ping_at?: string | null
          notes?: string | null
          origin: string
          origin_lat?: number | null
          origin_lng?: number | null
          owner_id: string
          scheduled_start?: string | null
          start_odometer_km?: number | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          advance_paid?: number | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          destination?: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          end_odometer_km?: number | null
          freight_amount?: number | null
          goods_description?: string | null
          id?: string
          last_ping_at?: string | null
          notes?: string | null
          origin?: string
          origin_lat?: number | null
          origin_lng?: number | null
          owner_id?: string
          scheduled_start?: string | null
          start_odometer_km?: number | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_posts: {
        Row: {
          available_from: string
          capacity_tons: number
          contact_phone: string | null
          created_at: string
          expected_rate: number | null
          from_lat: number | null
          from_lng: number | null
          from_location: string
          id: string
          is_active: boolean
          notes: string | null
          owner_id: string
          to_lat: number | null
          to_lng: number | null
          to_location: string | null
          updated_at: string
          vehicle_id: string | null
          vehicle_type: string
        }
        Insert: {
          available_from: string
          capacity_tons: number
          contact_phone?: string | null
          created_at?: string
          expected_rate?: number | null
          from_lat?: number | null
          from_lng?: number | null
          from_location: string
          id?: string
          is_active?: boolean
          notes?: string | null
          owner_id: string
          to_lat?: number | null
          to_lng?: number | null
          to_location?: string | null
          updated_at?: string
          vehicle_id?: string | null
          vehicle_type: string
        }
        Update: {
          available_from?: string
          capacity_tons?: number
          contact_phone?: string | null
          created_at?: string
          expected_rate?: number | null
          from_lat?: number | null
          from_lng?: number | null
          from_location?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          owner_id?: string
          to_lat?: number | null
          to_lng?: number | null
          to_location?: string | null
          updated_at?: string
          vehicle_id?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_posts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          capacity_tons: number | null
          company_id: string | null
          created_at: string
          emi_next_due: string | null
          fitness_expiry: string | null
          fuel_type: string | null
          id: string
          insurance_expiry: string | null
          maintenance_next_due: string | null
          make: string | null
          model: string | null
          notes: string | null
          odometer_km: number | null
          owner_id: string
          permit_expiry: string | null
          puc_expiry: string | null
          registration_number: string
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          year: number | null
        }
        Insert: {
          capacity_tons?: number | null
          company_id?: string | null
          created_at?: string
          emi_next_due?: string | null
          fitness_expiry?: string | null
          fuel_type?: string | null
          id?: string
          insurance_expiry?: string | null
          maintenance_next_due?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          odometer_km?: number | null
          owner_id: string
          permit_expiry?: string | null
          puc_expiry?: string | null
          registration_number: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          year?: number | null
        }
        Update: {
          capacity_tons?: number | null
          company_id?: string | null
          created_at?: string
          emi_next_due?: string | null
          fitness_expiry?: string | null
          fuel_type?: string | null
          id?: string
          insurance_expiry?: string | null
          maintenance_next_due?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          odometer_km?: number | null
          owner_id?: string
          permit_expiry?: string | null
          puc_expiry?: string | null
          registration_number?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write_company: { Args: { _company: string }; Returns: boolean }
      check_rate_limit: {
        Args: { _key: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      company_role_of: {
        Args: { _company: string; _user: string }
        Returns: Database["public"]["Enums"]["company_role"]
      }
      current_user_is_admin: { Args: never; Returns: boolean }
      default_company_for: { Args: { _user: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_company_member: { Args: { _company: string }; Returns: boolean }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      app_role:
        | "super_admin"
        | "fleet_owner"
        | "driver"
        | "broker"
        | "fleet_manager"
      company_role: "owner" | "manager" | "driver" | "broker" | "viewer"
      document_type:
        | "rc"
        | "insurance"
        | "permit"
        | "fitness"
        | "puc"
        | "driving_license"
        | "vehicle_photo"
        | "other"
      driver_status: "active" | "on_leave" | "inactive"
      expense_category:
        | "fuel"
        | "toll"
        | "maintenance"
        | "driver_allowance"
        | "loading"
        | "unloading"
        | "other"
      geofence_event_type: "enter" | "exit"
      invoice_status: "draft" | "issued" | "paid" | "void" | "failed"
      load_status:
        | "open"
        | "assigned"
        | "in_transit"
        | "delivered"
        | "cancelled"
      match_status:
        | "suggested"
        | "offered"
        | "accepted"
        | "rejected"
        | "expired"
      subscription_plan: "free" | "starter" | "professional" | "enterprise"
      subscription_status: "active" | "cancelled" | "past_due" | "trialing"
      trip_status: "planned" | "in_progress" | "completed" | "cancelled"
      vehicle_status: "active" | "maintenance" | "inactive"
      vehicle_type:
        | "truck"
        | "trailer"
        | "tanker"
        | "container"
        | "pickup"
        | "other"
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
  public: {
    Enums: {
      alert_severity: ["info", "warning", "critical"],
      app_role: [
        "super_admin",
        "fleet_owner",
        "driver",
        "broker",
        "fleet_manager",
      ],
      company_role: ["owner", "manager", "driver", "broker", "viewer"],
      document_type: [
        "rc",
        "insurance",
        "permit",
        "fitness",
        "puc",
        "driving_license",
        "vehicle_photo",
        "other",
      ],
      driver_status: ["active", "on_leave", "inactive"],
      expense_category: [
        "fuel",
        "toll",
        "maintenance",
        "driver_allowance",
        "loading",
        "unloading",
        "other",
      ],
      geofence_event_type: ["enter", "exit"],
      invoice_status: ["draft", "issued", "paid", "void", "failed"],
      load_status: ["open", "assigned", "in_transit", "delivered", "cancelled"],
      match_status: ["suggested", "offered", "accepted", "rejected", "expired"],
      subscription_plan: ["free", "starter", "professional", "enterprise"],
      subscription_status: ["active", "cancelled", "past_due", "trialing"],
      trip_status: ["planned", "in_progress", "completed", "cancelled"],
      vehicle_status: ["active", "maintenance", "inactive"],
      vehicle_type: [
        "truck",
        "trailer",
        "tanker",
        "container",
        "pickup",
        "other",
      ],
    },
  },
} as const
