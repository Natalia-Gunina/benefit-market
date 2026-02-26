import { z } from "zod";

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        benefit_id: z.string().uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1, "Корзина не может быть пустой"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ---------------------------------------------------------------------------
// Admin: Benefits
// ---------------------------------------------------------------------------

export const createBenefitSchema = z.object({
  name: z.string().min(1, "Benefit name is required").max(255),
  description: z.string().optional().default(""),
  category_id: z.string().uuid("Invalid category_id"),
  price_points: z.number().int().min(0, "price_points must be >= 0"),
  stock_limit: z.number().int().min(0).nullable().optional().default(null),
  is_active: z.boolean().optional().default(true),
  tenant_id: z.string().uuid("Invalid tenant_id"),
});

export type CreateBenefitInput = z.infer<typeof createBenefitSchema>;

// ---------------------------------------------------------------------------
// Admin: Categories
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(255),
  icon: z.string().max(100).optional().default(""),
  sort_order: z.number().int().min(0).optional().default(0),
});

export const updateCategorySchema = z.object({
  id: z.string().uuid("Invalid category ID"),
  name: z.string().min(1).max(255).optional(),
  icon: z.string().max(100).optional(),
  sort_order: z.number().int().min(0).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ---------------------------------------------------------------------------
// Admin: Policies
// ---------------------------------------------------------------------------

export const createPolicySchema = z.object({
  name: z.string().min(1, "Policy name is required").max(255),
  points_amount: z.number().int().min(0, "points_amount must be >= 0"),
  period: z.enum(["monthly", "quarterly", "yearly"]).optional().default("quarterly"),
  target_filter: z.record(z.string(), z.unknown()).optional().default({}),
  is_active: z.boolean().optional().default(true),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

// ---------------------------------------------------------------------------
// Admin: Rules
// ---------------------------------------------------------------------------

export const createRuleSchema = z.object({
  benefit_id: z.string().uuid("Invalid benefit_id"),
  conditions: z.record(z.string(), z.unknown()).optional().default({}),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;

// ---------------------------------------------------------------------------
// Admin: Tenants
// ---------------------------------------------------------------------------

export const createTenantSchema = z.object({
  name: z.string().min(1, "Tenant name is required").max(255),
  domain: z.string().max(255).optional().default(""),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  domain: z.string().max(255).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

// ---------------------------------------------------------------------------
// Import: Employees (CSV row)
// ---------------------------------------------------------------------------

export const importRowSchema = z.object({
  email: z.string().email("Некорректный email"),
  name: z.string().min(1, "Имя обязательно"),
  grade: z.string().optional().default(""),
  tenure_months: z.coerce.number().int().min(0, "Стаж должен быть >= 0"),
  location: z.string().optional().default(""),
  legal_entity: z.string().optional().default(""),
});

export type ImportRowInput = z.infer<typeof importRowSchema>;
