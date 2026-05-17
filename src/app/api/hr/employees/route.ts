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
    if (isDemo) {
      const { searchParams: sp } = new URL(request.url);
      const res = await demoEmployeesList();
      const json = await res.json();
      let items = json.data as Record<string, unknown>[];

      const dSearch = sp.get("search")?.toLowerCase() || "";
      const dName = sp.get("name")?.toLowerCase() || "";
      const dEmail = sp.get("email")?.toLowerCase() || "";
      const dGrade = sp.get("grade") || "";
      const dLocation = sp.get("location") || "";
      const dSortBy = sp.get("sort_by") || "";
      const dSortDir = sp.get("sort_dir") || "asc";
      const dPage = Math.max(1, parseInt(sp.get("page") || "1", 10));
      const dPerPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") || "20", 10)));

      if (dSearch) {
        items = items.filter((e) =>
          (e.email as string).toLowerCase().includes(dSearch) ||
          ((e.name as string) ?? "").toLowerCase().includes(dSearch)
        );
      }
      if (dName) {
        items = items.filter((e) => ((e.name as string) ?? "").toLowerCase().includes(dName));
      }
      if (dEmail) {
        items = items.filter((e) => (e.email as string).toLowerCase().includes(dEmail));
      }
      if (dGrade) {
        const vals = dGrade.split(",");
        items = items.filter((e) => {
          const p = e.profile as Record<string, unknown> | null;
          return p && vals.includes(p.grade as string);
        });
      }
      if (dLocation) {
        const vals = dLocation.split(",");
        items = items.filter((e) => {
          const p = e.profile as Record<string, unknown> | null;
          return p && vals.includes(p.location as string);
        });
      }

      // Number range filters: key=min~max
      const NUMERIC_FIELDS = ["tenure", "initial_limit", "remaining_balance"];
      for (const nf of NUMERIC_FIELDS) {
        const raw = sp.get(nf) || "";
        if (!raw) continue;
        const [minStr, maxStr] = raw.split("~");
        const min = minStr ? Number(minStr) : null;
        const max = maxStr ? Number(maxStr) : null;
        items = items.filter((e) => {
          let val: number;
          if (nf === "tenure") {
            const p = e.profile as Record<string, unknown> | null;
            val = Math.floor(((p?.tenure_months as number) ?? 0) / 12);
          } else {
            val = (e[nf] as number) ?? 0;
          }
          if (min !== null && !isNaN(min) && val < min) return false;
          if (max !== null && !isNaN(max) && val > max) return false;
          return true;
        });
      }

      if (dSortBy) {
        const NUMERIC_SORT = new Set(["initial_limit", "remaining_balance", "tenure", "grade"]);
        const PROFILE_STR = new Set(["location", "legal_entity", "hire_date"]);
        const dir = dSortDir === "desc" ? -1 : 1;

        items.sort((a, b) => {
          const ap = a.profile as Record<string, unknown> | null;
          const bp = b.profile as Record<string, unknown> | null;

          if (dSortBy === "grade") {
            const av = (ap?.grade_numeric as number) ?? 0;
            const bv = (bp?.grade_numeric as number) ?? 0;
            return (av - bv) * dir;
          }
          if (dSortBy === "tenure") {
            const av = (ap?.tenure_months as number) ?? 0;
            const bv = (bp?.tenure_months as number) ?? 0;
            return (av - bv) * dir;
          }
          if (NUMERIC_SORT.has(dSortBy)) {
            const av = (a[dSortBy] as number) ?? 0;
            const bv = (b[dSortBy] as number) ?? 0;
            return (av - bv) * dir;
          }
          if (PROFILE_STR.has(dSortBy)) {
            const av = String(ap?.[dSortBy] ?? "");
            const bv = String(bp?.[dSortBy] ?? "");
            return av.localeCompare(bv, "ru") * dir;
          }
          const av = String(a[dSortBy] ?? "");
          const bv = String(b[dSortBy] ?? "");
          return av.localeCompare(bv, "ru") * dir;
        });
      }

      const total = items.length;
      const offset = (dPage - 1) * dPerPage;
      const paginated = items.slice(offset, offset + dPerPage);
      return NextResponse.json({ data: paginated, meta: { page: dPage, per_page: dPerPage, total } });
    }

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
