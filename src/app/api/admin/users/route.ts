import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { escapeIlike } from "@/lib/api/sanitize";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/supabase/typed-queries";
import type { User, EmployeeProfile, Wallet } from "@/lib/types";

// ---------------------------------------------------------------------------
// GET /api/admin/users — List users with profiles and wallets
// Query: ?search, ?role, ?page, ?per_page
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_USERS_LIST } = await import("@/lib/demo-data");
      return NextResponse.json({
        data: DEMO_USERS_LIST,
        meta: { page: 1, per_page: 20, total: DEMO_USERS_LIST.length },
      });
    }

    const appUser = await requireRole("admin");
    const tenantId = appUser.tenant_id;
    const admin = createAdminClient();

    // --- Parse query parameters ---
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const roleFilter = searchParams.get("role");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)),
    );

    // --- Build users query ---
    let usersQuery = admin
      .from("users")
      .select("*")
      .eq("tenant_id", tenantId);

    if (roleFilter) {
      usersQuery = usersQuery.eq("role", roleFilter);
    }

    if (search) {
      usersQuery = usersQuery.ilike("email", `%${escapeIlike(search)}%`);
    }

    const usersResult = await usersQuery.order("created_at", { ascending: false });

    const allUsers = unwrapRows<User>(usersResult, "Failed to fetch users");

    if (allUsers.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { page, per_page: perPage, total: 0 },
      });
    }

    // --- Fetch employee profiles for these users ---
    const userIds = allUsers.map((u) => u.id);

    const profilesResult = await admin
      .from("employee_profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds);

    const profiles = unwrapRows<EmployeeProfile>(profilesResult, "Failed to fetch profiles");
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

    // --- Fetch wallets (latest period per user) ---
    const walletsResult = await admin
      .from("wallets")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds)
      .order("period", { ascending: false });

    const wallets = unwrapRows<Wallet>(walletsResult, "Failed to fetch wallets");

    // Group by user_id, take latest (first due to order desc)
    const walletMap = new Map<string, Wallet>();
    for (const w of wallets) {
      if (!walletMap.has(w.user_id)) {
        walletMap.set(w.user_id, w);
      }
    }

    // --- Apply search on profile name as well ---
    let filteredUsers = allUsers;
    if (search) {
      const lowerSearch = search.toLowerCase();
      filteredUsers = allUsers.filter((u) => {
        if (u.email.toLowerCase().includes(lowerSearch)) return true;
        const profile = profileMap.get(u.id);
        if (profile?.extra) {
          const name = String(
            (profile.extra as Record<string, unknown>).name || "",
          );
          if (name.toLowerCase().includes(lowerSearch)) return true;
        }
        return false;
      });
    }

    // --- Apply pagination ---
    const total = filteredUsers.length;
    const offset = (page - 1) * perPage;
    const paginated = filteredUsers.slice(offset, offset + perPage);

    // --- Shape response ---
    const data = paginated.map((u) => {
      const profile = profileMap.get(u.id);
      const wallet = walletMap.get(u.id);

      return {
        id: u.id,
        email: u.email,
        role: u.role,
        created_at: u.created_at,
        profile: profile
          ? {
              id: profile.id,
              grade: profile.grade,
              tenure_months: profile.tenure_months,
              location: profile.location,
              legal_entity: profile.legal_entity,
              extra: profile.extra,
            }
          : null,
        wallet: wallet
          ? {
              id: wallet.id,
              balance: wallet.balance,
              reserved: wallet.reserved,
              period: wallet.period,
              expires_at: wallet.expires_at,
            }
          : null,
      };
    });

    return NextResponse.json({
      data,
      meta: { page, per_page: perPage, total },
    });
  }, "GET /api/admin/users");
}
