import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/api/auth";
import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { unwrapRows, unwrapRowsSoft } from "@/lib/supabase/typed-queries";
import { demoEmployeesList } from "@/lib/demo/demo-service";
import { fetchInitialLimits, fetchActiveWalletBalances } from "@/lib/services/accrual.service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User, EmployeeProfile } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmployeeWithProfile {
  id: string;
  email: string;
  role: string;
  created_at: string;
  profile: {
    grade: string;
    grade_numeric: number | null;
    tenure_months: number;
    hire_date: string | null;
    location: string;
    legal_entity: string;
    extra: Record<string, unknown>;
  } | null;
  wallet: {
    balance: number;
    reserved: number;
  } | null;
  initial_limit: number;
  remaining_balance: number;
  name: string;
}

// ---------------------------------------------------------------------------
// GET /api/hr/employees — paginated employee list with profile + wallet
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) return demoEmployeesList();

    const appUser = await requireRole("hr", "admin");
    const tenantId = appUser.tenant_id;
    const supabase = await createClient();

    // --- Parse query parameters ---
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get("per_page") || "20", 10))
    );

    // The employees tab is driven by employee_profiles, not by user role: HR/admin
    // users can also have profiles that exist purely to populate dashboards and
    // analytics. Source the list from profiles, then hydrate user records for
    // names/emails regardless of role.
    const profiles = unwrapRowsSoft<EmployeeProfile>(
      await supabase
        .from("employee_profiles")
        .select("*")
        .eq("tenant_id", tenantId),
    );

    if (profiles.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { page, per_page: perPage, total: 0 },
      });
    }

    const profileUserIds = Array.from(new Set(profiles.map((p) => p.user_id)));

    const usersForProfiles = unwrapRows<User & { full_name: string | null }>(
      await supabase
        .from("users")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("id", profileUserIds),
      "Fetch users for employee profiles",
    );

    const userById = new Map(usersForProfiles.map((u) => [u.id, u]));
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

    function extraFullName(profile: EmployeeProfile): string {
      const extra = profile.extra as Record<string, unknown> | null;
      const v = extra?.full_name;
      return typeof v === "string" ? v.trim() : "";
    }

    function nameFor(user: (User & { full_name: string | null }) | undefined, profile: EmployeeProfile | undefined): string {
      return (
        user?.full_name?.trim() ||
        (profile ? extraFullName(profile) : "") ||
        (user?.email ? user.email.split("@")[0] : "Без имени")
      );
    }

    // Build the combined list (one row per profile), then filter by search.
    let allUsers = profiles.map((profile) => {
      const user = userById.get(profile.user_id);
      return {
        id: profile.user_id,
        email: user?.email ?? "",
        role: user?.role ?? "employee",
        created_at: user?.created_at ?? new Date().toISOString(),
        full_name: nameFor(user, profile),
      };
    });

    if (search) {
      const needle = search.toLowerCase();
      allUsers = allUsers.filter(
        (u) =>
          u.email.toLowerCase().includes(needle) ||
          u.full_name.toLowerCase().includes(needle),
      );
    }

    allUsers.sort((a, b) => b.created_at.localeCompare(a.created_at));

    // --- Sum active wallets (balance/reserved across all non-expired) ---
    const admin = createAdminClient();
    const walletMap = await fetchActiveWalletBalances(admin, tenantId, profileUserIds);

    // --- Compute initial limits via point_ledger (sum of type='accrual') ---
    const initialLimitMap = await fetchInitialLimits(admin, tenantId, profileUserIds);

    // --- Pagination ---
    const total = allUsers.length;
    const offset = (page - 1) * perPage;
    const paginated = allUsers.slice(offset, offset + perPage);

    // --- Shape response ---
    const data: EmployeeWithProfile[] = paginated.map((u) => {
      const profile = profileMap.get(u.id);
      const walletSums = walletMap.get(u.id);
      const initialLimit = initialLimitMap.get(u.id) ?? 0;
      const remaining = walletSums ? walletSums.balance : 0;

      return {
        id: u.id,
        email: u.email,
        role: u.role,
        created_at: u.created_at,
        name: u.full_name,
        profile: profile
          ? {
              grade: profile.grade,
              grade_numeric: profile.grade_numeric,
              tenure_months: profile.tenure_months,
              hire_date: profile.hire_date ?? null,
              location: profile.location,
              legal_entity: profile.legal_entity,
              extra: profile.extra,
            }
          : null,
        wallet: walletSums
          ? { balance: walletSums.balance, reserved: walletSums.reserved }
          : null,
        initial_limit: initialLimit,
        remaining_balance: remaining,
      };
    });

    return NextResponse.json({
      data,
      meta: { page, per_page: perPage, total },
    });
  }, "GET /api/hr/employees");
}
