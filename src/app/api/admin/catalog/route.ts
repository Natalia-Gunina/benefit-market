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

      let demoItems: CatalogItem[] = (DEMO_PROVIDER_OFFERINGS ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        description: o.description ?? "",
        price_points: o.base_price_points,
        category_name: catMap.get(o.global_category_id ?? "")?.name ?? "—",
        is_active: o.status === "published",
        is_stackable: o.is_stackable ?? false,
        provider_name: providerMap.get(o.provider_id)?.name ?? "—",
        provider_status: providerMap.get(o.provider_id)?.status,
        offering_status: o.status,
        created_at: o.created_at,
      }));

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
      .select("id, name, description, base_price_points, is_stackable, status, created_at, providers(name, status), global_categories(name)")
      .order("created_at", { ascending: false });

    if (search) oQuery = oQuery.ilike("name", `%${search}%`);

    const offeringRows = unwrapRows<OfferingRow>(
      await oQuery,
      "Failed to fetch offerings",
    );

    const items: CatalogItem[] = offeringRows.map((o) => ({
      id: o.id,
      name: o.name,
      description: o.description ?? "",
      price_points: o.base_price_points,
      category_name: o.global_categories?.name ?? "—",
      is_active: o.status === "published",
      is_stackable: !!(o as Record<string, unknown>).is_stackable,
      provider_name: o.providers?.name ?? "—",
      provider_status: o.providers?.status,
      offering_status: o.status,
      created_at: o.created_at,
    }));

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
  provider_id: z.string().uuid().optional(),
  new_provider: z.object({
    name: z.string().min(1).max(255),
    slug: z.string().max(100).regex(/^[a-z0-9-]*$/).optional().default(""),
    contact_email: z.string().email().optional().default(""),
  }).optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  global_category_id: z.string().uuid().optional().or(z.null()),
  base_price_points: z.number().int().min(1),
  stock_limit: z.number().int().min(0).nullable().optional().default(null),
  is_stackable: z.boolean().optional().default(false),
});

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_PROVIDER_OFFERINGS, DEMO_PROVIDERS } = await import("@/lib/demo-data");
      const body = await request.json();
      const id = "demo-po-" + Date.now().toString(36);

      // Resolve or create provider
      let providerId = body.provider_id;
      if (!providerId && body.new_provider) {
        const newPid = "demo-provider-" + Date.now().toString(36);
        DEMO_PROVIDERS.push({
          id: newPid,
          owner_user_id: "demo-user-001",
          name: body.new_provider.name,
          slug: body.new_provider.name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString(36),
          description: "",
          logo_url: null,
          website: null,
          contact_email: body.new_provider.contact_email ?? "",
          contact_phone: null,
          address: null,
          status: "verified",
          verified_at: null,
          verified_by: null,
          rejection_reason: null,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        providerId = newPid;
      }

      DEMO_PROVIDER_OFFERINGS.push({
        id,
        provider_id: providerId ?? "demo-provider-001",
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
      });

      return created({ id, name: body.name });
    }

    const appUser = await requireRole("admin");
    const admin = createAdminClient();
    const body = await request.json();
    const data = parseBody(createCatalogSchema, body);

    let providerId = data.provider_id;

    if (!providerId && data.new_provider) {
      // Auto-generate slug from name if not provided
      const slug = data.new_provider.slug
        || data.new_provider.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .slice(0, 80)
        + "-" + Date.now().toString(36);

      const providerResult = await admin
        .from("providers")
        .insert({
          name: data.new_provider.name,
          slug,
          contact_email: data.new_provider.contact_email || "",
          status: "verified",
          owner_user_id: appUser.id,
        } as never)
        .select("id")
        .single();

      const newProvider = unwrapSingle<{ id: string }>(providerResult, "Failed to create provider");
      providerId = newProvider.id;
    }

    if (!providerId) {
      throw new Error("Either provider_id or new_provider is required");
    }

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
        status: "published",
      } as never)
      .select("*, providers(name), global_categories(name)")
      .single();

    const row = unwrapSingle<OfferingRow>(offeringResult, "Failed to create offering");
    return created({
      id: row.id,
      name: row.name,
      provider_name: row.providers?.name ?? "—",
    });
  }, "POST /api/admin/catalog");
}
