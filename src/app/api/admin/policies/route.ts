import { type NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle } from "@/lib/supabase/typed-queries";
import { dbError } from "@/lib/errors";
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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(1000, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
    const offset = (page - 1) * perPage;

    let query = admin
      .from("budget_policies")
      .select("*", { count: "exact" })
      .order("name", { ascending: true });

    if (appUser.role === "hr") {
      query = query.eq("tenant_id", appUser.tenant_id);
    } else if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const result = await query.range(offset, offset + perPage - 1);
    if (result.error) {
      throw dbError(`Failed to fetch policies: ${result.error.message}`);
    }

    const total = result.count ?? 0;
    return NextResponse.json({
      data: (result.data ?? []) as BudgetPolicy[],
      total,
      meta: { page, per_page: perPage, total },
    });
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

    let accrualSummary: {
      processed: number;
      accrued: number;
      errors: string[];
    } | null = null;
    if (policy.is_active) {
      try {
        const r = await processAccruals(admin, targetTenantId);
        accrualSummary = {
          processed: r.processed,
          accrued: r.accrued,
          errors: r.errors,
        };
        if (r.errors.length > 0) {
          console.error(
            "[policies] processAccruals reported errors",
            r.errors,
          );
        }
      } catch (err) {
        console.error("[policies] processAccruals after create failed", err);
        accrualSummary = {
          processed: 0,
          accrued: 0,
          errors: [err instanceof Error ? err.message : String(err)],
        };
      }
    }

    return created({ ...policy, accrual_summary: accrualSummary });
  }, "POST /api/admin/policies");
}
