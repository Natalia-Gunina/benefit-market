-- =============================================================
-- Benefit Market — Initial Schema Migration
-- =============================================================
-- Creates all 12 tables, enums, constraints, indexes, and
-- enables RLS on every table. RLS policies are NOT included
-- here — they will be created in a separate migration.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Custom ENUM types
-- -------------------------------------------------------------

CREATE TYPE user_role     AS ENUM ('employee', 'hr', 'admin');
CREATE TYPE order_status  AS ENUM ('pending', 'reserved', 'paid', 'cancelled', 'expired');
CREATE TYPE ledger_type   AS ENUM ('accrual', 'reserve', 'spend', 'release', 'expire');
CREATE TYPE budget_period AS ENUM ('monthly', 'quarterly', 'yearly');

-- -------------------------------------------------------------
-- 2. Tables (ordered by foreign-key dependencies)
-- -------------------------------------------------------------

-- 1. tenants
CREATE TABLE tenants (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    domain      text        NOT NULL,
    settings    jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. users
CREATE TABLE users (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    auth_id     uuid        NOT NULL UNIQUE,
    email       text        NOT NULL,
    role        user_role   NOT NULL DEFAULT 'employee',
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. employee_profiles
CREATE TABLE employee_profiles (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       uuid    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    grade           text    NOT NULL DEFAULT '',
    tenure_months   int     NOT NULL DEFAULT 0,
    location        text    NOT NULL DEFAULT '',
    legal_entity    text    NOT NULL DEFAULT '',
    extra           jsonb   NOT NULL DEFAULT '{}'::jsonb
);

-- 4. benefit_categories
CREATE TABLE benefit_categories (
    id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        text    NOT NULL,
    icon        text    NOT NULL DEFAULT '',
    sort_order  int     NOT NULL DEFAULT 0
);

-- 5. benefits
CREATE TABLE benefits (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id     uuid        NOT NULL REFERENCES benefit_categories(id) ON DELETE CASCADE,
    name            text        NOT NULL,
    description     text        NOT NULL DEFAULT '',
    price_points    int         NOT NULL CHECK (price_points > 0),
    stock_limit     int                  CHECK (stock_limit IS NULL OR stock_limit >= 0),
    is_active       boolean     NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- 6. eligibility_rules
CREATE TABLE eligibility_rules (
    id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    benefit_id  uuid    NOT NULL REFERENCES benefits(id) ON DELETE CASCADE,
    tenant_id   uuid    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conditions  jsonb   NOT NULL DEFAULT '{}'::jsonb
);

-- 7. budget_policies
CREATE TABLE budget_policies (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            text          NOT NULL,
    points_amount   int           NOT NULL CHECK (points_amount > 0),
    period          budget_period NOT NULL DEFAULT 'monthly',
    target_filter   jsonb         NOT NULL DEFAULT '{}'::jsonb,
    is_active       boolean       NOT NULL DEFAULT true
);

-- 8. wallets
CREATE TABLE wallets (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    balance     int         NOT NULL DEFAULT 0 CHECK (balance >= 0),
    reserved    int         NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    period      text        NOT NULL,
    expires_at  timestamptz NOT NULL,

    UNIQUE (user_id, period)
);

-- 9. orders (before point_ledger, which references it)
CREATE TABLE orders (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status          order_status NOT NULL DEFAULT 'pending',
    total_points    int          NOT NULL CHECK (total_points >= 0),
    reserved_at     timestamptz  NOT NULL DEFAULT now(),
    expires_at      timestamptz  NOT NULL DEFAULT (now() + interval '15 minutes'),
    created_at      timestamptz  NOT NULL DEFAULT now()
);

-- 10. order_items
CREATE TABLE order_items (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    benefit_id      uuid    NOT NULL REFERENCES benefits(id) ON DELETE CASCADE,
    quantity        int     NOT NULL DEFAULT 1 CHECK (quantity > 0),
    price_points    int     NOT NULL CHECK (price_points >= 0)
);

-- 11. point_ledger
CREATE TABLE point_ledger (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id   uuid        NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id    uuid                 REFERENCES orders(id) ON DELETE SET NULL,
    type        ledger_type NOT NULL,
    amount      int         NOT NULL,
    description text        NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- 12. audit_log
CREATE TABLE audit_log (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action      text        NOT NULL,
    entity_type text        NOT NULL,
    entity_id   uuid        NOT NULL,
    diff        jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 3. Indexes
-- -------------------------------------------------------------

-- tenant_id indexes on every table that has tenant_id
CREATE INDEX idx_users_tenant_id               ON users(tenant_id);
CREATE INDEX idx_employee_profiles_tenant_id   ON employee_profiles(tenant_id);
CREATE INDEX idx_benefit_categories_tenant_id  ON benefit_categories(tenant_id);
CREATE INDEX idx_benefits_tenant_id            ON benefits(tenant_id);
CREATE INDEX idx_eligibility_rules_tenant_id   ON eligibility_rules(tenant_id);
CREATE INDEX idx_budget_policies_tenant_id     ON budget_policies(tenant_id);
CREATE INDEX idx_wallets_tenant_id             ON wallets(tenant_id);
CREATE INDEX idx_point_ledger_tenant_id        ON point_ledger(tenant_id);
CREATE INDEX idx_orders_tenant_id              ON orders(tenant_id);
CREATE INDEX idx_audit_log_tenant_id           ON audit_log(tenant_id);

-- Specific indexes
CREATE INDEX idx_orders_status_expires_at      ON orders(status, expires_at)
    WHERE status = 'reserved';  -- partial index for TTL cron

CREATE INDEX idx_benefits_tenant_active        ON benefits(tenant_id, is_active)
    WHERE is_active = true;     -- partial index for active catalog

CREATE INDEX idx_wallets_user_period           ON wallets(user_id, period);
CREATE INDEX idx_point_ledger_wallet_id        ON point_ledger(wallet_id);
CREATE INDEX idx_point_ledger_order_id         ON point_ledger(order_id)
    WHERE order_id IS NOT NULL;

CREATE INDEX idx_orders_user_id                ON orders(user_id);
CREATE INDEX idx_order_items_order_id          ON order_items(order_id);
CREATE INDEX idx_order_items_benefit_id        ON order_items(benefit_id);
CREATE INDEX idx_employee_profiles_user_id     ON employee_profiles(user_id);
CREATE INDEX idx_eligibility_rules_benefit_id  ON eligibility_rules(benefit_id);
CREATE INDEX idx_audit_log_entity              ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user_id             ON audit_log(user_id);

-- -------------------------------------------------------------
-- 4. Enable Row-Level Security (policies will be added later)
-- -------------------------------------------------------------

ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_policies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_ledger         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;
-- =============================================================
-- Benefit Market — RLS Policies Migration
-- =============================================================
-- Row-Level Security policies for all 12 tables.
-- Depends on: 00001_initial_schema.sql (tables + RLS enabled)
--
-- JWT custom claims:
--   auth.jwt() -> 'user_metadata' ->> 'tenant_id'  — tenant UUID
--   auth.jwt() -> 'user_metadata' ->> 'role'        — employee | hr | admin
--   auth.uid()                                       — maps to users.auth_id
-- =============================================================

-- -------------------------------------------------------------
-- 1. Helper functions
-- -------------------------------------------------------------

-- Returns the tenant_id from the current JWT
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS uuid AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the role from the current JWT
CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text AS $$
  SELECT auth.jwt() -> 'user_metadata' ->> 'role';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the application user ID (users.id) for the current auth user
CREATE OR REPLACE FUNCTION public.current_app_user_id() RETURNS uuid AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- =============================================================
-- 2. TENANTS
-- =============================================================

-- Admin can see all tenants; everyone else sees only their own tenant
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT USING (
    current_user_role() = 'admin'
    OR id = current_tenant_id()
  );

-- Only admin can create tenants
CREATE POLICY "tenants_insert" ON tenants
  FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
  );

-- Only admin can update tenants
CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE USING (
    current_user_role() = 'admin'
  ) WITH CHECK (
    current_user_role() = 'admin'
  );


-- =============================================================
-- 3. USERS
-- =============================================================

-- Admin/HR see all users in their tenant; employee sees only self
CREATE POLICY "users_select" ON users
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND (
      current_user_role() IN ('admin', 'hr')
      OR id = current_app_user_id()
    )
  );

-- Only admin can create users
CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );

-- Only admin can update users
CREATE POLICY "users_update" ON users
  FOR UPDATE USING (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  ) WITH CHECK (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );


-- =============================================================
-- 4. EMPLOYEE_PROFILES
-- =============================================================

-- Admin/HR see all profiles in tenant; employee sees only own profile
CREATE POLICY "employee_profiles_select" ON employee_profiles
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND (
      current_user_role() IN ('admin', 'hr')
      OR user_id = current_app_user_id()
    )
  );

-- HR and admin can create profiles
CREATE POLICY "employee_profiles_insert" ON employee_profiles
  FOR INSERT WITH CHECK (
    current_user_role() IN ('admin', 'hr')
    AND tenant_id = current_tenant_id()
  );

-- HR and admin can update profiles
CREATE POLICY "employee_profiles_update" ON employee_profiles
  FOR UPDATE USING (
    current_user_role() IN ('admin', 'hr')
    AND tenant_id = current_tenant_id()
  ) WITH CHECK (
    current_user_role() IN ('admin', 'hr')
    AND tenant_id = current_tenant_id()
  );


-- =============================================================
-- 5. BENEFIT_CATEGORIES
-- =============================================================

-- All authenticated users can see their tenant's categories
CREATE POLICY "benefit_categories_select" ON benefit_categories
  FOR SELECT USING (
    tenant_id = current_tenant_id()
  );

-- Only admin can manage categories
CREATE POLICY "benefit_categories_insert" ON benefit_categories
  FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );

