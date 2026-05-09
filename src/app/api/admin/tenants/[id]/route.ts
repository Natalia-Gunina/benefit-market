import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle } from "@/lib/supabase/typed-queries";
import { notFound, validationError } from "@/lib/errors";
import { updateTenantSchema } from "@/lib/api/validators";

// ---------------------------------------------------------------------------
// PATCH /api/admin/tenants/[id] — Update tenant settings
// ---------------------------------------------------------------------------

type TenantRow = {
  id: string;
  name: string;
  domain: string;
  settings: Record<string, unknown>;
  created_at: string;
};

export function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id: tenantId } = await params;

    const body = await request.json();
    const updates = parseBody(updateTenantSchema, body);

    if (Object.keys(updates).length === 0) {
      throw validationError("At least one field must be provided for update");
    }

    if (isDemo) {
      const { DEMO_TENANT } = await import("@/lib/demo-data");
      if (DEMO_TENANT.id !== tenantId) throw notFound("Tenant not found");
      Object.assign(DEMO_TENANT, updates);
      return success(DEMO_TENANT);
    }

    await requireRole("admin");
    const admin = createAdminClient();

    const result = await admin
      .from("tenants")
      .update(updates as never)
      .eq("id", tenantId)
      .select("*")
      .single();

    const tenant = unwrapSingle<TenantRow>(result, "Failed to update tenant");
    return success(tenant);
  }, "PATCH /api/admin/tenants/[id]");
}
