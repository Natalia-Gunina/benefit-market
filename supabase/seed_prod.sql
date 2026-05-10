-- ===========================================================================
-- Production marketplace seed
-- ===========================================================================
-- Наполняет реальную базу провайдерами и каталогом льгот, подключёнными
-- к первому tenant'у. Справочные данные (tenants, global_categories,
-- benefit_categories, budget_policies) НЕ создаются — предполагается,
-- что они уже есть.
--
-- Все вставки выполняются через lookup по уникальным полям (slug, name),
-- поэтому скрипт безопасно запускать повторно: уже существующие
-- провайдеры и льготы пропускаются.
--
-- Требуется хотя бы один пользователь в public.users — он становится
-- owner_user_id для всех создаваемых провайдеров. Если пользователей
-- ещё нет, скрипт тихо завершается с уведомлением.
-- ===========================================================================

DO $$
DECLARE
  _tenant_id  uuid;
  _owner_id   uuid;

  -- Resolved category ids (NULL если соответствующего глобального справочника нет)
  _cat_health     uuid;
  _cat_education  uuid;
  _cat_sport      uuid;
  _cat_food       uuid;

  -- Resolved provider ids
  _provider_world_class uuid;
  _provider_skillbox    uuid;
  _provider_medsi       uuid;
  _provider_lavka       uuid;

  -- Resolved offering ids (для tenant_offerings ниже)
  _po_wc_year         uuid;
  _po_wc_pool         uuid;
  _po_wc_trainer      uuid;
  _po_sb_python       uuid;
  _po_sb_ux           uuid;
  _po_medsi_dms       uuid;
  _po_medsi_psy       uuid;
  _po_lavka_sub       uuid;
