import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updatePolicySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  points_amount: z.number().int().min(0).optional(),
  period: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  target_filter: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/policies/[id] — Update a budget policy
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: policyId } = await params;
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
            message: "Only admin users can update policies",
          },
        },
        { status: 403 }
      );
    }

    // --- Parse and validate body ---
    const body = await request.json();
    const validation = updatePolicySchema.safeParse(body);

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

    const updates = validation.data;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "At least one field must be provided for update",
          },
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // --- Update policy (scoped to tenant) ---
    const { data: policy, error: updateError } = await admin
      .from("budget_policies")
      .update(updates as never)
      .eq("id", policyId)
      .eq("tenant_id", appUser.tenant_id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to update policy: ${updateError.message}`,
          },
        },
        { status: 500 }
      );
    }

    if (!policy) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Policy not found",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: policy });
  } catch (err) {
    console.error("[PATCH /api/admin/policies/[id]] Unexpected error:", err);
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
// DELETE /api/admin/policies/[id] — Soft delete (set is_active=false)
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: policyId } = await params;
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
            message: "Only admin users can delete policies",
          },
        },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // --- Soft delete: set is_active = false ---
    const { data: policy, error: deleteError } = await admin
      .from("budget_policies")
      .update({ is_active: false } as never)
      .eq("id", policyId)
      .eq("tenant_id", appUser.tenant_id)
      .select("*")
      .single();

    if (deleteError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to deactivate policy: ${deleteError.message}`,
          },
        },
        { status: 500 }
      );
    }

    if (!policy) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Policy not found",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: policy });
  } catch (err) {
    console.error("[DELETE /api/admin/policies/[id]] Unexpected error:", err);
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
