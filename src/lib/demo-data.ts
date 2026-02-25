// ---------------------------------------------------------------------------
// Demo data for the benefit marketplace (маркетплейс льгот) demo mode.
// All IDs follow the "demo-xxx-nnn" convention.
// All data is self-consistent: foreign keys reference existing demo entities.
// ---------------------------------------------------------------------------

import type {
  Tenant,
  User,
  BenefitCategory,
  Benefit,
  Wallet,
  PointLedger,
  Order,
  OrderItem,
  EmployeeProfile,
  BudgetPolicy,
  EligibilityRule,
  AuditLog,
} from '@/lib/types';

// ========================== 1. DEMO TENANT ==================================

export const DEMO_TENANT: Tenant = {
  id: 'demo-tenant-001',
  name: 'ООО Технологии Будущего',
  domain: 'techfuture.ru',
  settings: {
    currency_label: 'баллы',
    fiscal_year_start: '01-01',
    default_budget_period: 'quarterly',
  },
  created_at: '2025-01-15T10:00:00Z',
};

// ========================== 2. DEMO USER ====================================

export const DEMO_USER: User = {
  id: 'demo-user-001',
  auth_id: 'demo-auth-001',
  tenant_id: 'demo-tenant-001',
  email: 'demo@techfuture.ru',
  role: 'employee',
  created_at: '2025-01-20T10:00:00Z',
};

// ========================== 3. DEMO CATEGORIES ==============================

export const DEMO_CATEGORIES: BenefitCategory[] = [
  {
    id: 'demo-cat-001',
    tenant_id: 'demo-tenant-001',
    name: 'Здоровье',
    icon: 'heart-pulse',
    sort_order: 1,
  },
  {
    id: 'demo-cat-002',
    tenant_id: 'demo-tenant-001',
    name: 'Образование',
    icon: 'graduation-cap',
    sort_order: 2,
  },
  {
    id: 'demo-cat-003',
    tenant_id: 'demo-tenant-001',
    name: 'Спорт',
    icon: 'dumbbell',
    sort_order: 3,
  },
  {
    id: 'demo-cat-004',
    tenant_id: 'demo-tenant-001',
    name: 'Питание',
    icon: 'utensils',
    sort_order: 4,
  },
  {
    id: 'demo-cat-005',
    tenant_id: 'demo-tenant-001',
    name: 'Транспорт',
    icon: 'car',
    sort_order: 5,
  },
];

// ========================== 4. DEMO BENEFITS ================================

