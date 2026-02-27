import { withErrorHandling, success } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/supabase/typed-queries";
import { requireAuth } from "@/lib/api/auth";

export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_GLOBAL_CATEGORIES } = await import("@/lib/demo-data");
      return success(DEMO_GLOBAL_CATEGORIES ?? []);
    }

    await requireAuth();
    const admin = createAdminClient();

    type CategoryRow = { id: string; name: string; icon: string; sort_order: number };
    const categories = unwrapRows<CategoryRow>(
      await admin
        .from("global_categories")
        .select("id, name, icon, sort_order")
        .eq("is_active", true)
        .order("sort_order"),
      "Failed to fetch categories",
    );

    return success(categories);
  }, "GET /api/global-categories");
}
