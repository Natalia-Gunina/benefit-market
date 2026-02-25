import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(255),
  icon: z.string().max(100).optional().default(""),
  sort_order: z.number().int().min(0).optional().default(0),
});

// ---------------------------------------------------------------------------
// GET /api/admin/categories — List benefit categories for the tenant
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const { DEMO_CATEGORIES } = await import("@/lib/demo-data");
      return NextResponse.json({ data: DEMO_CATEGORIES });
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
            message: "Only admin users can manage categories",
          },
        },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // --- Fetch categories for the tenant ---
    const { data: categories, error: categoriesError } = await admin
      .from("benefit_categories")
      .select("*")
      .eq("tenant_id", appUser.tenant_id)
      .order("sort_order", { ascending: true });

    if (categoriesError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: "Failed to fetch categories",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: categories ?? [] });
  } catch (err) {
    console.error("[GET /api/admin/categories] Unexpected error:", err);
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
// POST /api/admin/categories — Create a benefit category
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
            message: "Only admin users can create categories",
          },
        },
        { status: 403 }
      );
    }

    // --- Parse and validate body ---
    const body = await request.json();
    const validation = createCategorySchema.safeParse(body);

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

    const { name, icon, sort_order } = validation.data;
    const admin = createAdminClient();

    // --- Create category ---
    const { data: category, error: createError } = await admin
      .from("benefit_categories")
      .insert({
        tenant_id: appUser.tenant_id,
        name,
        icon,
        sort_order,
      } as never)
      .select("*")
      .single();

    if (createError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to create category: ${createError.message}`,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/categories] Unexpected error:", err);
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
