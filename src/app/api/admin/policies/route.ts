import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createPolicySchema = z.object({
  name: z.string().min(1, "Policy name is required").max(255),
  points_amount: z.number().int().min(0, "points_amount must be >= 0"),
  period: z.enum(["monthly", "quarterly", "yearly"]).optional().default("quarterly"),
  target_filter: z.record(z.string(), z.unknown()).optional().default({}),
  is_active: z.boolean().optional().default(true),
});

// ---------------------------------------------------------------------------
// GET /api/admin/policies — List all budget policies for tenant
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const { DEMO_POLICIES } = await import("@/lib/demo-data");
      return NextResponse.json({ data: DEMO_POLICIES });
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
            message: "Only admin users can manage policies",
          },
        },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // --- Fetch policies for the tenant ---
    const { data: policies, error: policiesError } = await admin
      .from("budget_policies")
      .select("*")
      .eq("tenant_id", appUser.tenant_id)
      .order("name", { ascending: true });

    if (policiesError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: "Failed to fetch policies",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: policies ?? [] });
  } catch (err) {
    console.error("[GET /api/admin/policies] Unexpected error:", err);
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
// POST /api/admin/policies — Create a budget policy
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
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
            message: "Only admin users can create policies",
          },
        },
        { status: 403 }
      );
    }

    // --- Parse and validate body ---
    const body = await request.json();
    const validation = createPolicySchema.safeParse(body);

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

    const { name, points_amount, period, target_filter, is_active } =
      validation.data;

    const admin = createAdminClient();

    // --- Create policy ---
    const { data: policy, error: createError } = await admin
      .from("budget_policies")
      .insert({
        tenant_id: appUser.tenant_id,
        name,
        points_amount,
        period,
        target_filter,
        is_active,
      } as never)
      .select("*")
      .single();

    if (createError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to create policy: ${createError.message}`,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: policy }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/policies] Unexpected error:", err);
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
