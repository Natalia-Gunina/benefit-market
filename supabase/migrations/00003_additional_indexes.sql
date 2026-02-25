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
