import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, validationError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_PATCH_FIELDS = new Set([
  "name",
  "description",
  "long_description",
  "base_price_points",
  "stock_limit",
  "is_stackable",
  "status",
  "global_category_id",
  "format",
  "cities",
  "delivery_info",
  "terms_conditions",
]);

// ---------------------------------------------------------------------------
// PATCH /api/admin/catalog/[id]
// ---------------------------------------------------------------------------

export function PATCH(request: NextRequest, ctx: Params) {
  return withErrorHandling(async () => {
    if (isDemo) return success({ updated: true });

    await requireRole("admin");
    const { id } = await ctx.params;
    const body = await request.json();
    const admin = createAdminClient();

    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_PATCH_FIELDS.has(k)) updates[k] = v;
    }

    if (updates.format !== undefined && updates.format !== "online" && updates.format !== "offline") {
      throw validationError("Invalid format value");
    }
    if (updates.format === "offline") {
      const cities = Array.isArray(updates.cities) ? (updates.cities as string[]) : [];
      if (cities.length === 0) {
        throw validationError("Для офлайн-льготы требуется указать хотя бы один город");
      }
    }
    if (updates.format === "online") {
      updates.cities = [];
    }

    const result = await admin
      .from("provider_offerings")
      .update(updates as never)
      .eq("id", id)
      .select("*")
      .single();

    if (result.error) throw notFound("Offering not found");
    return success(result.data);
  }, "PATCH /api/admin/catalog/[id]");
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/catalog/[id]
// ---------------------------------------------------------------------------

export function DELETE(_request: NextRequest, ctx: Params) {
  return withErrorHandling(async () => {
    if (isDemo) return success({ deleted: true });

    await requireRole("admin");
    const { id } = await ctx.params;
    const admin = createAdminClient();

    const result = await admin.from("provider_offerings").delete().eq("id", id);
    if (result.error) throw notFound("Offering not found");
    return success({ deleted: true });
  }, "DELETE /api/admin/catalog/[id]");
}
