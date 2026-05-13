-- Диагностика тенанта ООО Ромашка
-- tenant_id = b1abf2f8-5743-4ac1-8cc6-ea0f4435ab8c

\echo '--- 1) Все пользователи в Ромашке ---'
SELECT u.id, u.email, u.role, ep.legal_entity, ep.location
FROM users u
LEFT JOIN employee_profiles ep ON ep.user_id = u.id
WHERE u.tenant_id = 'b1abf2f8-5743-4ac1-8cc6-ea0f4435ab8c'
ORDER BY u.role, u.email;

\echo ''
\echo '--- 2) Top-10 льгот в Ромашке ---'
SELECT b.name, count(*) AS orders, sum(oi.price_points) AS pts
FROM order_items oi
JOIN orders o   ON o.id = oi.order_id
JOIN benefits b ON b.id = oi.benefit_id
WHERE o.tenant_id = 'b1abf2f8-5743-4ac1-8cc6-ea0f4435ab8c'
  AND o.status = 'paid'
GROUP BY b.name
ORDER BY orders DESC, pts DESC
LIMIT 15;

\echo ''
\echo '--- 3) Категории заказов в Ромашке ---'
SELECT bc.name AS category, count(*) AS orders
FROM order_items oi
JOIN orders o   ON o.id = oi.order_id
JOIN benefits b ON b.id = oi.benefit_id
JOIN benefit_categories bc ON bc.id = b.category_id
WHERE o.tenant_id = 'b1abf2f8-5743-4ac1-8cc6-ea0f4435ab8c'
  AND o.status = 'paid'
GROUP BY bc.name
ORDER BY orders DESC;

\echo ''
\echo '--- 4) Распределение заказов по месяцам в Ромашке ---'
SELECT to_char(o.created_at, 'YYYY-MM') AS month, count(*) AS orders
FROM orders o
WHERE o.tenant_id = 'b1abf2f8-5743-4ac1-8cc6-ea0f4435ab8c'
  AND o.status = 'paid'
GROUP BY 1
ORDER BY 1;

\echo ''
\echo '--- 5) legal_entity сотрудников Ромашки ---'
SELECT ep.legal_entity, count(*) AS cnt
FROM employee_profiles ep
WHERE ep.tenant_id = 'b1abf2f8-5743-4ac1-8cc6-ea0f4435ab8c'
GROUP BY ep.legal_entity;

\echo ''
\echo '--- 6) Все benefits в каталоге Ромашки ---'
SELECT b.id, b.name, bc.name AS category, b.price_points, b.is_active
FROM benefits b
LEFT JOIN benefit_categories bc ON bc.id = b.category_id
WHERE b.tenant_id = 'b1abf2f8-5743-4ac1-8cc6-ea0f4435ab8c'
ORDER BY bc.name, b.name;
