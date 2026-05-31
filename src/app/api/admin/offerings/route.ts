import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbError } from "@/lib/errors";

type OfferingWithJoins = Record<string, unknown> & {
  providers: { id: string; name: string; status: string } | null;
  global_categories: { name: string; icon: string } | null;
};

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const providerId = searchParams.get("provider_id");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(1000, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
    const offset = (page - 1) * perPage;

    if (isDemo) {
      const { DEMO_PROVIDER_OFFERINGS, DEMO_PROVIDERS, DEMO_GLOBAL_CATEGORIES } =
        await import("@/lib/demo-data");
      const providerMap = new Map(DEMO_PROVIDERS.map((p) => [p.id, p]));
      const catMap = new Map(DEMO_GLOBAL_CATEGORIES.map((c) => [c.id, c]));
      let rows = [...DEMO_PROVIDER_OFFERINGS];
      if (status) rows = rows.filter((o) => o.status === status);
      if (providerId) rows = rows.filter((o) => o.provider_id === providerId);
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const total = rows.length;
      const paginated = rows.slice(offset, offset + perPage).map((o) => {
        const p = providerMap.get(o.provider_id);
        const c = o.global_category_id ? catMap.get(o.global_category_id) : null;
        return {
          ...o,
          providers: p ? { id: p.id, name: p.name, status: p.status } : null,
          global_categories: c ? { name: c.name, icon: c.icon } : null,
        };
      });
      return success({ data: paginated, meta: { page, per_page: perPage, total } });
    }

    await requireRole("admin");
    const admin = createAdminClient();

    let query = admin
      .from("provider_offerings")
      .select("*, providers(id, name, status), global_categories(name, icon)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (providerId) query = query.eq("provider_id", providerId);
    query = query.range(offset, offset + perPage - 1);

    const result = await query;
    if (result.error) throw dbError(result.error.message);

    const data = (result.data ?? []) as OfferingWithJoins[];

    return success({
      data,
      meta: { page, per_page: perPage, total: result.count ?? 0 },
    });
  }, "GET /api/admin/offerings");
}