CREATE POLICY "benefit_categories_update" ON benefit_categories
  FOR UPDATE USING (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  ) WITH CHECK (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );

CREATE POLICY "benefit_categories_delete" ON benefit_categories
  FOR DELETE USING (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );


-- =============================================================
-- 6. BENEFITS
-- =============================================================

-- Admin sees all benefits in tenant (including inactive).
-- HR and employee see only active benefits in their tenant.
CREATE POLICY "benefits_select" ON benefits
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND (
      current_user_role() = 'admin'
      OR is_active = true
    )
  );

-- Only admin can manage benefits
CREATE POLICY "benefits_insert" ON benefits
  FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );

CREATE POLICY "benefits_update" ON benefits
  FOR UPDATE USING (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  ) WITH CHECK (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );

CREATE POLICY "benefits_delete" ON benefits
  FOR DELETE USING (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );


-- =============================================================
-- 7. ELIGIBILITY_RULES
-- =============================================================

-- Only admin can view eligibility rules
CREATE POLICY "eligibility_rules_select" ON eligibility_rules
  FOR SELECT USING (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );

-- Only admin can manage eligibility rules
CREATE POLICY "eligibility_rules_insert" ON eligibility_rules
  FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );

CREATE POLICY "eligibility_rules_update" ON eligibility_rules
  FOR UPDATE USING (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  ) WITH CHECK (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );

CREATE POLICY "eligibility_rules_delete" ON eligibility_rules
  FOR DELETE USING (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );


-- =============================================================
-- 8. BUDGET_POLICIES
-- =============================================================

-- HR and admin can view budget policies in their tenant
CREATE POLICY "budget_policies_select" ON budget_policies
  FOR SELECT USING (
    current_user_role() IN ('admin', 'hr')
    AND tenant_id = current_tenant_id()
  );

-- Only admin can manage budget policies
CREATE POLICY "budget_policies_insert" ON budget_policies
  FOR INSERT WITH CHECK (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );

CREATE POLICY "budget_policies_update" ON budget_policies
  FOR UPDATE USING (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  ) WITH CHECK (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );

CREATE POLICY "budget_policies_delete" ON budget_policies
  FOR DELETE USING (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );


-- =============================================================
-- 9. WALLETS
-- =============================================================
-- Wallet balance mutations MUST happen via service_role (Edge Functions /
-- API routes with SUPABASE_SERVICE_ROLE_KEY). RLS denies all inserts
-- and updates to regular users. Read access is role-based.

-- Employee sees own wallets; HR/admin see all wallets in tenant
CREATE POLICY "wallets_select" ON wallets
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND (
      current_user_role() IN ('admin', 'hr')
      OR user_id = current_app_user_id()
    )
  );

-- No insert via RLS — service_role bypasses RLS
CREATE POLICY "wallets_insert" ON wallets
  FOR INSERT WITH CHECK (false);

-- No update via RLS — service_role bypasses RLS
CREATE POLICY "wallets_update" ON wallets
  FOR UPDATE USING (false) WITH CHECK (false);


-- =============================================================
-- 10. POINT_LEDGER
-- =============================================================
-- Ledger is append-only via service_role. Read access is role-based.

-- Employee sees ledger entries for their own wallets.
-- HR/admin see all ledger entries in tenant.
CREATE POLICY "point_ledger_select" ON point_ledger
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND (
      current_user_role() IN ('admin', 'hr')
      OR wallet_id IN (
        SELECT w.id FROM wallets w WHERE w.user_id = current_app_user_id()
      )
    )
  );

-- No insert via RLS — service_role bypasses RLS
CREATE POLICY "point_ledger_insert" ON point_ledger
  FOR INSERT WITH CHECK (false);


-- =============================================================
-- 11. ORDERS
-- =============================================================

-- Employee sees own orders; HR/admin see all orders in tenant
CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND (
      current_user_role() IN ('admin', 'hr')
      OR user_id = current_app_user_id()
    )
  );

-- Employee can create orders for themselves only
CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (
    current_user_role() IN ('employee', 'hr', 'admin')
    AND tenant_id = current_tenant_id()
    AND user_id = current_app_user_id()
  );

-- Employee can update own orders (e.g. cancel a reserved order).
-- Status transitions like paid/expired are done via service_role.
CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (
    tenant_id = current_tenant_id()
    AND user_id = current_app_user_id()
  ) WITH CHECK (
    tenant_id = current_tenant_id()
    AND user_id = current_app_user_id()
  );


-- =============================================================
-- 12. ORDER_ITEMS
-- =============================================================

-- Visible if the user can see the parent order (same tenant + ownership or admin/hr)
CREATE POLICY "order_items_select" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.tenant_id = current_tenant_id()
        AND (
          current_user_role() IN ('admin', 'hr')
          OR o.user_id = current_app_user_id()
        )
    )
  );

