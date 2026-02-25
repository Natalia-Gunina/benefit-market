import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Papa from "papaparse";
import { z } from "zod";
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
// Validation schema for each CSV row
// ---------------------------------------------------------------------------

const rowSchema = z.object({
  email: z.string().email("Некорректный email"),
  name: z.string().min(1, "Имя обязательно"),
  grade: z.string().optional().default(""),
  tenure_months: z.coerce.number().int().min(0, "Стаж должен быть >= 0"),
  location: z.string().optional().default(""),
  legal_entity: z.string().optional().default(""),
});

// ---------------------------------------------------------------------------
// POST /api/import/employees --- CSV employee import
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // --- Authenticate user ---
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // --- Get the app-level user record ---
    const { data: rawUser, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", authUser.id)
      .single();

    const appUser = rawUser as User | null;

    if (userError || !appUser) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "User record not found" } },
        { status: 404 }
      );
    }

    // --- Role check: hr or admin only ---
    if (appUser.role !== "hr" && appUser.role !== "admin") {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only HR or admin users can import employees",
          },
        },
        { status: 403 }
      );
    }

    const tenantId = appUser.tenant_id;
    const admin = createAdminClient();

    // --- Parse multipart form data ---
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "CSV file is required (form field: file)",
          },
        },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Only .csv files are supported",
          },
        },
        { status: 400 }
      );
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
      return NextResponse.json(
        {
          error: {
            code: "PARSE_ERROR",
            message: "Failed to parse CSV file",
          },
        },
        { status: 400 }
      );
    }

    // --- Limit to 1000 rows ---
    if (parsed.data.length > 1000) {
      return NextResponse.json(
        {
          error: {
            code: "TOO_MANY_ROWS",
            message: "Maximum 1000 rows allowed per import",
          },
        },
        { status: 400 }
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
      const validation = rowSchema.safeParse(raw);

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
        const { data: rawExisting } = await admin
          .from("users")
          .select("*")
          .eq("email", row.email)
          .eq("tenant_id", tenantId)
          .limit(1);

        const existingUsers = (rawExisting ?? []) as unknown as User[];
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
          const { data: rawNewUsers, error: userCreateError } = await admin
            .from("users")
            .insert({
              tenant_id: tenantId,
              auth_id: authData.user.id,
              email: row.email,
              role: "employee",
            } as never)
            .select("*");

          const newUsers = (rawNewUsers ?? []) as unknown as User[];
          const newUser = newUsers.length > 0 ? newUsers[0] : null;

          if (userCreateError || !newUser) {
            result.errors.push({
              row: rowNum,
              field: "email",
              message: `Failed to create user record: ${userCreateError?.message || "unknown error"}`,
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

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[POST /api/import/employees] Unexpected error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
