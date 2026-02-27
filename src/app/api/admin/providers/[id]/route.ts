import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapRows } from "@/lib/supabase/typed-queries";
import { notFound } from "@/lib/errors";
import type { Provider } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

type OfferingRow = {
  id: string;
  name: string;
  status: string;
  avg_rating: number | null;
  review_count: number | null;
};

// GET /api/admin/providers/[id]
export function GET(_request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) {
      return success({ id, name: "Demo Provider", status: "pending" });
    }

    await requireRole("admin");
    const admin = createAdminClient();

    const result = await admin
      .from("providers")
      .select("*")
      .eq("id", id)
      .single();

    const provider = unwrapSingle<Provider>(result, "Провайдер не найден");

    // Get offerings
    const offerings = unwrapRows<OfferingRow>(
      await admin
        .from("provider_offerings")
        .select("id, name, status, avg_rating, review_count")
        .eq("provider_id", id)
        .order("created_at", { ascending: false }),
      "Failed to fetch provider offerings",
    );

    return success({ ...provider, offerings });
  }, "GET /api/admin/providers/[id]");
}

// PATCH /api/admin/providers/[id]
export function PATCH(request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) {
      return success({ id, status: "verified" });
    }

    const appUser = await requireRole("admin");
    const admin = createAdminClient();

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // Allowed fields
    const allowedFields = ["name", "description", "status", "rejection_reason"];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    // If verifying, set verified_at and verified_by
    if (body.status === "verified") {
      updateData.verified_at = new Date().toISOString();
      updateData.verified_by = appUser.id;
    }

    const updated = unwrapSingle<Provider>(
      await admin
        .from("providers")
        .update(updateData as never)
        .eq("id", id)
        .select("*")
        .single(),
      "Failed to update provider",
    );

    return success(updated);
  }, "PATCH /api/admin/providers/[id]");
}
