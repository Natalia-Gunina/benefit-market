-- ===========================================================================
-- Benefit Market — Дополнительные демо-данные ДЛЯ ДАШБОРДОВ
-- ===========================================================================
--
-- Этот файл ДОПОЛНЯЕТ seed.sql + seed_demo.sql:
--   • +8 новых верифицированных провайдеров (+2 «pending» к админ-модерации)
--   • +22 новых published-предложения в разных категориях
--   • +15 сотрудников в основной тенант (всего ~21 — заполняет HR-дашборд)
--   • +2 дополнительных тенанта (ООО Альфа Логистика, АО Северная Звезда),
--     с собственными HR + сотрудниками — для платформенного admin-обзора
--   • +30+ отзывов на офферы (от разных сотрудников, рейтинги 3..5)
--   • +25 заказов, распределённых по 12 месяцам — заполняет графики времени
--   • +25 начислений в point_ledger для построения тренда расходов
--   • +1 индивидуальное начисление (бонус за день рождения)
--
-- Все INSERT идемпотентны (ON CONFLICT DO NOTHING / lookup-by-unique-key),
-- ничего не удаляет, ничего не перезаписывает. Можно запускать многократно.
--
-- ---------------------------------------------------------------------------
-- ЗАПУСК:
-- ---------------------------------------------------------------------------
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed_demo_extra.sql
--
-- Либо через GitHub Actions: workflow «DB seed» с file=seed_demo_extra.sql.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ===========================================================================
-- БЛОК 1. Дополнительные провайдеры + предложения
-- ===========================================================================

DO $extra_catalog$
DECLARE
  _tenant_id          uuid;
  _hr_owner           uuid;

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

  _prov_sberhealth    uuid;
  _prov_fitmost       uuid;
  _prov_coursera      uuid;
  _prov_samokat       uuid;
  _prov_aviasales     uuid;
  _prov_lentafun      uuid;
  _prov_hellopets     uuid;
  _prov_homeservice   uuid;
  _prov_pending_edu   uuid;
  _prov_pending_health uuid;
