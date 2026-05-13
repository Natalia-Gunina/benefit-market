-- ===========================================================================
-- Откат seed_demo_extra_fix.sql:
--   1. Возвращаем enabled_at новых офферов на «90 дней назад» так,
--      чтобы старые льготы снова показывались наверху каталога.
--   2. УДАЛЯЕМ tenant_offerings, которые мы линковали в чужие тенанты
--      (в их собственном Block 3 они НЕ привязывались, это была отдельная
--      правка в _fix.sql — её разворачиваем).
-- НИЧЕГО другого не трогаем: провайдеры, provider_offerings, сотрудники,
-- заказы, начисления — всё остаётся, ничего не удаляется.
-- ===========================================================================

DO $rollback$
DECLARE
  _deleted int;
  _updated int;
  _main_tenant uuid;
BEGIN
  SELECT id INTO _main_tenant FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  -- 1) Возвращаем enabled_at в прошлое для новых офферов в ОСНОВНОМ тенанте.
  WITH new_pos AS (
    SELECT id FROM provider_offerings
    WHERE provider_id IN (
      SELECT id FROM providers
      WHERE slug IN (
        'sberhealth', 'fitmost', 'coursera-business', 'samokat',
        'aviasales-business', 'lenta-fun', 'hello-pets', 'uyutniy-dom'
      )
    )
  )
  UPDATE tenant_offerings
  SET enabled_at = NOW() - INTERVAL '120 days'
  WHERE tenant_id = _main_tenant
    AND provider_offering_id IN (SELECT id FROM new_pos);
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Rollback: updated enabled_at для % офферов в main tenant', _updated;

  -- 2) Удаляем tenant_offerings, добавленные в чужие тенанты _fix-скриптом
  --    (новые офферы * (все tenants кроме main)). Они не должны были туда попасть.
  WITH new_pos AS (
    SELECT id FROM provider_offerings
    WHERE provider_id IN (
      SELECT id FROM providers
      WHERE slug IN (
        'sberhealth', 'fitmost', 'coursera-business', 'samokat',
        'aviasales-business', 'lenta-fun', 'hello-pets', 'uyutniy-dom'
      )
    )
  )
  DELETE FROM tenant_offerings
  WHERE provider_offering_id IN (SELECT id FROM new_pos)
    AND tenant_id != _main_tenant
    AND tenant_id != '00000000-0000-0000-0000-000000000000';
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RAISE NOTICE 'Rollback: удалено % лишних tenant_offerings из чужих тенантов', _deleted;
END $rollback$;
