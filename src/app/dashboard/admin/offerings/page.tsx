"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Offering {
  id: string;
  name: string;
  status: string;
  base_price_points: number;
  providers?: { id: string; name: string; status: string } | null;
  global_categories?: { name: string } | null;
}

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Черновик", variant: "secondary" },
  pending_review: { label: "На модерации", variant: "outline" },
  published: { label: "Опубликовано", variant: "default" },
  archived: { label: "Архив", variant: "destructive" },
};

export default function AdminOfferingsPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    fetch("/api/admin/offerings")
      .then((r) => r.json())
      .then((json) => setOfferings(json.data?.data ?? json.data ?? []))
      .catch(() => toast.error("Ошибка загрузки данных"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/offerings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(`Статус обновлён: ${status}`);
        load();
      } else {
        toast.error("Ошибка обновления");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Модерация предложений</h1>

      {isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : offerings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Предложений нет
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Все предложения ({offerings.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {offerings.map((o) => {
                const st = statusBadge[o.status] ?? statusBadge.draft;
                return (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{o.name}</span>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {o.providers?.name ?? "—"} &middot; {o.global_categories?.name ?? "—"} &middot; {o.base_price_points.toLocaleString()} pts
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {o.status === "pending_review" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => updateStatus(o.id, "published")}>
                            <Check className="mr-1 size-3.5" />Одобрить
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(o.id, "draft")}>
                            <X className="mr-1 size-3.5" />Отклонить
                          </Button>
                        </>
                      )}
                      {o.status === "published" && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(o.id, "archived")}>
                          Архивировать
                        </Button>
                      )}
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
