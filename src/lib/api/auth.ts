import { createClient } from "@/lib/supabase/server";
import { unauthorized, userNotFound, forbidden } from "@/lib/errors";
import type { User, UserRole } from "@/lib/types";

/**
 * Authenticate the current request and return the app-level User record.
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

  const { data: appUser, error: userError } = await supabase
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
