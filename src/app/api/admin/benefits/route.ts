import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createBenefitSchema = z.object({
  name: z.string().min(1, "Benefit name is required").max(255),
  description: z.string().optional().default(""),
  category_id: z.string().uuid("Invalid category_id"),
  price_points: z.number().int().min(0, "price_points must be >= 0"),
  stock_limit: z.number().int().min(0).nullable().optional().default(null),
  is_active: z.boolean().optional().default(true),
  tenant_id: z.string().uuid("Invalid tenant_id"),
});

// ---------------------------------------------------------------------------
// GET /api/admin/benefits — List all benefits (including inactive)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const { DEMO_BENEFITS, DEMO_CATEGORIES } = await import("@/lib/demo-data");
      const categoryMap = new Map(DEMO_CATEGORIES.map((c) => [c.id, c]));
      const data = DEMO_BENEFITS.map((b) => {
        const cat = categoryMap.get(b.category_id);
        return { ...b, category: cat ? { name: cat.name, icon: cat.icon } : null };
      });
      return NextResponse.json({ data });
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
            message: "Only admin users can manage benefits",
          },
        },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // --- Parse query parameters ---
    const { searchParams } = new URL(request.url);
    const tenantFilter = searchParams.get("tenant_id");

    // --- Build query: all benefits including inactive, with category name ---
    let query = admin
      .from("benefits")
      .select("*, benefit_categories(name, icon)")
      .order("created_at", { ascending: false });

    // If a specific tenant is requested use it, otherwise scope to admin's tenant
    if (tenantFilter) {
      query = query.eq("tenant_id", tenantFilter);
    } else {
      query = query.eq("tenant_id", appUser.tenant_id);
    }

    const { data: rawBenefits, error: benefitsError } = await query;

    if (benefitsError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: "Failed to fetch benefits",
          },
        },
        { status: 500 }
      );
    }

    // Shape response: rename benefit_categories -> category
    const data = (rawBenefits ?? []).map((b) => {
      const { benefit_categories, ...rest } = b as Record<string, unknown> & {
        benefit_categories: { name: string; icon: string } | null;
      };
      return {
        ...rest,
        category: benefit_categories,
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/admin/benefits] Unexpected error:", err);
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
// POST /api/admin/benefits — Create a new benefit
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      return NextResponse.json({ data: { id: "demo-ben-new", name: "New Benefit", created_at: new Date().toISOString() } }, { status: 201 });
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
            message: "Only admin users can create benefits",
          },
        },
        { status: 403 }
      );
    }

    // --- Parse and validate body ---
    const body = await request.json();
    const validation = createBenefitSchema.safeParse(body);

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

    const {
      name,
      description,
      category_id,
      price_points,
      stock_limit,
      is_active,
      tenant_id,
    } = validation.data;

    const admin = createAdminClient();

    // --- Create benefit ---
    const { data: benefit, error: createError } = await admin
      .from("benefits")
      .insert({
        name,
        description,
        category_id,
        price_points,
        stock_limit,
        is_active,
        tenant_id,
      } as never)
      .select("*, benefit_categories(name, icon)")
      .single();

    if (createError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: `Failed to create benefit: ${createError.message}`,
          },
        },
        { status: 500 }
      );
    }

    // Shape response
    const { benefit_categories, ...rest } = benefit as Record<string, unknown> & {
      benefit_categories: { name: string; icon: string } | null;
    };

    return NextResponse.json(
      { data: { ...rest, category: benefit_categories } },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/admin/benefits] Unexpected error:", err);
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