-- Employee can insert items for their own orders
CREATE POLICY "order_items_insert" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.tenant_id = current_tenant_id()
        AND o.user_id = current_app_user_id()
    )
  );


-- =============================================================
-- 13. AUDIT_LOG
-- =============================================================

-- Only admin can view audit log entries in their tenant
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (
    current_user_role() = 'admin'
    AND tenant_id = current_tenant_id()
  );

-- No insert via RLS — audit entries are written by service_role only
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (false);
-- Additional indexes for frequent query patterns

-- benefits(category_id) — catalog filtering by category
CREATE INDEX IF NOT EXISTS idx_benefits_category_id ON benefits(category_id);

-- benefits(tenant_id, created_at DESC) — sorted catalog listing
CREATE INDEX IF NOT EXISTS idx_benefits_tenant_created ON benefits(tenant_id, created_at DESC);

-- orders(user_id, created_at DESC) — user's order history
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);

-- orders(tenant_id, status) — admin order filtering by status
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);

-- point_ledger(tenant_id, type) — dashboard aggregation
CREATE INDEX IF NOT EXISTS idx_point_ledger_tenant_type ON point_ledger(tenant_id, type);

-- point_ledger(tenant_id, created_at) — trend queries
CREATE INDEX IF NOT EXISTS idx_point_ledger_tenant_created ON point_ledger(tenant_id, created_at);

-- audit_log(tenant_id, created_at DESC) — audit log browsing
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created ON audit_log(tenant_id, created_at DESC);

-- employee_profiles(tenant_id, user_id) — composite for profile lookup
CREATE INDEX IF NOT EXISTS idx_employee_profiles_tenant_user ON employee_profiles(tenant_id, user_id);
-- =============================================================
-- Benefit Market — Provider Marketplace Migration
-- =============================================================
-- Adds marketplace infrastructure: providers, offerings,
-- tenant curation, reviews, and global categories.
-- =============================================================

-- -------------------------------------------------------------
-- 1. New ENUM types
-- -------------------------------------------------------------

CREATE TYPE provider_status  AS ENUM ('pending', 'verified', 'suspended', 'rejected');
CREATE TYPE offering_status  AS ENUM ('draft', 'pending_review', 'published', 'archived');
CREATE TYPE review_status    AS ENUM ('visible', 'hidden', 'flagged');
CREATE TYPE provider_user_role AS ENUM ('owner', 'admin', 'member');

-- Add 'provider' to existing user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'provider';

-- -------------------------------------------------------------
-- 2. Platform tenant (for provider users)
-- -------------------------------------------------------------

INSERT INTO tenants (id, name, domain, settings)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Platform',
  'platform.internal',
  '{"is_platform": true}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------
-- 3. New tables
-- -------------------------------------------------------------

