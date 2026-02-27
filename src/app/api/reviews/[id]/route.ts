import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { updateReviewSchema } from "@/lib/api/validators";
import { notFound, forbidden } from "@/lib/errors";
import type { Review } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

type ReviewOwnerCheck = { id: string; user_id: string };

// PATCH /api/reviews/[id] — update own review
export function PATCH(request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) return success({ id, rating: 4 });

    const appUser = await requireAuth();
    const admin = createAdminClient();

    const review = unwrapSingleOrNull<ReviewOwnerCheck>(
      await admin
        .from("reviews")
        .select("id, user_id")
        .eq("id", id)
        .single(),
    );

    if (!review) throw notFound("Отзыв не найден");
    if (review.user_id !== appUser.id) throw forbidden("Можно редактировать только свои отзывы");

    const body = await request.json();
    const data = parseBody(updateReviewSchema, body);

    const updated = unwrapSingle<Review>(
      await admin
        .from("reviews")
        .update(data as never)
        .eq("id", id)
        .select("*")
        .single(),
      "Failed to update review",
    );

    return success(updated);
  }, "PATCH /api/reviews/[id]");
}

// DELETE /api/reviews/[id] — delete own review
export function DELETE(_request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) return success({ deleted: true });

    const appUser = await requireAuth();
    const admin = createAdminClient();

    const review = unwrapSingleOrNull<ReviewOwnerCheck>(
      await admin
        .from("reviews")
        .select("id, user_id")
        .eq("id", id)
        .single(),
    );

    if (!review) throw notFound("Отзыв не найден");
    if (review.user_id !== appUser.id) throw forbidden("Можно удалить только свои отзывы");

    await admin.from("reviews").delete().eq("id", id);

    return success({ deleted: true });
  }, "DELETE /api/reviews/[id]");
}
