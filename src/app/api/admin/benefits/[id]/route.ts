import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle } from "@/lib/supabase/typed-queries";
import { validationError, notFound } from "@/lib/errors";
import { z } from "zod";

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
// Helper: reshape benefit_categories -> category
// ---------------------------------------------------------------------------

type BenefitWithJoin = Record<string, unknown> & {
  benefit_categories: { name: string; icon: string } | null;
};

function shapeBenefit(row: BenefitWithJoin) {
  const { benefit_categories, ...rest } = row;
  return { ...rest, category: benefit_categories };
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/benefits/[id] — Update a benefit
// ---------------------------------------------------------------------------

export function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id: benefitId } = await params;
    await requireRole("admin");

    const body = await request.json();
    const updates = parseBody(updateBenefitSchema, body);

    if (Object.keys(updates).length === 0) {
      throw validationError("At least one field must be provided for update");
    }

    const admin = createAdminClient();

    const result = await admin
      .from("benefits")
      .update(updates as never)
      .eq("id", benefitId)
      .select("*, benefit_categories(name, icon)")
      .single();

    const row = unwrapSingle<BenefitWithJoin>(result, "Failed to update benefit");
    return success(shapeBenefit(row));
  }, "PATCH /api/admin/benefits/[id]");
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/benefits/[id] — Soft delete (set is_active=false)
// ---------------------------------------------------------------------------

export function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id: benefitId } = await params;
    await requireRole("admin");

    const admin = createAdminClient();

    const result = await admin
      .from("benefits")
      .update({ is_active: false } as never)
      .eq("id", benefitId)
      .select("*")
      .single();

    const benefit = unwrapSingle<Record<string, unknown>>(result, "Failed to deactivate benefit");
    return success(benefit);
  }, "DELETE /api/admin/benefits/[id]");
}
