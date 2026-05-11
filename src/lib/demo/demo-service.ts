/**
 * Centralized demo data access. Encapsulates complex demo responses
 * that involve filtering, pagination, and joins across entities.
 *
 * For simple cases (e.g. `success(DEMO_CATEGORIES)`), routes can
 * still import directly from `@/lib/demo-data`.
 */

import { NextResponse } from "next/server";
import { success, created } from "@/lib/api/response";
import { notFound } from "@/lib/errors";
import type { OrderItem } from "@/lib/types";

// Lazy-load demo data to avoid bundling in production
async function loadDemoData() {
  return import("@/lib/demo-data");
}

/**
 * In demo mode there is no real auth; the provider cabinet always acts on
 * behalf of "World Class" (demo-provider-001). Pin it once so analytics,
 * offerings and reviews routes scope to the same provider consistently.
 */
export const DEMO_CURRENT_PROVIDER_ID = "demo-provider-001";

// ---------------------------------------------------------------------------
// Benefits
// ---------------------------------------------------------------------------

export async function demoBenefitsList(params: {
  categoryId?: string | null;
  search?: string | null;
  page?: number;
  perPage?: number;
}): Promise<NextResponse> {
  const { DEMO_BENEFITS, DEMO_CATEGORIES } = await loadDemoData();
  const { categoryId, search, page = 1, perPage = 20 } = params;

  let filtered = DEMO_BENEFITS;
  if (categoryId) filtered = filtered.filter((b) => b.category_id === categoryId);
  if (search) filtered = filtered.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  const total = filtered.length;
  const offset = (page - 1) * perPage;
  const paginated = filtered.slice(offset, offset + perPage);

  const categoryMap = new Map(DEMO_CATEGORIES.map((c) => [c.id, c]));
  const data = paginated.map((b) => ({
    ...b,
    category: categoryMap.get(b.category_id)
      ? { name: categoryMap.get(b.category_id)!.name, icon: categoryMap.get(b.category_id)!.icon }
      : null,
  }));

  return NextResponse.json({ data, meta: { page, per_page: perPage, total } });
}

export async function demoBenefitDetail(id: string): Promise<NextResponse> {
  const { DEMO_BENEFITS, DEMO_CATEGORIES } = await loadDemoData();
  const benefit = DEMO_BENEFITS.find((b) => b.id === id);
  if (!benefit) throw notFound("Benefit not found");
  const cat = DEMO_CATEGORIES.find((c) => c.id === benefit.category_id);
  return success({
    ...benefit,
    category: cat ? { name: cat.name, icon: cat.icon } : null,
    isEligible: true,
  });
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function demoOrdersList(params: {
  status?: string | null;
  page?: number;
  perPage?: number;
  userId?: string | null;
}): Promise<NextResponse> {
  const {
    DEMO_ORDERS,
    DEMO_ORDER_ITEMS,
    DEMO_BENEFITS,
    DEMO_PROVIDER_OFFERINGS,
    DEMO_PROVIDERS,
  } = await loadDemoData();
  const { status, page = 1, perPage = 20, userId } = params;
  const offset = (page - 1) * perPage;

  const benefitMap = new Map(DEMO_BENEFITS.map((b) => [b.id, b]));
  const offeringMap = new Map(DEMO_PROVIDER_OFFERINGS.map((o) => [o.id, o]));
  const providerMap = new Map(DEMO_PROVIDERS.map((p) => [p.id, p]));
  let filtered = DEMO_ORDERS;
  if (userId) filtered = filtered.filter((o) => o.user_id === userId);
  if (status) filtered = filtered.filter((o) => o.status === status);

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + perPage);

  const data = paginated.map((order) => ({
    ...order,
    order_items: DEMO_ORDER_ITEMS.filter((oi) => oi.order_id === order.id).map((oi) => {
      const b = oi.benefit_id ? benefitMap.get(oi.benefit_id) : undefined;
      const po = oi.provider_offering_id
        ? offeringMap.get(oi.provider_offering_id)
        : undefined;
      const provider = po ? providerMap.get(po.provider_id) : undefined;
      return {
        ...oi,
        benefit: b
          ? { id: b.id, name: b.name, price_points: b.price_points, description: b.description }
          : undefined,
        offering: po
          ? {
              id: po.id,
              name: po.name,
              description: po.description,
              providers: provider ? { name: provider.name } : null,
            }
          : undefined,
      };
    }),
  }));

  return NextResponse.json({ data, meta: { page, per_page: perPage, total } });
}

