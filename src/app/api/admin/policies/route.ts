import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows, unwrapSingle } from "@/lib/supabase/typed-queries";
import { createPolicySchema } from "@/lib/api/validators";
import type { BudgetPolicy } from "@/lib/types";

// ---------------------------------------------------------------------------
// GET /api/admin/policies — List all budget policies for tenant
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_POLICIES } = await import("@/lib/demo-data");
      return success(DEMO_POLICIES);
    }

    const appUser = await requireRole("admin", "hr");
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id");

    let query = admin
      .from("budget_policies")
      .select("*")
      .order("name", { ascending: true });

    // Admin sees all companies' policies; HR sees only their own
    if (appUser.role === "hr") {
      query = query.eq("tenant_id", appUser.tenant_id);
    } else if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const policies = unwrapRows<BudgetPolicy>(await query, "Failed to fetch policies");
    return success(policies);
  }, "GET /api/admin/policies");
}

// ---------------------------------------------------------------------------
// POST /api/admin/policies — Create a budget policy
// ---------------------------------------------------------------------------

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const appUser = await requireRole("admin", "hr");

    const body = await request.json();
    const { name, points_amount, period, target_filter, is_active } =
      parseBody(createPolicySchema, body);

    // Admin can specify tenant_id; HR always uses their own
    const targetTenantId =
      appUser.role === "admin" && body.tenant_id
        ? body.tenant_id
        : appUser.tenant_id;

    const admin = createAdminClient();

    const result = await admin
      .from("budget_policies")
      .insert({
        tenant_id: targetTenantId,
        name,
        points_amount,
        period,
        target_filter,
        is_active,
      } as never)
      .select("*")
      .single();

    const policy = unwrapSingle<BudgetPolicy>(result, "Failed to create policy");
    return created(policy);
  }, "POST /api/admin/policies");
}
