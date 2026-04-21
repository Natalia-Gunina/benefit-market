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
      const {
        DEMO_PROVIDER_OFFERINGS,
        DEMO_ORDERS,
        DEMO_ORDER_ITEMS,
        DEMO_REVIEWS,
        DEMO_TENANT_OFFERINGS,
      } = await import("@/lib/demo-data");

      // Aggregate across ALL providers in demo mode (no real "current user").
      const allOfferings = DEMO_PROVIDER_OFFERINGS ?? [];
      const offeringMap = new Map(allOfferings.map((o) => [o.id, o]));
      const publishedOfferings = allOfferings.filter((o) => o.status === "published");
      const pendingOfferings = allOfferings.filter((o) => o.status === "pending_review");

      const orderMap = new Map((DEMO_ORDERS ?? []).map((o) => [o.id, o]));
      const providerItems = (DEMO_ORDER_ITEMS ?? []).filter(
        (oi) => !!oi.provider_offering_id,
      );

      const totalOrders = providerItems.length;
      const totalPointsEarned = providerItems.reduce(
        (sum, oi) => {
          const status = orderMap.get(oi.order_id)?.status;
          return status === "paid" ? sum + oi.price_points * oi.quantity : sum;
        },
        0,
      );

      const tenantConnections = new Set(
        (DEMO_TENANT_OFFERINGS ?? [])
          .filter((to) => to.is_active)
          .map((to) => to.tenant_id),
      ).size;

      // Popular offerings: rank by review_count, return top 5
      const popularOfferings = [...publishedOfferings]
        .sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0))
        .slice(0, 5)
        .map((o) => ({
          name: o.name,
          avg_rating: o.avg_rating ?? 0,
          review_count: o.review_count ?? 0,
        }));

      // Avg rating — weighted by review_count
      const rated = publishedOfferings.filter((o) => (o.review_count ?? 0) > 0);
      const totalReviews = rated.reduce((sum, o) => sum + (o.review_count ?? 0), 0);
      const avgRating =
        totalReviews > 0
          ? rated.reduce(
              (sum, o) => sum + (o.avg_rating ?? 0) * (o.review_count ?? 0),
              0,
            ) / totalReviews
          : 0;

      // Recent orders (last 5 by created_at desc)
      const recentOrders = providerItems
        .map((oi) => {
          const po = offeringMap.get(oi.provider_offering_id!);
          const order = orderMap.get(oi.order_id);
          return {
            id: oi.id,
            offering_name: po?.name ?? "—",
            quantity: oi.quantity,
            price_points: oi.price_points,
            status: order?.status ?? "pending",
            created_at: order?.created_at ?? "",
          };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5);

      // Ratings distribution
      const ratingsDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      (DEMO_REVIEWS ?? []).forEach((r) => {
        if (r.status === "visible" && r.rating >= 1 && r.rating <= 5) {
          ratingsDistribution[r.rating] = (ratingsDistribution[r.rating] ?? 0) + 1;
        }
      });

      const newReviews = (DEMO_REVIEWS ?? []).filter((r) => r.status === "visible").length;

      return success({
        total_orders: totalOrders,
        total_points_earned: totalPointsEarned,
        avg_rating: Math.round(avgRating * 100) / 100,
        active_offerings: publishedOfferings.length,
        tenant_connections: tenantConnections,
        popular_offerings: popularOfferings,
        recent_orders: recentOrders,
        action_items: {
          pending_offerings: pendingOfferings.length,
          new_reviews: newReviews,
        },
        ratings_distribution: ratingsDistribution,
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
