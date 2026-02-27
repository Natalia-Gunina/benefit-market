import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { generateAnalytics } from "@/lib/services/analytics.service";

export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_HR_ANALYTICS } = await import("@/lib/demo-data");
      return success(DEMO_HR_ANALYTICS);
    }

    const appUser = await requireRole("hr", "admin");
    const supabase = await createClient();
    const data = await generateAnalytics(supabase, appUser.tenant_id);
    return success(data);
  }, "GET /api/hr/analytics");
}
