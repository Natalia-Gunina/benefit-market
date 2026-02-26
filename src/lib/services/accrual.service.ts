import { unwrapRowsSoft } from "@/lib/supabase/typed-queries";
import { dbError } from "@/lib/errors";
import { findApplicablePolicy } from "@/lib/budget";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EmployeeProfile,
  BudgetPolicy,
  Wallet,
  PointLedger,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccrualResult {
  processed: number;
  accrued: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function computePeriodInfo(period: BudgetPolicy["period"]): {
  periodLabel: string;
  expiresAt: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case "monthly": {
      const monthStr = String(month + 1).padStart(2, "0");
      const nextMonth = new Date(year, month + 1, 1);
      return { periodLabel: `${year}-M${monthStr}`, expiresAt: nextMonth.toISOString() };
    }
    case "quarterly": {
      const quarter = Math.floor(month / 3) + 1;
      const nextQuarterStartMonth = quarter * 3;
      const expiresDate = new Date(year, nextQuarterStartMonth, 1);
      return { periodLabel: `${year}-Q${quarter}`, expiresAt: expiresDate.toISOString() };
    }
    case "yearly": {
      const expiresDate = new Date(year + 1, 0, 1);
      return { periodLabel: `${year}`, expiresAt: expiresDate.toISOString() };
    }
    default: {
      const q = Math.floor(month / 3) + 1;
      const nextQStart = q * 3;
      return { periodLabel: `${year}-Q${q}`, expiresAt: new Date(year, nextQStart, 1).toISOString() };
    }
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function processAccruals(
  admin: SupabaseClient,
  tenantId: string,
): Promise<AccrualResult> {
  // Fetch policies
  const policiesResult = await admin
    .from("budget_policies")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (policiesResult.error) throw dbError("Failed to fetch budget policies");

  const policies = unwrapRowsSoft<BudgetPolicy>(policiesResult);
  if (policies.length === 0) {
    return { processed: 0, accrued: 0, skipped: 0, errors: ["NO_POLICIES"] };
  }

  // Fetch employees
  const profilesResult = await admin.from("employee_profiles").select("*").eq("tenant_id", tenantId);
  if (profilesResult.error) throw dbError("Failed to fetch employee profiles");

  const profiles = unwrapRowsSoft<EmployeeProfile>(profilesResult);
  if (profiles.length === 0) {
    return { processed: 0, accrued: 0, skipped: 0, errors: [] };
  }

  const result: AccrualResult = { processed: 0, accrued: 0, skipped: 0, errors: [] };

  for (const profile of profiles) {
    result.processed++;
    const userId = profile.user_id;
    const policy = findApplicablePolicy(profile, policies);

    if (!policy) {
      result.skipped++;
      continue;
    }

    const { periodLabel, expiresAt } = computePeriodInfo(policy.period);

    try {
      const existingWallets = unwrapRowsSoft<Wallet>(
        await admin.from("wallets").select("*").eq("user_id", userId).eq("tenant_id", tenantId).eq("period", periodLabel).limit(1),
      );
      const existingWallet = existingWallets.length > 0 ? existingWallets[0] : null;

      if (existingWallet) {
        const existingAccruals = unwrapRowsSoft<PointLedger>(
          await admin.from("point_ledger").select("*").eq("wallet_id", existingWallet.id).eq("tenant_id", tenantId).eq("type", "accrual").limit(1),
        );

        if (existingAccruals.length > 0) {
          result.skipped++;
          continue;
        }

        const { error: updateError } = await admin
          .from("wallets")
          .update({ balance: existingWallet.balance + policy.points_amount } as never)
          .eq("id", existingWallet.id);

        if (updateError) {
          result.errors.push(`Failed to update wallet for user ${userId}: ${updateError.message}`);
          continue;
        }

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
          result.errors.push(`Failed to insert ledger entry for user ${userId}: ${ledgerError.message}`);
          continue;
        }

        result.accrued++;
      } else {
        const newWallets = unwrapRowsSoft<Wallet>(
          await admin
            .from("wallets")
            .insert({
              user_id: userId,
              tenant_id: tenantId,
              balance: policy.points_amount,
              reserved: 0,
              period: periodLabel,
              expires_at: expiresAt,
            } as never)
            .select("*"),
        );

        const newWallet = newWallets.length > 0 ? newWallets[0] : null;
        if (!newWallet) {
          result.errors.push(`Failed to create wallet for user ${userId}: unknown error`);
          continue;
        }

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
          result.errors.push(`Failed to insert ledger entry for user ${userId}: ${ledgerError.message}`);
          continue;
        }

        result.accrued++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Unexpected error for user ${userId}: ${message}`);
    }
  }

  return result;
}
