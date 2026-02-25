import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findApplicablePolicy } from "@/lib/budget";
import type {
  User,
  EmployeeProfile,
  BudgetPolicy,
  Wallet,
  PointLedger,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccrualResult {
  processed: number;
  accrued: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the current budget period label and expiration date based on
 * the policy's period type.
 */
function computePeriodInfo(period: BudgetPolicy["period"]): {
  periodLabel: string;
  expiresAt: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  switch (period) {
    case "monthly": {
      const monthStr = String(month + 1).padStart(2, "0");
      // Expires at the start of the next month
      const nextMonth = new Date(year, month + 1, 1);
      return {
        periodLabel: `${year}-M${monthStr}`,
        expiresAt: nextMonth.toISOString(),
      };
    }
    case "quarterly": {
      const quarter = Math.floor(month / 3) + 1;
      // Expires at the start of the next quarter
      const nextQuarterStartMonth = quarter * 3;
      const expiresDate = new Date(year, nextQuarterStartMonth, 1);
      return {
        periodLabel: `${year}-Q${quarter}`,
        expiresAt: expiresDate.toISOString(),
      };
    }
    case "yearly": {
      const expiresDate = new Date(year + 1, 0, 1);
      return {
        periodLabel: `${year}`,
        expiresAt: expiresDate.toISOString(),
      };
    }
    default: {
      // Fallback to quarterly
      const q = Math.floor(month / 3) + 1;
      const nextQStart = q * 3;
      return {
        periodLabel: `${year}-Q${q}`,
        expiresAt: new Date(year, nextQStart, 1).toISOString(),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// POST /api/wallets/accrual — Bulk point accrual (HR / admin only)
// ---------------------------------------------------------------------------

export async function POST() {
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
            message: "Only HR or admin users can perform accruals",
          },
        },
        { status: 403 }
      );
    }

    const tenantId = appUser.tenant_id;
    const admin = createAdminClient();

    // --- Fetch all active budget policies for this tenant ---
    const { data: rawPolicies, error: policiesError } = await admin
      .from("budget_policies")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    const policies = (rawPolicies ?? []) as unknown as BudgetPolicy[];

    if (policiesError || policies.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "NO_POLICIES",
            message: "No active budget policies found for this tenant",
          },
        },
        { status: 400 }
      );
    }

    // --- Fetch all employees with profiles in this tenant ---
    const { data: rawProfiles, error: profilesError } = await admin
      .from("employee_profiles")
      .select("*")
      .eq("tenant_id", tenantId);

    if (profilesError) {
      return NextResponse.json(
        {
          error: {
            code: "DB_ERROR",
            message: "Failed to fetch employee profiles",
          },
        },
        { status: 500 }
      );
    }

    const profiles = (rawProfiles ?? []) as unknown as EmployeeProfile[];

    if (profiles.length === 0) {
      return NextResponse.json({
        data: {
          processed: 0,
          accrued: 0,
          skipped: 0,
          errors: [],
        } satisfies AccrualResult,
      });
    }

    // --- Process each employee ---
    const result: AccrualResult = {
      processed: 0,
      accrued: 0,
      skipped: 0,
      errors: [],
    };

    for (const profile of profiles) {
      result.processed++;

      const userId = profile.user_id;

      // Find the best matching policy for this employee
      const policy = findApplicablePolicy(profile, policies);

      if (!policy) {
        result.skipped++;
        continue;
      }

      // Compute period info from the policy
      const { periodLabel, expiresAt } = computePeriodInfo(policy.period);

      try {
        // Check if wallet already exists for this user + period
        const { data: rawWallets } = await admin
          .from("wallets")
          .select("*")
          .eq("user_id", userId)
          .eq("tenant_id", tenantId)
          .eq("period", periodLabel)
          .limit(1);

        const existingWallets = (rawWallets ?? []) as unknown as Wallet[];
        const existingWallet = existingWallets.length > 0
          ? existingWallets[0]
          : null;

        if (existingWallet) {
          // Check if already accrued this period by looking for an accrual ledger entry
          const { data: rawAccruals } = await admin
            .from("point_ledger")
            .select("*")
            .eq("wallet_id", existingWallet.id)
            .eq("tenant_id", tenantId)
            .eq("type", "accrual")
            .limit(1);

          const existingAccruals = (rawAccruals ?? []) as unknown as PointLedger[];

          if (existingAccruals.length > 0) {
            // Already accrued for this period — skip
            result.skipped++;
            continue;
          }

          // Wallet exists but no accrual yet — add accrual
          const newBalance = existingWallet.balance + policy.points_amount;

          const { error: updateError } = await admin
            .from("wallets")
            .update({ balance: newBalance } as never)
            .eq("id", existingWallet.id);

          if (updateError) {
            result.errors.push(
              `Failed to update wallet for user ${userId}: ${updateError.message}`
            );
            continue;
          }

          // Insert ledger entry
          const { error: ledgerError } = await admin
            .from("point_ledger")
            .insert({
              wallet_id: existingWallet.id,
              tenant_id: tenantId,
              type: "accrual",
              amount: policy.points_amount,
              description: `Начисление баллов по политике «${policy.name}» за ${periodLabel}`,
            } as never);

          if (ledgerError) {
            result.errors.push(
              `Failed to insert ledger entry for user ${userId}: ${ledgerError.message}`
            );
            continue;
          }

          result.accrued++;
        } else {
          // No wallet yet — create one
          const { data: rawNewWallets, error: createError } = await admin
            .from("wallets")
            .insert({
              user_id: userId,
              tenant_id: tenantId,
              balance: policy.points_amount,
              reserved: 0,
              period: periodLabel,
              expires_at: expiresAt,
            } as never)
            .select("*");

          const newWallets = (rawNewWallets ?? []) as unknown as Wallet[];
          const newWallet = newWallets.length > 0 ? newWallets[0] : null;

          if (createError || !newWallet) {
            result.errors.push(
              `Failed to create wallet for user ${userId}: ${createError?.message || "unknown error"}`
            );
            continue;
          }

          // Insert ledger entry
          const { error: ledgerError } = await admin
            .from("point_ledger")
            .insert({
              wallet_id: newWallet.id,
              tenant_id: tenantId,
              type: "accrual",
              amount: policy.points_amount,
              description: `Начисление баллов по политике «${policy.name}» за ${periodLabel}`,
            } as never);

          if (ledgerError) {
            result.errors.push(
              `Failed to insert ledger entry for user ${userId}: ${ledgerError.message}`
            );
            continue;
          }

          result.accrued++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Unexpected error for user ${userId}: ${message}`);
      }
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[POST /api/wallets/accrual] Unexpected error:", err);
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
