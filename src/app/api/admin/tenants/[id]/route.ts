import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  domain: z.string().max(255).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/tenants/[id] — Update tenant settings
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
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
            message: "Only admin users can update tenants",
          },
        },
        { status: 403 }
      );
    }

    // --- Parse and validate body ---
    const body = await request.json();
    const validation = updateTenantSchema.safeParse(body);

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

    // --- Update tenant ---
    const { data: tenant, error: updateError } = await admin
      .from("tenants")
      .update(updates as never)
      .eq("id", tenantId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to update tenant: ${updateError.message}`,
          },
        },
        { status: 500 }
      );
    }

    if (!tenant) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Tenant not found",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: tenant });
  } catch (err) {
    console.error("[PATCH /api/admin/tenants/[id]] Unexpected error:", err);
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
