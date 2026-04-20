import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows, unwrapSingle } from "@/lib/supabase/typed-queries";
import { z } from "zod";

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
  provider_name?: string;
  provider_status?: string;
  offering_status?: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// GET /api/admin/catalog — catalog listing (provider offerings only)
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_PROVIDER_OFFERINGS, DEMO_PROVIDERS, DEMO_GLOBAL_CATEGORIES } = await import("@/lib/demo-data");
      const providerMap = new Map((DEMO_PROVIDERS ?? []).map((p) => [p.id, p]));
      const catMap = new Map((DEMO_GLOBAL_CATEGORIES ?? []).map((c) => [c.id, c]));

      const { searchParams: demoParams } = new URL(request.url);
      const demoSearch = demoParams.get("search") || "";

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
          provider_name: providerMap.get(o.provider_id)?.name ?? "—",
          provider_status: providerMap.get(o.provider_id)?.status,
          offering_status: o.status,
          created_at: o.created_at,
        };
      });

      if (demoSearch) {
        const q = demoSearch.toLowerCase();
        demoItems = demoItems.filter((i) => i.name.toLowerCase().includes(q));
      }

      return success({ data: demoItems, meta: { page: 1, per_page: 20, total: demoItems.length } });
    }

    const appUser = await requireRole("admin");
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));

    void appUser; // tenant scoping can be added later

    let oQuery = admin
      .from("provider_offerings")
      .select("id, name, description, base_price_points, is_stackable, format, cities, status, created_at, providers(name, status), global_categories(name)")
      .order("created_at", { ascending: false });

    if (search) oQuery = oQuery.ilike("name", `%${search}%`);

    const offeringRows = unwrapRows<OfferingRow>(
      await oQuery,
      "Failed to fetch offerings",
    );

    const items: CatalogItem[] = offeringRows.map((o) => {
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
        provider_name: o.providers?.name ?? "—",
        provider_status: o.providers?.status,
        offering_status: o.status,
        created_at: o.created_at,
      };
    });

    // Paginate
    const total = items.length;
    const offset = (page - 1) * perPage;
    const paginated = items.slice(offset, offset + perPage);

    return success({ data: paginated, meta: { page, per_page: perPage, total } });
  }, "GET /api/admin/catalog");
}

// ---------------------------------------------------------------------------
// POST /api/admin/catalog — create provider offering
// ---------------------------------------------------------------------------

const createCatalogSchema = z.object({
  provider_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  global_category_id: z.string().uuid().optional().or(z.null()),
  base_price_points: z.number().int().min(1),
  stock_limit: z.number().int().min(0).nullable().optional().default(null),
  is_stackable: z.boolean().optional().default(false),
  format: z.enum(["online", "offline"]).optional().default("online"),
  cities: z.array(z.string().min(1).max(120)).optional().default([]),
}).refine(
  (d) => d.format !== "offline" || d.cities.length > 0,
  { message: "Для офлайн-льготы требуется указать хотя бы один город", path: ["cities"] },
);

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_PROVIDER_OFFERINGS, DEMO_TENANT_OFFERINGS } = await import("@/lib/demo-data");
      const body = await request.json();
      const id = "demo-po-" + Date.now().toString(36);

      const providerId = body.provider_id;
      if (!providerId) {
        throw new Error("provider_id is required");
      }

      const fmt: OfferingFormat = body.format === "offline" ? "offline" : "online";
      const cts: string[] = Array.isArray(body.cities) ? body.cities : [];
      if (fmt === "offline" && cts.length === 0) {
        throw new Error("Для офлайн-льготы требуется указать хотя бы один город");
      }

      DEMO_PROVIDER_OFFERINGS.push({
        id,
        provider_id: providerId,
        global_category_id: body.global_category_id ?? null,
        name: body.name,
        description: body.description ?? "",
        long_description: "",
        image_urls: [],
        base_price_points: body.base_price_points,
        stock_limit: body.stock_limit ?? null,
        is_stackable: body.is_stackable ?? false,
        status: "published",
        delivery_info: "",
        terms_conditions: "",
        metadata: {},
        avg_rating: 0,
        review_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        format: fmt,
        cities: fmt === "offline" ? cts : [],
      } as unknown as (typeof DEMO_PROVIDER_OFFERINGS)[number]);

      // Auto-enable for demo tenant so it appears in employee catalog
      const toId = "demo-to-" + Date.now().toString(36);
      DEMO_TENANT_OFFERINGS.push({
        id: toId,
        tenant_id: "demo-tenant-001",
        provider_offering_id: id,
        custom_price_points: null,
        tenant_stock_limit: null,
        is_active: true,
        tenant_category_id: null,
        enabled_by: "demo-user-001",
        enabled_at: new Date().toISOString(),
        tenant_avg_rating: 0,
        tenant_review_count: 0,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return created({ id, name: body.name });
    }

    const appUser = await requireRole("admin");
    const admin = createAdminClient();
    const body = await request.json();
    const data = parseBody(createCatalogSchema, body);

    const providerId = data.provider_id;

    // Create the provider offering
    const offeringResult = await admin
      .from("provider_offerings")
      .insert({
        provider_id: providerId,
        name: data.name,
        description: data.description,
        global_category_id: data.global_category_id || null,
        base_price_points: data.base_price_points,
        stock_limit: data.stock_limit,
        is_stackable: data.is_stackable,
        format: data.format,
        cities: data.format === "offline" ? data.cities : [],
        status: "published",
      } as never)
      .select("*, providers(name), global_categories(name)")
      .single();

    const row = unwrapSingle<OfferingRow>(offeringResult, "Failed to create offering");

    // Auto-enable for the admin's tenant so it appears in the employee catalog
    await admin
      .from("tenant_offerings")
      .insert({
        tenant_id: appUser.tenant_id,
        provider_offering_id: row.id,
        is_active: true,
        enabled_by: appUser.id,
      } as never);

    return created({
      id: row.id,
      name: row.name,
      provider_name: row.providers?.name ?? "—",
    });
  }, "POST /api/admin/catalog");
}
