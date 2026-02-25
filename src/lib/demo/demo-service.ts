/**
 * Centralized demo data access. Encapsulates complex demo responses
 * that involve filtering, pagination, and joins across entities.
 *
 * For simple cases (e.g. `success(DEMO_CATEGORIES)`), routes can
 * still import directly from `@/lib/demo-data`.
 */

import { success, created } from "@/lib/api/response";
import { notFound } from "@/lib/errors";
import type { NextResponse } from "next/server";
import type { OrderItem } from "@/lib/types";

// Lazy-load demo data to avoid bundling in production
async function loadDemoData() {
  return import("@/lib/demo-data");
}

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

  return success({ data, meta: { page, per_page: perPage, total } });
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
}): Promise<NextResponse> {
  const { DEMO_ORDERS, DEMO_ORDER_ITEMS, DEMO_BENEFITS } = await loadDemoData();
  const { status, page = 1, perPage = 20 } = params;
  const offset = (page - 1) * perPage;

  const benefitMap = new Map(DEMO_BENEFITS.map((b) => [b.id, b]));
  let filtered = DEMO_ORDERS;
  if (status) filtered = filtered.filter((o) => o.status === status);

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + perPage);

  const data = paginated.map((order) => ({
    ...order,
    order_items: DEMO_ORDER_ITEMS.filter((oi) => oi.order_id === order.id).map((oi) => {
      const b = benefitMap.get(oi.benefit_id);
      return {
        ...oi,
        benefit: b
          ? { id: b.id, name: b.name, price_points: b.price_points, description: b.description }
          : undefined,
      };
    }),
  }));

  return success({ data, meta: { page, per_page: perPage, total } });
}

export async function demoCreateOrder(items: Array<{ benefit_id: string; quantity: number }>): Promise<NextResponse> {
  const { DEMO_BENEFITS } = await loadDemoData();
  const benefitMap = new Map(DEMO_BENEFITS.map((b) => [b.id, b]));
  const totalPoints = items.reduce((sum, item) => {
    const benefit = benefitMap.get(item.benefit_id);
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
      const b = benefitMap.get(item.benefit_id);
      return {
        id: `demo-oi-${Date.now()}-${idx}`,
        order_id: orderId,
        benefit_id: item.benefit_id,
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
// HR employees
// ---------------------------------------------------------------------------

export async function demoEmployeesList(): Promise<NextResponse> {
  const { DEMO_EMPLOYEES } = await loadDemoData();
  const data = DEMO_EMPLOYEES.map((emp) => ({
    id: emp.user.id,
    email: emp.user.email,
    role: emp.user.role,
    full_name: emp.full_name,
    department: emp.department,
    grade: emp.profile.grade,
    tenure_months: emp.profile.tenure_months,
    location: emp.profile.location,
    legal_entity: emp.profile.legal_entity,
    is_active: true,
  }));
  return success(data);
}