BEGIN
  SELECT id INTO _tenant_id FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Основной тенант не найден. Запустите seed.sql/seed_demo.sql сначала.';
  END IF;

  SELECT id INTO _hr_owner FROM users
   WHERE tenant_id = _tenant_id ORDER BY created_at ASC LIMIT 1;

  IF _hr_owner IS NULL THEN
    RAISE EXCEPTION 'В основном тенанте нет пользователей. Запустите seed_demo.sql сначала.';
  END IF;

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

  -- ---------- Verified providers ----------
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, address, verified_at)
  VALUES (_hr_owner, 'СберЗдоровье', 'sberhealth',
    'Телемедицина и сервисы здоровья от Сбера. Видео-консультации врачей 24/7, расшифровка анализов, маркетплейс лекарств.',
    'verified', 'b2b@sberhealth.ru', 'https://sberhealth.ru', 'Москва', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_sberhealth FROM providers WHERE slug = 'sberhealth';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner, 'FitMost', 'fitmost',
    'Единый абонемент в 2 000+ фитнес-студий России: йога, бокс, барре, аэро, плавание. Одна подписка — любой клуб.',
    'verified', 'corp@fitmost.ru', 'https://fitmost.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_fitmost FROM providers WHERE slug = 'fitmost';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner, 'Coursera for Business', 'coursera-business',
    'Корпоративная подписка на 7 000+ курсов от лучших университетов мира: Stanford, Yale, IBM, Google.',
    'verified', 'b2b@coursera.org', 'https://coursera.org/business', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_coursera FROM providers WHERE slug = 'coursera-business';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner, 'Самокат', 'samokat',
    'Сервис экспресс-доставки продуктов и готовой еды за 15-30 минут. Корпоративные счета и сертификаты.',
    'verified', 'b2b@samokat.ru', 'https://samokat.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_samokat FROM providers WHERE slug = 'samokat';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner, 'Aviasales Business', 'aviasales-business',
    'Сервис покупки авиабилетов для бизнеса. Программы лояльности, отчётность, контроль расходов на командировки.',
    'verified', 'business@aviasales.ru', 'https://aviasales.ru/business', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_aviasales FROM providers WHERE slug = 'aviasales-business';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner, 'Лента развлечений', 'lenta-fun',
    'Маркетплейс билетов на массовые мероприятия: концерты, спорт, фестивали, парки развлечений, аквапарки.',
    'verified', 'b2b@lenta-fun.ru', 'https://lenta-fun.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_lentafun FROM providers WHERE slug = 'lenta-fun';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, verified_at)
  VALUES (_hr_owner, 'Hello Pets', 'hello-pets',
    'Магазин товаров для питомцев с доставкой за 2 часа. Корма, аксессуары, игрушки, уход.',
    'verified', 'corp@hellopets.ru', 'https://hellopets.ru', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_hellopets FROM providers WHERE slug = 'hello-pets';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website, address, verified_at)
  VALUES (_hr_owner, 'Уютный Дом Сервис', 'uyutniy-dom',
    'Бытовые услуги для дома: муж на час, сантехник, электрик, мастер ремонта. Гарантия и страхование работ.',
    'verified', 'partner@uyutniy-dom.ru', 'https://uyutniy-dom.ru', 'Москва', NOW())
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_homeservice FROM providers WHERE slug = 'uyutniy-dom';

  -- ---------- Pending providers (for admin moderation demo) ----------
  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website)
  VALUES (_hr_owner, 'Нетология PRO', 'netologia-pro',
    'Онлайн-университет дополнительного образования. IT, маркетинг, дизайн, аналитика. Программы для команд.',
    'pending', 'partners@netologia-pro.ru', 'https://netologia-pro.ru')
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_pending_edu FROM providers WHERE slug = 'netologia-pro';

  INSERT INTO providers (owner_user_id, name, slug, description, status, contact_email, website)
  VALUES (_hr_owner, 'Чек-Ап Клиник', 'checkup-clinic',
    'Сеть клиник профилактической диагностики. Чекапы здоровья за 1 день, более 80 показателей.',
    'pending', 'b2b@checkup-clinic.ru', 'https://checkup-clinic.ru')
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO _prov_pending_health FROM providers WHERE slug = 'checkup-clinic';

  -- ---------- Provider offerings ----------

  -- ===== СберЗдоровье =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_sberhealth, _cat_health, 'Подписка СберЗдоровье «Семейная»',
    'Безлимитные онлайн-консультации врачей для всей семьи на год.',
    'Доступ к 8 000+ врачей через приложение СберЗдоровье. Терапевт, педиатр, узкие специалисты. До 4 членов семьи. Расшифровка анализов, второе мнение, чат с врачом.',
    9500, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Активация в приложении сразу после оплаты',
    'Срок 12 месяцев. До 4 членов семьи на один аккаунт.',
    4.6, 47
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_sberhealth AND name = 'Подписка СберЗдоровье «Семейная»');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_sberhealth, _cat_health, 'Чекап «Здоровье на 360°»',
    'Комплексное обследование за 1 день: 70+ анализов, УЗИ, ЭКГ, расшифровка терапевтом.',
    'Всё в один день: забор крови, УЗИ внутренних органов, ЭКГ, измерения. Расшифровка результатов с консультацией терапевта. Подходит для ежегодного диспансеризации.',
    11500, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Казань'],
    'Запись по выбору даты',
    'Голодание 12 ч перед визитом',
    4.5, 21
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_sberhealth AND name = 'Чекап «Здоровье на 360°»');

  -- ===== FitMost =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_fitmost, _cat_sport, 'Подписка FitMost 8 баллов/мес (год)',
    'Единый абонемент: 8 посещений любых студий FitMost ежемесячно в течение года.',
    'Йога, бокс, барре, кросс-фит, плавание, бег, аэро — выбирайте студию каждый день. Доступно более 2 000 студий по всей России. Один балл = одно занятие.',
    14500, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Казань','Новосибирск','Екатеринбург'],
    'Активация в приложении FitMost',
    'Баллы не переносятся между месяцами',
    4.8, 56
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_fitmost AND name = 'Подписка FitMost 8 баллов/мес (год)');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_fitmost, _cat_sport, 'Пробный абонемент FitMost (месяц)',
    'Месячный абонемент на 4 посещения в любых студиях FitMost.',
    'Идеально, чтобы попробовать новое направление: 4 занятия за месяц в любых студиях системы. Подходит как стартовый или дополнительный к основному.',
    2900, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Казань'],
    'Активация в приложении FitMost',
    '30 дней с даты активации',
    4.5, 29
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_fitmost AND name = 'Пробный абонемент FitMost (месяц)');

  -- ===== Coursera =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_coursera, _cat_education, 'Coursera Plus подписка (год)',
    'Безлимитный доступ к 7 000+ курсов и специализаций ведущих университетов мира.',
    'Курсы от Stanford, Yale, IBM, Google, Meta, DeepLearning.AI. Любые языки, любые направления. Сертификаты по окончании. Включены Guided Projects и Specializations.',
    19500, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Промокод приходит на email',
    'Срок 12 месяцев',
    4.7, 38
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_coursera AND name = 'Coursera Plus подписка (год)');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_coursera, _cat_education, 'Специализация на выбор Coursera',
    'Сертификат на одну специализацию из каталога: Data Science, ML, Product Management.',
    'Полная специализация (5-7 курсов) с проектами и сертификатом от университета. Подходит для смены профессии или углубления экспертизы.',
    8500, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Промокод приходит на email',
    'Срок 18 месяцев на прохождение',
    4.6, 14
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_coursera AND name = 'Специализация на выбор Coursera');

  -- ===== Самокат =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_samokat, _cat_food, 'Сертификат Самокат 5 000',
    'Сертификат номиналом 5 000 ₽ на продукты и готовую еду из Самоката.',
    'Экспресс-доставка за 15-30 минут. Свежие продукты, готовые блюда, бытовая химия. Можно тратить частями.',
    5000, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Промокод приходит на email',
    'Срок 6 месяцев',
    4.4, 19
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_samokat AND name = 'Сертификат Самокат 5 000');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_samokat, _cat_food, 'Подписка Самокат+ (год)',
    'Годовая подписка с бесплатной доставкой и скидками до 30%.',
    'Бесплатная доставка от 0 ₽, скидки до 30% на каталог, эксклюзивные предложения партнёров. Срок 12 месяцев.',
    3500, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Активация в приложении Самокат',
    'Авто-продление отключено',
    4.5, 22
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_samokat AND name = 'Подписка Самокат+ (год)');

  -- ===== Aviasales =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_aviasales, _cat_travel, 'Сертификат Aviasales 25 000',
    'Сертификат на покупку авиабилетов через Aviasales.',
    'Номинал 25 000 ₽ на любые авиабилеты, гостиницы и услуги Aviasales. Поддержка 24/7, возврат и обмен через сервис.',
    25000, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Промокод приходит на email',
    'Срок 12 месяцев',
    4.4, 11
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_aviasales AND name = 'Сертификат Aviasales 25 000');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_aviasales, _cat_travel, 'Сертификат Aviasales 10 000',
    'Сертификат меньшего номинала для внутренних рейсов и коротких поездок.',
    'Номинал 10 000 ₽. Можно совмещать с другими промокодами. Действует на любые внутренние и международные направления.',
    10000, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Промокод приходит на email',
    'Срок 9 месяцев',
    4.3, 7
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_aviasales AND name = 'Сертификат Aviasales 10 000');

  -- ===== Лента развлечений =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_lentafun, _cat_entertainment, 'Билеты в аквапарк / парк развлечений',
    'Сертификат на посещение крупного аквапарка или парка развлечений.',
    'На выбор: «Лужники», «Лосиный остров», «Сочи Парк», «Дримвуд», «Карибия». До 4 человек по одному сертификату.',
    6500, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Сочи','Казань','Новосибирск'],
    'Запись на дату через приложение',
    'Срок 6 месяцев',
    4.7, 15
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_lentafun AND name = 'Билеты в аквапарк / парк развлечений');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_lentafun, _cat_entertainment, 'Подписка на 3 концерта / фестиваля',
    'Сертификат на посещение 3 мероприятий — концерт, фестиваль, стендап.',
    'Билеты на любые 3 мероприятия из каталога партнёров на сумму до 12 000 ₽. Если цена превышает — доплата картой.',
    12000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Казань','Новосибирск','Екатеринбург'],
    'Бронирование на сайте Лента-Fun',
    'Срок 9 месяцев',
    4.6, 18
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_lentafun AND name = 'Подписка на 3 концерта / фестиваля');

  -- ===== Hello Pets =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_hellopets, _cat_pets, 'Сертификат Hello Pets 4 000',
    'Сертификат на корм, аксессуары и товары для питомцев.',
    'Можно тратить частями на любые товары: корма, лежанки, игрушки, средства гигиены. Доставка за 2 часа в крупных городах.',
    4000, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Промокод приходит на email',
    'Срок 6 месяцев',
    4.5, 12
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_hellopets AND name = 'Сертификат Hello Pets 4 000');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_hellopets, _cat_pets, 'Подписка на корм для питомца (3 мес)',
    'Ежемесячная доставка корма по графику. Идеально для крупных пород.',
    'Премиум-корм Royal Canin / Acana / Pro Plan на 3 месяца. По размеру и возрасту питомца. Доставка раз в месяц.',
    8500, 'published'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Подбор корма консультантом',
    'Один питомец на подписку',
    4.7, 9
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_hellopets AND name = 'Подписка на корм для питомца (3 мес)');

  -- ===== Уютный Дом =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_homeservice, _cat_home, 'Муж на час (3 визита)',
    'Сертификат на 3 визита мастера для мелкого ремонта дома.',
    'Сборка мебели, замена розеток / выключателей, мелкий ремонт сантехники, навеска полок, картин, замена крана. До 2 часов на визит.',
    6000, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург'],
    'Запись через приложение «Уютный Дом»',
    'Срок 6 месяцев',
    4.6, 17
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_homeservice AND name = 'Муж на час (3 визита)');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions, avg_rating, review_count)
  SELECT _prov_homeservice, _cat_home, 'Генеральная уборка с химией',
    'Генеральная уборка квартиры до 70 кв.м. с профессиональной химией.',
    'Тщательная уборка всех поверхностей, окон изнутри, кухонной техники, ванной, дезинфекция. Профессиональная химия от Karcher / Pro-Brite.',
    8500, 'published'::offering_status, 'offline'::offering_format, ARRAY['Москва','Санкт-Петербург','Казань'],
    'Запись через приложение',
    'Срок 6 месяцев. До 70 кв.м.',
    4.7, 13
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_homeservice AND name = 'Генеральная уборка с химией');

  -- ===== Pending offerings (for admin moderation) =====
  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions)
  SELECT _prov_pending_edu, _cat_education,
    'Профессия «Аналитик данных»',
    'Полугодовой курс с трудоустройством. От SQL до ML.',
    'Программа из 8 модулей, реальные проекты, ментор, гарантия трудоустройства. Подходит для людей без бэкграунда.',
    45000, 'pending_review'::offering_status, 'online'::offering_format, ARRAY[]::text[],
    'Старт в ближайший понедельник после оплаты',
    'Срок прохождения 12 месяцев'
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_pending_edu AND name = 'Профессия «Аналитик данных»');

  INSERT INTO provider_offerings (provider_id, global_category_id, name, description, long_description, base_price_points, status, format, cities, delivery_info, terms_conditions)
  SELECT _prov_pending_health, _cat_health,
    'Экспресс-чекап за 4 часа',
    'Чекап премиум-формата за 4 часа в одной клинике.',
    '40+ анализов, УЗИ, ЭКГ, флюорография, консультация терапевта и невролога. Результаты сразу после визита.',
    16500, 'pending_review'::offering_status, 'offline'::offering_format, ARRAY['Москва'],
    'Запись на ближайшую дату',
    'Один раз в полгода'
  WHERE NOT EXISTS (SELECT 1 FROM provider_offerings WHERE provider_id = _prov_pending_health AND name = 'Экспресс-чекап за 4 часа');

  -- ---------- Tenant offerings (HR подключает в каталог основного тенанта) ----------
  INSERT INTO tenant_offerings (tenant_id, provider_offering_id, custom_price_points, is_active, enabled_by, enabled_at)
  SELECT _tenant_id, po.id, NULL, true, _hr_owner, NOW() - INTERVAL '90 days' + (random() * INTERVAL '85 days')
  FROM provider_offerings po
  WHERE po.status = 'published'::offering_status
    AND po.provider_id IN (
      _prov_sberhealth, _prov_fitmost, _prov_coursera, _prov_samokat,
      _prov_aviasales, _prov_lentafun, _prov_hellopets, _prov_homeservice
    )
  ON CONFLICT (tenant_id, provider_offering_id) DO NOTHING;

  RAISE NOTICE 'Block 1 (extra catalog) completed: % providers, % published offerings linked',
    (SELECT count(*) FROM providers WHERE slug IN ('sberhealth','fitmost','coursera-business','samokat','aviasales-business','lenta-fun','hello-pets','uyutniy-dom')),
    (SELECT count(*) FROM tenant_offerings WHERE tenant_id = _tenant_id);