export const DEMO_BENEFITS: Benefit[] = [
  // --- Здоровье (demo-cat-001) ---
  {
    id: 'demo-ben-001',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-001',
    name: 'ДМС расширенный',
    description:
      'Расширенная программа добровольного медицинского страхования. Включает амбулаторное и стационарное обслуживание в ведущих клиниках Москвы. Покрывает все виды диагностики и лечения.',
    price_points: 15000,
    stock_limit: null,
    is_active: true,
    created_at: '2025-01-16T10:00:00Z',
  },
  {
    id: 'demo-ben-002',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-001',
    name: 'Стоматология',
    description:
      'Полис стоматологического страхования с покрытием терапевтического и хирургического лечения. Включает профессиональную чистку два раза в год и экстренную помощь.',
    price_points: 8000,
    stock_limit: null,
    is_active: true,
    created_at: '2025-01-16T10:30:00Z',
  },
  {
    id: 'demo-ben-003',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-001',
    name: 'Психолог онлайн',
    description:
      'Доступ к платформе онлайн-консультаций с лицензированными психологами. Четыре индивидуальные сессии по 50 минут в месяц. Полная конфиденциальность.',
    price_points: 3000,
    stock_limit: null,
    is_active: true,
    created_at: '2025-01-16T11:00:00Z',
  },

  // --- Образование (demo-cat-002) ---
  {
    id: 'demo-ben-004',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-002',
    name: 'Курсы Skillbox',
    description:
      'Годовая подписка на образовательную платформу Skillbox. Доступ к более чем 500 курсам по программированию, дизайну, маркетингу и менеджменту. Сертификат по окончании.',
    price_points: 5000,
    stock_limit: null,
    is_active: true,
    created_at: '2025-01-17T10:00:00Z',
  },
  {
    id: 'demo-ben-005',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-002',
    name: 'Английский язык',
    description:
      'Индивидуальные занятия английским языком с преподавателем-носителем. Восемь занятий в месяц по 60 минут. Подготовка к международным сертификатам IELTS/TOEFL.',
    price_points: 4000,
    stock_limit: null,
    is_active: true,
    created_at: '2025-01-17T10:30:00Z',
  },
  {
    id: 'demo-ben-006',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-002',
    name: 'Конференция',
    description:
      'Оплата участия в одной профильной конференции на выбор сотрудника. Покрывает билет, проезд и проживание при необходимости. Согласование с руководителем.',
    price_points: 7000,
    stock_limit: 20,
    is_active: true,
    created_at: '2025-01-17T11:00:00Z',
  },

  // --- Спорт (demo-cat-003) ---
  {
    id: 'demo-ben-007',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-003',
    name: 'Фитнес-клуб',
    description:
      'Годовой абонемент в сеть фитнес-клубов World Class или DDX Fitness. Включает тренажёрный зал, групповые занятия и зону SPA. Безлимитное посещение.',
    price_points: 6000,
    stock_limit: null,
    is_active: true,
    created_at: '2025-01-18T10:00:00Z',
  },
  {
    id: 'demo-ben-008',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-003',
    name: 'Бассейн',
    description:
      'Абонемент на посещение бассейна 3 раза в неделю. Выбор из партнёрских спортивных комплексов города. Шкафчик и полотенце включены.',
    price_points: 4500,
    stock_limit: null,
    is_active: true,
    created_at: '2025-01-18T10:30:00Z',
  },
  {
    id: 'demo-ben-009',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-003',
    name: 'Йога абонемент',
    description:
      'Месячный абонемент на занятия йогой в студии рядом с офисом. Восемь групповых занятий в месяц. Коврик и блоки предоставляются.',
    price_points: 3500,
    stock_limit: null,
    is_active: true,
    created_at: '2025-01-18T11:00:00Z',
  },

  // --- Питание (demo-cat-004) ---
  {
    id: 'demo-ben-010',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-004',
    name: 'Обеды в офисе',
    description:
      'Ежемесячная компенсация обедов в офисной столовой. Комплексный обед из трёх блюд каждый рабочий день. Меню обновляется еженедельно.',
    price_points: 2000,
    stock_limit: null,
    is_active: true,
    created_at: '2025-01-19T10:00:00Z',
  },
  {
    id: 'demo-ben-011',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-004',
    name: 'Доставка еды',
    description:
      'Лимит на доставку еды через сервисы Яндекс Еда и Delivery Club. Баланс зачисляется на корпоративный аккаунт ежемесячно. Для удалённых сотрудников.',
    price_points: 3000,
    stock_limit: null,
    is_active: true,
    created_at: '2025-01-19T10:30:00Z',
  },

  // --- Транспорт (demo-cat-005) ---
  {
    id: 'demo-ben-012',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-005',
    name: 'Парковка',
    description:
      'Ежемесячная аренда парковочного места на территории бизнес-центра. Крытая парковка с охраной. Доступ по пропуску 24/7.',
    price_points: 2500,
    stock_limit: 30,
    is_active: true,
    created_at: '2025-01-20T10:00:00Z',
  },
  {
    id: 'demo-ben-013',
    tenant_id: 'demo-tenant-001',
    category_id: 'demo-cat-005',
    name: 'Такси лимит',
    description:
      'Ежемесячный лимит на поездки на такси через Яндекс Go. Корпоративный аккаунт привязывается к профилю сотрудника. Рабочие поездки по городу.',
    price_points: 4000,
    stock_limit: null,
    is_active: true,
    created_at: '2025-01-20T10:30:00Z',
  },
];

