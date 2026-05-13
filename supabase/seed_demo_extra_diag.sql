-- Диагностика что фактически в БД после seed_demo_extra.sql
DO $diag$
DECLARE
  _t_main      uuid;
  _tenant_cnt  int;
BEGIN
  SELECT id INTO _t_main FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  RAISE NOTICE '---- diag report ----';
  RAISE NOTICE 'tenants total:           %', (SELECT count(*) FROM tenants);
  RAISE NOTICE 'main tenant id picked:   %', _t_main;
  RAISE NOTICE 'main tenant name:        %', (SELECT name FROM tenants WHERE id = _t_main);

  RAISE NOTICE 'providers total:         %', (SELECT count(*) FROM providers);
  RAISE NOTICE 'providers new slugs:     %', (SELECT count(*) FROM providers
    WHERE slug IN ('sberhealth','fitmost','coursera-business','samokat',
                   'aviasales-business','lenta-fun','hello-pets','uyutniy-dom'));

  RAISE NOTICE 'provider_offerings total: %', (SELECT count(*) FROM provider_offerings);
  RAISE NOTICE 'PO from new providers:    %', (SELECT count(*) FROM provider_offerings
    WHERE provider_id IN (SELECT id FROM providers
      WHERE slug IN ('sberhealth','fitmost','coursera-business','samokat',
                     'aviasales-business','lenta-fun','hello-pets','uyutniy-dom')));
  RAISE NOTICE 'PO from new (published):  %', (SELECT count(*) FROM provider_offerings
    WHERE status = 'published'
      AND provider_id IN (SELECT id FROM providers
        WHERE slug IN ('sberhealth','fitmost','coursera-business','samokat',
                       'aviasales-business','lenta-fun','hello-pets','uyutniy-dom')));

  RAISE NOTICE 'tenant_offerings total:           %', (SELECT count(*) FROM tenant_offerings);
  RAISE NOTICE 'tenant_offerings for main:        %', (SELECT count(*) FROM tenant_offerings WHERE tenant_id = _t_main);
  RAISE NOTICE 'tenant_offerings for main active: %', (SELECT count(*) FROM tenant_offerings WHERE tenant_id = _t_main AND is_active = true);

  RAISE NOTICE 'users total:                      %', (SELECT count(*) FROM users);
  RAISE NOTICE 'users in main tenant:             %', (SELECT count(*) FROM users WHERE tenant_id = _t_main);
  RAISE NOTICE 'employees in main tenant:         %', (SELECT count(*) FROM employee_profiles WHERE tenant_id = _t_main);
  RAISE NOTICE 'orders total:                     %', (SELECT count(*) FROM orders);
  RAISE NOTICE 'orders for main tenant:           %', (SELECT count(*) FROM orders WHERE tenant_id = _t_main);

  -- Подробнее по новым провайдерам:
  FOR _tenant_cnt IN
    SELECT 1 FROM providers p
    WHERE p.slug IN ('sberhealth','fitmost','coursera-business','samokat',
                     'aviasales-business','lenta-fun','hello-pets','uyutniy-dom')
  LOOP
    NULL;
  END LOOP;

  RAISE NOTICE '---- per-new-provider breakdown ----';
  FOR _tenant_cnt IN
    SELECT 1
  LOOP
    NULL;
  END LOOP;

  -- Используем cursor для красивого вывода
  PERFORM (
    SELECT string_agg(format('%s: % PO, % active_TO', p.slug,
       (SELECT count(*) FROM provider_offerings po WHERE po.provider_id = p.id),
       (SELECT count(*) FROM tenant_offerings t WHERE t.provider_offering_id IN
          (SELECT id FROM provider_offerings WHERE provider_id = p.id) AND t.tenant_id = _t_main)
    ), E'\n')
    FROM providers p
    WHERE p.slug IN ('sberhealth','fitmost','coursera-business','samokat',
                     'aviasales-business','lenta-fun','hello-pets','uyutniy-dom')
  );

END $diag$;

-- Расширенный отчёт через RAISE INFO (видно в логах workflow):
DO $diag2$
DECLARE
  r RECORD;
  _t_main uuid;
BEGIN
  SELECT id INTO _t_main FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  FOR r IN
    SELECT p.slug,
      (SELECT count(*) FROM provider_offerings po WHERE po.provider_id = p.id) AS po_total,
      (SELECT count(*) FROM provider_offerings po WHERE po.provider_id = p.id AND po.status = 'published') AS po_pub,
      (SELECT count(*) FROM tenant_offerings t
         WHERE t.tenant_id = _t_main
           AND t.provider_offering_id IN (SELECT id FROM provider_offerings WHERE provider_id = p.id)) AS to_main
    FROM providers p
    WHERE p.slug IN ('sberhealth','fitmost','coursera-business','samokat',
                     'aviasales-business','lenta-fun','hello-pets','uyutniy-dom')
    ORDER BY p.slug
  LOOP
    RAISE NOTICE 'provider %: PO=% (pub=%), TO in main=%', r.slug, r.po_total, r.po_pub, r.to_main;
  END LOOP;
END $diag2$;
