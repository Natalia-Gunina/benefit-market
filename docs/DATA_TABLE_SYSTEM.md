# Единая система таблиц — DataTable

## Файловая структура

```
src/components/data-table/
├── index.ts                # barrel export
├── types.ts                # ColumnDef, TableState, ActionDef, ColumnFilter, SortState
├── use-table-state.ts      # хук: state ↔ URL sync
├── data-table.tsx           # оркестратор
├── data-table-toolbar.tsx   # глобальный поиск + кнопка «Сбросить всё»
├── data-table-header.tsx    # заголовки → делегирует в ColumnHeader
├── column-header.tsx        # единый popover на колонку: сортировка + фильтр
├── data-table-body.tsx      # строки, skeleton, empty state, expandable, row actions
└── data-table-pagination.tsx # пагинация «Показано X–Y из Z»

src/app/api/admin/distinct/
└── route.ts                # GET /api/admin/distinct?field=... (whitelist, SELECT DISTINCT)
```

---

## Как подключить DataTable к новой странице

### 1. Хук состояния

```tsx
const { state, setState, resetFilters } = useTableState({
  pageSize: 20,
  defaultSort: { key: "created_at", direction: "desc" },
});
```

- `state` — `{ page, pageSize, search, sort, filters }`, реактивно читается из URL query params.
- `setState(patch)` — мержит patch в state, обновляет URL через `router.replace`.
  При изменении фильтров/сорта/поиска page автоматически сбрасывается на 1.
- `resetFilters()` — очищает все query params.

### 2. Fetch данных

**Важно**: `fetchCatalog` строит API-параметры напрямую из `state`. Не использовать промежуточные хелперы — это источник багов с рассинхроном.

```tsx
const fetchData = useCallback(async () => {
  setLoading(true);
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("per_page", String(state.pageSize));
  if (state.search) params.set("search", state.search);

  // Сорт — маппинг колоночных ключей в API-формат (если API принимает другие названия)
  if (state.sort) {
    params.set("sort_by", state.sort.key);
    params.set("sort_dir", state.sort.direction);
  }

  // Фильтры — напрямую из state.filters
  Object.entries(state.filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });

  const res = await fetch(`/api/my-entity?${params}`);
  // ...
}, [state]);

useEffect(() => { fetchData(); }, [fetchData]);
```

### 3. Определение колонок

```tsx
const columns: ColumnDef<MyRow>[] = [
  {
    key: "name",           // ключ в объекте данных (используется для рендера)
    header: "Название",
    sortable: true,        // добавляет сортировку в popover заголовка
    filter: { type: "text" },  // добавляет текстовый фильтр в popover
    filterKey: "search",   // API-параметр (если отличается от key)
    cell: (row) => <span className="font-medium">{row.name}</span>,
  },
  // ...
];
```

### 4. Рендер

```tsx
<DataTable
  columns={columns}
  data={items}
  total={total}
  loading={loading}
  error={error}
  state={state}
  onStateChange={setState}
  onReset={resetFilters}
  searchable={{ placeholder: "Поиск..." }}
  actions={(row) => [
    { label: "Редактировать", icon: Pencil, onClick: () => ... },
    { label: "Удалить", icon: Trash2, onClick: () => ..., variant: "destructive", confirm: "Удалить?" },
  ]}
/>
```

---

## ColumnDef — полный справочник

```tsx
interface ColumnDef<T> {
  key: string;              // Ключ поля в объекте данных. Если нет cell(), значение берётся как row[key]
  header: string;           // Текст заголовка
  sortable?: boolean;       // Клик по заголовку → popover с «По возрастанию / По убыванию»
  filter?: ColumnFilter;    // Фильтр в том же popover (см. типы ниже)
  filterKey?: string;       // Ключ для API-параметра. По умолчанию = key
  cell?: (row: T) => ReactNode;  // Кастомный рендер ячейки
  className?: string;       // CSS для <td>
  headerClassName?: string; // CSS для <th>
  hidden?: boolean;         // Скрыть колонку
  width?: string;           // min-width
}
```

### filterKey — зачем нужен

Колонка может отображать одно поле (`provider_name`), но фильтровать по другому (`provider_id`).
Без `filterKey` ключ фильтра = `key` колонки. С `filterKey` — фильтр отправляет указанный ключ в URL и на API.

Примеры:
- `key: "provider_name", filterKey: "provider_id"` → URL: `?provider_id=xxx`
- `key: "offering_status", filterKey: "status"` → URL: `?status=published`
- `key: "category_name", filterKey: "category"` → URL: `?category=Спорт`

---

## Типы фильтров

### `{ type: "text" }`
Поле ввода «Содержит...». Отправляет строку.

### `{ type: "select", options: [{value, label}] }`
Чекбоксы со статическими опциями. Множественный выбор. Отправляет comma-separated: `status=published,archived`.

