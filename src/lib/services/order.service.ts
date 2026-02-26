import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRows, unwrapRowsSoft, unwrapSingle } from "@/lib/supabase/typed-queries";
import { dbError } from "@/lib/errors";
import { checkEligibility } from "@/lib/eligibility";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Benefit,
  EligibilityRule,
  EmployeeProfile,
  Order,
  OrderItem,
  Wallet,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderItemWithBenefit extends OrderItem {
  benefit?: Pick<Benefit, "id" | "name" | "price_points" | "description">;
}

export interface OrderWithItems extends Order {
  order_items: OrderItemWithBenefit[];
}

export interface CreateOrderResult {
  order: OrderWithItems;
}

export interface ValidationError {
  code: string;
  message: string;
  status: number;
}

// ---------------------------------------------------------------------------
// Create Order (Reserve)
// ---------------------------------------------------------------------------

export async function createOrder(
  supabase: SupabaseClient,
  appUser: { id: string; tenant_id: string },
  items: Array<{ benefit_id: string; quantity: number }>,
): Promise<{ order: OrderWithItems } | { error: ValidationError }> {
  const tenantId = appUser.tenant_id;

  // --- Fetch all requested benefits ---
  const benefitIds = items.map((i) => i.benefit_id);

  const benefits = unwrapRows<Benefit>(
    await supabase
      .from("benefits")
      .select("*")
      .in("id", benefitIds)
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    "Fetch benefits for order",
  );

  const benefitMap = new Map(benefits.map((b) => [b.id, b]));

  // Verify each benefit exists and is active
  for (const item of items) {
    const benefit = benefitMap.get(item.benefit_id);
    if (!benefit) {
      return { error: { code: "benefit_not_available", message: `Льгота ${item.benefit_id} недоступна`, status: 400 } };
    }
    if (benefit.stock_limit !== null && benefit.stock_limit < item.quantity) {
      return { error: { code: "stock_exceeded", message: `Недостаточно единиц для "${benefit.name}". Доступно: ${benefit.stock_limit}`, status: 400 } };
    }
  }

  // --- Check eligibility ---
  const profileResult = await supabase
    .from("employee_profiles")
    .select("*")
    .eq("user_id", appUser.id)
    .eq("tenant_id", tenantId)
    .single();

  const profile = profileResult.data as EmployeeProfile | null;

  const rules = unwrapRowsSoft<EligibilityRule>(
    await supabase
      .from("eligibility_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("benefit_id", benefitIds),
  );

  const rulesByBenefit = new Map<string, EligibilityRule[]>();
  for (const rule of rules) {
    const existing = rulesByBenefit.get(rule.benefit_id) || [];
    existing.push(rule);
    rulesByBenefit.set(rule.benefit_id, existing);
  }

  for (const item of items) {
    const benefitRules = rulesByBenefit.get(item.benefit_id) || [];
    if (!profile && benefitRules.length > 0) {
      return { error: { code: "benefit_not_eligible", message: `Вы не имеете права на "${benefitMap.get(item.benefit_id)?.name}"`, status: 403 } };
    }
    if (profile && !checkEligibility(profile, benefitRules)) {
      return { error: { code: "benefit_not_eligible", message: `Вы не имеете права на "${benefitMap.get(item.benefit_id)?.name}"`, status: 403 } };
    }
  }

  // --- Calculate total_points ---
  const totalPoints = items.reduce((sum, item) => {
    const benefit = benefitMap.get(item.benefit_id)!;
    return sum + benefit.price_points * item.quantity;
  }, 0);

  // --- Check wallet balance ---
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
    return { error: { code: "insufficient_points", message: "Кошелёк не найден или срок действия истёк", status: 400 } };
  }

  const available = wallet.balance - wallet.reserved;
  if (available < totalPoints) {
    return { error: { code: "insufficient_points", message: `Недостаточно баллов. Доступно: ${available}, требуется: ${totalPoints}`, status: 400 } };
  }

  // --- Create order using admin client ---
  const admin = createAdminClient();
  const reservedAt = new Date();
  const expiresAt = new Date(reservedAt.getTime() + 15 * 60 * 1000);

  // 1. Create order
  const order = unwrapSingle<Order>(
    await admin
      .from("orders")
      .insert({
        user_id: appUser.id,
        tenant_id: tenantId,
        status: "reserved",
        total_points: totalPoints,
        reserved_at: reservedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      } as never)
      .select("*")
      .single(),
    "Create order",
  );

  // 2. Create order_items
  const orderItemsData = items.map((item) => {
    const benefit = benefitMap.get(item.benefit_id)!;
    return {
      order_id: order.id,
      benefit_id: item.benefit_id,
      quantity: item.quantity,
      price_points: benefit.price_points,
    };
  });

  const { data: rawOrderItems, error: orderItemsError } = await admin
    .from("order_items")
    .insert(orderItemsData as never)
    .select("*");

  if (orderItemsError) {
    logger.error("Order items creation failed", "order.service", { error: String(orderItemsError) });
    await admin.from("orders").delete().eq("id", order.id);
    throw dbError("Ошибка создания элементов заказа");
  }

  // 3. Create point_ledger entries
  const ledgerEntries = items.map((item) => {
    const benefit = benefitMap.get(item.benefit_id)!;
    return {
      wallet_id: wallet.id,
      tenant_id: tenantId,
      order_id: order.id,
      type: "reserve" as const,
      amount: benefit.price_points * item.quantity,
      description: `Резервирование: ${benefit.name} x${item.quantity}`,
    };
  });

  const { error: ledgerError } = await admin.from("point_ledger").insert(ledgerEntries as never);
  if (ledgerError) {
    logger.error("Ledger entries creation failed", "order.service", { error: String(ledgerError) });
  }

  // 4. Update wallet.reserved
  const { error: walletUpdateError } = await admin
    .from("wallets")
    .update({ reserved: wallet.reserved + totalPoints } as never)
    .eq("id", wallet.id);

  if (walletUpdateError) {
    logger.error("Wallet update failed", "order.service", { error: String(walletUpdateError) });
  }

  // Build response
  const orderItems = (rawOrderItems ?? []) as OrderItem[];
  const responseOrder: OrderWithItems = {
    ...order,
    order_items: orderItems.map((oi) => ({
      ...oi,
      benefit: benefitMap.get(oi.benefit_id)
        ? {
            id: benefitMap.get(oi.benefit_id)!.id,
            name: benefitMap.get(oi.benefit_id)!.name,
            price_points: benefitMap.get(oi.benefit_id)!.price_points,
            description: benefitMap.get(oi.benefit_id)!.description,
          }
        : undefined,
    })),
  };

  return { order: responseOrder };
}
