import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/response";
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
      const { searchParams: sp } = new URL(request.url);
      const dSearch = sp.get("search")?.toLowerCase() || "";
      const dEmail = sp.get("email")?.toLowerCase() || "";
      const dName = sp.get("name")?.toLowerCase() || "";
      const dRole = sp.get("role") || "";
      const dDept = sp.get("department") || "";
      const dGrade = sp.get("grade") || "";
      const dPage = Math.max(1, parseInt(sp.get("page") || "1", 10));
      const dPerPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") || "20", 10)));

      const { DEMO_USERS_LIST } = await import("@/lib/demo-data");
      type DemoUser = (typeof DEMO_USERS_LIST)[number];
      let items: DemoUser[] = [...DEMO_USERS_LIST];

      if (dSearch) {
        items = items.filter((u) =>
          u.email.toLowerCase().includes(dSearch) ||
          (u.full_name ?? "").toLowerCase().includes(dSearch)
        );
      }
      if (dEmail) {
        items = items.filter((u) => u.email.toLowerCase().includes(dEmail));
      }
      if (dName) {
        items = items.filter((u) => (u.full_name ?? "").toLowerCase().includes(dName));
      }
      if (dRole) {
        const vals = dRole.split(",");
        items = items.filter((u) => vals.includes(u.role));
      }
      if (dDept) {
        const vals = dDept.split(",");
        items = items.filter((u) => vals.includes((u as unknown as Record<string, unknown>).department as string ?? ""));
      }
      if (dGrade) {
        const vals = dGrade.split(",");
        items = items.filter((u) => vals.includes((u as unknown as Record<string, unknown>).grade as string ?? ""));
      }

      const dSortBy = sp.get("sort_by") || "";
      const dSortDir = sp.get("sort_dir") || "asc";
      if (dSortBy) {
        const cmp = new Intl.Collator("ru", { sensitivity: "base" }).compare;
        const dir = dSortDir === "desc" ? -1 : 1;
        items.sort((a, b) => {
          const av = String((a as unknown as Record<string, unknown>)[dSortBy] ?? "");
          const bv = String((b as unknown as Record<string, unknown>)[dSortBy] ?? "");
          return cmp(av, bv) * dir;
        });
      }

      const total = items.length;
      const offset = (dPage - 1) * dPerPage;
      const paginated = items.slice(offset, offset + dPerPage);
      return NextResponse.json({
        data: paginated,
        meta: { page: dPage, per_page: dPerPage, total },
      });
    }

    const appUser = await requireRole("admin");
    const tenantId = appUser.tenant_id;
    const admin = createAdminClient();

    // --- Parse query parameters ---
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const roleFilter = searchParams.get("role");
    const sortBy = searchParams.get("sort_by") || "";
    const sortDir = searchParams.get("sort_dir") || "asc";
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

    // --- Apply sort ---
    if (sortBy) {
      const dir = sortDir === "desc" ? -1 : 1;
      const cmp = new Intl.Collator("ru", { sensitivity: "base" }).compare;
      filteredUsers.sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[sortBy] ?? "");
        const bv = String((b as unknown as Record<string, unknown>)[sortBy] ?? "");
        return cmp(av, bv) * dir;
      });
    } else {
      filteredUsers.sort((a, b) => b.created_at.localeCompare(a.created_at));
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
