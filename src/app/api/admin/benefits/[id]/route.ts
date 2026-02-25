import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updateBenefitSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  category_id: z.string().uuid().optional(),
  price_points: z.number().int().min(0).optional(),
  stock_limit: z.number().int().min(0).nullable().optional(),
  is_active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/benefits/[id] — Update a benefit
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: benefitId } = await params;
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
            message: "Only admin users can update benefits",
          },
        },
        { status: 403 }
      );
    }

    // --- Parse and validate body ---
    const body = await request.json();
    const validation = updateBenefitSchema.safeParse(body);

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

    // --- Update benefit ---
    const { data: benefit, error: updateError } = await admin
      .from("benefits")
      .update(updates as never)
      .eq("id", benefitId)
      .select("*, benefit_categories(name, icon)")
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to update benefit: ${updateError.message}`,
          },
        },
        { status: 500 }
      );
    }

    if (!benefit) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Benefit not found",
          },
        },
        { status: 404 }
      );
    }

    // Shape response
    const { benefit_categories, ...rest } = benefit as Record<string, unknown> & {
      benefit_categories: { name: string; icon: string } | null;
    };

    return NextResponse.json({ data: { ...rest, category: benefit_categories } });
  } catch (err) {
    console.error("[PATCH /api/admin/benefits/[id]] Unexpected error:", err);
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
// DELETE /api/admin/benefits/[id] — Soft delete (set is_active=false)
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: benefitId } = await params;
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
            message: "Only admin users can delete benefits",
          },
        },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // --- Soft delete: set is_active = false ---
    const { data: benefit, error: deleteError } = await admin
      .from("benefits")
      .update({ is_active: false } as never)
      .eq("id", benefitId)
      .select("*")
      .single();

    if (deleteError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to deactivate benefit: ${deleteError.message}`,
          },
        },
        { status: 500 }
      );
    }

    if (!benefit) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Benefit not found",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: benefit });
  } catch (err) {
    console.error("[DELETE /api/admin/benefits/[id]] Unexpected error:", err);
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
