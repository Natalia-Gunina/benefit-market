"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Trash2, Minus, Plus, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { useCartStore } from "@/lib/store/cart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WalletData {
  balance: number;
  reserved: number;
  available: number;
}

// ---------------------------------------------------------------------------
// Cart Page
// ---------------------------------------------------------------------------

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, clearCart, getTotalPoints } =
    useCartStore();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  const totalPoints = getTotalPoints();

  // --- Fetch wallet balance ---
  useEffect(() => {
    async function fetchWallet() {
      try {
        const res = await fetch("/api/wallets/me");
        if (res.ok) {
          const json = await res.json();
          const d = json.data;
          // Normalize: demo returns { wallet: {...}, ledger: [...] }, real returns { balance, reserved, available, ... }
          if (d.wallet) {
            const w = d.wallet;
            setWallet({ balance: w.balance, reserved: w.reserved, available: w.balance - w.reserved });
          } else {
            setWallet(d);
          }
        }
      } catch {
        // ignore
      } finally {
        setIsLoadingWallet(false);
      }
    }
    fetchWallet();
  }, []);

  const insufficientBalance =
    wallet !== null && totalPoints > wallet.available;

  // --- Submit order ---
  const handleSubmitOrder = useCallback(async () => {
    if (items.length === 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            benefit_id: item.benefit.id,
            quantity: item.quantity,
          })),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message ?? "Ошибка создания заказа");
        return;
      }

      clearCart();
      setSuccessOrderId(json.data.id);
    } catch {
      toast.error("Ошибка сети при создании заказа");
    } finally {
      setIsSubmitting(false);
    }
  }, [items, clearCart]);

  // --- Success dialog (shown after order is created) ---
  const successDialog = (
    <Dialog open={!!successOrderId} onOpenChange={() => setSuccessOrderId(null)}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--success-light)]">
            <CheckCircle2 className="size-8 text-[var(--success)]" />
          </div>
          <DialogTitle className="text-center">Заказ оформлен!</DialogTitle>
          <DialogDescription className="text-center">
            Ваш заказ успешно создан и зарезервирован. У вас есть 15 минут, чтобы подтвердить или отменить его.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={() => router.push(`/dashboard/employee/orders/${successOrderId}`)}
          >
            Перейти к заказу
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/dashboard/employee/orders")}
          >
            Все заказы
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // --- Empty cart state ---
  if (items.length === 0) {
    return (
      <div className="page-transition flex flex-col items-center justify-center gap-4 p-12 text-center">
        {successDialog}
        <div className="rounded-full bg-muted p-6">
          <ShoppingCart className="size-12 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-heading font-bold">Корзина пуста</h1>
        <p className="text-muted-foreground">
          Добавьте льготы из каталога, чтобы оформить заказ
        </p>
        <Button onClick={() => router.push("/dashboard/employee/catalog")}>
          Перейти в каталог
        </Button>
      </div>
    );
  }

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Корзина</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items list */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <Card key={item.benefit.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.benefit.name}</p>
                  {item.benefit.category_name && (
                    <p className="text-sm text-muted-foreground">
                      {item.benefit.category_name}
                    </p>
                  )}
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {item.benefit.price_points.toLocaleString("ru-RU")} б. за ед.
                  </p>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      updateQuantity(item.benefit.id, item.quantity - 1)
                    }
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-8 text-center tabular-nums font-medium">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      updateQuantity(item.benefit.id, item.quantity + 1)
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>

                {/* Line total */}
                <div className="text-right min-w-[80px]">
                  <p className="font-semibold tabular-nums">
                    {(item.benefit.price_points * item.quantity).toLocaleString(
                      "ru-RU",
                    )}{" "}
                    б.
                  </p>
                </div>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(item.benefit.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Итого</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Позиций: {items.length}
                </span>
                <span className="text-muted-foreground">
                  Единиц:{" "}
                  {items.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>

              <Separator />

              <div className="flex justify-between font-semibold text-lg tabular-nums">
                <span>Итого:</span>
                <span>{totalPoints.toLocaleString("ru-RU")} б.</span>
              </div>

              <Separator />

              {/* Wallet balance */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Баланс:</span>
                  <span className="tabular-nums">
                    {isLoadingWallet
                      ? "..."
                      : wallet
                        ? `${wallet.balance.toLocaleString("ru-RU")} б.`
                        : "Н/Д"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Доступно:</span>
                  <span className="tabular-nums">
                    {isLoadingWallet
                      ? "..."
                      : wallet
                        ? `${wallet.available.toLocaleString("ru-RU")} б.`
                        : "Н/Д"}
                  </span>
                </div>
              </div>

              {/* Insufficient balance warning */}
              {insufficientBalance && (
                <div className="flex items-center gap-2 rounded-md bg-[var(--warning-light)] p-3 text-sm">
                  <AlertTriangle className="size-4 text-[var(--warning)] shrink-0" />
                  <span>
                    Недостаточно баллов. Не хватает{" "}
                    <strong className="tabular-nums">
                      {(totalPoints - (wallet?.available ?? 0)).toLocaleString(
                        "ru-RU",
                      )}
                    </strong>{" "}
                    б.
                  </span>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                className="w-full"
                disabled={isSubmitting || insufficientBalance}
                onClick={handleSubmitOrder}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Оформляем...
                  </>
                ) : (
                  "Оформить заказ"
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={clearCart}
              >
                Очистить корзину
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
