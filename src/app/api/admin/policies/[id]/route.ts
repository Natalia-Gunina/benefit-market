import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle } from "@/lib/supabase/typed-queries";
import { validationError } from "@/lib/errors";
import { z } from "zod";
import type { BudgetPolicy } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updatePolicySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  points_amount: z.number().int().min(0).optional(),
  period: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  target_filter: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/policies/[id] — Update a budget policy
// ---------------------------------------------------------------------------

export function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id: policyId } = await params;
    const appUser = await requireRole("admin", "hr");

    const body = await request.json();
    const updates = parseBody(updatePolicySchema, body);

    if (Object.keys(updates).length === 0) {
      throw validationError("At least one field must be provided for update");
    }

    const admin = createAdminClient();

    const result = await admin
      .from("budget_policies")
      .update(updates as never)
      .eq("id", policyId)
      .eq("tenant_id", appUser.tenant_id)
      .select("*")
      .single();

    const policy = unwrapSingle<BudgetPolicy>(result, "Failed to update policy");
    return success(policy);
  }, "PATCH /api/admin/policies/[id]");
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/policies/[id] — Soft delete (set is_active=false)
// ---------------------------------------------------------------------------

export function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id: policyId } = await params;
    const appUser = await requireRole("admin");

    const admin = createAdminClient();

    const result = await admin
      .from("budget_policies")
      .update({ is_active: false } as never)
      .eq("id", policyId)
      .eq("tenant_id", appUser.tenant_id)
      .select("*")
      .single();

    const policy = unwrapSingle<BudgetPolicy>(result, "Failed to deactivate policy");
    return success(policy);
  }, "DELETE /api/admin/policies/[id]");
}
