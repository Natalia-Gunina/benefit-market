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

    const avgRating = offerings.length > 0
      ? offerings.reduce((sum, o) => sum + Number(o.avg_rating), 0) / offerings.length
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

    return success({
      total_orders: totalOrders,
      avg_rating: Math.round(avgRating * 100) / 100,
      active_offerings: activeOfferings ?? 0,
      tenant_connections: tenantConnections,
      popular_offerings: offerings,
    });
  }, "GET /api/provider/analytics");
}
