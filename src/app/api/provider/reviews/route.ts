import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingleOrNull, unwrapRowsSoft } from "@/lib/supabase/typed-queries";
import { providerNotFound } from "@/lib/errors";

type ProviderIdRow = Record<string, unknown> & { id: string };
type OfferingIdRow = Record<string, unknown> & { id: string };
type ReviewRow = Record<string, unknown> & {
  id: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  created_at: string;
  provider_offerings: { name: string } | null;
  users: { email: string } | null;
};

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return success({ data: [], meta: { page: 1, per_page: 20, total: 0 } });
    }

    const appUser = await requireRole("provider", "admin");
    const admin = createAdminClient();

    const provider = unwrapSingleOrNull<ProviderIdRow>(
      await admin
        .from("providers")
        .select("id")
        .eq("owner_user_id", appUser.id)
        .single(),
    );

    if (!provider) throw providerNotFound();

    const { searchParams } = new URL(request.url);
    const offeringFilter = searchParams.get("offering_id");
    const ratingFilter = searchParams.get("rating");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
    const offset = (page - 1) * perPage;

    // Get offering IDs for this provider
    const offerings = unwrapRowsSoft<OfferingIdRow>(
      await admin
        .from("provider_offerings")
        .select("id")
        .eq("provider_id", provider.id),
    );

    const offeringIds = offerings.map((o) => o.id);

    if (offeringIds.length === 0) {
      return success({ data: [], meta: { page, per_page: perPage, total: 0 } });
    }

    let query = admin
      .from("reviews")
      .select("*, provider_offerings(name), users(email)", { count: "exact" })
      .in("provider_offering_id", offeringIds)
      .order("created_at", { ascending: false });

    if (offeringFilter) query = query.eq("provider_offering_id", offeringFilter);
    if (ratingFilter) query = query.eq("rating", parseInt(ratingFilter, 10));

    query = query.range(offset, offset + perPage - 1);

    const result = await query;
    if (result.error) throw result.error;

    return success({
      data: (result.data ?? []) as ReviewRow[],
      meta: { page, per_page: perPage, total: result.count ?? 0 },
    });
  }, "GET /api/provider/reviews");
}
