import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api/auth";
import { NextResponse } from "next/server";
import { success, withErrorHandling } from "@/lib/api/response";
import { escapeIlike } from "@/lib/api/sanitize";
import { isDemo } from "@/lib/env";
import { unwrapRows, unwrapRowsSoft } from "@/lib/supabase/typed-queries";
import { checkEligibility } from "@/lib/eligibility";
import { dbError } from "@/lib/errors";
import { demoBenefitsList } from "@/lib/demo/demo-service";
import type {
  Benefit,
  BenefitCategory,
  EligibilityRule,
  EmployeeProfile,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenefitWithCategory extends Benefit {
  category: Pick<BenefitCategory, "name" | "icon"> | null;
}

interface BenefitsCatalogResponse {
  data: BenefitWithCategory[];
  meta: {
    page: number;
    per_page: number;
    total: number;
  };
}

type BenefitRow = Benefit & {
  benefit_categories: Pick<BenefitCategory, "name" | "icon"> | null;
};

// ---------------------------------------------------------------------------
// GET /api/benefits — Benefit catalog with eligibility filtering
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { searchParams } = new URL(request.url);
      return demoBenefitsList({
        categoryId: searchParams.get("category_id"),
        search: searchParams.get("search"),
        page: Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
        perPage: Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10))),
      });
    }

    const appUser = await requireAuth();
    const tenantId = appUser.tenant_id;
    const supabase = await createClient();

    // --- Parse query parameters ---
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("per_page") || "20", 10))
    );
    const offset = (page - 1) * perPage;

    // --- Get employee profile for eligibility checking ---
    const profileResult = await supabase
      .from("employee_profiles")
      .select("*")
      .eq("user_id", appUser.id)
      .eq("tenant_id", tenantId)
      .single();

    const profile = profileResult.data as EmployeeProfile | null;

    // --- Build benefits query ---
    let query = supabase
      .from("benefits")
      .select("*, benefit_categories(name, icon)", { count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    if (search) {
      query = query.ilike("name", `%${escapeIlike(search)}%`);
    }

    // We need all matching benefits first for eligibility filtering, then paginate.
    const benefitsResult = await query.order("created_at", { ascending: false });

    const allBenefits = unwrapRows<BenefitRow>(benefitsResult, "Failed to fetch benefits");

    if (allBenefits.length === 0) {
      return success({
        data: [],
        meta: { page, per_page: perPage, total: 0 },
      } satisfies BenefitsCatalogResponse);
    }

    // --- Get eligibility rules for all benefits in this tenant ---
    const benefitIds = allBenefits.map((b) => b.id);

    const rules = unwrapRowsSoft<EligibilityRule>(
      await supabase
        .from("eligibility_rules")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("benefit_id", benefitIds)
    );

    // Group rules by benefit_id
    const rulesByBenefit = new Map<string, EligibilityRule[]>();
    for (const rule of rules) {
      if (!rule.benefit_id) continue;
      const existing = rulesByBenefit.get(rule.benefit_id) || [];
      existing.push(rule);
      rulesByBenefit.set(rule.benefit_id, existing);
    }

    // --- Filter by eligibility ---
    const eligibleBenefits = allBenefits.filter((benefit) => {
      const benefitRules = rulesByBenefit.get(benefit.id) || [];
      if (!profile) return benefitRules.length === 0;
      return checkEligibility(profile, benefitRules);
    });

    // --- Apply pagination ---
    const total = eligibleBenefits.length;
    const paginated = eligibleBenefits.slice(offset, offset + perPage);

    // --- Shape response ---
    const data: BenefitWithCategory[] = paginated.map((b) => {
      const { benefit_categories, ...benefitFields } = b;
      return {
        ...benefitFields,
        category: benefit_categories,
      };
    });

    return NextResponse.json({
      data,
      meta: { page, per_page: perPage, total },
    } satisfies BenefitsCatalogResponse);
  }, "GET /api/benefits");
}
