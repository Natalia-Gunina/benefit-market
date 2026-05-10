import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle } from "@/lib/supabase/typed-queries";
import { notFound, validationError } from "@/lib/errors";
import { updatePolicySchema } from "@/lib/api/validators";
import { processAccruals } from "@/lib/services/accrual.service";
import type { BudgetPolicy } from "@/lib/types";

// ---------------------------------------------------------------------------
// PATCH /api/admin/policies/[id] — update a budget policy
// ---------------------------------------------------------------------------

export function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id: policyId } = await params;

    const body = await request.json();
    const updates = parseBody(updatePolicySchema, body);

    if (Object.keys(updates).length === 0) {
      throw validationError("At least one field must be provided for update");
    }

    if (isDemo) {
      const { DEMO_POLICIES } = await import("@/lib/demo-data");
      const policy = DEMO_POLICIES.find((p) => p.id === policyId);
      if (!policy) throw notFound("Policy not found");
      Object.assign(policy, updates);
      if (updates.first_accrual_date) {
        policy.next_accrual_date = updates.first_accrual_date;
      }
      policy.updated_at = new Date().toISOString();
      return success(policy);
    }

    const appUser = await requireRole("admin", "hr");
    const admin = createAdminClient();

    const patch: Record<string, unknown> = { ...updates };
    if (updates.first_accrual_date) {
      patch.next_accrual_date = updates.first_accrual_date;
    }
    patch.updated_at = new Date().toISOString();

    let query = admin
      .from("budget_policies")
      .update(patch as never)
      .eq("id", policyId);

    if (appUser.role !== "admin") {
      query = query.eq("tenant_id", appUser.tenant_id);
    }

    const result = await query.select("*").single();
    const policy = unwrapSingle<BudgetPolicy>(result, "Failed to update policy");

    if (policy.is_active) {
      try {
        await processAccruals(admin, policy.tenant_id);
      } catch (err) {
        console.error("[policies] processAccruals after update failed", err);
      }
    }

    return success(policy);
  }, "PATCH /api/admin/policies/[id]");
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/policies/[id] — soft delete (is_active=false)
// ---------------------------------------------------------------------------

export function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id: policyId } = await params;

    if (isDemo) {
      const { DEMO_POLICIES } = await import("@/lib/demo-data");
      const policy = DEMO_POLICIES.find((p) => p.id === policyId);
      if (!policy) throw notFound("Policy not found");
      policy.is_active = false;
      policy.updated_at = new Date().toISOString();
      return success(policy);
    }

    const appUser = await requireRole("admin", "hr");
    const admin = createAdminClient();

    let query = admin
      .from("budget_policies")
      .update({ is_active: false, updated_at: new Date().toISOString() } as never)
      .eq("id", policyId);

    if (appUser.role !== "admin") {
      query = query.eq("tenant_id", appUser.tenant_id);
    }

    const result = await query.select("*").single();
    const policy = unwrapSingle<BudgetPolicy>(result, "Failed to deactivate policy");
    return success(policy);
  }, "DELETE /api/admin/policies/[id]");
}
