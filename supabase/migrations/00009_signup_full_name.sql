-- ===========================================================================
-- Migration 00009: capture full_name on signup
--
-- The 00005 trigger creates public.users / wallet on first sign-up but
-- ignored personal info from raw_user_meta_data. Extends it so that:
--   • full_name is copied from user_metadata.full_name (preferred) or
--     user_metadata.name (legacy, e.g. CSV import metadata).
--   • role parsing keeps its current behaviour.
-- Re-running this migration is safe — it replaces the function body.
-- ===========================================================================

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
  _full_name text;
BEGIN
  _role := COALESCE(
    (NEW.raw_user_meta_data ->> 'role')::public.user_role,
    'employee'
  );

  _full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    ''
  );

  -- Pick the first non-platform tenant; create one if none exist.
  SELECT id INTO _tenant_id FROM public.tenants
  WHERE id != '00000000-0000-0000-0000-000000000000'
  ORDER BY created_at ASC LIMIT 1;

  IF _tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, domain, settings)
    VALUES ('Default Company', 'default.local', '{}'::jsonb)
    RETURNING id INTO _tenant_id;
  END IF;

  -- App-level user record, with full_name when provided.
  INSERT INTO public.users (id, tenant_id, auth_id, email, role, full_name)
  VALUES (gen_random_uuid(), _tenant_id, NEW.id, NEW.email, _role, _full_name)
  RETURNING id INTO _user_id;

  -- Initial wallet balance — pull from tenant's default budget policy.
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

  -- Create a stub employee_profile so HR list and self-profile have a row
  -- to read/write. Skipped for non-employee roles.
  IF _role = 'employee' THEN
    INSERT INTO public.employee_profiles (user_id, tenant_id, grade, tenure_months, location, legal_entity, extra)
    VALUES (_user_id, _tenant_id, '', 0, '', '', '{}'::jsonb)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mirror tenant_id into auth metadata so RLS helpers can read it from JWT.
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('tenant_id', _tenant_id::text)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Trigger itself doesn't need to be re-bound — it already points at this function.
