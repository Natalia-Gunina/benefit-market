import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoAdminBenefitsList } from "@/lib/demo/demo-service";
import { unwrapRows, unwrapSingle } from "@/lib/supabase/typed-queries";
import { createBenefitSchema } from "@/lib/api/validators";

// ---------------------------------------------------------------------------
// Helper: reshape benefit_categories -> category
// ---------------------------------------------------------------------------

type BenefitWithJoin = Record<string, unknown> & {
  benefit_categories: { name: string; icon: string } | null;
};

function shapeBenefit(row: BenefitWithJoin) {
  const { benefit_categories, ...rest } = row;
  return { ...rest, category: benefit_categories };
}

// ---------------------------------------------------------------------------
// GET /api/admin/benefits — List all benefits (including inactive)
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) return demoAdminBenefitsList();

    const appUser = await requireRole("admin");
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const tenantFilter = searchParams.get("tenant_id");

    let query = admin
      .from("benefits")
      .select("*, benefit_categories(name, icon)")
      .order("created_at", { ascending: false });

    if (tenantFilter) {
      query = query.eq("tenant_id", tenantFilter);
    } else {
      query = query.eq("tenant_id", appUser.tenant_id);
    }

    const rawBenefits = unwrapRows<BenefitWithJoin>(await query, "Failed to fetch benefits");
    const data = rawBenefits.map(shapeBenefit);
    return success(data);
  }, "GET /api/admin/benefits");
}

// ---------------------------------------------------------------------------
// POST /api/admin/benefits — Create a new benefit
// ---------------------------------------------------------------------------

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return created({
        id: "demo-ben-new",
        name: "New Benefit",
        created_at: new Date().toISOString(),
      });
    }

    await requireRole("admin");

    const body = await request.json();
    const {
      name,
      description,
      category_id,
      price_points,
      stock_limit,
      is_active,
      tenant_id,
    } = parseBody(createBenefitSchema, body);

    const admin = createAdminClient();

    const result = await admin
      .from("benefits")
      .insert({
        name,
        description,
        category_id,
        price_points,
        stock_limit,
        is_active,
        tenant_id,
      } as never)
      .select("*, benefit_categories(name, icon)")
      .single();

    const row = unwrapSingle<BenefitWithJoin>(result, "Failed to create benefit");
    return created(shapeBenefit(row));
  }, "POST /api/admin/benefits");
}
