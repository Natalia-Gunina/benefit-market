import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull, unwrapRows } from "@/lib/supabase/typed-queries";
import { enableTenantOfferingSchema } from "@/lib/api/validators";
import { duplicateTenantOffering, offeringNotPublished, dbError } from "@/lib/errors";
import type { TenantOffering } from "@/lib/types";

type TenantOfferingWithJoins = Record<string, unknown> & {
  provider_offerings: Record<string, unknown> & {
    providers: { id: string; name: string; logo_url: string | null } | null;
    global_categories: { name: string; icon: string } | null;
  } | null;
};

type OfferingCheck = { id: string; status: string };

// GET /api/hr/offerings — enabled offerings for this tenant
export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_TENANT_OFFERINGS, DEMO_PROVIDER_OFFERINGS, DEMO_PROVIDERS } = await import("@/lib/demo-data");
      const offeringMap = new Map((DEMO_PROVIDER_OFFERINGS ?? []).map((o) => [o.id, o]));
      const providerMap = new Map((DEMO_PROVIDERS ?? []).map((p) => [p.id, p]));
      const data = (DEMO_TENANT_OFFERINGS ?? []).map((to) => {
        const po = offeringMap.get(to.provider_offering_id);
        return {
          ...to,
          provider_offering: po ?? null,
          provider: po ? providerMap.get(po.provider_id) ?? null : null,
        };
      });
      return success({ data, meta: { page: 1, per_page: 20, total: data.length } });
    }

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
    const offset = (page - 1) * perPage;

    const result = await admin
      .from("tenant_offerings")
      .select("*, provider_offerings(*, providers(id, name, logo_url), global_categories(name, icon))", { count: "exact" })
      .eq("tenant_id", appUser.tenant_id)
      .order("enabled_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (result.error) throw dbError(result.error.message);

    const data = (result.data ?? []) as TenantOfferingWithJoins[];

    return success({
      data,
      meta: { page, per_page: perPage, total: result.count ?? 0 },
    });
  }, "GET /api/hr/offerings");
}

// POST /api/hr/offerings — enable an offering for this tenant
export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return created({ id: "demo-to-new", is_active: true });
    }

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    const body = await request.json();
    const data = parseBody(enableTenantOfferingSchema, body);

    // Verify offering is published
    const offering = unwrapSingleOrNull<OfferingCheck>(
      await admin
        .from("provider_offerings")
        .select("id, status")
        .eq("id", data.provider_offering_id)
        .single(),
    );

    if (!offering || offering.status !== "published") {
      throw offeringNotPublished();
    }

    // Check for duplicate
    const existing = unwrapRows<{ id: string }>(
      await admin
        .from("tenant_offerings")
        .select("id")
        .eq("tenant_id", appUser.tenant_id)
        .eq("provider_offering_id", data.provider_offering_id)
        .limit(1),
      "Failed to check existing tenant offerings",
    );

    if (existing.length > 0) {
      throw duplicateTenantOffering();
    }

    const tenantOffering = unwrapSingle<TenantOffering>(
      await admin
        .from("tenant_offerings")
        .insert({
          tenant_id: appUser.tenant_id,
          provider_offering_id: data.provider_offering_id,
          custom_price_points: data.custom_price_points,
          tenant_stock_limit: data.tenant_stock_limit,
          tenant_category_id: data.tenant_category_id,
          enabled_by: appUser.id,
          is_active: true,
        } as never)
        .select("*")
        .single(),
      "Failed to enable offering",
    );

    return created(tenantOffering);
  }, "POST /api/hr/offerings");
}