// ========================== 5. DEMO WALLET ==================================

export const DEMO_WALLET: Wallet = {
  id: 'demo-wallet-001',
  user_id: 'demo-user-001',
  tenant_id: 'demo-tenant-001',
  balance: 45000,
  reserved: 6000,
  period: '2025-Q1',
  expires_at: '2025-06-30T23:59:59Z',
};

// ========================== 6. DEMO LEDGER ==================================

export const DEMO_LEDGER: PointLedger[] = [
  {
    id: 'demo-ledger-001',
    wallet_id: 'demo-wallet-001',
    tenant_id: 'demo-tenant-001',
    order_id: null,
    type: 'accrual',
    amount: 50000,
    description: 'Начисление баллов за Q1 2025 — стандартный бюджет',
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'demo-ledger-002',
    wallet_id: 'demo-wallet-001',
    tenant_id: 'demo-tenant-001',
    order_id: 'demo-order-001',
    type: 'spend',
    amount: -6000,
    description: 'Оплата: Фитнес-клуб',
    created_at: '2025-01-10T14:23:00Z',
  },
  {
    id: 'demo-ledger-003',
    wallet_id: 'demo-wallet-001',
    tenant_id: 'demo-tenant-001',
    order_id: null,
    type: 'accrual',
    amount: 5000,
    description: 'Бонус за успешное завершение проекта «Миграция»',
    created_at: '2025-01-25T09:00:00Z',
  },
  {
    id: 'demo-ledger-004',
    wallet_id: 'demo-wallet-001',
    tenant_id: 'demo-tenant-001',
    order_id: 'demo-order-001',
    type: 'spend',
    amount: -4000,
    description: 'Оплата: Английский язык',
    created_at: '2025-01-28T11:15:00Z',
  },
  {
    id: 'demo-ledger-005',
    wallet_id: 'demo-wallet-001',
    tenant_id: 'demo-tenant-001',
    order_id: 'demo-order-002',
    type: 'reserve',
    amount: -6000,
    description: 'Резерв: Фитнес-клуб (ожидание подтверждения)',
    created_at: '2025-02-05T16:40:00Z',
  },
  {
    id: 'demo-ledger-006',
    wallet_id: 'demo-wallet-001',
    tenant_id: 'demo-tenant-001',
    order_id: 'demo-order-003',
    type: 'reserve',
    amount: -7000,
    description: 'Резерв: Конференция',
    created_at: '2025-02-10T10:00:00Z',
  },
  {
    id: 'demo-ledger-007',
    wallet_id: 'demo-wallet-001',
    tenant_id: 'demo-tenant-001',
    order_id: 'demo-order-003',
    type: 'release',
    amount: 7000,
    description: 'Отмена резерва: Конференция (заказ отменён)',
    created_at: '2025-02-12T09:30:00Z',
  },
  {
    id: 'demo-ledger-008',
    wallet_id: 'demo-wallet-001',
    tenant_id: 'demo-tenant-001',
    order_id: null,
    type: 'accrual',
    amount: 4000,
    description: 'Компенсация за переработки в январе',
    created_at: '2025-02-15T10:00:00Z',
  },
];

// ========================== 7. DEMO ORDERS ==================================

export const DEMO_ORDERS: Order[] = [
  {
    id: 'demo-order-001',
    user_id: 'demo-user-001',
    tenant_id: 'demo-tenant-001',
    status: 'paid',
    total_points: 10000,
    reserved_at: '2025-01-10T14:20:00Z',
    expires_at: '2025-01-17T14:20:00Z',
    created_at: '2025-01-10T14:20:00Z',
  },
  {
    id: 'demo-order-002',
    user_id: 'demo-user-001',
    tenant_id: 'demo-tenant-001',
    status: 'reserved',
    total_points: 6000,
    reserved_at: '2025-02-05T16:40:00Z',
    expires_at: '2025-02-12T16:40:00Z',
    created_at: '2025-02-05T16:40:00Z',
  },
  {
    id: 'demo-order-003',
    user_id: 'demo-user-001',
    tenant_id: 'demo-tenant-001',
    status: 'cancelled',
    total_points: 7000,
    reserved_at: '2025-02-10T10:00:00Z',
    expires_at: '2025-02-17T10:00:00Z',
    created_at: '2025-02-10T10:00:00Z',
  },
];

