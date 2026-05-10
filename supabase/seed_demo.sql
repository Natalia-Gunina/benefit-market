-- ===========================================================================
-- Benefit Market — Демо-сид для защиты диплома (4 роли × полная функциональность)
-- ===========================================================================
--
-- Создаёт «живую» демо-картину поверх миграций 00001..00009:
--   • 4 реальных auth-пользователя (по одному на роль) с паролями для логина
--   • Расширенный каталог категорий (13 шт) и провайдеров (~15)
--   • 30+ предложений (provider_offerings), покрывающих все 27 направлений
--     из ТЗ диплома: ДМС, фитнес, психотерапия, такси, путешествия, питомцы,
--     клининг, подписки, мастер-классы и т.д.
--   • Полные демо-данные на каждую роль:
--       - employee: профиль, оплаченные/зарезервированные заказы, отзывы
--       - hr:       сотрудники, бюджетные политики, активированные офферы
--       - admin:    провайдеры/офферы со статусом «pending» к одобрению, аудит-лог
--       - provider: своя компания «BeneFit Studio», 4 оффера в разных статусах,
--                   полученные заказы и отзывы
--
-- ВАЖНО: Файл не дублирует данные из seed.sql / seed_prod.sql, а ДОПОЛНЯЕТ их.
-- Все INSERT идемпотентны (ON CONFLICT DO NOTHING / lookup-by-unique-key),
-- так что повторный запуск безопасен.
--
-- ---------------------------------------------------------------------------
-- ДЕМО-АККАУНТЫ для логина (все с паролем «Demo123!»)
-- ---------------------------------------------------------------------------
--   admin@bm.demo     — администратор платформы (ФИО: Алексей Сидоров)
--   hr@bm.demo        — HR компании (ФИО: Ольга Белова)
--   employee@bm.demo  — сотрудник (ФИО: Иван Козлов, грейд middle)
--   provider@bm.demo  — представитель провайдера BeneFit Studio (ФИО: Анна Партнёрова)
--
-- ---------------------------------------------------------------------------
-- КАК ЗАПУСТИТЬ:
-- ---------------------------------------------------------------------------
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed_demo.sql
--
-- Либо через GitHub Actions: workflow «DB seed» с file=seed_demo.sql.
-- Если SUPABASE_DB_URL не задан, скрипт упадёт с понятной ошибкой.
-- ===========================================================================

-- pgcrypto должен быть включён (Supabase делает это по умолчанию). Подстраховка:
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ===========================================================================
-- БЛОК 1. Каталог: категории, провайдеры, предложения
-- ===========================================================================

DO $seed$
DECLARE
  _tenant_id          uuid;
  _hr_owner_fallback  uuid;  -- любой существующий пользователь (для providers.owner_user_id)

  -- Глобальные категории
  _cat_health         uuid;
  _cat_education      uuid;
  _cat_sport          uuid;
  _cat_food           uuid;
  _cat_transport      uuid;
  _cat_entertainment  uuid;
  _cat_finance        uuid;
  _cat_beauty         uuid;
  _cat_family         uuid;
  _cat_subscriptions  uuid;
  _cat_pets           uuid;
  _cat_home           uuid;
  _cat_travel         uuid;

  -- Категории тенанта (для разделения каталога в кабинете сотрудника)
  _bcat_health        uuid;
  _bcat_sport         uuid;
  _bcat_education     uuid;
  _bcat_food          uuid;
  _bcat_leisure       uuid;
  _bcat_family        uuid;
  _bcat_subscriptions uuid;
  _bcat_home          uuid;
  _bcat_travel        uuid;
  _bcat_transport     uuid;
  _bcat_pets          uuid;

  -- Провайдеры (по slug)
  _prov_medsi         uuid;
  _prov_invitro       uuid;
  _prov_youtalk       uuid;
  _prov_spa           uuid;
  _prov_world_class   uuid;
  _prov_superfit      uuid;
  _prov_kidsport      uuid;
  _prov_skillbox      uuid;
  _prov_skyeng        uuid;
  _prov_kids_school   uuid;
  _prov_yandex_food   uuid;
  _prov_smartlunch    uuid;
  _prov_yandex_go     uuid;
  _prov_troika        uuid;
  _prov_ostrovok      uuid;
  _prov_yafisha       uuid;
  _prov_tasterly      uuid;
  _prov_kinder_world  uuid;
  _prov_kindergarten  uuid;
  _prov_litres        uuid;
  _prov_yamusic       uuid;
  _prov_kinopoisk     uuid;
  _prov_qlean         uuid;
  _prov_petstory      uuid;
  _prov_petshop       uuid;
