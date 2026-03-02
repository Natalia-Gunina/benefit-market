"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Package, ClipboardList, Star, Building2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Analytics {
  total_orders: number;
  avg_rating: number;
  active_offerings: number;
  tenant_connections: number;
  recent_orders?: RecentOrder[];
  action_items?: ActionItems;
}

interface RecentOrder {
  id: string;
  offering_name: string;
  quantity: number;
  price_points: number;
  status: string;
  created_at: string;
}

interface ActionItems {
  pending_offerings: number;
  new_reviews: number;
}

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Ожидает", variant: "outline" },
  reserved: { label: "Резерв", variant: "secondary" },
  paid: { label: "Оплачен", variant: "default" },
  cancelled: { label: "Отменён", variant: "destructive" },
  expired: { label: "Истёк", variant: "destructive" },
};

export default function ProviderDashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/provider/analytics")
      .then((r) => r.json())
      .then((json) => setAnalytics(json.data))
      .catch(() => toast.error("Ошибка загрузки данных"))
      .finally(() => setIsLoading(false));
  }, []);

  const metrics = [
    { label: "Активные предложения", value: analytics?.active_offerings ?? 0, icon: Package },
    { label: "Всего заказов", value: analytics?.total_orders ?? 0, icon: ClipboardList },
    { label: "Средний рейтинг", value: analytics?.avg_rating?.toFixed(1) ?? "—", icon: Star },
    { label: "Подключений компаний", value: analytics?.tenant_connections ?? 0, icon: Building2 },
  ];

  const actions = analytics?.action_items;
  const recentOrders = analytics?.recent_orders ?? [];

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Дашборд провайдера</h1>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <m.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : m.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Action items */}
        {actions && (actions.pending_offerings > 0 || actions.new_reviews > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="size-4" />
                Требуют внимания
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {actions.pending_offerings > 0 && (
                <Link
                  href="/dashboard/provider/offerings"
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <span>Предложения на модерации</span>
                  <Badge variant="outline">{actions.pending_offerings}</Badge>
                </Link>
              )}
              {actions.new_reviews > 0 && (
                <Link
                  href="/dashboard/provider/reviews"
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <span>Новые отзывы</span>
                  <Badge variant="outline">{actions.new_reviews}</Badge>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent orders */}
        <Card className={!actions || (actions.pending_offerings === 0 && actions.new_reviews === 0) ? "lg:col-span-2" : ""}>
          <CardHeader>
            <CardTitle>Последние заказы</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Загрузка...</p>
            ) : recentOrders.length === 0 ? (
              <p className="text-muted-foreground">Заказов пока нет</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((o) => {
                  const st = statusBadge[o.status] ?? statusBadge.pending;
                  return (
                    <div
                      key={o.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{o.offering_name}</p>
                        <p className="text-sm text-muted-foreground">
                          x{o.quantity} &middot; {o.price_points.toLocaleString()} pts
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={st.variant}>{st.label}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString("ru")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
