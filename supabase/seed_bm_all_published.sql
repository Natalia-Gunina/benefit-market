-- ===========================================================================
-- Benefit Market — Отзывы ко ВСЕМ published-льготам BeneFit Studio
-- ===========================================================================
-- Автоматически находит каждый published-оффер у провайдера BeneFit Studio
-- и добавляет к нему до 15 отзывов от разных пользователей тенанта.
--
-- UNIQUE (user_id, provider_offering_id) защищает от дублей.
-- Идемпотентно: повторный запуск ничего не сломает.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $bm_all$
DECLARE
  _tenant_id      uuid;
  _bm_provider_id uuid;
  off_rec         record;
  _inserted_total int := 0;
  _inserted_off   int;
  _user_pool      uuid[];
  _user_count     int;
  _u              uuid;
  _i              int;
  _row_count      int;
  _rating         int;
  _title          text;
  _body           text;
  _titles         text[] := ARRAY[
    'Стоит своих баллов', 'Хороший опыт', 'Использую регулярно', 'Подходит для повседневности',
    'Рекомендую коллегам', 'Удобно и быстро', 'Команда довольна', 'Полезный формат',
    'Своих денег стоит', 'Беру повторно', 'Сэкономил время', 'Поставлю плюс'
  ];
  _bodies         text[] := ARRAY[
    'Получил то, что ожидал. Удобно оформляется и активируется без задержек.',
    'Качество сервиса соответствует описанию. Сроки активации совпали с моими ожиданиями.',
    'Использовал несколько раз — каждый раз без нареканий. Поддержка отвечает быстро.',
    'Хорошее соотношение цены и качества по сравнению с покупкой напрямую.',
    'Уже посоветовал коллегам. Простой процесс активации и понятный UX.',
    'Сервис работает чётко: оформил — получил — пользуюсь. Никаких сюрпризов.',
    'Подключился без проблем. Куратор на связи, всё прозрачно.',
    'Хороший формат для команды. Берём и индивидуально, и пакетно — оба варианта работают.',
    'После использования — заметный эффект. Возвращаюсь периодически.',
    'Удобно, что есть варианты — выбрала под свой график без проблем.',
    'Сначала сомневался, но результат превзошёл ожидания. Берём ещё раз.',
    'Решает задачу. Без лишних шагов и непонятных условий.'
  ];
BEGIN
  SELECT id INTO _tenant_id FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO _bm_provider_id FROM providers WHERE slug = 'benefit-studio';

  IF _bm_provider_id IS NULL THEN
    RAISE EXCEPTION 'BeneFit Studio (slug=benefit-studio) не найден';
  END IF;

  -- Пул юзеров: все сотрудники основного тенанта
  SELECT array_agg(id ORDER BY id) INTO _user_pool
  FROM users
  WHERE tenant_id = _tenant_id AND role = 'employee'::user_role;

  _user_count := COALESCE(array_length(_user_pool, 1), 0);
  RAISE NOTICE 'Найдено сотрудников в тенанте: %', _user_count;

  -- Цикл по каждому published-офферу BeneFit Studio
  FOR off_rec IN
    SELECT id, name FROM provider_offerings
    WHERE provider_id = _bm_provider_id
      AND status = 'published'::offering_status
    ORDER BY name
  LOOP
    _inserted_off := 0;
    RAISE NOTICE '--- Обрабатываю оффер: %', off_rec.name;

    -- До 15 отзывов от разных пользователей
    FOR _i IN 1..LEAST(15, _user_count) LOOP
      _u := _user_pool[_i];

      _rating := CASE (_i % 10)
                   WHEN 0 THEN 3 WHEN 1 THEN 3
                   WHEN 2 THEN 4 WHEN 3 THEN 4
                   ELSE 5
                 END;
      _title := _titles[1 + (_i % 12)];
      _body  := _bodies[1 + (_i % 12)];

      INSERT INTO reviews (provider_offering_id, tenant_id, user_id, rating, title, body, status, created_at, updated_at)
      SELECT off_rec.id, _tenant_id, _u, _rating, _title, _body,
             'visible'::review_status,
             NOW() - ((3 + (_i * 7) % 120) || ' days')::interval,
             NOW() - ((3 + (_i * 7) % 120) || ' days')::interval
      WHERE NOT EXISTS (
        SELECT 1 FROM reviews WHERE user_id = _u AND provider_offering_id = off_rec.id
      );

      GET DIAGNOSTICS _row_count = ROW_COUNT;
      _inserted_off := _inserted_off + _row_count;
    END LOOP;

    _inserted_total := _inserted_total + _inserted_off;
    RAISE NOTICE '    добавлено отзывов: %', _inserted_off;
  END LOOP;

  RAISE NOTICE '======================================';
  RAISE NOTICE 'Всего добавлено отзывов: %', _inserted_total;
  RAISE NOTICE '======================================';

  FOR off_rec IN
    SELECT name, status, avg_rating, review_count
    FROM provider_offerings
    WHERE provider_id = _bm_provider_id
    ORDER BY status, name
  LOOP
    RAISE NOTICE 'BS: % | status=% | avg=% | count=%',
      off_rec.name, off_rec.status, off_rec.avg_rating, off_rec.review_count;
  END LOOP;
END $bm_all$;
