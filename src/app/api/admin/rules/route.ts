import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows, unwrapSingle } from "@/lib/supabase/typed-queries";
import { createRuleSchema } from "@/lib/api/validators";

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
// GET /api/admin/rules — List eligibility rules, optionally filtered by benefit_id
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_RULES } = await import("@/lib/demo-data");
      return success(DEMO_RULES);
    }

    const appUser = await requireRole("admin");
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const benefitId = searchParams.get("benefit_id");

    let query = admin
      .from("eligibility_rules")
      .select("*, benefits(name)")
      .eq("tenant_id", appUser.tenant_id);

    if (benefitId) {
      query = query.eq("benefit_id", benefitId);
    }

    const rawRules = unwrapRows<RuleWithJoin>(
      await query.order("benefit_id", { ascending: true }),
      "Failed to fetch eligibility rules",
    );

    const data = rawRules.map(shapeRule);
    return success(data);
  }, "GET /api/admin/rules");
}

// ---------------------------------------------------------------------------
// POST /api/admin/rules — Create an eligibility rule
// ---------------------------------------------------------------------------

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const appUser = await requireRole("admin");

    const body = await request.json();
    const { benefit_id, conditions } = parseBody(createRuleSchema, body);

    const admin = createAdminClient();

    const result = await admin
      .from("eligibility_rules")
      .insert({
        tenant_id: appUser.tenant_id,
        benefit_id,
        conditions,
      } as never)
      .select("*, benefits(name)")
      .single();

    const row = unwrapSingle<RuleWithJoin>(result, "Failed to create rule");
    return created(shapeRule(row));
  }, "POST /api/admin/rules");
}
