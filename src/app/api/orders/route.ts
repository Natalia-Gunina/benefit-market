import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api/auth";
import { success, created, withErrorHandling, errorResponse, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { dbError } from "@/lib/errors";
import { demoOrdersList, demoCreateOrder } from "@/lib/demo/demo-service";
import { createOrderSchema } from "@/lib/api/validators";
import { createOrder, type OrderWithItems, type OrderItemWithBenefit } from "@/lib/services/order.service";
import type {
  Benefit,
  Order,
  OrderItem,
} from "@/lib/types";

// Re-export types for consumers that imported from this module
export type { OrderWithItems, OrderItemWithBenefit };

interface OrdersListResponse {
  data: OrderWithItems[];
  meta: {
    page: number;
    per_page: number;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// GET /api/orders — List orders for current user
// ---------------------------------------------------------------------------

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status");
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
      const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
      return demoOrdersList({ status, page, perPage });
    }

    const appUser = await requireAuth();
    const supabase = await createClient();

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
      throw dbError("Ошибка загрузки заказов");
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

    return success({
      data: orders,
      meta: { page, per_page: perPage, total: count ?? 0 },
    } satisfies OrdersListResponse);
  }, "GET /api/orders");
}

// ---------------------------------------------------------------------------
// POST /api/orders — Create a new order (reserve)
// ---------------------------------------------------------------------------

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const body = await request.json();
      const parsed = createOrderSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
      }
      return demoCreateOrder(parsed.data.items);
    }

    const appUser = await requireAuth();
    const supabase = await createClient();

    const body = await request.json();
    const parsed = parseBody(createOrderSchema, body);

    const result = await createOrder(supabase, appUser, parsed.items);
    if ("error" in result) {
      return errorResponse(result.error.code, result.error.message, result.error.status);
    }
    return created(result.order);
  }, "POST /api/orders");
}
