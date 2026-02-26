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