**API должен поддерживать**: `.split(",")` + `.in()` для множественных значений.

### `{ type: "auto", field: "catalog.category" }`
Как select, но опции загружаются через `GET /api/admin/distinct?field=...`.
Используй когда список опций = уникальные значения из БД (категории, города, грейды).

### `{ type: "number" }`
Два поля «От» / «До». Отправляет `key=min~max`.

### `{ type: "date-range" }` *(заготовка, не реализован)*

---

## Distinct API — `/api/admin/distinct`

Whitelist-подход. Добавить новое поле:

```ts
// src/app/api/admin/distinct/route.ts → buildConfig()
"employees.location": {
  table: "employee_profiles",
  column: "location",
  demo: async () => {
    const { DEMO_EMPLOYEE_PROFILES } = await import("@/lib/demo-data");
    return [...new Set(DEMO_EMPLOYEE_PROFILES.map((e) => e.location))].filter(Boolean).sort();
  },
},
```

Формат:
- `field` = `"entity.column"` (namespace.field)
- `table` = Supabase таблица
- `column` = Supabase колонка (для `SELECT column FROM table`)
- `demo` = async функция, возвращающая `string[]` из demo-данных

Авторизация: `requireRole("admin", "hr")` в production, пропускается в demo mode.

---

## UX-решения (зашиты в компонент)

### Заголовки

- **Один клик** по заголовку → один popover с сортировкой + фильтром.
- Без отдельных кнопок/иконок для каждого действия.
- Индикатор `▾` (ChevronDown) — неактивное состояние.
  Если сорт активен → `↑`/`↓`. Если фильтр → иконка фильтра + жирный заголовок.
  Оба → стрелка + точка.
- Колонки без `sortable` и `filter` — просто текст, без popover.

### Toolbar

- Только глобальный поиск (с debounce 300ms) + «Сбросить всё».
- Фильтры — per-column, не в toolbar.
- `headerActions` — слот справа (кнопка «Создать» и т.п.).

### Пагинация

- Скрывается если `total ≤ pageSize`.
- Формат: «Показано 1–20 из 147 | ◀ Назад  2/8  Вперёд ▶».

### Loading / Empty / Error

- **Первая загрузка** (data пуст): skeleton-строки.
- **Перезагрузка** (data есть): данные остаются видимыми, без overlay.
- **Empty**: иконка SearchX + «Ничего не найдено» + «Попробуйте изменить параметры поиска».
- **Error**: красный banner над таблицей.

### Row Actions

- 1 действие → одна кнопка-иконка.
- 2+ действий → `⋯` (MoreHorizontal) → DropdownMenu.
- `variant: "destructive"` → красный текст.
- `confirm: "Текст?"` → `window.confirm()` перед выполнением.

### Inline edit (паттерн StatusBadge)

Для ячеек, которые нужно менять без диалога:
- Read mode — обычный Badge/текст.
- Клик по badge → Popover с вариантами. Текущее значение подсвечено.
- Не использовать Select в ячейке таблицы — визуально неоднозначен.

---

## useTableState — нюансы

### URL sync

- `state` читается из `useSearchParams()`.
- Зарезервированные ключи (`page`, `search`, `sort`, `pageSize`, `per_page`, `sort_by`, `sort_dir`) НЕ попадают в `state.filters`.
- Default sort не пишется в URL (чистый URL при дефолтном состоянии).
- `setState` использует `router.replace({ scroll: false })` — без записи в history.

### Стабильность ссылок

- `defaultSort` хранится через `useRef`, чтобы не триггерить пересчёт `useMemo` на каждом рендере.
  **Без этого**: бесконечный цикл рендеров → серая/заблокированная таблица.

### Автосброс страницы

- При изменении `search`, `filters` или `sort` → `page` автоматически сбрасывается на 1.
- При изменении только `page` → остальное не трогается.

---

## API — что должен поддерживать backend

Чтобы DataTable работал с API endpoint, endpoint должен:

1. **Пагинация**: `page` + `per_page` → возвращать `{ data, meta: { total } }`.
2. **Поиск**: `search` → `ilike` по нужным полям.
3. **Сортировка**: `sort_by` + `sort_dir` (или кастомный маппинг в `fetchData`).
4. **Фильтры**: каждый `filterKey` → query param. **Comma-separated** значения → `.in()`, не `.eq()`.

```ts
// Пример: обработка comma-separated фильтра
const statusFilter = searchParams.get("status") || "";
if (statusFilter) {
  const vals = statusFilter.split(",");
  query = vals.length === 1
    ? query.eq("status", vals[0])
    : query.in("status", vals);
}
```

---

## Миграция

План миграции 9 оставшихся таблиц — в отдельном файле: [DATA_TABLE_MIGRATION.md](./DATA_TABLE_MIGRATION.md)
