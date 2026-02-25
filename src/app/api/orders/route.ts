import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkEligibility } from "@/lib/eligibility";
import type {
  Benefit,
  EligibilityRule,
  EmployeeProfile,
  Order,
  OrderItem,
  User,
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

interface OrdersListResponse {
  data: OrderWithItems[];
  meta: {
    page: number;
    per_page: number;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        benefit_id: z.string().uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1, "Корзина не может быть пустой"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) return null;

  const { data: rawUser, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .single();

  if (userError || !rawUser) return null;

  return rawUser as unknown as User;
}

// ---------------------------------------------------------------------------
// GET /api/orders — List orders for current user
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const { DEMO_ORDERS, DEMO_ORDER_ITEMS, DEMO_BENEFITS } = await import("@/lib/demo-data");
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status");
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
      const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
      const offset = (page - 1) * perPage;

      const benefitMap = new Map(DEMO_BENEFITS.map(b => [b.id, b]));
      let filtered = DEMO_ORDERS;
      if (status) filtered = filtered.filter(o => o.status === status);

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + perPage);

      const data: OrderWithItems[] = paginated.map(order => ({
        ...order,
        order_items: DEMO_ORDER_ITEMS
          .filter(oi => oi.order_id === order.id)
          .map(oi => {
            const b = benefitMap.get(oi.benefit_id);
            return {
              ...oi,
              benefit: b ? { id: b.id, name: b.name, price_points: b.price_points, description: b.description } : undefined,
            };
          }),
      }));

      return NextResponse.json({ data, meta: { page, per_page: perPage, total } });
    }

    const supabase = await createClient();
    const appUser = await getAuthenticatedUser(supabase);

    if (!appUser) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Требуется авторизация" } },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)),
    );
    const offset = (page - 1) * perPage;

    // Build query based on role
    let query = supabase
      .from("orders")
      .select("*, order_items(*, benefits(id, name, price_points, description))", {
        count: "exact",
      });

    if (appUser.role === "employee") {
      query = query.eq("user_id", appUser.id);
    } else {
      // hr/admin see all tenant orders
      query = query.eq("tenant_id", appUser.tenant_id);
    }

    if (status) {
      query = query.eq("status", status);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    const { data: rawOrders, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: "Ошибка загрузки заказов" } },
        { status: 500 },
      );
    }

    // Shape the response: rename nested `benefits` to `benefit`
    const orders: OrderWithItems[] = ((rawOrders ?? []) as unknown[]).map(
      (raw: unknown) => {
        const order = raw as Order & {
          order_items: (OrderItem & {
            benefits?: Pick<Benefit, "id" | "name" | "price_points" | "description">;
          })[];
        };
        return {
          ...order,
          order_items: order.order_items.map((oi) => {
            const { benefits, ...rest } = oi;
            return { ...rest, benefit: benefits ?? undefined };
          }),
        };
      },
    );

    return NextResponse.json({
      data: orders,
      meta: { page, per_page: perPage, total: count ?? 0 },
    } satisfies OrdersListResponse);
  } catch (err) {
    console.error("[GET /api/orders] Unexpected error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/orders — Create a new order (reserve)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      const { DEMO_BENEFITS } = await import("@/lib/demo-data");
      const body = await request.json();
      const parsed = createOrderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Некорректные данные" } },
          { status: 400 },
        );
      }
      const { items } = parsed.data;
      const benefitMap = new Map(DEMO_BENEFITS.map(b => [b.id, b]));
      const totalPoints = items.reduce((sum, item) => {
        const benefit = benefitMap.get(item.benefit_id);
        return sum + (benefit ? benefit.price_points * item.quantity : 0);
      }, 0);
      const now = new Date();
      const demoOrder: OrderWithItems = {
        id: `demo-order-${Date.now()}`,
        user_id: "demo-user-001",
        tenant_id: "demo-tenant-001",
        status: "reserved",
        total_points: totalPoints,
        reserved_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        created_at: now.toISOString(),
        order_items: items.map((item, idx) => {
          const b = benefitMap.get(item.benefit_id);
          return {
            id: `demo-oi-${Date.now()}-${idx}`,
            order_id: `demo-order-${Date.now()}`,
            benefit_id: item.benefit_id,
            quantity: item.quantity,
            price_points: b ? b.price_points : 0,
            benefit: b ? { id: b.id, name: b.name, price_points: b.price_points, description: b.description } : undefined,
          };
        }),
      };
      return NextResponse.json({ data: demoOrder }, { status: 201 });
    }

    const supabase = await createClient();
    const appUser = await getAuthenticatedUser(supabase);

    if (!appUser) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Требуется авторизация" } },
        { status: 401 },
      );
    }

    // --- Parse & validate body ---
    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "Некорректные данные",
          },
        },
        { status: 400 },
      );
    }

    const { items } = parsed.data;
    const tenantId = appUser.tenant_id;

    // --- Fetch all requested benefits ---
    const benefitIds = items.map((i) => i.benefit_id);

    const { data: rawBenefits, error: benefitsError } = await supabase
      .from("benefits")
      .select("*")
      .in("id", benefitIds)
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (benefitsError) {
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: "Ошибка загрузки льгот" } },
        { status: 500 },
      );
    }

    const benefits = (rawBenefits ?? []) as unknown as Benefit[];
    const benefitMap = new Map(benefits.map((b) => [b.id, b]));

    // Verify each benefit exists and is active
    for (const item of items) {
      const benefit = benefitMap.get(item.benefit_id);
      if (!benefit) {
        return NextResponse.json(
          {
            error: {
              code: "benefit_not_available",
              message: `Льгота ${item.benefit_id} недоступна`,
            },
          },
          { status: 400 },
        );
      }

      // Check stock_limit
      if (benefit.stock_limit !== null && benefit.stock_limit < item.quantity) {
        return NextResponse.json(
          {
            error: {
              code: "stock_exceeded",
              message: `Недостаточно единиц для "${benefit.name}". Доступно: ${benefit.stock_limit}`,
            },
          },
          { status: 400 },
        );
      }
    }

    // --- Check eligibility ---
    const { data: rawProfile } = await supabase
      .from("employee_profiles")
      .select("*")
      .eq("user_id", appUser.id)
      .eq("tenant_id", tenantId)
      .single();

    const profile = rawProfile as unknown as EmployeeProfile | null;

    const { data: rawRules } = await supabase
      .from("eligibility_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("benefit_id", benefitIds);

    const rules = (rawRules ?? []) as unknown as EligibilityRule[];
    const rulesByBenefit = new Map<string, EligibilityRule[]>();
    for (const rule of rules) {
      const existing = rulesByBenefit.get(rule.benefit_id) || [];
      existing.push(rule);
      rulesByBenefit.set(rule.benefit_id, existing);
    }

    for (const item of items) {
      const benefitRules = rulesByBenefit.get(item.benefit_id) || [];
      if (!profile && benefitRules.length > 0) {
        return NextResponse.json(
          {
            error: {
              code: "benefit_not_eligible",
              message: `Вы не имеете права на "${benefitMap.get(item.benefit_id)?.name}"`,
            },
          },
          { status: 403 },
        );
      }
      if (profile && !checkEligibility(profile, benefitRules)) {
        return NextResponse.json(
          {
            error: {
              code: "benefit_not_eligible",
              message: `Вы не имеете права на "${benefitMap.get(item.benefit_id)?.name}"`,
            },
          },
          { status: 403 },
        );
      }
    }

    // --- Calculate total_points ---
    const totalPoints = items.reduce((sum, item) => {
      const benefit = benefitMap.get(item.benefit_id)!;
      return sum + benefit.price_points * item.quantity;
    }, 0);

    // --- Check wallet balance ---
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
      return NextResponse.json(
        {
          error: {
            code: "insufficient_points",
            message: "Кошелёк не найден или срок действия истёк",
          },
        },
        { status: 400 },
      );
    }

    const available = wallet.balance - wallet.reserved;
    if (available < totalPoints) {
      return NextResponse.json(
        {
          error: {
            code: "insufficient_points",
            message: `Недостаточно баллов. Доступно: ${available}, требуется: ${totalPoints}`,
          },
        },
        { status: 400 },
      );
    }

    // --- Create order in a "transaction" using admin client ---
    const admin = createAdminClient();

    const reservedAt = new Date();
    const expiresAt = new Date(reservedAt.getTime() + 15 * 60 * 1000); // +15 minutes

    // 1. Create order
    const { data: rawOrder, error: orderError } = await admin
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
      .single();

    if (orderError || !rawOrder) {
      console.error("[POST /api/orders] Order creation failed:", orderError);
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: "Ошибка создания заказа" } },
        { status: 500 },
      );
    }

    const order = rawOrder as unknown as Order;

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
      console.error("[POST /api/orders] Order items creation failed:", orderItemsError);
      // Rollback: delete the order
      await admin.from("orders").delete().eq("id", order.id);
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: "Ошибка создания элементов заказа" } },
        { status: 500 },
      );
    }

    // 3. Create point_ledger entries (type='reserve')
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

    const { error: ledgerError } = await admin
      .from("point_ledger")
      .insert(ledgerEntries as never);

    if (ledgerError) {
      console.error("[POST /api/orders] Ledger entries creation failed:", ledgerError);
    }

    // 4. Update wallet.reserved
    const { error: walletUpdateError } = await admin
      .from("wallets")
      .update({ reserved: wallet.reserved + totalPoints } as never)
      .eq("id", wallet.id);

    if (walletUpdateError) {
      console.error("[POST /api/orders] Wallet update failed:", walletUpdateError);
    }

    // --- Build response ---
    const orderItems = (rawOrderItems ?? []) as unknown as OrderItem[];
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

    return NextResponse.json({ data: responseOrder }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/orders] Unexpected error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" } },
      { status: 500 },
    );
  }
}
