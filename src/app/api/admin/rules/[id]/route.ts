import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updateRuleSchema = z.object({
  conditions: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/rules/[id] — Update eligibility rule conditions
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ruleId } = await params;
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
            message: "Only admin users can update eligibility rules",
          },
        },
        { status: 403 }
      );
    }

    // --- Parse and validate body ---
    const body = await request.json();
    const validation = updateRuleSchema.safeParse(body);

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

    const { conditions } = validation.data;
    const admin = createAdminClient();

    // --- Update rule (scoped to tenant) ---
    const { data: rule, error: updateError } = await admin
      .from("eligibility_rules")
      .update({ conditions } as never)
      .eq("id", ruleId)
      .eq("tenant_id", appUser.tenant_id)
      .select("*, benefits(name)")
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to update rule: ${updateError.message}`,
          },
        },
        { status: 500 }
      );
    }

    if (!rule) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Eligibility rule not found",
          },
        },
        { status: 404 }
      );
    }

    // Shape response
    const { benefits, ...rest } = rule as Record<string, unknown> & {
      benefits: { name: string } | null;
    };

    return NextResponse.json({ data: { ...rest, benefit: benefits } });
  } catch (err) {
    console.error("[PATCH /api/admin/rules/[id]] Unexpected error:", err);
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
// DELETE /api/admin/rules/[id] — Hard delete the eligibility rule
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ruleId } = await params;
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
            message: "Only admin users can delete eligibility rules",
          },
        },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // --- Hard delete rule (scoped to tenant) ---
    const { error: deleteError } = await admin
      .from("eligibility_rules")
      .delete()
      .eq("id", ruleId)
      .eq("tenant_id", appUser.tenant_id);

    if (deleteError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to delete rule: ${deleteError.message}`,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { id: ruleId, deleted: true } });
  } catch (err) {
    console.error("[DELETE /api/admin/rules/[id]] Unexpected error:", err);
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