BEGIN
  -- ---------- Tenant + fallback owner ----------
  SELECT id INTO _tenant_id FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  IF _tenant_id IS NULL THEN
    INSERT INTO tenants (id, name, domain, settings)
    VALUES (
      '00000000-0000-4000-8000-000000000001',
      'ООО Технологии Будущего',
      'techfuture.ru',
      '{"locale":"ru","currency_label":"баллы","branding":{"primary_color":"#2563EB"}}'::jsonb
    )
    RETURNING id INTO _tenant_id;
  END IF;

  SELECT id INTO _hr_owner_fallback FROM users
   WHERE tenant_id = _tenant_id ORDER BY created_at ASC LIMIT 1;

  IF _hr_owner_fallback IS NULL THEN
    -- Если нет ни одного пользователя — создадим заглушку.
    -- Реальные демо-юзеры с auth добавляются в БЛОКЕ 2.
    INSERT INTO users (id, tenant_id, auth_id, email, role, full_name)
    VALUES (
      gen_random_uuid(), _tenant_id,
      gen_random_uuid(), 'system@bm.demo', 'admin', 'System Bootstrap'
    )
    RETURNING id INTO _hr_owner_fallback;
  END IF;

  RAISE NOTICE 'Tenant: %, fallback owner: %', _tenant_id, _hr_owner_fallback;

  -- ---------- Глобальные категории (8 уже есть из 00004, добавляем 5 новых) ----------
  INSERT INTO global_categories (name, icon, sort_order, is_active) VALUES
    ('Семья и дети',          'baby',         9,  true),
    ('Подписки и сервисы',    'play-circle',  10, true),
    ('Питомцы',               'paw-print',    11, true),
    ('Дом и быт',             'home',         12, true),
    ('Путешествия',           'plane',        13, true)
  ON CONFLICT (name) DO NOTHING;

  -- Resolve все 13 категорий
  SELECT id INTO _cat_health        FROM global_categories WHERE name = 'Здоровье';
  SELECT id INTO _cat_education     FROM global_categories WHERE name = 'Образование';
  SELECT id INTO _cat_sport         FROM global_categories WHERE name = 'Спорт';
  SELECT id INTO _cat_food          FROM global_categories WHERE name = 'Питание';
  SELECT id INTO _cat_transport     FROM global_categories WHERE name = 'Транспорт';
  SELECT id INTO _cat_entertainment FROM global_categories WHERE name = 'Развлечения';
  SELECT id INTO _cat_finance       FROM global_categories WHERE name = 'Финансы';
  SELECT id INTO _cat_beauty        FROM global_categories WHERE name = 'Красота';
  SELECT id INTO _cat_family        FROM global_categories WHERE name = 'Семья и дети';
  SELECT id INTO _cat_subscriptions FROM global_categories WHERE name = 'Подписки и сервисы';
  SELECT id INTO _cat_pets          FROM global_categories WHERE name = 'Питомцы';
  SELECT id INTO _cat_home          FROM global_categories WHERE name = 'Дом и быт';
  SELECT id INTO _cat_travel        FROM global_categories WHERE name = 'Путешествия';

  -- ---------- Категории внутри тенанта (для каталога льгот) ----------
  -- Используем lookup-by-name. seed.sql уже создал 5 первых категорий.
  SELECT id INTO _bcat_health    FROM benefit_categories WHERE tenant_id = _tenant_id AND name = 'Здоровье';
  SELECT id INTO _bcat_sport     FROM benefit_categories WHERE tenant_id = _tenant_id AND name = 'Спорт';
  SELECT id INTO _bcat_education FROM benefit_categories WHERE tenant_id = _tenant_id AND name IN ('Обучение','Образование');
  SELECT id INTO _bcat_food      FROM benefit_categories WHERE tenant_id = _tenant_id AND name = 'Питание';
  SELECT id INTO _bcat_leisure   FROM benefit_categories WHERE tenant_id = _tenant_id AND name IN ('Отдых','Развлечения');

  -- Создаём те, которых ещё нет
  IF _bcat_health IS NULL THEN
    INSERT INTO benefit_categories (tenant_id, name, icon, sort_order, global_category_id)
    VALUES (_tenant_id, 'Здоровье', 'heart-pulse', 1, _cat_health)
    RETURNING id INTO _bcat_health;
  END IF;

  IF _bcat_sport IS NULL THEN
    INSERT INTO benefit_categories (tenant_id, name, icon, sort_order, global_category_id)
    VALUES (_tenant_id, 'Спорт', 'dumbbell', 2, _cat_sport)
    RETURNING id INTO _bcat_sport;
  END IF;

  IF _bcat_education IS NULL THEN
    INSERT INTO benefit_categories (tenant_id, name, icon, sort_order, global_category_id)
    VALUES (_tenant_id, 'Образование', 'graduation-cap', 3, _cat_education)
    RETURNING id INTO _bcat_education;
  END IF;

  IF _bcat_food IS NULL THEN
    INSERT INTO benefit_categories (tenant_id, name, icon, sort_order, global_category_id)
    VALUES (_tenant_id, 'Питание', 'utensils', 4, _cat_food)
    RETURNING id INTO _bcat_food;
  END IF;

  IF _bcat_leisure IS NULL THEN
    INSERT INTO benefit_categories (tenant_id, name, icon, sort_order, global_category_id)
    VALUES (_tenant_id, 'Развлечения', 'sparkles', 5, _cat_entertainment)
    RETURNING id INTO _bcat_leisure;
  END IF;

  INSERT INTO benefit_categories (tenant_id, name, icon, sort_order, global_category_id)
  VALUES
    (_tenant_id, 'Транспорт',         'car',          6, _cat_transport),
    (_tenant_id, 'Путешествия',       'plane',        7, _cat_travel),
    (_tenant_id, 'Семья и дети',      'baby',         8, _cat_family),
    (_tenant_id, 'Подписки',          'play-circle',  9, _cat_subscriptions),
    (_tenant_id, 'Дом и быт',         'home',         10, _cat_home),
    (_tenant_id, 'Питомцы',           'paw-print',    11, _cat_pets)
  ON CONFLICT DO NOTHING;

  SELECT id INTO _bcat_transport     FROM benefit_categories WHERE tenant_id = _tenant_id AND name = 'Транспорт';
  SELECT id INTO _bcat_travel        FROM benefit_categories WHERE tenant_id = _tenant_id AND name = 'Путешествия';
  SELECT id INTO _bcat_family        FROM benefit_categories WHERE tenant_id = _tenant_id AND name = 'Семья и дети';
  SELECT id INTO _bcat_subscriptions FROM benefit_categories WHERE tenant_id = _tenant_id AND name = 'Подписки';
  SELECT id INTO _bcat_home          FROM benefit_categories WHERE tenant_id = _tenant_id AND name = 'Дом и быт';
  SELECT id INTO _bcat_pets          FROM benefit_categories WHERE tenant_id = _tenant_id AND name = 'Питомцы';

  -- ---------- Провайдеры ----------
  -- Здоровье / медицина
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, address, verified_at)
  VALUES (_hr_owner_fallback, 'Медси', 'medsi-clinic',
          'Сеть многопрофильных клиник. ДМС стандарт и премиум, диагностика, врачи всех специальностей.',
          'verified', 'corporate@medsi.ru', 'https://medsi.ru', 'Москва', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_medsi FROM providers WHERE slug = 'medsi-clinic';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'ИНВИТРО', 'invitro',
          'Крупнейшая сеть медицинских лабораторий. Анализы, чекапы, МРТ, КТ, УЗИ.',
          'verified', 'b2b@invitro.ru', 'https://invitro.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_invitro FROM providers WHERE slug = 'invitro';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'YouTalk', 'youtalk',
          'Сервис онлайн-психотерапии. Видео-сессии с лицензированными психологами.',
          'verified', 'business@youtalk.ru', 'https://youtalk.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_youtalk FROM providers WHERE slug = 'youtalk';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, address, verified_at)
  VALUES (_hr_owner_fallback, 'SPA Place', 'spa-place',
          'Сеть спа-салонов. Массаж, обёртывания, аромо- и стоунтерапия.',
          'verified', 'corp@spaplace.ru', 'https://spaplace.ru', 'Москва', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_spa FROM providers WHERE slug = 'spa-place';

  -- Спорт
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, address, verified_at)
  VALUES (_hr_owner_fallback, 'World Class', 'world-class',
          'Сеть премиальных фитнес-клубов. Тренажёрный зал, групповые программы, бассейн, SPA.',
          'verified', 'partners@worldclass.ru', 'https://worldclass.ru', 'Москва', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_world_class FROM providers WHERE slug = 'world-class';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'SuperFit App', 'superfit-app',
          'Мобильное приложение для домашних тренировок. Йога, силовые, кардио, медитации.',
          'verified', 'b2b@superfit.app', 'https://superfit.app', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_superfit FROM providers WHERE slug = 'superfit-app';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'KidSport', 'kidsport',
          'Детские спортивные секции: футбол, плавание, гимнастика, единоборства. От 4 до 14 лет.',
          'verified', 'partner@kidsport.ru', 'https://kidsport.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_kidsport FROM providers WHERE slug = 'kidsport';

  -- Образование
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Skillbox', 'skillbox',
          'Онлайн-университет современных профессий. IT, дизайн, маркетинг, менеджмент.',
          'verified', 'b2b@skillbox.ru', 'https://skillbox.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_skillbox FROM providers WHERE slug = 'skillbox';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Skyeng', 'skyeng',
          'Онлайн-школа английского языка №1 в России. Индивидуальные занятия с преподавателями.',
          'verified', 'corp@skyeng.ru', 'https://skyeng.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_skyeng FROM providers WHERE slug = 'skyeng';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Алые паруса', 'alye-parusa-school',
          'Сеть детских развивающих центров. Кружки, секции, подготовка к школе.',
          'verified', 'partners@alyeparusa.ru', 'https://alyeparusa.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_kids_school FROM providers WHERE slug = 'alye-parusa-school';

  -- Питание
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Яндекс Еда', 'yandex-food',
          'Сервис доставки еды и продуктов. Подписка Яндекс Плюс с бесплатной доставкой.',
          'verified', 'b2b@food.yandex.ru', 'https://eda.yandex.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_yandex_food FROM providers WHERE slug = 'yandex-food';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'SmartLunch', 'smartlunch',
          'Корпоративная столовая на аутсорсе. Готовое горячее питание для офиса.',
          'verified', 'corp@smartlunch.ru', 'https://smartlunch.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_smartlunch FROM providers WHERE slug = 'smartlunch';

  -- Транспорт
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Яндекс Go', 'yandex-go',
          'Корпоративное такси. Поездки по фиксированной ставке, отчётность, контроль расходов.',
          'verified', 'b2b@taxi.yandex.ru', 'https://taxi.yandex.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_yandex_go FROM providers WHERE slug = 'yandex-go';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Тройка Транспорт', 'troika-transport',
          'Транспортные карты Москвы и МО. Безлимитные абонементы на наземный транспорт и метро.',
          'verified', 'partners@mosgortrans.ru', 'https://transport.mos.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_troika FROM providers WHERE slug = 'troika-transport';

  -- Путешествия
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Островок', 'ostrovok',
          'Онлайн-сервис бронирования отелей и туров. Более 1 млн отелей по всему миру.',
          'verified', 'corp@ostrovok.ru', 'https://ostrovok.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_ostrovok FROM providers WHERE slug = 'ostrovok';

  -- Развлечения и культура
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Яндекс Афиша', 'yandex-afisha',
          'Билеты на концерты, спектакли, выставки и кино. Сертификаты любого номинала.',
          'verified', 'b2b@afisha.yandex.ru', 'https://afisha.yandex.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_yafisha FROM providers WHERE slug = 'yandex-afisha';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Tasterly', 'tasterly',
          'Площадка мастер-классов: гончарное дело, кулинария, рисование, парфюмерия и многое другое.',
          'verified', 'b2b@tasterly.ru', 'https://tasterly.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_tasterly FROM providers WHERE slug = 'tasterly';

  -- Семья и дети
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Орлёнок', 'orlenok-camp',
          'Всероссийский детский лагерь. Летние и зимние смены, образовательные программы.',
          'verified', 'corp@orlenok.ru', 'https://orlenok.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_kinder_world FROM providers WHERE slug = 'orlenok-camp';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Сеть детских садов «Сёма»', 'sema-kindergarten',
          'Частные детские сады в Москве и МО. Полный день, английский с 3 лет.',
          'pending', 'sales@sema-kids.ru', 'https://sema-kids.ru', NULL)
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_kindergarten FROM providers WHERE slug = 'sema-kindergarten';

  -- Подписки
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'ЛитРес', 'litres',
          'Крупнейшая в России электронная и аудиобиблиотека. Подписка с доступом к 500 000+ книг.',
          'verified', 'b2b@litres.ru', 'https://litres.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_litres FROM providers WHERE slug = 'litres';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Яндекс Музыка', 'yandex-music',
          'Стриминговый сервис: музыка, подкасты, аудиокниги. 100+ млн треков.',
          'verified', 'corp@music.yandex.ru', 'https://music.yandex.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_yamusic FROM providers WHERE slug = 'yandex-music';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Кинопоиск', 'kinopoisk',
          'Онлайн-кинотеатр: фильмы, сериалы, мультфильмы. Эксклюзивные премьеры.',
          'verified', 'b2b@kinopoisk.ru', 'https://kinopoisk.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_kinopoisk FROM providers WHERE slug = 'kinopoisk';

  -- Дом и быт
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Qlean', 'qlean',
          'Сервис уборки квартир. Регулярная и генеральная уборка, химчистка, мытьё окон.',
          'verified', 'corp@qlean.ru', 'https://qlean.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_qlean FROM providers WHERE slug = 'qlean';

  -- Питомцы
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'Petstory', 'petstory',
          'Сервис ветеринарной помощи и страхование питомцев. ДМС для собак и кошек.',
          'verified', 'b2b@petstory.ru', 'https://petstory.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_petstory FROM providers WHERE slug = 'petstory';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner_fallback, 'PetShop Grooming', 'petshop-grooming',
          'Салоны красоты для животных. Стрижка, мытьё, обработка, экспресс-линька.',
          'verified', 'partners@petshop.ru', 'https://petshop.ru/grooming', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_petshop FROM providers WHERE slug = 'petshop-grooming';

  -- ---------- Provider offerings ----------
  -- Используем helper-pattern: lookup-by-(provider_id, name)
  -- Для каждого: если уже существует — пропускаем.

  -- ===== ЗДОРОВЬЕ =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_medsi, _cat_health, 'ДМС Стандарт',
    'Базовая программа ДМС: амбулаторное обслуживание, поликлиника, диагностика, скорая помощь.',
    'Полис ДМС с покрытием амбулаторных услуг в клиниках Медси: терапевт, узкие специалисты, лабораторная диагностика, инструментальные исследования, вызов врача на дом, скорая медицинская помощь.',
    18000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Казань'],
    'Полис оформляется в течение 3 рабочих дней',
    'Срок действия — 1 год с момента активации',
    4.6, 28
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_medsi AND name = 'ДМС Стандарт');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_medsi, _cat_health, 'ДМС Премиум',
    'Расширенная программа ДМС: стационар, телемедицина, чекапы, реабилитация, стоматология.',
    'Премиальный полис ДМС: всё из «Стандарт» + плановая и экстренная госпитализация в стационары Медси, стоматология (терапия + ортопедия), ежегодный чекап, реабилитация, телемедицина 24/7, прививочный кабинет.',
    35000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург'],
    'Полис оформляется в течение 5 рабочих дней',
    'Срок действия — 1 год. Включает стоматологию до 50 000 руб.',
    4.8, 19
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_medsi AND name = 'ДМС Премиум');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_medsi, _cat_health, 'ДМС для родственников',
    'ДМС для одного ближайшего родственника (супруг/супруга, родитель, ребёнок).',
    'Полис ДМС «Стандарт» для одного указанного родственника. Доступно после оформления собственного полиса. Один родственник за период.',
    16000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Казань'],
    'Активация в личном кабинете Медси',
    'Только для прямых родственников: супруги, родители, дети до 18 лет',
    4.5, 7
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_medsi AND name = 'ДМС для родственников');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_invitro, _cat_health, 'Чекап ИНВИТРО Premium',
    'Комплексное обследование организма: 60+ анализов, УЗИ всех органов, ЭКГ, консультация терапевта.',
    'Расширенный чекап для оценки общего состояния здоровья. Биохимия, гормоны, онкомаркеры, витамины, УЗИ внутренних органов, щитовидной железы, ЭКГ. Расшифровка результатов с врачом.',
    14000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Новосибирск','Казань'],
    'Запись на дату по выбору',
    'Голодание 12 часов перед сдачей',
    4.7, 22
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_invitro AND name = 'Чекап ИНВИТРО Premium');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_invitro, _cat_health, 'Сертификат на МРТ/КТ/УЗИ',
    'Сертификат номиналом 8 000 баллов на любую инструментальную диагностику ИНВИТРО.',
    'Сертификат можно использовать на МРТ, КТ, УЗИ, рентген, маммографию и другие виды диагностики в любой клинике сети ИНВИТРО.',
    8000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Новосибирск','Казань','Екатеринбург'],
    'Электронный сертификат на email',
    'Срок действия 6 месяцев',
    4.4, 12
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_invitro AND name = 'Сертификат на МРТ/КТ/УЗИ');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_youtalk, _cat_health, 'Подписка на психотерапию (4 сессии)',
    'Месячная подписка на онлайн-сессии с лицензированным психологом.',
    '4 индивидуальные онлайн-сессии (50 мин) с психологом по подбору. Анонимно, без диагноза в карте, через защищённое видео-соединение. Возможность сменить специалиста.',
    7000, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Подбор психолога в течение 24 часов',
    'Сессии используются в течение 60 дней',
    4.9, 34
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_youtalk AND name = 'Подписка на психотерапию (4 сессии)');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_spa, _cat_beauty, 'Сертификат на массаж и СПА',
    'Сертификат на 3 процедуры на выбор: классический массаж, обёртывания, ароматерапия.',
    'Релакс-программа в спа-салонах SPA Place. На выбор: 3 сеанса классического массажа (60 мин), 2 обёртывания + 1 массаж, или 3 сеанса стоунтерапии.',
    9000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург'],
    'Бронирование за 3 дня',
    'Сертификат действует 4 месяца',
    4.6, 18
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_spa AND name = 'Сертификат на массаж и СПА');

  -- ===== СПОРТ =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_world_class, _cat_sport, 'Годовой абонемент World Class',
    'Безлимитный доступ ко всем клубам сети. Тренажёры, групповые программы, бассейн, SPA.',
    'Годовая карта, безлимитное посещение более 90 клубов в России. Включено: тренажёрный зал, бассейн, групповые программы (йога, кроссфит, бокс, пилатес), сауна.',
    24000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Казань','Новосибирск','Екатеринбург'],
    'Активация в любом клубе по паспорту',
    'Карта именная',
    4.7, 41
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_world_class AND name = 'Годовой абонемент World Class');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_superfit, _cat_sport, 'Подписка SuperFit App (год)',
    'Годовая подписка на приложение для домашних тренировок. 500+ программ.',
    'Полный доступ к видеотренировкам в приложении: йога, силовые, кардио, медитации, программы для начинающих и продвинутых. Личный план тренировок и питания.',
    4800, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Активация промокода в приложении',
    'Авто-продление отключено',
    4.5, 27
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_superfit AND name = 'Подписка SuperFit App (год)');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_kidsport, _cat_family, 'Детская спортивная секция (квартал)',
    'Квартальный абонемент в детскую секцию: футбол, плавание, гимнастика, единоборства.',
    '12 занятий в квартал по выбору родителей. Возраст 4-14 лет. Опытные тренеры с педагогическим образованием. Инвентарь предоставляется.',
    11000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург'],
    'Запись через личный кабинет KidSport',
    'Один ребёнок на абонемент. До 12 пропусков в квартал.',
    4.7, 14
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_kidsport AND name = 'Детская спортивная секция (квартал)');

  -- ===== ОБРАЗОВАНИЕ =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_skillbox, _cat_education, 'Сертификат Skillbox 30 000',
    'Сертификат на оплату любого курса Skillbox: IT, дизайн, маркетинг, менеджмент.',
    'Универсальный сертификат на 30 000 ₽ можно потратить на любой из 700+ курсов Skillbox. Можно докупать у Skillbox недостающую сумму своей картой.',
    30000, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Промокод приходит на email',
    'Срок действия 12 месяцев',
    4.4, 31
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_skillbox AND name = 'Сертификат Skillbox 30 000');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_skyeng, _cat_education, 'Курс английского Skyeng (3 мес)',
    'Индивидуальные занятия английским с преподавателем 2 раза в неделю.',
    '24 индивидуальные урока в течение 3 месяцев. Подбор преподавателя под цели: разговорный, бизнес-английский, подготовка к IELTS/TOEFL. Платформа Vimbox.',
    18000, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Доступ к платформе сразу после оплаты',
    'Перенос пропущенных уроков — за 8 часов до начала',
    4.6, 39
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_skyeng AND name = 'Курс английского Skyeng (3 мес)');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_kids_school, _cat_family, 'Детские развивающие кружки (полугодие)',
    'Полугодовой абонемент в развивающие кружки для детей: рисование, музыка, робототехника.',
    'Полугодовой абонемент в развивающие кружки. Доступно: рисование, керамика, музыка, робототехника, шахматы, английский, подготовка к школе. От 4 до 12 лет.',
    13000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург'],
    'Запись на любой кружок в личном кабинете',
    'Один кружок на полугодие',
    4.5, 11
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_kids_school AND name = 'Детские развивающие кружки (полугодие)');

  -- ===== ПИТАНИЕ =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_yandex_food, _cat_food, 'Подписка Яндекс Еда Плюс (год)',
    'Годовая подписка на доставку еды и продуктов. Бесплатная доставка, скидки.',
    'Бесплатная доставка от 0 ₽ в Яндекс Еде, скидки до 20% в любимых ресторанах, кэшбэк баллами Плюса. Действует во всех городах присутствия.',
    6000, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Активация в приложении Яндекс Еда',
    'Срок 12 месяцев',
    4.3, 26
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_yandex_food AND name = 'Подписка Яндекс Еда Плюс (год)');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_smartlunch, _cat_food, 'Корпоративные обеды (месяц)',
    'Готовые горячие обеды в офис на 22 рабочих дня.',
    'Ежедневная доставка горячего обеда в офис. Меню обновляется каждую неделю: 4 варианта (мясной, рыбный, вегетарианский, постный). Соусы, напиток, фрукт включены.',
    9500, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург'],
    'Старт со следующего понедельника',
    'Перенос дней — за 24 часа',
    4.4, 16
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_smartlunch AND name = 'Корпоративные обеды (месяц)');

  -- ===== ТРАНСПОРТ =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_yandex_go, _cat_transport, 'Корпоративное такси (5 000 ₽)',
    'Сертификат Яндекс Go на 5 000 ₽ для корпоративных поездок.',
    'Промокод на 5 000 ₽ в Яндекс Go. Можно использовать в любом тарифе: Эконом, Комфорт, Бизнес. Поездки и доставка.',
    5000, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Промокод приходит на email',
    'Срок 6 месяцев',
    4.5, 23
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_yandex_go AND name = 'Корпоративное такси (5 000 ₽)');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_troika, _cat_transport, 'Транспортный абонемент (60 поездок)',
    'Карта Тройка с 60 поездками на наземном транспорте Москвы.',
    'Транспортная карта Тройка с записанным абонементом на 60 поездок (наземный + метро). Срок действия — 90 дней с первой поездки.',
    3500, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва'],
    'Получение в любой кассе метро по промокоду',
    'Срок 90 дней с активации',
    4.2, 8
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_troika AND name = 'Транспортный абонемент (60 поездок)');

  -- ===== ПУТЕШЕСТВИЯ =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_ostrovok, _cat_travel, 'Сертификат Островок 30 000',
    'Сертификат на бронирование отелей и туров через Островок.ру.',
    'Сертификат номиналом 30 000 ₽. Можно потратить на отели, туры и авиабилеты на Островок.ру. Если стоимость выше — доплачивайте картой.',
    30000, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Промокод приходит на email',
    'Срок 12 месяцев',
    4.5, 17
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_ostrovok AND name = 'Сертификат Островок 30 000');

  -- ===== РАЗВЛЕЧЕНИЯ И КУЛЬТУРА =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_yafisha, _cat_entertainment, 'Сертификат Яндекс Афиша 5 000',
    'Сертификат на билеты в театр, концерт, выставку или кино.',
    'Универсальный сертификат на любые мероприятия в Яндекс Афише: театр, концерты, выставки, кино, мюзиклы, стендап. Действует на любой город.',
    5000, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Промокод приходит на email',
    'Срок 6 месяцев',
    4.6, 24
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_yafisha AND name = 'Сертификат Яндекс Афиша 5 000');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_tasterly, _cat_entertainment, 'Мастер-класс на выбор',
    'Сертификат на любой мастер-класс Tasterly: гончарство, кулинария, рисование.',
    'Сертификат на один мастер-класс из каталога Tasterly: гончарное дело, кулинария, парфюмерия, рисование, ароматные свечи, керамика. 2-3 часа, все материалы включены.',
    4500, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Казань'],
    'Бронирование на сайте Tasterly',
    'Срок 6 месяцев. Перенос за 24 часа.',
    4.8, 19
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_tasterly AND name = 'Мастер-класс на выбор');

  -- ===== СЕМЬЯ И ДЕТИ =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_kinder_world, _cat_family, 'Сертификат на детский лагерь (смена)',
    'Сертификат на одну смену в детском лагере «Орлёнок».',
    'Летняя или зимняя смена 14-21 день. Возраст 7-17 лет. Включено: проживание, 5-разовое питание, образовательная программа, экскурсии, кружки.',
    50000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Краснодарский край'],
    'Бронирование смены через личный кабинет',
    'Один ребёнок на смену',
    4.8, 9
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_kinder_world AND name = 'Сертификат на детский лагерь (смена)');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_kindergarten, _cat_family, 'Компенсация детского сада (месяц)',
    'Компенсация месячной оплаты частного детского сада «Сёма».',
    'Сертификат на 25 000 ₽ на оплату одного месяца в любом детском саду сети «Сёма». Полный день, питание, английский с 3 лет, подготовка к школе.',
    25000, 'pending_review'::offering_status, 'offline'::offering_format, ARRAY['Москва'],
    'Активация в личном кабинете',
    'Один ребёнок на сертификат',
    0, 0
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_kindergarten AND name = 'Компенсация детского сада (месяц)');

  -- ===== ПОДПИСКИ =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_litres, _cat_subscriptions, 'Подписка ЛитРес (год)',
    'Годовая подписка на электронные и аудиокниги. 500 000+ книг.',
    'Полный безлимит на чтение и прослушивание книг в приложениях ЛитРес и MyBook. Включены новинки и эксклюзивы.',
    3600, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Промокод приходит на email',
    'Подписка на 12 месяцев',
    4.7, 33
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_litres AND name = 'Подписка ЛитРес (год)');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_yamusic, _cat_subscriptions, 'Яндекс Музыка (год)',
    'Годовая подписка Яндекс Музыка. Музыка, подкасты, аудиокниги.',
    'Безлимитный доступ к музыке без рекламы, прослушивание офлайн, подкасты и аудиокниги. Совместим с Алисой и колонками Станция.',
    4200, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Активация в приложении',
    '12 месяцев',
    4.6, 28
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_yamusic AND name = 'Яндекс Музыка (год)');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_kinopoisk, _cat_subscriptions, 'Кинопоиск (год)',
    'Годовая подписка на онлайн-кинотеатр Кинопоиск.',
    'Доступ к фильмам, сериалам, мультфильмам, премьерам Кинопоиска. 4K, поддержка просмотра без интернета. На всех устройствах.',
    4500, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Активация в приложении',
    '12 месяцев',
    4.5, 31
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_kinopoisk AND name = 'Кинопоиск (год)');

  -- ===== ДОМ И БЫТ =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_qlean, _cat_home, 'Сертификат Qlean на клининг',
    'Сертификат на 3 уборки квартиры до 60 кв.м.',
    '3 регулярные уборки квартиры площадью до 60 кв.м. Включено: мойка полов, пыль, санузел, кухня. Доплата за химию и окна.',
    7500, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Казань','Екатеринбург','Новосибирск'],
    'Запись через приложение Qlean',
    'Срок 6 месяцев',
    4.5, 22
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_qlean AND name = 'Сертификат Qlean на клининг');

  -- ===== ПИТОМЦЫ =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_petstory, _cat_pets, 'ДМС для питомца (год)',
    'Годовая программа ветеринарного страхования для собак и кошек.',
    'Полис «всё включено»: профилактика, прививки, кастрация/стерилизация, лечение заболеваний, экстренная хирургия. Сеть из 200+ ветеринарных клиник.',
    12000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург'],
    'Полис оформляется за 1 рабочий день',
    'Один питомец на полис. Возраст до 8 лет.',
    4.6, 13
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_petstory AND name = 'ДМС для питомца (год)');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_petshop, _cat_pets, 'Сертификат на груминг',
    'Сертификат на 3 процедуры груминга в любом салоне сети.',
    '3 услуги на выбор: стрижка по породным стандартам, мытьё с шампунем, экспресс-линька, стрижка когтей, чистка ушей. Любые породы.',
    5500, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Новосибирск'],
    'Запись через сайт PetShop',
    'Срок 4 месяца',
    4.7, 9
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_petshop AND name = 'Сертификат на груминг');

  -- ---------- Tenant offerings (HR подключила в свой каталог) ----------
  -- Используем lookup-by-(tenant_id, provider_offering_id)
  WITH desired_offerings AS (
    SELECT po.id AS offering_id,
           CASE
             WHEN po.name IN ('ДМС Премиум','Корпоративные обеды (месяц)') THEN po.base_price_points - 5000
             ELSE NULL
           END AS custom_price
    FROM provider_offerings po
    WHERE po.status = 'published'::offering_status
      AND po.provider_id IN (
        _prov_medsi, _prov_invitro, _prov_youtalk, _prov_spa,
        _prov_world_class, _prov_superfit, _prov_kidsport,
        _prov_skillbox, _prov_skyeng, _prov_kids_school,
        _prov_yandex_food, _prov_smartlunch,
        _prov_yandex_go, _prov_troika,
        _prov_ostrovok, _prov_yafisha, _prov_tasterly,
        _prov_kinder_world,
        _prov_litres, _prov_yamusic, _prov_kinopoisk,
        _prov_qlean, _prov_petstory, _prov_petshop
      )
  )
  INSERT INTO tenant_offerings (tenant_id, provider_offering_id, custom_price_points, is_active, enabled_by, enabled_at)
  SELECT _tenant_id, offering_id, custom_price, true, _hr_owner_fallback, NOW()
  FROM desired_offerings
  ON CONFLICT (tenant_id, provider_offering_id) DO NOTHING;

  RAISE NOTICE 'Block 1 (catalog) completed: % providers, % offerings linked',
    (SELECT count(*) FROM providers),
    (SELECT count(*) FROM tenant_offerings WHERE tenant_id = _tenant_id);

