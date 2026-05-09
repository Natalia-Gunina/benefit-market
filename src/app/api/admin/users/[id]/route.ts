import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle } from "@/lib/supabase/typed-queries";
import { forbidden, notFound } from "@/lib/errors";
import { z } from "zod";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updateUserRoleSchema = z.object({
  role: z.enum(["employee", "hr", "admin"], {
    message: "Role must be one of: employee, hr, admin",
  }),
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/[id] — Change user role
// ---------------------------------------------------------------------------

export function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id: userId } = await params;

    const body = await request.json();
    const { role } = parseBody(updateUserRoleSchema, body);

    if (isDemo) {
      const { DEMO_EMPLOYEES } = await import("@/lib/demo-data");
      const emp = DEMO_EMPLOYEES.find((e) => e.user.id === userId);
      if (!emp) throw notFound("User not found");
      emp.user.role = role;
      return success(emp.user);
    }

    const appUser = await requireRole("admin");

    // --- Prevent self-demotion ---
    if (userId === appUser.id) {
      throw forbidden("Cannot change your own role");
    }

    const admin = createAdminClient();

    const result = await admin
      .from("users")
      .update({ role } as never)
      .eq("id", userId)
      .eq("tenant_id", appUser.tenant_id)
      .select("*")
      .single();

    const updatedUser = unwrapSingle<User>(result, "Failed to update user role");
    return success(updatedUser);
  }, "PATCH /api/admin/users/[id]");
}
