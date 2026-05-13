-- ===========================================================================
-- Benefit Market — fix для seed_demo_extra: поднимаем новые офферы наверх
-- ===========================================================================
-- В seed_demo_extra.sql новые tenant_offerings были вставлены с
-- enabled_at = NOW() - 90 days .. -5 days, поэтому в каталоге employee
-- (сортировка enabled_at DESC, per_page=20) они уходили на 2-3 страницу.
--
-- Этот fix ставит свежие enabled_at для новых офферов (последние 12 часов,
-- слегка размазано), чтобы они показались в первой странице каталога.
-- Идемпотентен. Безопасно запускать несколько раз.
-- ===========================================================================

DO $extra_fix$
DECLARE
  _updated     int;
BEGIN
  -- Поднимаем enabled_at для всех tenant_offerings, ссылающихся
  -- на новые provider_offerings (от 8 новых провайдеров), независимо
  -- от tenant_id — так фикс работает на любом наборе tenants.
  WITH new_provider_ids AS (
    SELECT id
    FROM providers
    WHERE slug IN (
      'sberhealth', 'fitmost', 'coursera-business', 'samokat',
      'aviasales-business', 'lenta-fun', 'hello-pets', 'uyutniy-dom'
    )
  ),
  new_offering_ids AS (
    SELECT id
    FROM provider_offerings
    WHERE provider_id IN (SELECT id FROM new_provider_ids)
  )
  UPDATE tenant_offerings
  SET enabled_at = NOW() - (random() * INTERVAL '12 hours')
  WHERE provider_offering_id IN (SELECT id FROM new_offering_ids);

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Fix: updated enabled_at for % новых tenant_offerings', _updated;

  -- Линкуем новые офферы во ВСЕ существующие tenants (кроме default),
  -- чтобы они появились в каталоге у любого юзера независимо от того,
  -- в каком tenant он зарегистрирован.
  INSERT INTO tenant_offerings (tenant_id, provider_offering_id, custom_price_points, is_active, enabled_by, enabled_at)
  SELECT
    t.id,
    po.id,
    NULL,
    true,
    (SELECT id FROM users WHERE tenant_id = t.id ORDER BY created_at ASC LIMIT 1),
    NOW() - (random() * INTERVAL '12 hours')
  FROM tenants t
  CROSS JOIN provider_offerings po
  WHERE t.id != '00000000-0000-0000-0000-000000000000'
    AND po.status = 'published'
    AND po.provider_id IN (
      SELECT id FROM providers
      WHERE slug IN (
        'sberhealth', 'fitmost', 'coursera-business', 'samokat',
        'aviasales-business', 'lenta-fun', 'hello-pets', 'uyutniy-dom'
      )
    )
    AND EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id)
  ON CONFLICT (tenant_id, provider_offering_id) DO NOTHING;

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Fix: linked % новых tenant_offerings в дополнительные тенанты', _updated;
END $extra_fix$;
