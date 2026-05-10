# Развёртывание Benefit Market в production-режиме

Этот документ описывает, как привести production-сайт (например,
`https://benefit-market.duckdns.org:8443/`) в состояние, в котором
все 4 кабинета (сотрудник, HR, админ, провайдер) работают на реальных
данных из Supabase, а не из demo-mock'ов.

## Предусловия

- Прод задеплоен из ветки `main` (через GitHub Actions → GHCR → VPS).
- В Supabase уже применены миграции `00001_initial_schema.sql` … `00007_offering_format_and_cities.sql`.
- В переменных окружения (`.env` на VPS / build args в Action) выставлены:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_DEMO_MODE` отсутствует или установлен в `false`.

Если эти условия не выполнены — сайт не сможет подключиться к Supabase
и будет либо падать, либо работать в demo-режиме.

## Автоматизированный путь (рекомендуется)

Один раз настрой CI/CD — дальше миграции применяются сами на каждый push.

### A. Создать секреты в GitHub

Открой <https://github.com/Natalia-Gunina/benefit-market/settings/secrets/actions>
и добавь три секрета:

1. **`SUPABASE_ACCESS_TOKEN`** — персональный access token.
   Получить: <https://supabase.com/dashboard/account/tokens> → **Generate new token**.
2. **`SUPABASE_PROJECT_REF`** — короткий ID проекта.
   Найти: Project Settings → General → **Reference ID** (что-то вроде `abcdefghijklmnop`).
3. **`SUPABASE_DB_PASSWORD`** — пароль БД.
   Найти/сгенерить: Project Settings → Database → **Database password**.
4. **`SUPABASE_DB_URL`** *(нужен только для seed-workflow)* — полная connection string.
   Project Settings → Database → **Connection string** → URI → mode `Transaction` или
   `Session` → скопировать с уже подставленным паролем (port должен быть `6543`,
   а не `5432`, иначе GitHub-runner не сможет подключиться через IPv6).

### B. Зарегистрировать уже применённые миграции (один раз)

Если миграции `00001`–`00007` (или дальше) ты уже применила вручную через SQL Editor,
их нужно «пометить как applied» — иначе `supabase db push` попытается применить их
заново и упадёт с «table already exists».

1. Открой <https://github.com/Natalia-Gunina/benefit-market/actions/workflows/db-migrate.yml>
2. Нажми **Run workflow** → в поле `mark_applied` укажи через запятую **все версии,
   которые уже применены вручную** в твоей базе.
   Например, если применены `00001..00007` (а `00008/00009` ещё нет):
   ```
   00001, 00002, 00003, 00004, 00005, 00006, 00007
   ```
3. Запусти. После этого `supabase db push` применит только то, что осталось
   (в нашем случае — `00008` и `00009`).

После этого однократного шага каждый push в `main`, который меняет файлы в
`supabase/migrations/`, автоматически применит новые миграции.

### C. Загрузить seed (опционально)

После миграций запусти workflow `db-seed`:
<https://github.com/Natalia-Gunina/benefit-market/actions/workflows/db-seed.yml>
→ **Run workflow** (по умолчанию применит `seed_prod.sql`).

Повторно запусти после регистрации первого пользователя — DO-блок наполнит
провайдеров и каталог.

---

## Ручной путь (если без CI/CD)

### 1. Применить две новые миграции

В Supabase Dashboard → SQL Editor → выполнить **по очереди**:

1. `supabase/migrations/00008_employee_self_profile.sql` — добавляет
   `users.full_name`, `employee_profiles.gender`, `employee_profiles.birthday`,
   индекс по `full_name` для поиска в HR.
2. `supabase/migrations/00009_signup_full_name.sql` — обновляет триггер
   `handle_new_user()`, чтобы при регистрации записывать ФИО из
   `user_metadata.full_name` в `users.full_name`, а также создавать
   stub-`employee_profiles` для employee-роли.

Обе миграции идемпотентны — повторный запуск безопасен.

### 2. Загрузить справочники и каталог

Применить `supabase/seed_prod.sql` — этот файл создаёт компанию,
категории, бюджетную политику и каталог льгот четырёх провайдеров.

Файл устроен так, что часть про провайдеров запускается только если
в базе уже есть хотя бы один пользователь. Поэтому первый запуск
наполнит только tenant + categories + policy. После того как ты
зарегистрируешь себе аккаунт (см. шаг 3) — **запусти seed повторно**,
чтобы наполнить marketplace.

### 3. Зарегистрировать тестовых пользователей

Регистрация — на самом сайте (`/auth/register`). Чтобы покрыть все
4 кабинета, нужно создать четыре аккаунта:

| Роль       | Email (пример)        | Пароль   | Что выбрать в форме |
|------------|-----------------------|----------|---------------------|
| Админ      | admin@techfuture.ru   | …      | _нет такой роли в форме_ — см. ниже |
| HR         | hr@techfuture.ru      | …      | _то же_             |
| Сотрудник  | employee@techfuture.ru| …      | Сотрудник           |
| Провайдер  | provider@techfuture.ru| …      | Провайдер           |

#### 3a. Создать `admin` и `hr` через Supabase Dashboard

Форма `/auth/register` сейчас предлагает только роли `employee` и
`provider`. Для `admin` и `hr` создай пользователей через Supabase
Dashboard → **Authentication → Users → Add user**:

- Email + пароль
- Auto Confirm User = ✓
- User Metadata (raw_user_meta_data) — JSON:
  ```json
  { "role": "admin", "full_name": "Морозов Павел Николаевич" }
  ```
  (для HR — `"role": "hr"`)

Триггер `handle_new_user()` автоматически создаст запись в `public.users`
с правильной ролью и ФИО.

#### 3b. Email-подтверждение

Если в Supabase включено требование email confirmation, пользователи,
зарегистрированные через `/auth/register`, не смогут войти, пока не
подтвердят почту. На время разработки рекомендую отключить:
**Authentication → Providers → Email → Confirm email = OFF**.

### 4. Повторно применить seed

Теперь, когда есть пользователь, запусти `supabase/seed_prod.sql`
ещё раз. Тот же DO-блок увидит первого пользователя в `users` и
создаст:

- 4 провайдера (World Class, Skillbox, Медси, Яндекс Лавка)
- 8 льгот провайдеров
- 7 подключённых tenant_offerings (что видят сотрудники в каталоге)

Все провайдеры будут принадлежать первому найденному пользователю.
Если хочешь — потом в админке можно сменить владельца через UI.

### 5. Создать кошелёк для существующих пользователей (опционально)

Триггер создаёт кошелёк автоматически только при регистрации. Если
ты создавал пользователей **до** применения миграции 00009, у них
кошелька может не быть. Проверь:

```sql
SELECT u.email, w.balance, w.period
FROM users u LEFT JOIN wallets w ON w.user_id = u.id
WHERE u.tenant_id = '00000000-0000-4000-8000-000000000001';
```

Если есть `null` баланс — создай вручную:

```sql
INSERT INTO wallets (user_id, tenant_id, balance, reserved, period, expires_at)
SELECT
  u.id,
  u.tenant_id,
  50000,  -- из бюджетной политики
  0,
  TO_CHAR(NOW(), 'YYYY') || '-Q' || CEIL(EXTRACT(MONTH FROM NOW()) / 3.0)::int,
  (DATE_TRUNC('quarter', NOW()) + INTERVAL '3 months')::timestamptz
