import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User, Wallet, PointLedger } from "@/lib/types";

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

export async function GET() {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const { DEMO_WALLET, DEMO_LEDGER } = await import("@/lib/demo-data");
      return NextResponse.json({ data: { wallet: DEMO_WALLET, ledger: DEMO_LEDGER } });
    }

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

    const tenantId = appUser.tenant_id;

    // --- Get active wallet (not expired) ---
    const now = new Date().toISOString();

    const { data: rawWallets, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", appUser.id)
      .eq("tenant_id", tenantId)
      .gte("expires_at", now)
      .order("expires_at", { ascending: false })
      .limit(1);

    const wallets = (rawWallets ?? []) as unknown as Wallet[];
    const wallet = wallets.length > 0 ? wallets[0] : null;

    if (walletError || !wallet) {
      // No active wallet — return zeros
      return NextResponse.json({
        data: {
          balance: 0,
          reserved: 0,
          available: 0,
          period: "",
          expires_at: "",
          history: [],
        } satisfies WalletBalanceResponse,
      });
    }

    // --- Get point_ledger history for this wallet (last 50 entries) ---
    const { data: rawHistory } = await supabase
      .from("point_ledger")
      .select("*")
      .eq("wallet_id", wallet.id)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50);

    const history = (rawHistory ?? []) as unknown as PointLedger[];

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

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/wallets/me] Unexpected error:", err);
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
