import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapRowsSoft } from "@/lib/supabase/typed-queries";
import { registerProviderSchema } from "@/lib/api/validators";
import { validationError } from "@/lib/errors";
import type { Provider } from "@/lib/types";

// Explicit row type for Supabase query results
type IdRow = Record<string, unknown> & { id: string };

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return created({
        id: "demo-provider-new",
        name: "Demo Provider",
        slug: "demo-provider",
        status: "pending",
        created_at: new Date().toISOString(),
      });
    }

    const appUser = await requireRole("provider", "admin");

    const body = await request.json();
    const data = parseBody(registerProviderSchema, body);

    const admin = createAdminClient();

    // Check: user doesn't already have a provider
    const existing = unwrapRowsSoft<IdRow>(
      await admin
        .from("providers")
        .select("id")
        .eq("owner_user_id", appUser.id)
        .limit(1),
    );

    if (existing.length > 0) {
      throw validationError("У вас уже есть профиль провайдера");
    }

    // Check slug uniqueness
    const slugExists = unwrapRowsSoft<IdRow>(
      await admin
        .from("providers")
        .select("id")
        .eq("slug", data.slug)
        .limit(1),
    );

    if (slugExists.length > 0) {
      throw validationError("Этот slug уже занят");
    }

    // Create provider
    const provider = unwrapSingle<Provider>(
      await admin
        .from("providers")
        .insert({
          owner_user_id: appUser.id,
          name: data.name,
          slug: data.slug,
          description: data.description,
          logo_url: data.logo_url || null,
          website: data.website || null,
          contact_email: data.contact_email || null,
          contact_phone: data.contact_phone || null,
          address: data.address || null,
          status: "pending",
        } as never)
        .select("*")
        .single(),
      "Failed to create provider",
    );

    // Create provider_users entry (owner)
    await admin.from("provider_users").insert({
      provider_id: provider.id,
      user_id: appUser.id,
      role: "owner",
    } as never);

    return created(provider);
  }, "POST /api/provider/register");
}
