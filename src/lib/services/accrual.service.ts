import { unwrapRowsSoft } from "@/lib/supabase/typed-queries";
import { dbError } from "@/lib/errors";
import { evaluateConditions } from "@/lib/domain/condition-evaluator";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EmployeeProfile,
  BudgetPolicy,
  Wallet,
  IndividualAccrual,
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
// Period helpers
// ---------------------------------------------------------------------------

export function computeNextAccrual(
  from: Date | string,
  period: BudgetPolicy["period"],
): string {
  const d = typeof from === "string" ? new Date(from) : new Date(from.getTime());
  switch (period) {
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "semiannual":
      d.setMonth(d.getMonth() + 6);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

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
    case "semiannual": {
      const half = month < 6 ? 1 : 2;
      const expiresDate = new Date(year, half === 1 ? 6 : 12, 1);
      return { periodLabel: `${year}-H${half}`, expiresAt: expiresDate.toISOString() };
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
// Internal: accrue points to the active wallet for a single user.
// Creates the wallet on first accrual.
// ---------------------------------------------------------------------------

async function accrueToWallet(
  admin: SupabaseClient,
  params: {
    tenantId: string;
    userId: string;
    amount: number;
    description: string;
    period: BudgetPolicy["period"];
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tenantId, userId, amount, description, period } = params;
  const { periodLabel, expiresAt } = computePeriodInfo(period);

  const wallets = unwrapRowsSoft<Wallet>(
    await admin
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("period", periodLabel)
      .limit(1),
  );

  let wallet = wallets[0];
  if (!wallet) {
    const inserted = unwrapRowsSoft<Wallet>(
      await admin
        .from("wallets")
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          balance: 0,
          reserved: 0,
          period: periodLabel,
          expires_at: expiresAt,
        } as never)
        .select("*"),
    );
    if (inserted.length === 0) {
      return { ok: false, error: `wallet create failed for user ${userId}` };
    }
    wallet = inserted[0];
  }

  const { error: updateError } = await admin
    .from("wallets")
    .update({ balance: wallet.balance + amount } as never)
    .eq("id", wallet.id);
  if (updateError) return { ok: false, error: updateError.message };

  const { error: ledgerError } = await admin
    .from("point_ledger")
    .insert({
      wallet_id: wallet.id,
      tenant_id: tenantId,
      type: "accrual",
      amount,
      description,
    } as never);
  if (ledgerError) return { ok: false, error: ledgerError.message };

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Public: process all due accruals for a tenant
// ---------------------------------------------------------------------------

/**
 * Compute how many points an employee receives from a single policy. With the
 * new per-rule-points format (target_filter.rule_groups), the result is the
 * sum of all rule_groups whose single condition matches the employee. Falls
 * back to the legacy {match_all + policy.points_amount} format when the new
 * shape is absent.
 */
export function computePolicyAccrualAmount(
  profile: EmployeeProfile,
  policy: BudgetPolicy,
): number {
  const filter = (policy.target_filter ?? {}) as {
    rule_groups?: Array<{
      field: string;
      operator: string;
      value: number | string;
      points_amount?: number;
    }>;
    match_all?: Array<{ field: string; operator: string; value: number | string }>;
  };

  if (Array.isArray(filter.rule_groups) && filter.rule_groups.length > 0) {
    let total = 0;
    for (const rg of filter.rule_groups) {
      if (evaluateConditions(profile, { match_all: [rg] })) {
        total += rg.points_amount ?? 0;
      }
    }
    return total;
  }

  if (evaluateConditions(profile, filter)) {
    return policy.points_amount;
  }
  return 0;
}

/**
 * Walks every active budget_policy and individual_accrual whose
 * `next_accrual_date` is on or before `asOf` and credits the corresponding
 * employees. Each policy/accrual can be applied multiple times in one call
 * if it is overdue by several periods.
 *
 * Replacement individual accruals exclude the target employee from policy
 * accruals; addition accruals are applied on top of policies.
 */
export async function processAccruals(
  admin: SupabaseClient,
  tenantId: string,
  asOf: Date = new Date(),
): Promise<AccrualResult> {
  const asOfDate = asOf.toISOString().slice(0, 10);
  const result: AccrualResult = { processed: 0, accrued: 0, skipped: 0, errors: [] };

  // ---- Load employees and individual accruals up-front ----

  const profilesResult = await admin
    .from("employee_profiles")
    .select("*")
    .eq("tenant_id", tenantId);
  if (profilesResult.error) throw dbError("Failed to fetch employee profiles");
  const profiles = unwrapRowsSoft<EmployeeProfile>(profilesResult);

  const indResult = await admin
    .from("individual_accruals")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (indResult.error) throw dbError("Failed to fetch individual accruals");
  const individualAccruals = unwrapRowsSoft<IndividualAccrual>(indResult);

  const replacementUserIds = new Set(
    individualAccruals.filter((a) => a.mode === "replacement").map((a) => a.user_id),
  );

  // ---- Process budget policies ----

  const policiesResult = await admin
    .from("budget_policies")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .lte("next_accrual_date", asOfDate);
  if (policiesResult.error) throw dbError("Failed to fetch budget policies");
  const policies = unwrapRowsSoft<BudgetPolicy>(policiesResult);

  for (const policy of policies) {
    let nextDate = policy.next_accrual_date;

    while (nextDate <= asOfDate) {
      const periodDate = nextDate; // capture for description
      for (const profile of profiles) {
        if (replacementUserIds.has(profile.user_id)) continue;
        const amount = computePolicyAccrualAmount(profile, policy);
        if (amount <= 0) continue;

        result.processed++;
        const outcome = await accrueToWallet(admin, {
          tenantId,
          userId: profile.user_id,
          amount,
          description: `Начисление по политике «${policy.name}» (${periodDate})`,
          period: policy.period,
        });
        if (outcome.ok) result.accrued++;
        else result.errors.push(`policy ${policy.id} -> user ${profile.user_id}: ${outcome.error}`);
      }
      nextDate = computeNextAccrual(nextDate, policy.period);
    }

    if (nextDate !== policy.next_accrual_date) {
      await admin
        .from("budget_policies")
        .update({
          last_accrual_date: asOfDate,
          next_accrual_date: nextDate,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", policy.id);
    }
  }

  // ---- Process individual accruals ----

  const indDue = individualAccruals.filter((a) => a.next_accrual_date <= asOfDate);
  for (const acc of indDue) {
    let nextDate = acc.next_accrual_date;
    while (nextDate <= asOfDate) {
      const periodDate = nextDate;
      result.processed++;
      const outcome = await accrueToWallet(admin, {
        tenantId,
        userId: acc.user_id,
        amount: acc.points_amount,
        description:
          acc.mode === "replacement"
            ? `Индивидуальное начисление (замена политики) ${periodDate}${acc.description ? ` — ${acc.description}` : ""}`
            : `Индивидуальное начисление (дополнение) ${periodDate}${acc.description ? ` — ${acc.description}` : ""}`,
        period: acc.period,
      });
      if (outcome.ok) result.accrued++;
      else result.errors.push(`individual ${acc.id} -> user ${acc.user_id}: ${outcome.error}`);
      nextDate = computeNextAccrual(nextDate, acc.period);
    }
    if (nextDate !== acc.next_accrual_date) {
      await admin
        .from("individual_accruals")
        .update({
          last_accrual_date: asOfDate,
          next_accrual_date: nextDate,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", acc.id);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public: apply a single just-created policy / individual accrual if first
// accrual date is today (used right after creation).
// ---------------------------------------------------------------------------

export async function applyImmediateAccrualForPolicy(
  admin: SupabaseClient,
  tenantId: string,
  _policyId: string,
): Promise<AccrualResult> {
  // Lean wrapper that just triggers processAccruals; the loop will naturally
  // pick up the new policy because we set next_accrual_date = first_accrual_date.
  return processAccruals(admin, tenantId);
}

export async function applyImmediateAccrualForIndividual(
  admin: SupabaseClient,
  tenantId: string,
  _individualAccrualId: string,
): Promise<AccrualResult> {
  return processAccruals(admin, tenantId);
}

// ---------------------------------------------------------------------------
// Public: per-employee accrued totals (Исходный лимит) for the current wallet
// ---------------------------------------------------------------------------

/**
 * Returns a map of `userId -> total accrued points` summed across all active
 * (non-expired) wallets the user has. An employee can hold multiple wallets at
 * once when policies and individual accruals use different periods — the HR
 * "Исходный лимит" column should reflect everything that was accrued for the
 * current period(s).
 */
export async function fetchInitialLimits(
  admin: SupabaseClient,
  tenantId: string,
  userIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (userIds.length === 0) return map;

  type WalletWithLedger = Wallet & {
    point_ledger?: { amount: number; type: string }[];
  };

  const nowIso = new Date().toISOString();

  const rows = unwrapRowsSoft<WalletWithLedger>(
    await admin
      .from("wallets")
      .select("id, user_id, tenant_id, balance, reserved, period, expires_at, point_ledger(amount, type)")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds)
      .gte("expires_at", nowIso),
  );

  for (const w of rows) {
    const ledger = w.point_ledger ?? [];
    const accrued = ledger
      .filter((l) => l.type === "accrual")
      .reduce((s, l) => s + l.amount, 0);
    map.set(w.user_id, (map.get(w.user_id) ?? 0) + accrued);
  }

  return map;
}

/**
 * Returns a map of `userId -> { balance, reserved }` summed across all active
 * (non-expired) wallets. Mirrors the logic of fetchInitialLimits so that the
 * HR list shows the same combined balance the employee sees in their own
 * wallet view.
 */
export async function fetchActiveWalletBalances(
  admin: SupabaseClient,
  tenantId: string,
  userIds: string[],
): Promise<Map<string, { balance: number; reserved: number }>> {
  const map = new Map<string, { balance: number; reserved: number }>();
  if (userIds.length === 0) return map;

  const nowIso = new Date().toISOString();

  const wallets = unwrapRowsSoft<Wallet>(
    await admin
      .from("wallets")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds)
      .gte("expires_at", nowIso),
  );

  for (const w of wallets) {
    const prev = map.get(w.user_id) ?? { balance: 0, reserved: 0 };
    prev.balance += w.balance;
    prev.reserved += w.reserved;
    map.set(w.user_id, prev);
  }

  return map;
}