// ========================== 8. DEMO ORDER ITEMS =============================

export const DEMO_ORDER_ITEMS: OrderItem[] = [
  // Order 1 (paid) — Фитнес-клуб + Английский язык
  {
    id: 'demo-oi-001',
    order_id: 'demo-order-001',
    benefit_id: 'demo-ben-007',
    quantity: 1,
    price_points: 6000,
  },
  {
    id: 'demo-oi-002',
    order_id: 'demo-order-001',
    benefit_id: 'demo-ben-005',
    quantity: 1,
    price_points: 4000,
  },
  // Order 2 (reserved) — Фитнес-клуб (renewal)
  {
    id: 'demo-oi-003',
    order_id: 'demo-order-002',
    benefit_id: 'demo-ben-007',
    quantity: 1,
    price_points: 6000,
  },
  // Order 3 (cancelled) — Конференция
  {
    id: 'demo-oi-004',
    order_id: 'demo-order-003',
    benefit_id: 'demo-ben-006',
    quantity: 1,
    price_points: 7000,
  },
];

// ========================== 9. DEMO EMPLOYEES ===============================

/** Extended employee info used for admin/HR pages (user + profile merged). */
export interface DemoEmployee {
  user: User;
  profile: EmployeeProfile;
  full_name: string;
  department: string;
}