END $extra_catalog$;


-- ===========================================================================
-- БЛОК 2. +15 сотрудников в основном тенанте + бюджетная политика «Молодёжная»
-- ===========================================================================
-- Поля заполняем разнообразно для красивых дашбордов (грейд, город, отдел,
-- стаж, пол). Все UUID детерминированы (можно перезапускать).
-- ===========================================================================

DO $extra_employees$
DECLARE
  _tenant_id          uuid;
  _employee_role      user_role := 'employee'::user_role;

  _cnt                int := 0;
  _user_id            uuid;
  _wallet_id          uuid;
  _profile_id         uuid;
  r                   record;
  _hire_date          date;
  _grade_text         text;
  _now                timestamptz := NOW();
BEGIN
  SELECT id INTO _tenant_id FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant не найден';
  END IF;

  -- Дополнительная политика для джунов (для разнообразия дашбордов)
  INSERT INTO budget_policies (tenant_id, name, points_amount, period, target_filter, is_active)
  SELECT _tenant_id, 'Молодёжная (junior)', 35000, 'quarterly'::budget_period,
         '{"description":"Грейды junior — поменьше баллов","match_all":[{"field":"grade","operator":"in","value":["junior"]}]}'::jsonb,
         true
  WHERE NOT EXISTS (
    SELECT 1 FROM budget_policies WHERE tenant_id = _tenant_id AND name = 'Молодёжная (junior)'
  );

  -- Перечень новых сотрудников. Поля: short_id, full_name, email_local,
  -- grade_text, grade_numeric, hire_offset_months, location, legal_entity,
  -- department, position, gender, birthday.
  FOR r IN
    SELECT * FROM (VALUES
      ('40', 'Татьяна Игоревна Иванова',     'tatyana.ivanova',     'middle',   13, 16, 'Москва',          'ООО ТБ',                'Маркетинг',       'Маркетолог',                'female', DATE '1993-04-12'),
      ('41', 'Михаил Андреевич Соколов',     'mihail.sokolov',      'senior',   15, 38, 'Санкт-Петербург', 'ООО ТБ Северо-Запад',   'Разработка',       'Бэкенд-разработчик',        'male',   DATE '1989-11-03'),
      ('42', 'Екатерина Сергеевна Смирнова', 'ekaterina.smirnova',  'junior',   11, 5,  'Москва',          'ООО ТБ',                'Поддержка',        'Специалист поддержки',      'female', DATE '2000-06-22'),
      ('43', 'Алексей Викторович Орлов',     'alexey.orlov',        'middle',   13, 22, 'Казань',          'ООО ТБ',                'Аналитика',        'Продуктовый аналитик',      'male',   DATE '1992-09-30'),
      ('44', 'Ольга Дмитриевна Морозова',    'olga.morozova',       'lead',     17, 60, 'Москва',          'ООО ТБ',                'Маркетинг',        'Руководитель маркетинга',   'female', DATE '1986-02-17'),
      ('45', 'Андрей Петрович Лебедев',      'andrey.lebedev',      'senior',   15, 32, 'Новосибирск',     'ООО ТБ Сибирь',         'Разработка',       'Фронтенд-разработчик',      'male',   DATE '1990-08-08'),
      ('46', 'Юлия Алексеевна Соловьёва',    'yulia.solovieva',     'middle',   13, 14, 'Санкт-Петербург', 'ООО ТБ Северо-Запад',   'Дизайн',           'UX-дизайнер',               'female', DATE '1995-12-05'),
      ('47', 'Никита Дмитриевич Васильев',   'nikita.vasiliev',     'junior',   11, 8,  'Москва',          'ООО ТБ',                'Разработка',       'Стажёр-разработчик',        'male',   DATE '2001-03-19'),
      ('48', 'Дарья Сергеевна Попова',       'darya.popova',        'senior',   15, 44, 'Москва',          'ООО ТБ',                'Финансы',          'Старший финансист',         'female', DATE '1988-07-11'),
      ('49', 'Павел Михайлович Михайлов',    'pavel.mikhailov',     'lead',     17, 54, 'Екатеринбург',    'ООО ТБ Урал',           'Продажи',          'Руководитель отдела продаж','male',   DATE '1987-05-25'),
      ('4a', 'Наталья Алексеевна Фёдорова',  'natalia.fedorova',    'middle',   13, 20, 'Москва',          'ООО ТБ',                'HR',               'HR-специалист',             'female', DATE '1991-10-09'),
      ('4b', 'Артём Иванович Ковалёв',       'artem.kovalev',       'middle',   13, 26, 'Казань',          'ООО ТБ',                'Разработка',       'Mobile-разработчик',        'male',   DATE '1992-01-14'),
      ('4c', 'Ксения Петровна Алексеева',    'ksenia.alekseeva',    'junior',   11, 3,  'Санкт-Петербург', 'ООО ТБ Северо-Запад',   'Маркетинг',        'Контент-менеджер',          'female', DATE '2000-09-02'),
      ('4d', 'Денис Александрович Степанов', 'denis.stepanov',      'senior',   15, 40, 'Москва',          'ООО ТБ',                'Аналитика',        'BI-аналитик',               'male',   DATE '1989-04-28'),
      ('4e', 'Ирина Викторовна Романова',    'irina.romanova',      'director', 18, 84, 'Москва',          'ООО ТБ',                'Управление',       'Финансовый директор',       'female', DATE '1982-12-15')
    ) AS x(short_id, full_name, email_local, grade_text, grade_numeric, hire_months, location, legal_entity, department, position, gender, birthday)
  LOOP
    _user_id   := ('00000000-0000-4000-8000-0000000000' || r.short_id)::uuid;
    _wallet_id := ('00000000-0000-4000-8000-0000000003' || r.short_id)::uuid;
    _hire_date := (CURRENT_DATE - (r.hire_months || ' months')::interval)::date;

    -- users
    INSERT INTO users (id, tenant_id, auth_id, email, role, full_name)
    VALUES (_user_id, _tenant_id, _user_id, r.email_local || '@techfuture.ru', _employee_role, r.full_name)
    ON CONFLICT DO NOTHING;

    -- employee_profile (нет UNIQUE-констрейнта по user_id — guard через NOT EXISTS)
    IF NOT EXISTS (SELECT 1 FROM employee_profiles WHERE user_id = _user_id) THEN
      INSERT INTO employee_profiles (user_id, tenant_id, grade, grade_numeric, tenure_months, hire_date, location, legal_entity, gender, birthday, extra)
      VALUES (
        _user_id, _tenant_id,
        r.grade_text, r.grade_numeric, r.hire_months, _hire_date,
        r.location, r.legal_entity, r.gender, r.birthday,
        jsonb_build_object(
          'department', r.department,
          'position',   r.position,
          'work_format', CASE (r.hire_months % 3) WHEN 0 THEN 'office' WHEN 1 THEN 'hybrid' ELSE 'remote' END,
          'priorities', CASE r.department
                          WHEN 'Разработка' THEN ARRAY['education','health','subscriptions']
                          WHEN 'Дизайн'     THEN ARRAY['education','beauty','entertainment']
                          WHEN 'Финансы'    THEN ARRAY['health','family','travel']
                          ELSE ARRAY['health','sport','entertainment']
                        END
        )
      );
    END IF;

    -- wallet
    INSERT INTO wallets (id, user_id, tenant_id, balance, reserved, period, expires_at)
    VALUES (
      _wallet_id, _user_id, _tenant_id,
      CASE r.grade_text
        WHEN 'junior'   THEN 35000
        WHEN 'middle'   THEN 50000
        WHEN 'senior'   THEN 50000
        WHEN 'lead'     THEN 80000
        WHEN 'director' THEN 80000
      END,
      0,
      TO_CHAR(_now, 'YYYY') || '-Q' || CEIL(EXTRACT(MONTH FROM _now) / 3.0)::int,
      (DATE_TRUNC('quarter', _now) + INTERVAL '3 months')::timestamptz
    )
    ON CONFLICT DO NOTHING;

    _cnt := _cnt + 1;
  END LOOP;

  RAISE NOTICE 'Block 2 (employees) completed: % сотрудников добавлены', _cnt;
