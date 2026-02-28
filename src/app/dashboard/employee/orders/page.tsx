"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import type { OrderStatus } from "@/lib/types";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
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
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data ?? []);
      } else {
        toast.error("Не удалось загрузить заказы");
      }
    } catch {
      toast.error("Ошибка сети при загрузке заказов");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filtered = filterOrders(orders, activeTab);

  const handleRowClick = useCallback(
    (orderId: string) => {
      router.push(`/dashboard/employee/orders/${orderId}`);
    },
    [router],
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
                      <TableHead className="w-[50px]" />
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
                        <TableCell>
                          {(order.status === "reserved" || order.status === "pending") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCancellingId(order.id);
                              }}
                            >
                              <X className="size-4" />
                            </Button>
                          )}
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

      {/* Cancel confirmation dialog */}
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
