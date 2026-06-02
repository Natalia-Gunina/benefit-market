-- ===========================================================================
-- 00016: добавить отчества сотрудникам без отчества + убрать «Подписка Самокат+ (год)»
-- ===========================================================================

-- --------------------------------------------------------------------------
-- 1. Отчества: находим пользователей, у которых full_name состоит ровно
--    из двух слов (нет отчества), и обновляем точечно по email.
-- --------------------------------------------------------------------------

UPDATE users
SET full_name = CASE email
  WHEN 'employee@bm.demo'  THEN 'Иван Андреевич Козлов'
  WHEN 'admin@bm.demo'     THEN 'Алексей Викторович Сидоров'
  WHEN 'hr@bm.demo'        THEN 'Ольга Николаевна Белова'
  WHEN 'provider@bm.demo'  THEN 'Анна Сергеевна Партнёрова'
END
WHERE email IN (
  'employee@bm.demo',
  'admin@bm.demo',
  'hr@bm.demo',
  'provider@bm.demo'
)
  AND array_length(regexp_split_to_array(trim(full_name), '\s+'), 1) < 3;

-- Синхронизируем full_name в extra-поле employee_profiles (где оно хранится)
UPDATE employee_profiles ep
SET extra = jsonb_set(extra, '{full_name}', to_jsonb(u.full_name))
FROM users u
WHERE ep.user_id = u.id
  AND u.email IN ('employee@bm.demo', 'admin@bm.demo', 'hr@bm.demo')
  AND extra ? 'full_name';

-- --------------------------------------------------------------------------
-- 2. Убрать «Подписка Самокат+ (год)»:
--    - деактивируем в tenant_offerings (скрываем из каталога сотрудника)
--    - архивируем сам оффер (не удаляем — могут быть заказы с FK)
-- --------------------------------------------------------------------------

UPDATE tenant_offerings
SET is_active = false
WHERE provider_offering_id IN (
  SELECT id FROM provider_offerings WHERE name = 'Подписка Самокат+ (год)'
);

UPDATE provider_offerings
SET status = 'archived', updated_at = NOW()
WHERE name = 'Подписка Самокат+ (год)';
