import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { getRecommendationsForUser } from "@/lib/services/recommendations.service";
import type { OfferingRow } from "@/lib/services/offerings.service";

export interface RecommendationsResponse {
  items: (OfferingRow & { reason: string })[];
  source: "llm" | "popular";
}

export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      // In demo mode we don't call OpenAI — return the first few offerings
      // from the demo dataset with a static reason.
      const {
        DEMO_TENANT_OFFERINGS,
        DEMO_PROVIDER_OFFERINGS,
        DEMO_PROVIDERS,
        DEMO_GLOBAL_CATEGORIES,
        DEMO_BENEFIT_RESTRICTIONS,
      } = await import("@/lib/demo-data");

      const offeringMap = new Map(
        (DEMO_PROVIDER_OFFERINGS ?? []).map((o) => [o.id, o]),
      );
      const providerMap = new Map((DEMO_PROVIDERS ?? []).map((p) => [p.id, p]));
      const catMap = new Map(
        (DEMO_GLOBAL_CATEGORIES ?? []).map((c) => [c.id, c]),
      );

      const rows = (DEMO_TENANT_OFFERINGS ?? [])
        .filter(
          (to) =>
            to.is_active &&
            !DEMO_BENEFIT_RESTRICTIONS.has(to.provider_offering_id),
        )
        .map((to) => {
          const po = offeringMap.get(to.provider_offering_id);
          return {
            ...to,
            provider_offerings: po
              ? {
                  ...po,
                  providers: providerMap.get(po.provider_id) ?? null,
                  global_categories:
                    catMap.get(po.global_category_id ?? "") ?? null,
                }
              : null,
            effective_price: to.custom_price_points ?? po?.base_price_points ?? 0,
          };
        })
        .filter((r) => r.provider_offerings?.status === "published")
        .slice(0, 5);

      const items = rows.map((r) => ({
        ...r,
        reason: "Подобрано для демо-режима",
      }));

      return success<RecommendationsResponse>({
        items: items as unknown as RecommendationsResponse["items"],
        source: "popular",
      });
    }

    const appUser = await requireAuth();
    const { items, source } = await getRecommendationsForUser(
      appUser.id,
      appUser.tenant_id,
    );

    return success<RecommendationsResponse>({ items, source });
  }, "GET /api/employee/recommendations");
}
