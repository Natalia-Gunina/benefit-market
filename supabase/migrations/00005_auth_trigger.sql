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
  _initial_balance int;
BEGIN
  -- Extract role from user_metadata, default to 'employee'
  _role := COALESCE(
    (NEW.raw_user_meta_data ->> 'role')::public.user_role,
    'employee'
  );

  -- Assign to the first non-platform tenant (or create one if none exists)
  SELECT id INTO _tenant_id FROM public.tenants
  WHERE id != '00000000-0000-0000-0000-000000000000'
  ORDER BY created_at ASC LIMIT 1;

  IF _tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, domain, settings)
    VALUES ('Default Company', 'default.local', '{}'::jsonb)
    RETURNING id INTO _tenant_id;
  END IF;

  -- Create the app-level user record
  INSERT INTO public.users (id, tenant_id, auth_id, email, role)
  VALUES (gen_random_uuid(), _tenant_id, NEW.id, NEW.email, _role)
  RETURNING id INTO _user_id;

  -- Resolve initial balance from the tenant's default budget policy.
  -- Pick the first active policy with no target_filter restrictions
  -- (i.e. match_all is empty = applies to everyone), fall back to 0.
  SELECT COALESCE(bp.points_amount, 0) INTO _initial_balance
  FROM public.budget_policies bp
  WHERE bp.tenant_id = _tenant_id
    AND bp.is_active = true
    AND (
      bp.target_filter IS NULL
      OR bp.target_filter = '{}'::jsonb
      OR bp.target_filter->'match_all' = '[]'::jsonb
    )
  ORDER BY bp.points_amount ASC
  LIMIT 1;

  IF _initial_balance IS NULL THEN
    _initial_balance := 0;
  END IF;

  -- Create wallet with balance from budget policy
  INSERT INTO public.wallets (id, user_id, tenant_id, balance, reserved, period, expires_at)
  VALUES (
    gen_random_uuid(),
    _user_id,
    _tenant_id,
    _initial_balance,
    0,
    TO_CHAR(NOW(), 'YYYY') || '-Q' || CEIL(EXTRACT(MONTH FROM NOW()) / 3.0)::int,
    (DATE_TRUNC('quarter', NOW()) + INTERVAL '3 months')::timestamptz
  );

  -- Write tenant_id back into auth user_metadata so RLS policies
  -- can read it from the JWT via current_tenant_id()
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('tenant_id', _tenant_id::text)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- 2. Trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
