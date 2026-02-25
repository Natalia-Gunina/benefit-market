import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { generateDashboard } from "@/lib/services/dashboard.service";

export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_HR_DASHBOARD } = await import("@/lib/demo-data");
      return success(DEMO_HR_DASHBOARD);
    }

    const appUser = await requireRole("hr", "admin");
    const supabase = await createClient();
    const data = await generateDashboard(supabase, appUser.tenant_id);
    return success(data);
  }, "GET /api/reports/dashboard");
}