-- 3a. global_categories — global taxonomy (not tenant-scoped)
CREATE TABLE global_categories (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL UNIQUE,
    icon        text        NOT NULL DEFAULT '',
    sort_order  int         NOT NULL DEFAULT 0,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3b. providers — global provider entities (NOT tenant-scoped)
CREATE TABLE providers (
    id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id    uuid            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             text            NOT NULL,
    slug             text            NOT NULL UNIQUE,
    description      text            NOT NULL DEFAULT '',
    logo_url         text,
    website          text,
    contact_email    text,
    contact_phone    text,
    address          text,
    status           provider_status NOT NULL DEFAULT 'pending',
    verified_at      timestamptz,
    verified_by      uuid            REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason text,
    metadata         jsonb           NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamptz     NOT NULL DEFAULT now(),
    updated_at       timestamptz     NOT NULL DEFAULT now()
);

-- 3c. provider_offerings — provider's offerings (global)
CREATE TABLE provider_offerings (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id         uuid            NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    global_category_id  uuid            REFERENCES global_categories(id) ON DELETE SET NULL,
    name                text            NOT NULL,
    description         text            NOT NULL DEFAULT '',
    long_description    text            NOT NULL DEFAULT '',
    image_urls          text[]          NOT NULL DEFAULT '{}',
    base_price_points   int             NOT NULL CHECK (base_price_points > 0),
    stock_limit         int                      CHECK (stock_limit IS NULL OR stock_limit >= 0),
    status              offering_status NOT NULL DEFAULT 'draft',
    delivery_info       text            NOT NULL DEFAULT '',
    terms_conditions    text            NOT NULL DEFAULT '',
    metadata            jsonb           NOT NULL DEFAULT '{}'::jsonb,
    avg_rating          numeric(3,2)    NOT NULL DEFAULT 0,
    review_count        int             NOT NULL DEFAULT 0,
    created_at          timestamptz     NOT NULL DEFAULT now(),
    updated_at          timestamptz     NOT NULL DEFAULT now()
);

-- 3d. tenant_offerings — what a company has enabled from the marketplace
CREATE TABLE tenant_offerings (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_offering_id    uuid        NOT NULL REFERENCES provider_offerings(id) ON DELETE CASCADE,
    custom_price_points     int                  CHECK (custom_price_points IS NULL OR custom_price_points > 0),
    tenant_stock_limit      int                  CHECK (tenant_stock_limit IS NULL OR tenant_stock_limit >= 0),
    is_active               boolean     NOT NULL DEFAULT true,
    tenant_category_id      uuid        REFERENCES benefit_categories(id) ON DELETE SET NULL,
    enabled_by              uuid        REFERENCES users(id) ON DELETE SET NULL,
    enabled_at              timestamptz NOT NULL DEFAULT now(),
    tenant_avg_rating       numeric(3,2) NOT NULL DEFAULT 0,
    tenant_review_count     int         NOT NULL DEFAULT 0,
    metadata                jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    UNIQUE (tenant_id, provider_offering_id)
);

-- 3e. reviews — dual-scoped reviews (global + tenant)
CREATE TABLE reviews (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_offering_id    uuid          NOT NULL REFERENCES provider_offerings(id) ON DELETE CASCADE,
    tenant_id               uuid          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id                 uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id                uuid          REFERENCES orders(id) ON DELETE SET NULL,
    rating                  int           NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title                   text          NOT NULL DEFAULT '',
    body                    text          NOT NULL DEFAULT '',
    status                  review_status NOT NULL DEFAULT 'visible',
    moderated_by            uuid          REFERENCES users(id) ON DELETE SET NULL,
    moderated_at            timestamptz,
    created_at              timestamptz   NOT NULL DEFAULT now(),
    updated_at              timestamptz   NOT NULL DEFAULT now(),

    UNIQUE (user_id, provider_offering_id)
);

-- 3f. provider_users — provider team members
CREATE TABLE provider_users (
    id          uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id uuid              NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    user_id     uuid              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        provider_user_role NOT NULL DEFAULT 'member',
    created_at  timestamptz       NOT NULL DEFAULT now(),

    UNIQUE (provider_id, user_id)
);

-- -------------------------------------------------------------
-- 4. Alterations to existing tables
-- -------------------------------------------------------------

-- 4a. order_items: add marketplace references
ALTER TABLE order_items
    ADD COLUMN provider_offering_id uuid REFERENCES provider_offerings(id) ON DELETE SET NULL,
    ADD COLUMN tenant_offering_id   uuid REFERENCES tenant_offerings(id) ON DELETE SET NULL;

-- Make benefit_id nullable (marketplace items don't have legacy benefit_id)
ALTER TABLE order_items ALTER COLUMN benefit_id DROP NOT NULL;

-- Check constraint: exactly one of benefit_id or tenant_offering_id must be set
ALTER TABLE order_items ADD CONSTRAINT chk_order_item_target
  CHECK (
    (benefit_id IS NOT NULL AND tenant_offering_id IS NULL)
    OR (benefit_id IS NULL AND tenant_offering_id IS NOT NULL)
  );

-- 4b. eligibility_rules: add tenant_offering_id, make benefit_id nullable
ALTER TABLE eligibility_rules
    ADD COLUMN tenant_offering_id uuid REFERENCES tenant_offerings(id) ON DELETE CASCADE;

ALTER TABLE eligibility_rules ALTER COLUMN benefit_id DROP NOT NULL;

-- Check constraint: exactly one of benefit_id or tenant_offering_id must be set
ALTER TABLE eligibility_rules
    ADD CONSTRAINT chk_eligibility_target
    CHECK (
        (benefit_id IS NOT NULL AND tenant_offering_id IS NULL)
        OR (benefit_id IS NULL AND tenant_offering_id IS NOT NULL)
    );

-- 4c. benefit_categories: add global_category_id mapping
ALTER TABLE benefit_categories
    ADD COLUMN global_category_id uuid REFERENCES global_categories(id) ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5. Indexes
-- -------------------------------------------------------------

-- providers
CREATE INDEX idx_providers_owner_user_id   ON providers(owner_user_id);
CREATE INDEX idx_providers_status          ON providers(status);
CREATE INDEX idx_providers_slug            ON providers(slug);
CREATE INDEX idx_providers_verified        ON providers(status) WHERE status = 'verified';

-- global_categories
CREATE INDEX idx_global_categories_sort    ON global_categories(sort_order);

-- provider_offerings
CREATE INDEX idx_provider_offerings_provider_id    ON provider_offerings(provider_id);
CREATE INDEX idx_provider_offerings_category_id    ON provider_offerings(global_category_id);
CREATE INDEX idx_provider_offerings_status         ON provider_offerings(status);
CREATE INDEX idx_provider_offerings_published      ON provider_offerings(status) WHERE status = 'published';
CREATE INDEX idx_provider_offerings_rating         ON provider_offerings(avg_rating DESC) WHERE status = 'published';

-- tenant_offerings
CREATE INDEX idx_tenant_offerings_tenant_id        ON tenant_offerings(tenant_id);
CREATE INDEX idx_tenant_offerings_offering_id      ON tenant_offerings(provider_offering_id);
CREATE INDEX idx_tenant_offerings_active           ON tenant_offerings(tenant_id, is_active) WHERE is_active = true;

-- reviews
CREATE INDEX idx_reviews_offering_id    ON reviews(provider_offering_id);
CREATE INDEX idx_reviews_tenant_id      ON reviews(tenant_id);
CREATE INDEX idx_reviews_user_id        ON reviews(user_id);
CREATE INDEX idx_reviews_status         ON reviews(status);

-- provider_users
CREATE INDEX idx_provider_users_provider_id ON provider_users(provider_id);
CREATE INDEX idx_provider_users_user_id     ON provider_users(user_id);

-- order_items new columns
CREATE INDEX idx_order_items_provider_offering_id ON order_items(provider_offering_id) WHERE provider_offering_id IS NOT NULL;
CREATE INDEX idx_order_items_tenant_offering_id   ON order_items(tenant_offering_id) WHERE tenant_offering_id IS NOT NULL;

-- eligibility_rules new column
CREATE INDEX idx_eligibility_rules_tenant_offering_id ON eligibility_rules(tenant_offering_id) WHERE tenant_offering_id IS NOT NULL;

-- -------------------------------------------------------------
-- 6. Enable RLS on new tables
-- -------------------------------------------------------------

ALTER TABLE global_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_offerings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_offerings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews             ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_users      ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- 7. RLS Policies
-- -------------------------------------------------------------

-- 7a. global_categories: SELECT for all, CUD for admin only
CREATE POLICY "global_categories_select" ON global_categories
    FOR SELECT USING (true);

CREATE POLICY "global_categories_insert" ON global_categories
    FOR INSERT WITH CHECK (current_user_role() = 'admin');

CREATE POLICY "global_categories_update" ON global_categories
    FOR UPDATE USING (current_user_role() = 'admin')
    WITH CHECK (current_user_role() = 'admin');

CREATE POLICY "global_categories_delete" ON global_categories
    FOR DELETE USING (current_user_role() = 'admin');

-- 7b. providers: verified visible to all, owner sees own (any status), admin sees all
CREATE POLICY "providers_select" ON providers
    FOR SELECT USING (
        status = 'verified'
        OR owner_user_id = current_app_user_id()
        OR current_user_role() = 'admin'
    );

CREATE POLICY "providers_insert" ON providers
    FOR INSERT WITH CHECK (
        current_user_role() IN ('provider', 'admin')
    );

CREATE POLICY "providers_update" ON providers
    FOR UPDATE USING (
        owner_user_id = current_app_user_id()
        OR current_user_role() = 'admin'
    ) WITH CHECK (
        owner_user_id = current_app_user_id()
        OR current_user_role() = 'admin'
    );

-- 7c. provider_offerings: published visible to all, provider sees own, admin sees all
CREATE POLICY "provider_offerings_select" ON provider_offerings
    FOR SELECT USING (
        status = 'published'
        OR provider_id IN (
            SELECT p.id FROM providers p WHERE p.owner_user_id = current_app_user_id()
        )
        OR current_user_role() = 'admin'
    );

CREATE POLICY "provider_offerings_insert" ON provider_offerings
    FOR INSERT WITH CHECK (
        current_user_role() IN ('provider', 'admin')
        AND provider_id IN (
            SELECT p.id FROM providers p WHERE p.owner_user_id = current_app_user_id()
        )
    );

CREATE POLICY "provider_offerings_update" ON provider_offerings
    FOR UPDATE USING (
        provider_id IN (
            SELECT p.id FROM providers p WHERE p.owner_user_id = current_app_user_id()
        )
        OR current_user_role() = 'admin'
    ) WITH CHECK (
        provider_id IN (
            SELECT p.id FROM providers p WHERE p.owner_user_id = current_app_user_id()
        )
        OR current_user_role() = 'admin'
    );

-- 7d. tenant_offerings: standard tenant isolation
CREATE POLICY "tenant_offerings_select" ON tenant_offerings
    FOR SELECT USING (
        tenant_id = current_tenant_id()
    );

CREATE POLICY "tenant_offerings_insert" ON tenant_offerings
    FOR INSERT WITH CHECK (
        current_user_role() IN ('hr', 'admin')
        AND tenant_id = current_tenant_id()
    );

CREATE POLICY "tenant_offerings_update" ON tenant_offerings
    FOR UPDATE USING (
        current_user_role() IN ('hr', 'admin')
        AND tenant_id = current_tenant_id()
    ) WITH CHECK (
        current_user_role() IN ('hr', 'admin')
        AND tenant_id = current_tenant_id()
    );

CREATE POLICY "tenant_offerings_delete" ON tenant_offerings
    FOR DELETE USING (
        current_user_role() IN ('hr', 'admin')
        AND tenant_id = current_tenant_id()
    );

-- 7e. reviews: tenant-scoped SELECT, admin can see all
CREATE POLICY "reviews_select" ON reviews
    FOR SELECT USING (
        tenant_id = current_tenant_id()
        OR current_user_role() = 'admin'
    );

CREATE POLICY "reviews_insert" ON reviews
    FOR INSERT WITH CHECK (
        user_id = current_app_user_id()
        AND tenant_id = current_tenant_id()
    );

CREATE POLICY "reviews_update" ON reviews
    FOR UPDATE USING (
        (user_id = current_app_user_id() AND tenant_id = current_tenant_id())
        OR current_user_role() = 'admin'
    ) WITH CHECK (
        (user_id = current_app_user_id() AND tenant_id = current_tenant_id())
        OR current_user_role() = 'admin'
    );

CREATE POLICY "reviews_delete" ON reviews
    FOR DELETE USING (
        (user_id = current_app_user_id() AND tenant_id = current_tenant_id())
        OR current_user_role() = 'admin'
    );

-- 7f. provider_users: provider owner/admin sees team, admin sees all
CREATE POLICY "provider_users_select" ON provider_users
    FOR SELECT USING (
        user_id = current_app_user_id()
        OR provider_id IN (
            SELECT p.id FROM providers p WHERE p.owner_user_id = current_app_user_id()
        )
        OR current_user_role() = 'admin'
    );

CREATE POLICY "provider_users_insert" ON provider_users
    FOR INSERT WITH CHECK (
        current_user_role() = 'admin'
        OR (
            current_user_role() = 'provider'
            AND provider_id IN (
                SELECT p.id FROM providers p WHERE p.owner_user_id = current_app_user_id()
            )
        )
    );

CREATE POLICY "provider_users_update" ON provider_users
    FOR UPDATE USING (
        provider_id IN (
            SELECT p.id FROM providers p WHERE p.owner_user_id = current_app_user_id()
        )
        OR current_user_role() = 'admin'
    ) WITH CHECK (
        provider_id IN (
            SELECT p.id FROM providers p WHERE p.owner_user_id = current_app_user_id()
        )
        OR current_user_role() = 'admin'
    );

-- -------------------------------------------------------------
-- 8. Trigger: update review aggregates
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_review_aggregates()
RETURNS TRIGGER AS $$
DECLARE
    v_offering_id uuid;
    v_tenant_id uuid;
    v_global_avg numeric(3,2);
    v_global_count int;
    v_tenant_avg numeric(3,2);
    v_tenant_count int;
BEGIN
    -- Determine the offering_id and tenant_id from the affected row
    IF TG_OP = 'DELETE' THEN
        v_offering_id := OLD.provider_offering_id;
        v_tenant_id := OLD.tenant_id;
    ELSE
        v_offering_id := NEW.provider_offering_id;
        v_tenant_id := NEW.tenant_id;
    END IF;

    -- Calculate global aggregates (only visible reviews)
    SELECT COALESCE(AVG(rating), 0)::numeric(3,2), COUNT(*)
    INTO v_global_avg, v_global_count
    FROM reviews
    WHERE provider_offering_id = v_offering_id
      AND status = 'visible';

    -- Update provider_offerings
    UPDATE provider_offerings
    SET avg_rating = v_global_avg,
        review_count = v_global_count,
        updated_at = now()
    WHERE id = v_offering_id;

    -- Calculate tenant aggregates (only visible reviews for this tenant)
    SELECT COALESCE(AVG(rating), 0)::numeric(3,2), COUNT(*)
    INTO v_tenant_avg, v_tenant_count
    FROM reviews
    WHERE provider_offering_id = v_offering_id
      AND tenant_id = v_tenant_id
      AND status = 'visible';

    -- Update tenant_offerings (if exists for this tenant + offering)
    UPDATE tenant_offerings
    SET tenant_avg_rating = v_tenant_avg,
        tenant_review_count = v_tenant_count,
        updated_at = now()
    WHERE provider_offering_id = v_offering_id
      AND tenant_id = v_tenant_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_review_aggregates
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_review_aggregates();

-- -------------------------------------------------------------
-- 9. Updated_at trigger for new tables
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_providers_updated_at
    BEFORE UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_provider_offerings_updated_at
    BEFORE UPDATE ON provider_offerings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tenant_offerings_updated_at
    BEFORE UPDATE ON tenant_offerings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------------
-- 10. Seed global categories
-- -------------------------------------------------------------

INSERT INTO global_categories (name, icon, sort_order, is_active) VALUES
    ('Здоровье',      'heart-pulse',     1, true),
    ('Образование',   'graduation-cap',  2, true),
    ('Спорт',         'dumbbell',        3, true),
    ('Питание',       'utensils',        4, true),
    ('Транспорт',     'car',             5, true),
    ('Развлечения',   'sparkles',        6, true),
    ('Финансы',       'wallet',          7, true),
    ('Красота',       'heart',           8, true)
ON CONFLICT (name) DO NOTHING;
-- =============================================================
-- 00005: Auth trigger — auto-create app user + wallet on signup
-- =============================================================
-- When a new user registers via Supabase Auth, this trigger
-- automatically creates a record in public.users and an empty
-- wallet, so the app works immediately after registration.
-- =============================================================

-- 1. Function that runs on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _role public.user_role;
  _tenant_id uuid;
  _user_id uuid;
BEGIN
  -- Extract role from user_metadata, default to 'employee'
  _role := COALESCE(
    (NEW.raw_user_meta_data ->> 'role')::public.user_role,
    'employee'
  );

  -- For now, assign to the first tenant (or create one if none exists)
  SELECT id INTO _tenant_id FROM public.tenants LIMIT 1;

  IF _tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, domain, settings)
    VALUES ('Default Company', 'default.local', '{}'::jsonb)
    RETURNING id INTO _tenant_id;
  END IF;

  -- Create the app-level user record
  INSERT INTO public.users (id, tenant_id, auth_id, email, role)
  VALUES (gen_random_uuid(), _tenant_id, NEW.id, NEW.email, _role)
  RETURNING id INTO _user_id;

  -- Create an empty wallet for the user
  INSERT INTO public.wallets (id, user_id, tenant_id, balance, reserved, period, expires_at)
  VALUES (
    gen_random_uuid(),
    _user_id,
    _tenant_id,
    0,
    0,
    TO_CHAR(NOW(), 'YYYY') || '-Q' || CEIL(EXTRACT(MONTH FROM NOW()) / 3.0)::int,
    (DATE_TRUNC('quarter', NOW()) + INTERVAL '3 months')::timestamptz
  );

  RETURN NEW;
END;
$$;

-- 2. Trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
-- =============================================================
-- Benefit Market — Seed Data
-- =============================================================
-- Реалистичные тестовые данные для демонстрации.
-- Все INSERT используют ON CONFLICT DO NOTHING для идемпотентности.
-- =============================================================

-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- Фиксированные UUID-константы
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

-- Тенант
-- tenant:  00000000-0000-0000-0000-000000000001

-- Пользователи (3 ключевых + 5 сотрудников)
-- admin:      00000000-0000-0000-0000-000000000010
-- hr:         00000000-0000-0000-0000-000000000020
-- employee:   00000000-0000-0000-0000-000000000030
-- emp_junior: 00000000-0000-0000-0000-000000000031
-- emp_middle: 00000000-0000-0000-0000-000000000032
-- emp_senior: 00000000-0000-0000-0000-000000000033
-- emp_lead:   00000000-0000-0000-0000-000000000034
-- emp_dir:    00000000-0000-0000-0000-000000000035

-- Категории
-- cat_health:    00000000-0000-0000-0000-000000000100
-- cat_sport:     00000000-0000-0000-0000-000000000101
-- cat_education: 00000000-0000-0000-0000-000000000102
-- cat_food:      00000000-0000-0000-0000-000000000103
-- cat_leisure:   00000000-0000-0000-0000-000000000104

-- Бенефиты (15 шт.)
-- ben_dms:         00000000-0000-0000-0000-000000000200
-- ben_dental:      00000000-0000-0000-0000-000000000201
-- ben_vitamins:    00000000-0000-0000-0000-000000000202
-- ben_fitness:     00000000-0000-0000-0000-000000000203
-- ben_pool:        00000000-0000-0000-0000-000000000204
-- ben_sport_club:  00000000-0000-0000-0000-000000000205
-- ben_english:     00000000-0000-0000-0000-000000000206
-- ben_online:      00000000-0000-0000-0000-000000000207
-- ben_conference:  00000000-0000-0000-0000-000000000208
-- ben_lunch:       00000000-0000-0000-0000-000000000209
-- ben_delivery:    00000000-0000-0000-0000-00000000020a
-- ben_coffee:      00000000-0000-0000-0000-00000000020b
-- ben_sanatorium:  00000000-0000-0000-0000-00000000020c
-- ben_excursion:   00000000-0000-0000-0000-00000000020d
-- ben_culture:     00000000-0000-0000-0000-00000000020e

-- Кошельки
-- wallet_admin:      00000000-0000-0000-0000-000000000300
-- wallet_hr:         00000000-0000-0000-0000-000000000301
-- wallet_employee:   00000000-0000-0000-0000-000000000302
-- wallet_junior:     00000000-0000-0000-0000-000000000303
-- wallet_middle:     00000000-0000-0000-0000-000000000304
-- wallet_senior:     00000000-0000-0000-0000-000000000305
-- wallet_lead:       00000000-0000-0000-0000-000000000306
-- wallet_director:   00000000-0000-0000-0000-000000000307

-- Заказы
-- order_fitness:  00000000-0000-0000-0000-000000000400
-- order_english:  00000000-0000-0000-0000-000000000401
-- order_vitamins: 00000000-0000-0000-0000-000000000402


-- =============================================================
-- 1. Тенант
-- =============================================================

INSERT INTO tenants (id, name, domain, settings)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'ООО Технологии Будущего',
    'techfuture.ru',
    '{
        "locale": "ru",
        "currency_label": "баллы",
        "fiscal_year_start": "01-01",
        "branding": {
            "primary_color": "#2563EB",
            "logo_url": "/assets/logo-techfuture.svg"
        }
    }'::jsonb
)
ON CONFLICT DO NOTHING;


