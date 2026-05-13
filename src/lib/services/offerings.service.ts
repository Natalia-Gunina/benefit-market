import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "@/lib/errors";

export type OfferingRow = Record<string, unknown> & {
  id: string;
  provider_offering_id: string;
  tenant_id: string;
  custom_price_points: number | null;
  tenant_stock_limit: number | null;
  is_active: boolean;
  effective_price: number;
  provider_offerings: Record<string, unknown> & {
    name: string;
    description: string;
    base_price_points: number;
    stock_limit: number | null;
    is_stackable: boolean;
    format: "online" | "offline";
    cities: string[] | null;
    avg_rating: number | null;
    review_count: number | null;
    providers: { id: string; name: string; logo_url: string | null } | null;
    global_categories: { name: string; icon: string } | null;
  } | null;
};

// Fetches active, non-restricted tenant_offerings for a tenant, joined with
// provider_offerings/providers/global_categories. Computes effective_price.
// Used by /api/offerings and by the recommendations service.
export async function getActiveOfferingsForTenant(
  admin: SupabaseClient,
  tenantId: string,
): Promise<OfferingRow[]> {
  const restrictionsResult = await admin
    .from("benefit_restrictions")
    .select("provider_offering_id")
    .eq("tenant_id", tenantId);
  const restrictedIds = (restrictionsResult.data ?? []).map(
    (r) => (r as { provider_offering_id: string }).provider_offering_id,
  );

  let query = admin
    .from("tenant_offerings")
    .select(
      "*, provider_offerings!inner(*, providers(id, name, logo_url), global_categories(name, icon))",
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("provider_offerings.status", "published");

  if (restrictedIds.length > 0) {
    query = query.not(
      "provider_offering_id",
      "in",
      `(${restrictedIds.join(",")})`,
    );
  }

  const result = await query.order("enabled_at", { ascending: false });
  if (result.error) throw dbError(result.error.message);

  const rows = (result.data ?? []) as OfferingRow[];
  return rows.map((to) => {
    const po = to.provider_offerings;
    const customPrice = to.custom_price_points;
    const basePrice = po?.base_price_points;
    return {
      ...to,
      effective_price: customPrice ?? basePrice ?? 0,
    };
  });
}
