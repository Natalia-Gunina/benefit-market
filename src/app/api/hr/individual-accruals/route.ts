import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows, unwrapSingle } from "@/lib/supabase/typed-queries";
import { createIndividualAccrualSchema } from "@/lib/api/validators";
import { processAccruals } from "@/lib/services/accrual.service";
import type { IndividualAccrual } from "@/lib/types";

// ---------------------------------------------------------------------------
// GET /api/hr/individual-accruals — list all individual accruals for tenant
// ---------------------------------------------------------------------------

export function GET(_request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_INDIVIDUAL_ACCRUALS } = await import("@/lib/demo-data");
      return success(DEMO_INDIVIDUAL_ACCRUALS);
    }

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    const rows = unwrapRows<IndividualAccrual>(
      await admin
        .from("individual_accruals")
        .select("*")
        .eq("tenant_id", appUser.tenant_id)
        .order("created_at", { ascending: false }),
      "Failed to fetch individual accruals",
    );

    return success(rows);
  }, "GET /api/hr/individual-accruals");
}

// ---------------------------------------------------------------------------
// POST /api/hr/individual-accruals — create individual accrual for one user
// ---------------------------------------------------------------------------

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const body = await request.json();
    const input = parseBody(createIndividualAccrualSchema, body);

    if (isDemo) {
      const { DEMO_INDIVIDUAL_ACCRUALS } = await import("@/lib/demo-data");
      const nowIso = new Date().toISOString();
      const row: IndividualAccrual = {
        id: `demo-ind-acc-${Date.now()}`,
        tenant_id: "demo-tenant-001",
        user_id: input.user_id,
        mode: input.mode,
        points_amount: input.points_amount,
        period: input.period,
        first_accrual_date: input.first_accrual_date,
        next_accrual_date: input.first_accrual_date,
        last_accrual_date: null,
        description: input.description,
        is_active: input.is_active,
        created_by: "demo-user-002",
        created_at: nowIso,
        updated_at: nowIso,
      };
      DEMO_INDIVIDUAL_ACCRUALS.push(row);
      return created(row);
    }

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    const result = await admin
      .from("individual_accruals")
      .insert({
        tenant_id: appUser.tenant_id,
        user_id: input.user_id,
        mode: input.mode,
        points_amount: input.points_amount,
        period: input.period,
        first_accrual_date: input.first_accrual_date,
        next_accrual_date: input.first_accrual_date,
        description: input.description,
        is_active: input.is_active,
        created_by: appUser.id,
      } as never)
      .select("*")
      .single();

    const row = unwrapSingle<IndividualAccrual>(result, "Failed to create individual accrual");

    if (row.is_active) {
      try {
        await processAccruals(admin, appUser.tenant_id);
      } catch (err) {
        console.error("[individual-accruals] processAccruals after create failed", err);
      }
    }

    return created(row);
  }, "POST /api/hr/individual-accruals");
}
