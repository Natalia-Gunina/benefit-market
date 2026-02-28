"use client";

import { useEffect, useState } from "react";
import { Users, TrendingUp, Coins, Download } from "lucide-react";
import Papa from "papaparse";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/metric-card";

// ---------------------------------------------------------------------------
// Lazy-loaded chart components with dynamic imports
// ---------------------------------------------------------------------------

function ChartSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <Skeleton className="mb-4 h-5 w-48" />
      <Skeleton className="h-[300px] w-full rounded-md" />
    </div>
  );
}

const UtilizationChart = dynamic(
  () => import("@/components/dashboard/utilization-chart").then(m => ({ default: m.UtilizationChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

const CategoryChart = dynamic(
  () => import("@/components/dashboard/category-chart").then(m => ({ default: m.CategoryChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

const TrendChart = dynamic(
  () => import("@/components/dashboard/trend-chart").then(m => ({ default: m.TrendChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardSummary {
  total_employees: number;
  active_employees: number;
  total_accrued: number;
  total_spent: number;
  utilization_pct: number;
}

interface PopularBenefit {
  name: string;
  order_count: number;
  total_points: number;
}

interface CategoryDistribution {
  name: string;
  total_points: number;
  pct: number;
}

interface MonthlyTrend {
  month: string;
  accrued: number;
  spent: number;
}

interface DashboardData {
  summary: DashboardSummary;
  popular_benefits: PopularBenefit[];
  category_distribution: CategoryDistribution[];
  monthly_trend: MonthlyTrend[];
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function MetricSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="size-10 rounded-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HrDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/reports/dashboard");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.error?.message || `HTTP ${res.status}`
          );
        }
        const json = await res.json();
        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  function handleExportCsv() {
    if (!data) return;
    const rows = data.popular_benefits.map((b) => ({
      "Льгота": b.name,
      "Заказов": b.order_count,
      "Баллов": b.total_points,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hr-dashboard-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-transition space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">HR Дашборд</h1>
        <Button
          variant="outline"
          disabled={!data}
          onClick={handleExportCsv}
        >
          <Download className="size-4" />
          Экспорт в CSV
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-error-light px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* --- Metric Cards Row --- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : data ? (
          <>
            <MetricCard
              title="Сотрудников"
              value={data.summary.total_employees}
              subtitle={`Активных: ${data.summary.active_employees.toLocaleString("ru-RU")} из ${data.summary.total_employees.toLocaleString("ru-RU")}`}
              icon={Users}
            />
            <MetricCard
              title="Использование бюджета"
              value={data.summary.utilization_pct}
              suffix="%"
              subtitle={`${data.summary.total_spent.toLocaleString("ru-RU")} / ${data.summary.total_accrued.toLocaleString("ru-RU")} б.`}
              icon={TrendingUp}
            />
            <MetricCard
              title="Потрачено баллов"
              value={data.summary.total_spent}
              icon={Coins}
            />
          </>
        ) : null}
      </div>

      {/* --- Charts Row: Popular Benefits + Category Pie --- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : data ? (
          <>
            <UtilizationChart
              data={data.popular_benefits.map((b) => ({
                name: b.name,
                value: b.total_points,
              }))}
            />
            <CategoryChart
              data={data.category_distribution.map((c) => ({
                name: c.name,
                value: c.total_points,
              }))}
            />
          </>
        ) : null}
      </div>

      {/* --- Trend Chart (full width) --- */}
      <div>
        {loading ? (
          <ChartSkeleton />
        ) : data ? (
          <TrendChart data={data.monthly_trend} />
        ) : null}
      </div>
    </div>
  );
}
