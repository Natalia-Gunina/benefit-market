import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { updateProviderSchema } from "@/lib/api/validators";
import { providerNotFound } from "@/lib/errors";
import type { Provider } from "@/lib/types";

// Explicit row type for Supabase query results
type ProviderIdRow = Record<string, unknown> & { id: string };

// ---------------------------------------------------------------------------
// GET /api/provider/profile — own profile
// ---------------------------------------------------------------------------

export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      return success({
        id: "demo-provider-001",
        name: "World Class",
        slug: "world-class",
        status: "verified",
        description: "Сеть премиальных фитнес-клубов",
        offerings_count: 3,
      });
    }

    const appUser = await requireRole("provider", "admin");
    const admin = createAdminClient();

    const provider = unwrapSingleOrNull<Provider>(
      await admin
        .from("providers")
        .select("*")
        .eq("owner_user_id", appUser.id)
        .single(),
    );

    if (!provider) {
      throw providerNotFound("Профиль провайдера не найден. Зарегистрируйтесь.");
    }

    // Get offerings count
    const countResult = await admin
      .from("provider_offerings")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", provider.id);

    return success({ ...provider, offerings_count: countResult.count ?? 0 });
  }, "GET /api/provider/profile");
}

// ---------------------------------------------------------------------------
// PATCH /api/provider/profile — update profile
// ---------------------------------------------------------------------------

export function PATCH(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return success({ id: "demo-provider-001", name: "Updated Provider" });
    }

    const appUser = await requireRole("provider", "admin");
    const admin = createAdminClient();

    const body = await request.json();
    const data = parseBody(updateProviderSchema, body);

    const existing = unwrapSingleOrNull<ProviderIdRow>(
      await admin
        .from("providers")
        .select("id")
        .eq("owner_user_id", appUser.id)
        .single(),
    );

    if (!existing) {
      throw providerNotFound();
    }

    const updated = unwrapSingle<Provider>(
      await admin
        .from("providers")
        .update(data as never)
        .eq("id", existing.id)
        .select("*")
        .single(),
      "Failed to update provider",
    );

    return success(updated);
  }, "PATCH /api/provider/profile");
}
