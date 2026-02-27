import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle } from "@/lib/supabase/typed-queries";
import { notFound } from "@/lib/errors";
import type { Provider } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export function POST(request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) return success({ id, status: "suspended" });

    await requireRole("admin");
    const admin = createAdminClient();

    const { data: provider } = await admin
      .from("providers")
      .select("id")
      .eq("id", id)
      .single();

    if (!provider) throw notFound("Провайдер не найден");

    const body = await request.json().catch(() => ({}));

    const updated = unwrapSingle<Provider>(
      await admin
        .from("providers")
        .update({
          status: "suspended",
          rejection_reason: body.reason || null,
        } as never)
        .eq("id", id)
        .select("*")
        .single(),
      "Failed to suspend provider",
    );

    return success(updated);
  }, "POST /api/admin/providers/[id]/suspend");
}
