import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, userNotFound, forbidden } from "@/lib/errors";
import type { User, UserRole } from "@/lib/types";

/**
 * Authenticate the current request and return the app-level User record.
 * Uses admin client to bypass RLS when looking up the user by auth_id.
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

  if (userError || !appUser) {
    throw userNotFound();
  }

  return appUser as User;
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