-- =============================================================
-- 2. Пользователи — 3 ключевых
-- =============================================================

INSERT INTO users (id, tenant_id, auth_id, email, role) VALUES
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'admin@techfuture.ru',  'admin'),
    ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', 'hr@techfuture.ru',     'hr'),
    ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000030', 'ivan@techfuture.ru',   'employee')
ON CONFLICT DO NOTHING;


-- =============================================================
-- 3. Пользователи — 5 дополнительных сотрудников
-- =============================================================

INSERT INTO users (id, tenant_id, auth_id, email, role) VALUES
    ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', 'anna.petrova@techfuture.ru',     'employee'),
    ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000032', 'dmitry.sokolov@techfuture.ru',   'employee'),
    ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000033', 'elena.kuznetsova@techfuture.ru', 'employee'),
    ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000034', 'sergey.volkov@techfuture.ru',    'employee'),
    ('00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000035', 'maria.novikova@techfuture.ru',   'employee')
ON CONFLICT DO NOTHING;


-- =============================================================
-- 4. Профили сотрудников (для всех 8 пользователей)
-- =============================================================

INSERT INTO employee_profiles (id, user_id, tenant_id, grade, tenure_months, location, legal_entity, extra) VALUES
    -- admin — директор, 60 мес. стажа
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
     'director', 60, 'Москва', 'ООО ТБ',
     '{"full_name": "Алексей Михайлович Сидоров", "department": "Управление", "position": "Генеральный директор"}'::jsonb),

    -- hr — senior, 36 мес. стажа
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001',
     'senior', 36, 'Москва', 'ООО ТБ',
     '{"full_name": "Ольга Сергеевна Белова", "department": "HR", "position": "Руководитель HR-отдела"}'::jsonb),

    -- ivan — middle, 18 мес. стажа (основной тестовый сотрудник)
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001',
     'middle', 18, 'Москва', 'ООО ТБ',
     '{"full_name": "Иван Андреевич Козлов", "department": "Разработка", "position": "Разработчик"}'::jsonb),

    -- anna — junior, 4 мес. стажа
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001',
     'junior', 4, 'Санкт-Петербург', 'ООО ТБ Северо-Запад',
     '{"full_name": "Анна Игоревна Петрова", "department": "Дизайн", "position": "Младший дизайнер"}'::jsonb),

    -- dmitry — middle, 24 мес. стажа
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001',
     'middle', 24, 'Казань', 'ООО ТБ',
     '{"full_name": "Дмитрий Олегович Соколов", "department": "Аналитика", "position": "Аналитик данных"}'::jsonb),

    -- elena — senior, 30 мес. стажа
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001',
     'senior', 30, 'Москва', 'ООО ТБ',
     '{"full_name": "Елена Викторовна Кузнецова", "department": "Разработка", "position": "Старший разработчик"}'::jsonb),

    -- sergey — lead, 42 мес. стажа
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000001',
     'lead', 42, 'Санкт-Петербург', 'ООО ТБ Северо-Запад',
     '{"full_name": "Сергей Александрович Волков", "department": "Разработка", "position": "Тимлид бэкенд-команды"}'::jsonb),

    -- maria — director, 48 мес. стажа
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000001',
     'director', 48, 'Москва', 'ООО ТБ',
     '{"full_name": "Мария Дмитриевна Новикова", "department": "Продукт", "position": "Директор по продукту"}'::jsonb)
