import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { notFound } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmployeeProfileResponse {
  full_name: string;
  gender: string;
  company: string;
  birthday: string;
  marital_status: string;
  has_children: boolean;
  children: { birthday: string }[];
  work_format: string;
  has_pets: string;
  priorities: string[];
}

interface ProfileRow {
  id: string;
  legal_entity: string;
  extra: Record<string, unknown> | null;
}

// Read-only base fields are stored under `extra.base` so the demo doesn't
// require a schema change. In a non-demo deployment, full_name / gender /
// birthday come from the same JSONB blob (legal_entity / company stays in
// the dedicated column).
function buildResponse(row: ProfileRow | null): EmployeeProfileResponse {
  const extra = (row?.extra ?? {}) as Record<string, unknown>;
  const base = (extra.base as Record<string, unknown> | undefined) ?? {};
  return {
    full_name: (base.full_name as string) ?? "",
    gender: (base.gender as string) ?? "",
    company: row?.legal_entity ?? "",
    birthday: (base.birthday as string) ?? "",
    marital_status: (extra.marital_status as string) ?? "",
    has_children: (extra.has_children as boolean) ?? false,
    children: (extra.children as { birthday: string }[]) ?? [],
    work_format: (extra.work_format as string) ?? "",
    has_pets: (extra.has_pets as string) ?? "",
    priorities: (extra.priorities as string[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// GET /api/employee/profile
// ---------------------------------------------------------------------------

export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_EMPLOYEES } = await import("@/lib/demo-data");
      const me = DEMO_EMPLOYEES[0];
      return success<EmployeeProfileResponse>({
        full_name: me.full_name,
        gender: "male",
        company: me.profile.legal_entity,
        birthday: "1992-03-15",
        marital_status: "",
        has_children: false,
        children: [],
        work_format: "",
        has_pets: "",
        priorities: [],
      });
    }

    const appUser = await requireAuth();
    const admin = createAdminClient();

    const profile = unwrapSingleOrNull<ProfileRow>(
      await admin
        .from("employee_profiles")
        .select("id, legal_entity, extra")
        .eq("user_id", appUser.id)
        .single(),
    );

    return success(buildResponse(profile));
  }, "GET /api/employee/profile");
}

// ---------------------------------------------------------------------------
// PATCH /api/employee/profile — only mutable fields
// ---------------------------------------------------------------------------

const MUTABLE_KEYS = [
  "marital_status",
  "has_children",
  "children",
  "work_format",
  "has_pets",
  "priorities",
] as const;

export function PATCH(request: NextRequest) {
  return withErrorHandling(async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const key of MUTABLE_KEYS) {
      if (key in body) patch[key] = body[key];
    }

    if (isDemo) {
      return success({ ok: true, patch });
    }

    const appUser = await requireAuth();
    const admin = createAdminClient();

    const existing = unwrapSingleOrNull<ProfileRow>(
      await admin
        .from("employee_profiles")
        .select("id, legal_entity, extra")
        .eq("user_id", appUser.id)
        .single(),
    );

    if (!existing) {
      throw notFound("Профиль сотрудника не найден");
    }

    const merged = { ...(existing.extra ?? {}), ...patch };

    const updated = unwrapSingle<ProfileRow>(
      await admin
        .from("employee_profiles")
        .update({ extra: merged } as never)
        .eq("id", existing.id)
        .select("id, legal_entity, extra")
        .single(),
      "Failed to update employee profile",
    );

    return success(buildResponse(updated));
  }, "PATCH /api/employee/profile");
}