export async function demoCreateOrder(items: Array<{ benefit_id?: string; tenant_offering_id?: string; quantity: number }>): Promise<NextResponse> {
  const { DEMO_BENEFITS } = await loadDemoData();
  const benefitMap = new Map(DEMO_BENEFITS.map((b) => [b.id, b]));
  const totalPoints = items.reduce((sum, item) => {
    const benefit = item.benefit_id ? benefitMap.get(item.benefit_id) : undefined;
    return sum + (benefit ? benefit.price_points * item.quantity : 0);
  }, 0);
  const now = new Date();
  const orderId = `demo-order-${Date.now()}`;

  const demoOrder = {
    id: orderId,
    user_id: "demo-user-001",
    tenant_id: "demo-tenant-001",
    status: "reserved" as const,
    total_points: totalPoints,
    reserved_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    created_at: now.toISOString(),
    order_items: items.map((item, idx) => {
      const b = item.benefit_id ? benefitMap.get(item.benefit_id) : undefined;
      return {
        id: `demo-oi-${Date.now()}-${idx}`,
        order_id: orderId,
        benefit_id: item.benefit_id ?? null,
        provider_offering_id: null,
        tenant_offering_id: item.tenant_offering_id ?? null,
        quantity: item.quantity,
        price_points: b ? b.price_points : 0,
        benefit: b
          ? { id: b.id, name: b.name, price_points: b.price_points, description: b.description }
          : undefined,
      } as OrderItem & { benefit?: { id: string; name: string; price_points: number; description: string } };
    }),
  };
  return created(demoOrder);
}

