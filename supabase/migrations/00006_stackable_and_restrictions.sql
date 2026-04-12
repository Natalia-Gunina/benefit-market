-- =============================================================
-- Benefit Market — Stackable Benefits + Benefit Restrictions
-- =============================================================

-- -------------------------------------------------------------
-- 1. Add is_stackable to provider_offerings
-- -------------------------------------------------------------

ALTER TABLE provider_offerings
    ADD COLUMN is_stackable boolean NOT NULL DEFAULT false;

-- -------------------------------------------------------------
-- 2. benefit_restrictions — HR can restrict offerings per tenant
-- -------------------------------------------------------------

CREATE TABLE benefit_restrictions (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_offering_id    uuid        NOT NULL REFERENCES provider_offerings(id) ON DELETE CASCADE,
    restricted_by           uuid        REFERENCES users(id) ON DELETE SET NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),

    UNIQUE (tenant_id, provider_offering_id)
);

-- Indexes
CREATE INDEX idx_benefit_restrictions_tenant_id      ON benefit_restrictions(tenant_id);
CREATE INDEX idx_benefit_restrictions_offering_id    ON benefit_restrictions(provider_offering_id);

-- RLS
ALTER TABLE benefit_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "benefit_restrictions_select" ON benefit_restrictions
    FOR SELECT USING (
        tenant_id = current_tenant_id()
        OR current_user_role() = 'admin'
    );

CREATE POLICY "benefit_restrictions_insert" ON benefit_restrictions
    FOR INSERT WITH CHECK (
        current_user_role() IN ('hr', 'admin')
        AND tenant_id = current_tenant_id()
    );

CREATE POLICY "benefit_restrictions_delete" ON benefit_restrictions
    FOR DELETE USING (
        current_user_role() IN ('hr', 'admin')
        AND tenant_id = current_tenant_id()
    );
