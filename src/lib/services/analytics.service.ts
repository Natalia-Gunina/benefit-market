import { unwrapRowsSoft } from "@/lib/supabase/typed-queries";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EmployeeProfile,
  Order,
  PointLedger,
  OrderItem,
  Benefit,
  BenefitCategory,
  Wallet,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepartmentUtilization {
  department: string;
  employee_count: number;
  total_accrued: number;
  total_spent: number;
  utilization_pct: number;
}

export interface GradeUtilization {
  grade: string;
  employee_count: number;
  total_accrued: number;
  total_spent: number;
  utilization_pct: number;
}

export interface UtilizationData {
  overall: {
    total_budget: number;
    total_spent: number;
    total_remaining: number;
    utilization_pct: number;
  };
  by_department: DepartmentUtilization[];
  by_grade: GradeUtilization[];
  monthly_trend: Array<{ month: string; accrued: number; spent: number; utilization_pct: number }>;
}

export interface PopularBenefitExtended {
  name: string;
  category: string;
  order_count: number;
  total_points: number;
  unique_users: number;
}

export interface EngagementData {
  overall: {
    total_employees: number;
    active_employees: number;
    inactive_employees: number;
    participation_pct: number;
    avg_orders_per_employee: number;
    avg_spend_per_employee: number;
  };
  by_department: Array<{
    department: string;
    total: number;
    active: number;
    participation_pct: number;
    avg_spend: number;
  }>;
  by_grade: Array<{
    grade: string;
    total: number;
    active: number;
    participation_pct: number;
    avg_spend: number;
  }>;
}

export interface CategoryTrendItem {
  month: string;
  [category: string]: string | number; // category names as keys, amounts as values
}

export interface CategoryData {
  distribution: Array<{
    name: string;
    total_points: number;
    pct: number;
    order_count: number;
  }>;
  trend: CategoryTrendItem[];
}

export interface AnalyticsData {
  utilization: UtilizationData;
  popular: PopularBenefitExtended[];
  engagement: EngagementData;
  categories: CategoryData;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);
  }
  return months;
}

function getDepartment(profile: EmployeeProfile): string {
  const extra = profile.extra as Record<string, unknown> | null;
  return (extra?.department as string) || "Не указан";
}

