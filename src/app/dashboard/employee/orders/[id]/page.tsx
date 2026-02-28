"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

import type { OrderStatus } from "@/lib/types";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderItemData {
  id: string;
  benefit_id: string;
  quantity: number;
  price_points: number;
  benefit?: {
    id: string;
    name: string;
    price_points: number;
    description?: string;
  };
}

interface OrderData {
  id: string;
  status: OrderStatus;
  total_points: number;
  reserved_at: string;
  expires_at: string;
  created_at: string;
  order_items: OrderItemData[];
}

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

function useCountdown(expiresAt: string | null, isActive: boolean) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!expiresAt || !isActive) {
      setTimeLeft("");
      return;
    }

    function calculate() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Истёк");
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      );
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, isActive]);

  return timeLeft;
}

// ---------------------------------------------------------------------------
// Order Detail Page
// ---------------------------------------------------------------------------

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const isReserved = order?.status === "reserved";
  const timeLeft = useCountdown(
    order?.expires_at ?? null,
    isReserved,
  );

  // --- Fetch order ---
  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?page=1&per_page=100`);
      if (!res.ok) return;

      const json = await res.json();
      const found = (json.data ?? []).find(
        (o: OrderData) => o.id === orderId,
      );
      if (found) {
        setOrder(found);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // --- Confirm order ---
  const handleConfirm = useCallback(async () => {
    setIsConfirming(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message ?? "Ошибка подтверждения заказа");
        return;
      }

      toast.success("Заказ подтверждён и оплачен");
      await fetchOrder();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setIsConfirming(false);
    }
  }, [orderId, fetchOrder]);

  // --- Cancel order ---
  const handleCancel = useCallback(async () => {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message ?? "Ошибка отмены заказа");
        return;
      }

      toast.success("Заказ отменён, баллы возвращены");
      await fetchOrder();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setIsCancelling(false);
    }
  }, [orderId, fetchOrder]);

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // --- Not found ---
  if (!order) {
    return (
      <div className="page-transition flex flex-col items-center justify-center gap-4 p-12 text-center">
        <div className="rounded-full bg-muted p-6">
          <Package className="size-12 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-heading font-bold">Заказ не найден</h1>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/employee/orders")}
        >
          <ArrowLeft className="mr-2 size-4" />
          К списку заказов
        </Button>
      </div>
    );
  }

  return (
    <div className="page-transition space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/employee/orders")}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold">
              Заказ #{order.id.slice(0, 8)}
            </h1>
            <OrderStatusBadge status={order.status} className="text-sm" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(order.created_at)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order items */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Состав заказа</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Льгота</TableHead>
                    <TableHead className="text-right">Цена</TableHead>
                    <TableHead className="text-right">Кол-во</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.order_items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.benefit?.name ?? item.benefit_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.price_points.toLocaleString("ru-RU")} б.
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {(item.price_points * item.quantity).toLocaleString(
                          "ru-RU",
                        )}{" "}
                        б.
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Summary & actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Итого</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-lg font-semibold tabular-nums">
                <span>Сумма:</span>
                <span>{order.total_points.toLocaleString("ru-RU")} б.</span>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Статус:</span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Создан:</span>
                  <span>{formatDate(order.created_at)}</span>
                </div>
              </div>

              {/* Countdown timer for reserved orders */}
              {isReserved && timeLeft && (
                <>
                  <Separator />
                  <div className="flex items-center justify-center gap-2 rounded-md bg-[var(--info-light)] p-3">
                    <Clock className="size-4 text-[var(--info)]" />
                    <span className="text-sm font-medium">
                      Осталось времени:{" "}
                      <span className="tabular-nums font-bold">{timeLeft}</span>
                    </span>
                  </div>
                </>
              )}

              {/* Action buttons for reserved orders */}
              {isReserved && timeLeft !== "Истёк" && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      disabled={isConfirming || isCancelling}
                      onClick={handleConfirm}
                    >
                      {isConfirming ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Подтверждаем...
                        </>
                      ) : (
                        "Подтвердить"
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={isConfirming || isCancelling}
                        >
                          {isCancelling ? (
                            <>
                              <Loader2 className="mr-2 size-4 animate-spin" />
                              Отменяем...
                            </>
                          ) : (
                            "Отменить"
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Отменить заказ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Зарезервированные баллы будут возвращены на ваш баланс. Это действие нельзя отменить.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Нет, оставить</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleCancel}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Да, отменить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
