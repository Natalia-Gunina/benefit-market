import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingleOrNull, unwrapRows } from "@/lib/supabase/typed-queries";

type RouteContext = { params: Promise<{ id: string }> };

type TenantOfferingRef = { provider_offering_id: string };
type OrderItemCheck = { id: string };
type ReviewCheck = { id: string };

export function GET(_request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) {
      // First offering allows review, others don't
      const canReview = id === "demo-to-001";
      return success({
        can_review: canReview,
        has_reviewed: false,
      });
    }

    const appUser = await requireAuth();
    const admin = createAdminClient();

    // Get provider_offering_id from tenant_offering
    const tenantOffering = unwrapSingleOrNull<TenantOfferingRef>(
      await admin
        .from("tenant_offerings")
        .select("provider_offering_id")
        .eq("id", id)
        .eq("tenant_id", appUser.tenant_id)
        .single(),
    );

    if (!tenantOffering) {
      return success({ can_review: false, has_reviewed: false });
    }

    const poId = tenantOffering.provider_offering_id;

    // Check if user has a paid order with this offering
    const orderItems = unwrapRows<OrderItemCheck>(
      await admin
        .from("order_items")
        .select("id, orders!inner(status, user_id)")
        .eq("provider_offering_id", poId)
        .eq("orders.status", "paid")
        .eq("orders.user_id", appUser.id)
        .limit(1),
      "Failed to check order items",
    );

    // Also check via tenant_offering_id
    const orderItems2 = unwrapRows<OrderItemCheck>(
      await admin
        .from("order_items")
        .select("id, orders!inner(status, user_id)")
        .eq("tenant_offering_id", id)
        .eq("orders.status", "paid")
        .eq("orders.user_id", appUser.id)
        .limit(1),
      "Failed to check order items",
    );

    const hasPaidOrder = orderItems.length > 0 || orderItems2.length > 0;

    // Check if user already reviewed
    const existing = unwrapRows<ReviewCheck>(
      await admin
        .from("reviews")
        .select("id")
        .eq("user_id", appUser.id)
        .eq("provider_offering_id", poId)
        .limit(1),
      "Failed to check existing reviews",
    );

    const hasReviewed = existing.length > 0;

    return success({
      can_review: hasPaidOrder && !hasReviewed,
      has_reviewed: hasReviewed,
      ...(hasReviewed && existing[0] ? { review_id: existing[0].id } : {}),
    });
  }, "GET /api/offerings/[id]/can-review");
}
