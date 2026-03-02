import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { providerNotFound, notFound } from "@/lib/errors";
import { updateTeamMemberSchema } from "@/lib/api/validators";

type ProviderIdRow = Record<string, unknown> & { id: string };
type Params = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/provider/team/[id] — update member role
// ---------------------------------------------------------------------------

export function PATCH(request: NextRequest, ctx: Params) {
  return withErrorHandling(async () => {
    if (isDemo) return success({ updated: true });

    const appUser = await requireRole("provider", "admin");
    const admin = createAdminClient();
    const { id } = await ctx.params;

    const provider = unwrapSingleOrNull<ProviderIdRow>(
      await admin
        .from("providers")
        .select("id")
        .eq("owner_user_id", appUser.id)
        .single(),
    );

    if (!provider) throw providerNotFound();

    const body = await request.json();
    const data = parseBody(updateTeamMemberSchema, body);

    const result = await admin
      .from("provider_users")
      .update({ role: data.role } as never)
      .eq("id", id)
      .eq("provider_id", provider.id)
      .select("*")
      .single();

    if (result.error) throw notFound("Участник не найден");
    return success(result.data);
  }, "PATCH /api/provider/team/[id]");
}

// ---------------------------------------------------------------------------
// DELETE /api/provider/team/[id] — remove member
// ---------------------------------------------------------------------------

export function DELETE(_request: NextRequest, ctx: Params) {
  return withErrorHandling(async () => {
    if (isDemo) return success({ deleted: true });

    const appUser = await requireRole("provider", "admin");
    const admin = createAdminClient();
    const { id } = await ctx.params;

    const provider = unwrapSingleOrNull<ProviderIdRow>(
      await admin
        .from("providers")
        .select("id")
        .eq("owner_user_id", appUser.id)
        .single(),
    );

    if (!provider) throw providerNotFound();

    const result = await admin
      .from("provider_users")
      .delete()
      .eq("id", id)
      .eq("provider_id", provider.id);

    if (result.error) throw notFound("Участник не найден");
    return success({ deleted: true });
  }, "DELETE /api/provider/team/[id]");
}
