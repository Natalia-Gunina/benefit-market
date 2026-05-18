import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { notFound, providerNotFound, validationError } from "@/lib/errors";
import { getInsightsForOffering } from "@/lib/services/review-insights.service";

type ProviderIdRow = { id: string };
type OfferingProviderRow = { id: string; provider_id: string };

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const offeringId = searchParams.get("offering_id")?.trim() ?? "";

    if (!offeringId) {
      throw validationError("offering_id is required");
    }

    if (isDemo) {
      const result = await getInsightsForOffering(offeringId);
      return success(result);
    }

    const appUser = await requireRole("provider", "admin");
    const admin = createAdminClient();

    // Admins can see insights for any offering; providers only their own.
    // Resolving provider.id first lets us tell apart "offering doesn't exist"
    // from "offering belongs to someone else" without leaking either way.
    if (appUser.role !== "admin") {
      const provider = unwrapSingleOrNull<ProviderIdRow>(
        await admin
          .from("providers")
          .select("id")
          .eq("owner_user_id", appUser.id)
          .single(),
      );
      if (!provider) throw providerNotFound();

      const offering = unwrapSingleOrNull<OfferingProviderRow>(
        await admin
          .from("provider_offerings")
          .select("id, provider_id")
          .eq("id", offeringId)
          .single(),
      );
      if (!offering || offering.provider_id !== provider.id) {
        throw notFound("Предложение не найдено");
      }
    }

    const result = await getInsightsForOffering(offeringId);
    return success(result);
  }, "GET /api/provider/analytics/insights");
}
