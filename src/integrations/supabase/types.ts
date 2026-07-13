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
      alerts: {
        Row: {
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
      documents: {
        Row: {
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
      drivers: {
        Row: {
          address: string | null
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
        Relationships: []
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
      gps_pings: {
        Row: {
          accuracy_m: number | null
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
          created_at: string
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          distance_km: number | null
          driver_id: string | null
          freight_amount: number | null
          goods_description: string | null
          id: string
          notes: string | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          owner_id: string
          scheduled_start: string | null
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          advance_paid?: number | null
          client_name?: string | null
          created_at?: string
          destination: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          freight_amount?: number | null
          goods_description?: string | null
          id?: string
          notes?: string | null
          origin: string
          origin_lat?: number | null
          origin_lng?: number | null
          owner_id: string
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          advance_paid?: number | null
          client_name?: string | null
          created_at?: string
          destination?: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          freight_amount?: number | null
          goods_description?: string | null
          id?: string
          notes?: string | null
          origin?: string
          origin_lat?: number | null
          origin_lng?: number | null
          owner_id?: string
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_is_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      app_role: "super_admin" | "fleet_owner" | "driver" | "broker"
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
      app_role: ["super_admin", "fleet_owner", "driver", "broker"],
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
