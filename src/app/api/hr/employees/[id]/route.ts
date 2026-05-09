import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, withErrorHandling } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRowsSoft, unwrapSingleOrNull } from "@/lib/supabase/typed-queries";
import { notFound } from "@/lib/errors";
import type { Order, OrderItem, PointLedger } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

interface EmployeeDetailResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  profile: {
    grade: string;
    tenure_months: number;
    location: string;
    legal_entity: string;
    extra: Record<string, unknown>;
  };
  wallet: {
    id: string;
    balance: number;
    reserved: number;
    period: string;
    expires_at: string;
  } | null;
  orders: Array<
    Order & {
      order_items: Array<OrderItem & { name?: string }>;
    }
  >;
  ledger: PointLedger[];
}

// ---------------------------------------------------------------------------
// GET /api/hr/employees/[id]
// ---------------------------------------------------------------------------

export function GET(_request: NextRequest, context: RouteContext) {
  return withErrorHandling(async () => {
    const { id } = await context.params;

    if (isDemo) {
      const {
        DEMO_EMPLOYEES,
        DEMO_WALLETS,
        DEMO_ORDERS,
        DEMO_ORDER_ITEMS,
        DEMO_LEDGER,
        DEMO_PROVIDER_OFFERINGS,
        DEMO_BENEFITS,
      } = await import("@/lib/demo-data");

      const emp = DEMO_EMPLOYEES.find((e) => e.user.id === id);
      if (!emp) throw notFound("Employee not found");

      const wallet = DEMO_WALLETS.find((w) => w.user_id === id) ?? null;

      const offeringMap = new Map(DEMO_PROVIDER_OFFERINGS.map((o) => [o.id, o.name]));
      const benefitMap = new Map(DEMO_BENEFITS.map((b) => [b.id, b.name]));

      const orders = DEMO_ORDERS
        .filter((o) => o.user_id === id)
        .map((o) => ({
          ...o,
          order_items: DEMO_ORDER_ITEMS.filter((oi) => oi.order_id === o.id).map((oi) => ({
            ...oi,
            name:
              (oi.provider_offering_id && offeringMap.get(oi.provider_offering_id)) ||
              (oi.benefit_id && benefitMap.get(oi.benefit_id)) ||
              "—",
          })),
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      const ledger = wallet
        ? DEMO_LEDGER
            .filter((l) => l.wallet_id === wallet.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
        : [];

      const response: EmployeeDetailResponse = {
        id: emp.user.id,
        name: emp.full_name,
        email: emp.user.email,
        role: emp.user.role,
        profile: {
          grade: emp.profile.grade,
          tenure_months: emp.profile.tenure_months,
          location: emp.profile.location,
          legal_entity: emp.profile.legal_entity,
          extra: emp.profile.extra,
        },
        wallet: wallet
          ? {
              id: wallet.id,
              balance: wallet.balance,
              reserved: wallet.reserved,
              period: wallet.period,
              expires_at: wallet.expires_at,
            }
          : null,
        orders,
        ledger,
      };
      return success(response);
    }

    const appUser = await requireRole("hr", "admin");
    const admin = createAdminClient();

    type UserRow = {
      id: string;
      email: string;
      role: string;
      tenant_id: string;
    };

    const user = unwrapSingleOrNull<UserRow>(
      await admin
        .from("users")
        .select("id, email, role, tenant_id")
        .eq("id", id)
        .eq("tenant_id", appUser.tenant_id)
        .single(),
    );
    if (!user) throw notFound("Employee not found");

    type ProfileRow = {
      grade: string;
      tenure_months: number;
      location: string;
      legal_entity: string;
      extra: Record<string, unknown>;
    };
    const profile = unwrapSingleOrNull<ProfileRow>(
      await admin
        .from("employee_profiles")
        .select("grade, tenure_months, location, legal_entity, extra")
        .eq("user_id", id)
        .single(),
    );

    type WalletRow = {
      id: string;
      balance: number;
      reserved: number;
      period: string;
      expires_at: string;
    };
    const wallets = unwrapRowsSoft<WalletRow>(
      await admin
        .from("wallets")
        .select("id, balance, reserved, period, expires_at")
        .eq("user_id", id)
        .order("expires_at", { ascending: false })
        .limit(1),
    );
    const wallet = wallets[0] ?? null;

    const orderRows = unwrapRowsSoft<
      Order & {
        order_items: (OrderItem & { provider_offerings?: { name: string } })[];
      }
    >(
      await admin
        .from("orders")
        .select("*, order_items(*, provider_offerings(name))")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    );

    const orders = orderRows.map((o) => ({
      ...o,
      order_items: o.order_items.map((oi) => ({
        ...oi,
        name: oi.provider_offerings?.name ?? "—",
      })),
    }));

    const ledger = wallet
      ? unwrapRowsSoft<PointLedger>(
          await admin
            .from("point_ledger")
            .select("*")
            .eq("wallet_id", wallet.id)
            .order("created_at", { ascending: false })
            .limit(50),
        )
      : [];

    const response: EmployeeDetailResponse = {
      id: user.id,
      name: user.email.split("@")[0],
      email: user.email,
      role: user.role,
      profile: {
        grade: profile?.grade ?? "",
        tenure_months: profile?.tenure_months ?? 0,
        location: profile?.location ?? "",
        legal_entity: profile?.legal_entity ?? "",
        extra: profile?.extra ?? {},
      },
      wallet: wallet,
      orders,
      ledger,
    };

    return success(response);
  }, "GET /api/hr/employees/[id]");
}
