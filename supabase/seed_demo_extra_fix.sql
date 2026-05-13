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
  _tenant_main uuid := '00000000-0000-4000-8000-000000000001';
  _updated     int;
BEGIN
  -- Подсветим именно «новые» офферы — те, чьи провайдеры из доп-блока.
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
  WHERE tenant_id = _tenant_main
    AND provider_offering_id IN (SELECT id FROM new_offering_ids);

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Fix: updated enabled_at for % новых tenant_offerings', _updated;
END $extra_fix$;
