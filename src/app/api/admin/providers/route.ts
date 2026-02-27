import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_PROVIDERS } = await import("@/lib/demo-data");
      return success(DEMO_PROVIDERS ?? []);
    }

    await requireRole("admin");
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
    const offset = (page - 1) * perPage;

    let query = admin
      .from("providers")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (search) query = query.ilike("name", `%${search}%`);
    query = query.range(offset, offset + perPage - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return success({
      data: data ?? [],
      meta: { page, per_page: perPage, total: count ?? 0 },
    });
  }, "GET /api/admin/providers");
}
