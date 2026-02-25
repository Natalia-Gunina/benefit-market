import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkEligibility } from "@/lib/eligibility";
import type {
  Benefit,
  BenefitCategory,
  EligibilityRule,
  EmployeeProfile,
  User,
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

export async function GET(request: NextRequest) {
  try {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    if (isDemo) {
      const { DEMO_BENEFITS, DEMO_CATEGORIES } = await import("@/lib/demo-data");
      const { searchParams } = new URL(request.url);
      const categoryId = searchParams.get("category_id");
      const search = searchParams.get("search");
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
      const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));

      let filtered = DEMO_BENEFITS;
      if (categoryId) filtered = filtered.filter(b => b.category_id === categoryId);
      if (search) filtered = filtered.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

      const total = filtered.length;
      const offset = (page - 1) * perPage;
      const paginated = filtered.slice(offset, offset + perPage);

      const categoryMap = new Map(DEMO_CATEGORIES.map(c => [c.id, c]));
      const data = paginated.map(b => ({
        ...b,
        category: categoryMap.get(b.category_id) ? { name: categoryMap.get(b.category_id)!.name, icon: categoryMap.get(b.category_id)!.icon } : null,
      }));

      return NextResponse.json({ data, meta: { page, per_page: perPage, total } });
    }

    const supabase = await createClient();

    // --- Authenticate user ---
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // --- Get the app-level user record (to get tenant_id) ---
    const { data: rawUser, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", authUser.id)
      .single();

    const appUser = rawUser as User | null;

    if (userError || !appUser) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "User record not found" } },
        { status: 404 }
      );
    }

    const tenantId = appUser.tenant_id;

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
    const { data: rawProfile } = await supabase
      .from("employee_profiles")
      .select("*")
      .eq("user_id", appUser.id)
      .eq("tenant_id", tenantId)
      .single();

    const profile = rawProfile as EmployeeProfile | null;

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
      query = query.ilike("name", `%${search}%`);
    }

    // We need all matching benefits first for eligibility filtering, then paginate.
    // Since eligibility filtering happens in-app, we fetch all results first.
    const { data: rawBenefits, error: benefitsError } = await query
      .order("created_at", { ascending: false });

    if (benefitsError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: "Failed to fetch benefits",
          },
        },
        { status: 500 }
      );
    }

    const allBenefits = (rawBenefits ?? []) as unknown as BenefitRow[];

    if (allBenefits.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { page, per_page: perPage, total: 0 },
      } satisfies BenefitsCatalogResponse);
    }

    // --- Get eligibility rules for all benefits in this tenant ---
    const benefitIds = allBenefits.map((b) => b.id);

    const { data: rawRules } = await supabase
      .from("eligibility_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("benefit_id", benefitIds);

    const rules = (rawRules ?? []) as unknown as EligibilityRule[];

    // Group rules by benefit_id
    const rulesByBenefit = new Map<string, EligibilityRule[]>();
    for (const rule of rules) {
      const existing = rulesByBenefit.get(rule.benefit_id) || [];
      existing.push(rule);
      rulesByBenefit.set(rule.benefit_id, existing);
    }

    // --- Filter by eligibility ---
    const eligibleBenefits = allBenefits.filter((benefit) => {
      const benefitRules = rulesByBenefit.get(benefit.id) || [];
      // If no profile, only benefits with no rules are eligible
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
  } catch (err) {
    console.error("[GET /api/benefits] Unexpected error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
