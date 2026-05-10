import { type NextRequest } from "next/server";
import { success, withErrorHandling, errorResponse } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/supabase/typed-queries";
import { processAccruals, type AccrualResult } from "@/lib/services/accrual.service";
import type { Tenant } from "@/lib/types";

// ---------------------------------------------------------------------------
// GET / POST /api/cron/accruals — process due accruals across all tenants
// Protected by CRON_SECRET (Bearer token) when set; idempotent.
// ---------------------------------------------------------------------------

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return errorResponse("UNAUTHORIZED", "Invalid cron secret", 401);
    }
  }

  if (isDemo) {
    return success({ message: "skipped in demo mode" });
  }

  const admin = createAdminClient();

  const tenants = unwrapRows<Pick<Tenant, "id">>(
    await admin.from("tenants").select("id"),
    "Failed to load tenants",
  );

  const perTenant: Record<string, AccrualResult> = {};
  for (const t of tenants) {
    try {
      perTenant[t.id] = await processAccruals(admin, t.id);
    } catch (err) {
      perTenant[t.id] = {
        processed: 0,
        accrued: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  return success({ tenants: perTenant });
}

export function GET(request: NextRequest) {
  return withErrorHandling(() => handle(request), "GET /api/cron/accruals");
}

export function POST(request: NextRequest) {
  return withErrorHandling(() => handle(request), "POST /api/cron/accruals");
}
