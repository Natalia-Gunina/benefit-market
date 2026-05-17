"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DataTable, useTableState } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";

/* -------------------------------------------------------------------------- */

interface OrderItem {
  id: string;
  order_id: string;
  quantity: number;
  price_points: number;
  provider_offerings?: { name: string } | null;
  orders?: { id: string; status: string; total_points: number; created_at: string; tenant_id: string } | null;
}

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Ожидает", variant: "outline" },
  reserved: { label: "Резерв", variant: "secondary" },
  paid: { label: "Оплачен", variant: "default" },
  cancelled: { label: "Отменён", variant: "destructive" },
  expired: { label: "Истёк", variant: "destructive" },
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Ожидает" },
  { value: "reserved", label: "Резерв" },
  { value: "paid", label: "Оплачен" },
  { value: "cancelled", label: "Отменён" },
  { value: "expired", label: "Истёк" },
];

/* -------------------------------------------------------------------------- */

export default function ProviderOrdersPage() {
  const { state, setState, resetFilters } = useTableState({ pageSize: 20 });

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ----- Fetch ------------------------------------------------------------ */
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(state.page));
      params.set("per_page", String(state.pageSize));
      if (state.search) params.set("search", state.search);
      if (state.filters.status) params.set("status", state.filters.status);

      const res = await fetch(`/api/provider/orders?${params}`);
      if (!res.ok) throw new Error("Не удалось загрузить заказы");
      const json = await res.json();
      setOrders(json.data?.data ?? []);
      setTotal(json.data?.meta?.total ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка загрузки данных";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /* ----- Columns ---------------------------------------------------------- */
  const columns: ColumnDef<OrderItem>[] = useMemo(() => [
    {
      key: "order_id",
      header: "ID заказа",
      cell: (row) => {
        const orderId = row.orders?.id ?? row.order_id;
        return (
          <span className="font-mono text-sm text-muted-foreground">
            {orderId ? orderId.slice(0, 8) : "—"}
          </span>
        );
      },
    },
    {
      key: "offering",
      header: "Предложение",
      filter: { type: "text" },
      filterKey: "search",
      cell: (row) => (
        <span className="font-medium">
          {row.provider_offerings?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "quantity",
      header: "Кол-во",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (row) => row.quantity,
    },
    {
      key: "price_points",
      header: "Баллы",
      sortable: true,
      filter: { type: "number" },
      headerClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (row) => row.price_points.toLocaleString("ru-RU"),
    },
    {
      key: "status",
      header: "Статус",
      headerClassName: "text-center",
      className: "text-center",
      filter: { type: "select", options: STATUS_OPTIONS },
      cell: (row) => {
        const st = statusBadge[row.orders?.status ?? "pending"] ?? statusBadge.pending;
        return <Badge variant={st.variant}>{st.label}</Badge>;
      },
    },
    {
      key: "created_at",
      header: "Дата",
      sortable: true,
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.orders?.created_at
            ? new Date(row.orders.created_at).toLocaleDateString("ru")
            : "—"}
        </span>
      ),
    },
  ], []);

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Заказы</h1>
        <p className="mt-1 text-sm text-muted-foreground">Заказы от сотрудников на ваши льготы</p>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        total={total}
        loading={loading}
        error={error}
        state={state}
        onStateChange={setState}
        onReset={resetFilters}
        emptyState={{
          icon: ClipboardList,
          title: "Заказов пока нет",
          description: "Заказы от сотрудников появятся здесь",
        }}
      />
    </div>
  );
}