export const DEMO_EMPLOYEES: DemoEmployee[] = [
  {
    user: {
      id: 'demo-user-001',
      auth_id: 'demo-auth-001',
      tenant_id: 'demo-tenant-001',
      email: 'demo@techfuture.ru',
      role: 'employee',
      created_at: '2025-01-20T10:00:00Z',
    },
    profile: {
      id: 'demo-ep-001',
      user_id: 'demo-user-001',
      tenant_id: 'demo-tenant-001',
      grade: 'senior',
      tenure_months: 36,
      location: 'Москва',
      legal_entity: 'ООО Технологии Будущего',
      extra: { department: 'Разработка' },
    },
    full_name: 'Иванов Иван Иванович',
    department: 'Разработка',
  },
  {
    user: {
      id: 'demo-user-002',
      auth_id: 'demo-auth-002',
      tenant_id: 'demo-tenant-001',
      email: 'petrova@techfuture.ru',
      role: 'hr',
      created_at: '2025-01-15T10:00:00Z',
    },
    profile: {
      id: 'demo-ep-002',
      user_id: 'demo-user-002',
      tenant_id: 'demo-tenant-001',
      grade: 'lead',
      tenure_months: 48,
      location: 'Москва',
      legal_entity: 'ООО Технологии Будущего',
      extra: { department: 'HR' },
    },
    full_name: 'Петрова Анна Сергеевна',
    department: 'HR',
  },
  {
    user: {
      id: 'demo-user-003',
      auth_id: 'demo-auth-003',
      tenant_id: 'demo-tenant-001',
      email: 'sidorov@techfuture.ru',
      role: 'employee',
      created_at: '2025-02-01T10:00:00Z',
    },
    profile: {
      id: 'demo-ep-003',
      user_id: 'demo-user-003',
      tenant_id: 'demo-tenant-001',
      grade: 'middle',
      tenure_months: 18,
      location: 'Москва',
      legal_entity: 'ООО Технологии Будущего',
      extra: { department: 'Разработка' },
    },
    full_name: 'Сидоров Алексей Дмитриевич',
    department: 'Разработка',
  },
  {
    user: {
      id: 'demo-user-004',
      auth_id: 'demo-auth-004',
      tenant_id: 'demo-tenant-001',
      email: 'kuznetsova@techfuture.ru',
      role: 'employee',
      created_at: '2025-01-22T10:00:00Z',
    },
    profile: {
      id: 'demo-ep-004',
      user_id: 'demo-user-004',
      tenant_id: 'demo-tenant-001',
      grade: 'senior',
      tenure_months: 30,
      location: 'Санкт-Петербург',
      legal_entity: 'ООО Технологии Будущего',
      extra: { department: 'Маркетинг' },
    },
    full_name: 'Кузнецова Мария Александровна',
    department: 'Маркетинг',
  },
  {
    user: {
      id: 'demo-user-005',
      auth_id: 'demo-auth-005',
      tenant_id: 'demo-tenant-001',
      email: 'volkov@techfuture.ru',
      role: 'employee',
      created_at: '2025-01-25T10:00:00Z',
    },
    profile: {
      id: 'demo-ep-005',
      user_id: 'demo-user-005',
      tenant_id: 'demo-tenant-001',
      grade: 'junior',
      tenure_months: 6,
      location: 'Москва',
      legal_entity: 'ООО Технологии Будущего',
      extra: { department: 'Продажи' },
    },
    full_name: 'Волков Дмитрий Олегович',
    department: 'Продажи',
  },
  {
    user: {
      id: 'demo-user-006',
      auth_id: 'demo-auth-006',
      tenant_id: 'demo-tenant-001',
      email: 'sokolova@techfuture.ru',
      role: 'hr',
      created_at: '2025-01-18T10:00:00Z',
    },
    profile: {
      id: 'demo-ep-006',
      user_id: 'demo-user-006',
      tenant_id: 'demo-tenant-001',
      grade: 'middle',
      tenure_months: 24,
      location: 'Москва',
      legal_entity: 'ООО Технологии Будущего',
      extra: { department: 'HR' },
    },
    full_name: 'Соколова Елена Викторовна',
    department: 'HR',
  },
  {
    user: {
      id: 'demo-user-007',
      auth_id: 'demo-auth-007',
      tenant_id: 'demo-tenant-001',
      email: 'morozov@techfuture.ru',
      role: 'admin',
      created_at: '2025-01-15T09:00:00Z',
    },
    profile: {
      id: 'demo-ep-007',
      user_id: 'demo-user-007',
      tenant_id: 'demo-tenant-001',
      grade: 'lead',
      tenure_months: 60,
      location: 'Москва',
      legal_entity: 'ООО Технологии Будущего',
      extra: { department: 'Разработка' },
    },
    full_name: 'Морозов Павел Николаевич',
    department: 'Разработка',
  },
  {
    user: {
      id: 'demo-user-008',
      auth_id: 'demo-auth-008',
      tenant_id: 'demo-tenant-001',
      email: 'novikova@techfuture.ru',
      role: 'employee',
      created_at: '2025-02-10T10:00:00Z',
    },
    profile: {
      id: 'demo-ep-008',
      user_id: 'demo-user-008',
      tenant_id: 'demo-tenant-001',
      grade: 'middle',
      tenure_months: 12,
      location: 'Казань',
      legal_entity: 'ООО Технологии Будущего',
      extra: { department: 'Финансы' },
    },
    full_name: 'Новикова Ольга Андреевна',
    department: 'Финансы',
  },
];

// ========================== 10. DEMO HR DASHBOARD ===========================

export interface DemoHrDashboard {
  summary: {
    total_employees: number;
    active_employees: number;
    total_accrued: number;
    total_spent: number;
    utilization_pct: number;
  };
  popular_benefits: Array<{
    name: string;
    order_count: number;
    total_points: number;
  }>;
  category_distribution: Array<{
    name: string;
    total_points: number;
    pct: number;
  }>;
  monthly_trend: Array<{
    month: string;
    accrued: number;
    spent: number;
  }>;
}

