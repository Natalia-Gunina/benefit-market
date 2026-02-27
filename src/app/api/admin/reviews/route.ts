import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbError } from "@/lib/errors";

type ReviewWithJoins = Record<string, unknown> & {
  users: { email: string } | null;
  provider_offerings: { name: string } | null;
};

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return success({ data: [], meta: { page: 1, per_page: 20, total: 0 } });
    }

    await requireRole("admin");
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
    const offset = (page - 1) * perPage;

    let query = admin
      .from("reviews")
      .select("*, users(email), provider_offerings(name)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    query = query.range(offset, offset + perPage - 1);

    const result = await query;
    if (result.error) throw dbError(result.error.message);

    const data = (result.data ?? []) as ReviewWithJoins[];

    return success({
      data,
      meta: { page, per_page: perPage, total: result.count ?? 0 },
    });
  }, "GET /api/admin/reviews");
}
