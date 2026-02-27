import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { notFound } from "@/lib/errors";
import type { ProviderOffering } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/offerings/[id] — approve / reject / archive
export function PATCH(request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) return success({ id, status: "published" });

    await requireRole("admin");
    const admin = createAdminClient();

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) updateData.status = body.status;

    const existing = unwrapSingleOrNull<{ id: string }>(
      await admin
        .from("provider_offerings")
        .select("id")
        .eq("id", id)
        .single(),
    );

    if (!existing) throw notFound("Предложение не найдено");

    const updated = unwrapSingle<ProviderOffering>(
      await admin
        .from("provider_offerings")
        .update(updateData as never)
        .eq("id", id)
        .select("*")
        .single(),
      "Failed to update offering",
    );

    return success(updated);
  }, "PATCH /api/admin/offerings/[id]");
}
