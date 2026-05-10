import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows, unwrapSingle } from "@/lib/supabase/typed-queries";
import { createPolicySchema } from "@/lib/api/validators";
import { processAccruals } from "@/lib/services/accrual.service";
import type { BudgetPolicy } from "@/lib/types";

// ---------------------------------------------------------------------------
// GET /api/admin/policies — list active + inactive budget policies
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
// POST /api/admin/policies — create a budget policy
// ---------------------------------------------------------------------------

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const body = await request.json();
    const {
      name,
      points_amount,
      period,
      first_accrual_date,
      target_filter,
      is_active,
    } = parseBody(createPolicySchema, body);

    if (isDemo) {
      const { DEMO_POLICIES } = await import("@/lib/demo-data");
      const nowIso = new Date().toISOString();
      const policy: BudgetPolicy = {
        id: `demo-policy-${Date.now()}`,
        tenant_id: "demo-tenant-001",
        name,
        points_amount,
        period,
        target_filter,
        is_active,
        first_accrual_date,
        next_accrual_date: first_accrual_date,
        last_accrual_date: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      DEMO_POLICIES.push(policy);
      return created(policy);
    }

    const appUser = await requireRole("admin", "hr");
    const targetTenantId =
      appUser.role === "admin" && body.tenant_id ? body.tenant_id : appUser.tenant_id;

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
        first_accrual_date,
        next_accrual_date: first_accrual_date,
      } as never)
      .select("*")
      .single();

    const policy = unwrapSingle<BudgetPolicy>(result, "Failed to create policy");

    if (policy.is_active) {
      try {
        await processAccruals(admin, targetTenantId);
      } catch (err) {
        console.error("[policies] processAccruals after create failed", err);
      }
    }

    return created(policy);
  }, "POST /api/admin/policies");
}
