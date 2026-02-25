"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Loader2 } from "lucide-react";

import type { OrderStatus } from "@/lib/types";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderSummary {
  id: string;
  status: OrderStatus;
  total_points: number;
  created_at: string;
  order_items: { id: string }[];
}

type FilterTab = "all" | "active" | "completed";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function filterOrders(
  orders: OrderSummary[],
  tab: FilterTab,
): OrderSummary[] {
  switch (tab) {
    case "active":
      return orders.filter(
        (o) => o.status === "reserved" || o.status === "pending",
      );
    case "completed":
      return orders.filter(
        (o) =>
          o.status === "paid" ||
          o.status === "cancelled" ||
          o.status === "expired",
      );
    default:
      return orders;
  }
}

// ---------------------------------------------------------------------------
// Orders Page
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch("/api/orders");
        if (res.ok) {
          const json = await res.json();
          setOrders(json.data ?? []);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }
    fetchOrders();
  }, []);

  const filtered = filterOrders(orders, activeTab);

  const handleRowClick = useCallback(
    (orderId: string) => {
      router.push(`/dashboard/employee/orders/${orderId}`);
    },
    [router],
  );

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Мои заказы</h1>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as FilterTab)}
      >
        <TabsList>
          <TabsTrigger value="all">
            Все ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Активные (
            {filterOrders(orders, "active").length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Завершённые (
            {filterOrders(orders, "completed").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="rounded-full bg-muted p-6">
                <Package className="size-12 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Заказов не найдено</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Заказ</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Баллы</TableHead>
                      <TableHead className="text-right">Позиций</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer"
                        onClick={() => handleRowClick(order.id)}
                      >
                        <TableCell className="font-mono text-sm">
                          #{order.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(order.created_at)}
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {order.total_points.toLocaleString("ru-RU")} б.
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {order.order_items?.length ?? 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
