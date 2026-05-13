-- ===========================================================================
-- Диагностика: куда залились демо-заказы и какой тенант у живых HR
-- ===========================================================================

\echo '--- 1) Все тенанты в БД ---'
SELECT id, name, created_at
FROM tenants
ORDER BY created_at;

\echo ''
\echo '--- 2) HR-пользователи (role=hr) с их тенантом и кол-вом paid-заказов в их тенанте ---'
SELECT
  u.id           AS user_id,
  u.email,
  u.tenant_id,
  t.name         AS tenant_name,
  (SELECT count(*) FROM orders o
     WHERE o.tenant_id = u.tenant_id AND o.status = 'paid') AS paid_orders_in_tenant
FROM users u
LEFT JOIN tenants t ON t.id = u.tenant_id
WHERE u.role = 'hr'
ORDER BY u.created_at;

\echo ''
\echo '--- 3) Paid-заказы по тенантам (где они лежат) ---'
SELECT
  o.tenant_id,
  t.name AS tenant_name,
  count(*) AS paid_orders,
  min(o.created_at)::date AS earliest,
  max(o.created_at)::date AS latest
FROM orders o
LEFT JOIN tenants t ON t.id = o.tenant_id
WHERE o.status = 'paid'
GROUP BY o.tenant_id, t.name
ORDER BY paid_orders DESC;

\echo ''
\echo '--- 4) Top-10 по seed-тенанту (00000000-...-0001) ---'
SELECT b.name, count(*) AS orders, sum(oi.price_points) AS pts
FROM order_items oi
JOIN orders o   ON o.id = oi.order_id
JOIN benefits b ON b.id = oi.benefit_id
WHERE o.tenant_id = '00000000-0000-4000-8000-000000000001'
  AND o.status = 'paid'
GROUP BY b.name
ORDER BY orders DESC, pts DESC
LIMIT 10;

\echo ''
\echo '--- 5) legal_entity сотрудников seed-тенанта ---'
SELECT legal_entity, count(*) AS cnt
FROM employee_profiles
WHERE tenant_id = '00000000-0000-4000-8000-000000000001'
GROUP BY legal_entity;