END $seed$;


-- ===========================================================================
-- БЛОК 2. Auth-пользователи (4 роли) + их домен-данные
-- ===========================================================================
--
-- Создаём записи в auth.users напрямую с bcrypt-паролями. Триггер
-- handle_new_user (миграция 00009) автоматически создаст public.users,
-- wallet и employee_profile (для роли employee). Затем дополняем профили
-- богатыми данными, отзывами, заказами.
-- ===========================================================================

DO $authseed$
DECLARE
  _tenant_id          uuid;
  _admin_auth_id      uuid := 'a1d1f000-0000-4000-8000-000000000001';
  _hr_auth_id         uuid := 'a1d1f000-0000-4000-8000-000000000002';
  _employee_auth_id   uuid := 'a1d1f000-0000-4000-8000-000000000003';
  _provider_auth_id   uuid := 'a1d1f000-0000-4000-8000-000000000004';
  _admin_user_id      uuid;
  _hr_user_id         uuid;
  _employee_user_id   uuid;
  _provider_user_id   uuid;
  _bm_provider_id     uuid;

  -- Демо-офферы для заказов сотрудника
  _po_yamusic         uuid;
  _po_litres          uuid;
  _po_spa             uuid;
  _po_skyeng          uuid;
  _po_yandex_go       uuid;
  _po_world_class     uuid;
  _po_qlean           uuid;
  _po_invitro         uuid;

  _to_yamusic         uuid;
  _to_litres          uuid;
  _to_spa             uuid;
  _to_skyeng          uuid;
  _to_yandex_go       uuid;
  _to_world_class     uuid;

  _employee_wallet_id uuid;
  _hr_wallet_id       uuid;

  _bcrypt_password    text;
