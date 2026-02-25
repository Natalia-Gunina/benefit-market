import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { unwrapRowsSoft, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { notFound } from "@/lib/errors";
import { checkEligibility } from "@/lib/eligibility";
import { demoBenefitDetail } from "@/lib/demo/demo-service";
import type {
  Benefit,
  BenefitCategory,
  EligibilityRule,
  EmployeeProfile,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenefitDetail extends Benefit {
  category: Pick<BenefitCategory, "name" | "icon"> | null;
  isEligible: boolean;
}

type BenefitRow = Benefit & {
  benefit_categories: Pick<BenefitCategory, "name" | "icon"> | null;
};

// ---------------------------------------------------------------------------
// GET /api/benefits/[id] — Single benefit with eligibility check
// ---------------------------------------------------------------------------

export function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandling(async () => {
    const { id } = await params;

    if (isDemo) return demoBenefitDetail(id);

    const appUser = await requireAuth();
    const tenantId = appUser.tenant_id;
    const supabase = await createClient();

    // --- Fetch benefit with category join ---
    const benefit = unwrapSingleOrNull<BenefitRow>(
      await supabase
        .from("benefits")
        .select("*, benefit_categories(name, icon)")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .single(),
    );

    if (!benefit) {
      throw notFound("Benefit not found");
    }

    // --- Get eligibility rules for this benefit ---
    const benefitRules = unwrapRowsSoft<EligibilityRule>(
      await supabase
        .from("eligibility_rules")
        .select("*")
        .eq("benefit_id", id)
        .eq("tenant_id", tenantId)
    );

    // --- Get employee profile for eligibility check ---
    const profileResult = await supabase
      .from("employee_profiles")
      .select("*")
      .eq("user_id", appUser.id)
      .eq("tenant_id", tenantId)
      .single();

    const profile = profileResult.data as EmployeeProfile | null;

    // --- Compute eligibility ---
    const isEligible = !profile
      ? benefitRules.length === 0
      : checkEligibility(profile, benefitRules);

    // --- Shape response ---
    const { benefit_categories, ...benefitFields } = benefit;

    const data: BenefitDetail = {
      ...benefitFields,
      category: benefit_categories,
      isEligible,
    };

    return success(data);
  }, "GET /api/benefits/[id]");
}