ON CONFLICT DO NOTHING;


-- =============================================================
-- 5. Категории бенефитов
-- =============================================================

INSERT INTO benefit_categories (id, tenant_id, name, icon, sort_order) VALUES
    ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', 'Здоровье',  'heart-pulse',    1),
    ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Спорт',     'dumbbell',       2),
    ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Обучение',  'graduation-cap', 3),
    ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Питание',   'utensils',       4),
    ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'Отдых',     'palmtree',       5)
ON CONFLICT DO NOTHING;


-- =============================================================
-- 6. Бенефиты (15 штук)
-- =============================================================

INSERT INTO benefits (id, tenant_id, category_id, name, description, price_points, stock_limit, is_active) VALUES
    -- Здоровье (3)
    ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000100',
     'ДМС расширенное',
     'Полис добровольного медицинского страхования с расширенным покрытием: стационар, амбулатория, вызов врача на дом, телемедицина. Сеть клиник «Медси», «Чайка», GMS Clinic.',
     30000, NULL, true),

    ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000100',
     'Стоматология',
     'Годовая стоматологическая программа: профилактика, лечение, гигиена полости рта. Клиника «Белая Радуга».',
     15000, NULL, true),

    ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000100',
     'Витамины и БАД',
     'Ежеквартальный набор витаминов и биологически активных добавок от iHerb. Персональный подбор по результатам чекапа.',
     3000, 100, true),

    -- Спорт (3)
    ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101',
     'Фитнес-клуб годовой',
     'Годовой абонемент в сеть фитнес-клубов World Class или DDX Fitness. Включает тренажёрный зал, групповые программы, сауну.',
     24000, NULL, true),

    ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101',
     'Бассейн квартальный',
     'Абонемент в бассейн на 3 месяца (12 посещений). «Олимпийский» или «Чайка».',
     8000, 50, true),

    ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101',
     'Спортивная секция',
     'Оплата занятий в спортивной секции на выбор: теннис, единоборства, волейбол, йога. Квартальный абонемент.',
     12000, NULL, true),

    -- Обучение (3)
    ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102',
     'Курсы английского',
     'Индивидуальные или групповые занятия английским языком с носителем. 2 раза в неделю, 3 месяца. Школа Skyeng / EnglishFirst.',
     18000, NULL, true),

    ('00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102',
     'Онлайн-курсы',
     'Подписка на образовательные платформы: Coursera, Udemy, Stepik. Один курс на выбор.',
     6000, NULL, true),

    ('00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102',
     'Конференция',
     'Оплата участия в профессиональной конференции: HighLoad++, TeamLead Conf, PyCon Russia, Стачка и др. Включает билет и дорогу.',
     25000, 30, true),

    -- Питание (3)
    ('00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103',
     'Обеды в офисе',
     'Компенсация обедов в офисной столовой. Квартальный лимит: 60 обедов по 150 руб.',
     9000, NULL, true),

    ('00000000-0000-0000-0000-00000000020a', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103',
     'Доставка еды',
     'Баланс на сервисе доставки еды (Яндекс.Еда / Delivery Club) для удалённых сотрудников.',
     12000, NULL, true),

    ('00000000-0000-0000-0000-00000000020b', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103',
     'Кофемашина',
     'Безлимитный доступ к премиальному кофе в офисе: капучино, латте, флэт-уайт. Зёрна Tasty Coffee.',
     5000, NULL, true),

    -- Отдых (3)
    ('00000000-0000-0000-0000-00000000020c', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000104',
     'Путёвка в санаторий',
     'Путёвка на 14 дней в санаторий «Барвиха» или «Подмосковье». Проживание, питание, лечебные процедуры.',
     40000, 10, true),

    ('00000000-0000-0000-0000-00000000020d', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000104',
     'Экскурсия выходного дня',
     'Организованная экскурсия на выходные: Суздаль, Коломна, Тула, Нижний Новгород. Транспорт + гид + обед.',
     8000, 50, true),

    ('00000000-0000-0000-0000-00000000020e', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000104',
     'Культурные мероприятия',
     'Билеты на театр, концерт или выставку. Два билета на одно мероприятие по выбору сотрудника.',
     5000, NULL, true)
