import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle } from "@/lib/supabase/typed-queries";
import { updateGlobalCategorySchema } from "@/lib/api/validators";
import { notFound, validationError } from "@/lib/errors";
import type { GlobalCategory } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/global-categories/[id]
export function PATCH(request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) return success({ id, name: "Updated Category" });

    await requireRole("admin");
    const admin = createAdminClient();

    const body = await request.json();
    const data = parseBody(updateGlobalCategorySchema, body);

    const updated = unwrapSingle<GlobalCategory>(
      await admin
        .from("global_categories")
        .update(data as never)
        .eq("id", id)
        .select("*")
        .single(),
      "Failed to update global category",
    );

    return success(updated);
  }, "PATCH /api/admin/global-categories/[id]");
}

// DELETE /api/admin/global-categories/[id]
export function DELETE(_request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) return success({ deleted: true });

    await requireRole("admin");
    const admin = createAdminClient();

    // Check no offerings are using this category
    const countResult = await admin
      .from("provider_offerings")
      .select("id", { count: "exact", head: true })
      .eq("global_category_id", id);

    if (countResult.count && countResult.count > 0) {
      throw validationError("Нельзя удалить категорию с привязанными предложениями");
    }

    const deleteResult = await admin
      .from("global_categories")
      .delete()
      .eq("id", id);

    if (deleteResult.error) throw notFound("Категория не найдена");

    return success({ deleted: true });
  }, "DELETE /api/admin/global-categories/[id]");
}
