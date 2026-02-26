import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/api/auth";
import { NextResponse } from "next/server";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { unwrapRows, unwrapRowsSoft } from "@/lib/supabase/typed-queries";
import { demoEmployeesList } from "@/lib/demo/demo-service";
import type { User, EmployeeProfile, Wallet } from "@/lib/types";

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
    tenure_months: number;
    location: string;
    legal_entity: string;
    extra: Record<string, unknown>;
  } | null;
  wallet: {
    balance: number;
    reserved: number;
  } | null;
  name: string;
}

// ---------------------------------------------------------------------------
// GET /api/hr/employees --- Employee list with search and pagination
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
      usersQuery = usersQuery.or(
        `email.ilike.%${search}%`
      );
    }

    const allUsers = unwrapRows<User>(
      await usersQuery.order("created_at", { ascending: false }),
      "Fetch tenant employees",
    );

    if (allUsers.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { page, per_page: perPage, total: 0 },
      });
    }

    // --- Fetch employee profiles for these users ---
    const userIds = allUsers.map((u) => u.id);

    const profiles = unwrapRowsSoft<EmployeeProfile>(
      await supabase
        .from("employee_profiles")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("user_id", userIds),
    );

    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

    // --- Fetch wallets (latest period per user) ---
    const wallets = unwrapRowsSoft<Wallet>(
      await supabase
        .from("wallets")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("user_id", userIds)
        .order("period", { ascending: false }),
    );

    // Group by user_id, take latest (first due to order desc)
    const walletMap = new Map<string, Wallet>();
    for (const w of wallets) {
      if (!walletMap.has(w.user_id)) {
        walletMap.set(w.user_id, w);
      }
    }

    // --- Filter by name in profile extra if search includes name ---
    let filteredUsers = allUsers;
    if (search) {
      const lowerSearch = search.toLowerCase();
      filteredUsers = allUsers.filter((u) => {
        // Check email
        if (u.email.toLowerCase().includes(lowerSearch)) return true;
        // Check name from profile extra
        const profile = profileMap.get(u.id);
        if (profile?.extra) {
          const name = String((profile.extra as Record<string, unknown>).name || "");
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
    const data: EmployeeWithProfile[] = paginated.map((u) => {
      const profile = profileMap.get(u.id);
      const wallet = walletMap.get(u.id);

      // Try to get name from profile extra or auth metadata
      const profileName = profile?.extra
        ? String((profile.extra as Record<string, unknown>).name || "")
        : "";

      return {
        id: u.id,
        email: u.email,
        role: u.role,
        created_at: u.created_at,
        name: profileName || u.email.split("@")[0],
        profile: profile
          ? {
              grade: profile.grade,
              tenure_months: profile.tenure_months,
              location: profile.location,
              legal_entity: profile.legal_entity,
              extra: profile.extra,
            }
          : null,
        wallet: wallet
          ? {
              balance: wallet.balance,
              reserved: wallet.reserved,
            }
          : null,
      };
    });

    return NextResponse.json({
      data,
      meta: { page, per_page: perPage, total },
    });
  }, "GET /api/hr/employees");
}
