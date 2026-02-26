import { requireRole } from "@/lib/api/auth";
import { errorResponse, success, withErrorHandling } from "@/lib/api/response";
import { processAccruals } from "@/lib/services/accrual.service";
import { createAdminClient } from "@/lib/supabase/admin";

export function POST() {
  return withErrorHandling(async () => {
    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();
    const result = await processAccruals(admin, appUser.tenant_id);

    if (result.errors.length === 1 && result.errors[0] === "NO_POLICIES") {
      return errorResponse("NO_POLICIES", "No active budget policies found for this tenant", 400);
    }

    return success(result);
  }, "POST /api/wallets/accrual");
}
