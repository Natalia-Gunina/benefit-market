"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TenantOffering {
  id: string;
  is_active: boolean;
  custom_price_points: number | null;
  enabled_at: string;
  provider_offerings?: {
    name: string;
    base_price_points: number;
    providers?: { name: string } | null;
    global_categories?: { name: string } | null;
  } | null;
}

export default function HrOfferingsPage() {
  const [offerings, setOfferings] = useState<TenantOffering[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    fetch("/api/hr/offerings")
      .then((r) => r.json())
      .then((json) => setOfferings(json.data?.data ?? json.data ?? []))
      .catch(() => toast.error("Ошибка загрузки данных"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/hr/offerings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      if (res.ok) {
        toast.success(currentActive ? "Деактивировано" : "Активировано");
        load();
      } else {
        toast.error("Ошибка");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`/api/hr/offerings/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Предложение отключено");
        load();
      } else {
        toast.error("Ошибка");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Подключённые предложения</h1>

      {isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : offerings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Нет подключённых предложений. Перейдите в маркетплейс, чтобы подключить.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Подключено ({offerings.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {offerings.map((to) => {
                const po = to.provider_offerings;
                const price = to.custom_price_points ?? po?.base_price_points ?? 0;
                return (
                  <div key={to.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{po?.name ?? "—"}</span>
                        <Badge variant={to.is_active ? "default" : "secondary"}>
                          {to.is_active ? "Активно" : "Неактивно"}
                        </Badge>
                        {to.custom_price_points && (
                          <Badge variant="outline">{price.toLocaleString()} pts (кастом)</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {po?.providers?.name ?? "—"} &middot; {po?.global_categories?.name ?? "—"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(to.id, to.is_active)}>
                        {to.is_active ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleRemove(to.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
