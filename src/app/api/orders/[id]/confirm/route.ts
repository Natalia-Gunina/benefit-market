import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order, User, Wallet } from "@/lib/types";

// ---------------------------------------------------------------------------
// POST /api/orders/[id]/confirm — Confirm a reserved order
// ---------------------------------------------------------------------------

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orderId } = await params;
    const supabase = await createClient();

    // --- Authenticate ---
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Требуется авторизация" } },
        { status: 401 },
      );
    }

    const { data: rawUser, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", authUser.id)
      .single();

    const appUser = rawUser as unknown as User | null;

    if (userError || !appUser) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "Пользователь не найден" } },
        { status: 404 },
      );
    }

    // --- Get order ---
    const { data: rawOrder, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    const order = rawOrder as unknown as Order | null;

    if (orderError || !order) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Заказ не найден" } },
        { status: 404 },
      );
    }

    // --- Verify ownership ---
    if (order.user_id !== appUser.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Нет доступа к этому заказу" } },
        { status: 403 },
      );
    }

    // --- Check status ---
    if (order.status !== "reserved") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATUS",
            message: `Невозможно подтвердить заказ со статусом "${order.status}"`,
          },
        },
        { status: 400 },
      );
    }

    // --- Check expiration ---
    if (new Date(order.expires_at) <= new Date()) {
      return NextResponse.json(
        {
          error: {
            code: "ORDER_EXPIRED",
            message: "Срок резервирования заказа истёк",
          },
        },
        { status: 400 },
      );
    }

    // --- Get wallet ---
    const now = new Date().toISOString();
    const { data: rawWallets } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", appUser.id)
      .eq("tenant_id", appUser.tenant_id)
      .gte("expires_at", now)
      .order("expires_at", { ascending: false })
      .limit(1);

    const wallets = (rawWallets ?? []) as unknown as Wallet[];
    const wallet = wallets.length > 0 ? wallets[0] : null;

    if (!wallet) {
      return NextResponse.json(
        {
          error: {
            code: "WALLET_NOT_FOUND",
            message: "Кошелёк не найден",
          },
        },
        { status: 400 },
      );
    }

    // --- Confirm using admin client ---
    const admin = createAdminClient();
    const totalPoints = order.total_points;

    // 1. Update order status to 'paid'
    const { data: updatedRaw, error: updateError } = await admin
      .from("orders")
      .update({ status: "paid" } as never)
      .eq("id", orderId)
      .select("*")
      .single();

    if (updateError) {
      console.error("[POST /api/orders/confirm] Update failed:", updateError);
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: "Ошибка обновления заказа" } },
        { status: 500 },
      );
    }

    // 2. Create point_ledger entry (type='spend')
    await admin.from("point_ledger").insert({
      wallet_id: wallet.id,
      tenant_id: appUser.tenant_id,
      order_id: orderId,
      type: "spend",
      amount: totalPoints,
      description: `Оплата заказа #${orderId.slice(0, 8)}`,
    } as never);

    // 3. Update wallet: balance -= total_points, reserved -= total_points
    await admin
      .from("wallets")
      .update({
        balance: wallet.balance - totalPoints,
        reserved: wallet.reserved - totalPoints,
      } as never)
      .eq("id", wallet.id);

    const updatedOrder = updatedRaw as unknown as Order;

    return NextResponse.json({ data: updatedOrder });
  } catch (err) {
    console.error("[POST /api/orders/confirm] Unexpected error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" } },
      { status: 500 },
    );
  }
}
