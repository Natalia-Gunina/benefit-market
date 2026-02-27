import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/supabase/typed-queries";
import { dbError } from "@/lib/errors";

type MarketplaceOffering = Record<string, unknown> & {
  id: string;
  providers: { id: string; name: string; logo_url: string | null; status: string } | null;
  global_categories: { name: string; icon: string } | null;
};

type EnabledRow = { provider_offering_id: string };

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_PROVIDER_OFFERINGS, DEMO_PROVIDERS, DEMO_GLOBAL_CATEGORIES } = await import("@/lib/demo-data");
      const published = (DEMO_PROVIDER_OFFERINGS ?? []).filter((o) => o.status === "published");
      const providerMap = new Map((DEMO_PROVIDERS ?? []).map((p) => [p.id, p]));
      const catMap = new Map((DEMO_GLOBAL_CATEGORIES ?? []).map((c) => [c.id, c]));
      const data = published.map((o) => ({
        ...o,
        providers: providerMap.get(o.provider_id) ?? null,
        global_categories: catMap.get(o.global_category_id ?? "") ?? null,
        is_enabled: false,
      }));
      return success({ data, meta: { page: 1, per_page: 20, total: data.length } });
    }

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
    const offset = (page - 1) * perPage;

    let query = admin
      .from("provider_offerings")
      .select("*, providers!inner(id, name, logo_url, status), global_categories(name, icon)", { count: "exact" })
      .eq("status", "published")
      .eq("providers.status", "verified");

    if (categoryId) query = query.eq("global_category_id", categoryId);
    if (search) query = query.ilike("name", `%${search}%`);

    switch (sort) {
      case "rating": query = query.order("avg_rating", { ascending: false }); break;
      case "price_asc": query = query.order("base_price_points", { ascending: true }); break;
      case "price_desc": query = query.order("base_price_points", { ascending: false }); break;
      default: query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + perPage - 1);
    const result = await query;
    if (result.error) throw dbError(result.error.message);

    const offerings = (result.data ?? []) as MarketplaceOffering[];

    // Check which are already enabled for this tenant
    const offeringIds = offerings.map((o) => o.id);
    const enabled = unwrapRows<EnabledRow>(
      await admin
        .from("tenant_offerings")
        .select("provider_offering_id")
        .eq("tenant_id", appUser.tenant_id)
        .in("provider_offering_id", offeringIds.length > 0 ? offeringIds : ["__none__"]),
      "Failed to fetch tenant offerings",
    );

    const enabledSet = new Set(enabled.map((e) => e.provider_offering_id));

    const data = offerings.map((o) => ({
      ...o,
      is_enabled: enabledSet.has(o.id),
    }));

    return success({
      data,
      meta: { page, per_page: perPage, total: result.count ?? 0 },
    });
  }, "GET /api/hr/marketplace");
}
