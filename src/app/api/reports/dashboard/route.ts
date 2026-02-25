import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  User,
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

interface DashboardSummary {
  total_employees: number;
  active_employees: number;
  total_accrued: number;
  total_spent: number;
  utilization_pct: number;
}

interface PopularBenefit {
  name: string;
  order_count: number;
  total_points: number;
}

interface CategoryDistribution {
  name: string;
  total_points: number;
  pct: number;
}

interface MonthlyTrend {
  month: string;
  accrued: number;
  spent: number;
}

interface DashboardData {
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
// GET /api/reports/dashboard --- HR Dashboard data
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const { DEMO_HR_DASHBOARD } = await import("@/lib/demo-data");
      return NextResponse.json({ data: DEMO_HR_DASHBOARD });
    }

    const supabase = await createClient();

    // --- Authenticate user ---
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // --- Get the app-level user record ---
    const { data: rawUser, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", authUser.id)
      .single();

    const appUser = rawUser as User | null;

    if (userError || !appUser) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "User record not found" } },
        { status: 404 }
      );
    }

    // --- Role check: hr or admin only ---
    if (appUser.role !== "hr" && appUser.role !== "admin") {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only HR or admin users can access the dashboard",
          },
        },
        { status: 403 }
      );
    }

    const tenantId = appUser.tenant_id;

    // =====================================================================
    // 1. SUMMARY
    // =====================================================================

    // Total employees
    const { data: rawProfiles } = await supabase
      .from("employee_profiles")
      .select("*")
      .eq("tenant_id", tenantId);

    const profiles = (rawProfiles ?? []) as unknown as EmployeeProfile[];
    const totalEmployees = profiles.length;

    // Active employees = distinct users who have placed orders
    const { data: rawOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("tenant_id", tenantId);

    const orders = (rawOrders ?? []) as unknown as Order[];
    const activeUserIds = new Set(orders.map((o) => o.user_id));
    const activeEmployees = activeUserIds.size;

    // Total accrued & spent from point_ledger
    const { data: rawLedger } = await supabase
      .from("point_ledger")
      .select("*")
      .eq("tenant_id", tenantId);

    const ledger = (rawLedger ?? []) as unknown as PointLedger[];

    let totalAccrued = 0;
    let totalSpent = 0;

    for (const entry of ledger) {
      if (entry.type === "accrual") {
        totalAccrued += entry.amount;
      } else if (entry.type === "spend") {
        totalSpent += Math.abs(entry.amount);
      }
    }

    const utilizationPct =
      totalAccrued > 0 ? Math.round((totalSpent / totalAccrued) * 100) : 0;

    const summary: DashboardSummary = {
      total_employees: totalEmployees,
      active_employees: activeEmployees,
      total_accrued: totalAccrued,
      total_spent: totalSpent,
      utilization_pct: utilizationPct,
    };

    // =====================================================================
    // 2. POPULAR BENEFITS
    // =====================================================================

    // Get all order items for this tenant's orders
    const orderIds = orders.map((o) => o.id);

    let popularBenefits: PopularBenefit[] = [];

    if (orderIds.length > 0) {
      const { data: rawItems } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);

      const items = (rawItems ?? []) as unknown as OrderItem[];

      // Get all benefits
      const { data: rawBenefits } = await supabase
        .from("benefits")
        .select("*")
        .eq("tenant_id", tenantId);

      const benefits = (rawBenefits ?? []) as unknown as Benefit[];
      const benefitMap = new Map(benefits.map((b) => [b.id, b]));

      // Group by benefit_id
      const benefitStats = new Map<
        string,
        { name: string; count: number; total: number }
      >();

      for (const item of items) {
        const benefit = benefitMap.get(item.benefit_id);
        const name = benefit?.name ?? "Неизвестно";
        const existing = benefitStats.get(item.benefit_id) || {
          name,
          count: 0,
          total: 0,
        };
        existing.count += item.quantity;
        existing.total += item.price_points * item.quantity;
        benefitStats.set(item.benefit_id, existing);
      }

      popularBenefits = Array.from(benefitStats.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((s) => ({
          name: s.name,
          order_count: s.count,
          total_points: s.total,
        }));
    }

    // =====================================================================
    // 3. CATEGORY DISTRIBUTION
    // =====================================================================

    let categoryDistribution: CategoryDistribution[] = [];

    if (orderIds.length > 0) {
      const { data: rawItems } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);

      const items = (rawItems ?? []) as unknown as OrderItem[];

      // Get benefits and categories
      const { data: rawBenefits } = await supabase
        .from("benefits")
        .select("*")
        .eq("tenant_id", tenantId);

      const benefits = (rawBenefits ?? []) as unknown as Benefit[];
      const benefitMap = new Map(benefits.map((b) => [b.id, b]));

      const { data: rawCategories } = await supabase
        .from("benefit_categories")
        .select("*")
        .eq("tenant_id", tenantId);

      const categories = (rawCategories ?? []) as unknown as BenefitCategory[];
      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      // Group by category
      const categoryStats = new Map<string, { name: string; total: number }>();

      for (const item of items) {
        const benefit = benefitMap.get(item.benefit_id);
        if (!benefit) continue;
        const category = categoryMap.get(benefit.category_id);
        const name = category?.name ?? "Прочее";
        const existing = categoryStats.get(benefit.category_id) || {
          name,
          total: 0,
        };
        existing.total += item.price_points * item.quantity;
        categoryStats.set(benefit.category_id, existing);
      }

      const grandTotal = Array.from(categoryStats.values()).reduce(
        (sum, s) => sum + s.total,
        0
      );

      categoryDistribution = Array.from(categoryStats.values())
        .sort((a, b) => b.total - a.total)
        .map((s) => ({
          name: s.name,
          total_points: s.total,
          pct: grandTotal > 0 ? Math.round((s.total / grandTotal) * 100) : 0,
        }));
    }

    // =====================================================================
    // 4. MONTHLY TREND (last 6 months)
    // =====================================================================

    const last6Months = getLastNMonths(6);

    const monthlyMap = new Map<string, { accrued: number; spent: number }>();
    for (const m of last6Months) {
      monthlyMap.set(m, { accrued: 0, spent: 0 });
    }

    for (const entry of ledger) {
      const monthKey = entry.created_at.slice(0, 7); // "YYYY-MM"
      if (monthlyMap.has(monthKey)) {
        const current = monthlyMap.get(monthKey)!;
        if (entry.type === "accrual") {
          current.accrued += entry.amount;
        } else if (entry.type === "spend") {
          current.spent += Math.abs(entry.amount);
        }
      }
    }

    const monthlyTrend: MonthlyTrend[] = last6Months.map((month) => {
      const data = monthlyMap.get(month)!;
      return { month, accrued: data.accrued, spent: data.spent };
    });

    // =====================================================================
    // RESPONSE
    // =====================================================================

    const data: DashboardData = {
      summary,
      popular_benefits: popularBenefits,
      category_distribution: categoryDistribution,
      monthly_trend: monthlyTrend,
    };

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/reports/dashboard] Unexpected error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
