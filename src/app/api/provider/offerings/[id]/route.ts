import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { updateProviderOfferingSchema } from "@/lib/api/validators";
import { notFound, providerNotFound, forbidden, invalidStatus } from "@/lib/errors";
import type { ProviderOffering } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

// Explicit row types for Supabase query results
type ProviderIdRow = Record<string, unknown> & { id: string };
type OfferingOwnerRow = Record<string, unknown> & { id: string; provider_id: string; status: string };
type OfferingWithCategoryRow = Record<string, unknown> & {
  id: string;
  name: string;
  provider_id: string;
  global_categories: { name: string; icon: string } | null;
};

// ---------------------------------------------------------------------------
// GET /api/provider/offerings/[id] — offering details
// ---------------------------------------------------------------------------

export function GET(_request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) {
      return success({ id, name: "Demo Offering", status: "draft" });
    }

    const appUser = await requireRole("provider", "admin");
    const admin = createAdminClient();

    const provider = unwrapSingleOrNull<ProviderIdRow>(
      await admin
        .from("providers")
        .select("id")
        .eq("owner_user_id", appUser.id)
        .single(),
    );

    if (!provider) throw providerNotFound();

    const offering = unwrapSingleOrNull<OfferingWithCategoryRow>(
      await admin
        .from("provider_offerings")
        .select("*, global_categories(name, icon)")
        .eq("id", id)
        .eq("provider_id", provider.id)
        .single(),
    );

    if (!offering) throw notFound("Предложение не найдено");

    return success(offering);
  }, "GET /api/provider/offerings/[id]");
}

// ---------------------------------------------------------------------------
// PATCH /api/provider/offerings/[id] — update offering
// ---------------------------------------------------------------------------

export function PATCH(request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) {
      return success({ id, name: "Updated Offering" });
    }

    const appUser = await requireRole("provider", "admin");
    const admin = createAdminClient();

    const provider = unwrapSingleOrNull<ProviderIdRow>(
      await admin
        .from("providers")
        .select("id")
        .eq("owner_user_id", appUser.id)
        .single(),
    );

    if (!provider) throw providerNotFound();

    // Verify ownership
    const existing = unwrapSingleOrNull<OfferingOwnerRow>(
      await admin
        .from("provider_offerings")
        .select("id, provider_id, status")
        .eq("id", id)
        .single(),
    );

    if (!existing) throw notFound("Предложение не найдено");
    if (existing.provider_id !== provider.id) throw forbidden();
    if (existing.status !== "draft") {
      throw invalidStatus("Можно редактировать только предложения в статусе draft");
    }

    const body = await request.json();
    const data = parseBody(updateProviderOfferingSchema, body);

    const updated = unwrapSingle<ProviderOffering>(
      await admin
        .from("provider_offerings")
        .update(data as never)
        .eq("id", id)
        .select("*")
        .single(),
      "Failed to update offering",
    );

    return success(updated);
  }, "PATCH /api/provider/offerings/[id]");
}

// ---------------------------------------------------------------------------
// DELETE /api/provider/offerings/[id] — archive offering
// ---------------------------------------------------------------------------

export function DELETE(_request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) {
      return success({ id, status: "archived" });
    }

    const appUser = await requireRole("provider", "admin");
    const admin = createAdminClient();

    const provider = unwrapSingleOrNull<ProviderIdRow>(
      await admin
        .from("providers")
        .select("id")
        .eq("owner_user_id", appUser.id)
        .single(),
    );

    if (!provider) throw providerNotFound();

    const existing = unwrapSingleOrNull<OfferingOwnerRow>(
      await admin
        .from("provider_offerings")
        .select("id, provider_id")
        .eq("id", id)
        .single(),
    );

    if (!existing) throw notFound("Предложение не найдено");
    if (existing.provider_id !== provider.id) throw forbidden();

    const updated = unwrapSingle<ProviderOffering>(
      await admin
        .from("provider_offerings")
        .update({ status: "archived" } as never)
        .eq("id", id)
        .select("*")
        .single(),
      "Failed to archive offering",
    );

    return success(updated);
  }, "DELETE /api/provider/offerings/[id]");
}
