import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { unwrapRowsSoft, unwrapSingle, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { notFound, forbidden, invalidStatus, walletNotFound } from "@/lib/errors";
import { demoOrderAction } from "@/lib/demo/demo-service";
import type { Order, Wallet } from "@/lib/types";

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

    // --- Get wallet ---
    const now = new Date().toISOString();
    const wallets = unwrapRowsSoft<Wallet>(
      await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", appUser.id)
        .eq("tenant_id", appUser.tenant_id)
        .gte("expires_at", now)
        .order("expires_at", { ascending: false })
        .limit(1),
    );

    const wallet = wallets.length > 0 ? wallets[0] : null;

    if (!wallet) {
      throw walletNotFound("Кошелёк не найден");
    }

    // --- Cancel using admin client ---
    const admin = createAdminClient();
    const totalPoints = order.total_points;

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

    // 2. Create point_ledger entry (type='release')
    await admin.from("point_ledger").insert({
      wallet_id: wallet.id,
      tenant_id: appUser.tenant_id,
      order_id: orderId,
      type: "release",
      amount: totalPoints,
      description: `Отмена заказа #${orderId.slice(0, 8)}`,
    } as never);

    // 3. Update wallet: reserved -= total_points
    await admin
      .from("wallets")
      .update({
        reserved: Math.max(0, wallet.reserved - totalPoints),
      } as never)
      .eq("id", wallet.id);

    return success(updatedOrder);
  }, "POST /api/orders/[id]/cancel");
}