BEGIN
  -- ---------------------------------------------------------------------
  -- 0. Resolve dependencies
  -- ---------------------------------------------------------------------

  SELECT id INTO _tenant_id
  FROM tenants
  WHERE id != '00000000-0000-0000-0000-000000000000'
  ORDER BY created_at ASC
  LIMIT 1;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found. Create a tenant first (or run base setup).';
  END IF;

  SELECT id INTO _owner_id FROM users
  WHERE tenant_id = _tenant_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF _owner_id IS NULL THEN
    RAISE NOTICE 'No users in tenant yet. Sign up at least once and re-run this seed.';
    RETURN;
  END IF;

  SELECT id INTO _cat_health    FROM global_categories WHERE name = 'Здоровье';
  SELECT id INTO _cat_education FROM global_categories WHERE name = 'Образование';
  SELECT id INTO _cat_sport     FROM global_categories WHERE name = 'Спорт';
  SELECT id INTO _cat_food      FROM global_categories WHERE name = 'Питание';

  RAISE NOTICE 'Tenant: %, owner: %', _tenant_id, _owner_id;

  -- ---------------------------------------------------------------------
  -- 1. Providers (lookup by slug — UNIQUE)
  -- ---------------------------------------------------------------------

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, address)
  VALUES (_owner_id, 'World Class', 'world-class',
          'Сеть премиальных фитнес-клубов', 'verified',
          'partners@worldclass.ru', 'https://worldclass.ru', 'Москва')
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _provider_world_class FROM providers WHERE slug = 'world-class';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website)
  VALUES (_owner_id, 'Skillbox', 'skillbox',
          'Онлайн-университет современных профессий', 'verified',
          'b2b@skillbox.ru', 'https://skillbox.ru')
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _provider_skillbox FROM providers WHERE slug = 'skillbox';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, address)
  VALUES (_owner_id, 'Медси', 'medsi',
          'Сеть многопрофильных клиник', 'verified',
          'corporate@medsi.ru', 'https://medsi.ru', 'Москва')
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _provider_medsi FROM providers WHERE slug = 'medsi';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website)
  VALUES (_owner_id, 'Яндекс Лавка', 'yandex-lavka',
          'Сервис экспресс-доставки продуктов', 'pending',
          'b2b@lavka.yandex.ru', 'https://lavka.yandex.ru')
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _provider_lavka FROM providers WHERE slug = 'yandex-lavka';

  -- ---------------------------------------------------------------------
  -- 2. Provider offerings (без UNIQUE; используем (provider_id, name) lookup)
  -- ---------------------------------------------------------------------

  -- Helper: пропускаем INSERT если оффер с таким же name уже есть у этого провайдера.

  -- World Class
  SELECT id INTO _po_wc_year FROM provider_offerings
   WHERE provider_id = _provider_world_class AND name = 'Годовой абонемент World Class';
  IF _po_wc_year IS NULL THEN
    INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, delivery_info, terms_conditions, avg_rating, review_count)
    VALUES (_provider_world_class, _cat_sport,
      'Годовой абонемент World Class',
      'Безлимитное посещение всех клубов сети. Тренажёрный зал, групповые занятия, SPA.',
      'Годовой абонемент включает безлимитное посещение всех клубов сети World Class в вашем городе.',
      24000, 'published', 'Активация в любом клубе по паспорту', 'Абонемент именной', 4.7, 12)
    RETURNING id INTO _po_wc_year;
  END IF;

  SELECT id INTO _po_wc_pool FROM provider_offerings
   WHERE provider_id = _provider_world_class AND name = 'Абонемент в бассейн';
  IF _po_wc_pool IS NULL THEN
    INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, delivery_info, avg_rating, review_count)
    VALUES (_provider_world_class, _cat_sport,
      'Абонемент в бассейн',
      'Посещение бассейна 3 раза в неделю.',
      'Абонемент на 3 посещения бассейна в неделю в любом клубе World Class с бассейном.',
      12000, 'published', 'Активация в клубе', 4.5, 8)
    RETURNING id INTO _po_wc_pool;
  END IF;

  SELECT id INTO _po_wc_trainer FROM provider_offerings
   WHERE provider_id = _provider_world_class AND name = 'Персональный тренер (8 занятий)';
  IF _po_wc_trainer IS NULL THEN
    INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, delivery_info, terms_conditions)
    VALUES (_provider_world_class, _cat_sport,
      'Персональный тренер (8 занятий)',
      'Индивидуальные тренировки с сертифицированным тренером.',
      'Индивидуальные тренировки, составление программы, контроль техники.',
      16000, 'pending_review', 'Первая тренировка — после согласования', 'Срок использования — 4 месяца')
    RETURNING id INTO _po_wc_trainer;
  END IF;

  -- Skillbox
  SELECT id INTO _po_sb_python FROM provider_offerings
   WHERE provider_id = _provider_skillbox AND name = 'Курс Python-разработчик';
  IF _po_sb_python IS NULL THEN
    INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, delivery_info, terms_conditions, avg_rating, review_count)
    VALUES (_provider_skillbox, _cat_education,
      'Курс Python-разработчик',
      'Полный курс по Python от нуля до Middle. 9 месяцев.',
      'Основы Python, веб-разработка, БД, Docker, CI/CD. 12 проектов для портфолио.',
      15000, 'published', 'Доступ к платформе в течение 24 часов', 'Доступ к материалам — навсегда', 4.4, 23)
    RETURNING id INTO _po_sb_python;
  END IF;

  SELECT id INTO _po_sb_ux FROM provider_offerings
   WHERE provider_id = _provider_skillbox AND name = 'Курс UX/UI-дизайн';
  IF _po_sb_ux IS NULL THEN
    INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, delivery_info, avg_rating, review_count)
    VALUES (_provider_skillbox, _cat_education,
      'Курс UX/UI-дизайн',
      'Станьте дизайнером за 6 месяцев. Figma, исследования, прототипы.',
      'Figma, исследования пользователей, проектирование интерфейсов, дизайн-системы.',
      12000, 'published', 'Доступ к платформе в течение 24 часов', 4.3, 15)
    RETURNING id INTO _po_sb_ux;
  END IF;

  -- Медси
  SELECT id INTO _po_medsi_dms FROM provider_offerings
   WHERE provider_id = _provider_medsi AND name = 'ДМС расширенный';
  IF _po_medsi_dms IS NULL THEN
    INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, delivery_info, terms_conditions, avg_rating, review_count)
    VALUES (_provider_medsi, _cat_health,
      'ДМС расширенный',
      'Полис ДМС с амбулаторным и стационарным обслуживанием в клиниках Медси.',
      'Расширенная программа ДМС: амбулаторное обслуживание, стационар, диагностика.',
      30000, 'published', 'Полис оформляется за 3 рабочих дня', 'Срок действия — 1 год', 4.6, 31)
    RETURNING id INTO _po_medsi_dms;
  END IF;

  SELECT id INTO _po_medsi_psy FROM provider_offerings
   WHERE provider_id = _provider_medsi AND name = 'Психолог онлайн (4 сессии)';
  IF _po_medsi_psy IS NULL THEN
    INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, delivery_info, terms_conditions, avg_rating, review_count)
    VALUES (_provider_medsi, _cat_health,
      'Психолог онлайн (4 сессии)',
      '4 индивидуальные сессии с лицензированным психологом.',
      '4 сессии по 50 минут, видеозвонок или чат. Полная конфиденциальность.',
      5000, 'published', 'Запись на первую сессию — в течение 1 дня', '3 месяца на использование', 4.8, 9)
    RETURNING id INTO _po_medsi_psy;
  END IF;

  -- Яндекс Лавка
  SELECT id INTO _po_lavka_sub FROM provider_offerings
   WHERE provider_id = _provider_lavka AND name = 'Подписка на доставку';
  IF _po_lavka_sub IS NULL THEN
    INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, delivery_info)
    VALUES (_provider_lavka, _cat_food,
      'Подписка на доставку',
      'Годовая подписка Яндекс Лавка.',
      'Бесплатная доставка от 500₽, скидки до 20% на популярные товары.',
      6000, 'pending_review', 'Активация через приложение')
    RETURNING id INTO _po_lavka_sub;
  END IF;

  -- ---------------------------------------------------------------------
  -- 3. Tenant offerings — что компания подключила в свой каталог
  -- ---------------------------------------------------------------------

  INSERT INTO tenant_offerings (tenant_id, provider_offering_id, custom_price_points, is_active, enabled_by, tenant_avg_rating, tenant_review_count)
  VALUES
    (_tenant_id, _po_wc_year,    20000, true, _owner_id, 4.8, 3),
    (_tenant_id, _po_wc_pool,    NULL,  true, _owner_id, 4.5, 1),
    (_tenant_id, _po_sb_python,  NULL,  true, _owner_id, 4.0, 1),
    (_tenant_id, _po_sb_ux,      NULL,  true, _owner_id, 4.3, 2),
    (_tenant_id, _po_medsi_dms,  25000, true, _owner_id, 4.5, 1),
    (_tenant_id, _po_medsi_psy,  NULL,  true, _owner_id, 5.0, 1)
  ON CONFLICT (tenant_id, provider_offering_id) DO NOTHING;

  RAISE NOTICE 'Marketplace seed completed.';
END $$;
