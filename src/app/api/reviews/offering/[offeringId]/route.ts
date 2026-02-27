import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { dbError } from "@/lib/errors";
import type { Review } from "@/lib/types";

type RouteContext = { params: Promise<{ offeringId: string }> };

type OfferingStats = { avg_rating: number | null; review_count: number | null };

export function GET(request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { offeringId } = await context.params;

    if (isDemo) {
      const { DEMO_REVIEWS } = await import("@/lib/demo-data");
      const reviews = (DEMO_REVIEWS ?? []).filter((r) => r.provider_offering_id === offeringId);
      return success({
        reviews,
        stats: { global: { avg: 4.5, count: reviews.length }, company: { avg: 4.3, count: reviews.length } },
      });
    }

    const appUser = await requireAuth();
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("per_page") || "10", 10)));
    const offset = (page - 1) * perPage;

    // Tenant-scoped reviews
    const reviewsResult = await admin
      .from("reviews")
      .select("*", { count: "exact" })
      .eq("provider_offering_id", offeringId)
      .eq("tenant_id", appUser.tenant_id)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (reviewsResult.error) throw dbError(reviewsResult.error.message);
    const reviews = (reviewsResult.data ?? []) as Review[];

    // Global stats
    const po = unwrapSingleOrNull<OfferingStats>(
      await admin
        .from("provider_offerings")
        .select("avg_rating, review_count")
        .eq("id", offeringId)
        .single(),
    );

    return success({
      reviews,
      meta: { page, per_page: perPage, total: reviewsResult.count ?? 0 },
      stats: {
        global: { avg: po?.avg_rating ?? 0, count: po?.review_count ?? 0 },
      },
    });
  }, "GET /api/reviews/offering/[offeringId]");
}
