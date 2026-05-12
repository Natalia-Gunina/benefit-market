import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRowsSoft } from "@/lib/supabase/typed-queries";

type MyReviewRow = {
  id: string;
  provider_offering_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  created_at: string;
};

// GET /api/reviews/mine — list current user's reviews (optionally filtered by provider_offering_ids)
export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("provider_offering_ids");
    const ids = idsParam
      ? idsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    if (isDemo) {
      const { DEMO_REVIEWS } = await import("@/lib/demo-data");
      // Demo employee is hard-pinned to demo-user-001 (matches /api/orders).
      let mine = DEMO_REVIEWS.filter((r) => r.user_id === "demo-user-001");
      if (ids && ids.length > 0) {
        const set = new Set(ids);
        mine = mine.filter((r) => set.has(r.provider_offering_id));
      }
      return success({
        data: mine.map((r) => ({
          id: r.id,
          provider_offering_id: r.provider_offering_id,
          rating: r.rating,
          title: r.title,
          body: r.body,
          status: r.status,
          created_at: r.created_at,
        })),
      });
    }

    const appUser = await requireAuth();
    const admin = createAdminClient();

    let query = admin
      .from("reviews")
      .select("id, provider_offering_id, rating, title, body, status, created_at")
      .eq("user_id", appUser.id)
      .eq("tenant_id", appUser.tenant_id);

    if (ids && ids.length > 0) {
      query = query.in("provider_offering_id", ids);
    }

    const rows = unwrapRowsSoft<MyReviewRow>(await query);

    return success({ data: rows });
  }, "GET /api/reviews/mine");
}
