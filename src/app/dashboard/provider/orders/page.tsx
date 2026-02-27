"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OrderItem {
  id: string;
  quantity: number;
  price_points: number;
  provider_offerings?: { name: string } | null;
  orders?: { id: string; status: string; created_at: string } | null;
}

export default function ProviderOrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/provider/orders")
      .then((r) => r.json())
      .then((json) => setOrders(json.data?.data ?? []))
      .catch(() => toast.error("Ошибка загрузки данных"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Заказы</h1>

      {isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Заказов пока нет
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Последние заказы</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orders.map((oi) => (
                <div key={oi.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{oi.provider_offerings?.name ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">
                      x{oi.quantity} &middot; {oi.price_points.toLocaleString()} pts
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">{oi.orders?.status}</p>
                    <p className="text-muted-foreground">
                      {oi.orders?.created_at ? new Date(oi.orders.created_at).toLocaleDateString("ru") : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
