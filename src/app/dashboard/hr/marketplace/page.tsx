"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Star, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MarketplaceOffering {
  id: string;
  name: string;
  description: string;
  base_price_points: number;
  avg_rating: number;
  review_count: number;
  is_enabled: boolean;
  providers?: { name: string; logo_url: string | null } | null;
  global_categories?: { name: string; icon: string } | null;
}

export default function HrMarketplacePage() {
  const [offerings, setOfferings] = useState<MarketplaceOffering[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    fetch(`/api/hr/marketplace?${params}`)
      .then((r) => r.json())
      .then((json) => setOfferings(json.data?.data ?? json.data ?? []))
      .catch(() => toast.error("Ошибка загрузки данных"))
      .finally(() => setIsLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleEnable = async (offeringId: string) => {
    try {
      const res = await fetch("/api/hr/offerings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_offering_id: offeringId }),
      });
      if (res.ok) {
        toast.success("Предложение подключено!");
        load();
      } else {
        const err = await res.json();
        toast.error(err.error?.message ?? "Ошибка подключения");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Маркетплейс провайдеров</h1>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск предложений..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : offerings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Предложений не найдено
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offerings.map((o) => (
            <Card key={o.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{o.name}</h3>
                    <p className="text-sm text-muted-foreground">{o.providers?.name ?? "—"}</p>
                  </div>
                  {o.global_categories && (
                    <Badge variant="secondary">{o.global_categories.name}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{o.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    <span>{o.avg_rating > 0 ? Number(o.avg_rating).toFixed(1) : "—"}</span>
                    <span className="text-muted-foreground">({o.review_count})</span>
                  </div>
                  <span className="font-bold">{o.base_price_points.toLocaleString()} pts</span>
                </div>
                {o.is_enabled ? (
                  <Button variant="secondary" disabled className="w-full">
                    <Check className="mr-2 size-4" />Подключено
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => handleEnable(o.id)}>
                    <Plus className="mr-2 size-4" />Подключить
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
