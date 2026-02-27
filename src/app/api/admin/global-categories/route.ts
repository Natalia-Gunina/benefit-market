import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows, unwrapSingle } from "@/lib/supabase/typed-queries";
import { createGlobalCategorySchema } from "@/lib/api/validators";
import type { GlobalCategory } from "@/lib/types";

// GET /api/admin/global-categories
export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_GLOBAL_CATEGORIES } = await import("@/lib/demo-data");
      return success(DEMO_GLOBAL_CATEGORIES ?? []);
    }

    await requireRole("admin");
    const admin = createAdminClient();

    const data = unwrapRows<GlobalCategory>(
      await admin
        .from("global_categories")
        .select("*")
        .order("sort_order", { ascending: true }),
      "Failed to fetch global categories",
    );

    return success(data);
  }, "GET /api/admin/global-categories");
}

// POST /api/admin/global-categories
export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return created({ id: "demo-gcat-new", name: "New Category" });
    }

    await requireRole("admin");
    const admin = createAdminClient();

    const body = await request.json();
    const data = parseBody(createGlobalCategorySchema, body);

    const category = unwrapSingle<GlobalCategory>(
      await admin
        .from("global_categories")
        .insert(data as never)
        .select("*")
        .single(),
      "Failed to create global category",
    );

    return created(category);
  }, "POST /api/admin/global-categories");
}
