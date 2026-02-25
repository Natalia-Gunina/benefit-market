import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updateUserRoleSchema = z.object({
  role: z.enum(["employee", "hr", "admin"], {
    message: "Role must be one of: employee, hr, admin",
  }),
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/[id] — Change user role
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
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
            message: "Only admin users can change user roles",
          },
        },
        { status: 403 }
      );
    }

    // --- Prevent self-demotion ---
    if (userId === appUser.id) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Cannot change your own role",
          },
        },
        { status: 403 }
      );
    }

    // --- Parse and validate body ---
    const body = await request.json();
    const validation = updateUserRoleSchema.safeParse(body);

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

    const { role } = validation.data;
    const admin = createAdminClient();

    // --- Update user role (scoped to tenant) ---
    const { data: updatedUser, error: updateError } = await admin
      .from("users")
      .update({ role } as never)
      .eq("id", userId)
      .eq("tenant_id", appUser.tenant_id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to update user role: ${updateError.message}`,
          },
        },
        { status: 500 }
      );
    }

    if (!updatedUser) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "User not found in this tenant",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updatedUser });
  } catch (err) {
    console.error("[PATCH /api/admin/users/[id]] Unexpected error:", err);
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
