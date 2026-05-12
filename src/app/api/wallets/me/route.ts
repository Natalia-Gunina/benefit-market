import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { unwrapRowsSoft } from "@/lib/supabase/typed-queries";
import type { Wallet, PointLedger } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WalletBalanceResponse {
  balance: number;
  reserved: number;
  available: number;
  period: string;
  expires_at: string;
  history: PointLedger[];
}

// ---------------------------------------------------------------------------
// GET /api/wallets/me — Current user's wallet balance + ledger history
// ---------------------------------------------------------------------------

export function GET() {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_WALLET, DEMO_LEDGER } = await import("@/lib/demo-data");
      const ledger = DEMO_LEDGER
        .filter((e) => e.wallet_id === DEMO_WALLET.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return success({ wallet: DEMO_WALLET, ledger });
    }

    const appUser = await requireAuth();
    const tenantId = appUser.tenant_id;
    const supabase = await createClient();

    // --- Get all active wallets (not expired) and sum them up ---
    // An employee can have multiple wallets at once if accruals use different
    // periods (e.g., monthly policy + quarterly individual accrual). The user
    // should see a single combined balance.
    const now = new Date().toISOString();

    const wallets = unwrapRowsSoft<Wallet>(
      await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", appUser.id)
        .eq("tenant_id", tenantId)
        .gte("expires_at", now)
        .order("expires_at", { ascending: false }),
    );

    if (wallets.length === 0) {
      return success({
        balance: 0,
        reserved: 0,
        available: 0,
        period: "",
        expires_at: "",
        history: [],
      } satisfies WalletBalanceResponse);
    }

    const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);
    const totalReserved = wallets.reduce((s, w) => s + w.reserved, 0);
    const available = Math.max(0, totalBalance - totalReserved);

    // Period/expires_at: take from the wallet that expires soonest — that's the
    // next deadline the user should care about.
    const earliest = [...wallets].sort((a, b) =>
      a.expires_at.localeCompare(b.expires_at),
    )[0];

    // --- Get point_ledger history across all active wallets ---
    const walletIds = wallets.map((w) => w.id);
    const history = unwrapRowsSoft<PointLedger>(
      await supabase
        .from("point_ledger")
        .select("*")
        .in("wallet_id", walletIds)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50),
    );

    const data: WalletBalanceResponse = {
      balance: totalBalance,
      reserved: totalReserved,
      available,
      period: earliest.period,
      expires_at: earliest.expires_at,
      history,
    };

    return success(data);
  }, "GET /api/wallets/me");
}
