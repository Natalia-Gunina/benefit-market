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
