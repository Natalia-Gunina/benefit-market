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
type OrderItemRow = Record<string, unknown> & {
  id: string;
  order_id: string;
  provider_offering_id: string;
  orders: { id: string; status: string; total_points: number; created_at: string; tenant_id: string };
  provider_offerings: { name: string } | null;
};

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const {
        DEMO_ORDER_ITEMS,
        DEMO_ORDERS,
        DEMO_PROVIDER_OFFERINGS,
        DEMO_REVIEWS,
      } = await import("@/lib/demo-data");

      const { DEMO_CURRENT_PROVIDER_ID } = await import("@/lib/demo/demo-service");

      const { searchParams } = new URL(request.url);
      const statusFilter = searchParams.get("status") || "";
      const search = (searchParams.get("search") || "").toLowerCase();
      const providerIdFilter = searchParams.get("provider_id") || DEMO_CURRENT_PROVIDER_ID;
      const dateFrom = searchParams.get("date_from") || "";
      const dateTo = searchParams.get("date_to") || "";

      const orderMap = new Map(DEMO_ORDERS.map((o) => [o.id, o]));
      const offeringMap = new Map(DEMO_PROVIDER_OFFERINGS.map((o) => [o.id, o]));
      const myOfferingIds = new Set(
        DEMO_PROVIDER_OFFERINGS.filter((o) => o.provider_id === providerIdFilter).map((o) => o.id),
      );

      const rows = DEMO_ORDER_ITEMS
        .filter((oi) => !!oi.provider_offering_id && myOfferingIds.has(oi.provider_offering_id!))
        .map((oi) => {
          const po = offeringMap.get(oi.provider_offering_id!);
          const order = orderMap.get(oi.order_id);
          const review = DEMO_REVIEWS.find(
            (r) => r.order_id === oi.order_id && r.provider_offering_id === oi.provider_offering_id,
          );
          return {
            id: oi.id,
            order_id: oi.order_id,
            provider_offering_id: oi.provider_offering_id,
            quantity: oi.quantity,
            price_points: oi.price_points,
            provider_offerings: po ? { name: po.name, provider_id: po.provider_id } : null,
            orders: order
              ? {
                  id: order.id,
                  status: order.status,
                  total_points: order.total_points,
                  created_at: order.created_at,
                  tenant_id: order.tenant_id,
                }
              : null,
            review: review
              ? { rating: review.rating, title: review.title, body: review.body }
              : null,
          };
        })
        .filter((row) => {
          if (statusFilter && row.orders?.status !== statusFilter) return false;
          if (
            providerIdFilter &&
            row.provider_offerings?.provider_id !== providerIdFilter
          ) {
            return false;
          }
          if (
            search &&
            !(row.provider_offerings?.name ?? "").toLowerCase().includes(search)
          ) {
            return false;
          }
          if (dateFrom && row.orders?.created_at && row.orders.created_at < dateFrom) return false;
          if (dateTo && row.orders?.created_at && row.orders.created_at > dateTo) return false;
          return true;
        })
        .sort((a, b) =>
          (b.orders?.created_at ?? "").localeCompare(a.orders?.created_at ?? ""),
        );

      const totalPaidPoints = rows
        .filter((r) => r.orders?.status === "paid")
        .reduce((sum, r) => sum + r.price_points * r.quantity, 0);

      return success({
        data: rows,
        meta: { page: 1, per_page: rows.length || 20, total: rows.length },
        aggregates: { total_paid_points: totalPaidPoints },
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
    const offset = (page - 1) * perPage;

    // Get offering IDs for this provider
    let offeringsQuery = admin
      .from("provider_offerings")
      .select("id")
      .eq("provider_id", provider.id);

    if (search) {
      offeringsQuery = offeringsQuery.ilike("name", `%${search}%`);
    }

    const offerings = unwrapRowsSoft<OfferingIdRow>(await offeringsQuery);

    const offeringIds = offerings.map((o) => o.id);

    if (offeringIds.length === 0) {
      return success({ data: [], meta: { page, per_page: perPage, total: 0 }, aggregates: { total_paid_points: 0 } });
    }

    // Get order_items for these offerings
    let query = admin
      .from("order_items")
      .select("*, orders!inner(id, status, total_points, created_at, tenant_id), provider_offerings(name)", { count: "exact" })
      .in("provider_offering_id", offeringIds)
      .order("order_id", { ascending: false });

    if (status) {
      query = query.eq("orders.status", status);
    }
    if (dateFrom) {
      query = query.gte("orders.created_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("orders.created_at", dateTo);
    }

    query = query.range(offset, offset + perPage - 1);

    const result = await query;
    if (result.error) throw result.error;
    const rawData = (result.data ?? []) as OrderItemRow[];

    // Fetch reviews for these order items
    const orderIds = [...new Set(rawData.map((d) => d.orders?.id).filter(Boolean))] as string[];
    const reviewMap = new Map<string, { rating: number; title: string; body: string }>();
    if (orderIds.length > 0) {
      const reviewResult = await admin
        .from("reviews")
        .select("order_id, provider_offering_id, rating, title, body")
        .in("order_id", orderIds)
        .in("provider_offering_id", offeringIds);
      for (const r of (reviewResult.data ?? []) as Array<{ order_id: string; provider_offering_id: string; rating: number; title: string; body: string }>) {
        reviewMap.set(`${r.order_id}:${r.provider_offering_id}`, {
          rating: r.rating,
          title: r.title,
          body: r.body,
        });
      }
    }

    const data = rawData.map((item) => ({
      ...item,
      review: reviewMap.get(`${item.orders?.id}:${item.provider_offering_id}`) ?? null,
    }));

    // Aggregate: sum of price_points * quantity for paid orders in the date range
    let aggQuery = admin
      .from("order_items")
      .select("price_points, quantity, orders!inner(status, created_at)")
      .in("provider_offering_id", offeringIds)
      .eq("orders.status", "paid");

    if (dateFrom) {
      aggQuery = aggQuery.gte("orders.created_at", dateFrom);
    }
    if (dateTo) {
      aggQuery = aggQuery.lte("orders.created_at", dateTo);
    }

    const aggResult = await aggQuery;
    const aggRows = (aggResult.data ?? []) as Array<{ price_points: number; quantity: number }>;
    const totalPaidPoints = aggRows.reduce((sum, r) => sum + r.price_points * r.quantity, 0);

    return success({
      data,
      meta: { page, per_page: perPage, total: result.count ?? 0 },
      aggregates: { total_paid_points: totalPaidPoints },
    });
  }, "GET /api/provider/orders");
}
