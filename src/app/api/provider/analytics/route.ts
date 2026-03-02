import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingleOrNull, unwrapRowsSoft } from "@/lib/supabase/typed-queries";
import { providerNotFound } from "@/lib/errors";

// Explicit row types for Supabase query results
type ProviderIdRow = Record<string, unknown> & { id: string };
type OfferingIdRow = Record<string, unknown> & { id: string };
type OfferingRatingRow = Record<string, unknown> & {
  avg_rating: number | null;
  review_count: number;
  name: string;
};
type OrderItemRow = Record<string, unknown> & {
  id: string;
  quantity: number;
  price_points: number;
  provider_offering_id: string;
  provider_offerings: { name: string } | null;
  orders: { id: string; status: string; created_at: string } | null;
};
type ReviewRow = Record<string, unknown> & {
  id: string;
  rating: number;
};

export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      return success({
        total_orders: 42,
        monthly_orders: 8,
        total_points_earned: 185000,
        avg_rating: 4.5,
        active_offerings: 3,
        tenant_connections: 5,
        popular_offerings: [],
        recent_orders: [],
        action_items: { pending_offerings: 0, new_reviews: 0 },
        ratings_distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        monthly_stats: [],
      });
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

    // Active offerings count
    const activeOfferingsResult = await admin
      .from("provider_offerings")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", provider.id)
      .eq("status", "published");
    const activeOfferings = activeOfferingsResult.count;

    // Average rating
    const offerings = unwrapRowsSoft<OfferingRatingRow>(
      await admin
        .from("provider_offerings")
        .select("avg_rating, review_count, name")
        .eq("provider_id", provider.id)
        .eq("status", "published")
        .order("review_count", { ascending: false })
        .limit(5),
    );

    const rated = offerings.filter((o) => o.avg_rating != null && o.review_count > 0);
    const totalReviews = rated.reduce((sum, o) => sum + o.review_count, 0);
    const avgRating = totalReviews > 0
      ? rated.reduce((sum, o) => sum + Number(o.avg_rating) * o.review_count, 0) / totalReviews
      : 0;

    // Tenant connections
    const offeringIdRows = unwrapRowsSoft<OfferingIdRow>(
      await admin
        .from("provider_offerings")
        .select("id")
        .eq("provider_id", provider.id),
    );

    const ids = offeringIdRows.map((o) => o.id);
    let tenantConnections = 0;
    let totalOrders = 0;

    if (ids.length > 0) {
      const tenantResult = await admin
        .from("tenant_offerings")
        .select("tenant_id", { count: "exact", head: true })
        .in("provider_offering_id", ids);
      tenantConnections = tenantResult.count ?? 0;

      // Total orders
      const orderResult = await admin
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .in("provider_offering_id", ids);
      totalOrders = orderResult.count ?? 0;
    }

    // Recent orders (last 5)
    let recentOrders: Array<{
      id: string;
      offering_name: string;
      quantity: number;
      price_points: number;
      status: string;
      created_at: string;
    }> = [];

    if (ids.length > 0) {
      const recentResult = await admin
        .from("order_items")
        .select("id, quantity, price_points, provider_offering_id, provider_offerings(name), orders!inner(id, status, created_at)")
        .in("provider_offering_id", ids)
        .order("order_id", { ascending: false })
        .limit(5);

      const recentRows = (recentResult.data ?? []) as OrderItemRow[];
      recentOrders = recentRows.map((r) => ({
        id: r.id,
        offering_name: r.provider_offerings?.name ?? "—",
        quantity: r.quantity,
        price_points: r.price_points,
        status: r.orders?.status ?? "pending",
        created_at: r.orders?.created_at ?? "",
      }));
    }

    // Action items
    const pendingOfferingsResult = await admin
      .from("provider_offerings")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", provider.id)
      .eq("status", "pending_review");
    const pendingOfferings = pendingOfferingsResult.count ?? 0;

    let newReviews = 0;
    if (ids.length > 0) {
      const reviewsResult = await admin
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .in("provider_offering_id", ids)
        .eq("status", "visible");
      newReviews = reviewsResult.count ?? 0;
    }

    // Ratings distribution
    const ratingsDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (ids.length > 0) {
      const reviewsData = unwrapRowsSoft<ReviewRow>(
        await admin
          .from("reviews")
          .select("id, rating")
          .in("provider_offering_id", ids),
      );
      for (const r of reviewsData) {
        if (r.rating >= 1 && r.rating <= 5) {
          ratingsDistribution[r.rating] = (ratingsDistribution[r.rating] ?? 0) + 1;
        }
      }
    }

    return success({
      total_orders: totalOrders,
      avg_rating: Math.round(avgRating * 100) / 100,
      active_offerings: activeOfferings ?? 0,
      tenant_connections: tenantConnections,
      popular_offerings: offerings,
      recent_orders: recentOrders,
      action_items: { pending_offerings: pendingOfferings, new_reviews: newReviews },
      ratings_distribution: ratingsDistribution,
    });
  }, "GET /api/provider/analytics");
}
