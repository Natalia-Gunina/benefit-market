-- ===========================================================================
-- Benefit Market — правка каталога v2 (согласовано с заказчиком)
-- ===========================================================================
-- Что делает (всё идемпотентно):
--   1) Скрывает из каталога 5 льгот (tenant_offerings.is_active = false):
--      - Чекап ИНВИТРО Premium
--      - Coursera Plus подписка (год)
--      - Курс тест (EduTech Pro)
--      - Подписка FitMost 8 баллов/мес (год)
--      - Сертификат Aviasales 25 000
--   2) Правит цены:
--      - Сертификат Островок: 30 000 → 15 000
--      - Сертификат на детский лагерь: 50 000 → 20 000
--   3) Переименование (убираем баллы из имён):
--      - Aviasales 10 000 → Сертификат Aviasales
--      - Hello Pets 4 000 → Сертификат Hello Pets
--      - Самокат 5 000 → Сертификат Самокат
--      - Островок 30 000 → Сертификат Островок
--      - Skillbox 30 000 → Сертификат Skillbox
--      - Яндекс Афиша 5 000 → Сертификат Яндекс Афиша
--      - Корпоративное такси (5 000 ₽) → Корпоративное такси
--      - Муж на час (3 визита) → Помощь в мелком ремонте дома (+ новое описание)
--   4) Добавляет 4 новые льготы:
--      - Абонемент в студию танцев (La Salsa Dance Studio, Спорт, 6500)
--      - Сертификат в бассейн (Чайка, Спорт, 5000)
--      - Сертификат в банный комплекс (Сила пара, Красота, 8000)
--      - Сертификат в аптеку (Аптека 36.6, Здоровье, 3500)
-- ===========================================================================

DO $catalog_v2$
DECLARE
  _main_tenant uuid;
  _hr_owner    uuid;

  _cat_sport   uuid;
  _cat_beauty  uuid;
  _cat_health  uuid;

  _prov_dance     uuid;
  _prov_pool      uuid;
  _prov_banya     uuid;
  _prov_pharmacy  uuid;

  _po_id uuid;

  _updated int;
  _hidden  int := 0;
