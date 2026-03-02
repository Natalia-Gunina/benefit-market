import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/admin/catalog/[id]
// ---------------------------------------------------------------------------

export function PATCH(request: NextRequest, ctx: Params) {
  return withErrorHandling(async () => {
    if (isDemo) return success({ updated: true });

    await requireRole("admin");
    const { id } = await ctx.params;
    const body = await request.json();
    const { source, ...updates } = body as { source: string; [key: string]: unknown };
    const admin = createAdminClient();

    if (source === "internal") {
      const result = await admin
        .from("benefits")
        .update(updates as never)
        .eq("id", id)
        .select("*")
        .single();

      if (result.error) throw notFound("Benefit not found");
      return success(result.data);
    }

    if (source === "provider") {
      const result = await admin
        .from("provider_offerings")
        .update(updates as never)
        .eq("id", id)
        .select("*")
        .single();

      if (result.error) throw notFound("Offering not found");
      return success(result.data);
    }

    throw notFound("Invalid source");
  }, "PATCH /api/admin/catalog/[id]");
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/catalog/[id]
// ---------------------------------------------------------------------------

export function DELETE(request: NextRequest, ctx: Params) {
  return withErrorHandling(async () => {
    if (isDemo) return success({ deleted: true });

    await requireRole("admin");
    const { id } = await ctx.params;
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");
    const admin = createAdminClient();

    if (source === "internal") {
      const result = await admin.from("benefits").delete().eq("id", id);
      if (result.error) throw notFound("Benefit not found");
      return success({ deleted: true });
    }

    if (source === "provider") {
      const result = await admin.from("provider_offerings").delete().eq("id", id);
      if (result.error) throw notFound("Offering not found");
      return success({ deleted: true });
    }

    throw notFound("Invalid source");
  }, "DELETE /api/admin/catalog/[id]");
}
