import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { notFound } from "@/lib/errors";
import type { Review } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/reviews/[id] — moderate (hide/restore)
export function PATCH(request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) return success({ id, status: "hidden" });

    const appUser = await requireRole("admin");
    const admin = createAdminClient();

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) {
      updateData.status = body.status;
      updateData.moderated_by = appUser.id;
      updateData.moderated_at = new Date().toISOString();
    }

    const existing = unwrapSingleOrNull<{ id: string }>(
      await admin
        .from("reviews")
        .select("id")
        .eq("id", id)
        .single(),
    );

    if (!existing) throw notFound("Отзыв не найден");

    const updated = unwrapSingle<Review>(
      await admin
        .from("reviews")
        .update(updateData as never)
        .eq("id", id)
        .select("*")
        .single(),
      "Failed to moderate review",
    );

    return success(updated);
  }, "PATCH /api/admin/reviews/[id]");
}
