"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, ClipboardList, Star, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Analytics {
  total_orders: number;
  avg_rating: number;
  active_offerings: number;
  tenant_connections: number;
}

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

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Дашборд провайдера</h1>

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
    </div>
  );
}