ON CONFLICT DO NOTHING;


-- =============================================================
-- 7. Правила доступности (eligibility_rules)
-- =============================================================

INSERT INTO eligibility_rules (id, benefit_id, tenant_id, conditions) VALUES
    -- ДМС расширенное — только senior, lead, director
    (gen_random_uuid(),
     '00000000-0000-0000-0000-000000000200',
     '00000000-0000-0000-0000-000000000001',
     '{
         "rule_name": "ДМС расширенное — грейд senior+",
         "match_all": [
             { "field": "grade", "operator": "in", "value": ["senior", "lead", "director"] }
         ]
     }'::jsonb),

    -- Путёвка в санаторий — стаж >= 12 мес.
    (gen_random_uuid(),
     '00000000-0000-0000-0000-00000000020c',
     '00000000-0000-0000-0000-000000000001',
     '{
         "rule_name": "Путёвка в санаторий — стаж от 12 месяцев",
         "match_all": [
             { "field": "tenure_months", "operator": "gte", "value": 12 }
         ]
     }'::jsonb),

    -- Конференция — middle, senior, lead, director
    (gen_random_uuid(),
     '00000000-0000-0000-0000-000000000208',
     '00000000-0000-0000-0000-000000000001',
     '{
         "rule_name": "Конференция — грейд middle+",
         "match_all": [
             { "field": "grade", "operator": "in", "value": ["middle", "senior", "lead", "director"] }
         ]
     }'::jsonb)
ON CONFLICT DO NOTHING;


-- =============================================================
-- 8. Бюджетные политики
-- =============================================================

INSERT INTO budget_policies (id, tenant_id, name, points_amount, period, target_filter, is_active) VALUES
    -- Стандартная — 50 000 баллов/квартал, все сотрудники
    ('00000000-0000-0000-0000-000000000500',
     '00000000-0000-0000-0000-000000000001',
     'Стандартная',
     50000,
     'quarterly',
     '{
         "description": "Все сотрудники компании",
         "match_all": []
     }'::jsonb,
     true),

    -- Руководительская — 80 000 баллов/квартал, lead + director
    ('00000000-0000-0000-0000-000000000501',
     '00000000-0000-0000-0000-000000000001',
     'Руководительская',
     80000,
     'quarterly',
     '{
         "description": "Руководители (lead и director)",
         "match_all": [
             { "field": "grade", "operator": "in", "value": ["lead", "director"] }
         ]
     }'::jsonb,
     true)
ON CONFLICT DO NOTHING;


-- =============================================================
-- 9. Кошельки — период 2025-Q1
-- =============================================================

INSERT INTO wallets (id, user_id, tenant_id, balance, reserved, period, expires_at) VALUES
    -- admin (director) — 80 000
    ('00000000-0000-0000-0000-000000000300',
     '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
     80000, 0, '2025-Q1', '2025-04-01T00:00:00+03:00'),

    -- hr (senior) — 50 000
    ('00000000-0000-0000-0000-000000000301',
     '00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001',
     50000, 0, '2025-Q1', '2025-04-01T00:00:00+03:00'),

    -- ivan (middle) — начислено 50000, потрачено 27000, зарезервировано 18000
    -- balance = 50000 - 27000 - 18000 = 5000, reserved = 18000
    ('00000000-0000-0000-0000-000000000302',
     '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001',
     5000, 18000, '2025-Q1', '2025-04-01T00:00:00+03:00'),

    -- anna (junior) — 50 000
    ('00000000-0000-0000-0000-000000000303',
     '00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001',
     50000, 0, '2025-Q1', '2025-04-01T00:00:00+03:00'),

    -- dmitry (middle) — 50 000
    ('00000000-0000-0000-0000-000000000304',
     '00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001',
     50000, 0, '2025-Q1', '2025-04-01T00:00:00+03:00'),

    -- elena (senior) — 50 000
    ('00000000-0000-0000-0000-000000000305',
     '00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001',
     50000, 0, '2025-Q1', '2025-04-01T00:00:00+03:00'),

    -- sergey (lead) — 80 000
    ('00000000-0000-0000-0000-000000000306',
     '00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000001',
     80000, 0, '2025-Q1', '2025-04-01T00:00:00+03:00'),

    -- maria (director) — 80 000
    ('00000000-0000-0000-0000-000000000307',
     '00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000001',
     80000, 0, '2025-Q1', '2025-04-01T00:00:00+03:00')
