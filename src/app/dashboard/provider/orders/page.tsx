"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";

interface OrderItem {
  id: string;
  order_id: string;
  quantity: number;
  price_points: number;
  provider_offerings?: { name: string } | null;
  orders?: { id: string; status: string; total_points: number; created_at: string; tenant_id: string } | null;
}

const statusTabs = [
  { key: "all", label: "Все" },
  { key: "pending", label: "Ожидает" },
  { key: "reserved", label: "Резерв" },
  { key: "paid", label: "Оплачен" },
  { key: "cancelled", label: "Отменён" },
] as const;

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Ожидает", variant: "outline" },
  reserved: { label: "Резерв", variant: "secondary" },
  paid: { label: "Оплачен", variant: "default" },
  cancelled: { label: "Отменён", variant: "destructive" },
  expired: { label: "Истёк", variant: "destructive" },
};

export default function ProviderOrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/provider/orders?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setOrders(json.data?.data ?? []);
      setTotal(json.data?.meta?.total ?? 0);
    } catch {
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Заказы</h1>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1">
        {statusTabs.map((tab) => (
          <Button
            key={tab.key}
            variant={statusFilter === tab.key ? "default" : "ghost"}
            size="sm"
            onClick={() => { setStatusFilter(tab.key); setPage(1); }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Поиск..."
          className="pl-9"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID заказа</TableHead>
              <TableHead>Предложение</TableHead>
              <TableHead className="text-right">Кол-во</TableHead>
              <TableHead className="text-right">Баллы</TableHead>
              <TableHead className="text-center">Статус</TableHead>
              <TableHead>Дата</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Заказов не найдено
                </TableCell>
              </TableRow>
            ) : (
              orders.map((oi) => {
                const st = statusBadge[oi.orders?.status ?? "pending"] ?? statusBadge.pending;
                const orderId = oi.orders?.id ?? oi.order_id;
                const shortId = orderId ? orderId.slice(0, 8) : "—";
                return (
                  <TableRow key={oi.id}>
                    <TableCell className="font-mono text-sm">{shortId}</TableCell>
                    <TableCell className="font-medium">
                      {oi.provider_offerings?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{oi.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {oi.price_points.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {oi.orders?.created_at
                        ? new Date(oi.orders.created_at).toLocaleDateString("ru")
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {!loading && total > perPage && (
          <DataTablePagination
            page={page}
            per_page={perPage}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
