import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { notFound, invalidStatus } from "@/lib/errors";
import type { Provider } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

type ProviderCheck = { id: string; status: string };

export function POST(_request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) return success({ id, status: "verified" });

    const appUser = await requireRole("admin");
    const admin = createAdminClient();

    const provider = unwrapSingleOrNull<ProviderCheck>(
      await admin
        .from("providers")
        .select("id, status")
        .eq("id", id)
        .single(),
    );

    if (!provider) throw notFound("Провайдер не найден");
    if (provider.status !== "pending") {
      throw invalidStatus("Верификация возможна только для провайдеров в статусе pending");
    }

    const updated = unwrapSingle<Provider>(
      await admin
        .from("providers")
        .update({
          status: "verified",
          verified_at: new Date().toISOString(),
          verified_by: appUser.id,
        } as never)
        .eq("id", id)
        .select("*")
        .single(),
      "Failed to verify provider",
    );

    return success(updated);
  }, "POST /api/admin/providers/[id]/verify");
}
