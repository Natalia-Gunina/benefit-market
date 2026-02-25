import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

export async function GET(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const { DEMO_EMPLOYEES } = await import("@/lib/demo-data");
      const data: EmployeeWithProfile[] = DEMO_EMPLOYEES.map((emp) => ({
        id: emp.user.id,
        email: emp.user.email,
        role: emp.user.role,
        created_at: emp.user.created_at,
        name: emp.full_name,
        profile: {
          grade: emp.profile.grade,
          tenure_months: emp.profile.tenure_months,
          location: emp.profile.location,
          legal_entity: emp.profile.legal_entity,
          extra: emp.profile.extra,
        },
        wallet: { balance: 45000, reserved: 0 },
      }));
      return NextResponse.json({ data, meta: { page: 1, per_page: 20, total: data.length } });
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

    // --- Role check: hr or admin only ---
    if (appUser.role !== "hr" && appUser.role !== "admin") {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only HR or admin users can view employees",
          },
        },
        { status: 403 }
      );
    }

    const tenantId = appUser.tenant_id;

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

    const { data: rawUsers, error: usersError } = await usersQuery
      .order("created_at", { ascending: false });

    if (usersError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: "Failed to fetch users",
          },
        },
        { status: 500 }
      );
    }

    const allUsers = (rawUsers ?? []) as unknown as User[];

    if (allUsers.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { page, per_page: perPage, total: 0 },
      });
    }

    // --- Fetch employee profiles for these users ---
    const userIds = allUsers.map((u) => u.id);

    const { data: rawProfiles } = await supabase
      .from("employee_profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds);

    const profiles = (rawProfiles ?? []) as unknown as EmployeeProfile[];
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

    // --- Fetch wallets (latest period per user) ---
    const { data: rawWallets } = await supabase
      .from("wallets")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds)
      .order("period", { ascending: false });

    const wallets = (rawWallets ?? []) as unknown as Wallet[];

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
  } catch (err) {
    console.error("[GET /api/hr/employees] Unexpected error:", err);
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