export function demoOrderAction(orderId: string, status: "paid" | "cancelled"): NextResponse {
  return success({
    id: orderId,
    status,
    total_points: 0,
    user_id: "demo-user-001",
    tenant_id: "demo-tenant-001",
    reserved_at: new Date().toISOString(),
    expires_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Admin benefits (with category join)
// ---------------------------------------------------------------------------

export async function demoAdminBenefitsList(): Promise<NextResponse> {
  const { DEMO_BENEFITS, DEMO_CATEGORIES } = await loadDemoData();
  const categoryMap = new Map(DEMO_CATEGORIES.map((c) => [c.id, c]));
  const data = DEMO_BENEFITS.map((b) => {
    const cat = categoryMap.get(b.category_id);
    return { ...b, benefit_categories: cat ? { name: cat.name, icon: cat.icon } : null };
  });
  return success(data);
}

// ---------------------------------------------------------------------------
// Provider — own offerings (list / detail)
// ---------------------------------------------------------------------------

export async function demoProviderOfferingsList(params: {
  status?: string | null;
  search?: string | null;
  page?: number;
  perPage?: number;
}): Promise<NextResponse> {
  const { DEMO_PROVIDER_OFFERINGS, DEMO_GLOBAL_CATEGORIES } = await loadDemoData();
  const { status, search, page = 1, perPage = 20 } = params;

  let rows = DEMO_PROVIDER_OFFERINGS.filter(
    (o) => o.provider_id === DEMO_CURRENT_PROVIDER_ID,
  );
  if (status) rows = rows.filter((o) => o.status === status);
  if (search) rows = rows.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));

  rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const categoryMap = new Map(DEMO_GLOBAL_CATEGORIES.map((c) => [c.id, c]));
  const total = rows.length;
  const offset = (page - 1) * perPage;
  const data = rows.slice(offset, offset + perPage).map((o) => {
    const cat = o.global_category_id ? categoryMap.get(o.global_category_id) : null;
    return {
      ...o,
      global_categories: cat ? { name: cat.name, icon: cat.icon } : null,
    };
  });

  return success({ data, meta: { page, per_page: perPage, total } });
}

export async function demoProviderOfferingDetail(id: string): Promise<NextResponse> {
  const { DEMO_PROVIDER_OFFERINGS, DEMO_GLOBAL_CATEGORIES } = await loadDemoData();
  const offering = DEMO_PROVIDER_OFFERINGS.find(
    (o) => o.id === id && o.provider_id === DEMO_CURRENT_PROVIDER_ID,
  );
  if (!offering) throw notFound("Предложение не найдено");
  const cat = offering.global_category_id
    ? DEMO_GLOBAL_CATEGORIES.find((c) => c.id === offering.global_category_id)
    : null;
  return success({
    ...offering,
    global_categories: cat ? { name: cat.name, icon: cat.icon } : null,
  });
}

export async function demoProviderOfferingUpdate(
  id: string,
  patch: Record<string, unknown>,
): Promise<NextResponse> {
  const { DEMO_PROVIDER_OFFERINGS } = await loadDemoData();
  const offering = DEMO_PROVIDER_OFFERINGS.find(
    (o) => o.id === id && o.provider_id === DEMO_CURRENT_PROVIDER_ID,
  );
  if (!offering) throw notFound("Предложение не найдено");
  Object.assign(offering, patch, { updated_at: new Date().toISOString() });
  return success(offering);
}

// ---------------------------------------------------------------------------
// HR employees
// ---------------------------------------------------------------------------

export async function demoEmployeesList(): Promise<NextResponse> {
  const {
    DEMO_EMPLOYEES,
    DEMO_WALLETS,
    DEMO_POLICIES,
    DEMO_INDIVIDUAL_ACCRUALS,
  } = await loadDemoData();
  const { evaluateConditions } = await import("@/lib/domain/condition-evaluator");

  const walletByUser = new Map(DEMO_WALLETS.map((w) => [w.user_id, w]));

  const data = DEMO_EMPLOYEES.map((emp) => {
    const w = walletByUser.get(emp.user.id);

    // ---- Initial limit ----
    // = points from individual replacement (if any) OR points from matching active policies
    //   + addition from individual accruals
    const additions = DEMO_INDIVIDUAL_ACCRUALS
      .filter((a) => a.user_id === emp.user.id && a.is_active && a.mode === "addition")
      .reduce((sum, a) => sum + a.points_amount, 0);

    const replacement = DEMO_INDIVIDUAL_ACCRUALS.find(
      (a) => a.user_id === emp.user.id && a.is_active && a.mode === "replacement",
    );

    let policyTotal = 0;
    if (replacement) {
      policyTotal = replacement.points_amount;
    } else {
      for (const p of DEMO_POLICIES) {
        if (!p.is_active) continue;
        if (p.tenant_id !== emp.user.tenant_id) continue;
        const filter = (p.target_filter ?? {}) as {
          rule_groups?: Array<{
            field: string;
            operator: string;
            value: number | string;
            points_amount?: number;
          }>;
        };
        if (Array.isArray(filter.rule_groups) && filter.rule_groups.length > 0) {
          for (const rg of filter.rule_groups) {
            if (evaluateConditions(emp.profile, { match_all: [rg] })) {
              policyTotal += rg.points_amount ?? 0;
            }
          }
        } else if (evaluateConditions(emp.profile, p.target_filter)) {
          policyTotal += p.points_amount;
        }
      }
    }

    const initialLimit = policyTotal + additions;
    const remaining = w?.balance ?? 0;

    return {
      id: emp.user.id,
      email: emp.user.email,
      role: emp.user.role,
      created_at: emp.user.created_at,
      name: emp.full_name,
      profile: {
        grade: emp.profile.grade,
        grade_numeric: emp.profile.grade_numeric,
        tenure_months: emp.profile.tenure_months,
        location: emp.profile.location,
        legal_entity: emp.profile.legal_entity,
        extra: emp.profile.extra,
      },
      wallet: {
        balance: w?.balance ?? 0,
        reserved: w?.reserved ?? 0,
      },
      initial_limit: initialLimit,
      remaining_balance: remaining,
    };
  });
  return NextResponse.json({ data, meta: { page: 1, per_page: 20, total: data.length } });
}
