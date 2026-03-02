import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingleOrNull, unwrapRowsSoft, unwrapSingle } from "@/lib/supabase/typed-queries";
import { providerNotFound, notFound, validationError } from "@/lib/errors";
import { addTeamMemberSchema } from "@/lib/api/validators";

type ProviderIdRow = Record<string, unknown> & { id: string };
type TeamMemberRow = Record<string, unknown> & {
  id: string;
  role: string;
  created_at: string;
  users: { id: string; email: string } | null;
};

// ---------------------------------------------------------------------------
// GET /api/provider/team — list team members
// ---------------------------------------------------------------------------

export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      return success([]);
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

    const members = unwrapRowsSoft<TeamMemberRow>(
      await admin
        .from("provider_users")
        .select("id, role, created_at, users(id, email)")
        .eq("provider_id", provider.id)
        .order("created_at", { ascending: true }),
    );

    return success(members);
  }, "GET /api/provider/team");
}

// ---------------------------------------------------------------------------
// POST /api/provider/team — add team member by email
// ---------------------------------------------------------------------------

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return created({ id: "demo-member", role: "member" });
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

    const body = await request.json();
    const data = parseBody(addTeamMemberSchema, body);

    // Find user by email
    type UserIdRow = Record<string, unknown> & { id: string };
    const foundUser = unwrapSingleOrNull<UserIdRow>(
      await admin
        .from("users")
        .select("id")
        .eq("email", data.email)
        .single(),
    );

    if (!foundUser) {
      throw notFound(`Пользователь с email ${data.email} не найден`);
    }

    const userId = foundUser.id;

    // Check if already a member
    const existing = await admin
      .from("provider_users")
      .select("id")
      .eq("provider_id", provider.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing.data) {
      throw validationError("Пользователь уже в команде");
    }

    const member = unwrapSingle<TeamMemberRow>(
      await admin
        .from("provider_users")
        .insert({
          provider_id: provider.id,
          user_id: userId,
          role: data.role,
        } as never)
        .select("id, role, created_at, users(id, email)")
        .single(),
      "Failed to add team member",
    );

    return created(member);
  }, "POST /api/provider/team");
}
