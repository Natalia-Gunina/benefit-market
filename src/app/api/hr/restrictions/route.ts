import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OfferingRow = {
  id: string;
  name: string;
  description: string;
  base_price_points: number;
  is_stackable: boolean;
  status: string;
  global_categories: { name: string; icon: string } | null;
  providers: { name: string } | null;
};

type RestrictionItem = {
  id: string;
  name: string;
  description: string;
  price_points: number;
  category_name: string;
  provider_name: string;
  is_restricted: boolean;
};

// ---------------------------------------------------------------------------
// GET /api/hr/restrictions — list all offerings with restriction status
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_PROVIDER_OFFERINGS, DEMO_PROVIDERS, DEMO_GLOBAL_CATEGORIES, DEMO_BENEFIT_RESTRICTIONS } = await import("@/lib/demo-data");
      const providerMap = new Map((DEMO_PROVIDERS ?? []).map((p) => [p.id, p]));
      const catMap = new Map((DEMO_GLOBAL_CATEGORIES ?? []).map((c) => [c.id, c]));
      const restrictedSet = new Set((DEMO_BENEFIT_RESTRICTIONS ?? []).map((r) => r.provider_offering_id));

      const items: RestrictionItem[] = (DEMO_PROVIDER_OFFERINGS ?? [])
        .filter((po) => po.status === "published")
        .map((po) => ({
          id: po.id,
          name: po.name,
          description: po.description,
          price_points: po.base_price_points,
          category_name: catMap.get(po.global_category_id ?? "")?.name ?? "—",
          provider_name: providerMap.get(po.provider_id)?.name ?? "—",
          is_restricted: restrictedSet.has(po.id),
        }));

      return success(items);
    }

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    // Fetch all published offerings
    const offeringsResult = await admin
      .from("provider_offerings")
      .select("id, name, description, base_price_points, is_stackable, status, global_categories(name, icon), providers(name)")
      .eq("status", "published")
      .order("name");

    if (offeringsResult.error) throw dbError(offeringsResult.error.message);
    const offerings = (offeringsResult.data ?? []) as unknown as OfferingRow[];

    // Fetch restrictions for this tenant
    const restrictionsResult = await admin
      .from("benefit_restrictions")
      .select("provider_offering_id")
      .eq("tenant_id", appUser.tenant_id);

    if (restrictionsResult.error) throw dbError(restrictionsResult.error.message);
    const restrictedIds = new Set(
      (restrictionsResult.data ?? []).map((r) => (r as { provider_offering_id: string }).provider_offering_id),
    );

    const items: RestrictionItem[] = offerings.map((o) => ({
      id: o.id,
      name: o.name,
      description: o.description,
      price_points: o.base_price_points,
      category_name: o.global_categories?.name ?? "—",
      provider_name: o.providers?.name ?? "—",
      is_restricted: restrictedIds.has(o.id),
    }));

    return success(items);
  }, "GET /api/hr/restrictions");
}

// ---------------------------------------------------------------------------
// POST /api/hr/restrictions — toggle restriction
// ---------------------------------------------------------------------------

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return success({ ok: true });
    }

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();
    const body = await request.json();
    const { provider_offering_id, restricted } = body as {
      provider_offering_id: string;
      restricted: boolean;
    };

    if (restricted) {
      // Add restriction
      await admin
        .from("benefit_restrictions")
        .upsert(
          {
            tenant_id: appUser.tenant_id,
            provider_offering_id,
            restricted_by: appUser.id,
          } as never,
          { onConflict: "tenant_id,provider_offering_id" },
        );
    } else {
      // Remove restriction
      await admin
        .from("benefit_restrictions")
        .delete()
        .eq("tenant_id", appUser.tenant_id)
        .eq("provider_offering_id", provider_offering_id);
    }

    return success({ ok: true });
  }, "POST /api/hr/restrictions");
}
