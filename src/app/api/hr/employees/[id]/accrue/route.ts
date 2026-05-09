import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { notFound } from "@/lib/errors";
import { z } from "zod";
import type { Wallet, PointLedger } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

const accrueSchema = z.object({
  amount: z.number().int().positive().max(1_000_000),
  description: z.string().min(1).max(200),
});

// ---------------------------------------------------------------------------
// POST /api/hr/employees/[id]/accrue — manual accrual to employee wallet
// ---------------------------------------------------------------------------

export function POST(request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id: userId } = await context.params;
    const body = await request.json();
    const { amount, description } = parseBody(accrueSchema, body);

    if (isDemo) {
      const { DEMO_WALLETS, DEMO_LEDGER } = await import("@/lib/demo-data");
      const wallet = DEMO_WALLETS.find((w) => w.user_id === userId);
      if (!wallet) throw notFound("Wallet not found for this employee");

      wallet.balance += amount;

      const entry: PointLedger = {
        id: `demo-ledger-acc-${Date.now()}`,
        wallet_id: wallet.id,
        tenant_id: wallet.tenant_id,
        order_id: null,
        type: "accrual",
        amount,
        description,
        created_at: new Date().toISOString(),
      };
      DEMO_LEDGER.unshift(entry);

      return success({ wallet, ledger: entry });
    }

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    type WalletRow = Wallet;
    const wallet = unwrapSingleOrNull<WalletRow>(
      await admin
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .eq("tenant_id", appUser.tenant_id)
        .order("expires_at", { ascending: false })
        .limit(1)
        .single(),
    );
    if (!wallet) throw notFound("Wallet not found for this employee");

    const updated = unwrapSingle<WalletRow>(
      await admin
        .from("wallets")
        .update({ balance: wallet.balance + amount } as never)
        .eq("id", wallet.id)
        .select("*")
        .single(),
      "Failed to update wallet balance",
    );

    const ledger = unwrapSingle<PointLedger>(
      await admin
        .from("point_ledger")
        .insert({
          wallet_id: wallet.id,
          tenant_id: wallet.tenant_id,
          order_id: null,
          type: "accrual",
          amount,
          description,
        } as never)
        .select("*")
        .single(),
      "Failed to record ledger entry",
    );

    return success({ wallet: updated, ledger });
  }, "POST /api/hr/employees/[id]/accrue");
}
