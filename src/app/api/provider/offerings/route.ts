import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { createProviderOfferingSchema } from "@/lib/api/validators";
import { providerNotFound, providerNotVerified } from "@/lib/errors";
import type { ProviderOffering } from "@/lib/types";

// Explicit row types for Supabase query results
type ProviderIdRow = Record<string, unknown> & { id: string };
type ProviderIdStatusRow = Record<string, unknown> & { id: string; status: string };
type OfferingRow = Record<string, unknown> & {
  id: string;
  name: string;
  status: string;
  global_categories: { name: string; icon: string } | null;
};

// ---------------------------------------------------------------------------
// GET /api/provider/offerings — list own offerings
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return success([]);
    }

    const appUser = await requireRole("provider", "admin");
    const admin = createAdminClient();

    // Get provider
    const provider = unwrapSingleOrNull<ProviderIdRow>(
      await admin
        .from("providers")
        .select("id")
        .eq("owner_user_id", appUser.id)
        .single(),
    );

    if (!provider) {
      throw providerNotFound();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
    const offset = (page - 1) * perPage;

    let query = admin
      .from("provider_offerings")
      .select("*, global_categories(name, icon)", { count: "exact" })
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (search) query = query.ilike("name", `%${search}%`);

    query = query.range(offset, offset + perPage - 1);

    const result = await query;
    if (result.error) throw result.error;
    const data = (result.data ?? []) as OfferingRow[];

    return success({
      data,
      meta: { page, per_page: perPage, total: result.count ?? 0 },
    });
  }, "GET /api/provider/offerings");
}

// ---------------------------------------------------------------------------
// POST /api/provider/offerings — create new offering (draft)
// ---------------------------------------------------------------------------

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return created({ id: "demo-offering-new", name: "New Offering", status: "draft" });
    }

    const appUser = await requireRole("provider", "admin");
    const admin = createAdminClient();

    const provider = unwrapSingleOrNull<ProviderIdStatusRow>(
      await admin
        .from("providers")
        .select("id, status")
        .eq("owner_user_id", appUser.id)
        .single(),
    );

    if (!provider) throw providerNotFound();
    if (provider.status !== "verified") throw providerNotVerified();

    const body = await request.json();
    const data = parseBody(createProviderOfferingSchema, body);

    const offering = unwrapSingle<ProviderOffering>(
      await admin
        .from("provider_offerings")
        .insert({
          provider_id: provider.id,
          global_category_id: data.global_category_id || null,
          name: data.name,
          description: data.description,
          long_description: data.long_description,
          image_urls: data.image_urls,
          base_price_points: data.base_price_points,
          stock_limit: data.stock_limit,
          status: "draft",
          delivery_info: data.delivery_info,
          terms_conditions: data.terms_conditions,
        } as never)
        .select("*")
        .single(),
      "Failed to create offering",
    );

    return created(offering);
  }, "POST /api/provider/offerings");
}
