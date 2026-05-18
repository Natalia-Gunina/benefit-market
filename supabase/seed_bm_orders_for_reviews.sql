-- ===========================================================================
-- Benefit Market — Заказы под существующие отзывы BeneFit Studio
-- ===========================================================================
-- Для каждого отзыва на оффер BeneFit Studio (без привязки к заказу) создаёт
-- оплаченный заказ + order_item, и привязывает отзыв к этому заказу.
--
-- Идемпотентно: WHERE r.order_id IS NULL отсеивает уже-связанные отзывы.
-- Никакие отзывы не удаляются.
--
-- ВАЖНО: НЕ изменяет балансы кошельков и не пишет в point_ledger,
-- иначе кошельки сотрудников ушли бы в минус. Это демо-данные для UI-метрик.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $bm_orders$
DECLARE
  _tenant_id      uuid;
  _bm_provider_id uuid;
  _hr_owner       uuid;
  rev_rec         record;
  _order_id       uuid;
  _to_id          uuid;
  _idx            int := 0;
  _orders_added   int := 0;
  _items_added    int := 0;
  _reviews_linked int := 0;
  _row_count      int;
BEGIN
  SELECT id INTO _tenant_id FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO _bm_provider_id FROM providers WHERE slug = 'benefit-studio';
  IF _bm_provider_id IS NULL THEN
    RAISE EXCEPTION 'BeneFit Studio не найден';
  END IF;

  SELECT id INTO _hr_owner FROM users
   WHERE tenant_id = _tenant_id ORDER BY created_at ASC LIMIT 1;

  -- Гарантируем, что каждый оффер BeneFit Studio с отзывами есть в tenant_offerings.
  -- Это нужно для CHECK constraint на order_items (требуется tenant_offering_id).
  INSERT INTO tenant_offerings (tenant_id, provider_offering_id, is_active, enabled_by, enabled_at)
  SELECT _tenant_id, po.id, true, _hr_owner, NOW()
  FROM provider_offerings po
  WHERE po.provider_id = _bm_provider_id
    AND EXISTS (SELECT 1 FROM reviews r WHERE r.provider_offering_id = po.id)
  ON CONFLICT (tenant_id, provider_offering_id) DO NOTHING;

  -- Создаём по одному paid-заказу на каждый review без order_id
  FOR rev_rec IN
    SELECT r.id AS review_id, r.user_id, r.provider_offering_id,
           po.base_price_points, po.name AS offering_name
    FROM reviews r
    JOIN provider_offerings po ON po.id = r.provider_offering_id
    WHERE po.provider_id = _bm_provider_id
      AND r.order_id IS NULL
    ORDER BY r.created_at, r.id
  LOOP
    _idx := _idx + 1;
    _order_id := ('c0000000-0000-4000-8000-' || lpad(to_hex(_idx), 12, '0'))::uuid;

    SELECT id INTO _to_id FROM tenant_offerings
    WHERE tenant_id = _tenant_id AND provider_offering_id = rev_rec.provider_offering_id;

    CONTINUE WHEN _to_id IS NULL;  -- защита от редкого race-case

    -- Order
    INSERT INTO orders (id, user_id, tenant_id, status, total_points, reserved_at, expires_at, created_at)
    VALUES (
      _order_id, rev_rec.user_id, _tenant_id,
      'paid'::order_status, rev_rec.base_price_points,
      NOW() - ((30 + (_idx * 3) % 180) || ' days')::interval,
      NOW() - ((30 + (_idx * 3) % 180) || ' days')::interval + INTERVAL '15 minutes',
      NOW() - ((30 + (_idx * 3) % 180) || ' days')::interval
    )
    ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS _row_count = ROW_COUNT;
    _orders_added := _orders_added + _row_count;

    -- Order item (CHECK constraint: tenant_offering_id IS NOT NULL OR benefit_id IS NOT NULL)
    INSERT INTO order_items (order_id, tenant_offering_id, provider_offering_id, quantity, price_points)
    SELECT _order_id, _to_id, rev_rec.provider_offering_id, 1, rev_rec.base_price_points
    WHERE NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = _order_id);
    GET DIAGNOSTICS _row_count = ROW_COUNT;
    _items_added := _items_added + _row_count;

    -- Link review to order
    UPDATE reviews SET order_id = _order_id, updated_at = NOW()
    WHERE id = rev_rec.review_id AND order_id IS NULL;
    GET DIAGNOSTICS _row_count = ROW_COUNT;
    _reviews_linked := _reviews_linked + _row_count;
  END LOOP;

  RAISE NOTICE '======================================';
  RAISE NOTICE 'Заказов создано: %', _orders_added;
  RAISE NOTICE 'Order items создано: %', _items_added;
  RAISE NOTICE 'Отзывов привязано к заказам: %', _reviews_linked;
  RAISE NOTICE '======================================';

  -- Итоговая статистика
  FOR rev_rec IN
    SELECT po.name, po.status,
           (SELECT count(*) FROM reviews r WHERE r.provider_offering_id = po.id) AS review_count,
           (SELECT count(*) FROM order_items oi WHERE oi.provider_offering_id = po.id) AS order_count
    FROM provider_offerings po
    WHERE po.provider_id = _bm_provider_id
    ORDER BY po.status, po.name
  LOOP
    RAISE NOTICE 'BS: % | %: % отзывов, % заказов',
      rev_rec.name, rev_rec.status, rev_rec.review_count, rev_rec.order_count;
  END LOOP;
END $bm_orders$;