BEGIN
  SELECT id INTO _main_tenant FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  IF _main_tenant IS NULL THEN
    RAISE EXCEPTION 'Основной тенант не найден';
  END IF;

  SELECT id INTO _hr_owner FROM users WHERE tenant_id = _main_tenant ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO _cat_sport  FROM global_categories WHERE name = 'Спорт';
  SELECT id INTO _cat_beauty FROM global_categories WHERE name = 'Красота';
  SELECT id INTO _cat_health FROM global_categories WHERE name = 'Здоровье';

  ---------------------------------------------------------------------------
  -- 1) Скрываем 5 льгот из каталога (только в основном тенанте)
  ---------------------------------------------------------------------------
  UPDATE tenant_offerings t
  SET is_active = false
  WHERE t.tenant_id = _main_tenant
    AND t.provider_offering_id IN (
      SELECT po.id FROM provider_offerings po
      WHERE po.name IN (
        'Чекап ИНВИТРО Premium',
        'Coursera Plus подписка (год)',
        'Курс тест',
        'Подписка FitMost 8 баллов/мес (год)',
        'Сертификат Aviasales 25 000'
      )
    );
  GET DIAGNOSTICS _hidden = ROW_COUNT;
  RAISE NOTICE '1) Скрыто из каталога: % льгот', _hidden;

  ---------------------------------------------------------------------------
  -- 2) Правка цен (base_price_points)
  ---------------------------------------------------------------------------
  UPDATE provider_offerings
  SET base_price_points = 15000
  WHERE name = 'Сертификат Островок 30 000';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE '2a) Островок 30000→15000: % обновлений', _updated;

  UPDATE provider_offerings
  SET base_price_points = 20000
  WHERE name = 'Сертификат на детский лагерь (смена)';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE '2b) Детский лагерь 50000→20000: % обновлений', _updated;

  ---------------------------------------------------------------------------
  -- 3) Переименование
  ---------------------------------------------------------------------------
  UPDATE provider_offerings SET name = 'Сертификат Aviasales'
   WHERE name = 'Сертификат Aviasales 10 000';
  UPDATE provider_offerings SET name = 'Сертификат Hello Pets'
   WHERE name = 'Сертификат Hello Pets 4 000';
  UPDATE provider_offerings SET name = 'Сертификат Самокат'
   WHERE name = 'Сертификат Самокат 5 000';
  UPDATE provider_offerings SET name = 'Сертификат Островок'
   WHERE name = 'Сертификат Островок 30 000';
  UPDATE provider_offerings SET name = 'Сертификат Skillbox'
   WHERE name = 'Сертификат Skillbox 30 000';
  UPDATE provider_offerings SET name = 'Сертификат Яндекс Афиша'
   WHERE name = 'Сертификат Яндекс Афиша 5 000';
  UPDATE provider_offerings SET name = 'Корпоративное такси'
   WHERE name IN ('Корпоративное такси (5 000 ₽)');

  -- Муж на час → Помощь в мелком ремонте дома (+ новое description)
  UPDATE provider_offerings
  SET name = 'Помощь в мелком ремонте дома',
      description = 'Услуги мастера для мелкого бытового ремонта: сборка мебели, замена розеток/выключателей, мелкий сантехнический ремонт, навеска полок и картин.',
      long_description = 'Услуги мастера для мелкого бытового ремонта дома. Сборка мебели, замена розеток / выключателей, мелкий ремонт сантехники, навеска полок, картин, замена крана. До 2 часов на визит.',
      terms_conditions = 'Срок действия 6 месяцев'
   WHERE name = 'Муж на час (3 визита)';

  RAISE NOTICE '3) Переименования выполнены';

  ---------------------------------------------------------------------------
  -- 4) Добавляем 4 новые льготы
  ---------------------------------------------------------------------------

  -- 4a) La Salsa Dance Studio
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner, 'La Salsa Dance Studio', 'la-salsa-dance',
    'Школа танцев в Москве и Санкт-Петербурге. Сальса, бачата, аргентинское танго, kizomba, контемпорари. Группы для взрослых любого уровня.',
    'verified', 'corp@la-salsa.ru', 'https://la-salsa.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_dance FROM providers WHERE slug = 'la-salsa-dance';

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_dance, _cat_sport, 'Абонемент в студию танцев (8 занятий)',
    'Абонемент на 8 занятий в студии танцев. Сальса, бачата, контемпорари, аргентинское танго — на выбор.',
    'Абонемент на 8 занятий в студии La Salsa Dance Studio. Группы для взрослых любого уровня. Расписание онлайн, занятия идут утром, днём и вечером. Можно ходить на разные направления в рамках одного абонемента.',
    6500, 'published'::offering_status, 'offline'::offering_format,
    ARRAY['Москва','Санкт-Петербург'],
    'Запись через сайт студии',
    'Срок действия абонемента 3 месяца',
    4.7, 14
  WHERE NOT EXISTS (
    SELECT 1 FROM provider_offerings
    WHERE provider_id = _prov_dance AND name = 'Абонемент в студию танцев (8 занятий)'
  );

  SELECT id INTO _po_id FROM provider_offerings
   WHERE provider_id = _prov_dance AND name = 'Абонемент в студию танцев (8 занятий)';
  INSERT INTO tenant_offerings (tenant_id, provider_offering_id, custom_price_points, is_active, enabled_by, enabled_at)
  VALUES (_main_tenant, _po_id, NULL, true, _hr_owner, NOW())
  ON CONFLICT (tenant_id, provider_offering_id) DO NOTHING;

  -- 4b) Чайка (бассейн)
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner, 'Чайка', 'chaika-pool',
    'Сеть открытых и закрытых бассейнов в Москве и регионах. Профессиональные дорожки, тренеры, аквааэробика.',
    'verified', 'corp@chaika-pool.ru', 'https://chaika-pool.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_pool FROM providers WHERE slug = 'chaika-pool';

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_pool, _cat_sport, 'Сертификат в бассейн (10 посещений)',
    'Сертификат на 10 посещений бассейна. Свободное плавание или групповые занятия.',
    'Сертификат на 10 посещений бассейна «Чайка». Можно использовать на свободное плавание или групповые занятия аквааэробикой и плаванием. Длина дорожек 25/50 м.',
    5000, 'published'::offering_status, 'offline'::offering_format,
    ARRAY['Москва','Санкт-Петербург','Казань','Екатеринбург'],
    'Запись через клубное приложение',
    'Срок действия 6 месяцев',
    4.6, 22
  WHERE NOT EXISTS (
    SELECT 1 FROM provider_offerings
    WHERE provider_id = _prov_pool AND name = 'Сертификат в бассейн (10 посещений)'
  );

  SELECT id INTO _po_id FROM provider_offerings
   WHERE provider_id = _prov_pool AND name = 'Сертификат в бассейн (10 посещений)';
  INSERT INTO tenant_offerings (tenant_id, provider_offering_id, custom_price_points, is_active, enabled_by, enabled_at)
  VALUES (_main_tenant, _po_id, NULL, true, _hr_owner, NOW())
  ON CONFLICT (tenant_id, provider_offering_id) DO NOTHING;

  -- 4c) Сила пара (банный комплекс)
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner, 'Сила пара', 'sila-para',
    'Современный банный комплекс: русская парная, финская сауна, хаммам, бассейн, чайная комната. Премиум-формат.',
    'verified', 'b2b@silapara.ru', 'https://silapara.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_banya FROM providers WHERE slug = 'sila-para';

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_banya, _cat_beauty, 'Сертификат в банный комплекс',
    'Сертификат на посещение банного комплекса: русская парная, финская сауна, хаммам, бассейн.',
    'Сертификат на 3 часа в банном комплексе «Сила пара». Русская парная на дровах, финская сауна, турецкий хаммам, бассейн, чайная комната. Полотенце и тапочки включены.',
    8000, 'published'::offering_status, 'offline'::offering_format,
    ARRAY['Москва','Санкт-Петербург'],
    'Запись через приложение / сайт',
    'Срок действия 6 месяцев. По будням и выходным.',
    4.8, 11
  WHERE NOT EXISTS (
    SELECT 1 FROM provider_offerings
    WHERE provider_id = _prov_banya AND name = 'Сертификат в банный комплекс'
  );

  SELECT id INTO _po_id FROM provider_offerings
   WHERE provider_id = _prov_banya AND name = 'Сертификат в банный комплекс';
  INSERT INTO tenant_offerings (tenant_id, provider_offering_id, custom_price_points, is_active, enabled_by, enabled_at)
  VALUES (_main_tenant, _po_id, NULL, true, _hr_owner, NOW())
  ON CONFLICT (tenant_id, provider_offering_id) DO NOTHING;

  -- 4d) Аптека 36.6
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner, 'Аптека 36.6', 'apteka-36-6',
    'Сеть аптек по всей России. Лекарства, БАДы, медицинская техника, ортопедия, товары для здоровья и красоты.',
    'verified', 'b2b@366.ru', 'https://366.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_pharmacy FROM providers WHERE slug = 'apteka-36-6';

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_pharmacy, _cat_health, 'Сертификат в аптеку',
    'Сертификат на покупку лекарств, БАДов и товаров для здоровья в аптеках сети.',
    'Сертификат на покупку в аптеках «36.6». Можно потратить на лекарства, БАДы, медицинскую технику, ортопедию, товары для здоровья и красоты. Действует во всех точках сети и в онлайн-аптеке.',
    3500, 'published'::offering_status, 'offline'::offering_format,
    ARRAY['Москва','Санкт-Петербург','Казань','Новосибирск','Екатеринбург'],
    'Активация в личном кабинете',
    'Срок действия 12 месяцев',
    4.5, 28
  WHERE NOT EXISTS (
    SELECT 1 FROM provider_offerings
    WHERE provider_id = _prov_pharmacy AND name = 'Сертификат в аптеку'
  );

  SELECT id INTO _po_id FROM provider_offerings
   WHERE provider_id = _prov_pharmacy AND name = 'Сертификат в аптеку';
  INSERT INTO tenant_offerings (tenant_id, provider_offering_id, custom_price_points, is_active, enabled_by, enabled_at)
  VALUES (_main_tenant, _po_id, NULL, true, _hr_owner, NOW())
  ON CONFLICT (tenant_id, provider_offering_id) DO NOTHING;

  RAISE NOTICE '4) Добавлено 4 новые льготы';
  RAISE NOTICE 'Итог: активных льгот в каталоге = %',
    (SELECT count(*) FROM tenant_offerings t
       JOIN provider_offerings po ON po.id = t.provider_offering_id
      WHERE t.tenant_id = _main_tenant
        AND t.is_active = true
        AND po.status = 'published');
END $catalog_v2$;