export const DEMO_HR_DASHBOARD: DemoHrDashboard = {
  summary: {
    total_employees: 8,
    active_employees: 5,
    total_accrued: 400000,
    total_spent: 156000,
    utilization_pct: 39,
  },
  popular_benefits: [
    { name: 'ДМС расширенный', order_count: 6, total_points: 90000 },
    { name: 'Фитнес-клуб', order_count: 5, total_points: 30000 },
    { name: 'Обеды в офисе', order_count: 4, total_points: 8000 },
    { name: 'Английский язык', order_count: 3, total_points: 12000 },
    { name: 'Курсы Skillbox', order_count: 3, total_points: 15000 },
  ],
  category_distribution: [
    { name: 'Здоровье', total_points: 62400, pct: 40 },
    { name: 'Спорт', total_points: 34320, pct: 22 },
    { name: 'Образование', total_points: 28080, pct: 18 },
    { name: 'Питание', total_points: 18720, pct: 12 },
    { name: 'Транспорт', total_points: 12480, pct: 8 },
  ],
  monthly_trend: [
    { month: '2024-09', accrued: 50000, spent: 18000 },
    { month: '2024-10', accrued: 55000, spent: 22000 },
    { month: '2024-11', accrued: 50000, spent: 28000 },
    { month: '2024-12', accrued: 60000, spent: 35000 },
    { month: '2025-01', accrued: 75000, spent: 30000 },
    { month: '2025-02', accrued: 110000, spent: 23000 },
  ],
};

// ========================== 11. DEMO POLICIES ===============================

export const DEMO_POLICIES: BudgetPolicy[] = [
  {
    id: 'demo-policy-001',
    tenant_id: 'demo-tenant-001',
    name: 'Стандартный бюджет',
    points_amount: 50000,
    period: 'quarterly',
    target_filter: { grades: ['junior', 'middle', 'senior', 'lead'] },
    is_active: true,
  },
  {
    id: 'demo-policy-002',
    tenant_id: 'demo-tenant-001',
    name: 'Расширенный бюджет',
    points_amount: 75000,
    period: 'quarterly',
    target_filter: { grades: ['senior', 'lead'] },
    is_active: true,
  },
];

// ========================== 12. DEMO RULES ==================================

export const DEMO_RULES: EligibilityRule[] = [
  {
    id: 'demo-rule-001',
    benefit_id: 'demo-ben-006', // Конференция
    tenant_id: 'demo-tenant-001',
    conditions: {
      min_tenure_months: 6,
      allowed_grades: ['middle', 'senior', 'lead'],
      description: 'Доступно сотрудникам от уровня middle со стажем от 6 месяцев',
    },
  },
  {
    id: 'demo-rule-002',
    benefit_id: 'demo-ben-001', // ДМС расширенный
    tenant_id: 'demo-tenant-001',
    conditions: {
      min_tenure_months: 3,
      description: 'Доступно после прохождения испытательного срока (3 месяца)',
    },
  },
  {
    id: 'demo-rule-003',
    benefit_id: 'demo-ben-012', // Парковка
    tenant_id: 'demo-tenant-001',
    conditions: {
      allowed_locations: ['Москва'],
      description: 'Доступно только для сотрудников московского офиса',
    },
  },
];

// ========================== 13. DEMO USERS LIST =============================

/** Flat user list for admin pages (combines User with display name). */
export interface DemoUserListItem {
  id: string;
  email: string;
  role: User['role'];
  full_name: string;
  department: string;
  grade: string;
  created_at: string;
  is_active: boolean;
}

export const DEMO_USERS_LIST: DemoUserListItem[] = DEMO_EMPLOYEES.map((emp) => ({
  id: emp.user.id,
  email: emp.user.email,
  role: emp.user.role,
  full_name: emp.full_name,
  department: emp.department,
  grade: emp.profile.grade,
  created_at: emp.user.created_at,
  is_active: true,
}));

