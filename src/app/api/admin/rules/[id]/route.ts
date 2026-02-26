import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle } from "@/lib/supabase/typed-queries";
import { dbError } from "@/lib/errors";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updateRuleSchema = z.object({
  conditions: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// Helper: reshape benefits -> benefit
// ---------------------------------------------------------------------------

type RuleWithJoin = Record<string, unknown> & {
  benefits: { name: string } | null;
};

function shapeRule(row: RuleWithJoin) {
  const { benefits, ...rest } = row;
  return { ...rest, benefit: benefits };
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/rules/[id] — Update eligibility rule conditions
// ---------------------------------------------------------------------------

export function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id: ruleId } = await params;
    const appUser = await requireRole("admin");

    const body = await request.json();
    const { conditions } = parseBody(updateRuleSchema, body);

    const admin = createAdminClient();

    const result = await admin
      .from("eligibility_rules")
      .update({ conditions } as never)
      .eq("id", ruleId)
      .eq("tenant_id", appUser.tenant_id)
      .select("*, benefits(name)")
      .single();

    const row = unwrapSingle<RuleWithJoin>(result, "Failed to update rule");
    return success(shapeRule(row));
  }, "PATCH /api/admin/rules/[id]");
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/rules/[id] — Hard delete the eligibility rule
// ---------------------------------------------------------------------------

export function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id: ruleId } = await params;
    const appUser = await requireRole("admin");

    const admin = createAdminClient();

    const { error: deleteError } = await admin
      .from("eligibility_rules")
      .delete()
      .eq("id", ruleId)
      .eq("tenant_id", appUser.tenant_id);

    if (deleteError) {
      throw dbError(`Failed to delete rule: ${deleteError.message}`);
    }

    return success({ id: ruleId, deleted: true });
  }, "DELETE /api/admin/rules/[id]");
}
