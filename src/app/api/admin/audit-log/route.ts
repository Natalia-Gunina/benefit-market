import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/supabase/typed-queries";
import type { AuditLog } from "@/lib/types";

// ---------------------------------------------------------------------------
// GET /api/admin/audit-log — Audit log entries for tenant
// Query: ?entity_type, ?action, ?user_id, ?from, ?to, ?page, ?per_page
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_AUDIT_LOG } = await import("@/lib/demo-data");
      return NextResponse.json({
        data: DEMO_AUDIT_LOG,
        meta: { page: 1, per_page: 50, total: DEMO_AUDIT_LOG.length },
      });
    }

    const appUser = await requireRole("admin");
    const tenantId = appUser.tenant_id;
    const admin = createAdminClient();

    // --- Parse query parameters ---
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entity_type");
    const action = searchParams.get("action");
    const userId = searchParams.get("user_id");
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("per_page") || "50", 10)),
    );

    // --- Build query ---
    let query = admin
      .from("audit_log")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId);

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    if (action) {
      query = query.eq("action", action);
    }

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (fromDate) {
      query = query.gte("created_at", fromDate);
    }

    if (toDate) {
      query = query.lte("created_at", toDate);
    }

    // Apply pagination
    const offset = (page - 1) * perPage;

    const result = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    const logs = unwrapRows<AuditLog>(result, "Failed to fetch audit logs");
    const count = result.count;

    // --- Enrich with user emails ---
    const uniqueUserIds = [...new Set(logs.map((l) => l.user_id))];

    let userEmailMap = new Map<string, string>();

    if (uniqueUserIds.length > 0) {
      const usersResult = await admin
        .from("users")
        .select("id, email")
        .in("id", uniqueUserIds);

      const users = unwrapRows<{ id: string; email: string }>(
        usersResult,
        "Failed to fetch user emails",
      );
      userEmailMap = new Map(users.map((u) => [u.id, u.email]));
    }

    // --- Shape response ---
    const data = logs.map((log) => ({
      ...log,
      user_email: userEmailMap.get(log.user_id) ?? null,
    }));

    return NextResponse.json({
      data,
      meta: { page, per_page: perPage, total: count ?? 0 },
    });
  }, "GET /api/admin/audit-log");
}