function gradeLabel(grade: string): string {
  const labels: Record<string, string> = {
    junior: "Junior",
    middle: "Middle",
    senior: "Senior",
    lead: "Lead",
  };
  return labels[grade] || grade;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function generateAnalytics(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<AnalyticsData> {
  // Fetch all base data in parallel
  const [profiles, orders, ledger, wallets, items, benefits, categories] = await Promise.all([
    unwrapRowsSoft<EmployeeProfile>(
      await supabase.from("employee_profiles").select("*").eq("tenant_id", tenantId),
    ),
    unwrapRowsSoft<Order>(
      await supabase.from("orders").select("*").eq("tenant_id", tenantId),
    ),
    unwrapRowsSoft<PointLedger>(
      await supabase.from("point_ledger").select("*").eq("tenant_id", tenantId),
    ),
    unwrapRowsSoft<Wallet>(
      await supabase.from("wallets").select("*").eq("tenant_id", tenantId),
    ),
    unwrapRowsSoft<OrderItem>(
      await supabase
        .from("order_items")
        .select("*, orders!inner(tenant_id, user_id, status)")
        .eq("orders.tenant_id", tenantId),
    ),
    unwrapRowsSoft<Benefit>(
      await supabase.from("benefits").select("*").eq("tenant_id", tenantId),
    ),
    unwrapRowsSoft<BenefitCategory>(
      await supabase.from("benefit_categories").select("*").eq("tenant_id", tenantId),
    ),
  ]);

  const benefitMap = new Map(benefits.map((b) => [b.id, b]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const profileByUserId = new Map(profiles.map((p) => [p.user_id, p]));

  // ----- Ledger aggregates -----
  let totalAccrued = 0;
  let totalSpent = 0;
  const accrualByUser = new Map<string, number>();
  const spendByUser = new Map<string, number>();

  for (const entry of ledger) {
    // Find user_id from wallet
    const wallet = wallets.find((w) => w.id === entry.wallet_id);
    const userId = wallet?.user_id;

    if (entry.type === "accrual") {
      totalAccrued += entry.amount;
      if (userId) {
        accrualByUser.set(userId, (accrualByUser.get(userId) || 0) + entry.amount);
      }
    } else if (entry.type === "spend") {
      totalSpent += Math.abs(entry.amount);
      if (userId) {
        spendByUser.set(userId, (spendByUser.get(userId) || 0) + Math.abs(entry.amount));
      }
    }
  }

  // ----- Utilization -----
  const deptStats = new Map<string, { count: number; accrued: number; spent: number }>();
  const gradeStats = new Map<string, { count: number; accrued: number; spent: number }>();

  for (const profile of profiles) {
    const dept = getDepartment(profile);
    const grade = gradeLabel(profile.grade);
    const userAccrued = accrualByUser.get(profile.user_id) || 0;
    const userSpent = spendByUser.get(profile.user_id) || 0;

    const deptEntry = deptStats.get(dept) || { count: 0, accrued: 0, spent: 0 };
    deptEntry.count++;
    deptEntry.accrued += userAccrued;
    deptEntry.spent += userSpent;
    deptStats.set(dept, deptEntry);

    const gradeEntry = gradeStats.get(grade) || { count: 0, accrued: 0, spent: 0 };
    gradeEntry.count++;
    gradeEntry.accrued += userAccrued;
    gradeEntry.spent += userSpent;
    gradeStats.set(grade, gradeEntry);
  }

  const byDepartment: DepartmentUtilization[] = Array.from(deptStats.entries())
    .map(([department, s]) => ({
      department,
      employee_count: s.count,
      total_accrued: s.accrued,
      total_spent: s.spent,
      utilization_pct: s.accrued > 0 ? Math.round((s.spent / s.accrued) * 100) : 0,
    }))
    .sort((a, b) => b.utilization_pct - a.utilization_pct);

  const byGrade: GradeUtilization[] = Array.from(gradeStats.entries())
    .map(([grade, s]) => ({
      grade,
      employee_count: s.count,
      total_accrued: s.accrued,
      total_spent: s.spent,
      utilization_pct: s.accrued > 0 ? Math.round((s.spent / s.accrued) * 100) : 0,
    }))
    .sort((a, b) => b.utilization_pct - a.utilization_pct);

  // Monthly utilization trend (12 months)
  const last12Months = getLastNMonths(12);
  const monthMap = new Map(last12Months.map((m) => [m, { accrued: 0, spent: 0 }]));
  for (const entry of ledger) {
    const monthKey = entry.created_at.slice(0, 7);
    const current = monthMap.get(monthKey);
    if (current) {
      if (entry.type === "accrual") current.accrued += entry.amount;
      else if (entry.type === "spend") current.spent += Math.abs(entry.amount);
    }
  }
  const monthlyTrend = last12Months.map((month) => {
    const data = monthMap.get(month)!;
    return {
      month,
      accrued: data.accrued,
      spent: data.spent,
      utilization_pct: data.accrued > 0 ? Math.round((data.spent / data.accrued) * 100) : 0,
    };
  });

  const utilization: UtilizationData = {
    overall: {
      total_budget: totalAccrued,
      total_spent: totalSpent,
      total_remaining: totalAccrued - totalSpent,
      utilization_pct: totalAccrued > 0 ? Math.round((totalSpent / totalAccrued) * 100) : 0,
    },
    by_department: byDepartment,
    by_grade: byGrade,
    monthly_trend: monthlyTrend,
  };

  // ----- Popular benefits -----
  type ItemWithOrder = OrderItem & { orders: { tenant_id: string; user_id: string; status: string } };
  const paidItems = (items as ItemWithOrder[]).filter(
    (i) => i.orders.status === "paid" && i.benefit_id,
  );

  const benefitAgg = new Map<string, { name: string; category: string; count: number; total: number; users: Set<string> }>();
  for (const item of paidItems) {
    const benefit = benefitMap.get(item.benefit_id!);
    if (!benefit) continue;
    const cat = categoryMap.get(benefit.category_id);
    const key = item.benefit_id!;
    const existing = benefitAgg.get(key) || {
      name: benefit.name,
      category: cat?.name || "Прочее",
      count: 0,
      total: 0,
      users: new Set<string>(),
    };
    existing.count += item.quantity;
    existing.total += item.price_points * item.quantity;
    existing.users.add(item.orders.user_id);
    benefitAgg.set(key, existing);
  }
  const popular: PopularBenefitExtended[] = Array.from(benefitAgg.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((s) => ({
      name: s.name,
      category: s.category,
      order_count: s.count,
      total_points: s.total,
      unique_users: s.users.size,
    }));

  // ----- Engagement -----
  const activeUserIds = new Set(
    orders.filter((o) => o.status === "paid" || o.status === "reserved").map((o) => o.user_id),
  );
  const orderCountByUser = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "paid") {
      orderCountByUser.set(order.user_id, (orderCountByUser.get(order.user_id) || 0) + 1);
    }
  }

  const totalEmployees = profiles.length;
  const activeEmployees = profiles.filter((p) => activeUserIds.has(p.user_id)).length;

  const engByDept = new Map<string, { total: number; active: number; totalSpend: number }>();
  const engByGrade = new Map<string, { total: number; active: number; totalSpend: number }>();

  for (const profile of profiles) {
    const dept = getDepartment(profile);
    const grade = gradeLabel(profile.grade);
    const isActive = activeUserIds.has(profile.user_id);
    const userSpent = spendByUser.get(profile.user_id) || 0;

    const deptEntry = engByDept.get(dept) || { total: 0, active: 0, totalSpend: 0 };
    deptEntry.total++;
    if (isActive) deptEntry.active++;
    deptEntry.totalSpend += userSpent;
    engByDept.set(dept, deptEntry);

    const gradeEntry = engByGrade.get(grade) || { total: 0, active: 0, totalSpend: 0 };
    gradeEntry.total++;
    if (isActive) gradeEntry.active++;
    gradeEntry.totalSpend += userSpent;
    engByGrade.set(grade, gradeEntry);
  }

  const totalOrders = orders.filter((o) => o.status === "paid").length;
  const engagement: EngagementData = {
    overall: {
      total_employees: totalEmployees,
      active_employees: activeEmployees,
      inactive_employees: totalEmployees - activeEmployees,
      participation_pct: totalEmployees > 0 ? Math.round((activeEmployees / totalEmployees) * 100) : 0,
      avg_orders_per_employee: activeEmployees > 0 ? Math.round((totalOrders / activeEmployees) * 10) / 10 : 0,
      avg_spend_per_employee: activeEmployees > 0 ? Math.round(totalSpent / activeEmployees) : 0,
    },
    by_department: Array.from(engByDept.entries())
      .map(([department, s]) => ({
        department,
        total: s.total,
        active: s.active,
        participation_pct: s.total > 0 ? Math.round((s.active / s.total) * 100) : 0,
        avg_spend: s.active > 0 ? Math.round(s.totalSpend / s.active) : 0,
      }))
      .sort((a, b) => b.participation_pct - a.participation_pct),
    by_grade: Array.from(engByGrade.entries())
      .map(([grade, s]) => ({
        grade,
        total: s.total,
        active: s.active,
        participation_pct: s.total > 0 ? Math.round((s.active / s.total) * 100) : 0,
        avg_spend: s.active > 0 ? Math.round(s.totalSpend / s.active) : 0,
      }))
      .sort((a, b) => b.participation_pct - a.participation_pct),
  };

  // ----- Categories -----
  const catAgg = new Map<string, { name: string; total: number; count: number }>();
  for (const item of paidItems) {
    const benefit = benefitMap.get(item.benefit_id!);
    if (!benefit) continue;
    const cat = categoryMap.get(benefit.category_id);
    const name = cat?.name || "Прочее";
    const existing = catAgg.get(name) || { name, total: 0, count: 0 };
    existing.total += item.price_points * item.quantity;
    existing.count += item.quantity;
    catAgg.set(name, existing);
  }
  const grandTotal = Array.from(catAgg.values()).reduce((s, c) => s + c.total, 0);
  const distribution = Array.from(catAgg.values())
    .sort((a, b) => b.total - a.total)
    .map((s) => ({
      name: s.name,
      total_points: s.total,
      pct: grandTotal > 0 ? Math.round((s.total / grandTotal) * 100) : 0,
      order_count: s.count,
    }));

  // Category trend (last 6 months)
  const last6Months = getLastNMonths(6);
  const catMonthMap = new Map<string, Map<string, number>>();
  for (const month of last6Months) {
    catMonthMap.set(month, new Map());
  }
  for (const item of paidItems) {
    const benefit = benefitMap.get(item.benefit_id!);
    if (!benefit) continue;
    const cat = categoryMap.get(benefit.category_id);
    const name = cat?.name || "Прочее";
    // Find order to get date
    const order = orders.find((o) => o.id === item.order_id);
    if (!order) continue;
    const monthKey = order.created_at.slice(0, 7);
    const monthData = catMonthMap.get(monthKey);
    if (monthData) {
      monthData.set(name, (monthData.get(name) || 0) + item.price_points * item.quantity);
    }
  }
  const categoryNames = Array.from(new Set(distribution.map((d) => d.name)));
  const trend: CategoryTrendItem[] = last6Months.map((month) => {
    const monthData = catMonthMap.get(month)!;
    const entry: CategoryTrendItem = { month };
    for (const name of categoryNames) {
      entry[name] = monthData.get(name) || 0;
    }
    return entry;
  });

  const categoriesData: CategoryData = { distribution, trend };

  return { utilization, popular, engagement, categories: categoriesData };
}
