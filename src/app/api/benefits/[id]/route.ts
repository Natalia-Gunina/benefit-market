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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const { DEMO_BENEFITS, DEMO_CATEGORIES } = await import("@/lib/demo-data");
      const benefit = DEMO_BENEFITS.find(b => b.id === id);
      if (!benefit) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Benefit not found" } }, { status: 404 });
      const cat = DEMO_CATEGORIES.find(c => c.id === benefit.category_id);
      return NextResponse.json({ data: { ...benefit, category: cat ? { name: cat.name, icon: cat.icon } : null } });
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

    // --- Get the app-level user record ---
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

    // --- Fetch benefit with category join ---
    const { data: rawBenefit, error: benefitError } = await supabase
      .from("benefits")
      .select("*, benefit_categories(name, icon)")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    const benefit = rawBenefit as unknown as BenefitRow | null;

    if (benefitError || !benefit) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Benefit not found" } },
        { status: 404 }
      );
    }

    // --- Get eligibility rules for this benefit ---
    const { data: rawRules } = await supabase
      .from("eligibility_rules")
      .select("*")
      .eq("benefit_id", id)
      .eq("tenant_id", tenantId);

    const benefitRules = (rawRules ?? []) as unknown as EligibilityRule[];

    // --- Get employee profile for eligibility check ---
    const { data: rawProfile } = await supabase
      .from("employee_profiles")
      .select("*")
      .eq("user_id", appUser.id)
      .eq("tenant_id", tenantId)
      .single();

    const profile = rawProfile as EmployeeProfile | null;

    // --- Compute eligibility ---
    let isEligible: boolean;

    if (!profile) {
      // No profile -> only eligible if there are no rules
      isEligible = benefitRules.length === 0;
    } else {
      isEligible = checkEligibility(profile, benefitRules);
    }

    // --- Shape response ---
    const { benefit_categories, ...benefitFields } = benefit;

    const data: BenefitDetail = {
      ...benefitFields,
      category: benefit_categories,
      isEligible,
    };

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/benefits/[id]] Unexpected error:", err);
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
