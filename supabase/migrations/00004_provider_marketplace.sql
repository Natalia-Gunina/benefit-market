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
