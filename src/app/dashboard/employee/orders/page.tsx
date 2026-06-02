"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Package, Loader2, X, Star } from "lucide-react";
import { toast } from "sonner";

import type { OrderStatus } from "@/lib/types";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { DataTable, useTableState } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";

/* -------------------------------------------------------------------------- */

interface OrderItemSummary {
  id: string;
  provider_offering_id?: string | null;
}

interface OrderSummary {
  id: string;
  status: OrderStatus;
  total_points: number;
  created_at: string;
  order_items: OrderItemSummary[];
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Ожидает" },
  { value: "reserved", label: "Резерв" },
  { value: "paid", label: "Оплачен" },
  { value: "cancelled", label: "Отменён" },
  { value: "expired", label: "Истёк" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* -------------------------------------------------------------------------- */

export default function OrdersPage() {
  const router = useRouter();
  const { state, setState, resetFilters } = useTableState({ pageSize: 20 });

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [reviewedOfferingIds, setReviewedOfferingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  /* ----- Fetch ------------------------------------------------------------ */
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders?per_page=1000");
      if (!res.ok) throw new Error();
      const json = await res.json();
      const list: OrderSummary[] = json.data ?? [];
      setOrders(list);

      const offeringIds = Array.from(
        new Set(
          list
            .filter((o) => o.status === "paid")
            .flatMap((o) => o.order_items)
            .map((it) => it.provider_offering_id)
            .filter((v): v is string => !!v),
        ),
      );
      if (offeringIds.length > 0) {
        try {
          const r = await fetch(
            `/api/reviews/mine?provider_offering_ids=${offeringIds.join(",")}`,
          );
          if (r.ok) {
            const j = await r.json();
            const data = j.data ?? j;
            const reviewed: { provider_offering_id: string }[] = Array.isArray(data)
              ? data
              : (data?.data ?? []);
            setReviewedOfferingIds(
              new Set(reviewed.map((rv) => rv.provider_offering_id)),
            );
          }
        } catch { /* soft-fail */ }
      }
    } catch {
      toast.error("Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /* ----- Client-side filtering + sorting + pagination --------------------- */
  const { filtered, filteredTotal } = useMemo(() => {
    let result = [...orders];

    // Status filter
    if (state.filters.status) {
      const vals = state.filters.status.split(",");
      result = result.filter((o) => vals.includes(o.status));
    }

    // Number filter for total_points
    if (state.filters.total_points) {
      const [minStr, maxStr] = state.filters.total_points.split("~");
      const min = minStr ? Number(minStr) : null;
      const max = maxStr ? Number(maxStr) : null;
      result = result.filter((o) => {
        const v = o.total_points;
        if (min !== null && !isNaN(min) && v < min) return false;
        if (max !== null && !isNaN(max) && v > max) return false;
        return true;
      });
    }

    // Sort
    if (state.sort) {
      const { key, direction } = state.sort;
      const dir = direction === "desc" ? -1 : 1;
      result.sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[key];
        const bv = (b as unknown as Record<string, unknown>)[key];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
        return String(av).localeCompare(String(bv), "ru") * dir;
      });
    }

    const total = result.length;
    const offset = (state.page - 1) * state.pageSize;
    return { filtered: result.slice(offset, offset + state.pageSize), filteredTotal: total };
  }, [orders, state]);

  /* ----- Helpers ---------------------------------------------------------- */
  const hasUnratedItems = useCallback(
    (order: OrderSummary): boolean => {
      if (order.status !== "paid") return false;
      return order.order_items.some(
        (it) =>
          !!it.provider_offering_id &&
          !reviewedOfferingIds.has(it.provider_offering_id),
      );
    },
    [reviewedOfferingIds],
  );

  const handleCancelOrder = useCallback(async () => {
    if (!cancellingId) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/orders/${cancellingId}/cancel`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Ошибка отмены заказа");
        return;
      }
      toast.success("Заказ отменён, баллы возвращены");
      await fetchOrders();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setIsCancelling(false);
      setCancellingId(null);
    }
  }, [cancellingId, fetchOrders]);

  /* ----- Columns ---------------------------------------------------------- */
  const columns: ColumnDef<OrderSummary>[] = [
    {
      key: "id",
      header: "Заказ",
      cell: (row) => (
        <span className="font-mono text-sm">#{row.id.slice(0, 8)}</span>
      ),
    },
    {
      key: "created_at",
      header: "Дата",
      sortable: true,
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Статус",
      sortable: true,
      filter: { type: "select", options: STATUS_OPTIONS },
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <OrderStatusBadge status={row.status} />
          {hasUnratedItems(row) && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-300 bg-amber-50 text-amber-700"
            >
              <Star className="size-3 fill-amber-400 text-amber-400" />
              Можно оценить
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "total_points",
      header: "Баллы",
      sortable: true,
      filter: { type: "number" },
      headerClassName: "text-right",
      className: "text-right tabular-nums font-medium",
      cell: (row) => `${row.total_points.toLocaleString("ru-RU")} б.`,
    },
    {
      key: "order_items",
      header: "Позиций",
      headerClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (row) => row.order_items?.length ?? 0,
    },
  ];

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Мои заказы</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          История заказов и их статусы — отмена возможна до подтверждения
        </p>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        total={filteredTotal}
        loading={loading}
        state={state}
        onStateChange={setState}
        onReset={resetFilters}
        searchable={{ placeholder: "Поиск по номеру заказа..." }}
        actions={(row) =>
          row.status === "reserved" || row.status === "pending"
            ? [
                {
                  label: "Отменить",
                  icon: X,
                  variant: "destructive" as const,
                  onClick: () => setCancellingId(row.id),
                },
              ]
            : []
        }
        onRowClick={(order) => router.push(`/dashboard/employee/orders/${order.id}`)}
        emptyState={{
          icon: Package,
          title: "Заказов не найдено",
          description: "У вас пока нет заказов",
        }}
      />

      <AlertDialog open={!!cancellingId} onOpenChange={() => setCancellingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить заказ?</AlertDialogTitle>
            <AlertDialogDescription>
              Зарезервированные баллы будут возвращены на ваш баланс. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Нет, оставить</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Отменяем...
                </>
              ) : (
                "Да, отменить"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
