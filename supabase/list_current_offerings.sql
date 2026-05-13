-- Выписать все льготы в основном тенанте: имя, провайдер, категория, цена
DO $listing$
DECLARE
  r RECORD;
  _main_tenant uuid;
  _n int := 0;
BEGIN
  SELECT id INTO _main_tenant FROM tenants
   WHERE id != '00000000-0000-0000-0000-000000000000'
   ORDER BY created_at ASC LIMIT 1;

  RAISE NOTICE '=== Текущий каталог в основном тенанте ===';
  FOR r IN
    SELECT
      po.name        AS offering_name,
      p.name         AS provider_name,
      gc.name        AS category_name,
      COALESCE(t.custom_price_points, po.base_price_points) AS price,
      po.status      AS status
    FROM tenant_offerings t
    JOIN provider_offerings po ON po.id = t.provider_offering_id
    LEFT JOIN providers p ON p.id = po.provider_id
    LEFT JOIN global_categories gc ON gc.id = po.global_category_id
    WHERE t.tenant_id = _main_tenant
      AND t.is_active = true
      AND po.status = 'published'
    ORDER BY p.name, po.name
  LOOP
    _n := _n + 1;
    RAISE NOTICE '%. [%] % — % (% pts)', _n, r.category_name, r.offering_name, r.provider_name, r.price;
  END LOOP;
  RAISE NOTICE '=== Всего: % льгот ===', _n;
END $listing$;
