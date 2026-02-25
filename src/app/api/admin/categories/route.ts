import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows, unwrapSingle } from "@/lib/supabase/typed-queries";
import { validationError } from "@/lib/errors";
import { createCategorySchema, updateCategorySchema } from "@/lib/api/validators";
import type { BenefitCategory } from "@/lib/types";

// ---------------------------------------------------------------------------
// GET /api/admin/categories — List benefit categories for the tenant
// ---------------------------------------------------------------------------

export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_CATEGORIES } = await import("@/lib/demo-data");
      return success(DEMO_CATEGORIES);
    }

    const appUser = await requireRole("admin");
    const admin = createAdminClient();

    const result = await admin
      .from("benefit_categories")
      .select("*")
      .eq("tenant_id", appUser.tenant_id)
      .order("sort_order", { ascending: true });

    const categories = unwrapRows<BenefitCategory>(result, "Failed to fetch categories");
    return success(categories);
  }, "GET /api/admin/categories");
}

// ---------------------------------------------------------------------------
// POST /api/admin/categories — Create a benefit category
// ---------------------------------------------------------------------------

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const appUser = await requireRole("admin");

    const body = await request.json();
    const { name, icon, sort_order } = parseBody(createCategorySchema, body);

    const admin = createAdminClient();

    const result = await admin
      .from("benefit_categories")
      .insert({
        tenant_id: appUser.tenant_id,
        name,
        icon,
        sort_order,
      } as never)
      .select("*")
      .single();

    const category = unwrapSingle<BenefitCategory>(result, "Failed to create category");
    return created(category);
  }, "POST /api/admin/categories");
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/categories — Update a benefit category
// ---------------------------------------------------------------------------

export function PATCH(request: NextRequest) {
  return withErrorHandling(async () => {
    const appUser = await requireRole("admin");

    const body = await request.json();
    const { id, ...updates } = parseBody(updateCategorySchema, body);

    const admin = createAdminClient();

    const result = await admin
      .from("benefit_categories")
      .update(updates as never)
      .eq("id", id)
      .eq("tenant_id", appUser.tenant_id)
      .select("*")
      .single();

    const category = unwrapSingle<BenefitCategory>(result, "Failed to update category");
    return success(category);
  }, "PATCH /api/admin/categories");
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/categories — Delete a benefit category
// ---------------------------------------------------------------------------

export function DELETE(request: NextRequest) {
  return withErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      throw validationError("Category ID is required");
    }

    const appUser = await requireRole("admin");
    const admin = createAdminClient();

    const { error: deleteError } = await admin
      .from("benefit_categories")
      .delete()
      .eq("id", id)
      .eq("tenant_id", appUser.tenant_id);

    if (deleteError) {
      const { dbError } = await import("@/lib/errors");
      throw dbError(`Failed to delete category: ${deleteError.message}`);
    }

    return success({ id });
  }, "DELETE /api/admin/categories");
}
