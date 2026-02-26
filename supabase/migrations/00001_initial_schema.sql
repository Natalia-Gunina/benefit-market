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
