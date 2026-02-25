export type { Database } from './database';

import type { Database } from './database';

// ---------------------------------------------------------------------------
// Helper generic types for extracting Row / Insert / Update from any table
// ---------------------------------------------------------------------------

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

// ---------------------------------------------------------------------------
// Convenience aliases — Row types for every table
// ---------------------------------------------------------------------------

export type Tenant           = Tables<'tenants'>;
export type User             = Tables<'users'>;
export type EmployeeProfile  = Tables<'employee_profiles'>;
export type BenefitCategory  = Tables<'benefit_categories'>;
export type Benefit          = Tables<'benefits'>;
export type EligibilityRule  = Tables<'eligibility_rules'>;
export type BudgetPolicy     = Tables<'budget_policies'>;
export type Wallet           = Tables<'wallets'>;
export type PointLedger      = Tables<'point_ledger'>;
export type Order            = Tables<'orders'>;
export type OrderItem        = Tables<'order_items'>;
export type AuditLog         = Tables<'audit_log'>;

// ---------------------------------------------------------------------------
// Convenience aliases — Insert types for every table
// ---------------------------------------------------------------------------

export type TenantInsert          = Inserts<'tenants'>;
export type UserInsert            = Inserts<'users'>;
export type EmployeeProfileInsert = Inserts<'employee_profiles'>;
export type BenefitCategoryInsert = Inserts<'benefit_categories'>;
export type BenefitInsert         = Inserts<'benefits'>;
export type EligibilityRuleInsert = Inserts<'eligibility_rules'>;
export type BudgetPolicyInsert    = Inserts<'budget_policies'>;
export type WalletInsert          = Inserts<'wallets'>;
export type PointLedgerInsert     = Inserts<'point_ledger'>;
export type OrderInsert           = Inserts<'orders'>;
export type OrderItemInsert       = Inserts<'order_items'>;
export type AuditLogInsert        = Inserts<'audit_log'>;

// ---------------------------------------------------------------------------
// Convenience aliases — Update types for every table
// ---------------------------------------------------------------------------

export type TenantUpdate          = Updates<'tenants'>;
export type UserUpdate            = Updates<'users'>;
export type EmployeeProfileUpdate = Updates<'employee_profiles'>;
export type BenefitCategoryUpdate = Updates<'benefit_categories'>;
export type BenefitUpdate         = Updates<'benefits'>;
export type EligibilityRuleUpdate = Updates<'eligibility_rules'>;
export type BudgetPolicyUpdate    = Updates<'budget_policies'>;
export type WalletUpdate          = Updates<'wallets'>;
export type PointLedgerUpdate     = Updates<'point_ledger'>;
export type OrderUpdate           = Updates<'orders'>;
export type OrderItemUpdate       = Updates<'order_items'>;
export type AuditLogUpdate        = Updates<'audit_log'>;

// ---------------------------------------------------------------------------
// Enum value aliases
// ---------------------------------------------------------------------------

export type UserRole     = Enums<'user_role'>;
export type OrderStatus  = Enums<'order_status'>;
export type LedgerType   = Enums<'ledger_type'>;
export type BudgetPeriod = Enums<'budget_period'>;
