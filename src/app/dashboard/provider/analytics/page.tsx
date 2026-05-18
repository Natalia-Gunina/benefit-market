"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, ClipboardList, Star, Building2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReviewInsightsCard } from "@/components/dashboard/review-insights-card";
import { useChartColors } from "@/components/dashboard/use-chart-colors";

interface Analytics {
  total_orders: number;
  avg_rating: number;
  active_offerings: number;
  tenant_connections: number;
  tenants_with_orders?: number;
  total_tenants?: number;
  popular_offerings: Array<{ name: string; avg_rating: number; review_count: number }>;
  ratings_distribution?: Record<number, number>;
  gender_distribution?: Record<"male" | "female" | "other" | "unknown", number>;
  age_distribution?: Record<"18-25" | "26-35" | "36-45" | "46-55" | "56+" | "unknown", number>;
  order_status_distribution?: Record<"paid" | "cancelled" | "expired" | "reserved" | "pending", number>;
}

const GENDER_LABELS: Record<string, string> = {
  male: "Мужской",
  female: "Женский",
  other: "Другой",
  unknown: "Не указан",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Оплачены",
  cancelled: "Отменены",
  expired: "Истёкшие",
  reserved: "Зарезервированы",
  pending: "В ожидании",
};

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

  const metrics: Array<{
    label: string;
    value: number | string;
    subValue?: string;
    icon: typeof Package;
  }> = [
    { label: "Активные предложения", value: data?.active_offerings ?? 0, icon: Package },
    { label: "Всего заказов", value: data?.total_orders ?? 0, icon: ClipboardList },
    { label: "Средний рейтинг", value: data?.avg_rating?.toFixed(1) ?? "—", icon: Star },
    {
      label: "Компаний используют льготу",
      value: data?.tenants_with_orders ?? 0,
      subValue: data?.total_tenants != null ? `из ${data.total_tenants}` : undefined,
      icon: Building2,
    },
  ];

  const rd = data?.ratings_distribution;
  const totalRatings = rd ? Object.values(rd).reduce((a, b) => a + b, 0) : 0;

  const c = useChartColors();

  // Gender pie — собираем без нулевых сегментов, чтобы пирог не показывал пустые сектора.
  const genderData = data?.gender_distribution
    ? (Object.entries(data.gender_distribution) as Array<[keyof NonNullable<Analytics["gender_distribution"]>, number]>)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: GENDER_LABELS[k] ?? k, value: v }))
    : [];
  const totalGender = genderData.reduce((s, x) => s + x.value, 0);

  // Age bar — сохраняем порядок бакетов, скрываем unknown если 0.
  const AGE_ORDER: Array<keyof NonNullable<Analytics["age_distribution"]>> = [
    "18-25", "26-35", "36-45", "46-55", "56+", "unknown",
  ];
  const ageData = data?.age_distribution
    ? AGE_ORDER
        .map((k) => ({ name: k === "unknown" ? "Без данных" : k, value: data.age_distribution![k] ?? 0 }))
        .filter((x) => x.value > 0)
    : [];
  const totalAge = ageData.reduce((s, x) => s + x.value, 0);

  // Order status — фокус на paid vs cancelled, остальные показываем если есть.
  const statusData = data?.order_status_distribution
    ? (Object.entries(data.order_status_distribution) as Array<[keyof NonNullable<Analytics["order_status_distribution"]>, number]>)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, value: v, key: k }))
    : [];
  const totalStatus = statusData.reduce((s, x) => s + x.value, 0);

  const GENDER_COLORS: Record<string, string> = {
    male: c.chart3,
    female: c.chart6,
    other: c.chart5,
    unknown: c.muted,
  };
  const STATUS_COLORS: Record<string, string> = {
    paid: c.chart2,        // зелёный — успех
    cancelled: c.chart1,   // оранжевый/красный — отмена
    expired: c.chart4,
    reserved: c.chart3,
    pending: c.muted,
  };

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
              <div className="text-2xl font-bold">
                {isLoading ? "..." : m.value}
                {!isLoading && m.subValue && (
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    ({m.subValue})
                  </span>
                )}
              </div>
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gender pie */}
        {totalGender > 0 && (
          <Card>
            <CardHeader><CardTitle>По полу покупателей</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      strokeWidth={2}
                      stroke={c.card}
                      label={({ percent }) => percent != null && percent > 0.05 ? `${Math.round(percent * 100)}%` : ""}
                    >
                      {genderData.map((entry, i) => {
                        const key = (Object.keys(GENDER_LABELS).find((k) => GENDER_LABELS[k] === entry.name) ?? "unknown");
                        return <Cell key={i} fill={GENDER_COLORS[key] ?? c.muted} />;
                      })}
                    </Pie>
                    <ReTooltip
                      formatter={(value) => [`${value ?? 0} чел.`, ""]}
                      contentStyle={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8 }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={28}
                      formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Age bar */}
        {totalAge > 0 && (
          <Card>
            <CardHeader><CardTitle>По возрасту покупателей</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.border} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: c.muted }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: c.muted }} />
                    <ReTooltip
                      formatter={(value) => [`${value ?? 0} чел.`, "Покупатели"]}
                      contentStyle={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8 }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40} fill={c.chart3} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order status pie */}
        {totalStatus > 0 && (
          <Card>
            <CardHeader><CardTitle>Статусы заказов</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      strokeWidth={2}
                      stroke={c.card}
                      label={({ percent }) => percent != null && percent > 0.05 ? `${Math.round(percent * 100)}%` : ""}
                    >
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.key] ?? c.muted} />
                      ))}
                    </Pie>
                    <ReTooltip
                      formatter={(value) => [`${value ?? 0} зак.`, ""]}
                      contentStyle={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8 }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={28}
                      formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
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
