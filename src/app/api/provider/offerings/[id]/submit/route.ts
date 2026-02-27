import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { notFound, providerNotFound, forbidden, invalidStatus } from "@/lib/errors";
import type { ProviderOffering } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

// Explicit row types for Supabase query results
type ProviderIdRow = Record<string, unknown> & { id: string };
type OfferingStatusRow = Record<string, unknown> & { id: string; provider_id: string; status: string };

// ---------------------------------------------------------------------------
// POST /api/provider/offerings/[id]/submit — submit for review (draft → pending_review)
// ---------------------------------------------------------------------------

export function POST(_request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) {
      return success({ id, status: "pending_review" });
    }

    const appUser = await requireRole("provider", "admin");
    const admin = createAdminClient();

    const provider = unwrapSingleOrNull<ProviderIdRow>(
      await admin
        .from("providers")
        .select("id")
        .eq("owner_user_id", appUser.id)
        .single(),
    );

    if (!provider) throw providerNotFound();

    const offering = unwrapSingleOrNull<OfferingStatusRow>(
      await admin
        .from("provider_offerings")
        .select("id, provider_id, status")
        .eq("id", id)
        .single(),
    );

    if (!offering) throw notFound("Предложение не найдено");
    if (offering.provider_id !== provider.id) throw forbidden();
    if (offering.status !== "draft") {
      throw invalidStatus("Можно отправить на модерацию только предложения в статусе draft");
    }

    const updated = unwrapSingle<ProviderOffering>(
      await admin
        .from("provider_offerings")
        .update({ status: "pending_review" } as never)
        .eq("id", id)
        .select("*")
        .single(),
      "Failed to submit offering",
    );

    return success(updated);
  }, "POST /api/provider/offerings/[id]/submit");
}