BEGIN
  -- ---------- Tenant ----------
  SELECT id INTO _tenant_id FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant not found — выполните БЛОК 1 этого seed-файла раньше или прогоните seed.sql';
  END IF;

  -- Bcrypt-хэш пароля «Demo123!». Один на всех — упрощает запоминание.
  _bcrypt_password := crypt('Demo123!', gen_salt('bf'));

  -- ---------- 1. Auth users ----------
  -- Стандартный набор полей для Supabase Auth (instance_id, aud, role, email, encrypted_password, etc.).
  -- Триггер handle_new_user сработает на каждый INSERT и создаст public.users + wallet.

  -- INSERT в auth.users — пишем все «common» token-поля как '' для совместимости
  -- с разными версиями Supabase, где эти колонки могут быть NOT NULL.
  -- Триггер handle_new_user сработает на каждый INSERT и создаст public.users.

  PERFORM 1; -- разделитель для читаемости

  -- ===== Admin =====
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token,
    is_super_admin, is_sso_user, is_anonymous
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    _admin_auth_id, 'authenticated', 'authenticated',
    'admin@bm.demo', _bcrypt_password,
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role','admin','full_name','Алексей Сидоров','tenant_id', _tenant_id::text),
    NOW(), NOW(),
    '', '', '', '',
    '', '', '', '',
    false, false, false
  )
  ON CONFLICT (id) DO NOTHING;

  -- ===== HR =====
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token,
    is_super_admin, is_sso_user, is_anonymous
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    _hr_auth_id, 'authenticated', 'authenticated',
    'hr@bm.demo', _bcrypt_password,
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role','hr','full_name','Ольга Белова','tenant_id', _tenant_id::text),
    NOW(), NOW(),
    '', '', '', '',
    '', '', '', '',
    false, false, false
  )
  ON CONFLICT (id) DO NOTHING;

  -- ===== Employee =====
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token,
    is_super_admin, is_sso_user, is_anonymous
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    _employee_auth_id, 'authenticated', 'authenticated',
    'employee@bm.demo', _bcrypt_password,
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role','employee','full_name','Иван Козлов','tenant_id', _tenant_id::text),
    NOW(), NOW(),
    '', '', '', '',
    '', '', '', '',
    false, false, false
  )
  ON CONFLICT (id) DO NOTHING;

  -- ===== Provider =====
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token,
    is_super_admin, is_sso_user, is_anonymous
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    _provider_auth_id, 'authenticated', 'authenticated',
    'provider@bm.demo', _bcrypt_password,
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role','provider','full_name','Анна Партнёрова','tenant_id', _tenant_id::text),
    NOW(), NOW(),
    '', '', '', '',
    '', '', '', '',
    false, false, false
  )
  ON CONFLICT (id) DO NOTHING;

  -- ---------- 2. Auth identities (нужны для email/password входа) ----------
  -- Используем NOT EXISTS вместо ON CONFLICT — UNIQUE на (provider, provider_id)
  -- появилась только в новых версиях Supabase.
  INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), _admin_auth_id, 'email', 'admin@bm.demo',
         jsonb_build_object('sub', _admin_auth_id::text, 'email', 'admin@bm.demo', 'email_verified', true),
         NOW(), NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = _admin_auth_id AND provider = 'email');

  INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), _hr_auth_id, 'email', 'hr@bm.demo',
         jsonb_build_object('sub', _hr_auth_id::text, 'email', 'hr@bm.demo', 'email_verified', true),
         NOW(), NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = _hr_auth_id AND provider = 'email');

  INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), _employee_auth_id, 'email', 'employee@bm.demo',
         jsonb_build_object('sub', _employee_auth_id::text, 'email', 'employee@bm.demo', 'email_verified', true),
         NOW(), NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = _employee_auth_id AND provider = 'email');

  INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), _provider_auth_id, 'email', 'provider@bm.demo',
         jsonb_build_object('sub', _provider_auth_id::text, 'email', 'provider@bm.demo', 'email_verified', true),
         NOW(), NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = _provider_auth_id AND provider = 'email');

  -- ---------- 3. Resolve public.users IDs (созданные триггером) ----------
  SELECT id INTO _admin_user_id    FROM users WHERE auth_id = _admin_auth_id;
  SELECT id INTO _hr_user_id       FROM users WHERE auth_id = _hr_auth_id;
  SELECT id INTO _employee_user_id FROM users WHERE auth_id = _employee_auth_id;
  SELECT id INTO _provider_user_id FROM users WHERE auth_id = _provider_auth_id;

  IF _admin_user_id IS NULL OR _hr_user_id IS NULL OR _employee_user_id IS NULL OR _provider_user_id IS NULL THEN
    RAISE EXCEPTION 'Триггер handle_new_user не создал public.users для одного из демо-аккаунтов. Проверьте миграцию 00009.';
  END IF;

  RAISE NOTICE 'Auth users created: admin=%, hr=%, employee=%, provider=%',
    _admin_user_id, _hr_user_id, _employee_user_id, _provider_user_id;

  -- ---------- 4. Профили: full_name + employee_profiles ----------
  -- Триггер уже выставил full_name, но на всякий случай актуализируем.
  UPDATE users SET full_name = 'Алексей Сидоров',  role = 'admin'    WHERE id = _admin_user_id;
  UPDATE users SET full_name = 'Ольга Белова',     role = 'hr'       WHERE id = _hr_user_id;
  UPDATE users SET full_name = 'Иван Козлов',      role = 'employee' WHERE id = _employee_user_id;
  UPDATE users SET full_name = 'Анна Партнёрова',  role = 'provider' WHERE id = _provider_user_id;

  -- Employee — обогащаем профиль (триггер создал пустой stub)
  UPDATE employee_profiles SET
    grade = 'middle',
    tenure_months = 24,
    location = 'Москва',
    legal_entity = 'ООО ТБ',
    gender = 'male',
    birthday = DATE '1995-08-15',
    extra = '{"department":"Разработка","position":"Backend-разработчик","marital_status":"married","children":1,"work_format":"hybrid","priorities":["health","education","family"]}'::jsonb
  WHERE user_id = _employee_user_id;

  -- HR — нужно создать вручную (триггер создаёт только для employee)
  INSERT INTO employee_profiles (user_id, tenant_id, grade, tenure_months, location, legal_entity, gender, birthday, extra)
  VALUES (
    _hr_user_id, _tenant_id,
    'senior', 48, 'Москва', 'ООО ТБ',
    'female', DATE '1988-03-22',
    '{"department":"HR","position":"Руководитель HR-отдела","marital_status":"married","children":2,"work_format":"office"}'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Admin — тоже отдельно (по seed.sql у admin есть профиль директора)
  INSERT INTO employee_profiles (user_id, tenant_id, grade, tenure_months, location, legal_entity, gender, birthday, extra)
  VALUES (
    _admin_user_id, _tenant_id,
    'director', 72, 'Москва', 'ООО ТБ',
    'male', DATE '1980-11-05',
    '{"department":"Управление","position":"Генеральный директор","marital_status":"married","children":3,"work_format":"office"}'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Provider — у провайдера нет employee_profile (не нужен по дизайну)

  -- ---------- 5. Provider record для provider-юзера ----------
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, address, verified_at)
  VALUES (
    _provider_user_id, 'BeneFit Studio', 'benefit-studio',
    'Студия партнёрских льгот. Wellness-программы, корпоративные мероприятия и онлайн-тренинги для сотрудников.',
    'verified', 'partner@bm.demo', 'https://benefit-studio.demo', 'Москва', NOW()
  )
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO _bm_provider_id FROM providers WHERE slug = 'benefit-studio';

  -- Связка provider_users (owner)
  INSERT INTO provider_users (provider_id, user_id, role)
  VALUES (_bm_provider_id, _provider_user_id, 'owner'::provider_user_role)
  ON CONFLICT (provider_id, user_id) DO NOTHING;

  -- 4 предложения у BeneFit Studio в разных статусах (для демо provider-кабинета)
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _bm_provider_id,
         (SELECT id FROM global_categories WHERE name = 'Здоровье'),
         'Wellness-программа «Энергия»',
         'Двухмесячная программа: персональный план питания, тренировки, медитации.',
         'Двухмесячная индивидуальная программа: разработка плана питания нутрициологом, тренировки 3 раза в неделю с тренером онлайн, ежедневные медитации, контрольные созвоны раз в неделю.',
         15000, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
         'Старт после знакомства с куратором',
         '60 дней с активации',
         4.7, 6
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _bm_provider_id AND name = 'Wellness-программа «Энергия»');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _bm_provider_id,
         (SELECT id FROM global_categories WHERE name = 'Образование'),
         'Тренинг «Stress management» для команды',
         'Корпоративный тренинг по управлению стрессом и профилактике выгорания (4 часа).',
         'Очный или онлайн-тренинг для команды до 20 человек. Психолог-эксперт ведёт интерактивную программу с практиками. Получите чек-лист и план для команды.',
         8000, 'pending_review'::offering_status, 'online'::offering_format, ARRAY[]::text[],
         'Дата согласовывается с куратором',
         'Один тренинг на компанию',
         0, 0
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _bm_provider_id AND name = 'Тренинг «Stress management» для команды');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _bm_provider_id,
         (SELECT id FROM global_categories WHERE name = 'Развлечения'),
         'Тимбилдинг «Квест в офисе»',
         'Корпоративный квест в офисе или на выезде. Команда до 50 человек.',
         'Командная игра с сюжетом: расследование, головоломки, актёры. Длительность 2-3 часа. Поможет сплотить команду и найти лидеров.',
         20000, 'draft'::offering_status, 'offline'::offering_format, ARRAY['Москва'],
         '',
         '',
         0, 0
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _bm_provider_id AND name = 'Тимбилдинг «Квест в офисе»');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _bm_provider_id,
         (SELECT id FROM global_categories WHERE name = 'Здоровье'),
         'Мини-курс «Йога для офиса»',
         'Архивный курс — 8 видеоуроков йоги по 15 минут.',
         'Короткие видеоуроки, которые можно делать прямо за рабочим столом. Снимают напряжение в шее, спине, запястьях.',
         2000, 'archived'::offering_status, 'online'::offering_format, ARRAY[]::text[],
         '',
         '',
         4.2, 3
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _bm_provider_id AND name = 'Мини-курс «Йога для офиса»');

  -- Wellness-программа подключена в каталог тенанта
  INSERT INTO tenant_offerings (tenant_id, provider_offering_id, custom_price_points, is_active, enabled_by, enabled_at)
  SELECT _tenant_id, po.id, NULL, true, _hr_user_id, NOW()
  FROM provider_offerings po
  WHERE po.provider_id = _bm_provider_id AND po.name = 'Wellness-программа «Энергия»'
  ON CONFLICT (tenant_id, provider_offering_id) DO NOTHING;

  -- ---------- 6. Resolve offering IDs для последующих заказов ----------
  SELECT po.id INTO _po_yamusic
  FROM provider_offerings po WHERE po.name = 'Яндекс Музыка (год)';

  SELECT po.id INTO _po_litres
  FROM provider_offerings po WHERE po.name = 'Подписка ЛитРес (год)';

  SELECT po.id INTO _po_spa
  FROM provider_offerings po WHERE po.name = 'Сертификат на массаж и СПА';

  SELECT po.id INTO _po_skyeng
  FROM provider_offerings po WHERE po.name = 'Курс английского Skyeng (3 мес)';

  SELECT po.id INTO _po_yandex_go
  FROM provider_offerings po WHERE po.name = 'Корпоративное такси (5 000 ₽)';

  SELECT po.id INTO _po_world_class
  FROM provider_offerings po WHERE po.name = 'Годовой абонемент World Class';

  SELECT po.id INTO _po_qlean
  FROM provider_offerings po WHERE po.name = 'Сертификат Qlean на клининг';

  SELECT po.id INTO _po_invitro
  FROM provider_offerings po WHERE po.name = 'Чекап ИНВИТРО Premium';

  SELECT id INTO _to_yamusic     FROM tenant_offerings WHERE tenant_id = _tenant_id AND provider_offering_id = _po_yamusic;
  SELECT id INTO _to_litres      FROM tenant_offerings WHERE tenant_id = _tenant_id AND provider_offering_id = _po_litres;
  SELECT id INTO _to_spa         FROM tenant_offerings WHERE tenant_id = _tenant_id AND provider_offering_id = _po_spa;
  SELECT id INTO _to_skyeng      FROM tenant_offerings WHERE tenant_id = _tenant_id AND provider_offering_id = _po_skyeng;
  SELECT id INTO _to_yandex_go   FROM tenant_offerings WHERE tenant_id = _tenant_id AND provider_offering_id = _po_yandex_go;
  SELECT id INTO _to_world_class FROM tenant_offerings WHERE tenant_id = _tenant_id AND provider_offering_id = _po_world_class;

  -- ---------- 7. Wallet адjustments ----------
  -- Триггер создал кошельки. Зададим явные балансы для демо.
  -- Employee: 50 000 начислено - 4 200 (музыка) - 3 600 (книги) - 9 000 (СПА) = 33 200, резерв 18 000 (Skyeng)
  --   balance = 50000 - 4200 - 3600 - 9000 - 18000 = 15 200
  --   reserved = 18 000
  -- HR: 50 000 (бюджет HR не трогаем, но добавим accrual в ledger)

  SELECT id INTO _employee_wallet_id FROM wallets WHERE user_id = _employee_user_id LIMIT 1;
  SELECT id INTO _hr_wallet_id       FROM wallets WHERE user_id = _hr_user_id LIMIT 1;

  UPDATE wallets SET balance = 15200, reserved = 18000 WHERE id = _employee_wallet_id;
  UPDATE wallets SET balance = 50000, reserved = 0     WHERE id = _hr_wallet_id;

  -- ---------- 8. Заказы сотрудника ----------
  -- Заказ 1: Яндекс Музыка — оплачен (1 месяц назад)
  INSERT INTO orders (id, user_id, tenant_id, status, total_points, reserved_at, expires_at, created_at)
  VALUES (
    'b0000000-0000-4000-8000-000000000001'::uuid,
    _employee_user_id, _tenant_id,
    'paid'::order_status, 4200,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days' + INTERVAL '15 minutes',
    NOW() - INTERVAL '30 days'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO order_items (order_id, tenant_offering_id, provider_offering_id, quantity, price_points)
  SELECT 'b0000000-0000-4000-8000-000000000001'::uuid, _to_yamusic, _po_yamusic, 1, 4200
  WHERE NOT EXISTS (
    SELECT 1 FROM order_items
    WHERE order_id = 'b0000000-0000-4000-8000-000000000001'::uuid AND tenant_offering_id = _to_yamusic
  );

  -- Заказ 2: ЛитРес — оплачен (3 недели назад)
  INSERT INTO orders (id, user_id, tenant_id, status, total_points, reserved_at, expires_at, created_at)
  VALUES (
    'b0000000-0000-4000-8000-000000000002'::uuid,
    _employee_user_id, _tenant_id,
    'paid'::order_status, 3600,
    NOW() - INTERVAL '21 days',
    NOW() - INTERVAL '21 days' + INTERVAL '15 minutes',
    NOW() - INTERVAL '21 days'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO order_items (order_id, tenant_offering_id, provider_offering_id, quantity, price_points)
  SELECT 'b0000000-0000-4000-8000-000000000002'::uuid, _to_litres, _po_litres, 1, 3600
  WHERE NOT EXISTS (
    SELECT 1 FROM order_items
    WHERE order_id = 'b0000000-0000-4000-8000-000000000002'::uuid AND tenant_offering_id = _to_litres
  );

  -- Заказ 3: SPA — оплачен (10 дней назад)
  INSERT INTO orders (id, user_id, tenant_id, status, total_points, reserved_at, expires_at, created_at)
  VALUES (
    'b0000000-0000-4000-8000-000000000003'::uuid,
    _employee_user_id, _tenant_id,
    'paid'::order_status, 9000,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days' + INTERVAL '15 minutes',
    NOW() - INTERVAL '10 days'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO order_items (order_id, tenant_offering_id, provider_offering_id, quantity, price_points)
  SELECT 'b0000000-0000-4000-8000-000000000003'::uuid, _to_spa, _po_spa, 1, 9000
  WHERE NOT EXISTS (
    SELECT 1 FROM order_items
    WHERE order_id = 'b0000000-0000-4000-8000-000000000003'::uuid AND tenant_offering_id = _to_spa
  );

  -- Заказ 4: Skyeng — зарезервирован (только что, ждёт подтверждения)
  INSERT INTO orders (id, user_id, tenant_id, status, total_points, reserved_at, expires_at, created_at)
  VALUES (
    'b0000000-0000-4000-8000-000000000004'::uuid,
    _employee_user_id, _tenant_id,
    'reserved'::order_status, 18000,
    NOW() - INTERVAL '5 minutes',
    NOW() + INTERVAL '10 minutes',
    NOW() - INTERVAL '5 minutes'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO order_items (order_id, tenant_offering_id, provider_offering_id, quantity, price_points)
  SELECT 'b0000000-0000-4000-8000-000000000004'::uuid, _to_skyeng, _po_skyeng, 1, 18000
  WHERE NOT EXISTS (
    SELECT 1 FROM order_items
    WHERE order_id = 'b0000000-0000-4000-8000-000000000004'::uuid AND tenant_offering_id = _to_skyeng
  );

  -- ---------- 9. Point ledger ----------
  -- Начисления для всех 4 пользователей + спенды/резервы для employee.
  -- Идемпотентно: используем фиксированные UUID и ON CONFLICT.

  INSERT INTO point_ledger (id, wallet_id, tenant_id, order_id, type, amount, description, created_at)
  VALUES
    -- Accruals
    ('c0000000-0000-4000-8000-000000000001'::uuid, _employee_wallet_id, _tenant_id, NULL,
      'accrual'::ledger_type, 50000, 'Начисление по политике «Стандартная» за текущий период',
      NOW() - INTERVAL '60 days'),
    ('c0000000-0000-4000-8000-000000000002'::uuid, _hr_wallet_id, _tenant_id, NULL,
      'accrual'::ledger_type, 50000, 'Начисление по политике «Стандартная» за текущий период',
      NOW() - INTERVAL '60 days'),
    -- Spends
    ('c0000000-0000-4000-8000-000000000010'::uuid, _employee_wallet_id, _tenant_id,
      'b0000000-0000-4000-8000-000000000001'::uuid,
      'spend'::ledger_type, -4200, 'Оплата заказа: Яндекс Музыка (год)',
      NOW() - INTERVAL '30 days'),
    ('c0000000-0000-4000-8000-000000000011'::uuid, _employee_wallet_id, _tenant_id,
      'b0000000-0000-4000-8000-000000000002'::uuid,
      'spend'::ledger_type, -3600, 'Оплата заказа: Подписка ЛитРес',
      NOW() - INTERVAL '21 days'),
    ('c0000000-0000-4000-8000-000000000012'::uuid, _employee_wallet_id, _tenant_id,
      'b0000000-0000-4000-8000-000000000003'::uuid,
      'spend'::ledger_type, -9000, 'Оплата заказа: Сертификат на массаж и СПА',
      NOW() - INTERVAL '10 days'),
    -- Reserve (Skyeng)
    ('c0000000-0000-4000-8000-000000000013'::uuid, _employee_wallet_id, _tenant_id,
      'b0000000-0000-4000-8000-000000000004'::uuid,
      'reserve'::ledger_type, -18000, 'Резерв баллов: Курс английского Skyeng',
      NOW() - INTERVAL '5 minutes')
  ON CONFLICT (id) DO NOTHING;

  -- ---------- 10. Reviews ----------
  -- Сотрудник оставил 2 отзыва на оплаченные заказы
  INSERT INTO reviews (provider_offering_id, tenant_id, user_id, order_id, rating, title, body, status)
  SELECT _po_yamusic, _tenant_id, _employee_user_id,
         'b0000000-0000-4000-8000-000000000001'::uuid,
         5, 'Отличная подписка',
         'Слушаю на работе и в дороге. Качество звука хорошее, новинки появляются быстро.',
         'visible'::review_status
  WHERE NOT EXISTS (
    SELECT 1 FROM reviews WHERE user_id = _employee_user_id AND provider_offering_id = _po_yamusic
  );

  INSERT INTO reviews (provider_offering_id, tenant_id, user_id, order_id, rating, title, body, status)
  SELECT _po_spa, _tenant_id, _employee_user_id,
         'b0000000-0000-4000-8000-000000000003'::uuid,
         4, 'Хороший массаж, но запись непростая',
         'Массажисты приятные, релакс получился. Записаться было сложно — дальние даты только.',
         'visible'::review_status
  WHERE NOT EXISTS (
    SELECT 1 FROM reviews WHERE user_id = _employee_user_id AND provider_offering_id = _po_spa
  );

  -- HR оставил отзыв на чекап (как сотрудник тоже)
  INSERT INTO reviews (provider_offering_id, tenant_id, user_id, rating, title, body, status)
  SELECT _po_invitro, _tenant_id, _hr_user_id,
         5, 'Удобный формат',
         'Сдала всё в одном месте за полтора часа. Результаты на следующий день в личном кабинете.',
         'visible'::review_status
  WHERE NOT EXISTS (
    SELECT 1 FROM reviews WHERE user_id = _hr_user_id AND provider_offering_id = _po_invitro
  );

  -- ---------- 11. Audit log ----------
  INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, diff, created_at)
  VALUES
    (_tenant_id, _hr_user_id, 'create', 'tenant_offering', _to_world_class,
     '{"action":"enabled offering","name":"Годовой абонемент World Class"}'::jsonb,
     NOW() - INTERVAL '70 days'),
    (_tenant_id, _hr_user_id, 'update', 'tenant_offering', _to_spa,
     '{"action":"updated price","custom_price_points":9000}'::jsonb,
     NOW() - INTERVAL '40 days'),
    (_tenant_id, _employee_user_id, 'create', 'order', 'b0000000-0000-4000-8000-000000000001'::uuid,
     '{"status":"paid","total_points":4200,"name":"Яндекс Музыка (год)"}'::jsonb,
     NOW() - INTERVAL '30 days'),
    (_tenant_id, _admin_user_id, 'update', 'provider', _bm_provider_id,
     '{"status":"verified","name":"BeneFit Studio"}'::jsonb,
     NOW() - INTERVAL '14 days'),
    (_tenant_id, _employee_user_id, 'create', 'order', 'b0000000-0000-4000-8000-000000000004'::uuid,
     '{"status":"reserved","total_points":18000,"name":"Курс английского Skyeng"}'::jsonb,
     NOW() - INTERVAL '5 minutes')
  ON CONFLICT DO NOTHING;

  -- ---------- 12. Eligibility rules — для демо HR/admin ----------
  -- INSERT через FROM-clause: если оффер не найден, INSERT просто не сработает
  -- (вместо вставки NULL и нарушения CHECK-констрейнта).

  -- ДМС Премиум — только senior+, lead, director
  INSERT INTO eligibility_rules (tenant_offering_id, tenant_id, conditions)
  SELECT to2.id, _tenant_id,
    '{"rule_name":"ДМС Премиум — senior+","match_all":[{"field":"grade","operator":"in","value":["senior","lead","director"]}]}'::jsonb
  FROM tenant_offerings to2
  JOIN provider_offerings po2 ON po2.id = to2.provider_offering_id
  WHERE to2.tenant_id = _tenant_id
    AND po2.name = 'ДМС Премиум'
    AND NOT EXISTS (
      SELECT 1 FROM eligibility_rules er WHERE er.tenant_offering_id = to2.id
    );

  -- Сертификат на детский лагерь — стаж от 12 месяцев
  INSERT INTO eligibility_rules (tenant_offering_id, tenant_id, conditions)
  SELECT to2.id, _tenant_id,
    '{"rule_name":"Детский лагерь — стаж от 12 месяцев","match_all":[{"field":"tenure_months","operator":"gte","value":12}]}'::jsonb
  FROM tenant_offerings to2
  JOIN provider_offerings po2 ON po2.id = to2.provider_offering_id
  WHERE to2.tenant_id = _tenant_id
    AND po2.name = 'Сертификат на детский лагерь (смена)'
    AND NOT EXISTS (
      SELECT 1 FROM eligibility_rules er WHERE er.tenant_offering_id = to2.id
    );

  RAISE NOTICE 'Block 2 (auth + demo data) completed.';
END $authseed$;


-- ===========================================================================
-- БЛОК 3. Отдельный «provider»-сценарий: pending провайдер для admin
-- ===========================================================================
-- Для демо админ-кабинета: 1 провайдер ждёт верификации, 1 предложение
-- ждёт модерации. Создаётся независимо от auth-юзеров.
-- ===========================================================================

DO $admindemo$
DECLARE
  _hr_owner_fallback uuid;
  _prov_pending      uuid;
  _cat_finance       uuid;
BEGIN
  SELECT id INTO _hr_owner_fallback FROM users
   WHERE role = 'admin' OR role = 'hr' ORDER BY created_at ASC LIMIT 1;

  IF _hr_owner_fallback IS NULL THEN
    RAISE NOTICE 'Skipping pending-provider demo: нет admin/hr пользователей.';
    RETURN;
  END IF;

  SELECT id INTO _cat_finance FROM global_categories WHERE name = 'Финансы';

  -- Провайдер ждёт верификации
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website)
  VALUES (_hr_owner_fallback, 'Финам Бенефит', 'finam-benefit',
          'Корпоративные программы инвестирования и финансового образования сотрудников.',
          'pending', 'partner@finam-benefit.ru', 'https://finam.ru')
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_pending FROM providers WHERE slug = 'finam-benefit';

  -- Его предложение тоже ждёт модерации
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions)
  SELECT _prov_pending, _cat_finance,
    'Курс «Финансовая грамотность»',
    'Образовательный курс из 12 модулей: от планирования бюджета до инвестиций.',
    '12 видеоуроков по 30 минут, рабочая тетрадь, 3 онлайн-консультации с финансовым советником.',
    8000, 'pending_review'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    '',
    'Доступ навсегда'
  WHERE NOT EXISTS (
    SELECT 1 FROM provider_offerings WHERE provider_id = _prov_pending AND name = 'Курс «Финансовая грамотность»'
  );

  RAISE NOTICE 'Block 3 (admin demo) completed.';
END $admindemo$;


-- ===========================================================================
-- ИТОГ
-- ===========================================================================
-- ✅ 4 auth-аккаунта: admin@bm.demo / hr@bm.demo / employee@bm.demo / provider@bm.demo
--    Пароль для всех: Demo123!
-- ✅ 13 глобальных категорий, 11 категорий тенанта
-- ✅ ~25 провайдеров (плюс существующие из seed.sql/seed_prod.sql)
-- ✅ ~30 published-предложений + 3 pending/draft/archived для демо модерации
-- ✅ 4 заказа сотрудника (3 paid + 1 reserved)
-- ✅ 3 отзыва, 5 записей аудит-лога, 2 eligibility rules
-- ✅ Кошелёк сотрудника: balance=15 200, reserved=18 000
--
-- Чтобы перезапустить с чистого листа:
--   psql "$DB_URL" -f supabase/reseed.sql      # очистка
--   psql "$DB_URL" -f supabase/seed_demo.sql   # этот файл
-- ===========================================================================
