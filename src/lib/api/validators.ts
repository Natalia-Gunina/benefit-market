import { z } from "zod";

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        tenant_offering_id: z.string().uuid(),
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
  points_amount: z.number().int().min(0, "points_amount must be >= 0"),
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

// ---------------------------------------------------------------------------
// Provider Registration
// ---------------------------------------------------------------------------

export const registerProviderSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug: только строчные буквы, цифры и дефис"),
  description: z.string().optional().default(""),
  logo_url: z.string().url("Некорректный URL логотипа").optional().or(z.literal("")),
  website: z.string().url("Некорректный URL сайта").optional().or(z.literal("")),
  contact_email: z.string().email("Некорректный email").optional().or(z.literal("")),
  contact_phone: z.string().max(30).optional().default(""),
  address: z.string().max(500).optional().default(""),
});

export const updateProviderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal("")).or(z.null()),
  website: z.string().url().optional().or(z.literal("")).or(z.null()),
  contact_email: z.string().email().optional().or(z.literal("")).or(z.null()),
  contact_phone: z.string().max(30).optional().or(z.null()),
  address: z.string().max(500).optional().or(z.null()),
});

export type RegisterProviderInput = z.infer<typeof registerProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;

// ---------------------------------------------------------------------------
// Provider Offerings
// ---------------------------------------------------------------------------

export const createProviderOfferingSchema = z.object({
  global_category_id: z.string().uuid("Некорректный ID категории").optional().or(z.null()),
  name: z.string().min(1, "Название обязательно").max(255),
  description: z.string().optional().default(""),
  long_description: z.string().optional().default(""),
  image_urls: z.array(z.string().url()).optional().default([]),
  base_price_points: z.number().int().min(1, "Цена должна быть > 0"),
  stock_limit: z.number().int().min(0).nullable().optional().default(null),
  is_stackable: z.boolean().optional().default(false),
  format: z.enum(["online", "offline"]).optional().default("online"),
  cities: z.array(z.string().min(1).max(120)).optional().default([]),
  delivery_info: z.string().optional().default(""),
  terms_conditions: z.string().optional().default(""),
}).refine(
  (d) => d.format !== "offline" || d.cities.length > 0,
  { message: "Для офлайн-льготы требуется указать хотя бы один город", path: ["cities"] },
);

export const updateProviderOfferingSchema = z.object({
  global_category_id: z.string().uuid().optional().or(z.null()),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  long_description: z.string().optional(),
  image_urls: z.array(z.string().url()).optional(),
  base_price_points: z.number().int().min(1).optional(),
  stock_limit: z.number().int().min(0).nullable().optional(),
  is_stackable: z.boolean().optional(),
  format: z.enum(["online", "offline"]).optional(),
  cities: z.array(z.string().min(1).max(120)).optional(),
  delivery_info: z.string().optional(),
  terms_conditions: z.string().optional(),
});

export type CreateProviderOfferingInput = z.infer<typeof createProviderOfferingSchema>;
export type UpdateProviderOfferingInput = z.infer<typeof updateProviderOfferingSchema>;

// ---------------------------------------------------------------------------
// Tenant Offerings (HR curation)
// ---------------------------------------------------------------------------

export const enableTenantOfferingSchema = z.object({
  provider_offering_id: z.string().uuid("Некорректный ID предложения"),
  custom_price_points: z.number().int().min(1).nullable().optional().default(null),
  tenant_stock_limit: z.number().int().min(0).nullable().optional().default(null),
  tenant_category_id: z.string().uuid().nullable().optional().default(null),
});

export const updateTenantOfferingSchema = z.object({
  custom_price_points: z.number().int().min(1).nullable().optional(),
  tenant_stock_limit: z.number().int().min(0).nullable().optional(),
  is_active: z.boolean().optional(),
  tenant_category_id: z.string().uuid().nullable().optional(),
});

export type EnableTenantOfferingInput = z.infer<typeof enableTenantOfferingSchema>;
export type UpdateTenantOfferingInput = z.infer<typeof updateTenantOfferingSchema>;

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export const createReviewSchema = z.object({
  provider_offering_id: z.string().uuid("Некорректный ID предложения"),
  rating: z.number().int().min(1, "Минимальная оценка — 1").max(5, "Максимальная оценка — 5"),
  title: z.string().max(200).optional().default(""),
  body: z.string().max(5000).optional().default(""),
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(200).optional(),
  body: z.string().max(5000).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

// ---------------------------------------------------------------------------
// Global Categories (admin)
// ---------------------------------------------------------------------------

export const createGlobalCategorySchema = z.object({
  name: z.string().min(1, "Название обязательно").max(255),
  icon: z.string().max(100).optional().default(""),
  sort_order: z.number().int().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
});

export const updateGlobalCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  icon: z.string().max(100).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type CreateGlobalCategoryInput = z.infer<typeof createGlobalCategorySchema>;
export type UpdateGlobalCategoryInput = z.infer<typeof updateGlobalCategorySchema>;

// ---------------------------------------------------------------------------
// Admin: Catalog — Provider item creation
// ---------------------------------------------------------------------------

export const createCatalogProviderItemSchema = z.object({
  provider_id: z.string().uuid().optional(),
  new_provider: z.object({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug: только строчные буквы, цифры и дефис"),
    contact_email: z.string().email().optional().default(""),
  }).optional(),
  name: z.string().min(1, "Название обязательно").max(255),
  description: z.string().optional().default(""),
  global_category_id: z.string().uuid().optional().or(z.null()),
  base_price_points: z.number().int().min(1, "Цена должна быть > 0"),
  stock_limit: z.number().int().min(0).nullable().optional().default(null),
});

export type CreateCatalogProviderItemInput = z.infer<typeof createCatalogProviderItemSchema>;

// ---------------------------------------------------------------------------
// Provider: Team management
// ---------------------------------------------------------------------------

export const addTeamMemberSchema = z.object({
  email: z.string().email("Некорректный email"),
  role: z.enum(["admin", "member"]),
});

export const updateTeamMemberSchema = z.object({
  role: z.enum(["owner", "admin", "member"]),
});

export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
