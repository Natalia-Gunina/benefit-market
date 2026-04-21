import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { generateAnalytics } from "@/lib/services/analytics.service";

export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      const data = await buildDemoAnalytics();
      return success(data);
    }

    const appUser = await requireRole("hr", "admin");
    const supabase = await createClient();
    const data = await generateAnalytics(supabase, appUser.tenant_id);
    return success(data);
  }, "GET /api/hr/analytics");
}

/**
 * Derive HR analytics from the same DEMO_* arrays the rest of the demo
 * flows use, so totals and charts match what the user sees in orders,
 * wallets and reviews. Monthly trends are kept synthetic (hard to build a
 * believable time-series out of ~6 orders).
 */
async function buildDemoAnalytics() {
  const {
    DEMO_EMPLOYEES,
    DEMO_WALLETS,
    DEMO_LEDGER,
    DEMO_ORDERS,
    DEMO_ORDER_ITEMS,
    DEMO_PROVIDER_OFFERINGS,
    DEMO_GLOBAL_CATEGORIES,
    DEMO_HR_ANALYTICS,
  } = await import("@/lib/demo-data");

  const offeringById = new Map(DEMO_PROVIDER_OFFERINGS.map((o) => [o.id, o]));
  const categoryById = new Map(DEMO_GLOBAL_CATEGORIES.map((c) => [c.id, c]));
  const walletByUser = new Map(DEMO_WALLETS.map((w) => [w.user_id, w]));
  const orderById = new Map(DEMO_ORDERS.map((o) => [o.id, o]));

  const employees = DEMO_EMPLOYEES;
  const departmentOf = (emp: (typeof employees)[number]) =>
    (emp.profile.extra as { department?: string } | null)?.department ?? "Не указан";
  const gradeOf = (emp: (typeof employees)[number]) => {
    const g = emp.profile.grade;
    return g ? g[0].toUpperCase() + g.slice(1) : "—";
  };

  // ---- Utilization ----
  const accrualsByUser = new Map<string, number>();
  const spentByUser = new Map<string, number>();
  DEMO_LEDGER.forEach((e) => {
    const w = DEMO_WALLETS.find((w) => w.id === e.wallet_id);
    if (!w) return;
    if (e.type === "accrual" || e.type === "release") {
      accrualsByUser.set(w.user_id, (accrualsByUser.get(w.user_id) ?? 0) + Math.max(0, e.amount));
    } else if (e.type === "spend") {
      spentByUser.set(w.user_id, (spentByUser.get(w.user_id) ?? 0) + Math.abs(e.amount));
    }
  });

  const totalBudget = Array.from(accrualsByUser.values()).reduce((s, v) => s + v, 0);
  const totalSpent = Array.from(spentByUser.values()).reduce((s, v) => s + v, 0);
  const totalRemaining = Math.max(0, totalBudget - totalSpent);

  const groupBy = <K extends string>(keyFn: (emp: (typeof employees)[number]) => K) => {
    const acc = new Map<K, { count: number; accrued: number; spent: number }>();
    employees.forEach((emp) => {
      const k = keyFn(emp);
      const cur = acc.get(k) ?? { count: 0, accrued: 0, spent: 0 };
      cur.count += 1;
      cur.accrued += accrualsByUser.get(emp.user.id) ?? 0;
      cur.spent += spentByUser.get(emp.user.id) ?? 0;
      acc.set(k, cur);
    });
    return acc;
  };

  const byDept = groupBy(departmentOf);
  const byGrade = groupBy(gradeOf);

  const byDepartment = Array.from(byDept.entries()).map(([department, v]) => ({
    department,
    employee_count: v.count,
    total_accrued: v.accrued,
    total_spent: v.spent,
    utilization_pct: v.accrued > 0 ? Math.round((v.spent / v.accrued) * 100) : 0,
  }));
  const byGradeList = Array.from(byGrade.entries()).map(([grade, v]) => ({
    grade,
    employee_count: v.count,
    total_accrued: v.accrued,
    total_spent: v.spent,
    utilization_pct: v.accrued > 0 ? Math.round((v.spent / v.accrued) * 100) : 0,
  }));

  // ---- Popular offerings ----
  type PopAgg = { name: string; category: string; order_count: number; total_points: number; users: Set<string> };
  const popularMap = new Map<string, PopAgg>();
  DEMO_ORDER_ITEMS.forEach((oi) => {
    if (!oi.provider_offering_id) return;
    const order = orderById.get(oi.order_id);
    if (!order || order.status === "cancelled" || order.status === "expired") return;
    const po = offeringById.get(oi.provider_offering_id);
    if (!po) return;
    const category = categoryById.get(po.global_category_id ?? "")?.name ?? "—";
    const cur = popularMap.get(po.id) ?? {
      name: po.name,
      category,
      order_count: 0,
      total_points: 0,
      users: new Set<string>(),
    };
    cur.order_count += 1;
    cur.total_points += oi.price_points * oi.quantity;
    cur.users.add(order.user_id);
    popularMap.set(po.id, cur);
  });
  const popular = Array.from(popularMap.values())
    .map((p) => ({
      name: p.name,
      category: p.category,
      order_count: p.order_count,
      total_points: p.total_points,
      unique_users: p.users.size,
    }))
    .sort((a, b) => b.order_count - a.order_count);

  // ---- Engagement ----
  const activeUsers = new Set<string>();
  DEMO_ORDERS.forEach((o) => {
    if (o.status !== "cancelled" && o.status !== "expired") activeUsers.add(o.user_id);
  });
  const ordersByUser = new Map<string, number>();
  const spendByUserPaid = new Map<string, number>();
  DEMO_ORDERS.forEach((o) => {
    if (o.status === "cancelled" || o.status === "expired") return;
    ordersByUser.set(o.user_id, (ordersByUser.get(o.user_id) ?? 0) + 1);
    if (o.status === "paid") {
      spendByUserPaid.set(o.user_id, (spendByUserPaid.get(o.user_id) ?? 0) + o.total_points);
    }
  });

  const totalEmployees = employees.length;
  const active = Array.from(activeUsers).filter((uid) =>
    employees.some((e) => e.user.id === uid),
  ).length;

  const engagementByGroup = (keyFn: (emp: (typeof employees)[number]) => string) => {
    const acc = new Map<string, { total: number; active: number; spend: number }>();
    employees.forEach((emp) => {
      const k = keyFn(emp);
      const cur = acc.get(k) ?? { total: 0, active: 0, spend: 0 };
      cur.total += 1;
      if (activeUsers.has(emp.user.id)) cur.active += 1;
      cur.spend += spendByUserPaid.get(emp.user.id) ?? 0;
      acc.set(k, cur);
    });
    return Array.from(acc.entries()).map(([k, v]) => ({
      key: k,
      total: v.total,
      active: v.active,
      participation_pct: v.total > 0 ? Math.round((v.active / v.total) * 100) : 0,
      avg_spend: v.active > 0 ? Math.round(v.spend / v.active) : 0,
    }));
  };

  const totalOrdersAll = Array.from(ordersByUser.values()).reduce((s, v) => s + v, 0);
  const totalPaidSpend = Array.from(spendByUserPaid.values()).reduce((s, v) => s + v, 0);

  // ---- Categories distribution ----
  const categoryMap = new Map<string, { total_points: number; order_count: number }>();
  DEMO_ORDER_ITEMS.forEach((oi) => {
    if (!oi.provider_offering_id) return;
    const order = orderById.get(oi.order_id);
    if (!order || order.status === "cancelled" || order.status === "expired") return;
    const po = offeringById.get(oi.provider_offering_id);
    const cat = categoryById.get(po?.global_category_id ?? "")?.name ?? "—";
    const cur = categoryMap.get(cat) ?? { total_points: 0, order_count: 0 };
    cur.total_points += oi.price_points * oi.quantity;
    cur.order_count += 1;
    categoryMap.set(cat, cur);
  });
  const catSum = Array.from(categoryMap.values()).reduce((s, v) => s + v.total_points, 0);
  const distribution = Array.from(categoryMap.entries())
    .map(([name, v]) => ({
      name,
      total_points: v.total_points,
      pct: catSum > 0 ? Math.round((v.total_points / catSum) * 100) : 0,
      order_count: v.order_count,
    }))
    .sort((a, b) => b.total_points - a.total_points);

  // Walk employees by user.id, include wallet snapshot for completeness.
  void walletByUser;

  return {
    utilization: {
      overall: {
        total_budget: totalBudget,
        total_spent: totalSpent,
        total_remaining: totalRemaining,
        utilization_pct: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
      },
      by_department: byDepartment,
      by_grade: byGradeList,
      monthly_trend: DEMO_HR_ANALYTICS.utilization.monthly_trend,
    },
    popular,
    engagement: {
      overall: {
        total_employees: totalEmployees,
        active_employees: active,
        inactive_employees: totalEmployees - active,
        participation_pct:
          totalEmployees > 0 ? Math.round((active / totalEmployees) * 100) : 0,
        avg_orders_per_employee:
          active > 0 ? Math.round((totalOrdersAll / active) * 10) / 10 : 0,
        avg_spend_per_employee: active > 0 ? Math.round(totalPaidSpend / active) : 0,
      },
      by_department: engagementByGroup(departmentOf).map((r) => ({
        department: r.key,
        total: r.total,
        active: r.active,
        participation_pct: r.participation_pct,
        avg_spend: r.avg_spend,
      })),
      by_grade: engagementByGroup(gradeOf).map((r) => ({
        grade: r.key,
        total: r.total,
        active: r.active,
        participation_pct: r.participation_pct,
        avg_spend: r.avg_spend,
      })),
    },
    categories: {
      distribution,
      trend: DEMO_HR_ANALYTICS.categories.trend,
    },
  };
}
