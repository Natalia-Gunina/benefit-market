import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/supabase/typed-queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OfferingFormat = "online" | "offline";

type OfferingRow = Record<string, unknown> & {
  id: string;
  name: string;
  description: string;
  base_price_points: number;
  status: string;
  created_at: string;
  provider_id?: string | null;
  providers: { name: string; status: string } | null;
  global_categories: { name: string } | null;
};

type CatalogItem = {
  id: string;
  name: string;
  description: string;
  price_points: number;
  category_name: string;
  is_active: boolean;
  is_stackable: boolean;
  format: OfferingFormat;
  cities: string[];
  provider_id?: string;
  provider_name?: string;
  provider_status?: string;
  offering_status?: string;
  created_at: string;
};

type SortKey =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc";

const SORTS: ReadonlySet<SortKey> = new Set([
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "name_asc",
  "name_desc",
]);

function applySort(items: CatalogItem[], sort: SortKey): CatalogItem[] {
  const cmp = new Intl.Collator("ru", { sensitivity: "base" }).compare;
  const copy = [...items];
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case "price_asc":
      return copy.sort((a, b) => a.price_points - b.price_points);
    case "price_desc":
      return copy.sort((a, b) => b.price_points - a.price_points);
    case "name_asc":
      return copy.sort((a, b) => cmp(a.name, b.name));
    case "name_desc":
      return copy.sort((a, b) => cmp(b.name, a.name));
    case "newest":
    default:
      return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/catalog — catalog listing (provider offerings only)
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const statusFilter = searchParams.get("status") || "";
    const formatFilter = searchParams.get("format") || "";
    const providerFilter = searchParams.get("provider_id") || "";
    const sortParam = (searchParams.get("sort") || "newest") as SortKey;
    const sort: SortKey = SORTS.has(sortParam) ? sortParam : "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));

    if (isDemo) {
      const { DEMO_PROVIDER_OFFERINGS, DEMO_PROVIDERS, DEMO_GLOBAL_CATEGORIES } = await import("@/lib/demo-data");
      const providerMap = new Map((DEMO_PROVIDERS ?? []).map((p) => [p.id, p]));
      const catMap = new Map((DEMO_GLOBAL_CATEGORIES ?? []).map((c) => [c.id, c]));

      let demoItems: CatalogItem[] = (DEMO_PROVIDER_OFFERINGS ?? []).map((o) => {
        const rec = o as Record<string, unknown>;
        const fmt = rec.format === "offline" ? "offline" : "online";
        const cts = Array.isArray(rec.cities) ? (rec.cities as string[]) : [];
        return {
          id: o.id,
          name: o.name,
          description: o.description ?? "",
          price_points: o.base_price_points,
          category_name: catMap.get(o.global_category_id ?? "")?.name ?? "—",
          is_active: o.status === "published",
          is_stackable: o.is_stackable ?? false,
          format: fmt as OfferingFormat,
          cities: cts,
          provider_id: o.provider_id,
          provider_name: providerMap.get(o.provider_id)?.name ?? "—",
          provider_status: providerMap.get(o.provider_id)?.status,
          offering_status: o.status,
          created_at: o.created_at,
        };
      });

      if (search) {
        const q = search.toLowerCase();
        demoItems = demoItems.filter((i) => i.name.toLowerCase().includes(q));
      }
      if (statusFilter) {
        demoItems = demoItems.filter((i) => i.offering_status === statusFilter);
      }
      if (formatFilter) {
        demoItems = demoItems.filter((i) => i.format === formatFilter);
      }
      if (providerFilter) {
        demoItems = demoItems.filter((i) => i.provider_id === providerFilter);
      }

      demoItems = applySort(demoItems, sort);
      const total = demoItems.length;
      const offset = (page - 1) * perPage;
      const paginated = demoItems.slice(offset, offset + perPage);
      return success({ data: paginated, meta: { page, per_page: perPage, total } });
    }

    const appUser = await requireRole("admin");
    const admin = createAdminClient();

    void appUser; // tenant scoping can be added later

    let oQuery = admin
      .from("provider_offerings")
      .select("id, name, description, base_price_points, is_stackable, format, cities, status, created_at, provider_id, providers(name, status), global_categories(name)");

    if (search) oQuery = oQuery.ilike("name", `%${search}%`);
    if (statusFilter) oQuery = oQuery.eq("status", statusFilter);
    if (formatFilter) oQuery = oQuery.eq("format", formatFilter);
    if (providerFilter) oQuery = oQuery.eq("provider_id", providerFilter);

    const offeringRows = unwrapRows<OfferingRow>(
      await oQuery,
      "Failed to fetch offerings",
    );

    let items: CatalogItem[] = offeringRows.map((o) => {
      const rec = o as Record<string, unknown>;
      const fmt = rec.format === "offline" ? "offline" : "online";
      const cts = Array.isArray(rec.cities) ? (rec.cities as string[]) : [];
      return {
        id: o.id,
        name: o.name,
        description: o.description ?? "",
        price_points: o.base_price_points,
        category_name: o.global_categories?.name ?? "—",
        is_active: o.status === "published",
        is_stackable: !!rec.is_stackable,
        format: fmt as OfferingFormat,
        cities: cts,
        provider_id: o.provider_id ?? undefined,
        provider_name: o.providers?.name ?? "—",
        provider_status: o.providers?.status,
        offering_status: o.status,
        created_at: o.created_at,
      };
    });

    items = applySort(items, sort);

    const total = items.length;
    const offset = (page - 1) * perPage;
    const paginated = items.slice(offset, offset + perPage);

    return success({ data: paginated, meta: { page, per_page: perPage, total } });
  }, "GET /api/admin/catalog");
}
