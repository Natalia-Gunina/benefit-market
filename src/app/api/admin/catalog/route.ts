import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows, unwrapSingle } from "@/lib/supabase/typed-queries";
import { createBenefitSchema, createCatalogProviderItemSchema } from "@/lib/api/validators";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BenefitRow = Record<string, unknown> & {
  id: string;
  name: string;
  description: string;
  price_points: number;
  is_active: boolean;
  created_at: string;
  benefit_categories: { name: string } | null;
};

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
  source: "internal" | "provider";
  name: string;
  description: string;
  price_points: number;
  category_name: string;
  is_active: boolean;
  provider_name?: string;
  provider_status?: string;
  offering_status?: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// GET /api/admin/catalog — unified catalog listing
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return success({ data: [], meta: { page: 1, per_page: 20, total: 0 } });
    }

    const appUser = await requireRole("admin");
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const source = searchParams.get("source") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));

    const items: CatalogItem[] = [];

    // Fetch internal benefits
    if (source === "all" || source === "internal") {
      let bQuery = admin
        .from("benefits")
        .select("id, name, description, price_points, is_active, created_at, benefit_categories(name)")
        .eq("tenant_id", appUser.tenant_id)
        .order("created_at", { ascending: false });

      if (search) bQuery = bQuery.ilike("name", `%${search}%`);

      const benefitRows = unwrapRows<BenefitRow>(
        await bQuery,
        "Failed to fetch benefits",
      );

      for (const b of benefitRows) {
        items.push({
          id: b.id,
          source: "internal",
          name: b.name,
          description: b.description ?? "",
          price_points: b.price_points,
          category_name: b.benefit_categories?.name ?? "—",
          is_active: b.is_active,
          created_at: b.created_at,
        });
      }
    }

    // Fetch provider offerings
    if (source === "all" || source === "provider") {
      let oQuery = admin
        .from("provider_offerings")
        .select("id, name, description, base_price_points, status, created_at, providers(name, status), global_categories(name)")
        .order("created_at", { ascending: false });

      if (search) oQuery = oQuery.ilike("name", `%${search}%`);

      const offeringRows = unwrapRows<OfferingRow>(
        await oQuery,
        "Failed to fetch offerings",
      );

      for (const o of offeringRows) {
        items.push({
          id: o.id,
          source: "provider",
          name: o.name,
          description: o.description ?? "",
          price_points: o.base_price_points,
          category_name: o.global_categories?.name ?? "—",
          is_active: o.status === "published",
          provider_name: o.providers?.name ?? "—",
          provider_status: o.providers?.status,
          offering_status: o.status,
          created_at: o.created_at,
        });
      }
    }

    // Sort by created_at descending
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Paginate
    const total = items.length;
    const offset = (page - 1) * perPage;
    const paginated = items.slice(offset, offset + perPage);

    return success({ data: paginated, meta: { page, per_page: perPage, total } });
  }, "GET /api/admin/catalog");
}

// ---------------------------------------------------------------------------
// POST /api/admin/catalog — create internal benefit or provider offering
// ---------------------------------------------------------------------------

const createCatalogSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("internal"),
    name: z.string().min(1).max(255),
    description: z.string().optional().default(""),
    category_id: z.string().uuid(),
    price_points: z.number().int().min(0),
    stock_limit: z.number().int().min(0).nullable().optional().default(null),
    is_active: z.boolean().optional().default(true),
  }),
  z.object({
    source: z.literal("provider"),
    provider_id: z.string().uuid().optional(),
    new_provider: z.object({
      name: z.string().min(1).max(255),
      slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
      contact_email: z.string().email().optional().default(""),
    }).optional(),
    name: z.string().min(1).max(255),
    description: z.string().optional().default(""),
    global_category_id: z.string().uuid().optional().or(z.null()),
    base_price_points: z.number().int().min(1),
    stock_limit: z.number().int().min(0).nullable().optional().default(null),
  }),
]);

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return created({ id: "demo-catalog-new", source: "internal", name: "New Item" });
    }

    const appUser = await requireRole("admin");
    const admin = createAdminClient();
    const body = await request.json();
    const data = parseBody(createCatalogSchema, body);

    if (data.source === "internal") {
      const result = await admin
        .from("benefits")
        .insert({
          name: data.name,
          description: data.description,
          category_id: data.category_id,
          price_points: data.price_points,
          stock_limit: data.stock_limit,
          is_active: data.is_active,
          tenant_id: appUser.tenant_id,
        } as never)
        .select("*, benefit_categories(name)")
        .single();

      const row = unwrapSingle<BenefitRow>(result, "Failed to create benefit");
      return created({
        id: row.id,
        source: "internal" as const,
        name: row.name,
        category_name: row.benefit_categories?.name ?? "—",
      });
    }

    // source === "provider"
    let providerId = data.provider_id;

    if (!providerId && data.new_provider) {
      const providerResult = await admin
        .from("providers")
        .insert({
          name: data.new_provider.name,
          slug: data.new_provider.slug,
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
        status: "published",
      } as never)
      .select("*, providers(name), global_categories(name)")
      .single();

    const row = unwrapSingle<OfferingRow>(offeringResult, "Failed to create offering");
    return created({
      id: row.id,
      source: "provider" as const,
      name: row.name,
      provider_name: row.providers?.name ?? "—",
    });
  }, "POST /api/admin/catalog");
}
