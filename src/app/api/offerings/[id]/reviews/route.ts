import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { dbError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

type TenantOfferingRef = { provider_offering_id: string };
type ReviewWithUser = Record<string, unknown> & { users: { email: string } | null };
type OfferingStats = { avg_rating: number | null; review_count: number | null };
type TenantStats = { tenant_avg_rating: number | null; tenant_review_count: number | null };

export function GET(request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) {
      const { DEMO_REVIEWS } = await import("@/lib/demo-data");
      return success({
        reviews: DEMO_REVIEWS ?? [],
        stats: { global: { avg: 4.5, count: 5 }, company: { avg: 4.3, count: 2 } },
      });
    }

    const appUser = await requireAuth();
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("per_page") || "10", 10)));
    const offset = (page - 1) * perPage;

    // Get the tenant_offering to find provider_offering_id
    const tenantOffering = unwrapSingleOrNull<TenantOfferingRef>(
      await admin
        .from("tenant_offerings")
        .select("provider_offering_id")
        .eq("id", id)
        .eq("tenant_id", appUser.tenant_id)
        .single(),
    );

    if (!tenantOffering) {
      return success({ reviews: [], stats: { global: { avg: 0, count: 0 }, company: { avg: 0, count: 0 } } });
    }

    const poId = tenantOffering.provider_offering_id;

    // Fetch reviews (tenant-scoped)
    const reviewsResult = await admin
      .from("reviews")
      .select("*, users(email)", { count: "exact" })
      .eq("provider_offering_id", poId)
      .eq("tenant_id", appUser.tenant_id)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (reviewsResult.error) throw dbError(reviewsResult.error.message);
    const reviews = (reviewsResult.data ?? []) as ReviewWithUser[];

    // Get global stats
    const po = unwrapSingleOrNull<OfferingStats>(
      await admin
        .from("provider_offerings")
        .select("avg_rating, review_count")
        .eq("id", poId)
        .single(),
    );

    // Get company stats
    const to = unwrapSingleOrNull<TenantStats>(
      await admin
        .from("tenant_offerings")
        .select("tenant_avg_rating, tenant_review_count")
        .eq("id", id)
        .single(),
    );

    return success({
      reviews,
      meta: { page, per_page: perPage, total: reviewsResult.count ?? 0 },
      stats: {
        global: { avg: po?.avg_rating ?? 0, count: po?.review_count ?? 0 },
        company: { avg: to?.tenant_avg_rating ?? 0, count: to?.tenant_review_count ?? 0 },
      },
    });
  }, "GET /api/offerings/[id]/reviews");
}
