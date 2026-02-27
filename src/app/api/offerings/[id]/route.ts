import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle } from "@/lib/supabase/typed-queries";
import { notFound } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

type TenantOfferingDetail = Record<string, unknown> & {
  custom_price_points: number | null;
  tenant_avg_rating: number | null;
  tenant_review_count: number | null;
  provider_offerings: Record<string, unknown> & {
    base_price_points: number | null;
    avg_rating: number | null;
    review_count: number | null;
    providers: { id: string; name: string; logo_url: string | null; description: string | null } | null;
    global_categories: { name: string; icon: string } | null;
  } | null;
};

export function GET(_request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) {
      const { DEMO_TENANT_OFFERINGS, DEMO_PROVIDER_OFFERINGS, DEMO_PROVIDERS, DEMO_GLOBAL_CATEGORIES } = await import("@/lib/demo-data");
      const to = (DEMO_TENANT_OFFERINGS ?? []).find((t) => t.id === id);
      if (!to) return success({ id, name: "Demo Offering" });

      const offeringMap = new Map((DEMO_PROVIDER_OFFERINGS ?? []).map((o) => [o.id, o]));
      const providerMap = new Map((DEMO_PROVIDERS ?? []).map((p) => [p.id, p]));
      const catMap = new Map((DEMO_GLOBAL_CATEGORIES ?? []).map((c) => [c.id, c]));
      const po = offeringMap.get(to.provider_offering_id);
      const provider = po ? providerMap.get(po.provider_id) ?? null : null;
      const category = po ? catMap.get(po.global_category_id ?? "") ?? null : null;

      return success({
        ...to,
        effective_price: to.custom_price_points ?? (po?.base_price_points ?? 0),
        provider_offerings: po ? {
          ...po,
          providers: provider ? { id: provider.id, name: provider.name, logo_url: provider.logo_url, description: provider.description } : null,
          global_categories: category ? { name: category.name, icon: category.icon } : null,
        } : null,
        ratings: {
          global: { avg: po?.avg_rating ?? 0, count: po?.review_count ?? 0 },
          company: { avg: to.tenant_avg_rating ?? 0, count: to.tenant_review_count ?? 0 },
        },
      });
    }

    const appUser = await requireAuth();
    const admin = createAdminClient();

    const tenantOffering = unwrapSingle<TenantOfferingDetail>(
      await admin
        .from("tenant_offerings")
        .select("*, provider_offerings(*, providers(id, name, logo_url, description), global_categories(name, icon))")
        .eq("id", id)
        .eq("tenant_id", appUser.tenant_id)
        .eq("is_active", true)
        .single(),
      "Предложение не найдено",
    );

    const po = tenantOffering.provider_offerings;
    const effectivePrice = tenantOffering.custom_price_points ?? (po?.base_price_points ?? 0);

    return success({
      ...tenantOffering,
      effective_price: effectivePrice,
      ratings: {
        global: {
          avg: po?.avg_rating ?? 0,
          count: po?.review_count ?? 0,
        },
        company: {
          avg: tenantOffering.tenant_avg_rating,
          count: tenantOffering.tenant_review_count,
        },
      },
    });
  }, "GET /api/offerings/[id]");
}