ON CONFLICT DO NOTHING;


-- =============================================================
-- 10. Заказы для ivan@techfuture.ru
-- =============================================================

-- Заказ 1: Фитнес-клуб годовой — оплачен
INSERT INTO orders (id, user_id, tenant_id, status, total_points, reserved_at, expires_at, created_at) VALUES
    ('00000000-0000-0000-0000-000000000400',
     '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001',
     'paid', 24000,
     '2025-01-15T10:30:00+03:00',
     '2025-01-15T10:45:00+03:00',
     '2025-01-15T10:30:00+03:00')
ON CONFLICT DO NOTHING;

-- Заказ 2: Курсы английского — зарезервирован
INSERT INTO orders (id, user_id, tenant_id, status, total_points, reserved_at, expires_at, created_at) VALUES
    ('00000000-0000-0000-0000-000000000401',
     '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001',
     'reserved', 18000,
     '2025-02-20T14:00:00+03:00',
     '2025-02-20T14:15:00+03:00',
     '2025-02-20T14:00:00+03:00')
ON CONFLICT DO NOTHING;

-- Заказ 3: Витамины — оплачен
INSERT INTO orders (id, user_id, tenant_id, status, total_points, reserved_at, expires_at, created_at) VALUES
    ('00000000-0000-0000-0000-000000000402',
     '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001',
     'paid', 3000,
     '2025-01-22T09:15:00+03:00',
     '2025-01-22T09:30:00+03:00',
     '2025-01-22T09:15:00+03:00')
ON CONFLICT DO NOTHING;


-- =============================================================
-- 11. Позиции заказов (order_items)
-- =============================================================

INSERT INTO order_items (id, order_id, benefit_id, quantity, price_points) VALUES
    -- Заказ 1: Фитнес-клуб
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000203', 1, 24000),
    -- Заказ 2: Курсы английского
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000206', 1, 18000),
    -- Заказ 3: Витамины
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000202', 1, 3000)
ON CONFLICT DO NOTHING;


-- =============================================================
-- 12. Журнал операций с баллами (point_ledger)
-- =============================================================

-- --- Начисления (accrual) для всех кошельков ---

INSERT INTO point_ledger (id, wallet_id, tenant_id, order_id, type, amount, description, created_at) VALUES
    -- admin — начисление 80 000
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000001',
     NULL, 'accrual', 80000, 'Начисление баллов по политике «Руководительская» за Q1 2025', '2025-01-01T00:00:00+03:00'),

    -- hr — начисление 50 000
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001',
     NULL, 'accrual', 50000, 'Начисление баллов по политике «Стандартная» за Q1 2025', '2025-01-01T00:00:00+03:00'),

    -- ivan — начисление 50 000
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001',
     NULL, 'accrual', 50000, 'Начисление баллов по политике «Стандартная» за Q1 2025', '2025-01-01T00:00:00+03:00'),

    -- anna — начисление 50 000
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000001',
     NULL, 'accrual', 50000, 'Начисление баллов по политике «Стандартная» за Q1 2025', '2025-01-01T00:00:00+03:00'),

    -- dmitry — начисление 50 000
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000001',
     NULL, 'accrual', 50000, 'Начисление баллов по политике «Стандартная» за Q1 2025', '2025-01-01T00:00:00+03:00'),

    -- elena — начисление 50 000
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000001',
     NULL, 'accrual', 50000, 'Начисление баллов по политике «Стандартная» за Q1 2025', '2025-01-01T00:00:00+03:00'),

    -- sergey — начисление 80 000
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000001',
     NULL, 'accrual', 80000, 'Начисление баллов по политике «Руководительская» за Q1 2025', '2025-01-01T00:00:00+03:00'),

    -- maria — начисление 80 000
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000001',
     NULL, 'accrual', 80000, 'Начисление баллов по политике «Руководительская» за Q1 2025', '2025-01-01T00:00:00+03:00')
ON CONFLICT DO NOTHING;

-- --- Списания и резервы для ivan (кошелёк 302) ---

INSERT INTO point_ledger (id, wallet_id, tenant_id, order_id, type, amount, description, created_at) VALUES
    -- Списание за Фитнес-клуб (заказ paid)
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000400', 'spend', -24000,
     'Оплата заказа: Фитнес-клуб годовой', '2025-01-15T10:30:00+03:00'),

    -- Резерв за Курсы английского (заказ reserved)
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000401', 'reserve', -18000,
     'Резервирование баллов: Курсы английского', '2025-02-20T14:00:00+03:00'),

    -- Списание за Витамины (заказ paid)
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000402', 'spend', -3000,
     'Оплата заказа: Витамины и БАД', '2025-01-22T09:15:00+03:00')
ON CONFLICT DO NOTHING;


-- =============================================================
-- 13. Записи аудит-лога
-- =============================================================

INSERT INTO audit_log (id, tenant_id, user_id, action, entity_type, entity_id, diff, created_at) VALUES
    -- HR создала бенефит «ДМС расширенное»
    (gen_random_uuid(),
     '00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000020',
     'create', 'benefit', '00000000-0000-0000-0000-000000000200',
     '{"name": "ДМС расширенное", "price_points": 30000}'::jsonb,
     '2024-12-20T11:00:00+03:00'),

    -- Иван оформил заказ на Фитнес-клуб
    (gen_random_uuid(),
     '00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000030',
     'create', 'order', '00000000-0000-0000-0000-000000000400',
     '{"status": "paid", "total_points": 24000, "benefit": "Фитнес-клуб годовой"}'::jsonb,
     '2025-01-15T10:30:00+03:00'),

    -- Иван зарезервировал Курсы английского
    (gen_random_uuid(),
     '00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000030',
     'create', 'order', '00000000-0000-0000-0000-000000000401',
     '{"status": "reserved", "total_points": 18000, "benefit": "Курсы английского"}'::jsonb,
     '2025-02-20T14:00:00+03:00'),

    -- Иван оплатил Витамины
    (gen_random_uuid(),
     '00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000030',
     'create', 'order', '00000000-0000-0000-0000-000000000402',
     '{"status": "paid", "total_points": 3000, "benefit": "Витамины и БАД"}'::jsonb,
     '2025-01-22T09:15:00+03:00'),

    -- Admin активировал политику «Руководительская»
    (gen_random_uuid(),
     '00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000010',
     'create', 'budget_policy', '00000000-0000-0000-0000-000000000501',
     '{"name": "Руководительская", "points_amount": 80000, "period": "quarterly"}'::jsonb,
     '2024-12-25T16:00:00+03:00')
ON CONFLICT DO NOTHING;


-- =============================================================
-- Готово! Seed-данные загружены.
--
-- Сводка по кошельку Ивана Козлова (ivan@techfuture.ru):
--   Начислено:        50 000 баллов (Q1 2025)
--   Потрачено:        27 000 (фитнес 24 000 + витамины 3 000)
--   Зарезервировано:  18 000 (курсы английского)
--   Свободный остаток: 5 000 баллов
-- =============================================================
