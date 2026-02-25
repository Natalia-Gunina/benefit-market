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
      return success({ wallet: DEMO_WALLET, ledger: DEMO_LEDGER });
    }

    const appUser = await requireAuth();
    const tenantId = appUser.tenant_id;
    const supabase = await createClient();

    // --- Get active wallet (not expired) ---
    const now = new Date().toISOString();

    const wallets = unwrapRowsSoft<Wallet>(
      await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", appUser.id)
        .eq("tenant_id", tenantId)
        .gte("expires_at", now)
        .order("expires_at", { ascending: false })
        .limit(1),
    );

    const wallet = wallets.length > 0 ? wallets[0] : null;

    if (!wallet) {
      // No active wallet — return zeros
      return success({
        balance: 0,
        reserved: 0,
        available: 0,
        period: "",
        expires_at: "",
        history: [],
      } satisfies WalletBalanceResponse);
    }

    // --- Get point_ledger history for this wallet (last 50 entries) ---
    const history = unwrapRowsSoft<PointLedger>(
      await supabase
        .from("point_ledger")
        .select("*")
        .eq("wallet_id", wallet.id)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50),
    );

    // --- Build response ---
    const available = wallet.balance - wallet.reserved;

    const data: WalletBalanceResponse = {
      balance: wallet.balance,
      reserved: wallet.reserved,
      available: Math.max(0, available),
      period: wallet.period,
      expires_at: wallet.expires_at,
      history,
    };

    return success(data);
  }, "GET /api/wallets/me");
}
