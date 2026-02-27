import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbError } from "@/lib/errors";

type TenantOfferingWithJoins = Record<string, unknown> & {
  provider_offerings: Record<string, unknown> & {
    name: string;
    providers: { id: string; name: string; logo_url: string | null } | null;
    global_categories: { name: string; icon: string } | null;
  } | null;
};

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_TENANT_OFFERINGS, DEMO_PROVIDER_OFFERINGS, DEMO_PROVIDERS, DEMO_GLOBAL_CATEGORIES } = await import("@/lib/demo-data");
      const offeringMap = new Map((DEMO_PROVIDER_OFFERINGS ?? []).map((o) => [o.id, o]));
      const providerMap = new Map((DEMO_PROVIDERS ?? []).map((p) => [p.id, p]));
      const catMap = new Map((DEMO_GLOBAL_CATEGORIES ?? []).map((c) => [c.id, c]));
      const data = (DEMO_TENANT_OFFERINGS ?? [])
        .filter((to) => to.is_active)
        .map((to) => {
          const po = offeringMap.get(to.provider_offering_id);
          return {
            ...to,
            provider_offerings: po ? {
              ...po,
              providers: providerMap.get(po.provider_id) ?? null,
              global_categories: catMap.get(po.global_category_id ?? "") ?? null,
            } : null,
            effective_price: to.custom_price_points ?? (po?.base_price_points ?? 0),
          };
        });
      return success({ data, meta: { page: 1, per_page: 20, total: data.length } });
    }

    const appUser = await requireAuth();
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
    const offset = (page - 1) * perPage;

    let query = admin
      .from("tenant_offerings")
      .select("*, provider_offerings(*, providers(id, name, logo_url), global_categories(name, icon))", { count: "exact" })
      .eq("tenant_id", appUser.tenant_id)
      .eq("is_active", true);

    if (categoryId) {
      query = query.eq("provider_offerings.global_category_id", categoryId);
    }

    query = query
      .order("enabled_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    const result = await query;
    if (result.error) throw dbError(result.error.message);

    // Apply search filter (post-fetch since it's on a joined field)
    let results = (result.data ?? []) as TenantOfferingWithJoins[];
    if (search) {
      const q = search.toLowerCase();
      results = results.filter((r) => {
        const po = r.provider_offerings;
        return po && po.name.toLowerCase().includes(q);
      });
    }

    const total = search ? results.length : (result.count ?? 0);

    return success({
      data: results,
      meta: { page, per_page: perPage, total },
    });
  }, "GET /api/offerings");
}
