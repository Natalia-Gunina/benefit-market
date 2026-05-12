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
      100,
      Math.max(1, parseInt(searchParams.get("per_page") || "20", 10))
    );

    // --- Fetch all users for this tenant with role=employee ---
    let usersQuery = supabase
      .from("users")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("role", "employee");

    if (search) {
      const escaped = search.replace(/[%,]/g, "\\$&");
      usersQuery = usersQuery.or(
        `email.ilike.%${escaped}%,full_name.ilike.%${escaped}%`,
      );
    }

    const allUsers = unwrapRows<User & { full_name: string }>(
      await usersQuery.order("created_at", { ascending: false }),
      "Fetch tenant employees",
    );

    if (allUsers.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { page, per_page: perPage, total: 0 },
      });
    }

    // --- Fetch employee profiles ---
    const userIds = allUsers.map((u) => u.id);

    const profiles = unwrapRowsSoft<EmployeeProfile>(
      await supabase
        .from("employee_profiles")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("user_id", userIds),
    );

    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

    // --- Sum active wallets (balance/reserved across all non-expired) ---
    const admin = createAdminClient();
    const walletMap = await fetchActiveWalletBalances(admin, tenantId, userIds);

    // --- Compute initial limits via point_ledger (sum of type='accrual') ---
    const initialLimitMap = await fetchInitialLimits(admin, tenantId, userIds);

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
        name: u.full_name?.trim() || u.email.split("@")[0],
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
