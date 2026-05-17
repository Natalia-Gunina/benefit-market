import { type NextRequest } from "next/server";
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
type TenantIdRow = Record<string, unknown> & { tenant_id: string };

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const offeringFilter = searchParams.get("offering_id")?.trim() || "";

    if (isDemo) {
      const {
        DEMO_PROVIDER_OFFERINGS,
        DEMO_ORDERS,
        DEMO_ORDER_ITEMS,
        DEMO_REVIEWS,
        DEMO_TENANT_OFFERINGS,
      } = await import("@/lib/demo-data");
      const { DEMO_CURRENT_PROVIDER_ID } = await import("@/lib/demo/demo-service");

      // Scope strictly to the current provider (World Class) so the cabinet
      // never shows numbers belonging to other providers in the dataset.
      const allMyOfferings = (DEMO_PROVIDER_OFFERINGS ?? []).filter(
        (o) => o.provider_id === DEMO_CURRENT_PROVIDER_ID,
      );
      const allMyOfferingIds = new Set(allMyOfferings.map((o) => o.id));

      // Honour the optional ?offering_id=<id> filter: scope all aggregates to
      // a single offering when it belongs to this provider. Unknown ids
      // produce empty results rather than leaking other providers' data.
      const myOfferings =
        offeringFilter && allMyOfferingIds.has(offeringFilter)
          ? allMyOfferings.filter((o) => o.id === offeringFilter)
          : allMyOfferings;
      const myOfferingIds = new Set(myOfferings.map((o) => o.id));

      const offeringMap = new Map(myOfferings.map((o) => [o.id, o]));
      const publishedOfferings = myOfferings.filter((o) => o.status === "published");
      const pendingOfferings = myOfferings.filter((o) => o.status === "pending_review");

      const orderMap = new Map((DEMO_ORDERS ?? []).map((o) => [o.id, o]));
      const providerItems = (DEMO_ORDER_ITEMS ?? []).filter(
        (oi) => oi.provider_offering_id && myOfferingIds.has(oi.provider_offering_id),
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
          .filter((to) => to.is_active && myOfferingIds.has(to.provider_offering_id))
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

      // Ratings distribution — only reviews on this provider's offerings
      const myReviews = (DEMO_REVIEWS ?? []).filter(
        (r) => myOfferingIds.has(r.provider_offering_id) && r.status === "visible",
      );
      const ratingsDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      myReviews.forEach((r) => {
        if (r.rating >= 1 && r.rating <= 5) {
          ratingsDistribution[r.rating] = (ratingsDistribution[r.rating] ?? 0) + 1;
        }
      });

      const newReviews = myReviews.length;

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

    // Resolve the scope of offering ids first: either a single one (when the
    // ?offering_id filter is present and belongs to this provider) or all
    // offerings owned by the provider. This single source of truth is then
    // reused by every downstream metric.
    const allOfferingIdRows = unwrapRowsSoft<OfferingIdRow>(
      await admin
        .from("provider_offerings")
        .select("id")
        .eq("provider_id", provider.id),
    );
    const allProviderOfferingIds = allOfferingIdRows.map((o) => o.id);

    let ids: string[];
    if (offeringFilter) {
      ids = allProviderOfferingIds.includes(offeringFilter)
        ? [offeringFilter]
        : [];
    } else {
      ids = allProviderOfferingIds;
    }

    // Active offerings count — published offerings within the scope
    let activeOfferings = 0;
    if (offeringFilter) {
      if (ids.length > 0) {
        const r = await admin
          .from("provider_offerings")
          .select("id", { count: "exact", head: true })
          .eq("id", offeringFilter)
          .eq("status", "published");
        activeOfferings = r.count ?? 0;
      }
    } else {
      const r = await admin
        .from("provider_offerings")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", provider.id)
        .eq("status", "published");
      activeOfferings = r.count ?? 0;
    }

    // Average rating + popular offerings — published only, within the scope
    let offerings: OfferingRatingRow[] = [];
    if (ids.length > 0) {
      offerings = unwrapRowsSoft<OfferingRatingRow>(
        await admin
          .from("provider_offerings")
          .select("avg_rating, review_count, name")
          .in("id", ids)
          .eq("status", "published")
          .order("review_count", { ascending: false })
          .limit(5),
      );
    }

    const rated = offerings.filter((o) => o.avg_rating != null && o.review_count > 0);
    const totalReviews = rated.reduce((sum, o) => sum + o.review_count, 0);
    const avgRating = totalReviews > 0
      ? rated.reduce((sum, o) => sum + Number(o.avg_rating) * o.review_count, 0) / totalReviews
      : 0;

    let tenantConnections = 0;
    let totalOrders = 0;

    if (ids.length > 0) {
      // Tenant connections — count DISTINCT tenants that have an active
      // mapping to any in-scope offering. Supabase's count:'exact' returns
      // raw row counts, so we pull the column and dedupe client-side.
      const tenantRows = unwrapRowsSoft<TenantIdRow>(
        await admin
          .from("tenant_offerings")
          .select("tenant_id")
          .in("provider_offering_id", ids)
          .eq("is_active", true),
      );
      tenantConnections = new Set(tenantRows.map((r) => r.tenant_id)).size;

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
    let pendingOfferings = 0;
    if (offeringFilter) {
      if (ids.length > 0) {
        const r = await admin
          .from("provider_offerings")
          .select("id", { count: "exact", head: true })
          .eq("id", offeringFilter)
          .eq("status", "pending_review");
        pendingOfferings = r.count ?? 0;
      }
    } else {
      const r = await admin
        .from("provider_offerings")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", provider.id)
        .eq("status", "pending_review");
      pendingOfferings = r.count ?? 0;
    }

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
