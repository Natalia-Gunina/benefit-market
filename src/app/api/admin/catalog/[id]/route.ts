import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, validationError } from "@/lib/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const VALID_STATUSES = new Set(["draft", "pending_review", "published", "archived"]);

/**
 * Keeps tenant_offerings in sync with provider_offerings.status:
 *   - published → ensure an is_active=true row exists for every tenant
 *   - archived  → mark every tenant_offerings row for this offering is_active=false
 *   - other statuses → no-op
 */
async function syncTenantOfferings(
  admin: SupabaseClient<Database>,
  offeringId: string,
  nextStatus: string,
  appUserId: string,
) {
  if (nextStatus === "published") {
    const tenantsResult = await admin.from("tenants").select("id");
    const tenants = (tenantsResult.data ?? []) as { id: string }[];
    if (tenants.length === 0) return;

    const existingResult = await admin
      .from("tenant_offerings")
      .select("tenant_id")
      .eq("provider_offering_id", offeringId);
    const existing = new Set(
      (existingResult.data ?? []).map((r) => (r as { tenant_id: string }).tenant_id),
    );

    // Reactivate rows that already exist
    await admin
      .from("tenant_offerings")
      .update({ is_active: true } as never)
      .eq("provider_offering_id", offeringId);

    // Insert missing tenant rows
    const toInsert = tenants
      .filter((t) => !existing.has(t.id))
      .map((t) => ({
        tenant_id: t.id,
        provider_offering_id: offeringId,
        is_active: true,
        enabled_by: appUserId,
      }));
    if (toInsert.length > 0) {
      await admin.from("tenant_offerings").insert(toInsert as never);
    }
  } else if (nextStatus === "archived") {
    await admin
      .from("tenant_offerings")
      .update({ is_active: false } as never)
      .eq("provider_offering_id", offeringId);
  }
}

type Params = { params: Promise<{ id: string }> };

const ALLOWED_PATCH_FIELDS = new Set([
  "name",
  "description",
  "long_description",
  "base_price_points",
  "stock_limit",
  "is_stackable",
  "status",
  "global_category_id",
  "format",
  "cities",
  "delivery_info",
  "terms_conditions",
]);

// ---------------------------------------------------------------------------
// PATCH /api/admin/catalog/[id]
// ---------------------------------------------------------------------------

export function PATCH(request: NextRequest, ctx: Params) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const body = await request.json();
      if (body.status && VALID_STATUSES.has(body.status)) {
        const { DEMO_PROVIDER_OFFERINGS, DEMO_TENANT_OFFERINGS } = await import("@/lib/demo-data");
        const { id } = await ctx.params;
        const offering = DEMO_PROVIDER_OFFERINGS.find((o) => o.id === id);
        if (offering) {
          offering.status = body.status;
          if (body.status === "archived") {
            DEMO_TENANT_OFFERINGS.forEach((to) => {
              if (to.provider_offering_id === id) to.is_active = false;
            });
          } else if (body.status === "published") {
            DEMO_TENANT_OFFERINGS.forEach((to) => {
              if (to.provider_offering_id === id) to.is_active = true;
            });
          }
        }
      }
      return success({ updated: true });
    }

    const appUser = await requireRole("admin");
    const { id } = await ctx.params;
    const body = await request.json();
    const admin = createAdminClient();

    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_PATCH_FIELDS.has(k)) updates[k] = v;
    }

    if (updates.status !== undefined && !VALID_STATUSES.has(updates.status as string)) {
      throw validationError("Invalid status value");
    }
    if (updates.format !== undefined && updates.format !== "online" && updates.format !== "offline") {
      throw validationError("Invalid format value");
    }
    if (updates.format === "offline") {
      const cities = Array.isArray(updates.cities) ? (updates.cities as string[]) : [];
      if (cities.length === 0) {
        throw validationError("Для офлайн-льготы требуется указать хотя бы один город");
      }
    }
    if (updates.format === "online") {
      updates.cities = [];
    }

    const result = await admin
      .from("provider_offerings")
      .update(updates as never)
      .eq("id", id)
      .select("*")
      .single();

    if (result.error) throw notFound("Offering not found");

    if (typeof updates.status === "string") {
      await syncTenantOfferings(admin, id, updates.status, appUser.id);
    }

    return success(result.data);
  }, "PATCH /api/admin/catalog/[id]");
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/catalog/[id]
// ---------------------------------------------------------------------------

export function DELETE(_request: NextRequest, ctx: Params) {
  return withErrorHandling(async () => {
    if (isDemo) return success({ deleted: true });

    await requireRole("admin");
    const { id } = await ctx.params;
    const admin = createAdminClient();

    const result = await admin.from("provider_offerings").delete().eq("id", id);
    if (result.error) throw notFound("Offering not found");
    return success({ deleted: true });
  }, "DELETE /api/admin/catalog/[id]");
}
