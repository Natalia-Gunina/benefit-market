import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, errorResponse } from "@/lib/api/response";
import { unwrapRowsSoft } from "@/lib/supabase/typed-queries";
import { validationError } from "@/lib/errors";
import Papa from "papaparse";
import { importRowSchema } from "@/lib/api/validators";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  created: number;
  updated: number;
  errors: ImportError[];
}

// ---------------------------------------------------------------------------
// POST /api/import/employees --- CSV employee import
// ---------------------------------------------------------------------------

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const appUser = await requireRole("hr", "admin");
    const tenantId = appUser.tenant_id;
    const admin = createAdminClient();

    // --- Parse multipart form data ---
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      throw validationError("CSV file is required (form field: file)");
    }

    if (!file.name.endsWith(".csv")) {
      throw validationError("Only .csv files are supported");
    }

    // --- Read file content ---
    const text = await file.text();

    // --- Parse CSV ---
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return errorResponse("PARSE_ERROR", "Failed to parse CSV file", 400);
    }

    // --- Limit to 1000 rows ---
    if (parsed.data.length > 1000) {
      return errorResponse(
        "TOO_MANY_ROWS",
        "Maximum 1000 rows allowed per import",
        400,
      );
    }

    // --- Validate and process each row ---
    const result: ImportResult = {
      created: 0,
      updated: 0,
      errors: [],
    };

    // Compute current period info for wallet creation
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    const periodLabel = `${year}-Q${quarter}`;
    const nextQuarterStart = new Date(year, quarter * 3, 1);
    const expiresAt = nextQuarterStart.toISOString();

    for (let i = 0; i < parsed.data.length; i++) {
      const raw = parsed.data[i];
      const rowNum = i + 2; // 1-indexed + header row

      // Validate with zod
      const validation = importRowSchema.safeParse(raw);

      if (!validation.success) {
        for (const issue of validation.error.issues) {
          result.errors.push({
            row: rowNum,
            field: issue.path.join(".") || "unknown",
            message: issue.message,
          });
        }
        continue;
      }

      const row = validation.data;

      try {
        // Check if user already exists by email + tenant_id
        const existingUsers = unwrapRowsSoft<User>(
          await admin
            .from("users")
            .select("*")
            .eq("email", row.email)
            .eq("tenant_id", tenantId)
            .limit(1),
        );

        const existingUser = existingUsers.length > 0 ? existingUsers[0] : null;

        if (existingUser) {
          // --- Update existing employee_profile ---
          const { error: updateError } = await admin
            .from("employee_profiles")
            .update({
              grade: row.grade,
              tenure_months: row.tenure_months,
              location: row.location,
              legal_entity: row.legal_entity,
            } as never)
            .eq("user_id", existingUser.id)
            .eq("tenant_id", tenantId);

          if (updateError) {
            result.errors.push({
              row: rowNum,
              field: "email",
              message: `Failed to update profile: ${updateError.message}`,
            });
            continue;
          }

          result.updated++;
        } else {
          // --- Create new user + profile + wallet ---

          // 1. Create auth user via admin API
          const { data: authData, error: authCreateError } =
            await admin.auth.admin.createUser({
              email: row.email,
              email_confirm: true,
              user_metadata: { name: row.name },
            });

          if (authCreateError || !authData.user) {
            result.errors.push({
              row: rowNum,
              field: "email",
              message: `Failed to create auth user: ${authCreateError?.message || "unknown error"}`,
            });
            continue;
          }

          // 2. Create app-level user record
          const newUsers = unwrapRowsSoft<User>(
            await admin
              .from("users")
              .insert({
                tenant_id: tenantId,
                auth_id: authData.user.id,
                email: row.email,
                role: "employee",
              } as never)
              .select("*"),
          );

          const newUser = newUsers.length > 0 ? newUsers[0] : null;

          if (!newUser) {
            result.errors.push({
              row: rowNum,
              field: "email",
              message: "Failed to create user record: unknown error",
            });
            continue;
          }

          // 3. Create employee_profile
          const { error: profileError } = await admin
            .from("employee_profiles")
            .insert({
              user_id: newUser.id,
              tenant_id: tenantId,
              grade: row.grade,
              tenure_months: row.tenure_months,
              location: row.location,
              legal_entity: row.legal_entity,
            } as never);

          if (profileError) {
            result.errors.push({
              row: rowNum,
              field: "email",
              message: `Failed to create profile: ${profileError.message}`,
            });
            continue;
          }

          // 4. Create wallet
          const { error: walletError } = await admin
            .from("wallets")
            .insert({
              user_id: newUser.id,
              tenant_id: tenantId,
              balance: 0,
              reserved: 0,
              period: periodLabel,
              expires_at: expiresAt,
            } as never);

          if (walletError) {
            result.errors.push({
              row: rowNum,
              field: "email",
              message: `Failed to create wallet: ${walletError.message}`,
            });
            continue;
          }

          result.created++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({
          row: rowNum,
          field: "email",
          message: `Unexpected error: ${message}`,
        });
      }
    }

    return success(result);
  }, "POST /api/import/employees");
}
