import { type NextRequest, NextResponse } from "next/server";
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

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_TENANT } = await import("@/lib/demo-data");
      return success([{ ...DEMO_TENANT, user_count: 8 }]);
    }

    await requireRole("admin");
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const sortBy = searchParams.get("sort_by") || "";
    const sortDir = searchParams.get("sort_dir") === "desc" ? -1 : 1;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));

    // --- Fetch all tenants (small table) ---
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

    // --- Shape, then apply search / sort / pagination ---
    let rows = tenants.map((t) => ({
      ...t,
      user_count: countMap.get(t.id) ?? 0,
    }));

    if (search) {
      rows = rows.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          (t.domain ?? "").toLowerCase().includes(search),
      );
    }

    const cmp = new Intl.Collator("ru", { sensitivity: "base" }).compare;
    if (sortBy === "name") {
      rows.sort((a, b) => cmp(a.name, b.name) * sortDir);
    } else if (sortBy === "domain") {
      rows.sort((a, b) => cmp(a.domain ?? "", b.domain ?? "") * sortDir);
    } else if (sortBy === "created_at") {
      rows.sort((a, b) => a.created_at.localeCompare(b.created_at) * sortDir);
    }

    const total = rows.length;
    const offset = (page - 1) * perPage;
    const data = rows.slice(offset, offset + perPage);

    return NextResponse.json({
      data,
      meta: { page, per_page: perPage, total },
    });
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
