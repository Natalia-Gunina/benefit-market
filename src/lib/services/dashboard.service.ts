import { unwrapRowsSoft } from "@/lib/supabase/typed-queries";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EmployeeProfile,
  Order,
  PointLedger,
  OrderItem,
  Benefit,
  BenefitCategory,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  total_employees: number;
  active_employees: number;
  total_accrued: number;
  total_spent: number;
  utilization_pct: number;
}

export interface PopularBenefit {
  name: string;
  order_count: number;
  total_points: number;
}

export interface CategoryDistribution {
  name: string;
  total_points: number;
  pct: number;
}

export interface MonthlyTrend {
  month: string;
  accrued: number;
  spent: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  popular_benefits: PopularBenefit[];
  category_distribution: CategoryDistribution[];
  monthly_trend: MonthlyTrend[];
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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function generateDashboard(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<DashboardData> {
  // Fetch all base data in parallel
  const [profiles, orders, ledger] = await Promise.all([
    unwrapRowsSoft<EmployeeProfile>(
      await supabase.from("employee_profiles").select("*").eq("tenant_id", tenantId),
    ),
    unwrapRowsSoft<Order>(
      await supabase.from("orders").select("*").eq("tenant_id", tenantId),
    ),
    unwrapRowsSoft<PointLedger>(
      await supabase.from("point_ledger").select("*").eq("tenant_id", tenantId),
    ),
  ]);

  // --- Summary ---
  const activeUserIds = new Set(orders.map((o) => o.user_id));

  let totalAccrued = 0;
  let totalSpent = 0;
  for (const entry of ledger) {
    if (entry.type === "accrual") totalAccrued += entry.amount;
    else if (entry.type === "spend") totalSpent += Math.abs(entry.amount);
  }

  const summary: DashboardSummary = {
    total_employees: profiles.length,
    active_employees: activeUserIds.size,
    total_accrued: totalAccrued,
    total_spent: totalSpent,
    utilization_pct: totalAccrued > 0 ? Math.round((totalSpent / totalAccrued) * 100) : 0,
  };

  // --- Popular benefits & category distribution ---
  const orderIds = orders.map((o) => o.id);
  let popularBenefits: PopularBenefit[] = [];
  let categoryDistribution: CategoryDistribution[] = [];

  if (orderIds.length > 0) {
    const [items, benefits, categories] = await Promise.all([
      unwrapRowsSoft<OrderItem>(
        await supabase.from("order_items").select("*").in("order_id", orderIds),
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

    // Popular benefits
    const benefitStats = new Map<string, { name: string; count: number; total: number }>();
    for (const item of items) {
      const benefit = benefitMap.get(item.benefit_id);
      const name = benefit?.name ?? "Неизвестно";
      const existing = benefitStats.get(item.benefit_id) || { name, count: 0, total: 0 };
      existing.count += item.quantity;
      existing.total += item.price_points * item.quantity;
      benefitStats.set(item.benefit_id, existing);
    }
    popularBenefits = Array.from(benefitStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((s) => ({ name: s.name, order_count: s.count, total_points: s.total }));

    // Category distribution
    const categoryStats = new Map<string, { name: string; total: number }>();
    for (const item of items) {
      const benefit = benefitMap.get(item.benefit_id);
      if (!benefit) continue;
      const category = categoryMap.get(benefit.category_id);
      const name = category?.name ?? "Прочее";
      const existing = categoryStats.get(benefit.category_id) || { name, total: 0 };
      existing.total += item.price_points * item.quantity;
      categoryStats.set(benefit.category_id, existing);
    }
    const grandTotal = Array.from(categoryStats.values()).reduce((s, c) => s + c.total, 0);
    categoryDistribution = Array.from(categoryStats.values())
      .sort((a, b) => b.total - a.total)
      .map((s) => ({
        name: s.name,
        total_points: s.total,
        pct: grandTotal > 0 ? Math.round((s.total / grandTotal) * 100) : 0,
      }));
  }

  // --- Monthly trend ---
  const last6Months = getLastNMonths(6);
  const monthlyMap = new Map(last6Months.map((m) => [m, { accrued: 0, spent: 0 }]));

  for (const entry of ledger) {
    const monthKey = entry.created_at.slice(0, 7);
    const current = monthlyMap.get(monthKey);
    if (current) {
      if (entry.type === "accrual") current.accrued += entry.amount;
      else if (entry.type === "spend") current.spent += Math.abs(entry.amount);
    }
  }

  const monthlyTrend: MonthlyTrend[] = last6Months.map((month) => {
    const data = monthlyMap.get(month)!;
    return { month, accrued: data.accrued, spent: data.spent };
  });

  return { summary, popular_benefits: popularBenefits, category_distribution: categoryDistribution, monthly_trend: monthlyTrend };
}
