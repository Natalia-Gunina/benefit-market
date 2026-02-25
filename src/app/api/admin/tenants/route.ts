import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createTenantSchema = z.object({
  name: z.string().min(1, "Tenant name is required").max(255),
  domain: z.string().max(255).optional().default(""),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
});

// ---------------------------------------------------------------------------
// GET /api/admin/tenants — List all tenants with employee count
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const { DEMO_TENANT } = await import("@/lib/demo-data");
      return NextResponse.json({ data: [{ ...DEMO_TENANT, user_count: 8 }] });
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
            message: "Only admin users can manage tenants",
          },
        },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // --- Fetch all tenants ---
    const { data: tenants, error: tenantsError } = await admin
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (tenantsError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: "Failed to fetch tenants",
          },
        },
        { status: 500 }
      );
    }

    // --- Get user counts per tenant ---
    const { data: userCounts, error: countError } = await admin
      .from("users")
      .select("tenant_id");

    if (countError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: "Failed to fetch user counts",
          },
        },
        { status: 500 }
      );
    }

    // Build a count map
    const countMap = new Map<string, number>();
    for (const row of userCounts ?? []) {
      const tid = (row as { tenant_id: string }).tenant_id;
      countMap.set(tid, (countMap.get(tid) ?? 0) + 1);
    }

    // --- Shape response ---
    type TenantRow = { id: string; name: string; domain: string; settings: Record<string, unknown>; created_at: string };
    const data = ((tenants ?? []) as unknown as TenantRow[]).map((t) => ({
      ...t,
      user_count: countMap.get(t.id) ?? 0,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/admin/tenants] Unexpected error:", err);
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

// ---------------------------------------------------------------------------
// POST /api/admin/tenants — Create a new tenant
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      return NextResponse.json({ data: { id: "demo-tenant-new", name: "New Tenant", created_at: new Date().toISOString() } }, { status: 201 });
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
            message: "Only admin users can create tenants",
          },
        },
        { status: 403 }
      );
    }

    // --- Parse and validate body ---
    const body = await request.json();
    const validation = createTenantSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: validation.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          },
        },
        { status: 400 }
      );
    }

    const { name, domain, settings } = validation.data;
    const admin = createAdminClient();

    // --- Create tenant ---
    const { data: tenant, error: createError } = await admin
      .from("tenants")
      .insert({ name, domain, settings } as never)
      .select("*")
      .single();

    if (createError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to create tenant: ${createError.message}`,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: tenant }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/tenants] Unexpected error:", err);
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