FROM users u
LEFT JOIN wallets w ON w.user_id = u.id
WHERE w.id IS NULL
  AND u.tenant_id = '00000000-0000-4000-8000-000000000001';
```

### 6. Проверка

1. Открой `https://<твой-домен>/auth/login`, войди как `employee`.
2. **Кошелёк**: `/dashboard/employee/wallet` — баланс 50 000 (или сколько в политике).
3. **Каталог**: `/dashboard/employee/catalog` — 7 льгот.
4. **Мой профиль**: `/dashboard/employee/profile` — ФИО подтянулось из регистрации, можно заполнить семейное положение и т.д.
5. Выйди → войди как `hr`.
6. **Сотрудники**: `/dashboard/hr/employees` — ваш employee есть в списке.
7. Кликни по имени — карточка сотрудника, кнопка «Начислить баллы», она реально изменит `wallets` + `point_ledger`.
8. Войди как `admin`.
9. **Модерация льгот**: `/dashboard/admin/offerings` — есть 2 заявки в `pending_review` (Персональный тренер, Яндекс Лавка).
10. **Журнал событий**: `/dashboard/admin/audit` — пока пусто, заполнится по мере действий.
11. Войди как `provider` — увидишь свои льготы в `/dashboard/provider/offerings`.

## Если что-то не работает

- **`/auth/login` показывает ошибку «Invalid email or password»** — проверь, что в Supabase Auth → Providers → Email включён и пользователь создан с auto-confirm.
- **`/dashboard/*` всё равно редиректит на `/auth/login`** — проверь куки браузера, выйди и войди ещё раз.
- **Каталог пустой / провайдеры не видны** — повторно запусти `seed_prod.sql` (после регистрации первого пользователя).
- **HR-список сотрудников пуст, хотя зарегистрировался employee** — проверь `SELECT * FROM users;` в Supabase. Возможно, у пользователя `role != 'employee'` (HR-список фильтрует именно по роли). Если так — обнови вручную:
  ```sql
  UPDATE users SET role = 'employee' WHERE email = 'employee@techfuture.ru';
  ```
- **Кнопка «Начислить баллы» возвращает ошибку «Wallet not found»** — у сотрудника нет кошелька. Создай вручную (см. шаг 5).
