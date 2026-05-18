"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, ClipboardList, Star, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReviewInsightsCard } from "@/components/dashboard/review-insights-card";

interface Analytics {
  total_orders: number;
  avg_rating: number;
  active_offerings: number;
  tenant_connections: number;
  popular_offerings: Array<{ name: string; avg_rating: number; review_count: number }>;
  ratings_distribution?: Record<number, number>;
}

interface OfferingOption {
  id: string;
  name: string;
}

const ALL_OFFERINGS = "all";

export default function ProviderAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<OfferingOption[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>(ALL_OFFERINGS);

  // Load the provider's offerings once for the filter dropdown. Only
  // published ones — drafts, pending and archived have no useful analytics
  // and would clutter the picker. Response shape: { data: { data: [...] } }.
  useEffect(() => {
    fetch("/api/provider/offerings?per_page=100&status=published")
      .then((r) => r.json())
      .then((json) => {
        const list = (json.data?.data ?? json.data ?? []) as Array<{
          id: string;
          name: string;
        }>;
        setOfferings(list.map((o) => ({ id: o.id, name: o.name })));
      })
      .catch(() => {
        // Filter is non-critical — keep the page working without it.
      });
  }, []);

  useEffect(() => {
    const url =
      selectedOfferingId && selectedOfferingId !== ALL_OFFERINGS
        ? `/api/provider/analytics?offering_id=${encodeURIComponent(selectedOfferingId)}`
        : "/api/provider/analytics";
    fetch(url)
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .catch(() => toast.error("Ошибка загрузки данных"))
      .finally(() => setIsLoading(false));
  }, [selectedOfferingId]);


  const handleOfferingChange = (next: string) => {
    setIsLoading(true);
    setSelectedOfferingId(next);
  };

  const metrics = [
    { label: "Активные предложения", value: data?.active_offerings ?? 0, icon: Package },
    { label: "Всего заказов", value: data?.total_orders ?? 0, icon: ClipboardList },
    { label: "Средний рейтинг", value: data?.avg_rating?.toFixed(1) ?? "—", icon: Star },
    { label: "Компаний подключено", value: data?.tenant_connections ?? 0, icon: Building2 },
  ];

  const rd = data?.ratings_distribution;
  const totalRatings = rd ? Object.values(rd).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="page-transition space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-heading font-bold">Аналитика</h1>
        <Select value={selectedOfferingId} onValueChange={handleOfferingChange}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Все льготы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_OFFERINGS}>Все льготы</SelectItem>
            {offerings.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <m.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Popular offerings */}
        {data?.popular_offerings && data.popular_offerings.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Популярные предложения</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.popular_offerings.map((o, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="font-medium">{o.name}</span>
                    <div className="flex items-center gap-2 text-sm">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      <span>{Number(o.avg_rating).toFixed(1)}</span>
                      <span className="text-muted-foreground">({o.review_count} отзывов)</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ratings distribution */}
        {rd && totalRatings > 0 && (
          <Card>
            <CardHeader><CardTitle>Распределение оценок</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = rd[star] ?? 0;
                  const pct = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-12 shrink-0">
                        <span className="text-sm font-medium">{star}</span>
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-10 text-right tabular-nums">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* AI review insights — only meaningful for a single offering. */}
      {/* `key` forces a fresh mount on every offering switch so loading */}
      {/* state resets cleanly without synchronous setState in an effect. */}
      <ReviewInsightsCard
        key={selectedOfferingId}
        offeringId={selectedOfferingId === ALL_OFFERINGS ? null : selectedOfferingId}
      />
    </div>
  );
}
