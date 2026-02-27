import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { notFound } from "@/lib/errors";
import type { TenantOffering } from "@/lib/types";

type RouteContext = { params: Promise<{ offeringId: string }> };

type OfferingDetail = Record<string, unknown> & {
  providers: { id: string; name: string; logo_url: string | null; description: string | null; status: string } | null;
  global_categories: { name: string; icon: string } | null;
};

export function GET(_request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { offeringId } = await context.params;

    if (isDemo) {
      return success({ id: offeringId, name: "Demo Offering", is_enabled: false });
    }

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    const offering = unwrapSingle<OfferingDetail>(
      await admin
        .from("provider_offerings")
        .select("*, providers(id, name, logo_url, description, status), global_categories(name, icon)")
        .eq("id", offeringId)
        .eq("status", "published")
        .single(),
      "Предложение не найдено",
    );

    // Check if already enabled
    const tenantOffering = unwrapSingleOrNull<TenantOffering>(
      await admin
        .from("tenant_offerings")
        .select("*")
        .eq("tenant_id", appUser.tenant_id)
        .eq("provider_offering_id", offeringId)
        .single(),
    );

    return success({
      ...offering,
      is_enabled: !!tenantOffering,
      tenant_offering: tenantOffering ?? null,
    });
  }, "GET /api/hr/marketplace/[offeringId]");
}
