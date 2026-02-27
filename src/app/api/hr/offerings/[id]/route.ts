import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { updateTenantOfferingSchema } from "@/lib/api/validators";
import { notFound } from "@/lib/errors";
import type { TenantOffering } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/hr/offerings/[id]
export function PATCH(request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) return success({ id, is_active: true });

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    const body = await request.json();
    const data = parseBody(updateTenantOfferingSchema, body);

    const updated = unwrapSingle<TenantOffering>(
      await admin
        .from("tenant_offerings")
        .update(data as never)
        .eq("id", id)
        .eq("tenant_id", appUser.tenant_id)
        .select("*")
        .single(),
      "Failed to update tenant offering",
    );

    return success(updated);
  }, "PATCH /api/hr/offerings/[id]");
}

// DELETE /api/hr/offerings/[id]
export function DELETE(_request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) return success({ deleted: true });

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    const deleted = unwrapSingleOrNull<{ id: string }>(
      await admin
        .from("tenant_offerings")
        .delete()
        .eq("id", id)
        .eq("tenant_id", appUser.tenant_id)
        .select("id")
        .single(),
    );

    if (!deleted) throw notFound("Подключённое предложение не найдено");

    return success({ deleted: true });
  }, "DELETE /api/hr/offerings/[id]");
}
