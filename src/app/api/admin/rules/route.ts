import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createRuleSchema = z.object({
  benefit_id: z.string().uuid("Invalid benefit_id"),
  conditions: z.record(z.string(), z.unknown()).optional().default({}),
});

// ---------------------------------------------------------------------------
// GET /api/admin/rules — List eligibility rules, optionally filtered by benefit_id
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const { DEMO_RULES } = await import("@/lib/demo-data");
      return NextResponse.json({ data: DEMO_RULES });
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
            message: "Only admin users can manage eligibility rules",
          },
        },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // --- Parse query parameters ---
    const { searchParams } = new URL(request.url);
    const benefitId = searchParams.get("benefit_id");

    // --- Build query: rules with benefit name ---
    let query = admin
      .from("eligibility_rules")
      .select("*, benefits(name)")
      .eq("tenant_id", appUser.tenant_id);

    if (benefitId) {
      query = query.eq("benefit_id", benefitId);
    }

    const { data: rawRules, error: rulesError } = await query.order("benefit_id", {
      ascending: true,
    });

    if (rulesError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: "Failed to fetch eligibility rules",
          },
        },
        { status: 500 }
      );
    }

    // Shape response: rename benefits -> benefit
    const data = (rawRules ?? []).map((r) => {
      const { benefits, ...rest } = r as Record<string, unknown> & {
        benefits: { name: string } | null;
      };
      return {
        ...rest,
        benefit: benefits,
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/admin/rules] Unexpected error:", err);
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
// POST /api/admin/rules — Create an eligibility rule
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
            message: "Only admin users can create eligibility rules",
          },
        },
        { status: 403 }
      );
    }

    // --- Parse and validate body ---
    const body = await request.json();
    const validation = createRuleSchema.safeParse(body);

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

    const { benefit_id, conditions } = validation.data;
    const admin = createAdminClient();

    // --- Create rule ---
    const { data: rule, error: createError } = await admin
      .from("eligibility_rules")
      .insert({
        tenant_id: appUser.tenant_id,
        benefit_id,
        conditions,
      } as never)
      .select("*, benefits(name)")
      .single();

    if (createError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to create rule: ${createError.message}`,
          },
        },
        { status: 500 }
      );
    }

    // Shape response
    const { benefits, ...rest } = rule as Record<string, unknown> & {
      benefits: { name: string } | null;
    };

    return NextResponse.json(
      { data: { ...rest, benefit: benefits } },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/admin/rules] Unexpected error:", err);
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