// ========================== 14. DEMO AUDIT LOG ==============================

export const DEMO_AUDIT_LOG: AuditLog[] = [
  {
    id: 'demo-audit-001',
    tenant_id: 'demo-tenant-001',
    user_id: 'demo-user-007', // admin — Морозов
    action: 'tenant.created',
    entity_type: 'tenant',
    entity_id: 'demo-tenant-001',
    diff: { name: 'ООО Технологии Будущего' },
    created_at: '2025-01-15T10:00:00Z',
  },
  {
    id: 'demo-audit-002',
    tenant_id: 'demo-tenant-001',
    user_id: 'demo-user-007',
    action: 'user.created',
    entity_type: 'user',
    entity_id: 'demo-user-001',
    diff: { email: 'demo@techfuture.ru', role: 'employee' },
    created_at: '2025-01-20T10:00:00Z',
  },
  {
    id: 'demo-audit-003',
    tenant_id: 'demo-tenant-001',
    user_id: 'demo-user-002', // hr — Петрова
    action: 'benefit.created',
    entity_type: 'benefit',
    entity_id: 'demo-ben-001',
    diff: { name: 'ДМС расширенный', price_points: 15000 },
    created_at: '2025-01-16T10:00:00Z',
  },
  {
    id: 'demo-audit-004',
    tenant_id: 'demo-tenant-001',
    user_id: 'demo-user-002',
    action: 'benefit.created',
    entity_type: 'benefit',
    entity_id: 'demo-ben-007',
    diff: { name: 'Фитнес-клуб', price_points: 6000 },
    created_at: '2025-01-18T10:00:00Z',
  },
  {
    id: 'demo-audit-005',
    tenant_id: 'demo-tenant-001',
    user_id: 'demo-user-002',
    action: 'policy.created',
    entity_type: 'budget_policy',
    entity_id: 'demo-policy-001',
    diff: { name: 'Стандартный бюджет', points_amount: 50000 },
    created_at: '2025-01-20T12:00:00Z',
  },
  {
    id: 'demo-audit-006',
    tenant_id: 'demo-tenant-001',
    user_id: 'demo-user-001', // employee — Иванов
    action: 'order.created',
    entity_type: 'order',
    entity_id: 'demo-order-001',
    diff: { status: 'reserved', total_points: 10000 },
    created_at: '2025-01-10T14:20:00Z',
  },
  {
    id: 'demo-audit-007',
    tenant_id: 'demo-tenant-001',
    user_id: 'demo-user-001',
    action: 'order.paid',
    entity_type: 'order',
    entity_id: 'demo-order-001',
    diff: { status_from: 'reserved', status_to: 'paid' },
    created_at: '2025-01-10T14:23:00Z',
  },
  {
    id: 'demo-audit-008',
    tenant_id: 'demo-tenant-001',
    user_id: 'demo-user-001',
    action: 'order.created',
    entity_type: 'order',
    entity_id: 'demo-order-002',
    diff: { status: 'reserved', total_points: 6000 },
    created_at: '2025-02-05T16:40:00Z',
  },
  {
    id: 'demo-audit-009',
    tenant_id: 'demo-tenant-001',
    user_id: 'demo-user-001',
    action: 'order.cancelled',
    entity_type: 'order',
    entity_id: 'demo-order-003',
    diff: { status_from: 'reserved', status_to: 'cancelled', reason: 'Пользователь отменил заказ' },
    created_at: '2025-02-12T09:30:00Z',
  },
  {
    id: 'demo-audit-010',
    tenant_id: 'demo-tenant-001',
    user_id: 'demo-user-002',
    action: 'policy.updated',
    entity_type: 'budget_policy',
    entity_id: 'demo-policy-002',
    diff: { points_amount_from: 60000, points_amount_to: 75000 },
    created_at: '2025-02-20T11:00:00Z',
  },
];
