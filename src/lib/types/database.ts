export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          domain: string;
          settings: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          domain: string;
          settings?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          domain?: string;
          settings?: Record<string, unknown>;
          created_at?: string;
        };
      };

      users: {
        Row: {
          id: string;
          tenant_id: string;
          auth_id: string;
          email: string;
          role: Database['public']['Enums']['user_role'];
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          auth_id: string;
          email: string;
          role?: Database['public']['Enums']['user_role'];
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          auth_id?: string;
          email?: string;
          role?: Database['public']['Enums']['user_role'];
          created_at?: string;
        };
      };

      employee_profiles: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string;
          grade: string;
          tenure_months: number;
          location: string;
          legal_entity: string;
          extra: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          user_id: string;
          tenant_id: string;
          grade?: string;
          tenure_months?: number;
          location?: string;
          legal_entity?: string;
          extra?: Record<string, unknown>;
        };
        Update: {
          id?: string;
          user_id?: string;
          tenant_id?: string;
          grade?: string;
          tenure_months?: number;
          location?: string;
          legal_entity?: string;
          extra?: Record<string, unknown>;
        };
      };

      benefit_categories: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          icon: string;
          sort_order: number;
          global_category_id: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          icon?: string;
          sort_order?: number;
          global_category_id?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          icon?: string;
          sort_order?: number;
          global_category_id?: string | null;
        };
      };

      benefits: {
        Row: {
          id: string;
          tenant_id: string;
          category_id: string;
          name: string;
          description: string;
          price_points: number;
          stock_limit: number | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          category_id: string;
          name: string;
          description?: string;
          price_points: number;
          stock_limit?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          category_id?: string;
          name?: string;
          description?: string;
          price_points?: number;
          stock_limit?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
      };

      eligibility_rules: {
        Row: {
          id: string;
          benefit_id: string | null;
          tenant_id: string;
          conditions: Record<string, unknown>;
          tenant_offering_id: string | null;
        };
        Insert: {
          id?: string;
          benefit_id?: string | null;
          tenant_id: string;
          conditions?: Record<string, unknown>;
          tenant_offering_id?: string | null;
        };
        Update: {
          id?: string;
          benefit_id?: string | null;
          tenant_id?: string;
          conditions?: Record<string, unknown>;
          tenant_offering_id?: string | null;
        };
      };

      budget_policies: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          points_amount: number;
          period: Database['public']['Enums']['budget_period'];
          target_filter: Record<string, unknown>;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          points_amount: number;
          period?: Database['public']['Enums']['budget_period'];
          target_filter?: Record<string, unknown>;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          points_amount?: number;
          period?: Database['public']['Enums']['budget_period'];
          target_filter?: Record<string, unknown>;
          is_active?: boolean;
        };
      };

      wallets: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string;
          balance: number;
          reserved: number;
          period: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tenant_id: string;
          balance?: number;
          reserved?: number;
          period: string;
          expires_at: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tenant_id?: string;
          balance?: number;
          reserved?: number;
          period?: string;
          expires_at?: string;
        };
      };

      point_ledger: {
        Row: {
          id: string;
          wallet_id: string;
          tenant_id: string;
          order_id: string | null;
          type: Database['public']['Enums']['ledger_type'];
          amount: number;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          tenant_id: string;
          order_id?: string | null;
          type: Database['public']['Enums']['ledger_type'];
          amount: number;
          description?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          wallet_id?: string;
          tenant_id?: string;
          order_id?: string | null;
          type?: Database['public']['Enums']['ledger_type'];
          amount?: number;
          description?: string;
          created_at?: string;
        };
      };

      orders: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string;
          status: Database['public']['Enums']['order_status'];
          total_points: number;
          reserved_at: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tenant_id: string;
          status?: Database['public']['Enums']['order_status'];
          total_points: number;
          reserved_at?: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tenant_id?: string;
          status?: Database['public']['Enums']['order_status'];
          total_points?: number;
          reserved_at?: string;
          expires_at?: string;
          created_at?: string;
        };
      };

      order_items: {
        Row: {
          id: string;
          order_id: string;
          benefit_id: string | null;
          quantity: number;
          price_points: number;
          provider_offering_id: string | null;
          tenant_offering_id: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          benefit_id?: string | null;
          quantity?: number;
          price_points: number;
          provider_offering_id?: string | null;
          tenant_offering_id?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          benefit_id?: string | null;
          quantity?: number;
          price_points?: number;
          provider_offering_id?: string | null;
          tenant_offering_id?: string | null;
        };
      };

      audit_log: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          diff: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          diff?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          diff?: Record<string, unknown>;
          created_at?: string;
        };
      };

      // ---------------------------------------------------------------
      // Marketplace tables
      // ---------------------------------------------------------------

      global_categories: {
        Row: {
          id: string;
          name: string;
          icon: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          icon?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          icon?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };

      providers: {
        Row: {
          id: string;
          owner_user_id: string;
          name: string;
          slug: string;
          description: string;
          logo_url: string | null;
          website: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          address: string | null;
          status: Database['public']['Enums']['provider_status'];
          verified_at: string | null;
          verified_by: string | null;
          rejection_reason: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          name: string;
          slug: string;
          description?: string;
          logo_url?: string | null;
          website?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          address?: string | null;
          status?: Database['public']['Enums']['provider_status'];
          verified_at?: string | null;
          verified_by?: string | null;
          rejection_reason?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          name?: string;
          slug?: string;
          description?: string;
          logo_url?: string | null;
          website?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          address?: string | null;
          status?: Database['public']['Enums']['provider_status'];
          verified_at?: string | null;
          verified_by?: string | null;
          rejection_reason?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };

      provider_offerings: {
        Row: {
          id: string;
          provider_id: string;
          global_category_id: string | null;
          name: string;
          description: string;
          long_description: string;
          image_urls: string[];
          base_price_points: number;
          stock_limit: number | null;
          status: Database['public']['Enums']['offering_status'];
          delivery_info: string;
          terms_conditions: string;
          metadata: Record<string, unknown>;
          avg_rating: number;
          review_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          global_category_id?: string | null;
          name: string;
          description?: string;
          long_description?: string;
          image_urls?: string[];
          base_price_points: number;
          stock_limit?: number | null;
          status?: Database['public']['Enums']['offering_status'];
          delivery_info?: string;
          terms_conditions?: string;
          metadata?: Record<string, unknown>;
          avg_rating?: number;
          review_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          global_category_id?: string | null;
          name?: string;
          description?: string;
          long_description?: string;
          image_urls?: string[];
          base_price_points?: number;
          stock_limit?: number | null;
          status?: Database['public']['Enums']['offering_status'];
          delivery_info?: string;
          terms_conditions?: string;
          metadata?: Record<string, unknown>;
          avg_rating?: number;
          review_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      tenant_offerings: {
        Row: {
          id: string;
          tenant_id: string;
          provider_offering_id: string;
          custom_price_points: number | null;
          tenant_stock_limit: number | null;
          is_active: boolean;
          tenant_category_id: string | null;
          enabled_by: string | null;
          enabled_at: string;
          tenant_avg_rating: number;
          tenant_review_count: number;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          provider_offering_id: string;
          custom_price_points?: number | null;
          tenant_stock_limit?: number | null;
          is_active?: boolean;
          tenant_category_id?: string | null;
          enabled_by?: string | null;
          enabled_at?: string;
          tenant_avg_rating?: number;
          tenant_review_count?: number;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          provider_offering_id?: string;
          custom_price_points?: number | null;
          tenant_stock_limit?: number | null;
          is_active?: boolean;
          tenant_category_id?: string | null;
          enabled_by?: string | null;
          enabled_at?: string;
          tenant_avg_rating?: number;
          tenant_review_count?: number;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };

      reviews: {
        Row: {
          id: string;
          provider_offering_id: string;
          tenant_id: string;
          user_id: string;
          order_id: string | null;
          rating: number;
          title: string;
          body: string;
          status: Database['public']['Enums']['review_status'];
          moderated_by: string | null;
          moderated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_offering_id: string;
          tenant_id: string;
          user_id: string;
          order_id?: string | null;
          rating: number;
          title?: string;
          body?: string;
          status?: Database['public']['Enums']['review_status'];
          moderated_by?: string | null;
          moderated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_offering_id?: string;
          tenant_id?: string;
          user_id?: string;
          order_id?: string | null;
          rating?: number;
          title?: string;
          body?: string;
          status?: Database['public']['Enums']['review_status'];
          moderated_by?: string | null;
          moderated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      provider_users: {
        Row: {
          id: string;
          provider_id: string;
          user_id: string;
          role: Database['public']['Enums']['provider_user_role'];
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          user_id: string;
          role?: Database['public']['Enums']['provider_user_role'];
          created_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          user_id?: string;
          role?: Database['public']['Enums']['provider_user_role'];
          created_at?: string;
        };
      };
    };

    Enums: {
      user_role: 'employee' | 'hr' | 'admin' | 'provider';
      order_status: 'pending' | 'reserved' | 'paid' | 'cancelled' | 'expired';
      ledger_type: 'accrual' | 'reserve' | 'spend' | 'release' | 'expire';
      budget_period: 'monthly' | 'quarterly' | 'yearly';
      provider_status: 'pending' | 'verified' | 'suspended' | 'rejected';
      offering_status: 'draft' | 'pending_review' | 'published' | 'archived';
      review_status: 'visible' | 'hidden' | 'flagged';
      provider_user_role: 'owner' | 'admin' | 'member';
    };
  };
};
