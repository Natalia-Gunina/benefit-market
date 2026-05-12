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
  offering?: {
    id: string;
    name: string;
    description: string | null;
    providers?: { name: string } | null;
  };
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

export interface OrderItemInput {
  benefit_id?: string;
  tenant_offering_id?: string;
  quantity: number;
}

export async function createOrder(
  supabase: SupabaseClient,
  appUser: { id: string; tenant_id: string },
  items: Array<OrderItemInput>,
): Promise<{ order: OrderWithItems } | { error: ValidationError }> {
  const tenantId = appUser.tenant_id;

  // Separate legacy benefit items from marketplace items
  const legacyItems = items.filter((i) => i.benefit_id);
  const marketplaceItems = items.filter((i) => i.tenant_offering_id);

  // --- Fetch all requested legacy benefits ---
  const benefitIds = legacyItems.map((i) => i.benefit_id!);
  const benefitMap = new Map<string, Benefit>();

  if (benefitIds.length > 0) {
    const benefits = unwrapRows<Benefit>(
      await supabase
        .from("benefits")
        .select("*")
        .in("id", benefitIds)
        .eq("tenant_id", tenantId)
        .eq("is_active", true),
      "Fetch benefits for order",
    );
    for (const b of benefits) benefitMap.set(b.id, b);
  }

  // Verify each legacy benefit exists and is active
  for (const item of legacyItems) {
    const benefit = benefitMap.get(item.benefit_id!);
    if (!benefit) {
      return { error: { code: "benefit_not_available", message: `Льгота ${item.benefit_id} недоступна`, status: 400 } };
    }
    if (benefit.stock_limit !== null && benefit.stock_limit < item.quantity) {
      return { error: { code: "stock_exceeded", message: `Недостаточно единиц для "${benefit.name}". Доступно: ${benefit.stock_limit}`, status: 400 } };
    }
  }

  // --- Fetch marketplace offerings ---
  const admin = createAdminClient();
  interface ResolvedMarketplaceItem {
    tenant_offering_id: string;
    provider_offering_id: string;
    name: string;
    price_points: number;
    quantity: number;
  }
  const marketplaceResolved: ResolvedMarketplaceItem[] = [];

  for (const item of marketplaceItems) {
    const { data: rawTenantOffering } = await admin
      .from("tenant_offerings")
      .select("*, provider_offerings(id, name, base_price_points, status, stock_limit, providers(status))")
      .eq("id", item.tenant_offering_id!)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    const tenantOffering = rawTenantOffering as Record<string, unknown> | null;

    if (!tenantOffering) {
      return { error: { code: "benefit_not_available", message: `Предложение ${item.tenant_offering_id} недоступно`, status: 400 } };
    }

    const po = tenantOffering.provider_offerings as Record<string, unknown>;
    if (po.status !== "published") {
      return { error: { code: "benefit_not_available", message: `Предложение "${po.name}" не опубликовано`, status: 400 } };
    }

    const provider = po.providers as Record<string, unknown>;
    if (provider.status !== "verified") {
      return { error: { code: "benefit_not_available", message: `Провайдер не верифицирован`, status: 400 } };
    }

    const price = (tenantOffering.custom_price_points as number | null) ?? (po.base_price_points as number);
    const stockLimit = (tenantOffering.tenant_stock_limit as number | null) ?? (po.stock_limit as number | null);

    if (stockLimit !== null && stockLimit < item.quantity) {
      return { error: { code: "stock_exceeded", message: `Недостаточно единиц для "${po.name}". Доступно: ${stockLimit}`, status: 400 } };
    }

    marketplaceResolved.push({
      tenant_offering_id: item.tenant_offering_id!,
      provider_offering_id: po.id as string,
      name: po.name as string,
      price_points: price,
      quantity: item.quantity,
    });
  }

  // --- Check eligibility for legacy items ---
  const profileResult = await supabase
    .from("employee_profiles")
    .select("*")
    .eq("user_id", appUser.id)
    .eq("tenant_id", tenantId)
    .single();

  const profile = profileResult.data as EmployeeProfile | null;

  if (benefitIds.length > 0) {
    const rules = unwrapRowsSoft<EligibilityRule>(
      await supabase
        .from("eligibility_rules")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("benefit_id", benefitIds),
    );

    const rulesByBenefit = new Map<string, EligibilityRule[]>();
    for (const rule of rules) {
      if (!rule.benefit_id) continue;
      const existing = rulesByBenefit.get(rule.benefit_id) || [];
      existing.push(rule);
      rulesByBenefit.set(rule.benefit_id, existing);
    }

    for (const item of legacyItems) {
      const benefitRules = rulesByBenefit.get(item.benefit_id!) || [];
      if (!profile && benefitRules.length > 0) {
        return { error: { code: "benefit_not_eligible", message: `Вы не имеете права на "${benefitMap.get(item.benefit_id!)?.name}"`, status: 403 } };
      }
      if (profile && !checkEligibility(profile, benefitRules)) {
        return { error: { code: "benefit_not_eligible", message: `Вы не имеете права на "${benefitMap.get(item.benefit_id!)?.name}"`, status: 403 } };
      }
    }
  }

  // --- Calculate total_points ---
  const legacyTotal = legacyItems.reduce((sum, item) => {
    const benefit = benefitMap.get(item.benefit_id!)!;
    return sum + benefit.price_points * item.quantity;
  }, 0);

  const marketplaceTotal = marketplaceResolved.reduce((sum, item) => {
    return sum + item.price_points * item.quantity;
  }, 0);

  const totalPoints = legacyTotal + marketplaceTotal;

  // --- Check wallet balance across all active wallets ---
  // An employee can have multiple wallets simultaneously (e.g. different
  // accrual periods). Sum their available points for eligibility, then
  // reserve from the soonest-expiring wallets first so funds expire usefully.
  const now = new Date().toISOString();

  const wallets = unwrapRowsSoft<Wallet>(
    await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", appUser.id)
      .eq("tenant_id", tenantId)
      .gte("expires_at", now)
      .order("expires_at", { ascending: true }),
  );

  if (wallets.length === 0) {
    return { error: { code: "insufficient_points", message: "Кошелёк не найден или срок действия истёк", status: 400 } };
  }

  const totalAvailable = wallets.reduce(
    (sum, w) => sum + Math.max(0, w.balance - w.reserved),
    0,
  );
  if (totalAvailable < totalPoints) {
    return { error: { code: "insufficient_points", message: `Недостаточно баллов. Доступно: ${totalAvailable}, требуется: ${totalPoints}`, status: 400 } };
  }

  // Distribute the reservation across wallets in expiry order.
  const reservePlan: { wallet: Wallet; amount: number }[] = [];
  let remaining = totalPoints;
  for (const w of wallets) {
    if (remaining <= 0) break;
    const walletAvailable = Math.max(0, w.balance - w.reserved);
    if (walletAvailable <= 0) continue;
    const take = Math.min(walletAvailable, remaining);
    reservePlan.push({ wallet: w, amount: take });
    remaining -= take;
  }

  // --- Create order using admin client ---
  const adminWriter = createAdminClient();
  const reservedAt = new Date();
  const expiresAt = new Date(reservedAt.getTime() + 15 * 60 * 1000);

  // 1. Create order
  const order = unwrapSingle<Order>(
    await adminWriter
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
  const orderItemsData = [
    ...legacyItems.map((item) => {
      const benefit = benefitMap.get(item.benefit_id!)!;
      return {
        order_id: order.id,
        benefit_id: item.benefit_id!,
        quantity: item.quantity,
        price_points: benefit.price_points,
      };
    }),
    ...marketplaceResolved.map((item) => ({
      order_id: order.id,
      benefit_id: null,
      provider_offering_id: item.provider_offering_id,
      tenant_offering_id: item.tenant_offering_id,
      quantity: item.quantity,
      price_points: item.price_points,
    })),
  ];

  const { data: rawOrderItems, error: orderItemsError } = await adminWriter
    .from("order_items")
    .insert(orderItemsData as never)
    .select("*");

  if (orderItemsError) {
    logger.error("Order items creation failed", "order.service", { error: String(orderItemsError) });
    await adminWriter.from("orders").delete().eq("id", order.id);
    throw dbError("Ошибка создания элементов заказа");
  }

  // 3. Create point_ledger entries — one per wallet used in the reservation.
  // We aggregate per wallet so the history reads as a single reserve event
  // per source, rather than splitting by line item.
  const ledgerEntries = reservePlan.map(({ wallet: w, amount }) => ({
    wallet_id: w.id,
    tenant_id: tenantId,
    order_id: order.id,
    type: "reserve" as const,
    amount,
    description: `Резервирование заказа #${order.id.slice(0, 8)}`,
  }));

  const { error: ledgerError } = await adminWriter.from("point_ledger").insert(ledgerEntries as never);
  if (ledgerError) {
    logger.error("Ledger entries creation failed", "order.service", { error: String(ledgerError) });
  }

  // 4. Update each wallet's reserved column
  for (const { wallet: w, amount } of reservePlan) {
    const { error: walletUpdateError } = await adminWriter
      .from("wallets")
      .update({ reserved: w.reserved + amount } as never)
      .eq("id", w.id);
    if (walletUpdateError) {
      logger.error("Wallet update failed", "order.service", { walletId: w.id, error: String(walletUpdateError) });
    }
  }

  // Build response
  const orderItems = (rawOrderItems ?? []) as OrderItem[];
  const marketplaceMap = new Map(marketplaceResolved.map((m) => [m.tenant_offering_id, m]));

  const responseOrder: OrderWithItems = {
    ...order,
    order_items: orderItems.map((oi) => {
      if (oi.benefit_id && benefitMap.get(oi.benefit_id)) {
        const b = benefitMap.get(oi.benefit_id)!;
        return {
          ...oi,
          benefit: { id: b.id, name: b.name, price_points: b.price_points, description: b.description },
        };
      }
      if (oi.tenant_offering_id) {
        const m = marketplaceMap.get(oi.tenant_offering_id);
        return {
          ...oi,
          benefit: m ? { id: m.provider_offering_id, name: m.name, price_points: m.price_points, description: "" } : undefined,
        };
      }
      return { ...oi, benefit: undefined };
    }),
  };

  return { order: responseOrder };
}
