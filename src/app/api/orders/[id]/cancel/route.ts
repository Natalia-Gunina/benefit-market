import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { unwrapRowsSoft, unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { notFound, forbidden, invalidStatus, walletNotFound } from "@/lib/errors";
import { demoOrderAction } from "@/lib/demo/demo-service";
import type { Order, PointLedger, Wallet } from "@/lib/types";

// ---------------------------------------------------------------------------
// POST /api/orders/[id]/cancel — Cancel a reserved order
// ---------------------------------------------------------------------------

export function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id: orderId } = await params;

    if (isDemo) return demoOrderAction(orderId, "cancelled");

    const appUser = await requireAuth();
    const supabase = await createClient();

    // --- Get order ---
    const order = unwrapSingleOrNull<Order>(
      await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single(),
    );

    if (!order) {
      throw notFound("Заказ не найден");
    }

    // --- Verify ownership ---
    if (order.user_id !== appUser.id) {
      throw forbidden("Нет доступа к этому заказу");
    }

    // --- Check status ---
    if (order.status !== "reserved") {
      throw invalidStatus(
        `Невозможно отменить заказ со статусом "${order.status}"`,
      );
    }

    // --- Locate the wallets that hold this order's reservation ---
    const reserves = unwrapRowsSoft<PointLedger>(
      await supabase
        .from("point_ledger")
        .select("wallet_id, amount")
        .eq("order_id", orderId)
        .eq("type", "reserve"),
    );

    if (reserves.length === 0) {
      throw walletNotFound("Резервирование не найдено");
    }

    const walletIds = Array.from(new Set(reserves.map((r) => r.wallet_id)));
    const wallets = unwrapRowsSoft<Wallet>(
      await supabase.from("wallets").select("*").in("id", walletIds),
    );
    const walletById = new Map(wallets.map((w) => [w.id, w]));

    // --- Cancel using admin client ---
    const admin = createAdminClient();

    // 1. Update order status to 'cancelled'
    const updatedOrder = unwrapSingle<Order>(
      await admin
        .from("orders")
        .update({ status: "cancelled" } as never)
        .eq("id", orderId)
        .select("*")
        .single(),
      "Update order to cancelled",
    );

    // 2. Aggregate per-wallet, write one release ledger entry per wallet,
    // and unblock the reservation on each wallet.
    const perWallet = new Map<string, number>();
    for (const r of reserves) {
      perWallet.set(r.wallet_id, (perWallet.get(r.wallet_id) ?? 0) + r.amount);
    }

    const releaseEntries = Array.from(perWallet.entries()).map(([walletId, amount]) => ({
      wallet_id: walletId,
      tenant_id: appUser.tenant_id,
      order_id: orderId,
      type: "release" as const,
      amount,
      description: `Отмена заказа #${orderId.slice(0, 8)}`,
    }));
    await admin.from("point_ledger").insert(releaseEntries as never);

    for (const [walletId, amount] of perWallet) {
      const w = walletById.get(walletId);
      if (!w) continue;
      await admin
        .from("wallets")
        .update({ reserved: Math.max(0, w.reserved - amount) } as never)
        .eq("id", walletId);
    }

    return success(updatedOrder);
  }, "POST /api/orders/[id]/cancel");
}
