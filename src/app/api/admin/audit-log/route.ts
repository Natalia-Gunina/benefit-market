import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User, AuditLog } from "@/lib/types";

// ---------------------------------------------------------------------------
// GET /api/admin/audit-log — Audit log entries for tenant
// Query: ?entity_type, ?action, ?user_id, ?from, ?to, ?page, ?per_page
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const { DEMO_AUDIT_LOG } = await import("@/lib/demo-data");
      return NextResponse.json({ data: DEMO_AUDIT_LOG, meta: { page: 1, per_page: 50, total: DEMO_AUDIT_LOG.length } });
    }

    const supabase = await createClient();

    // --- Authenticate user ---
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // --- Get the app-level user record ---
    const { data: rawUser, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", authUser.id)
      .single();

    const appUser = rawUser as User | null;

    if (userError || !appUser) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "User record not found" } },
        { status: 404 }
      );
    }

    // --- Role check: admin only ---
    if (appUser.role !== "admin") {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only admin users can view audit logs",
          },
        },
        { status: 403 }
      );
    }

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
      Math.max(1, parseInt(searchParams.get("per_page") || "50", 10))
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

    const { data: rawLogs, error: logsError, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (logsError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: "Failed to fetch audit logs",
          },
        },
        { status: 500 }
      );
    }

    const logs = (rawLogs ?? []) as unknown as AuditLog[];

    // --- Enrich with user emails ---
    const uniqueUserIds = [...new Set(logs.map((l) => l.user_id))];

    let userEmailMap = new Map<string, string>();

    if (uniqueUserIds.length > 0) {
      const { data: rawUsers } = await admin
        .from("users")
        .select("id, email")
        .in("id", uniqueUserIds);

      const users = (rawUsers ?? []) as unknown as { id: string; email: string }[];
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
  } catch (err) {
    console.error("[GET /api/admin/audit-log] Unexpected error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
