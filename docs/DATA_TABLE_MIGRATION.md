# DataTable — план миграции таблиц

Справочник по системе: [DATA_TABLE_SYSTEM.md](./DATA_TABLE_SYSTEM.md)

---

## 1. `admin/benefits` — Каталог льгот
- **Статус**: ✅ Готово
- Фильтры: provider (select), category (auto), format (select), status (select), search (global)
- Сортировка: name, price, created_at
- StatusBadge popover для inline-смены статуса

## 2. `admin/users` — Пользователи
- **Статус**: ✅ Готово
- Фильтры: role (select), department (select), grade (select), email (text), name (text), search (global)
- Сортировка: email, full_name, grade
- RoleBadge popover + AlertDialog подтверждение

## 3. `admin/audit` — Журнал событий
- **Статус**: ✅ Готово
- Фильтры: entity_type (select), action (select), created_at (date-range)
- Сортировка: created_at
- Expandable rows для JSON diff

## 4. `hr/employees` — Сотрудники
- **Статус**: ✅ Готово
- Сортировка: все 9 колонок (server-side, заменил client-side useMemo)
- Глобальный поиск по имени/email
- Row click → детальная страница

## 5. `provider/orders` — Заказы провайдера
- **Статус**: ✅ Готово
- Фильтры: status (select), search (global)
- Заменил button-group tabs на per-column select

## 6. `provider/reviews` — Отзывы
- **Статус**: ✅ Готово
- Фильтры: offering (select, загружается из API), rating (select)
- StarRating компонент в ячейке

## 7. `admin/tenants` — Компании-клиенты
- **Статус**: ✅ Готово
- Глобальный поиск, headerActions для кнопки "Создать"
- CRUD Dialog сохранён

## 8. `admin/policies` — Политики
- **Статус**: ✅ Готово
- Фильтры: tenant (select, загружается из API)
- Switch toggle для is_active в ячейке
- CRUD Dialog сохранён

## 9. `admin/rules` — Правила
- **Статус**: ✅ Готово
- Без фильтров, только пагинация
- Badges для conditions, headerActions для кнопки "Создать"
- CRUD Dialog + AlertDialog delete через actions

## 10. `employee/orders` — Заказы сотрудника
- **Статус**: ✅ Готово
- Фильтры: status (select, client-side)
- Row click → детальная страница
- Cancel button, "Можно оценить" badge
- Заменил Tabs на per-column filter

---

## Пост-миграция

- [ ] Удалить `src/components/shared/data-table-pagination.tsx` (после проверки что нигде не импортируется)
- [ ] Удалить `TablePageSkeleton` из `src/components/shared/skeletons.tsx`
