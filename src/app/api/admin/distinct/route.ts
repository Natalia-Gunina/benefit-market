import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, errorResponse, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

interface FieldConfig {
  table: string;
  column: string;
  demo: () => Promise<string[]>;
}

function buildConfig(): Record<string, FieldConfig> {
  return {
    "catalog.category": {
      table: "global_categories",
      column: "name",
      demo: async () => {
        const { DEMO_GLOBAL_CATEGORIES } = await import("@/lib/demo-data");
        return DEMO_GLOBAL_CATEGORIES.filter((c) => c.is_active).map((c) => c.name).sort();
      },
    },
    "catalog.format": {
      table: "provider_offerings",
      column: "format",
      demo: async () => {
        const { DEMO_PROVIDER_OFFERINGS } = await import("@/lib/demo-data");
        return [...new Set(DEMO_PROVIDER_OFFERINGS.map((o) => (o as Record<string, unknown>).format as string))].filter(Boolean).sort();
      },
    },
    "catalog.status": {
      table: "provider_offerings",
      column: "status",
      demo: async () => {
        const { DEMO_PROVIDER_OFFERINGS } = await import("@/lib/demo-data");
        return [...new Set(DEMO_PROVIDER_OFFERINGS.map((o) => o.status))].filter(Boolean).sort();
      },
    },
    "offerings.provider": {
      table: "providers",
      column: "name",
      demo: async () => {
        const { DEMO_PROVIDERS } = await import("@/lib/demo-data");
        return DEMO_PROVIDERS.map((p) => p.name).sort();
      },
    },
    "offerings.category": {
      table: "global_categories",
      column: "name",
      demo: async () => {
        const { DEMO_GLOBAL_CATEGORIES } = await import("@/lib/demo-data");
        return DEMO_GLOBAL_CATEGORIES.filter((c) => c.is_active).map((c) => c.name).sort();
      },
    },
  };
}

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (!isDemo) {
      await requireRole("admin", "hr");
    }

    const { searchParams } = new URL(request.url);
    const field = searchParams.get("field");
    const config = buildConfig();

    if (!field || !config[field]) {
      return errorResponse(
        "INVALID_FIELD",
        `Unknown field "${field}". Allowed: ${Object.keys(config).join(", ")}`,
        400
      );
    }

    const cfg = config[field];

    if (isDemo) {
      const values = await cfg.demo();
      return success({ values });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from(cfg.table)
      .select(cfg.column);

    if (error) {
      return errorResponse("DB_ERROR", error.message, 500);
    }

    const values = [
      ...new Set(
        (data ?? [])
          .map((r: Record<string, unknown>) => r[cfg.column])
          .filter((v): v is string => typeof v === "string" && v !== "")
      ),
    ].sort();

    return success({ values });
  }, "GET /api/admin/distinct");
}
