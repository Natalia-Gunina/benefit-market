import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle } from "@/lib/supabase/typed-queries";
import { notFound, validationError } from "@/lib/errors";
import { updateIndividualAccrualSchema } from "@/lib/api/validators";
import { processAccruals } from "@/lib/services/accrual.service";
import type { IndividualAccrual } from "@/lib/types";

// ---------------------------------------------------------------------------
// PATCH /api/hr/individual-accruals/[id] — update an individual accrual
// ---------------------------------------------------------------------------

export function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id } = await params;

    const body = await request.json();
    const updates = parseBody(updateIndividualAccrualSchema, body);

    if (Object.keys(updates).length === 0) {
      throw validationError("At least one field must be provided for update");
    }

    if (isDemo) {
      const { DEMO_INDIVIDUAL_ACCRUALS } = await import("@/lib/demo-data");
      const row = DEMO_INDIVIDUAL_ACCRUALS.find((a) => a.id === id);
      if (!row) throw notFound("Individual accrual not found");
      Object.assign(row, updates);
      if (updates.first_accrual_date) {
        row.next_accrual_date = updates.first_accrual_date;
      }
      row.updated_at = new Date().toISOString();
      return success(row);
    }

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    const patch: Record<string, unknown> = { ...updates };
    if (updates.first_accrual_date) {
      patch.next_accrual_date = updates.first_accrual_date;
    }
    patch.updated_at = new Date().toISOString();

    const result = await admin
      .from("individual_accruals")
      .update(patch as never)
      .eq("id", id)
      .eq("tenant_id", appUser.tenant_id)
      .select("*")
      .single();

    const row = unwrapSingle<IndividualAccrual>(result, "Failed to update individual accrual");

    if (row.is_active) {
      try {
        await processAccruals(admin, appUser.tenant_id);
      } catch (err) {
        console.error("[individual-accruals] processAccruals after update failed", err);
      }
    }

    return success(row);
  }, "PATCH /api/hr/individual-accruals/[id]");
}

// ---------------------------------------------------------------------------
// DELETE /api/hr/individual-accruals/[id] — soft delete (is_active=false)
// ---------------------------------------------------------------------------

export function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id } = await params;

    if (isDemo) {
      const { DEMO_INDIVIDUAL_ACCRUALS } = await import("@/lib/demo-data");
      const row = DEMO_INDIVIDUAL_ACCRUALS.find((a) => a.id === id);
      if (!row) throw notFound("Individual accrual not found");
      row.is_active = false;
      row.updated_at = new Date().toISOString();
      return success(row);
    }

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    const result = await admin
      .from("individual_accruals")
      .update({ is_active: false, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .eq("tenant_id", appUser.tenant_id)
      .select("*")
      .single();

    const row = unwrapSingle<IndividualAccrual>(result, "Failed to deactivate individual accrual");
    return success(row);
  }, "DELETE /api/hr/individual-accruals/[id]");
}
