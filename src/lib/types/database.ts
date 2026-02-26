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
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          icon?: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          icon?: string;
          sort_order?: number;
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
          benefit_id: string;
          tenant_id: string;
          conditions: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          benefit_id: string;
          tenant_id: string;
          conditions?: Record<string, unknown>;
        };
        Update: {
          id?: string;
          benefit_id?: string;
          tenant_id?: string;
          conditions?: Record<string, unknown>;
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
          benefit_id: string;
          quantity: number;
          price_points: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          benefit_id: string;
          quantity?: number;
          price_points: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          benefit_id?: string;
          quantity?: number;
          price_points?: number;
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
    };

    Enums: {
      user_role: 'employee' | 'hr' | 'admin';
      order_status: 'pending' | 'reserved' | 'paid' | 'cancelled' | 'expired';
      ledger_type: 'accrual' | 'reserve' | 'spend' | 'release' | 'expire';
      budget_period: 'monthly' | 'quarterly' | 'yearly';
    };
  };
};
