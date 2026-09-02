export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      delivery_assignments: {
        Row: {
          created_at: string;
          delivered_at: string | null;
          distance_km: number | null;
          estimated_earning: number | null;
          expires_at: string;
          id: string;
          order_id: string;
          partner_id: string;
          picked_up_at: string | null;
          proof_type: string | null;
          proof_value: string | null;
          responded_at: string | null;
          status: Database["public"]["Enums"]["assignment_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          delivered_at?: string | null;
          distance_km?: number | null;
          estimated_earning?: number | null;
          expires_at?: string;
          id?: string;
          order_id: string;
          partner_id: string;
          picked_up_at?: string | null;
          proof_type?: string | null;
          proof_value?: string | null;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["assignment_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          delivered_at?: string | null;
          distance_km?: number | null;
          estimated_earning?: number | null;
          expires_at?: string;
          id?: string;
          order_id?: string;
          partner_id?: string;
          picked_up_at?: string | null;
          proof_type?: string | null;
          proof_value?: string | null;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["assignment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_assignments_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "delivery_partners";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_documents: {
        Row: {
          created_at: string;
          doc_type: Database["public"]["Enums"]["document_type"];
          expiry_date: string | null;
          file_path: string;
          id: string;
          partner_id: string;
          reviewer_note: string | null;
          status: Database["public"]["Enums"]["verification_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          doc_type: Database["public"]["Enums"]["document_type"];
          expiry_date?: string | null;
          file_path: string;
          id?: string;
          partner_id: string;
          reviewer_note?: string | null;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          doc_type?: Database["public"]["Enums"]["document_type"];
          expiry_date?: string | null;
          file_path?: string;
          id?: string;
          partner_id?: string;
          reviewer_note?: string | null;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_documents_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "delivery_partners";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_earnings: {
        Row: {
          amount: number;
          assignment_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          partner_id: string;
          payout_id: string | null;
          type: Database["public"]["Enums"]["earning_type"];
        };
        Insert: {
          amount: number;
          assignment_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          partner_id: string;
          payout_id?: string | null;
          type?: Database["public"]["Enums"]["earning_type"];
        };
        Update: {
          amount?: number;
          assignment_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          partner_id?: string;
          payout_id?: string | null;
          type?: Database["public"]["Enums"]["earning_type"];
        };
        Relationships: [
          {
            foreignKeyName: "delivery_earnings_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "delivery_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_earnings_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "delivery_partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_earnings_payout_id_fkey";
            columns: ["payout_id"];
            isOneToOne: false;
            referencedRelation: "delivery_payouts";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_locations: {
        Row: {
          assignment_id: string | null;
          created_at: string;
          id: string;
          latitude: number;
          longitude: number;
          partner_id: string;
        };
        Insert: {
          assignment_id?: string | null;
          created_at?: string;
          id?: string;
          latitude: number;
          longitude: number;
          partner_id: string;
        };
        Update: {
          assignment_id?: string | null;
          created_at?: string;
          id?: string;
          latitude?: number;
          longitude?: number;
          partner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_locations_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "delivery_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_locations_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "delivery_partners";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          kind: string;
          partner_id: string;
          title: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          kind?: string;
          partner_id: string;
          title: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          kind?: string;
          partner_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_notifications_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "delivery_partners";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_partner_zones: {
        Row: {
          id: string;
          partner_id: string;
          zone_id: string;
        };
        Insert: {
          id?: string;
          partner_id: string;
          zone_id: string;
        };
        Update: {
          id?: string;
          partner_id?: string;
          zone_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_partner_zones_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "delivery_partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_partner_zones_zone_id_fkey";
            columns: ["zone_id"];
            isOneToOne: false;
            referencedRelation: "delivery_zones";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_partners: {
        Row: {
          aadhaar_number: string | null;
          accepted_requests: number;
          admin_note: string | null;
          approved_at: string | null;
          area: string | null;
          availability: Database["public"]["Enums"]["availability_status"];
          bank_account_holder: string | null;
          bank_account_number: string | null;
          bank_ifsc: string | null;
          bank_name: string | null;
          cancelled_deliveries: number;
          city: string | null;
          created_at: string;
          current_latitude: number | null;
          current_longitude: number | null;
          date_of_birth: string | null;
          email: string;
          email_verified: boolean;
          emergency_contact_name: string | null;
          emergency_contact_number: string | null;
          employment_type: Database["public"]["Enums"]["employment_type"] | null;
          full_name: string;
          gender: string | null;
          house_number: string | null;
          id: string;
          late_deliveries: number;
          licence_expiry: string | null;
          licence_number: string | null;
          location_updated_at: string | null;
          mobile: string;
          mobile_verified: boolean;
          pan_number: string | null;
          pincode: string | null;
          profile_photo_url: string | null;
          rating: number;
          registration_step: number;
          state: string | null;
          status: Database["public"]["Enums"]["partner_status"];
          street: string | null;
          total_deliveries: number;
          total_requests: number;
          updated_at: string;
          upi_id: string | null;
          user_id: string;
          vehicle_brand: string | null;
          vehicle_color: string | null;
          vehicle_model: string | null;
          vehicle_number: string | null;
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null;
        };
        Insert: {
          aadhaar_number?: string | null;
          accepted_requests?: number;
          admin_note?: string | null;
          approved_at?: string | null;
          area?: string | null;
          availability?: Database["public"]["Enums"]["availability_status"];
          bank_account_holder?: string | null;
          bank_account_number?: string | null;
          bank_ifsc?: string | null;
          bank_name?: string | null;
          cancelled_deliveries?: number;
          city?: string | null;
          created_at?: string;
          current_latitude?: number | null;
          current_longitude?: number | null;
          date_of_birth?: string | null;
          email: string;
          email_verified?: boolean;
          emergency_contact_name?: string | null;
          emergency_contact_number?: string | null;
          employment_type?: Database["public"]["Enums"]["employment_type"] | null;
          full_name: string;
          gender?: string | null;
          house_number?: string | null;
          id?: string;
          late_deliveries?: number;
          licence_expiry?: string | null;
          licence_number?: string | null;
          location_updated_at?: string | null;
          mobile: string;
          mobile_verified?: boolean;
          pan_number?: string | null;
          pincode?: string | null;
          profile_photo_url?: string | null;
          rating?: number;
          registration_step?: number;
          state?: string | null;
          status?: Database["public"]["Enums"]["partner_status"];
          street?: string | null;
          total_deliveries?: number;
          total_requests?: number;
          updated_at?: string;
          upi_id?: string | null;
          user_id: string;
          vehicle_brand?: string | null;
          vehicle_color?: string | null;
          vehicle_model?: string | null;
          vehicle_number?: string | null;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null;
        };
        Update: {
          aadhaar_number?: string | null;
          accepted_requests?: number;
          admin_note?: string | null;
          approved_at?: string | null;
          area?: string | null;
          availability?: Database["public"]["Enums"]["availability_status"];
          bank_account_holder?: string | null;
          bank_account_number?: string | null;
          bank_ifsc?: string | null;
          bank_name?: string | null;
          cancelled_deliveries?: number;
          city?: string | null;
          created_at?: string;
          current_latitude?: number | null;
          current_longitude?: number | null;
          date_of_birth?: string | null;
          email?: string;
          email_verified?: boolean;
          emergency_contact_name?: string | null;
          emergency_contact_number?: string | null;
          employment_type?: Database["public"]["Enums"]["employment_type"] | null;
          full_name?: string;
          gender?: string | null;
          house_number?: string | null;
          id?: string;
          late_deliveries?: number;
          licence_expiry?: string | null;
          licence_number?: string | null;
          location_updated_at?: string | null;
          mobile?: string;
          mobile_verified?: boolean;
          pan_number?: string | null;
          pincode?: string | null;
          profile_photo_url?: string | null;
          rating?: number;
          registration_step?: number;
          state?: string | null;
          status?: Database["public"]["Enums"]["partner_status"];
          street?: string | null;
          total_deliveries?: number;
          total_requests?: number;
          updated_at?: string;
          upi_id?: string | null;
          user_id?: string;
          vehicle_brand?: string | null;
          vehicle_color?: string | null;
          vehicle_model?: string | null;
          vehicle_number?: string | null;
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null;
        };
        Relationships: [];
      };
      delivery_payouts: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          paid_at: string | null;
          partner_id: string;
          period_end: string | null;
          period_start: string | null;
          reference: string | null;
          status: Database["public"]["Enums"]["payout_status"];
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          paid_at?: string | null;
          partner_id: string;
          period_end?: string | null;
          period_start?: string | null;
          reference?: string | null;
          status?: Database["public"]["Enums"]["payout_status"];
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          paid_at?: string | null;
          partner_id?: string;
          period_end?: string | null;
          period_start?: string | null;
          reference?: string | null;
          status?: Database["public"]["Enums"]["payout_status"];
        };
        Relationships: [
          {
            foreignKeyName: "delivery_payouts_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "delivery_partners";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_ratings: {
        Row: {
          assignment_id: string | null;
          comment: string | null;
          created_at: string;
          id: string;
          is_complaint: boolean;
          partner_id: string;
          rating: number;
        };
        Insert: {
          assignment_id?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          is_complaint?: boolean;
          partner_id: string;
          rating: number;
        };
        Update: {
          assignment_id?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          is_complaint?: boolean;
          partner_id?: string;
          rating?: number;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_ratings_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "delivery_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_ratings_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "delivery_partners";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_shifts: {
        Row: {
          id: string;
          partner_id: string;
          slot: Database["public"]["Enums"]["shift_slot"];
        };
        Insert: {
          id?: string;
          partner_id: string;
          slot: Database["public"]["Enums"]["shift_slot"];
        };
        Update: {
          id?: string;
          partner_id?: string;
          slot?: Database["public"]["Enums"]["shift_slot"];
        };
        Relationships: [
          {
            foreignKeyName: "delivery_shifts_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "delivery_partners";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_tracking: {
        Row: {
          assignment_id: string;
          created_at: string;
          id: string;
          note: string | null;
          status: Database["public"]["Enums"]["assignment_status"];
        };
        Insert: {
          assignment_id: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          status: Database["public"]["Enums"]["assignment_status"];
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          status?: Database["public"]["Enums"]["assignment_status"];
        };
        Relationships: [
          {
            foreignKeyName: "delivery_tracking_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "delivery_assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_zones: {
        Row: {
          city: string;
          created_at: string;
          id: string;
          is_active: boolean;
          latitude: number | null;
          longitude: number | null;
          name: string;
          radius_km: number;
        };
        Insert: {
          city?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          radius_km?: number;
        };
        Update: {
          city?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          radius_km?: number;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          assigned_partner_id: string | null;
          created_at: string;
          customer_address: string;
          customer_latitude: number;
          customer_longitude: number;
          customer_name: string;
          customer_phone: string;
          delivered_at: string | null;
          delivery_fee: number;
          delivery_notes: string | null;
          delivery_otp: string;
          id: string;
          items: Json;
          order_code: string;
          order_total: number;
          ready_at: string | null;
          status: Database["public"]["Enums"]["order_status"];
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          assigned_partner_id?: string | null;
          created_at?: string;
          customer_address: string;
          customer_latitude: number;
          customer_longitude: number;
          customer_name: string;
          customer_phone: string;
          delivered_at?: string | null;
          delivery_fee?: number;
          delivery_notes?: string | null;
          delivery_otp?: string;
          id?: string;
          items?: Json;
          order_code?: string;
          order_total?: number;
          ready_at?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          assigned_partner_id?: string | null;
          created_at?: string;
          customer_address?: string;
          customer_latitude?: number;
          customer_longitude?: number;
          customer_name?: string;
          customer_phone?: string;
          delivered_at?: string | null;
          delivery_fee?: number;
          delivery_notes?: string | null;
          delivery_otp?: string;
          id?: string;
          items?: Json;
          order_code?: string;
          order_total?: number;
          ready_at?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_assigned_partner_id_fkey";
            columns: ["assigned_partner_id"];
            isOneToOne: false;
            referencedRelation: "delivery_partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      vendors: {
        Row: {
          address: string;
          area: string | null;
          city: string | null;
          created_at: string;
          id: string;
          latitude: number;
          longitude: number;
          owner_id: string | null;
          phone: string;
          shop_name: string;
        };
        Insert: {
          address: string;
          area?: string | null;
          city?: string | null;
          created_at?: string;
          id?: string;
          latitude: number;
          longitude: number;
          owner_id?: string | null;
          phone: string;
          shop_name: string;
        };
        Update: {
          address?: string;
          area?: string | null;
          city?: string | null;
          created_at?: string;
          id?: string;
          latitude?: number;
          longitude?: number;
          owner_id?: string | null;
          phone?: string;
          shop_name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_delivery_request: {
        Args: { _assignment_id: string };
        Returns: string;
      };
      broadcast_delivery_request: {
        Args: { _order_id: string; _timeout_seconds?: number };
        Returns: number;
      };
      complete_delivery: {
        Args: {
          _assignment_id: string;
          _proof_type: string;
          _proof_value: string;
        };
        Returns: undefined;
      };
      claim_next_delivery_offer: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      partner_go_offline: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      reject_delivery_request: {
        Args: { _assignment_id: string };
        Returns: undefined;
      };
      submit_partner_location: {
        Args: {
          _accuracy_m?: number | null;
          _captured_at?: string;
          _latitude: number;
          _longitude: number;
        };
        Returns: undefined;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_my_partner: { Args: { _partner_id: string }; Returns: boolean };
      my_partner_id: { Args: never; Returns: string };
      update_delivery_location: {
        Args: {
          _assignment_id: string;
          _latitude: number;
          _longitude: number;
          _heading?: number | null;
          _speed?: number | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "admin" | "vendor" | "delivery_partner" | "customer";
      assignment_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "expired"
        | "navigating_to_vendor"
        | "reached_vendor"
        | "picked_up"
        | "out_for_delivery"
        | "delivered"
        | "cancelled";
      availability_status: "offline" | "online" | "break";
      document_type:
        | "licence"
        | "rc"
        | "insurance"
        | "aadhaar_front"
        | "aadhaar_back"
        | "pan"
        | "vehicle_photo"
        | "profile_photo";
      earning_type: "delivery_fee" | "bonus" | "incentive" | "tip" | "penalty";
      employment_type: "full_time" | "part_time";
      order_status:
        | "placed"
        | "vendor_accepted"
        | "picking"
        | "packed"
        | "ready_for_pickup"
        | "assigned"
        | "picked_up"
        | "out_for_delivery"
        | "delivered"
        | "cancelled";
      partner_status:
        "draft" | "pending_verification" | "info_requested" | "approved" | "rejected" | "suspended";
      payout_status: "pending" | "processing" | "paid" | "failed";
      shift_slot: "morning" | "afternoon" | "evening" | "night";
      vehicle_type: "bike" | "scooter" | "ev" | "bicycle";
      verification_status: "pending" | "verified" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "vendor", "delivery_partner", "customer"],
      assignment_status: [
        "pending",
        "accepted",
        "rejected",
        "expired",
        "navigating_to_vendor",
        "reached_vendor",
        "picked_up",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      availability_status: ["offline", "online", "break"],
      document_type: [
        "licence",
        "rc",
        "insurance",
        "aadhaar_front",
        "aadhaar_back",
        "pan",
        "vehicle_photo",
        "profile_photo",
      ],
      earning_type: ["delivery_fee", "bonus", "incentive", "tip", "penalty"],
      employment_type: ["full_time", "part_time"],
      order_status: [
        "placed",
        "vendor_accepted",
        "picking",
        "packed",
        "ready_for_pickup",
        "assigned",
        "picked_up",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      partner_status: [
        "draft",
        "pending_verification",
        "info_requested",
        "approved",
        "rejected",
        "suspended",
      ],
      payout_status: ["pending", "processing", "paid", "failed"],
      shift_slot: ["morning", "afternoon", "evening", "night"],
      vehicle_type: ["bike", "scooter", "ev", "bicycle"],
      verification_status: ["pending", "verified", "rejected"],
    },
  },
} as const;
