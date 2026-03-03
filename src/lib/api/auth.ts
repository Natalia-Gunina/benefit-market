import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, userNotFound, forbidden } from "@/lib/errors";
import type { User, UserRole } from "@/lib/types";

/**
 * Authenticate the current request and return the app-level User record.
 * Uses admin client to bypass RLS when looking up the user by auth_id.
 * If no app-level record exists (e.g. user was created before the auth
 * trigger was installed), auto-provisions one from auth metadata.
 * Throws AppError on failure.
 */
export async function requireAuth(): Promise<User> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    throw unauthorized();
  }

  // Use admin client to bypass RLS — the users_select policy depends on
  // current_tenant_id() from JWT, which may not be available yet.
  const admin = createAdminClient();
  const { data: appUser, error: userError } = await admin
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .single();

  if (!userError && appUser) {
    return appUser as User;
  }

  // Auto-provision: create app-level user from auth metadata
  const meta = authUser.user_metadata ?? {};
  const role = (meta.role as UserRole) ?? "employee";

  // Resolve tenant: prefer metadata, fall back to first available tenant
  let tenantId: string | undefined = meta.tenant_id as string | undefined;

  if (!tenantId) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!tenant) {
      throw userNotFound("No tenant available for auto-provisioning");
    }
    tenantId = (tenant as { id: string }).id;
  }

  const { data: newUser, error: insertError } = await admin
    .from("users")
    .insert({
      tenant_id: tenantId,
      auth_id: authUser.id,
      email: authUser.email!,
      role,
    } as never)
    .select("*")
    .single();

  if (insertError || !newUser) {
    throw userNotFound(
      `Failed to auto-provision user: ${insertError?.message ?? "unknown error"}`,
    );
  }

  // Also create a wallet for the new user
  await admin.from("wallets").insert({
    user_id: (newUser as User).id,
    tenant_id: tenantId,
    balance: 0,
    reserved: 0,
    period:
      new Date().getFullYear() +
      "-Q" +
      Math.ceil((new Date().getMonth() + 1) / 3),
    expires_at: new Date(
      new Date().getFullYear(),
      Math.ceil((new Date().getMonth() + 1) / 3) * 3,
      1,
    ).toISOString(),
  } as never);

  return newUser as User;
}

/**
 * Authenticate + verify the user has one of the allowed roles.
 * Throws AppError on failure.
 */
export async function requireRole(...roles: UserRole[]): Promise<User> {
  const user = await requireAuth();

  if (!roles.includes(user.role)) {
    throw forbidden(
      `Only ${roles.join(" or ")} users can access this resource`,
    );
  }

  return user;
}
