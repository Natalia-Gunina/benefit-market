import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapRows } from "@/lib/supabase/typed-queries";
import { createReviewSchema } from "@/lib/api/validators";
import { alreadyReviewed, reviewNotAllowed } from "@/lib/errors";
import type { Review } from "@/lib/types";

type OrderItemCheck = { id: string; orders: Record<string, unknown> | null };

// POST /api/reviews — create a review
export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return created({
        id: "demo-review-new",
        rating: 5,
        title: "Great!",
        status: "visible",
      });
    }

    const appUser = await requireAuth();
    const admin = createAdminClient();

    const body = await request.json();
    const data = parseBody(createReviewSchema, body);

    // Check: user has a paid order with this specific offering.
    // Order items reference provider_offering_id directly for marketplace items,
    // so a single check is sufficient and prevents cross-offering review abuse.
    const orderItems = unwrapRows<OrderItemCheck>(
      await admin
        .from("order_items")
        .select("id, orders!inner(status, user_id)")
        .eq("provider_offering_id", data.provider_offering_id)
        .eq("orders.status", "paid")
        .eq("orders.user_id", appUser.id)
        .limit(1),
      "Failed to check order items",
    );

    if (orderItems.length === 0) {
      throw reviewNotAllowed();
    }

    // Check: not already reviewed
    const existing = unwrapRows<{ id: string }>(
      await admin
        .from("reviews")
        .select("id")
        .eq("user_id", appUser.id)
        .eq("provider_offering_id", data.provider_offering_id)
        .limit(1),
      "Failed to check existing reviews",
    );

    if (existing.length > 0) {
      throw alreadyReviewed();
    }

    const review = unwrapSingle<Review>(
      await admin
        .from("reviews")
        .insert({
          provider_offering_id: data.provider_offering_id,
          tenant_id: appUser.tenant_id,
          user_id: appUser.id,
          rating: data.rating,
          title: data.title,
          body: data.body,
          status: "visible",
        } as never)
        .select("*")
        .single(),
      "Failed to create review",
    );

    return created(review);
  }, "POST /api/reviews");
}
