import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows, unwrapSingle } from "@/lib/supabase/typed-queries";
import { dbError } from "@/lib/errors";
import { createTenantSchema } from "@/lib/api/validators";

// ---------------------------------------------------------------------------
// GET /api/admin/tenants — List all tenants with employee count
// ---------------------------------------------------------------------------

type TenantRow = {
  id: string;
  name: string;
  domain: string;
  settings: Record<string, unknown>;
  created_at: string;
};

export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_TENANT } = await import("@/lib/demo-data");
      return success([{ ...DEMO_TENANT, user_count: 8 }]);
    }

    await requireRole("admin");
    const admin = createAdminClient();

    // --- Fetch all tenants ---
    const tenantsResult = await admin
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    const tenants = unwrapRows<TenantRow>(tenantsResult, "Failed to fetch tenants");

    // --- Get user counts per tenant ---
    const countsResult = await admin
      .from("users")
      .select("tenant_id");

    if (countsResult.error) {
      throw dbError(`Failed to fetch user counts: ${countsResult.error.message}`);
    }

    const countMap = new Map<string, number>();
    for (const row of countsResult.data ?? []) {
      const tid = (row as { tenant_id: string }).tenant_id;
      countMap.set(tid, (countMap.get(tid) ?? 0) + 1);
    }

    // --- Shape response ---
    const data = tenants.map((t) => ({
      ...t,
      user_count: countMap.get(t.id) ?? 0,
    }));

    return success(data);
  }, "GET /api/admin/tenants");
}

// ---------------------------------------------------------------------------
// POST /api/admin/tenants — Create a new tenant
// ---------------------------------------------------------------------------

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      return created({
        id: "demo-tenant-new",
        name: "New Tenant",
        created_at: new Date().toISOString(),
      });
    }

    await requireRole("admin");

    const body = await request.json();
    const { name, domain, settings } = parseBody(createTenantSchema, body);

    const admin = createAdminClient();

    const result = await admin
      .from("tenants")
      .insert({ name, domain, settings } as never)
      .select("*")
      .single();

    const tenant = unwrapSingle<TenantRow>(result, "Failed to create tenant");
    return created(tenant);
  }, "POST /api/admin/tenants");
}