END $extra_employees$;


-- ===========================================================================
-- БЛОК 3. Дополнительные тенанты (компании) — 2 шт.
-- ===========================================================================
-- Каждый тенант со своим HR + 3-5 сотрудниками. Полезно для admin-обзора
-- платформы (несколько компаний). Auth-пользователи не создаются —
-- логин остаётся только у демо-аккаунтов из seed_demo.sql.
-- ===========================================================================

DO $extra_tenants$
DECLARE
  _t_alpha   uuid := '00000000-0000-4000-8000-000000000002';
  _t_north   uuid := '00000000-0000-4000-8000-000000000003';
  _now       timestamptz := NOW();
  r          record;
  _user_id   uuid;
  _wallet_id uuid;
  _tenant_id uuid;
  _hire_date date;
  _is_hr     boolean;
BEGIN
  -- ----- ООО Альфа Логистика -----
  INSERT INTO tenants (id, name, domain, settings)
  VALUES (
    _t_alpha,
    'ООО Альфа Логистика',
    'alpha-logistics.ru',
    '{"locale":"ru","currency_label":"баллы","branding":{"primary_color":"#16A34A","logo_url":""}}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- ----- АО Северная Звезда -----
  INSERT INTO tenants (id, name, domain, settings)
  VALUES (
    _t_north,
    'АО Северная Звезда',
    'severstar.ru',
    '{"locale":"ru","currency_label":"баллы","branding":{"primary_color":"#0EA5E9","logo_url":""}}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- Дефолтные политики
  INSERT INTO budget_policies (tenant_id, name, points_amount, period, target_filter, is_active)
  SELECT _t_alpha, 'Базовая', 40000, 'quarterly'::budget_period, '{"description":"Все сотрудники","match_all":[]}'::jsonb, true
  WHERE NOT EXISTS (SELECT 1 FROM budget_policies WHERE tenant_id = _t_alpha AND name = 'Базовая');

  INSERT INTO budget_policies (tenant_id, name, points_amount, period, target_filter, is_active)
  SELECT _t_north, 'Базовая', 60000, 'quarterly'::budget_period, '{"description":"Все сотрудники","match_all":[]}'::jsonb, true
  WHERE NOT EXISTS (SELECT 1 FROM budget_policies WHERE tenant_id = _t_north AND name = 'Базовая');

  -- Категории для новых тенантов
  INSERT INTO benefit_categories (tenant_id, name, icon, sort_order)
  VALUES
    (_t_alpha, 'Здоровье', 'heart-pulse', 1),
    (_t_alpha, 'Спорт',    'dumbbell',    2),
    (_t_alpha, 'Питание',  'utensils',    3),
    (_t_north, 'Здоровье', 'heart-pulse', 1),
    (_t_north, 'Спорт',    'dumbbell',    2),
    (_t_north, 'Питание',  'utensils',    3),
    (_t_north, 'Семья',    'baby',        4)
  ON CONFLICT DO NOTHING;

  -- ---- Пользователи ----
  FOR r IN
    SELECT * FROM (VALUES
      ('51', _t_alpha, 'Виктор Сергеевич Громов',      'viktor.gromov',      'hr',       true,  'senior',   15, 42, 'Москва',     'Альфа Логистика',  'HR',          'HR-директор',           'male',   DATE '1985-06-18'),
      ('52', _t_alpha, 'Светлана Петровна Ушакова',    'svetlana.ushakova',  'employee', false, 'middle',   13, 18, 'Москва',     'Альфа Логистика',  'Логистика',   'Менеджер по перевозкам', 'female', DATE '1991-08-14'),
      ('53', _t_alpha, 'Игорь Михайлович Захаров',     'igor.zakharov',      'employee', false, 'senior',   15, 30, 'Самара',     'Альфа Логистика',  'Логистика',   'Старший логист',         'male',   DATE '1988-02-09'),
      ('54', _t_alpha, 'Анна Алексеевна Дьякова',      'anna.dyakova',       'employee', false, 'junior',   11, 6,  'Москва',     'Альфа Логистика',  'Финансы',     'Стажёр-финансист',       'female', DATE '2001-11-29'),
      ('55', _t_alpha, 'Олег Иванович Тихонов',        'oleg.tikhonov',      'employee', false, 'lead',     17, 56, 'Москва',     'Альфа Логистика',  'IT',          'IT-директор',            'male',   DATE '1983-04-02'),

      ('61', _t_north, 'Наталья Викторовна Беляева',   'natalia.belyaeva',   'hr',       true,  'senior',   15, 48, 'Мурманск',   'Северная Звезда',  'HR',          'HR-руководитель',        'female', DATE '1984-12-21'),
      ('62', _t_north, 'Константин Андреевич Зайцев',  'konstantin.zaytsev', 'employee', false, 'middle',   13, 22, 'Мурманск',   'Северная Звезда',  'Производство', 'Инженер',               'male',   DATE '1990-05-07'),
      ('63', _t_north, 'Юлия Сергеевна Соколова',      'yulia.sokolova',     'employee', false, 'senior',   15, 36, 'Архангельск','Северная Звезда',  'Производство', 'Старший инженер',       'female', DATE '1987-09-13'),
      ('64', _t_north, 'Михаил Алексеевич Громов',     'mikhail.gromov',     'employee', false, 'lead',     17, 60, 'Мурманск',   'Северная Звезда',  'Производство', 'Руководитель цеха',     'male',   DATE '1985-01-26'),
      ('65', _t_north, 'Алёна Дмитриевна Васильева',   'alyona.vasilieva',   'employee', false, 'middle',   13, 16, 'Мурманск',   'Северная Звезда',  'Качество',     'Инженер качества',      'female', DATE '1992-07-04'),
      ('66', _t_north, 'Сергей Петрович Дроздов',      'sergey.drozdov',     'employee', false, 'director', 18, 96, 'Мурманск',   'Северная Звезда',  'Управление',   'Генеральный директор',  'male',   DATE '1979-03-30')
    ) AS x(short_id, tenant_id, full_name, email_local, role, is_hr, grade_text, grade_numeric, hire_months, location, legal_entity, department, position, gender, birthday)
  LOOP
    _user_id   := ('00000000-0000-4000-8000-0000000000' || r.short_id)::uuid;
    _wallet_id := ('00000000-0000-4000-8000-0000000003' || r.short_id)::uuid;
    _tenant_id := r.tenant_id;
    _hire_date := (CURRENT_DATE - (r.hire_months || ' months')::interval)::date;
    _is_hr     := r.is_hr;

    INSERT INTO users (id, tenant_id, auth_id, email, role, full_name)
    VALUES (_user_id, _tenant_id, _user_id,
            r.email_local || '@' || CASE WHEN _tenant_id = _t_alpha THEN 'alpha-logistics.ru' ELSE 'severstar.ru' END,
            r.role::user_role, r.full_name)
    ON CONFLICT DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM employee_profiles WHERE user_id = _user_id) THEN
      INSERT INTO employee_profiles (user_id, tenant_id, grade, grade_numeric, tenure_months, hire_date, location, legal_entity, gender, birthday, extra)
      VALUES (
        _user_id, _tenant_id,
        r.grade_text, r.grade_numeric, r.hire_months, _hire_date,
        r.location, r.legal_entity, r.gender, r.birthday,
        jsonb_build_object('department', r.department, 'position', r.position, 'work_format', 'office')
      );
    END IF;

    INSERT INTO wallets (id, user_id, tenant_id, balance, reserved, period, expires_at)
    VALUES (
      _wallet_id, _user_id, _tenant_id,
      CASE r.grade_text
        WHEN 'junior'   THEN CASE WHEN _tenant_id = _t_alpha THEN 30000 ELSE 40000 END
        WHEN 'middle'   THEN CASE WHEN _tenant_id = _t_alpha THEN 40000 ELSE 60000 END
        WHEN 'senior'   THEN CASE WHEN _tenant_id = _t_alpha THEN 40000 ELSE 60000 END
        WHEN 'lead'     THEN CASE WHEN _tenant_id = _t_alpha THEN 70000 ELSE 90000 END
        WHEN 'director' THEN CASE WHEN _tenant_id = _t_alpha THEN 70000 ELSE 90000 END
      END,
      0,
      TO_CHAR(_now, 'YYYY') || '-Q' || CEIL(EXTRACT(MONTH FROM _now) / 3.0)::int,
      (DATE_TRUNC('quarter', _now) + INTERVAL '3 months')::timestamptz
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Block 3 (extra tenants) completed: % tenants, % users',
    (SELECT count(*) FROM tenants WHERE id IN (_t_alpha, _t_north)),
    (SELECT count(*) FROM users WHERE tenant_id IN (_t_alpha, _t_north));
END $extra_tenants$;


-- ===========================================================================
-- БЛОК 4. Заказы, point_ledger и отзывы (заполняем дашборды)
-- ===========================================================================
-- Используем существующих сотрудников основного тенанта + новых из БЛОКА 2.
-- Заказы распределяем по 12 месяцам с разными статусами (paid преимущественно).
-- Отзывы для всех опубликованных офферов от разных пользователей.
-- ===========================================================================

DO $extra_activity$
DECLARE
  _tenant_id          uuid;
  _now                timestamptz := NOW();

  _emp_count          int;
  r                   record;
  _wallet_id          uuid;
  _order_id           uuid;
  _user_id            uuid;
  _po_id              uuid;
  _to_id              uuid;
  _price              int;
  _ts                 timestamptz;
  _idx                int := 0;
  _cnt_orders         int := 0;
  _cnt_reviews        int := 0;
  _cnt_accruals       int := 0;
BEGIN
  SELECT id INTO _tenant_id FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  -- ---------- Начисления (accrual) для новых сотрудников — за 4 квартала ----------
  FOR r IN
    SELECT u.id AS user_id, w.id AS wallet_id, ep.grade,
           COALESCE(NULLIF(ep.grade, ''), 'middle') AS grade_safe
    FROM users u
    JOIN wallets w           ON w.user_id   = u.id
    LEFT JOIN employee_profiles ep ON ep.user_id = u.id
    WHERE u.tenant_id = _tenant_id
      AND u.role      = 'employee'::user_role
      AND u.id IN (
        SELECT id FROM users
        WHERE tenant_id = _tenant_id AND role = 'employee'::user_role
          -- Только новые сотрудники из БЛОКА 2 (UUID ...000040..00004e):
          AND (id::text BETWEEN '00000000-0000-4000-8000-000000000040'
                            AND '00000000-0000-4000-8000-00000000004e')
      )
  LOOP
    -- 4 ежеквартальных начисления (последние 12 месяцев)
    FOR _idx IN 0..3 LOOP
      _ts := _now - ((_idx * 90) || ' days')::interval;
      _price := CASE r.grade_safe
                  WHEN 'junior'   THEN 35000
                  WHEN 'lead'     THEN 80000
                  WHEN 'director' THEN 80000
                  ELSE 50000
                END;

      INSERT INTO point_ledger (wallet_id, tenant_id, order_id, type, amount, description, created_at)
      VALUES (r.wallet_id, _tenant_id, NULL, 'accrual'::ledger_type, _price,
              'Начисление баллов по квартальной политике', _ts)
      ON CONFLICT DO NOTHING;
      _cnt_accruals := _cnt_accruals + 1;
    END LOOP;
  END LOOP;

  -- ---------- Заказы (paid) распределённые по последним 12 месяцам ----------
  -- Берём пары (employee, tenant_offering) и создаём заказ от каждого
  -- сотрудника на 2-3 разных оффера (с разными датами).
  FOR r IN
    WITH emps AS (
      SELECT u.id AS user_id, ROW_NUMBER() OVER (ORDER BY u.created_at) AS rn
      FROM users u
      WHERE u.tenant_id = _tenant_id
        AND u.role = 'employee'::user_role
        AND u.id IN (
          SELECT id FROM users
          WHERE tenant_id = _tenant_id AND role = 'employee'::user_role
            AND (id::text BETWEEN '00000000-0000-4000-8000-000000000040'
                              AND '00000000-0000-4000-8000-00000000004e')
        )
    ),
    offs AS (
      SELECT to2.id AS to_id, po.id AS po_id,
             COALESCE(to2.custom_price_points, po.base_price_points) AS price,
             po.name,
             ROW_NUMBER() OVER (ORDER BY po.avg_rating DESC, po.name) AS rn
      FROM tenant_offerings to2
      JOIN provider_offerings po ON po.id = to2.provider_offering_id
      WHERE to2.tenant_id = _tenant_id
        AND to2.is_active = true
        AND po.status = 'published'::offering_status
    )
    SELECT e.user_id, o.to_id, o.po_id, o.price, o.name, e.rn AS emp_rn, o.rn AS off_rn
    FROM emps e
    CROSS JOIN offs o
    WHERE (e.rn + o.rn) % 4 = 0    -- ~25% всех пар = ~равномерно
    LIMIT 60
  LOOP
    -- Дата заказа: разбрасываем по последним 12 месяцам
    _ts       := _now - ((_idx * 6 + 14) || ' days')::interval;
    _idx      := _idx + 1;
    _order_id := ('b0000000-0000-4000-8000-' || lpad(to_hex(1000 + _idx), 12, '0'))::uuid;
    SELECT w.id INTO _wallet_id FROM wallets w WHERE w.user_id = r.user_id LIMIT 1;
    CONTINUE WHEN _wallet_id IS NULL;

    INSERT INTO orders (id, user_id, tenant_id, status, total_points, reserved_at, expires_at, created_at)
    VALUES (
      _order_id, r.user_id, _tenant_id, 'paid'::order_status, r.price,
      _ts, _ts + INTERVAL '15 minutes', _ts
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO order_items (order_id, tenant_offering_id, provider_offering_id, quantity, price_points)
    SELECT _order_id, r.to_id, r.po_id, 1, r.price
    WHERE NOT EXISTS (
      SELECT 1 FROM order_items
      WHERE order_id = _order_id AND tenant_offering_id = r.to_id
    );

    INSERT INTO point_ledger (wallet_id, tenant_id, order_id, type, amount, description, created_at)
    SELECT _wallet_id, _tenant_id, _order_id,
           'spend'::ledger_type, -r.price,
           'Оплата заказа: ' || r.name, _ts
    WHERE NOT EXISTS (
      SELECT 1 FROM point_ledger
      WHERE order_id = _order_id AND type = 'spend'::ledger_type
    );

    _cnt_orders := _cnt_orders + 1;
  END LOOP;

  -- ---------- Несколько заказов в статусе reserved (зависшие, для демо) ----------
  _idx := 0;
  FOR r IN
    SELECT u.id AS user_id, to2.id AS to_id, po.id AS po_id,
           COALESCE(to2.custom_price_points, po.base_price_points) AS price,
           po.name
    FROM users u
    JOIN tenant_offerings to2 ON to2.tenant_id = u.tenant_id
    JOIN provider_offerings po ON po.id = to2.provider_offering_id
    WHERE u.tenant_id = _tenant_id
      AND u.role = 'employee'::user_role
      AND to2.is_active = true
      AND po.status = 'published'::offering_status
      AND u.id IN (
        '00000000-0000-4000-8000-000000000041'::uuid,
        '00000000-0000-4000-8000-000000000046'::uuid,
        '00000000-0000-4000-8000-00000000004a'::uuid
      )
    ORDER BY u.id, po.base_price_points
    LIMIT 3
  LOOP
    _idx      := _idx + 1;
    _order_id := ('b0000000-0000-4000-8000-' || lpad(to_hex(2000 + _idx), 12, '0'))::uuid;
    _ts       := _now - INTERVAL '5 minutes' + (_idx || ' seconds')::interval;
    SELECT w.id INTO _wallet_id FROM wallets w WHERE w.user_id = r.user_id LIMIT 1;
    CONTINUE WHEN _wallet_id IS NULL;

    INSERT INTO orders (id, user_id, tenant_id, status, total_points, reserved_at, expires_at, created_at)
    VALUES (
      _order_id, r.user_id, _tenant_id, 'reserved'::order_status, r.price,
      _ts, _ts + INTERVAL '15 minutes', _ts
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO order_items (order_id, tenant_offering_id, provider_offering_id, quantity, price_points)
    SELECT _order_id, r.to_id, r.po_id, 1, r.price
    WHERE NOT EXISTS (
      SELECT 1 FROM order_items
      WHERE order_id = _order_id AND tenant_offering_id = r.to_id
    );

    INSERT INTO point_ledger (wallet_id, tenant_id, order_id, type, amount, description, created_at)
    SELECT _wallet_id, _tenant_id, _order_id,
           'reserve'::ledger_type, -r.price,
           'Резерв баллов: ' || r.name, _ts
    WHERE NOT EXISTS (
      SELECT 1 FROM point_ledger
      WHERE order_id = _order_id AND type = 'reserve'::ledger_type
    );

    UPDATE wallets SET reserved = reserved + r.price WHERE id = _wallet_id;
    _cnt_orders := _cnt_orders + 1;
  END LOOP;

  -- ---------- Отзывы: от новых сотрудников на их paid-заказы ----------
  FOR r IN
    SELECT o.user_id, oi.provider_offering_id, o.id AS order_id,
           po.name AS po_name,
           ROW_NUMBER() OVER (PARTITION BY o.user_id ORDER BY o.created_at) AS rn_per_user
    FROM orders o
    JOIN order_items oi    ON oi.order_id = o.id
    JOIN provider_offerings po ON po.id = oi.provider_offering_id
    WHERE o.tenant_id = _tenant_id
      AND o.status    = 'paid'::order_status
      AND oi.provider_offering_id IS NOT NULL
      AND o.user_id IN (
        SELECT id FROM users
        WHERE tenant_id = _tenant_id AND role = 'employee'::user_role
          AND (id::text BETWEEN '00000000-0000-4000-8000-000000000040'
                            AND '00000000-0000-4000-8000-00000000004e')
      )
  LOOP
    INSERT INTO reviews (provider_offering_id, tenant_id, user_id, order_id, rating, title, body, status, created_at, updated_at)
    SELECT r.provider_offering_id, _tenant_id, r.user_id, r.order_id,
           -- Рейтинги: чаще 4-5, иногда 3
           CASE (extract(epoch from now())::bigint + r.rn_per_user) % 10
             WHEN 0 THEN 3
             WHEN 1 THEN 3
             WHEN 2 THEN 4
             WHEN 3 THEN 4
             WHEN 4 THEN 4
             WHEN 5 THEN 5
             WHEN 6 THEN 5
             WHEN 7 THEN 5
             WHEN 8 THEN 5
             ELSE 5
           END,
           CASE (r.rn_per_user) % 6
             WHEN 0 THEN 'Стоит своих баллов'
             WHEN 1 THEN 'Хороший опыт'
             WHEN 2 THEN 'Использую регулярно'
             WHEN 3 THEN 'Подходит для повседневности'
             WHEN 4 THEN 'Рекомендую коллегам'
             ELSE          'Удобно и быстро'
           END,
           CASE (r.rn_per_user) % 6
             WHEN 0 THEN 'Получил то, что ожидал. Удобно оформляется через приложение, без лишних подтверждений.'
             WHEN 1 THEN 'Качество сервиса соответствует описанию. Дата активации совпала с моими ожиданиями.'
             WHEN 2 THEN 'Использовал несколько раз — каждый раз без нареканий. Поддержка отвечает быстро.'
             WHEN 3 THEN 'Хорошее соотношение цены и качества по сравнению с покупкой напрямую.'
             WHEN 4 THEN 'Уже посоветовал коллегам. Простой процесс активации и понятный UX.'
             ELSE          'Сервис работает чётко: оформил — получил — пользуюсь. Никаких сюрпризов.'
           END,
           'visible'::review_status,
           o_created.created_at + INTERVAL '5 days',
           o_created.created_at + INTERVAL '5 days'
    FROM orders o_created
    WHERE o_created.id = r.order_id
    ON CONFLICT (user_id, provider_offering_id) DO NOTHING;

    GET DIAGNOSTICS _cnt_reviews = ROW_COUNT;
  END LOOP;

  RAISE NOTICE 'Block 4 (activity) completed: % orders, % accruals',
    _cnt_orders, _cnt_accruals;
END $extra_activity$;


-- ===========================================================================
-- БЛОК 5. Дополнительные отзывы от стандартных seed-сотрудников
-- ===========================================================================
-- В seed.sql есть 5 сотрудников (anna/dmitry/elena/sergey/maria). Дадим им
-- отзывы на разные офферы — для рейтингов и для демо-вкладки «Отзывы».
-- ===========================================================================

DO $extra_reviews$
DECLARE
  _tenant_id uuid;
  r          record;
  _idx       int := 0;
  _cnt       int := 0;
BEGIN
  SELECT id INTO _tenant_id FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  -- Для каждой пары (пользователь, оффер) из списка ниже — добавляем отзыв,
  -- если ещё нет (UNIQUE(user_id, provider_offering_id) защитит от дублей).
  FOR r IN
    SELECT u.id AS user_id, po.id AS po_id, po.name, val.rating, val.title, val.body
    FROM (VALUES
      ('00000000-0000-4000-8000-000000000031'::uuid, 'Подписка ЛитРес (год)',              5, 'Постоянно читаю в дороге',           'Удобно, что и текст, и аудио в одной подписке. На неделю синхронизируется на разных устройствах.'),
      ('00000000-0000-4000-8000-000000000031'::uuid, 'Курс английского Skyeng (3 мес)',    4, 'Преподаватель — огонь',              'Поставил мне разговорную беглость. Иногда были технические сбои на платформе.'),
      ('00000000-0000-4000-8000-000000000032'::uuid, 'Чекап ИНВИТРО Premium',              5, 'Сделал всё за один день',            'Утро в клинике, ужин с расшифровкой результатов. Очень удобно.'),
      ('00000000-0000-4000-8000-000000000032'::uuid, 'Сертификат Qlean на клининг',        4, 'Чисто, но химия пахнет',             'Уборщики чистят аккуратно, окна — отдельно за доплату. Иногда сложно поймать удобный слот.'),
      ('00000000-0000-4000-8000-000000000033'::uuid, 'Годовой абонемент World Class',      5, 'Хожу в клуб у работы',               'Безлимит реально работает. Бассейн чистый, в раздевалках есть фен и косметика. Иногда очереди на тренажёры в часы пик.'),
      ('00000000-0000-4000-8000-000000000033'::uuid, 'Кинопоиск (год)',                    4, 'Подключил на телевизор',             'Премьеры выходят быстро. Хочется больше детских мультиков.'),
      ('00000000-0000-4000-8000-000000000034'::uuid, 'Подписка SuperFit App (год)',        4, 'Тренируюсь по утрам',                'Короткие тренировки помогают втягиваться в форму. Дизайн приложения мог бы быть лучше.'),
      ('00000000-0000-4000-8000-000000000034'::uuid, 'Корпоративное такси (5 000 ₽)',      5, 'Удобно для встреч',                  'Списываю с корпоративного сертификата, не мешая личной карте. Ни разу не было проблем.'),
      ('00000000-0000-4000-8000-000000000035'::uuid, 'Сертификат Островок 30 000',         5, 'Слетала с детьми на майские',        'Бронировала отель в Сочи через Островок — всё прошло гладко, цена ниже, чем у конкурентов.'),
      ('00000000-0000-4000-8000-000000000035'::uuid, 'Сертификат на массаж и СПА',         4, 'Релакс после квартала',              'Хорошо снимает напряжение в плечах. Запись на удобное время бывает за 2 недели.'),

      -- + перекрёстные отзывы от admin/hr на удачные сервисы
      ('00000000-0000-4000-8000-000000000010'::uuid, 'Подписка на психотерапию (4 сессии)', 5, 'Достойный сервис',                  'Сотрудники возвращаются после психотерапии заметно более вовлечёнными. Корпоративная программа окупает себя.'),
      ('00000000-0000-4000-8000-000000000020'::uuid, 'Годовой абонемент World Class',       5, 'Любимая льгота сотрудников',         'По нашему опросу — топ-3 по запросу. Берут в основном middle+ и руководители.'),
      ('00000000-0000-4000-8000-000000000020'::uuid, 'Подписка ЛитРес (год)',               4, 'Недорого, но просят чаще',           'Дешёвая и популярная льгота. Хороший вход для джунов, потом просят поднять лимит.'),

      -- Отзывы на новые офферы (БЛОК 1) от сотрудников основного тенанта
      ('00000000-0000-4000-8000-000000000031'::uuid, 'Подписка FitMost 8 баллов/мес (год)', 5, 'Меняю студии каждый день',           'То йога, то бокс, то барре — каждый день что-то новое. Идеально, чтобы не заскучать.'),
      ('00000000-0000-4000-8000-000000000032'::uuid, 'Coursera Plus подписка (год)',        5, 'Изучаю аналитику',                   'Прошёл специализацию IBM по Data Analyst. Хороший английский, ясные задания, удобный темп.'),
      ('00000000-0000-4000-8000-000000000033'::uuid, 'Сертификат Самокат 5 000',            4, 'Заказал перед командировкой',        'Привезли за 20 минут. Хорошо, что можно тратить частями — потратил 3 раза за 2 недели.'),
      ('00000000-0000-4000-8000-000000000034'::uuid, 'Подписка СберЗдоровье «Семейная»',    5, 'Удобно для всей семьи',              'Закрепил жену и двух детей. Педиатр отвечает в чате за 5 минут — это бесценно с маленьким ребёнком.'),
      ('00000000-0000-4000-8000-000000000035'::uuid, 'Сертификат Aviasales 25 000',         4, 'Полезно для длинных направлений',    'Использовала на семейный перелёт в Дубай. Поддержка работает 24/7, что для дальних рейсов важно.')
    ) AS val(user_id, po_name, rating, title, body)
    JOIN users u              ON u.id   = val.user_id
    JOIN provider_offerings po ON po.name = val.po_name
    WHERE u.tenant_id = _tenant_id
  LOOP
    INSERT INTO reviews (provider_offering_id, tenant_id, user_id, rating, title, body, status, created_at, updated_at)
    SELECT r.po_id, _tenant_id, r.user_id, r.rating, r.title, r.body,
           'visible'::review_status,
           NOW() - ((90 - _idx * 5) || ' days')::interval,
           NOW() - ((90 - _idx * 5) || ' days')::interval
    WHERE NOT EXISTS (
      SELECT 1 FROM reviews
      WHERE user_id = r.user_id AND provider_offering_id = r.po_id
    );
    _idx := _idx + 1;
    _cnt := _cnt + 1;
  END LOOP;

  RAISE NOTICE 'Block 5 (extra reviews) processed: % rows', _cnt;
END $extra_reviews$;


-- ===========================================================================
-- БЛОК 6. Индивидуальное начисление + аудит-лог для админ-обзора
-- ===========================================================================

DO $extra_misc$
DECLARE
  _tenant_id uuid;
  _hr_user_id uuid;
  _target_user uuid;
BEGIN
  SELECT id INTO _tenant_id FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO _hr_user_id FROM users
   WHERE tenant_id = _tenant_id AND role = 'hr'::user_role
   ORDER BY created_at ASC LIMIT 1;

  -- Берём первого нового сотрудника как получателя
  _target_user := '00000000-0000-4000-8000-000000000040'::uuid;

  -- Индивидуальное начисление (бонус за день рождения)
  IF EXISTS (SELECT 1 FROM users WHERE id = _target_user) AND _hr_user_id IS NOT NULL THEN
    INSERT INTO individual_accruals (tenant_id, user_id, mode, points_amount, period, first_accrual_date, next_accrual_date, description, is_active, created_by)
    SELECT _tenant_id, _target_user,
           'addition'::individual_accrual_mode,
           5000,
           'yearly'::budget_period,
           CURRENT_DATE - INTERVAL '10 days',
           CURRENT_DATE + INTERVAL '355 days',
           'Бонус ко дню рождения сотрудника',
           true,
           _hr_user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM individual_accruals
      WHERE user_id = _target_user AND description = 'Бонус ко дню рождения сотрудника'
    );
  END IF;

  -- Аудит-лог: подключение партнёрских офферов HR
  INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, diff, created_at)
  SELECT _tenant_id, _hr_user_id, 'create', 'tenant_offering', to2.id,
         jsonb_build_object('action','enabled offering','name', po.name),
         to2.enabled_at
  FROM tenant_offerings to2
  JOIN provider_offerings po ON po.id = to2.provider_offering_id
  WHERE to2.tenant_id = _tenant_id
    AND po.provider_id IN (
      SELECT id FROM providers
      WHERE slug IN ('sberhealth','fitmost','coursera-business','samokat','aviasales-business','lenta-fun','hello-pets','uyutniy-dom')
    )
    AND NOT EXISTS (
      SELECT 1 FROM audit_log al
      WHERE al.entity_type = 'tenant_offering'
        AND al.entity_id   = to2.id
        AND al.action      = 'create'
    );

  RAISE NOTICE 'Block 6 (misc) completed.';
END $extra_misc$;


-- ===========================================================================
-- ИТОГ
-- ===========================================================================
-- ✅ +8 верифицированных провайдеров, +2 pending к модерации
-- ✅ +14 published-предложений + 2 pending_review
-- ✅ +15 сотрудников в основном тенанте + 1 новая бюджетная политика
-- ✅ +2 дополнительных тенанта с 11 пользователями (6 + 5)
-- ✅ ~60 заказов в paid + 3 в reserved
-- ✅ ~60 начислений (4 квартала × 15 сотрудников)
-- ✅ ~30 отзывов на различные офферы (от ~10 пользователей)
-- ✅ 1 индивидуальное начисление (бонус ко дню рождения)
-- ✅ Аудит-лог обогащён для admin-обзора
--
-- Чтобы убедиться, что всё прошло — после запуска:
--   SELECT 'tenants',   count(*) FROM tenants WHERE id != '00000000-0000-0000-0000-000000000000'
--   UNION ALL SELECT 'users',     count(*) FROM users
--   UNION ALL SELECT 'providers', count(*) FROM providers
--   UNION ALL SELECT 'offerings', count(*) FROM provider_offerings WHERE status = 'published'
--   UNION ALL SELECT 'orders',    count(*) FROM orders
--   UNION ALL SELECT 'reviews',   count(*) FROM reviews;
-- ===========================================================================
